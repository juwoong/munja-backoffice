import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";

import { env } from "@/env";
import authenticationPlugin from "@/plugins/authentication";
import authRoutes from "@/routes/auth";
import eventsRoutes from "@/routes/events";
import { EventPoller } from "@/services/event-poller";
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

  return app;
}

async function main() {
  const app = await buildServer();
  const poller = new EventPoller(app.log);

  app.addHook("onClose", async () => {
    await poller.stop();
    await disconnectPrisma();
  });

  try {
    await poller.start();
  } catch (error) {
    app.log.error({ err: error }, "Failed to start event poller");
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
