import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  NEXTAUTH_SECRET: z.string().min(1).optional(),
  NEXTAUTH_URL: z.string().url().optional(),
  RESEND_API_KEY: z.string().optional(),
  BOTPASS_FROM_EMAIL: z.string().email().optional(),
  OPENCLAW_PROVIDER_MODE: z.enum(["real", "mock"]).default("mock"),
  OPENCLAW_ENDPOINT: z.string().url().optional(),
  OPENCLAW_TOKEN: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  ADMIN_SEED_USERNAME: z.string().optional(),
  ADMIN_SEED_PASSWORD: z.string().optional()
});

export type BotPassEnv = z.infer<typeof envSchema>;

export function getEnv(overrides?: Record<string, string | undefined>): BotPassEnv {
  return envSchema.parse({ ...process.env, ...overrides });
}
