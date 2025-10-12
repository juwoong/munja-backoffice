import type { FastifyInstance } from "fastify";

export default async function priceRoutes(app: FastifyInstance) {
  app.get("/price/mitosis", async (request, reply) => {
    await app.authenticate(request, reply);

    try {
      const price = await app.priceService.getMitosisPrice();
      return reply.send({ price, currency: "usd" });
    } catch (error) {
      request.log.error({ err: error }, "Failed to get Mitosis price");
      return reply.status(500).send({ error: "Failed to fetch Mitosis price" });
    }
  });
}
