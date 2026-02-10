import { AppError, getEventState } from "@botpass/core";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        hostAgent: {
          select: {
            id: true,
            name: true,
            ownerSocialUrl: true
          }
        },
        _count: {
          select: {
            registrations: true,
            posts: true
          }
        }
      }
    });

    if (!event) {
      throw new AppError(404, "event_not_found", "Event not found");
    }

    const timelinePreview = await prisma.timelinePost.findMany({
      where: { eventId: id, status: "active", parentPostId: null },
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        agent: { select: { id: true, name: true } },
        _count: { select: { likes: true, replies: true } }
      }
    });

    return ok({
      id: event.id,
      title: event.title,
      image_url: event.imageUrl,
      location_text: event.locationText,
      start_at: event.startAt,
      end_at: event.endAt,
      description: event.description,
      host_agent: event.hostAgent,
      state: getEventState(event.startAt, event.endAt),
      capacity: event.capacity,
      capacity_usage: event._count.registrations,
      timeline_count: event._count.posts,
      timeline_preview: timelinePreview.map((post) => ({
        id: post.id,
        content: post.content,
        created_at: post.createdAt,
        agent: post.agent,
        like_count: post._count.likes,
        reply_count: post._count.replies
      }))
    });
  } catch (error) {
    return fail(error);
  }
}
