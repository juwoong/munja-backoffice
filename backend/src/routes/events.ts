import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "@/prisma";

const eventsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/events",
    {
      preHandler: fastify.authenticate
    },
    async (request, reply) => {
      const parseResult = eventsQuerySchema.safeParse(request.query);
      if (!parseResult.success) {
        return reply.status(400).send({ error: parseResult.error.flatten() });
      }

      const { page, pageSize } = parseResult.data;
      const skip = (page - 1) * pageSize;

      const [total, events] = await Promise.all([
        prisma.contractEvent.count(),
        prisma.contractEvent.findMany({
          orderBy: { blockNumber: "desc" },
          skip,
          take: pageSize
        })
      ]);

      return reply.send({
        data: events.map((event) => ({
          ...event,
          blockNumber: event.blockNumber.toString(),
          createdAt: event.createdAt.toISOString()
        })),
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize)
        }
      });
    }
  );

  fastify.get(
    "/events/latest",
    { preHandler: fastify.authenticate },
    async (_request, reply) => {
      const latest = await prisma.contractEvent.findFirst({
        orderBy: { blockNumber: "desc" }
      });

      if (!latest) {
        return reply.send({ data: null });
      }

      return reply.send({
        data: {
          ...latest,
          blockNumber: latest.blockNumber.toString(),
          createdAt: latest.createdAt.toISOString()
        }
      });
    }
  );
};

export default eventsRoutes;
