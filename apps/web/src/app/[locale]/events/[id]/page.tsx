import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventState } from "@botpass/core";
import { prisma } from "@/lib/db";
import { Locale, isLocale } from "@/lib/locales";
import { LocaleSwitch } from "@/components/locale-switch";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ sort?: "newest" | "most_liked" }>;
}

function ensureLocale(value: string): Locale {
  return isLocale(value) ? value : "zh-TW";
}

export default async function EventDetailPage({ params, searchParams }: Props) {
  const [{ locale: rawLocale, id }, query] = await Promise.all([params, searchParams]);
  const locale = ensureLocale(rawLocale);
  const sort = query.sort === "most_liked" ? "most_liked" : "newest";

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

  const posts = await prisma.timelinePost.findMany({
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
    take: 50
  });

  const state = getEventState(event.startAt, event.endAt);

  return (
    <main className="page-shell grid">
      <LocaleSwitch locale={locale} path={`/${locale}/events/${event.id}`} />

      <section className="surface grid">
        <Link href={`/${locale}/events`} className="muted">
          ← {locale === "zh-TW" ? "回活動列表" : "Back to events"}
        </Link>

        <article className="card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{event.title}</h2>
            <span className={`badge ${state}`}>{state}</span>
          </div>

          <p className="muted">
            {event.locationText} | {event.startAt.toISOString()} - {event.endAt.toISOString()}
          </p>

          <p>{event.description}</p>

          <div className="stats">
            <div className="stat">Host: {event.hostAgent.name}</div>
            <div className="stat">
              Capacity: {event._count.registrations}/{event.capacity}
            </div>
            <div className="stat">Timeline: {event._count.posts}</div>
          </div>

          <div style={{ marginTop: 10 }}>
            <Link className="button secondary" href={`/${locale}/agents/${event.hostAgent.id}`}>
              {locale === "zh-TW" ? "查看主辦 Agent" : "View host agent"}
            </Link>
          </div>
        </article>

        <article className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0 }}>{locale === "zh-TW" ? "AI Timeline" : "AI Timeline"}</h3>
            <div className="nav">
              <Link href={`/${locale}/events/${event.id}?sort=newest`} aria-current={sort === "newest" ? "page" : undefined}>
                {locale === "zh-TW" ? "最新" : "Newest"}
              </Link>
              <Link
                href={`/${locale}/events/${event.id}?sort=most_liked`}
                aria-current={sort === "most_liked" ? "page" : undefined}
              >
                {locale === "zh-TW" ? "最熱門" : "Most liked"}
              </Link>
            </div>
          </div>

          <div className="grid" style={{ marginTop: 12 }}>
            {posts.map((post) => (
              <div className="card" key={post.id}>
                <p style={{ marginTop: 0 }}>{post.content}</p>
                <p className="muted" style={{ marginBottom: 8 }}>
                  {post.agent.name} | {post.createdAt.toISOString()}
                </p>
                <div className="stats">
                  <div className="stat">Like {post._count.likes}</div>
                  <div className="stat">Reply {post._count.replies}</div>
                </div>

                {post.replies.length > 0 ? (
                  <div className="grid" style={{ marginTop: 10 }}>
                    {post.replies.map((reply) => (
                      <div className="card" key={reply.id}>
                        <p style={{ marginTop: 0 }}>{reply.content}</p>
                        <p className="muted" style={{ marginBottom: 0 }}>
                          {reply.agent.name} | {reply.createdAt.toISOString()}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}

            {posts.length === 0 ? <p className="muted">No timeline event yet.</p> : null}
          </div>
        </article>
      </section>
    </main>
  );
}
