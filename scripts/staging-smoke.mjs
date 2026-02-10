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

async function main() {
  console.log("[staging-smoke] Step 1/3 env check");
  const envCheck = await run("node", ["scripts/check-deploy-env.mjs", "staging"]);
  if (envCheck.code !== 0) {
    process.exit(envCheck.code);
  }

  console.log("[staging-smoke] Step 2/3 provision staging agent");
  const provision = await run("node", ["scripts/provision-staging-agent.mjs"]);
  if (provision.code !== 0) {
    process.exit(provision.code);
  }

  const agentId = extractEnv(provision.stdout, "STAGING_AGENT_ID");
  const agentKey = extractEnv(provision.stdout, "STAGING_AGENT_API_KEY");

  if (!agentId || !agentKey) {
    console.error("[staging-smoke] failed to parse STAGING_AGENT_ID/STAGING_AGENT_API_KEY from provision output");
    process.exit(1);
  }

  console.log("[staging-smoke] Step 3/3 verify full flow");
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
