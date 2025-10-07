import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";

import { env } from "@/env";
import authenticationPlugin from "@/plugins/authentication";
import authRoutes from "@/routes/auth";
import eventsRoutes from "@/routes/events";
import rewardsRoutes from "@/routes/rewards";
import { EventPoller } from "@/services/event-poller";
import { RewardPoller } from "@/services/reward-poller";
import { disconnectPrisma } from "@/prisma";

async function buildServer() {
  const app = Fastify({
    logger: {
      transport: {
        target: "pino-pretty"
      }
    }
  });

  await app.register(sensible);
  await app.register(cors, {
    origin: env.APP_ORIGIN,
    credentials: true
  });
  await app.register(authenticationPlugin);

  await app.register(authRoutes);
  await app.register(eventsRoutes);
  await app.register(rewardsRoutes);

  return app;
}

async function main() {
  const app = await buildServer();
  const eventPoller = new EventPoller(app.log);
  const rewardPoller = new RewardPoller(app.log);

  app.addHook("onClose", async () => {
    await Promise.all([eventPoller.stop(), rewardPoller.stop()]);
    await disconnectPrisma();
  });

  try {
    await Promise.all([eventPoller.start(), rewardPoller.start()]);
  } catch (error) {
    app.log.error({ err: error }, "Failed to start pollers");
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
