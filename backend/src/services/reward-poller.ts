import type { FastifyBaseLogger } from "fastify";
import { JsonRpcProvider, Contract, type BigNumberish } from "ethers";

import { env } from "@/env";
import { prisma } from "@/prisma";

const distributorAbi = [
  {"inputs":[],"name":"validatorManager","outputs":[{"internalType":"contract IValidatorManager","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"validatorContributionFeed","outputs":[{"internalType":"contract IValidatorContributionFeed","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"govMITOEmission","outputs":[{"internalType":"contract IGovMITOEmission","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"epochFeeder","outputs":[{"internalType":"contract IEpochFeeder","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"valAddr","type":"address"}],"name":"lastClaimedOperatorRewardsEpoch","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

const managerAbi = [
  {"inputs":[{"internalType":"uint256","name":"epoch","type":"uint256"},{"internalType":"address","name":"valAddr","type":"address"}],"name":"validatorInfoAt","outputs":[{"components":[{"internalType":"address","name":"rewardManager","type":"address"},{"internalType":"uint96","name":"commissionRate","type":"uint96"}],"internalType":"struct IValidatorManager.ValidatorInfoResponse","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"MAX_COMMISSION_RATE","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

const feedAbi = [
  {"inputs":[{"internalType":"uint256","name":"epoch","type":"uint256"}],"name":"summary","outputs":[{"components":[{"internalType":"uint256","name":"totalWeight","type":"uint256"},{"internalType":"uint256","name":"totalCollateralRewardShare","type":"uint256"},{"internalType":"uint256","name":"totalDelegationRewardShare","type":"uint256"}],"internalType":"struct IValidatorContributionFeed.Summary","name":"","type":"tuple"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"epoch","type":"uint256"},{"internalType":"address","name":"valAddr","type":"address"}],"name":"weightOf","outputs":[{"components":[{"internalType":"uint256","name":"weight","type":"uint256"},{"internalType":"uint256","name":"collateralRewardShare","type":"uint256"},{"internalType":"uint256","name":"delegationRewardShare","type":"uint256"}],"internalType":"struct IValidatorContributionFeed.ValidatorWeight","name":"","type":"tuple"},{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"epoch","type":"uint256"}],"name":"available","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}
];

const emissionAbi = [
  {"inputs":[{"internalType":"uint96","name":"epoch","type":"uint96"}],"name":"validatorReward","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

const epochFeederAbi = [
  {"inputs":[],"name":"epoch","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];

export class RewardPoller {
  private timer: NodeJS.Timer | null = null;
  private provider = new JsonRpcProvider(env.RPC_URL);
  private running = false;

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
    const distributor = new Contract(env.REWARD_CONTRACT_ADDRESS, distributorAbi, this.provider);

    const validatorManagerAddr = await distributor.validatorManager();
    const contributionFeedAddr = await distributor.validatorContributionFeed();
    const govMITOEmissionAddr = await distributor.govMITOEmission();
    const epochFeederAddr = await distributor.epochFeeder();

    const manager = new Contract(validatorManagerAddr, managerAbi, this.provider);
    const feed = new Contract(contributionFeedAddr, feedAbi, this.provider);
    const emission = new Contract(govMITOEmissionAddr, emissionAbi, this.provider);
    const epochFeeder = new Contract(epochFeederAddr, epochFeederAbi, this.provider);

    const lastProcessedEpoch = await this.getLastProcessedEpoch();
    const currentEpoch = await epochFeeder.epoch();

    if (lastProcessedEpoch >= currentEpoch) {
      this.logger.info({ lastProcessedEpoch, currentEpoch }, "No new epochs to process for rewards");
      return;
    }

    this.logger.info({ from: lastProcessedEpoch + 1n, to: currentEpoch }, "Polling for rewards");

    for (let epoch = lastProcessedEpoch + 1n; epoch < currentEpoch; epoch++) {
      const available = await feed.available(epoch);
      if (!available) {
        this.logger.info({ epoch }, "Contribution feed not available for epoch, stopping for now.");
        break;
      }
      const reward = await this.calculateRewardForEpoch(epoch, manager, feed, emission);
      await this.persistReward(epoch, reward, distributor);
    }
  }

  private async getLastProcessedEpoch(): Promise<bigint> {
    const lastReward = await prisma.validatorReward.findFirst({
      where: { operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS },
      orderBy: { epoch: 'desc' }
    });
    // Start from epoch 1 if no rewards are stored
    return lastReward ? BigInt(lastReward.epoch) : 0n;
  }

  private async calculateRewardForEpoch(
    epoch: bigint,
    manager: Contract,
    feed: Contract,
    emission: Contract
  ): Promise<bigint> {
    const validatorInfo = await manager.validatorInfoAt(epoch, env.VALIDATOR_OPERATOR_ADDRESS);
    const summary = await feed.summary(epoch);
    const [weight, exists] = await feed.weightOf(epoch, env.VALIDATOR_OPERATOR_ADDRESS);

    if (!exists || summary.totalWeight === 0n) {
      return 0n;
    }

    const validatorReward = await emission.validatorReward(epoch);
    const totalReward = (validatorReward * weight.weight) / summary.totalWeight;
    const totalRewardShare = weight.collateralRewardShare + weight.delegationRewardShare;

    if (totalRewardShare === 0n) {
      return totalReward; // All rewards go to operator
    }

    const stakerReward = (totalReward * weight.delegationRewardShare) / totalRewardShare;
    const maxCommissionRate = await manager.MAX_COMMISSION_RATE();
    const commission = (stakerReward * validatorInfo.commissionRate) / maxCommissionRate;

    const operatorReward = (totalReward - stakerReward) + commission;
    return operatorReward;
  }

  private async persistReward(epoch: bigint, reward: bigint, distributor: Contract) {
    const lastClaimedEpoch = await distributor.lastClaimedOperatorRewardsEpoch(env.VALIDATOR_OPERATOR_ADDRESS);
    const claimed = epoch <= lastClaimedEpoch;

    this.logger.info({ epoch, reward: reward.toString(), claimed }, "Persisting reward");

    await prisma.validatorReward.upsert({
      where: {
        operatorAddress_epoch: {
          operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
          epoch: Number(epoch)
        }
      },
      update: {
        rewardAmount: reward,
        claimed: claimed
      },
      create: {
        operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
        epoch: Number(epoch),
        rewardAmount: reward,
        claimed: claimed,
      }
    });
  }
}