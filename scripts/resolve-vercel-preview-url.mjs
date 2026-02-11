#!/usr/bin/env node

const required = ["VERCEL_TOKEN", "VERCEL_PROJECT_ID"];
const missing = required.filter((name) => !process.env[name] || process.env[name].trim() === "");

if (missing.length > 0) {
  console.error("[vercel-preview] missing required env:");
  for (const name of missing) {
    console.error(`- ${name}`);
  }
  process.exit(1);
}

const token = process.env.VERCEL_TOKEN.trim();
const projectId = process.env.VERCEL_PROJECT_ID.trim();
const teamId = process.env.VERCEL_TEAM_ID?.trim();
const commitSha = process.env.VERCEL_GIT_COMMIT_SHA?.trim();
const timeoutMs = Number(process.env.VERCEL_RESOLVE_TIMEOUT_MS ?? 120000);
const pollMs = Number(process.env.VERCEL_RESOLVE_POLL_MS ?? 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildApiUrl() {
  const query = new URLSearchParams({
    projectId,
    target: "preview",
    state: "READY",
    limit: "20"
  });
  if (teamId) {
    query.set("teamId", teamId);
  }
  return `https://api.vercel.com/v6/deployments?${query.toString()}`;
}

function toHttpsUrl(url) {
  if (!url) {
    return undefined;
  }
  const normalized = String(url).trim();
  if (!normalized) {
    return undefined;
  }
  return normalized.startsWith("http://") || normalized.startsWith("https://")
    ? normalized.replace(/\/+$/, "")
    : `https://${normalized.replace(/\/+$/, "")}`;
}

function pickDeployment(deployments) {
  if (!Array.isArray(deployments) || deployments.length === 0) {
    return undefined;
  }

  if (commitSha) {
    const byCommit = deployments.find((deployment) => {
      const meta = deployment?.meta ?? {};
      return (
        meta.githubCommitSha === commitSha ||
        meta.gitCommitSha === commitSha ||
        deployment?.meta?.githubCommitRef === commitSha
      );
    });
    if (byCommit) {
      return byCommit;
    }
  }

  return deployments[0];
}

async function resolvePreviewUrl() {
  const deadline = Date.now() + timeoutMs;
  const endpoint = buildApiUrl();

  while (Date.now() < deadline) {
    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`[vercel-preview] API ${response.status}: ${body}`);
    }

    const payload = await response.json();
    const deployment = pickDeployment(payload?.deployments);
    const url = toHttpsUrl(deployment?.alias?.[0] ?? deployment?.url);
    if (url) {
      return url;
    }

    await sleep(pollMs);
  }

  throw new Error("[vercel-preview] no READY preview deployment URL found before timeout");
}

resolvePreviewUrl()
  .then((url) => {
    console.log(url);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
