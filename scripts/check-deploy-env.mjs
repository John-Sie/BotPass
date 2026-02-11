#!/usr/bin/env node

const targetArg = process.argv[2];
const target =
  targetArg === "staging" || targetArg === "production" || targetArg === "development" ? targetArg : "development";

const env = process.env;
const missing = [];
const warnings = [];

const exists = (name) => {
  const value = env[name];
  return typeof value === "string" && value.trim().length > 0;
};

const requireEnv = (name, shouldRequire = true) => {
  if (!shouldRequire) {
    return;
  }
  if (!exists(name)) {
    missing.push(name);
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

  if ((env.OPENCLAW_PROVIDER_MODE ?? "mock") !== "real") {
    missing.push("OPENCLAW_PROVIDER_MODE=real");
  }

  requireEnv("OPENCLAW_ENDPOINT", (env.OPENCLAW_PROVIDER_MODE ?? "mock") === "real");
  requireEnv("OPENCLAW_TOKEN", (env.OPENCLAW_PROVIDER_MODE ?? "mock") === "real");

  if (exists("NEXTAUTH_URL") && !env.NEXTAUTH_URL.startsWith("https://")) {
    warnings.push("NEXTAUTH_URL should use https:// in staging/production");
  }
}

if (target === "production") {
  if (!exists("SENTRY_DSN")) {
    warnings.push("SENTRY_DSN is empty; production observability coverage is reduced");
  }

  if ((env.OPENCLAW_FALLBACK_TO_MOCK ?? "false") === "true") {
    warnings.push("OPENCLAW_FALLBACK_TO_MOCK=true in production may hide provider incidents");
  }
}

if (missing.length === 0) {
  console.log(`[env-check] ${target}: OK`);
} else {
  console.error(`[env-check] ${target}: missing required env`);
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  process.exitCode = 1;
}

if (warnings.length > 0) {
  console.log("[env-check] warnings:");
  for (const warning of warnings) {
    console.log(`- ${warning}`);
  }
}
