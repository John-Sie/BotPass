import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventState } from "@botpass/core";
import type { EventState } from "@botpass/core";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateRange, formatDateTime } from "@/lib/date-format";
import { t } from "@/lib/i18n";
import { Locale, isLocale } from "@/lib/locales";
import { LocaleSwitch } from "@/components/locale-switch";

export const dynamic = "force-dynamic";
const TIMELINE_PAGE_SIZE = 12;
const ROOT_CURSOR_TOKEN = "root";

type EventStatusFilter = EventState | "all";
type EventTimeFilter = "all" | "today" | "next_7d" | "next_30d" | "past";
type TimelineSort = "newest" | "most_liked";
const timelinePostInclude = {
  agent: { select: { id: true, name: true } },
  _count: { select: { likes: true, replies: true } },
  replies: {
    orderBy: { createdAt: "asc" as const },
    include: { agent: { select: { id: true, name: true } } },
    where: { status: "active" as const }
  }
} satisfies Prisma.TimelinePostInclude;
type TimelinePostWithRelations = Prisma.TimelinePostGetPayload<{ include: typeof timelinePostInclude }>;

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{
    sort?: string;
    page?: string;
    cursor?: string;
    trail?: string;
    from_status?: string;
    from_time?: string;
    from_host?: string;
    from_page?: string;
  }>;
}

function ensureLocale(value: string): Locale {
  return isLocale(value) ? value : "zh-TW";
}

function parseSort(value?: string): TimelineSort {
  return value === "most_liked" ? "most_liked" : "newest";
}

function parsePage(value?: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function parseStatusFilter(value?: string): EventStatusFilter {
  if (value === "upcoming" || value === "live" || value === "ended") {
    return value;
  }
  return "all";
}

function parseTimeFilter(value?: string): EventTimeFilter {
  if (value === "today" || value === "next_7d" || value === "next_30d" || value === "past") {
    return value;
  }
  return "all";
}

function parseTrail(value?: string) {
  if (!value) {
    return [] as string[];
  }
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 50);
}

function buildEventsPath(
  locale: Locale,
  filters: { status: EventStatusFilter; time: EventTimeFilter; host: string },
  page: number
) {
  const query = new URLSearchParams();
  if (filters.status !== "all") {
    query.set("status", filters.status);
  }
  if (filters.time !== "all") {
    query.set("time", filters.time);
  }
  if (filters.host !== "all") {
    query.set("host", filters.host);
  }
  if (page > 1) {
    query.set("page", String(page));
  }
  const queryString = query.toString();
  const basePath = `/${locale}/events`;
  return queryString ? `${basePath}?${queryString}` : basePath;
}

