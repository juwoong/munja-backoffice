import type { FastifyInstance } from "fastify";
import { prisma } from "@/prisma";
import { env } from "@/env";

// Decimal 값을 10진법 문자열로 직렬화하는 함수
function serializeRewards(rewards: any[]) {
  return rewards.map((reward) => ({
    ...reward,
    rewardAmount: reward.rewardAmount?.toString() || "0",
  }));
}

export default async function rewardsRoutes(app: FastifyInstance) {
  app.get("/rewards", async (request, reply) => {
    await app.authenticate(request, reply);

    const rewards = await prisma.validatorReward.findMany({
      where: {
        operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS,
      },
      orderBy: {
        epoch: "desc",
      },
    });

    const serializedRewards = serializeRewards(rewards);
    console.log("serializedRewards", serializedRewards);
    return reply.send(serializedRewards);
  });

  app.post("/rewards/refresh", async (request, reply) => {
    await app.authenticate(request, reply);

    try {
      request.log.info("Manual rewards refresh requested");
      const result = await app.rewardPoller.refresh();

      if (result.status === "skipped") {
        request.log.warn({ result }, "Manual rewards refresh skipped");
        return reply.status(409).send({
          ...result,
          error: "Refresh already in progress",
        });
      }

      if (result.status === "no-change") {
        request.log.info(
          { result },
          "Manual rewards refresh completed without changes"
        );
        return reply.status(200).send({
          ...result,
          message: "No new rewards detected.",
        });
      }

      if (result.status === "initialized") {
        request.log.info({ result }, "Validator rewards initialized");
        return reply.status(201).send({
          ...result,
          message: "Initialized validator rewards dataset.",
        });
      }

      request.log.info(
        { result },
        "Manual rewards refresh persisted new rewards"
      );
      return reply.status(200).send(result);
    } catch (error) {
      request.log.error({ err: error }, "Manual rewards refresh failed");
      return reply.status(500).send({ error: "Failed to refresh rewards" });
    }
  });
}
