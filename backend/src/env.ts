import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_SECRET: z.string().min(16),
  APP_ORIGIN: z.string().min(1),
  RPC_URL: z.string().url(),
  REWARD_CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  VALIDATOR_OPERATOR_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  CONTRACT_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  CONTRACT_EVENT_TOPIC: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .optional(),
  POLL_INTERVAL_MS: z.coerce.number().int().positive().default(30000),
  START_BLOCK: z.coerce.bigint().nonnegative().default(0n)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment configuration", parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
