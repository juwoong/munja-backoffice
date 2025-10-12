import fp from "fastify-plugin";
import fastifyJwt from "@fastify/jwt";
import type { FastifyPluginAsync } from "fastify";
import { env } from "@/env";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { userId: string };
    user: { userId: string };
  }
}

const authenticationPlugin: FastifyPluginAsync = fp(async (fastify) => {
  await fastify.register(fastifyJwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: "12h" },
  });

  fastify.decorate("authenticate", async (request: any, reply: any) => {
    const authHeader = request.headers?.authorization ?? "";

    if (env.DEV_AUTH_BEARER_TOKEN) {
      const [scheme, tokenCandidate] = authHeader.split(" ");
      const matchedToken =
        scheme?.toLowerCase() === "bearer" && tokenCandidate
          ? tokenCandidate
          : authHeader?.trim();

      console.log("matchedToken", matchedToken);

      if (matchedToken === "dummy-token") {
        request.user = { userId: "dev-mock" };
        return;
      }
    }

    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });
});

export default authenticationPlugin;
