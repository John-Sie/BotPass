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

const isLocalOrPrivateHost = (hostname) => {
  if (!hostname) {
    return false;
  }

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

  if (exists("OPENCLAW_ENDPOINT")) {
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
