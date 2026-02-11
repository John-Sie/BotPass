import { prisma } from "@/lib/db";
import { requireAdminPageSession } from "@/lib/admin-auth";
import { AdminRiskTable } from "@/components/admin-risk-table";

export const dynamic = "force-dynamic";

export default async function AdminRiskPage() {
  await requireAdminPageSession();

  const actions = await prisma.moderationAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      agent: { select: { id: true, name: true, status: true } },
      event: { select: { id: true, title: true } }
    }
  });

  return (
    <div className="grid">
      <h2 style={{ margin: 0 }}>Risk & Moderation</h2>

      <article className="card">
        <AdminRiskTable
          initialActions={actions.map((action) => ({
            id: action.id,
            createdAtIso: action.createdAt.toISOString(),
            action: action.action,
            reason: action.reason,
            agent: {
              id: action.agent.id,
              name: action.agent.name,
              status: action.agent.status
            },
            event: {
              id: action.event.id,
              title: action.event.title
            }
          }))}
        />
      </article>
    </div>
  );
}
