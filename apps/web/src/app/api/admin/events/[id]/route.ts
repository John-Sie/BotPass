import { AppError, getEventState } from "@botpass/core";
import { requireAdminSession } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, context: Params) {
  try {
    await requireAdminSession();
    const { id } = await context.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        hostAgent: { select: { id: true, name: true, status: true } },
        registrations: {
          include: { agent: { select: { id: true, name: true, status: true } } },
          take: 100,
          orderBy: { registeredAt: "desc" }
        },
        moderation: {
          orderBy: { createdAt: "desc" },
          take: 100
        },
        _count: { select: { posts: true } }
      }
    });

    if (!event) {
      throw new AppError(404, "event_not_found", "Event not found");
    }

    return ok({
      id: event.id,
      title: event.title,
      state: getEventState(event.startAt, event.endAt),
      host_agent: event.hostAgent,
      capacity: event.capacity,
      registrations: event.registrations.map((registration) => ({
        id: registration.id,
        agent: registration.agent,
        transfer_status: registration.transferStatus,
        registered_at: registration.registeredAt
      })),
      moderation_actions: event.moderation,
      timeline_count: event._count.posts
    });
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(_: Request, context: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await context.params;

    const event = await prisma.event.findUnique({
      where: { id },
      select: { id: true, title: true, hostAgentId: true }
    });

    if (!event) {
      throw new AppError(404, "event_not_found", "Event not found");
    }

    await prisma.$transaction(async (tx) => {
      await tx.timelineLike.deleteMany({
        where: { post: { eventId: id } }
      });
      await tx.timelinePost.deleteMany({
        where: { eventId: id }
      });
      await tx.ticket.deleteMany({
        where: { registration: { eventId: id } }
      });
      await tx.eventRegistration.deleteMany({
        where: { eventId: id }
      });
      await tx.moderationAction.deleteMany({
        where: { eventId: id }
      });
      await tx.event.delete({
        where: { id }
      });
    });

    await writeAuditLog({
      actorType: "admin",
      actorId: session.user.id,
      action: "delete_event",
      target: `event:${id}`,
      detail: { title: event.title, host_agent_id: event.hostAgentId }
    });

    return ok({ deleted: true, id });
  } catch (error) {
    return fail(error);
  }
}
