import Fastify from "fastify";
import cors from "@fastify/cors";

import { env } from "@/env";
import authenticationPlugin from "@/plugins/authentication";
import authRoutes from "@/routes/auth";
import rewardsRoutes from "@/routes/rewards";
import rewardActionsRoutes from "@/routes/reward-actions";
import priceRoutes from "@/routes/price";
import { RewardPoller } from "@/services/reward-poller";
import { PriceService } from "@/services/price-service";
import { disconnectPrisma } from "@/prisma";

async function buildServer() {
  const app = Fastify({
    logger: {
      transport: {
        target: "pino-pretty",
      },
    },
  });

  const allowedOrigins = ["*"];

  app.decorate("rewardPoller", new RewardPoller(app.log));
  app.decorate("priceService", new PriceService(app.log));

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: "*",
    exposedHeaders: "*",
    maxAge: 86400,
  });
  await app.register(authenticationPlugin);

  await app.register(authRoutes);
  await app.register(rewardsRoutes);
  await app.register(rewardActionsRoutes);
  await app.register(priceRoutes);

  return app;
}

async function main() {
  const app = await buildServer();

  app.addHook("onClose", async () => {
    await app.rewardPoller.stop();
    await disconnectPrisma();
  });

  try {
    await app.rewardPoller.start();
  } catch (error) {
    app.log.error({ err: error }, "Failed to start reward poller");
    process.exit(1);
  }

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`API listening on port ${env.PORT}`);
  } catch (error) {
    app.log.error({ err: error }, "Failed to start server");
    process.exit(1);
  }

  const shutdown = async () => {
    app.log.info("Received shutdown signal");
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main();
