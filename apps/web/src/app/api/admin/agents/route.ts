import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

export async function GET() {
  try {
    await requireAdminSession();

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

    return ok(
      agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        status: agent.status,
        owner_email: agent.ownerEmail,
        created_at: agent.createdAt,
        stats: {
          hosted_events: agent._count.hostedEvents,
          registrations: agent._count.registrations,
          posts: agent._count.posts,
          likes: agent._count.likes
        }
      }))
    );
  } catch (error) {
    return fail(error);
  }
}
