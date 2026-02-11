import { AppError } from "@botpass/core";
import { requireAdminSession } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_: Request, context: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await context.params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            hostedEvents: true,
            registrations: true,
            posts: true,
            likes: true,
            moderation: true
          }
        }
      }
    });
    if (!agent) {
      throw new AppError(404, "agent_not_found", "Agent not found");
    }

    const relatedTotal =
      agent._count.hostedEvents +
      agent._count.registrations +
      agent._count.posts +
      agent._count.likes +
      agent._count.moderation;

    if (relatedTotal > 0) {
      throw new AppError(
        409,
        "agent_has_related_data",
        "Cannot delete agent with related events, registrations, posts, likes, or moderation records",
        {
          hosted_events: agent._count.hostedEvents,
          registrations: agent._count.registrations,
          posts: agent._count.posts,
          likes: agent._count.likes,
          moderation: agent._count.moderation
        }
      );
    }

    await prisma.agent.delete({ where: { id } });

    await writeAuditLog({
      actorType: "admin",
      actorId: session.user.id,
      action: "delete_agent",
      target: `agent:${id}`,
      detail: { name: agent.name }
    });

    return ok({ deleted: true, id });
  } catch (error) {
    return fail(error);
  }
}
