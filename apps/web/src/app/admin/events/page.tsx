import { getEventState } from "@botpass/core";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminEventsPage() {
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
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Host</th>
                <th>State</th>
                <th>Capacity</th>
                <th>Registrations</th>
                <th>Timeline</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{event.title}</td>
                  <td>{event.hostAgent.name}</td>
                  <td>{getEventState(event.startAt, event.endAt, now)}</td>
                  <td>{event.capacity}</td>
                  <td>{event._count.registrations}</td>
                  <td>{event._count.posts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
