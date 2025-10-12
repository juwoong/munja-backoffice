import type { FastifyBaseLogger } from "fastify";
import { JsonRpcProvider, Contract } from "ethers";
import schedule, { type Job } from "node-schedule";

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

const TEN_MINUTE_CRON = "*/10 * * * *";

export interface RewardPollerResult {
  status: "new-reward" | "no-change" | "skipped" | "initialized";
  timestamp: string;
  updatedClaimedCount: number;
  newReward?: {
    epoch: number;
    amount: string;
  };
  reason?: "poll-in-progress";
}

export class RewardPoller {
  private job: Job | null = null;
  private provider = new JsonRpcProvider(env.RPC_URL);
  private running = false;
  private distributor = new Contract(
    env.REWARD_CONTRACT_ADDRESS,
    distributorAbi,
    this.provider
  );
  private polling = false;

  constructor(private readonly logger: FastifyBaseLogger) {}

  async start() {
    if (this.running) {
      return;
    }

    this.running = true;
    this.logger.info({ cron: TEN_MINUTE_CRON }, "Starting reward poller");

    try {
      await this.poll();
    } catch (error) {
      this.logger.error({ err: error }, "Initial reward poll run failed");
    }

    const scheduledJob = schedule.scheduleJob(TEN_MINUTE_CRON, async () => {
      if (!this.running) {
        return;
      }
      try {
        await this.poll();
      } catch (error) {
        this.logger.error({ err: error }, "Reward poller iteration failed");
      }
    });

    if (!scheduledJob) {
      this.logger.error(
        { cron: TEN_MINUTE_CRON },
        "Failed to schedule reward poller"
      );
      this.running = false;
      return;
    }

    this.job = scheduledJob;
  }

  async stop() {
    if (this.job) {
      this.job.cancel();
      this.job = null;
    }

    if (!this.running) {
      return;
    }
    this.running = false;
    this.logger.info("Reward poller stopped");
  }

  async refresh(): Promise<RewardPollerResult> {
    this.logger.info("Manual reward refresh requested");
    return this.poll();
  }

  private async poll(): Promise<RewardPollerResult> {
    if (this.polling) {
      this.logger.info("Poll already in progress, skipping new run");
      return {
        status: "skipped",
        reason: "poll-in-progress",
        updatedClaimedCount: 0,
        timestamp: new Date().toISOString(),
      };
    }

    this.polling = true;
    try {
      return await this.executePoll();
    } finally {
      this.polling = false;
    }
  }

  private async executePoll(): Promise<RewardPollerResult> {
    this.logger.info("Polling for validator rewards...");

    const { updatedCount: updatedClaimedCount, lastClaimedEpochOnChain } =
      await this.updateClaimedStatus();

    const [totalClaimableRewards] =
      await this.distributor.claimableOperatorRewards(
        env.VALIDATOR_OPERATOR_ADDRESS
      );

    const existingRewardCount = await prisma.validatorReward.count({
      where: {
        operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
      },
    });

    const unclaimedRewardsInDb = await prisma.validatorReward.findMany({
      select: {
        rewardAmount: true,
      },
      where: {
        operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
        claimed: false,
      },
    });
    const sumOfUnclaimedRewardsInDb = unclaimedRewardsInDb.reduce<bigint>(
      (acc, reward) => {
        try {
          return acc + BigInt(reward.rewardAmount);
        } catch (_error) {
          return acc;
        }
      },
      0n
    );

    const newRewardAmount =
      BigInt(totalClaimableRewards) - sumOfUnclaimedRewardsInDb;

    if (newRewardAmount > 0n) {
      const lastReward = await prisma.validatorReward.findFirst({
        where: { operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS },
        orderBy: { epoch: "desc" },
      });
      const newEpochNumber = lastReward ? lastReward.epoch + 1 : 1;

      this.logger.info(
        { epoch: newEpochNumber, reward: newRewardAmount.toString() },
        "Found new reward to persist."
      );

      await prisma.validatorReward.create({
        data: {
          operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
          epoch: newEpochNumber,
          rewardAmount: newRewardAmount.toString(),
          claimed: false,
        },
      });

      return {
        status: "new-reward",
        updatedClaimedCount,
        newReward: {
          epoch: newEpochNumber,
          amount: newRewardAmount.toString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    if (existingRewardCount === 0) {
      const inferredEpoch =
        lastClaimedEpochOnChain > 0n ? Number(lastClaimedEpochOnChain) + 1 : 1;

      const createdReward = await prisma.validatorReward.create({
        data: {
          operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
          epoch: inferredEpoch,
          rewardAmount: totalClaimableRewards.toString(),
          claimed: false,
        },
      });

      this.logger.info(
        { epoch: inferredEpoch, reward: totalClaimableRewards.toString() },
        "Initialized validator rewards dataset"
      );

      return {
        status: "initialized",
        updatedClaimedCount,
        newReward: {
          epoch: createdReward.epoch,
          amount: totalClaimableRewards.toString(),
        },
        timestamp: new Date().toISOString(),
      };
    }

    this.logger.info("No new rewards detected.");

    return {
      status: "no-change",
      updatedClaimedCount,
      timestamp: new Date().toISOString(),
    };
  }

  private async updateClaimedStatus(): Promise<{
    updatedCount: number;
    lastClaimedEpochOnChain: bigint;
  }> {
    const lastClaimedEpochOnChain =
      await this.distributor.lastClaimedOperatorRewardsEpoch(
        env.VALIDATOR_OPERATOR_ADDRESS
      );

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
        this.logger.info(
          {
            count: result.count,
            lastClaimedEpoch: lastClaimedEpochOnChain.toString(),
          },
          "Updated claimed status for rewards."
        );
      }

      return {
        updatedCount: result.count,
        lastClaimedEpochOnChain,
      };
    }

    return {
      updatedCount: 0,
      lastClaimedEpochOnChain,
    };
  }
}
