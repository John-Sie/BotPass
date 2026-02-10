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
  const dailyApiCalls = await prisma.$queryRaw<Array<{ day: Date; count: number }>>`
    SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS count
    FROM audit_logs
    GROUP BY 1
    ORDER BY 1 DESC
    LIMIT 14
  `;

  const recentAudits = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 12
  });
  const chartData = dailyApiCalls
    .map((item) => ({
      day: new Date(item.day),
      count: Number(item.count)
    }))
    .reverse();
  const maxCount = chartData.reduce((max, item) => (item.count > max ? item.count : max), 0);

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
        <h3 style={{ marginTop: 0 }}>API Calls (Last 14 Days)</h3>
        {chartData.length === 0 ? (
          <p className="muted">No data yet.</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${chartData.length}, minmax(18px, 1fr))`,
              alignItems: "end",
              gap: 8,
              height: 210
            }}
          >
            {chartData.map((item) => {
              const height = maxCount > 0 ? Math.max(8, Math.round((item.count / maxCount) * 180)) : 8;
              const label = item.day.toISOString().slice(5, 10);
              return (
                <div key={`${label}-${item.count}`} style={{ display: "grid", gap: 6 }}>
                  <div
                    title={`${label}: ${item.count}`}
                    style={{
                      height,
                      background: "linear-gradient(180deg, var(--brand-2), color-mix(in oklab, var(--brand-2), white 35%))",
                      borderRadius: 8
                    }}
                  />
                  <div className="muted" style={{ fontSize: 11, textAlign: "center" }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>

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
