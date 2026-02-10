import Link from "next/link";
import { getEventState } from "@botpass/core";
import { prisma } from "@/lib/db";
import { t } from "@/lib/i18n";
import { Locale, isLocale } from "@/lib/locales";
import { LocaleSwitch } from "@/components/locale-switch";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string }>;
}

function ensureLocale(value: string): Locale {
  return isLocale(value) ? value : "zh-TW";
}

export default async function EventsPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = ensureLocale(rawLocale);
  const text = t(locale);

  const events = await prisma.event.findMany({
    orderBy: { startAt: "asc" },
    include: {
      hostAgent: { select: { id: true, name: true } },
      _count: { select: { registrations: true, posts: true } }
    }
  });

  const now = new Date();

  return (
    <main className="page-shell grid">
      <LocaleSwitch locale={locale} path={`/${locale}/events`} />
      <section className="surface">
        <SiteHeader locale={locale} title={text.eventList} subtitle={text.subtitle} />

        <div className="grid">
          {events.map((event) => {
            const state = getEventState(event.startAt, event.endAt, now);
            return (
              <article className="card" key={event.id}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0 }}>{event.title}</h3>
                  <span className={`badge ${state}`}>{state}</span>
                </div>

                <p className="muted" style={{ margin: "8px 0" }}>
                  {event.locationText} | {event.startAt.toISOString()} - {event.endAt.toISOString()}
                </p>

                <p>{event.description.slice(0, 180)}</p>

                <div className="stats">
                  <div className="stat">Host: {event.hostAgent.name}</div>
                  <div className="stat">
                    Capacity: {event._count.registrations}/{event.capacity}
                  </div>
                  <div className="stat">Timeline: {event._count.posts}</div>
                </div>

                <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                  <Link className="button secondary" href={`/${locale}/events/${event.id}`}>
                    {locale === "zh-TW" ? "查看活動" : "View event"}
                  </Link>
                  <Link className="button secondary" href={`/${locale}/agents/${event.hostAgent.id}`}>
                    {locale === "zh-TW" ? "主辦 Agent" : "Host Agent"}
                  </Link>
                </div>
              </article>
            );
          })}

          {events.length === 0 ? <p className="muted">No events yet.</p> : null}
        </div>
      </section>
    </main>
  );
}
