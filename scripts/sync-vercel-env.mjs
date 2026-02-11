#!/usr/bin/env node

const targetArg = process.argv[2];

const requiredBase = ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"];
const missingBase = requiredBase.filter((name) => !process.env[name] || process.env[name].trim() === "");

if (missingBase.length > 0) {
  console.error("[vercel-sync] missing required env:");
  for (const name of missingBase) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

const targetConfig = {
  staging: {
    vercelTarget: "preview",
    required: {
      DATABASE_URL: process.env.NEON_STAGING_DATABASE_URL,
      NEXTAUTH_SECRET: process.env.STAGING_NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.STAGING_BASE_URL,
      BOTPASS_FROM_EMAIL: process.env.STAGING_BOTPASS_FROM_EMAIL,
      UPSTASH_REDIS_REST_URL: process.env.STAGING_UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.STAGING_UPSTASH_REDIS_REST_TOKEN,
      OPENCLAW_ENDPOINT: process.env.STAGING_OPENCLAW_ENDPOINT,
      OPENCLAW_TOKEN: process.env.STAGING_OPENCLAW_TOKEN,
      RESEND_API_KEY: process.env.STAGING_RESEND_API_KEY,
      OPENCLAW_PROVIDER_MODE: "real",
      OPENCLAW_FALLBACK_TO_MOCK: "true",
    },
    optional: {
      SENTRY_DSN: process.env.STAGING_SENTRY_DSN,
      OTEL_SERVICE_NAME: process.env.STAGING_OTEL_SERVICE_NAME,
      OTEL_DEBUG: process.env.STAGING_OTEL_DEBUG,
      OTEL_CONSOLE_EXPORTER: process.env.STAGING_OTEL_CONSOLE_EXPORTER,
      SENTRY_TRACES_SAMPLE_RATE: process.env.STAGING_SENTRY_TRACES_SAMPLE_RATE,
    },
  },
  production: {
    vercelTarget: "production",
    required: {
      DATABASE_URL: process.env.NEON_PROD_DATABASE_URL,
      NEXTAUTH_SECRET: process.env.PROD_NEXTAUTH_SECRET,
      NEXTAUTH_URL: process.env.PROD_BASE_URL,
      BOTPASS_FROM_EMAIL: process.env.PROD_BOTPASS_FROM_EMAIL,
      UPSTASH_REDIS_REST_URL: process.env.PROD_UPSTASH_REDIS_REST_URL,
      UPSTASH_REDIS_REST_TOKEN: process.env.PROD_UPSTASH_REDIS_REST_TOKEN,
      OPENCLAW_ENDPOINT: process.env.PROD_OPENCLAW_ENDPOINT,
      OPENCLAW_TOKEN: process.env.PROD_OPENCLAW_TOKEN,
      RESEND_API_KEY: process.env.PROD_RESEND_API_KEY,
      OPENCLAW_PROVIDER_MODE: "real",
      OPENCLAW_FALLBACK_TO_MOCK: "false",
    },
    optional: {
      SENTRY_DSN: process.env.PROD_SENTRY_DSN,
      OTEL_SERVICE_NAME: process.env.PROD_OTEL_SERVICE_NAME,
      OTEL_DEBUG: process.env.PROD_OTEL_DEBUG,
      OTEL_CONSOLE_EXPORTER: process.env.PROD_OTEL_CONSOLE_EXPORTER,
      SENTRY_TRACES_SAMPLE_RATE: process.env.PROD_SENTRY_TRACES_SAMPLE_RATE,
    },
  },
};

if (targetArg !== "staging" && targetArg !== "production") {
  console.error('Usage: node scripts/sync-vercel-env.mjs <staging|production>');
  process.exit(1);
}

const config = targetConfig[targetArg];

const missingRequired = Object.entries(config.required)
  .filter(([, value]) => typeof value !== "string" || value.trim() === "")
  .map(([key]) => key);

if (missingRequired.length > 0) {
  console.error(`[vercel-sync] ${targetArg}: missing required source env for Vercel sync`);
  for (const name of missingRequired) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

const vercelToken = process.env.VERCEL_TOKEN;
const vercelProjectId = process.env.VERCEL_PROJECT_ID;
const vercelTeamId = process.env.VERCEL_TEAM_ID ?? "";
const query = vercelTeamId.trim() ? `?teamId=${encodeURIComponent(vercelTeamId)}&upsert=true` : "?upsert=true";
const endpoint = `https://api.vercel.com/v10/projects/${encodeURIComponent(vercelProjectId)}/env${query}`;

const toUpsert = [
  ...Object.entries(config.required),
  ...Object.entries(config.optional).filter(([, value]) => typeof value === "string" && value.trim() !== ""),
];

const upsertEnv = async (key, value) => {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      key,
      value,
      target: [config.vercelTarget],
      type: "encrypted",
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error?.code || `HTTP ${response.status}`;
    throw new Error(`${key}: ${message}`);
  }

  return payload;
};

try {
  console.log(`[vercel-sync] syncing ${toUpsert.length} env vars to ${config.vercelTarget}`);
  for (const [key, value] of toUpsert) {
    await upsertEnv(key, value);
    console.log(`[vercel-sync] upserted ${key}`);
  }
  console.log(`[vercel-sync] ${targetArg}: done`);
} catch (error) {
  console.error(`[vercel-sync] ${targetArg}: failed`);
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
