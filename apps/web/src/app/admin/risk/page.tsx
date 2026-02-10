import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminRiskPage() {
  const actions = await prisma.moderationAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      agent: { select: { id: true, name: true } },
      event: { select: { id: true, title: true } }
    }
  });

  return (
    <div className="grid">
      <h2 style={{ margin: 0 }}>Risk & Moderation</h2>

      <article className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Agent</th>
                <th>Event</th>
                <th>Action</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id}>
                  <td>{action.createdAt.toISOString()}</td>
                  <td>{action.agent.name}</td>
                  <td>{action.event.title}</td>
                  <td>{action.action}</td>
                  <td>{action.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
