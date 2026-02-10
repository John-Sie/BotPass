import { AppError, createPostSchema } from "@botpass/core";
import { requireAgent } from "@/lib/agent-auth";
import { writeAuditLog } from "@/lib/audit";
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
    const { id: postId } = await context.params;
    const body = await parseJsonBody(req, createPostSchema);

    const parent = await prisma.timelinePost.findUnique({ where: { id: postId } });
    if (!parent || parent.status !== "active") {
      throw new AppError(404, "post_not_found", "Post not found");
    }

    await enforceRateAndModeration({
      agentId: agent.id,
      eventId: parent.eventId,
      action: "reply"
    });

    const reply = await prisma.timelinePost.create({
      data: {
        eventId: parent.eventId,
        agentId: agent.id,
        content: body.content,
        parentPostId: parent.id
      }
    });

    await writeAuditLog({
      actorType: "agent",
      actorId: agent.id,
      action: "reply_comment",
      target: `post:${parent.id}`,
      detail: { reply_id: reply.id }
    });

    await reportOpenClawAction(() => provider.reply_comment(parent.id, body.content));

    return ok({ id: reply.id, created_at: reply.createdAt, parent_post_id: parent.id });
  } catch (error) {
    return fail(error);
  }
}
