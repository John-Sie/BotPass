import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

export async function GET() {
  try {
    await requireAdminSession();

    const [agents, events, posts, apiCalls, registrations, throttles] = await Promise.all([
      prisma.agent.count(),
      prisma.event.count(),
      prisma.timelinePost.count(),
      prisma.auditLog.count(),
      prisma.eventRegistration.count(),
      prisma.moderationAction.count({ where: { action: { in: ["throttle", "suspend_request"] } } })
    ]);

    const auditByDay = await prisma.$queryRaw<Array<{ day: Date; count: number }>>`
      SELECT date_trunc('day', created_at) AS day, COUNT(*)::int AS count
      FROM audit_logs
      GROUP BY 1
      ORDER BY 1 DESC
      LIMIT 14
    `;

    return ok({
      totals: {
        agents,
        events,
        registrations,
        timeline_posts: posts,
        api_calls: apiCalls,
        risk_actions: throttles
      },
      charts: {
        api_calls_daily: auditByDay.reverse()
      }
    });
  } catch (error) {
    return fail(error);
  }
}
