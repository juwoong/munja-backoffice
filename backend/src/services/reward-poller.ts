import type { FastifyBaseLogger } from "fastify";
import { JsonRpcProvider, Contract } from "ethers";

import { env } from "@/env";
import { prisma } from "@/prisma";

const distributorAbi = [
  {
    inputs: [{ internalType: "address", name: "valAddr", type: "address" }],
    name: "claimableOperatorRewards",
    outputs: [
      { internalType: "uint256", name: "amount", type: "uint256" },
      { internalType: "uint256", name: "epoch", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ internalType: "address", name: "valAddr", type: "address" }],
    name: "lastClaimedOperatorRewardsEpoch",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export class RewardPoller {
  private timer: NodeJS.Timer | null = null;
  private provider = new JsonRpcProvider(env.RPC_URL);
  private running = false;
  private distributor = new Contract(env.REWARD_CONTRACT_ADDRESS, distributorAbi, this.provider);

  constructor(private readonly logger: FastifyBaseLogger) {}

  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.logger.info({ interval: env.POLL_INTERVAL_MS }, "Starting reward poller");

    await this.poll();

    this.timer = setInterval(async () => {
      try {
        await this.poll();
      } catch (error) {
        this.logger.error({ err: error }, "Reward poller iteration failed");
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
    this.logger.info("Reward poller stopped");
  }

  private async poll() {
    this.logger.info("Polling for validator rewards...");

    // 1. Update the claimed status of all rewards in the database first.
    await this.updateClaimedStatus();

    // 2. Fetch the total claimable rewards from the contract.
    const [totalClaimableRewards] = await this.distributor.claimableOperatorRewards(env.VALIDATOR_OPERATOR_ADDRESS);

    // 3. Get the sum of unclaimed rewards we have in our database.
    const unclaimedRewardsInDb = await prisma.validatorReward.aggregate({
      _sum: {
        rewardAmount: true,
      },
      where: {
        operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
        claimed: false,
      },
    });
    const sumOfUnclaimedRewardsInDb = unclaimedRewardsInDb._sum.rewardAmount ?? 0n;

    // 4. The difference is the reward for the new epoch(s).
    const newRewardAmount = BigInt(totalClaimableRewards) - sumOfUnclaimedRewardsInDb;

    if (newRewardAmount > 0n) {
      // 5. Find the latest epoch number from the database to determine the new epoch number.
      const lastReward = await prisma.validatorReward.findFirst({
        where: { operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS },
        orderBy: { epoch: 'desc' },
      });
      const newEpochNumber = lastReward ? lastReward.epoch + 1 : 1; // Start from epoch 1 if none exists

      this.logger.info({ epoch: newEpochNumber, reward: newRewardAmount.toString() }, "Found new reward to persist.");

      await prisma.validatorReward.create({
        data: {
          operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
          epoch: newEpochNumber,
          rewardAmount: newRewardAmount,
          claimed: false, // New rewards are by definition unclaimed.
        },
      });
    } else {
        this.logger.info("No new rewards detected.");
    }
  }

  private async updateClaimedStatus() {
    const lastClaimedEpochOnChain = await this.distributor.lastClaimedOperatorRewardsEpoch(env.VALIDATOR_OPERATOR_ADDRESS);

    if (lastClaimedEpochOnChain > 0n) {
      const result = await prisma.validatorReward.updateMany({
        where: {
          operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
          epoch: { lte: Number(lastClaimedEpochOnChain) },
          claimed: false,
        },
        data: {
          claimed: true,
        },
      });

      if (result.count > 0) {
        this.logger.info({ count: result.count, lastClaimedEpoch: lastClaimedEpochOnChain.toString() }, "Updated claimed status for rewards.");
      }
    }
  }
}