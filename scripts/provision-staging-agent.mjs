#!/usr/bin/env node

import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

function sha256(input) {
  return createHash("sha256").update(input).digest("hex");
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`[staging-agent] missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

async function main() {
  requireEnv("DATABASE_URL");

  const prisma = new PrismaClient();
  const rawKey = randomBytes(32).toString("hex");
  const apiKeyHash = sha256(rawKey);

  const ownerName = process.env.STAGING_OWNER_NAME ?? "Staging Owner";
  const ownerEmail = process.env.STAGING_OWNER_EMAIL ?? "owner@example.com";
  const ownerSocialUrl = process.env.STAGING_OWNER_SOCIAL_URL ?? "https://example.com";
  const agentName = process.env.STAGING_AGENT_NAME ?? "OpenClaw Staging Verifier";
  const requestedAgentId = process.env.STAGING_AGENT_ID;

  try {
    let agent;

    if (requestedAgentId) {
      const existing = await prisma.agent.findUnique({ where: { id: requestedAgentId } });
      if (existing) {
        agent = await prisma.agent.update({
          where: { id: requestedAgentId },
          data: {
            name: agentName,
            apiKeyHash,
            ownerName,
            ownerEmail,
            ownerSocialUrl,
            status: "active"
          }
        });
        console.log("[staging-agent] updated existing agent");
      } else {
        agent = await prisma.agent.create({
          data: {
            id: requestedAgentId,
            name: agentName,
            apiKeyHash,
            ownerName,
            ownerEmail,
            ownerSocialUrl,
            status: "active"
          }
        });
        console.log("[staging-agent] created new agent with provided id");
      }
    } else {
      agent = await prisma.agent.create({
        data: {
          name: agentName,
          apiKeyHash,
          ownerName,
          ownerEmail,
          ownerSocialUrl,
          status: "active"
        }
      });
      console.log("[staging-agent] created new agent");
    }

    console.log("");
    console.log("# Copy these for staging verification");
    console.log(`STAGING_AGENT_ID='${agent.id}'`);
    console.log(`STAGING_AGENT_API_KEY='${rawKey}'`);
    console.log("");
    console.log("# Optional one-liner to run full flow");
    console.log(
      "STAGING_BASE_URL='https://your-staging-host' STAGING_AGENT_ID='" +
        agent.id +
        "' STAGING_AGENT_API_KEY='" +
        rawKey +
        "' pnpm verify:staging:flow"
    );
    console.log("");
    console.log("[staging-agent] note: raw key only appears once, store it securely");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[staging-agent] failed", error);
  process.exit(1);
});
