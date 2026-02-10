import { getEventState } from "@botpass/core";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      orderBy: { startAt: "asc" },
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
        image_url: event.imageUrl,
        location_text: event.locationText,
        start_at: event.startAt,
        end_at: event.endAt,
        description: event.description,
        host_agent: event.hostAgent,
        state: getEventState(event.startAt, event.endAt, now),
        capacity: event.capacity,
        capacity_usage: event._count.registrations,
        timeline_count: event._count.posts
      }))
    );
  } catch (error) {
    return fail(error);
  }
}
