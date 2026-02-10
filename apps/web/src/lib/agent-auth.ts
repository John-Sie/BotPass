import { AppError } from "@botpass/core";
import { prisma } from "@/lib/db";
import { hashApiKey } from "@/lib/hash";

export async function requireAgent(headers: Headers) {
  const agentId = headers.get("x-agent-id");
  const apiKey = headers.get("x-api-key");

  if (!agentId || !apiKey) {
    throw new AppError(401, "agent_unauthorized", "Missing x-agent-id or x-api-key header");
  }

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent) {
    throw new AppError(401, "agent_not_found", "Agent not found");
  }

  if (agent.status !== "active") {
    throw new AppError(403, "agent_blocked", `Agent status is ${agent.status}`);
  }

  const hashed = hashApiKey(apiKey);
  if (hashed !== agent.apiKeyHash) {
    throw new AppError(401, "invalid_api_key", "Invalid API key");
  }

  return agent;
}
