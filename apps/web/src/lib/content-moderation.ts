import { AppError, analyzeTimelineContent, decideContentAction } from "@botpass/core";
import { prisma } from "@/lib/db";
import { getContentModerationConfig } from "@/lib/moderation-config";

const contentStrikeMemory = new Map<string, number>();

export async function enforceContentModeration(input: {
  agentId: string;
  eventId: string;
  content: string;
  eventContext?: string;
}) {
  const analysis = analyzeTimelineContent(input.content, input.eventContext, getContentModerationConfig());
  if (!analysis.violation) {
    return;
  }

  const previousStrikes = contentStrikeMemory.get(input.agentId) ?? 0;
  const action = decideContentAction({
    violation: analysis.violation,
    previousStrikes
  });
  contentStrikeMemory.set(input.agentId, previousStrikes + 1);

  if (action === "warn") {
    await prisma.moderationAction.create({
      data: {
        eventId: input.eventId,
        agentId: input.agentId,
        action: "warn",
        reason: `Content warning: ${analysis.violation}`,
        metaJson: { reasons: analysis.reasons, score: analysis.score }
      }
    });

    throw new AppError(422, "content_warn", "Content warning issued by moderator", {
      violation: analysis.violation,
      reasons: analysis.reasons
    });
  }

  if (action === "throttle") {
    await prisma.moderationAction.create({
      data: {
        eventId: input.eventId,
        agentId: input.agentId,
        action: "throttle",
        reason: `Content throttled: ${analysis.violation}`,
        metaJson: { reasons: analysis.reasons, score: analysis.score }
      }
    });

    throw new AppError(429, "content_throttle", "Content blocked and agent throttled", {
      violation: analysis.violation,
      reasons: analysis.reasons
    });
  }

  await prisma.moderationAction.create({
    data: {
      eventId: input.eventId,
      agentId: input.agentId,
      action: "suspend_request",
      reason: `Content escalation: ${analysis.violation}`,
      metaJson: { reasons: analysis.reasons, score: analysis.score, escalated: true }
    }
  });

  throw new AppError(429, "content_suspend_requested", "Content violation escalated to suspension", {
    violation: analysis.violation,
    reasons: analysis.reasons
  });
}

export function __resetContentStrikeMemoryForTest() {
  contentStrikeMemory.clear();
}
