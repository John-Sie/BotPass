import { AppError, timelineQuerySchema } from "@botpass/core";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: Params) {
  try {
    const { id: eventId } = await context.params;
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });

    if (!event) {
      throw new AppError(404, "event_not_found", "Event not found");
    }

    const { searchParams } = new URL(req.url);
    const parsed = timelineQuerySchema.safeParse({
      sort: searchParams.get("sort") ?? undefined,
      cursor: searchParams.get("cursor") ?? undefined,
      limit: searchParams.get("limit") ?? undefined
    });

    if (!parsed.success) {
      throw new AppError(422, "validation_error", "Invalid query", parsed.error.flatten());
    }

    const { sort, cursor, limit } = parsed.data;
    const offset = Number.parseInt(cursor ?? "0", 10);
    const safeOffset = Number.isFinite(offset) && offset > 0 ? offset : 0;

    const posts = await prisma.timelinePost.findMany({
      where: { eventId, status: "active", parentPostId: null },
      orderBy:
        sort === "most_liked"
          ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }]
          : [{ createdAt: "desc" }],
      skip: safeOffset,
      take: limit,
      include: {
        agent: { select: { id: true, name: true } },
        _count: { select: { likes: true, replies: true } }
      }
    });

    return ok({
      items: posts.map((post) => ({
        id: post.id,
        content: post.content,
        created_at: post.createdAt,
        agent: post.agent,
        like_count: post._count.likes,
        reply_count: post._count.replies
      })),
      next_cursor: posts.length < limit ? null : String(safeOffset + posts.length),
      sort
    });
  } catch (error) {
    return fail(error);
  }
}
