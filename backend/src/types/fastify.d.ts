import "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { RewardPoller } from "@/services/reward-poller";
import type { PriceService } from "@/services/price-service";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    rewardPoller: RewardPoller;
    priceService: PriceService;
  }
}
