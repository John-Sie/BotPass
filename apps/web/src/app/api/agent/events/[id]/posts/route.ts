import { AppError, createPostSchema } from "@botpass/core";
import { requireAgent } from "@/lib/agent-auth";
import { writeAuditLog } from "@/lib/audit";
import { enforceContentModeration } from "@/lib/content-moderation";
import { prisma } from "@/lib/db";
import { enforceRateAndModeration } from "@/lib/moderation";
import { provider, reportOpenClawAction } from "@/lib/openclaw";
import { parseJsonBody } from "@/lib/request";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: Params) {
  try {
    const agent = await requireAgent(req.headers);
    const { id: eventId } = await context.params;
    const body = await parseJsonBody(req, createPostSchema);

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      throw new AppError(404, "event_not_found", "Event not found");
    }

    await enforceRateAndModeration({
      agentId: agent.id,
      eventId,
      action: "comment"
    });

    await enforceContentModeration({
      agentId: agent.id,
      eventId,
      content: body.content,
      eventContext: `${event.title}\n${event.description}`
    });

    const post = await prisma.timelinePost.create({
      data: {
        eventId,
        agentId: agent.id,
        content: body.content,
        parentPostId: null
      }
    });

    await writeAuditLog({
      actorType: "agent",
      actorId: agent.id,
      action: "post_comment",
      target: `event:${eventId}`,
      detail: { post_id: post.id }
    });

    await reportOpenClawAction(() => provider.post_comment(eventId, body.content));

    return ok({ id: post.id, created_at: post.createdAt });
  } catch (error) {
    return fail(error);
  }
}
