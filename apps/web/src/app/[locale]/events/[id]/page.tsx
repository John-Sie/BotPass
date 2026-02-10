import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventState } from "@botpass/core";
import type { EventState } from "@botpass/core";
import { prisma } from "@/lib/db";
import { formatDateRange, formatDateTime } from "@/lib/date-format";
import { t } from "@/lib/i18n";
import { Locale, isLocale } from "@/lib/locales";
import { LocaleSwitch } from "@/components/locale-switch";

export const dynamic = "force-dynamic";
const TIMELINE_PAGE_SIZE = 12;

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ sort?: "newest" | "most_liked"; page?: string }>;
}

function ensureLocale(value: string): Locale {
  return isLocale(value) ? value : "zh-TW";
}

function parsePage(value?: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function buildEventDetailPath(locale: Locale, id: string, sort: "newest" | "most_liked", page: number) {
  const query = new URLSearchParams();
  if (sort !== "newest") {
    query.set("sort", sort);
  }
  if (page > 1) {
    query.set("page", String(page));
  }
  const queryString = query.toString();
  return `/${locale}/events/${id}${queryString ? `?${queryString}` : ""}`;
}

export default async function EventDetailPage({ params, searchParams }: Props) {
  const [{ locale: rawLocale, id }, query] = await Promise.all([params, searchParams]);
  const locale = ensureLocale(rawLocale);
  const text = t(locale);
  const sort = query.sort === "most_liked" ? "most_liked" : "newest";
  const page = parsePage(query.page);

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

  const loadedPosts = await prisma.timelinePost.findMany({
    where: {
      eventId: event.id,
      parentPostId: null,
      status: "active"
    },
    orderBy:
      sort === "most_liked"
        ? [{ likes: { _count: "desc" } }, { createdAt: "desc" }]
        : [{ createdAt: "desc" }],
    include: {
      agent: { select: { id: true, name: true } },
      _count: { select: { likes: true, replies: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { agent: { select: { id: true, name: true } } },
        where: { status: "active" }
      }
    },
    take: TIMELINE_PAGE_SIZE + 1,
    skip: (page - 1) * TIMELINE_PAGE_SIZE
  });
  const hasNextPage = loadedPosts.length > TIMELINE_PAGE_SIZE;
  const posts = hasNextPage ? loadedPosts.slice(0, TIMELINE_PAGE_SIZE) : loadedPosts;
  const hasPrevPage = page > 1;

  const state = getEventState(event.startAt, event.endAt);
  const stateLabel = (value: EventState) => text.eventState[value];

  return (
    <main className="page-shell grid">
      <LocaleSwitch locale={locale} path={`/${locale}/events/${event.id}`} />

      <section className="surface grid">
        <Link href={`/${locale}/events`} className="muted">
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
              <Link href={buildEventDetailPath(locale, event.id, "newest", 1)} aria-current={sort === "newest" ? "page" : undefined}>
                {text.newest}
              </Link>
              <Link
                href={buildEventDetailPath(locale, event.id, "most_liked", 1)}
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
                {[text.pageLabel, String(page), text.pageUnit].filter(Boolean).join(" ")}
              </p>
              <div className="timeline-pagination-actions">
                {hasPrevPage ? (
                  <Link className="button secondary" href={buildEventDetailPath(locale, event.id, sort, page - 1)}>
                    {text.previousPage}
                  </Link>
                ) : null}
                {hasNextPage ? (
                  <Link className="button secondary" href={buildEventDetailPath(locale, event.id, sort, page + 1)}>
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
