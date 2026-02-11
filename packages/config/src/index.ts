import { z } from "zod";

export type DeployTarget = "development" | "staging" | "production";

function emptyToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function optionalString() {
  return z.preprocess(emptyToUndefined, z.string().optional());
}

function optionalUrl() {
  return z.preprocess(emptyToUndefined, z.string().url().optional());
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optionalString(),
  NEXTAUTH_SECRET: optionalString(),
  NEXTAUTH_URL: optionalUrl(),
  RESEND_API_KEY: optionalString(),
  BOTPASS_FROM_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  SENTRY_DSN: optionalUrl(),
  SENTRY_TRACES_SAMPLE_RATE: optionalString(),
  OTEL_SERVICE_NAME: optionalString(),
  OTEL_DEBUG: optionalString(),
  OTEL_CONSOLE_EXPORTER: optionalString(),
  CONTENT_MOD_MALICIOUS_KEYWORDS: optionalString(),
  CONTENT_MOD_PROMO_KEYWORDS: optionalString(),
  CONTENT_MOD_URL_COUNT_SPAM: optionalString(),
  CONTENT_MOD_REPEATED_CHAR_MIN: optionalString(),
  CONTENT_MOD_PUNCT_FLOOD_MIN: optionalString(),
  CONTENT_MOD_MAX_CONTENT_LENGTH: optionalString(),
  CONTENT_MOD_MAX_LINE_COUNT: optionalString(),
  CONTENT_MOD_CONTEXT_OVERLAP_MIN: optionalString(),
  OPENCLAW_PROVIDER_MODE: z.preprocess(emptyToUndefined, z.enum(["real", "mock"]).default("mock")),
  OPENCLAW_ENDPOINT: optionalUrl(),
  OPENCLAW_TOKEN: optionalString(),
  OPENCLAW_TIMEOUT_MS: optionalString(),
  OPENCLAW_MAX_RETRIES: optionalString(),
  OPENCLAW_RETRY_BACKOFF_MS: optionalString(),
  OPENCLAW_FALLBACK_TO_MOCK: optionalString(),
  OPENCLAW_BASE_PATH: optionalString(),
  UPSTASH_REDIS_REST_URL: optionalUrl(),
  UPSTASH_REDIS_REST_TOKEN: optionalString(),
  ADMIN_SEED_USERNAME: optionalString(),
  ADMIN_SEED_PASSWORD: optionalString()
});

export type BotPassEnv = z.infer<typeof envSchema>;

export interface DeployEnvReport {
  ok: boolean;
  missing: string[];
  warnings: string[];
  target: DeployTarget;
}

function isLocalOrPrivateHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized === "::1" || normalized === "0.0.0.0") {
    return true;
  }
  if (normalized.endsWith(".local")) {
    return true;
  }
  if (/^127\./.test(normalized) || /^10\./.test(normalized)) {
    return true;
  }
  if (/^192\.168\./.test(normalized)) {
    return true;
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(normalized)) {
    return true;
  }
  return false;
}

export function getEnv(overrides?: Record<string, string | undefined>): BotPassEnv {
  return envSchema.parse({ ...process.env, ...overrides });
}

export function validateDeployEnv(target: DeployTarget, overrides?: Record<string, string | undefined>): DeployEnvReport {
  const env = getEnv(overrides);
  const missing: string[] = [];
  const warnings: string[] = [];

  const requireEnv = (name: keyof BotPassEnv, shouldRequire = true) => {
    if (!shouldRequire) {
      return;
    }
    const value = env[name];
    if (value === undefined || value === "") {
      missing.push(String(name));
    }
  };

  requireEnv("DATABASE_URL");
  requireEnv("NEXTAUTH_SECRET");
  requireEnv("NEXTAUTH_URL");

  if (target !== "development") {
    requireEnv("BOTPASS_FROM_EMAIL");
    requireEnv("UPSTASH_REDIS_REST_URL");
    requireEnv("UPSTASH_REDIS_REST_TOKEN");

    requireEnv("RESEND_API_KEY");

    if (env.OPENCLAW_PROVIDER_MODE !== "real") {
      missing.push("OPENCLAW_PROVIDER_MODE=real");
    }

    requireEnv("OPENCLAW_ENDPOINT", env.OPENCLAW_PROVIDER_MODE === "real");
    requireEnv("OPENCLAW_TOKEN", env.OPENCLAW_PROVIDER_MODE === "real");

    if (env.OPENCLAW_ENDPOINT) {
      try {
        const endpointHost = new URL(env.OPENCLAW_ENDPOINT).hostname;
        if (isLocalOrPrivateHost(endpointHost)) {
          warnings.push(
            `OPENCLAW_ENDPOINT host (${endpointHost}) appears local/private; GitHub runners and Vercel may not reach it`
          );
        }
      } catch {
        warnings.push("OPENCLAW_ENDPOINT is not a valid URL");
      }
    }

    if (env.NEXTAUTH_URL && !env.NEXTAUTH_URL.startsWith("https://")) {
      warnings.push("NEXTAUTH_URL should use https:// in staging/production");
    }
  }

  if (target === "production") {
    if (!env.SENTRY_DSN) {
      warnings.push("SENTRY_DSN is empty; production observability coverage is reduced");
    }

    if (env.OPENCLAW_FALLBACK_TO_MOCK === "true") {
      warnings.push("OPENCLAW_FALLBACK_TO_MOCK=true in production may hide provider incidents");
    }
  }

  return {
    ok: missing.length === 0,
    missing,
    warnings,
    target
  };
}
