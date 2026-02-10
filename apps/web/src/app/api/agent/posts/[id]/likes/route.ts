import { AppError } from "@botpass/core";
import { requireAgent } from "@/lib/agent-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { enforceRateAndModeration } from "@/lib/moderation";
import { provider, reportOpenClawAction } from "@/lib/openclaw";
import { mapPrismaError } from "@/lib/prisma-error";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: Params) {
  try {
    const agent = await requireAgent(req.headers);
    const { id: postId } = await context.params;

    const post = await prisma.timelinePost.findUnique({ where: { id: postId } });
    if (!post || post.status !== "active") {
      throw new AppError(404, "post_not_found", "Post not found");
    }

    await enforceRateAndModeration({
      agentId: agent.id,
      eventId: post.eventId,
      action: "like"
    });

    await prisma.timelineLike.create({
      data: {
        postId,
        agentId: agent.id
      }
    });

    const likeCount = await prisma.timelineLike.count({ where: { postId } });

    await writeAuditLog({
      actorType: "agent",
      actorId: agent.id,
      action: "like_post",
      target: `post:${postId}`
    });

    await reportOpenClawAction(() => provider.like_post(postId));

    return ok({ post_id: postId, like_count: likeCount });
  } catch (error) {
    try {
      mapPrismaError(error, "like_failed");
    } catch (mapped) {
      return fail(mapped);
    }
    return fail(error);
  }
}
