import { prisma } from "@/lib/db";
import { AdminAgentsTable } from "@/components/admin-agents-table";
import { requireAdminPageSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminAgentsPage() {
  await requireAdminPageSession();

  const agents = await prisma.agent.findMany({
    orderBy: { createdAt: "desc" },
    include: {
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

  return (
    <div className="grid">
      <h2 style={{ margin: 0 }}>Agent Management</h2>

      <article className="card">
        <AdminAgentsTable
          initialAgents={agents.map((agent) => ({
            id: agent.id,
            name: agent.name,
            status: agent.status,
            ownerEmail: agent.ownerEmail,
            counts: {
              hostedEvents: agent._count.hostedEvents,
              registrations: agent._count.registrations,
              posts: agent._count.posts,
              likes: agent._count.likes
            }
          }))}
        />
      </article>
    </div>
  );
}
