#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";

const required = ["DATABASE_URL", "STAGING_BASE_URL"];
const missing = required.filter((name) => !process.env[name] || process.env[name].trim() === "");

if (missing.length > 0) {
  console.error("[staging-smoke] missing required env:");
  for (const key of missing) {
    console.error(`- ${key}`);
  }
  process.exit(1);
}

function run(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: process.env,
    ...options
  });

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (chunk) => {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(text);
  });

  child.stderr.on("data", (chunk) => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(text);
  });

  return once(child, "close").then(([code]) => ({
    code: Number(code ?? 1),
    stdout,
    stderr
  }));
}

function extractEnv(output, key) {
  const pattern = new RegExp(`${key}='([^']+)'`);
  const match = output.match(pattern);
  return match?.[1];
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function assertAgentVisible(baseUrl, agentId) {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/public/agents/${agentId}`;
  const response = await fetch(url, { method: "GET" });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    const code = typeof body?.error?.code === "string" ? body.error.code : response.statusText;
    if (code === "agent_not_found") {
      throw new Error(
        [
          `GET /api/public/agents/${agentId} failed: 404 agent_not_found`,
          "Provisioned agent was written to DATABASE_URL, but STAGING_BASE_URL runtime cannot find it.",
          "Check that Vercel preview DATABASE_URL points to the same Neon staging branch used by this workflow."
        ].join(" ")
      );
    }
    throw new Error(`GET /api/public/agents/${agentId} failed: ${response.status} ${code}`);
  }
}

async function main() {
  console.log("[staging-smoke] Step 1/3 env check");
  const envCheck = await run("node", ["scripts/check-deploy-env.mjs", "staging"]);
  if (envCheck.code !== 0) {
    process.exit(envCheck.code);
  }

  console.log("[staging-smoke] Step 2/3 provision staging agent");
  const provisionAttempts = 3;
  let provision;
  for (let attempt = 1; attempt <= provisionAttempts; attempt += 1) {
    provision = await run("node", ["scripts/provision-staging-agent.mjs"], {
      env: {
        ...process.env,
        DATABASE_URL: process.env.DIRECT_URL ?? process.env.DATABASE_URL
      }
    });
    if (provision.code === 0) {
      break;
    }
    if (attempt < provisionAttempts) {
      console.warn(`[staging-smoke] provision failed, retrying (${attempt}/${provisionAttempts}) in 3s`);
      await wait(3000);
    }
  }
  if (!provision || provision.code !== 0) {
    process.exit(provision?.code ?? 1);
  }

  const agentId = extractEnv(provision.stdout, "STAGING_AGENT_ID");
  const agentKey = extractEnv(provision.stdout, "STAGING_AGENT_API_KEY");

  if (!agentId || !agentKey) {
    console.error("[staging-smoke] failed to parse STAGING_AGENT_ID/STAGING_AGENT_API_KEY from provision output");
    process.exit(1);
  }

  console.log("[staging-smoke] Step 3/4 verify provisioned agent is visible from runtime");
  await assertAgentVisible(process.env.STAGING_BASE_URL, agentId);

  console.log("[staging-smoke] Step 4/4 verify full flow");
  const verify = await run("node", ["scripts/verify-staging-flow.mjs"], {
    env: {
      ...process.env,
      STAGING_AGENT_ID: agentId,
      STAGING_AGENT_API_KEY: agentKey
    }
  });
  if (verify.code !== 0) {
    process.exit(verify.code);
  }

  console.log("[staging-smoke] success");
  console.log(`STAGING_AGENT_ID='${agentId}'`);
  console.log(`STAGING_AGENT_API_KEY='${agentKey}'`);
}

main().catch((error) => {
  console.error("[staging-smoke] failed", error);
  process.exit(1);
});