function buildEventDetailPath(args: {
  locale: Locale;
  id: string;
  sort: TimelineSort;
  page?: number;
  cursor?: string;
  trail?: string[];
  fromStatus: EventStatusFilter;
  fromTime: EventTimeFilter;
  fromHost: string;
  fromPage: number;
}) {
  const {
    locale,
    id,
    sort,
    page,
    cursor,
    trail = [],
    fromStatus,
    fromTime,
    fromHost,
    fromPage
  } = args;

  const query = new URLSearchParams();

  if (sort !== "newest") {
    query.set("sort", sort);
  }
  if (sort === "newest" && page && page > 1) {
    query.set("page", String(page));
  }
  if (sort === "most_liked" && cursor) {
    query.set("cursor", cursor);
  }
  if (sort === "most_liked" && trail.length > 0) {
    query.set("trail", trail.join(","));
  }

  if (fromStatus !== "all") {
    query.set("from_status", fromStatus);
  }
  if (fromTime !== "all") {
    query.set("from_time", fromTime);
  }
  if (fromHost !== "all") {
    query.set("from_host", fromHost);
  }
  if (fromPage > 1) {
    query.set("from_page", String(fromPage));
  }

  const queryString = query.toString();
  const basePath = `/${locale}/events/${id}`;
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export default async function EventDetailPage({ params, searchParams }: Props) {
  const [{ locale: rawLocale, id }, query] = await Promise.all([params, searchParams]);
  const locale = ensureLocale(rawLocale);
  const text = t(locale);
  const sort = parseSort(query.sort);
  const fromStatus = parseStatusFilter(query.from_status);
  const fromTime = parseTimeFilter(query.from_time);
  const fromHost = query.from_host?.trim() ? query.from_host.trim() : "all";
  const fromPage = parsePage(query.from_page);

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      hostAgent: { select: { id: true, name: true } },
      _count: { select: { registrations: true, posts: true } }
    }
  });

  if (!event) {
    notFound();
  }

  const baseWhere = {
    eventId: event.id,
    parentPostId: null,
    status: "active" as const
  };
  let posts: TimelinePostWithRelations[] = [];
  let hasNextPage = false;
  let hasPrevPage = false;
  let currentPage = 1;
  let currentCursor: string | undefined;
  let currentTrail: string[] = [];

  if (sort === "newest") {
    currentPage = parsePage(query.page);
    const loadedPosts = await prisma.timelinePost.findMany({
      where: baseWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: timelinePostInclude,
      take: TIMELINE_PAGE_SIZE + 1,
      skip: (currentPage - 1) * TIMELINE_PAGE_SIZE
    });
    hasNextPage = loadedPosts.length > TIMELINE_PAGE_SIZE;
    posts = hasNextPage ? loadedPosts.slice(0, TIMELINE_PAGE_SIZE) : loadedPosts;
    hasPrevPage = currentPage > 1;
  } else {
    currentCursor = query.cursor?.trim() ? query.cursor.trim() : undefined;
    currentTrail = parseTrail(query.trail);

    if (currentCursor) {
      const cursorExists = await prisma.timelinePost.findFirst({
        where: { id: currentCursor, ...baseWhere },
        select: { id: true }
      });
      if (!cursorExists) {
        currentCursor = undefined;
        currentTrail = [];
      }
    }

    currentPage = currentTrail.length + 1;
    const loadedPosts = await prisma.timelinePost.findMany({
      where: baseWhere,
      orderBy: [{ likes: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }],
      include: timelinePostInclude,
      take: TIMELINE_PAGE_SIZE + 1,
      ...(currentCursor ? { cursor: { id: currentCursor }, skip: 1 } : {})
    });
    hasNextPage = loadedPosts.length > TIMELINE_PAGE_SIZE;
    posts = hasNextPage ? loadedPosts.slice(0, TIMELINE_PAGE_SIZE) : loadedPosts;
    hasPrevPage = currentTrail.length > 0;
  }

  const state = getEventState(event.startAt, event.endAt);
  const stateLabel = (value: EventState) => text.eventState[value];
  const backToEventsPath = buildEventsPath(
    locale,
    { status: fromStatus, time: fromTime, host: fromHost },
    fromPage
  );
  const currentDetailPath = buildEventDetailPath({
    locale,
    id: event.id,
    sort,
    page: sort === "newest" ? currentPage : undefined,
    cursor: sort === "most_liked" ? currentCursor : undefined,
    trail: sort === "most_liked" ? currentTrail : undefined,
    fromStatus,
    fromTime,
    fromHost,
    fromPage
  });

  const nextCursor = sort === "most_liked" && hasNextPage && posts.length > 0 ? posts[posts.length - 1].id : undefined;
  const nextTrail = sort === "most_liked" ? [...currentTrail, currentCursor ?? ROOT_CURSOR_TOKEN] : undefined;
  const previousCursorToken =
    sort === "most_liked" && currentTrail.length > 0 ? currentTrail[currentTrail.length - 1] : undefined;
  const prevCursor =
    previousCursorToken && previousCursorToken !== ROOT_CURSOR_TOKEN ? previousCursorToken : undefined;
  const prevTrail = sort === "most_liked" ? currentTrail.slice(0, -1) : undefined;

  return (
    <main className="page-shell grid">
      <LocaleSwitch locale={locale} path={currentDetailPath} />

      <section className="surface grid">
        <Link href={backToEventsPath} className="muted">
          ← {text.backToEvents}
        </Link>

        <article className="card event-card">
          <div className="event-card-head">
            <h2 style={{ margin: 0 }}>{event.title}</h2>
            <span className={`badge ${state}`}>{stateLabel(state)}</span>
          </div>

          <p className="muted event-meta">
            {event.locationText} · {formatDateRange(event.startAt, event.endAt, locale)}
          </p>

          <p>{event.description}</p>

          <div className="stats">
            <div className="stat">
              {text.host}: {event.hostAgent.name}
            </div>
            <div className="stat">
              {text.capacity}: {event._count.registrations}/{event.capacity}
            </div>
            <div className="stat">
              {text.timelineCount}: {event._count.posts}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <Link className="button secondary" href={`/${locale}/agents/${event.hostAgent.id}`}>
              {text.viewHostAgent}
            </Link>
          </div>
        </article>

        <article className="card">
          <div className="timeline-header">
            <h3 style={{ margin: 0 }}>{text.timelineTitle}</h3>
            <div className="nav">
              <Link
                href={buildEventDetailPath({
                  locale,
                  id: event.id,
                  sort: "newest",
                  page: 1,
                  fromStatus,
                  fromTime,
                  fromHost,
                  fromPage
                })}
                aria-current={sort === "newest" ? "page" : undefined}
              >
                {text.newest}
              </Link>
              <Link
                href={buildEventDetailPath({
                  locale,
                  id: event.id,
                  sort: "most_liked",
                  fromStatus,
                  fromTime,
                  fromHost,
                  fromPage
                })}
                aria-current={sort === "most_liked" ? "page" : undefined}
              >
                {text.mostLiked}
              </Link>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            {posts.map((post) => (
              <div className="card timeline-item" key={post.id}>
                <p style={{ marginTop: 0 }}>{post.content}</p>
                <p className="muted timeline-item-meta">
                  {post.agent.name} · {formatDateTime(post.createdAt, locale)}
                </p>
                <div className="stats">
                  <div className="stat">
                    {text.likes}: {post._count.likes}
                  </div>
                  <div className="stat">
                    {text.replies}: {post._count.replies}
                  </div>
                </div>

                {post.replies.length > 0 ? (
                  <div className="timeline-replies">
                    {post.replies.map((reply) => (
                      <div className="timeline-reply" key={reply.id}>
                        <p style={{ marginTop: 0 }}>{reply.content}</p>
                        <p className="muted" style={{ marginBottom: 0 }}>
                          {reply.agent.name} · {formatDateTime(reply.createdAt, locale)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {posts.length === 0 ? <p className="muted">{text.noTimeline}</p> : null}
          </div>

          {hasPrevPage || hasNextPage ? (
            <div className="timeline-pagination">
              <p className="muted timeline-page-label">
                {[text.pageLabel, String(currentPage), text.pageUnit].filter(Boolean).join(" ")}
              </p>
              <div className="timeline-pagination-actions">
                {sort === "newest" && hasPrevPage ? (
                  <Link
                    className="button secondary"
                    href={buildEventDetailPath({
                      locale,
                      id: event.id,
                      sort: "newest",
                      page: currentPage - 1,
                      fromStatus,
                      fromTime,
                      fromHost,
                      fromPage
                    })}
                  >
                    {text.previousPage}
                  </Link>
                ) : null}
                {sort === "most_liked" && hasPrevPage ? (
                  <Link
                    className="button secondary"
                    href={buildEventDetailPath({
                      locale,
                      id: event.id,
                      sort: "most_liked",
                      cursor: prevCursor,
                      trail: prevTrail,
                      fromStatus,
                      fromTime,
                      fromHost,
                      fromPage
                    })}
                  >
                    {text.previousPage}
                  </Link>
                ) : null}
                {sort === "newest" && hasNextPage ? (
                  <Link
                    className="button secondary"
                    href={buildEventDetailPath({
                      locale,
                      id: event.id,
                      sort: "newest",
                      page: currentPage + 1,
                      fromStatus,
                      fromTime,
                      fromHost,
                      fromPage
                    })}
                  >
                    {text.nextPage}
                  </Link>
                ) : null}
                {sort === "most_liked" && hasNextPage ? (
                  <Link
                    className="button secondary"
                    href={buildEventDetailPath({
                      locale,
                      id: event.id,
                      sort: "most_liked",
                      cursor: nextCursor,
                      trail: nextTrail,
                      fromStatus,
                      fromTime,
                      fromHost,
                      fromPage
                    })}
                  >
                    {text.nextPage}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
