# GitHub Deploy Checklist

## 1. Environment & Secrets

- `staging` environment 已建立
- `production` environment 已建立
- `staging` 有 `NEON_STAGING_DIRECT_URL`
- `staging` 有 `NEON_STAGING_DATABASE_URL`
- `production` 有 `NEON_PROD_DIRECT_URL`
- `production` 有 `NEON_PROD_DATABASE_URL`
- 所有 secret 都是純 URL（不含 `psql '...'`）
- `*_DIRECT_URL` host 不含 `-pooler`
- `*_DATABASE_URL` host 含 `-pooler`

Staging smoke 需要額外 secrets：

- `STAGING_BASE_URL`
- `STAGING_NEXTAUTH_SECRET`
- `STAGING_BOTPASS_FROM_EMAIL`
- `STAGING_UPSTASH_REDIS_REST_URL`
- `STAGING_UPSTASH_REDIS_REST_TOKEN`
- `STAGING_OPENCLAW_ENDPOINT`
- `STAGING_OPENCLAW_TOKEN`
- `STAGING_RESEND_API_KEY` 或 `STAGING_SENDGRID_API_KEY`
- `STAGING_OWNER_EMAIL`（建議）

Production readiness 需要額外 secrets：

- `PROD_BASE_URL`
- `PROD_NEXTAUTH_SECRET`
- `PROD_BOTPASS_FROM_EMAIL`
- `PROD_UPSTASH_REDIS_REST_URL`
- `PROD_UPSTASH_REDIS_REST_TOKEN`
- `PROD_OPENCLAW_ENDPOINT`
- `PROD_OPENCLAW_TOKEN`
- `PROD_RESEND_API_KEY` 或 `PROD_SENDGRID_API_KEY`
- `PROD_SENTRY_DSN`

## 2. Workflow Trigger

- `/.github/workflows/db-staging.yml` 觸發條件是 `push` 到 `main`
- `/.github/workflows/db-release.yml` 觸發條件是 `release: published`
- `/.github/workflows/staging-smoke.yml` 觸發條件是 `workflow_dispatch`
- `/.github/workflows/production-readiness.yml` 觸發條件是 `workflow_dispatch`
- staging job 綁定 `environment: staging`
- production job 綁定 `environment: production`
- workflow 含 migration retry 機制

## 3. Preflight Commands

```bash
pnpm install
pnpm db:validate
pnpm test
pnpm typecheck
pnpm build
pnpm env:check:staging
pnpm env:check:prod
```

## 4. Post-deploy Verify

- staging workflow 成功執行
- release workflow 成功執行
- `prisma migrate status` 顯示 `Database schema is up to date!`
- Neon `staging` / `main` 均可查到 `_prisma_migrations`

## 5. Recommended Run Order

1. 執行 `Staging Smoke`（手動）
2. 觸發 `DB Migrate (Staging)`（push 到 `main`）
3. 執行 `Production Readiness`（手動）
4. 發佈 release 觸發 `DB Migrate (Production)`
