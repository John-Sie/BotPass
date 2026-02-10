import Link from "next/link";
import { getEventState } from "@botpass/core";
import type { EventState } from "@botpass/core";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { formatDateRange } from "@/lib/date-format";
import { t } from "@/lib/i18n";
import { Locale, isLocale } from "@/lib/locales";
import { LocaleSwitch } from "@/components/locale-switch";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

type EventStatusFilter = EventState | "all";
type EventTimeFilter = "all" | "today" | "next_7d" | "next_30d" | "past";

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string; time?: string; host?: string }>;
}

function ensureLocale(value: string): Locale {
  return isLocale(value) ? value : "zh-TW";
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

function getTodayBounds(value: Date) {
  const start = new Date(value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return { start, end };
}

export default async function EventsPage({ params, searchParams }: Props) {
  const [{ locale: rawLocale }, query] = await Promise.all([params, searchParams]);
  const locale = ensureLocale(rawLocale);
  const text = t(locale);
  const statusFilter = parseStatusFilter(query.status);
  const timeFilter = parseTimeFilter(query.time);
  const hostFilterRaw = query.host?.trim() ? query.host.trim() : "all";
  const now = new Date();

  const hosts = await prisma.agent.findMany({
    where: { hostedEvents: { some: {} } },
    select: { id: true, name: true },
    orderBy: { name: "asc" }
  });
  const selectedHost = hostFilterRaw === "all" || hosts.some((host) => host.id === hostFilterRaw) ? hostFilterRaw : "all";

  const whereConditions: Prisma.EventWhereInput[] = [];

  if (statusFilter === "upcoming") {
    whereConditions.push({ startAt: { gt: now } });
  } else if (statusFilter === "live") {
    whereConditions.push({ startAt: { lte: now }, endAt: { gt: now } });
  } else if (statusFilter === "ended") {
    whereConditions.push({ endAt: { lte: now } });
  }

  if (timeFilter === "today") {
    const { start, end } = getTodayBounds(now);
    whereConditions.push({ startAt: { gte: start, lt: end } });
  } else if (timeFilter === "next_7d") {
    const end = new Date(now);
    end.setDate(now.getDate() + 7);
    whereConditions.push({ startAt: { gte: now, lte: end } });
  } else if (timeFilter === "next_30d") {
    const end = new Date(now);
    end.setDate(now.getDate() + 30);
    whereConditions.push({ startAt: { gte: now, lte: end } });
  } else if (timeFilter === "past") {
    whereConditions.push({ endAt: { lt: now } });
  }

  if (selectedHost !== "all") {
    whereConditions.push({ hostAgentId: selectedHost });
  }

  const where = whereConditions.length > 0 ? { AND: whereConditions } : undefined;

  const filteredEvents = await prisma.event.findMany({
    where,
    orderBy: { startAt: "asc" },
    include: {
      hostAgent: { select: { id: true, name: true } },
      _count: { select: { registrations: true, posts: true } }
    }
  });

  const stateLabel = (state: EventState) => text.eventState[state];

  const basePath = `/${locale}/events`;

  return (
    <main className="page-shell grid">
      <LocaleSwitch locale={locale} path={basePath} />
      <section className="surface">
        <SiteHeader locale={locale} title={text.eventList} subtitle={text.subtitle} />

        <form className="card filter-bar" method="get" action={basePath}>
          <p className="filter-title">{text.filtersTitle}</p>
          <div className="filter-grid">
            <label className="filter-field">
              <span>{text.filterStatus}</span>
              <select name="status" defaultValue={statusFilter}>
                <option value="all">{text.filterAll}</option>
                <option value="upcoming">{text.eventState.upcoming}</option>
                <option value="live">{text.eventState.live}</option>
                <option value="ended">{text.eventState.ended}</option>
              </select>
            </label>

            <label className="filter-field">
              <span>{text.filterTime}</span>
              <select name="time" defaultValue={timeFilter}>
                <option value="all">{text.filterAll}</option>
                <option value="today">{text.filterTimeToday}</option>
                <option value="next_7d">{text.filterTimeNext7d}</option>
                <option value="next_30d">{text.filterTimeNext30d}</option>
                <option value="past">{text.filterTimePast}</option>
              </select>
            </label>

            <label className="filter-field">
              <span>{text.filterHost}</span>
              <select name="host" defaultValue={selectedHost}>
                <option value="all">{text.filterAll}</option>
                {hosts.map((host) => (
                  <option key={host.id} value={host.id}>
                    {host.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="filter-actions">
              <button type="submit">{text.filterApply}</button>
              <Link href={basePath} className="button secondary">
                {text.filterReset}
              </Link>
            </div>
          </div>
        </form>

        <p className="muted filter-summary">
          {text.filterResultCount} {filteredEvents.length}
        </p>

        <div className="grid">
          {filteredEvents.map((event) => {
            const state = getEventState(event.startAt, event.endAt, now);
            return (
              <article className="card event-card" key={event.id}>
                <div className="event-card-head">
                  <h3 style={{ margin: 0 }}>{event.title}</h3>
                  <span className={`badge ${state}`}>{stateLabel(state)}</span>
                </div>

                <p className="muted event-meta">
                  {event.locationText} · {formatDateRange(event.startAt, event.endAt, locale)}
                </p>

                <p className="event-description">{event.description.slice(0, 180)}</p>

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

                <div className="event-actions">
                  <Link className="button secondary" href={`/${locale}/events/${event.id}`}>
                    {text.viewEvent}
                  </Link>
                  <Link className="button secondary" href={`/${locale}/agents/${event.hostAgent.id}`}>
                    {text.viewHostAgent}
                  </Link>
                </div>
              </article>
            );
          })}

          {filteredEvents.length === 0 ? <p className="muted">{text.noEvents}</p> : null}
        </div>
      </section>
    </main>
  );
}
