import type { FastifyInstance } from "fastify";
import { prisma } from "@/prisma";
import { env } from "@/env";

interface CreateRewardActionBody {
  actionType: "RESTAKING" | "SELL";
  amount: string;
  averagePrice?: number;
  note?: string;
}

async function calculateAvailableBalance(): Promise<bigint> {
  // Get total claimed rewards
  const rewards = await prisma.validatorReward.findMany({
    where: {
      operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
      claimed: true,
    },
  });

  const totalClaimed = rewards.reduce(
    (sum, reward) => sum + BigInt(reward.rewardAmount),
    BigInt(0)
  );

  // Get all actions
  const actions = await prisma.rewardAction.findMany();

  let totalRestaking = BigInt(0);
  let totalSold = BigInt(0);

  for (const action of actions) {
    if (action.actionType === "RESTAKING") {
      totalRestaking += BigInt(action.amount);
    } else if (action.actionType === "SELL") {
      totalSold += BigInt(action.amount);
    }
  }

  // Available balance = total claimed - total restaking - total sold
  return totalClaimed - totalRestaking - totalSold;
}

export default async function rewardActionsRoutes(app: FastifyInstance) {
  // Get all reward actions
  app.get("/reward-actions", async (request, reply) => {
    await app.authenticate(request, reply);

    const actions = await prisma.rewardAction.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return reply.send(actions);
  });

  // Get reward actions summary
  app.get("/reward-actions/summary", async (request, reply) => {
    await app.authenticate(request, reply);

    const actions = await prisma.rewardAction.findMany();

    let totalRestaking = BigInt(0);
    let totalSellAmount = BigInt(0);
    let totalSellRevenue = 0;

    for (const action of actions) {
      if (action.actionType === "RESTAKING") {
        totalRestaking += BigInt(action.amount);
      } else if (action.actionType === "SELL") {
        const amount = BigInt(action.amount);
        totalSellAmount += amount;
        if (action.averagePrice) {
          // Convert amount from base units to token amount (divide by 10^18)
          // Then multiply by average price
          const tokenAmount = Number(amount) / 1e18;
          totalSellRevenue += tokenAmount * action.averagePrice;
        }
      }
    }

    const availableBalance = await calculateAvailableBalance();

    return reply.send({
      totalRestaking: totalRestaking.toString(),
      totalSellAmount: totalSellAmount.toString(),
      totalSellRevenue,
      availableBalance: availableBalance.toString(),
    });
  });

  // Create a new reward action
  app.post<{ Body: CreateRewardActionBody }>(
    "/reward-actions",
    async (request, reply) => {
      await app.authenticate(request, reply);

      const { actionType, amount, averagePrice, note } = request.body;

      // Validate required fields
      if (!actionType || !amount) {
        return reply.status(400).send({
          error: "actionType and amount are required",
        });
      }

      // Validate actionType
      if (actionType !== "RESTAKING" && actionType !== "SELL") {
        return reply.status(400).send({
          error: "actionType must be either RESTAKING or SELL",
        });
      }

      // Validate SELL requires averagePrice
      if (actionType === "SELL" && !averagePrice) {
        return reply.status(400).send({
          error: "averagePrice is required for SELL actions",
        });
      }

      // Validate amount is a valid number string
      let amountBigInt: bigint;
      try {
        amountBigInt = BigInt(amount);
      } catch {
        return reply.status(400).send({
          error: "amount must be a valid number string",
        });
      }

      // Validate amount is not negative
      if (amountBigInt <= BigInt(0)) {
        return reply.status(400).send({
          error: "amount must be greater than 0",
        });
      }

      // Check available balance
      const availableBalance = await calculateAvailableBalance();
      if (amountBigInt > availableBalance) {
        const availableTokens = Number(availableBalance) / 1e18;
        const requestedTokens = Number(amountBigInt) / 1e18;
        return reply.status(400).send({
          error: `Insufficient balance. Available: ${availableTokens.toFixed(6)} MITO, Requested: ${requestedTokens.toFixed(6)} MITO`,
        });
      }

      // Validate averagePrice is positive for SELL actions
      if (actionType === "SELL" && averagePrice && averagePrice <= 0) {
        return reply.status(400).send({
          error: "averagePrice must be greater than 0",
        });
      }

      const action = await prisma.rewardAction.create({
        data: {
          actionType,
          amount,
          averagePrice: actionType === "SELL" ? averagePrice : null,
          note,
        },
      });

      return reply.status(201).send(action);
    }
  );

  // Delete a reward action
  app.delete<{ Params: { id: string } }>(
    "/reward-actions/:id",
    async (request, reply) => {
      await app.authenticate(request, reply);

      const { id } = request.params;

      try {
        await prisma.rewardAction.delete({
          where: { id },
        });

        return reply.status(204).send();
      } catch (error) {
        return reply.status(404).send({
          error: "Reward action not found",
        });
      }
    }
  );
}
