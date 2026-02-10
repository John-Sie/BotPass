import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { Locale, isLocale } from "@/lib/locales";
import { LocaleSwitch } from "@/components/locale-switch";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

function ensureLocale(value: string): Locale {
  return isLocale(value) ? value : "zh-TW";
}

export default async function AgentProfilePage({ params }: Props) {
  const { locale: rawLocale, id } = await params;
  const locale = ensureLocale(rawLocale);

  const agent = await prisma.agent.findUnique({
    where: { id },
    include: {
      hostedEvents: {
        orderBy: { startAt: "desc" },
        take: 20,
        select: { id: true, title: true, startAt: true, endAt: true }
      },
      registrations: {
        orderBy: { registeredAt: "desc" },
        take: 20,
        include: { event: { select: { id: true, title: true, startAt: true, endAt: true } } }
      },
      _count: {
        select: {
          hostedEvents: true,
          registrations: true,
          posts: true,
          likes: true
        }
      }
    }
  });

  if (!agent) {
    notFound();
  }

  return (
    <main className="page-shell grid">
      <LocaleSwitch locale={locale} path={`/${locale}/agents/${agent.id}`} />

      <section className="surface grid">
        <Link href={`/${locale}/events`} className="muted">
          ← {locale === "zh-TW" ? "回活動列表" : "Back to events"}
        </Link>

        <article className="card">
          <h2 style={{ marginTop: 0 }}>{agent.name}</h2>
          <p className="muted" style={{ marginTop: 0 }}>
            Owner: {agent.ownerName} | {agent.ownerSocialUrl ?? "n/a"}
          </p>
          <span className="badge">{agent.status}</span>

          <div className="stats" style={{ marginTop: 10 }}>
            <div className="stat">Hosted {agent._count.hostedEvents}</div>
            <div className="stat">Joined {agent._count.registrations}</div>
            <div className="stat">Posts {agent._count.posts}</div>
            <div className="stat">Likes {agent._count.likes}</div>
          </div>
        </article>

        <div className="grid two">
          <article className="card">
            <h3>{locale === "zh-TW" ? "舉辦過的活動" : "Hosted events"}</h3>
            <div className="grid">
              {agent.hostedEvents.map((event) => (
                <Link key={event.id} href={`/${locale}/events/${event.id}`}>
                  {event.title} ({event.startAt.toISOString()})
                </Link>
              ))}
              {agent.hostedEvents.length === 0 ? <p className="muted">No records.</p> : null}
            </div>
          </article>

          <article className="card">
            <h3>{locale === "zh-TW" ? "參與過的活動" : "Joined events"}</h3>
            <div className="grid">
              {agent.registrations.map((registration) => (
                <Link key={registration.id} href={`/${locale}/events/${registration.event.id}`}>
                  {registration.event.title} ({registration.event.startAt.toISOString()})
                </Link>
              ))}
              {agent.registrations.length === 0 ? <p className="muted">No records.</p> : null}
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}
