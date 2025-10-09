import type { FastifyBaseLogger } from "fastify";
import { JsonRpcProvider, type Log } from "ethers";

import { env } from "@/env";
import { prisma } from "@/prisma";

const POLLING_STATE_ID = 1;

export class EventPoller {
  private timer: NodeJS.Timeout | null = null;
  private provider = new JsonRpcProvider(env.RPC_URL);
  private running = false;

  constructor(private readonly logger: FastifyBaseLogger) {}

  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.logger.info({ interval: env.POLL_INTERVAL_MS }, "Starting contract event poller");

    await this.ensureInitialState();
    await this.poll();

    this.timer = setInterval(async () => {
      try {
        await this.poll();
      } catch (error) {
        this.logger.error({ err: error }, "Poller iteration failed");
      }
    }, env.POLL_INTERVAL_MS);
  }

  async stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (!this.running) {
      return;
    }
    this.running = false;
    this.logger.info("Contract event poller stopped");
  }

  private async ensureInitialState() {
    const state = await prisma.pollingState.findUnique({ where: { id: POLLING_STATE_ID } });
    if (!state) {
      await prisma.pollingState.create({
        data: {
          id: POLLING_STATE_ID,
          lastBlock: env.START_BLOCK > 0n ? env.START_BLOCK - 1n : 0n
        }
      });
    }
  }

  private async poll() {
    const state = await prisma.pollingState.findUnique({ where: { id: POLLING_STATE_ID } });
    const lastProcessed = state?.lastBlock ?? env.START_BLOCK - 1n;

    const latestBlockNumber = await this.provider.getBlockNumber();
    const fromBlock = lastProcessed + 1n;
    const toBlock = BigInt(latestBlockNumber);

    if (fromBlock > toBlock) {
      this.logger.debug({ fromBlock, toBlock }, "No new blocks to process");
      return;
    }

    this.logger.info({ fromBlock: fromBlock.toString(), toBlock: toBlock.toString() }, "Polling contract logs");

    const filter = {
      address: env.CONTRACT_ADDRESS,
      fromBlock,
      toBlock,
      topics: env.CONTRACT_EVENT_TOPIC ? [env.CONTRACT_EVENT_TOPIC] : undefined
    } as const;

    const logs = await this.provider.getLogs(filter);

    if (logs.length === 0) {
      await prisma.pollingState.update({
        where: { id: POLLING_STATE_ID },
        data: { lastBlock: toBlock }
      });
      this.logger.debug("No new logs found");
      return;
    }

    await this.persistLogs(logs);

    await prisma.pollingState.update({
      where: { id: POLLING_STATE_ID },
      data: { lastBlock: toBlock }
    });

    this.logger.info({ count: logs.length }, "Stored contract logs");
  }

  private async persistLogs(logs: Log[]) {
    await prisma.$transaction(
      logs.map((log) =>
        prisma.contractEvent.upsert({
          where: {
            transactionHash_logIndex: {
              transactionHash: log.transactionHash,
              logIndex: Number(log.index)
            }
          },
          update: {},
          create: {
            address: log.address,
            blockNumber: BigInt(log.blockNumber),
            transactionHash: log.transactionHash,
            logIndex: Number(log.index),
            data: log.data,
            topics: [...log.topics]
          }
        })
      )
    );
  }
}
