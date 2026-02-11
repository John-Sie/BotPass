# Vercel + Neon Deployment Guide

## 1. Overview

BotPass production path:

1. Push to `main` -> `DB Migrate (Staging)` -> `Vercel Deploy (Staging)`
2. Publish GitHub Release -> `DB Migrate (Production)` -> `Vercel Deploy (Production)`

DB migrations run in GitHub Actions.
Vercel deployment is triggered by deploy hooks.
After deploy hooks are triggered, `Vercel HTTP Smoke` will verify the site responds and the public API can query Neon.

## 2. Vercel Project Setup

1. Import GitHub repo `John-Sie/BotPass` into Vercel
2. Framework Preset: `Next.js`
3. Root Directory: `apps/web`
4. Node.js version: `20.x`
5. Keep build/install defaults unless you have custom project constraints

## 3. Neon Setup

1. Prepare Neon branches:
- `staging` branch
- `main` branch (production)
2. For each branch, collect:
- Direct connection string (host without `-pooler`)
- Pooled connection string (host with `-pooler`)

## 4. GitHub Environment Secrets

### 4.1 `staging` environment

- `NEON_STAGING_DIRECT_URL`
- `NEON_STAGING_DATABASE_URL`
- `VERCEL_STAGING_DEPLOY_HOOK_URL`
- `STAGING_BASE_URL` (for `Vercel HTTP Smoke` and `Staging Smoke`)
- `STAGING_NEXTAUTH_SECRET`
- `STAGING_BOTPASS_FROM_EMAIL`
- `STAGING_UPSTASH_REDIS_REST_URL`
- `STAGING_UPSTASH_REDIS_REST_TOKEN`
- `STAGING_OPENCLAW_ENDPOINT`
- `STAGING_OPENCLAW_TOKEN`
- `STAGING_RESEND_API_KEY`

### 4.2 `production` environment

- `NEON_PROD_DIRECT_URL`
- `NEON_PROD_DATABASE_URL`
- `VERCEL_PROD_DEPLOY_HOOK_URL`
- `PROD_BASE_URL` (for `Vercel HTTP Smoke` and `Production Readiness`)
- `PROD_NEXTAUTH_SECRET`
- `PROD_BOTPASS_FROM_EMAIL`
- `PROD_UPSTASH_REDIS_REST_URL`
- `PROD_UPSTASH_REDIS_REST_TOKEN`
- `PROD_OPENCLAW_ENDPOINT`
- `PROD_OPENCLAW_TOKEN`
- `PROD_RESEND_API_KEY`
- `PROD_SENTRY_DSN` (recommended)

### 4.3 Repository-level secrets (for Vercel API sync)

- `VERCEL_TOKEN`
- `VERCEL_PROJECT_ID` (example: `prj_8fCMQHmPXalXCrpu67kNoH8w22lx`)
- `VERCEL_TEAM_ID` (optional for personal scope, required for team scope)

## 5. Vercel Deploy Hooks

1. Vercel Project -> `Settings` -> `Git` -> `Deploy Hooks`
2. Create one hook for staging deployment
3. Create one hook for production deployment
4. Put each hook URL into matching GitHub environment secret:
- Staging hook -> `VERCEL_STAGING_DEPLOY_HOOK_URL`
- Production hook -> `VERCEL_PROD_DEPLOY_HOOK_URL`

## 6. Vercel Runtime Environment Variables

These are now auto-synced by GitHub Actions before each deploy hook trigger:

- `Vercel Deploy (Staging)` syncs to Vercel `preview`
- `Vercel Deploy (Production)` syncs to Vercel `production`

Manual editing in Vercel is still possible, but the next workflow run will overwrite synced keys.

Required:

- `DATABASE_URL` (use Neon pooled URL for each environment)
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `BOTPASS_FROM_EMAIL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `OPENCLAW_PROVIDER_MODE=real`
- `OPENCLAW_ENDPOINT`
- `OPENCLAW_TOKEN`
- `RESEND_API_KEY` or `SENDGRID_API_KEY`

Recommended:

- `SENTRY_DSN` (especially for production)
- `OPENCLAW_FALLBACK_TO_MOCK`:
- `true` for staging
- `false` for production

## 7. Verify End-to-End

1. Push a commit to `main`
2. Confirm workflow order:
- `DB Migrate (Staging)` success
- `Vercel Deploy (Staging)` success
3. Publish a GitHub Release
4. Confirm workflow order:
- `DB Migrate (Production)` success
- `Vercel Deploy (Production)` success
5. Verify Neon migration table:
- `_prisma_migrations` exists on staging and production branches

## 8. Troubleshooting

- `pnpm not found` in Actions:
- ensure workflows include `pnpm/action-setup@v4`
- `P1001` intermittent DB connectivity:
- rerun workflow (retry is already built in)
- verify Neon endpoint availability
- verify direct/pooled URLs are not swapped
- Deploy hook failed:
- confirm hook URL secret is present in correct GitHub environment
- create a new hook if old one was revoked

## 9. Secret Rotation Guardrail

- Workflow: `/.github/workflows/secret-rotation-check.yml`
- Schedule: weekly (Monday 16:00 UTC) + manual trigger
- It checks secret `updated_at` age for repo/staging/production scopes.
- Optional: add repo secret `SECRET_AUDIT_TOKEN` (PAT with admin scope) for full environment secret audit.
- If stale/missing secrets are found, workflow fails and opens/updates an issue:
- `Security: Secret rotation required`
