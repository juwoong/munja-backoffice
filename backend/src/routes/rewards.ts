import type { FastifyInstance } from "fastify";
import { prisma } from "@/prisma";
import { env } from "@/env";

export default async function rewardsRoutes(app: FastifyInstance) {
  app.get("/rewards", async (request, reply) => {
    await request.jwtVerify();

    const rewards = await prisma.validatorReward.findMany({
      where: {
        operatorAddress: env.VALIDATOR_OPERATOR_ADDRESS
      },
      orderBy: {
        epoch: "desc"
      }
    });

    return reply.send(rewards);
  });
}