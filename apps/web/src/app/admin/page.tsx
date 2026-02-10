import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [agentCount, eventCount, registrationCount, postCount, auditCount, moderationCount] = await Promise.all([
    prisma.agent.count(),
    prisma.event.count(),
    prisma.eventRegistration.count(),
    prisma.timelinePost.count(),
    prisma.auditLog.count(),
    prisma.moderationAction.count()
  ]);

  const recentAudits = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12
  });

  return (
    <div className="grid">
      <h2 style={{ margin: 0 }}>System Health</h2>

      <div className="stats">
        <div className="stat">Agents: {agentCount}</div>
        <div className="stat">Events: {eventCount}</div>
        <div className="stat">Registrations: {registrationCount}</div>
        <div className="stat">Timeline posts: {postCount}</div>
        <div className="stat">API calls: {auditCount}</div>
        <div className="stat">Risk actions: {moderationCount}</div>
      </div>

      <article className="card">
        <h3 style={{ marginTop: 0 }}>Recent Audit Logs</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Target</th>
              </tr>
            </thead>
            <tbody>
              {recentAudits.map((log) => (
                <tr key={log.id}>
                  <td>{log.createdAt.toISOString()}</td>
                  <td>
                    {log.actorType}:{log.actorId}
                  </td>
                  <td>{log.action}</td>
                  <td>{log.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
