import {
  AppError,
  RATE_LIMIT_RULES,
  checkRateLimit,
  evaluateModeration,
  isAgentThrottled,
  type AgentActionType
} from "@botpass/core";
import { prisma } from "@/lib/db";
import { getRateLimitStore } from "@/lib/rate-limit-store";

async function persistRateLimitCounter(input: {
  bucketKey: string;
  windowStart: Date;
  count: number;
}) {
  await prisma.rateLimitCounter.upsert({
    where: {
      bucketKey_windowStart: {
        bucketKey: input.bucketKey,
        windowStart: input.windowStart
      }
    },
    update: {
      count: input.count
    },
    create: {
      bucketKey: input.bucketKey,
      windowStart: input.windowStart,
      count: input.count
    }
  });
}

export async function enforceRateAndModeration(input: {
  agentId: string;
  eventId: string;
  action: AgentActionType;
}) {
  if (isAgentThrottled(input.agentId)) {
    throw new AppError(429, "agent_throttled", "Agent is temporarily throttled");
  }

  const rule = RATE_LIMIT_RULES[input.action];

  const bucketKey = `${input.agentId}:${input.action}`;
  const result = await checkRateLimit({
    store: getRateLimitStore(),
    key: bucketKey,
    limit: rule.limit,
    windowSec: rule.windowSec
  });
  const windowStart = new Date(result.resetAt.getTime() - rule.windowSec * 1000);

  await persistRateLimitCounter({
    bucketKey,
    windowStart,
    count: result.count
  });

  if (result.allowed) {
    return;
  }

  const decision = evaluateModeration(input.agentId, true);

  if (decision.decision === "warn") {
    await prisma.moderationAction.create({
      data: {
        eventId: input.eventId,
        agentId: input.agentId,
        action: "warn",
        reason: `Rate limit exceeded for ${input.action}`,
        metaJson: { reset_at: result.resetAt.toISOString() }
      }
    });

    throw new AppError(429, "rate_limit_warn", "Rate limit exceeded. Warning issued.", {
      reset_at: result.resetAt.toISOString()
    });
  }

  if (decision.decision === "throttle") {
    await prisma.moderationAction.create({
      data: {
        eventId: input.eventId,
        agentId: input.agentId,
        action: "throttle",
        reason: `Repeated rate limit exceeded for ${input.action}`,
        metaJson: { throttled_until: decision.throttledUntil?.toISOString() }
      }
    });

    throw new AppError(429, "rate_limit_throttle", "Rate limit exceeded. Agent throttled.", {
      throttled_until: decision.throttledUntil?.toISOString()
    });
  }

  await prisma.moderationAction.create({
    data: {
      eventId: input.eventId,
      agentId: input.agentId,
      action: "suspend_request",
      reason: `Escalated rate limit abuse for ${input.action}`,
      metaJson: { escalated: true }
    }
  });

  throw new AppError(429, "suspend_requested", "Suspension requested for abusive behavior");
}
