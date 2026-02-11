import { getEventState } from "@botpass/core";
import { prisma } from "@/lib/db";
import { requireAdminPageSession } from "@/lib/admin-auth";
import { AdminEventsTable } from "@/components/admin-events-table";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
  await requireAdminPageSession();

  const now = new Date();

  const events = await prisma.event.findMany({
    orderBy: { startAt: "desc" },
    include: {
      hostAgent: { select: { name: true } },
      _count: { select: { registrations: true, posts: true } }
    }
  });

  return (
    <div className="grid">
      <h2 style={{ margin: 0 }}>Event Management</h2>

      <article className="card">
        <AdminEventsTable
          initialEvents={events.map((event) => ({
            id: event.id,
            title: event.title,
            hostName: event.hostAgent.name,
            state: getEventState(event.startAt, event.endAt, now),
            capacity: event.capacity,
            registrationCount: event._count.registrations,
            timelineCount: event._count.posts,
            startAtIso: event.startAt.toISOString()
          }))}
        />
      </article>
    </div>
  );
}
