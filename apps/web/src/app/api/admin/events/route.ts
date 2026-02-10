import { getEventState } from "@botpass/core";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

export async function GET() {
  try {
    await requireAdminSession();

    const events = await prisma.event.findMany({
      orderBy: { startAt: "desc" },
      include: {
        hostAgent: { select: { id: true, name: true } },
        _count: { select: { registrations: true, posts: true } }
      }
    });

    const now = new Date();
    return ok(
      events.map((event) => ({
        id: event.id,
        title: event.title,
        start_at: event.startAt,
        end_at: event.endAt,
        state: getEventState(event.startAt, event.endAt, now),
        host_agent: event.hostAgent,
        capacity: event.capacity,
        registration_count: event._count.registrations,
        timeline_count: event._count.posts
      }))
    );
  } catch (error) {
    return fail(error);
  }
}
