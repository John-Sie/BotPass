#!/usr/bin/env node

const repoFull = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
const defaultMaxDays = Number.parseInt(process.env.ROTATION_DEFAULT_MAX_DAYS ?? "90", 10);

if (!repoFull || !token) {
  console.error("[secret-rotation] missing GITHUB_REPOSITORY or GITHUB_TOKEN");
  process.exit(1);
}

if (!Number.isFinite(defaultMaxDays) || defaultMaxDays <= 0) {
  console.error("[secret-rotation] ROTATION_DEFAULT_MAX_DAYS must be a positive integer");
  process.exit(1);
}

const [owner, repo] = repoFull.split("/");
if (!owner || !repo) {
  console.error(`[secret-rotation] invalid GITHUB_REPOSITORY: ${repoFull}`);
  process.exit(1);
}

const policy = {
  repo: [
    { name: "VERCEL_TOKEN", maxDays: 30 },
    { name: "VERCEL_PROJECT_ID", maxDays: defaultMaxDays },
    { name: "VERCEL_TEAM_ID", maxDays: defaultMaxDays },
  ],
  staging: [
    { name: "NEON_STAGING_DIRECT_URL", maxDays: 90 },
    { name: "NEON_STAGING_DATABASE_URL", maxDays: 90 },
    { name: "STAGING_NEXTAUTH_SECRET", maxDays: 90 },
    { name: "STAGING_OPENCLAW_TOKEN", maxDays: 90 },
    { name: "STAGING_RESEND_API_KEY", maxDays: 90 },
    { name: "STAGING_UPSTASH_REDIS_REST_TOKEN", maxDays: 90 },
    { name: "VERCEL_STAGING_DEPLOY_HOOK_URL", maxDays: 180 },
  ],
  production: [
    { name: "NEON_PROD_DIRECT_URL", maxDays: 90 },
    { name: "NEON_PROD_DATABASE_URL", maxDays: 90 },
    { name: "PROD_NEXTAUTH_SECRET", maxDays: 90 },
    { name: "PROD_OPENCLAW_TOKEN", maxDays: 90 },
    { name: "PROD_RESEND_API_KEY", maxDays: 90 },
    { name: "PROD_UPSTASH_REDIS_REST_TOKEN", maxDays: 90 },
    { name: "VERCEL_PROD_DEPLOY_HOOK_URL", maxDays: 180 },
  ],
};

const headers = {
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
};

const fetchJson = async (url) => {
  const response = await fetch(url, { headers });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${url} -> ${response.status}: ${body}`);
  }
  return response.json();
};

const listRepoSecrets = async () => {
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/secrets?per_page=100`;
  const payload = await fetchJson(url);
  return payload.secrets ?? [];
};

const listEnvSecrets = async (envName) => {
  const url = `https://api.github.com/repos/${owner}/${repo}/environments/${encodeURIComponent(envName)}/secrets?per_page=100`;
  const payload = await fetchJson(url);
  return payload.secrets ?? [];
};

const toAgeDays = (updatedAt) => {
  const ts = new Date(updatedAt).getTime();
  if (!Number.isFinite(ts)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000));
};

const evaluate = (scopeName, secrets, rules) => {
  const byName = new Map(secrets.map((item) => [item.name, item]));
  const rows = [];
  let staleCount = 0;
  let missingCount = 0;

  for (const rule of rules) {
    const found = byName.get(rule.name);
    if (!found) {
      rows.push({
        scope: scopeName,
        name: rule.name,
        maxDays: rule.maxDays,
        ageDays: null,
        updatedAt: null,
        status: "missing",
      });
      missingCount += 1;
      continue;
    }

    const ageDays = toAgeDays(found.updated_at);
    const stale = ageDays > rule.maxDays;
    if (stale) {
      staleCount += 1;
    }
    rows.push({
      scope: scopeName,
      name: rule.name,
      maxDays: rule.maxDays,
      ageDays,
      updatedAt: found.updated_at,
      status: stale ? "stale" : "ok",
    });
  }

  return { rows, staleCount, missingCount };
};

const writeGithubOutput = async (key, value) => {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    return;
  }
  const fs = await import("node:fs/promises");
  await fs.appendFile(outputFile, `${key}=${value}\n`);
};

const run = async () => {
  const [repoSecrets, stagingSecrets, productionSecrets] = await Promise.all([
    listRepoSecrets(),
    listEnvSecrets("staging"),
    listEnvSecrets("production"),
  ]);

  const repoResult = evaluate("repo", repoSecrets, policy.repo);
  const stagingResult = evaluate("staging", stagingSecrets, policy.staging);
  const productionResult = evaluate("production", productionSecrets, policy.production);

  const allRows = [...repoResult.rows, ...stagingResult.rows, ...productionResult.rows];
  const staleCount = repoResult.staleCount + stagingResult.staleCount + productionResult.staleCount;
  const missingCount = repoResult.missingCount + stagingResult.missingCount + productionResult.missingCount;

  const lines = [];
  lines.push("# Secret Rotation Report");
  lines.push("");
  lines.push(`- Generated at (UTC): ${new Date().toISOString()}`);
  lines.push(`- Policy default max days: ${defaultMaxDays}`);
  lines.push(`- Stale secrets: ${staleCount}`);
  lines.push(`- Missing secrets: ${missingCount}`);
  lines.push("");
  lines.push("| Scope | Secret | Max Days | Age Days | Updated At | Status |");
  lines.push("| --- | --- | ---: | ---: | --- | --- |");
  for (const row of allRows) {
    lines.push(
      `| ${row.scope} | ${row.name} | ${row.maxDays} | ${row.ageDays ?? "-"} | ${
        row.updatedAt ?? "-"
      } | ${row.status} |`
    );
  }
  lines.push("");

  if (staleCount === 0 && missingCount === 0) {
    lines.push("All tracked secrets are within rotation policy.");
  } else {
    lines.push("Rotation action required for stale/missing secrets.");
  }

  const report = lines.join("\n");
  await import("node:fs/promises").then((fs) => fs.writeFile("secret-rotation-report.md", report + "\n", "utf8"));

  console.log(`[secret-rotation] stale=${staleCount} missing=${missingCount}`);
  console.log(report);

  await writeGithubOutput("stale_count", String(staleCount));
  await writeGithubOutput("missing_count", String(missingCount));
  await writeGithubOutput("report_path", "secret-rotation-report.md");

  if (staleCount > 0 || missingCount > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error("[secret-rotation] failed");
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
