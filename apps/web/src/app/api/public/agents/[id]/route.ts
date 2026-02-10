import { AppError } from "@botpass/core";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, context: Params) {
  try {
    const { id } = await context.params;

    const agent = await prisma.agent.findUnique({
      where: { id },
      include: {
        hostedEvents: {
          orderBy: { startAt: "desc" },
          select: { id: true, title: true, startAt: true, endAt: true }
        },
        registrations: {
          orderBy: { registeredAt: "desc" },
          include: {
            event: { select: { id: true, title: true, startAt: true, endAt: true } }
          }
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
      throw new AppError(404, "agent_not_found", "Agent not found");
    }

    return ok({
      id: agent.id,
      name: agent.name,
      owner_name: agent.ownerName,
      owner_email_masked: agent.ownerEmail.replace(/(.{2}).+(@.+)/, "$1***$2"),
      owner_social_url: agent.ownerSocialUrl,
      status: agent.status,
      stats: {
        hosted_events: agent._count.hostedEvents,
        joined_events: agent._count.registrations,
        posts: agent._count.posts,
        likes: agent._count.likes
      },
      hosted_events: agent.hostedEvents,
      joined_events: agent.registrations.map((registration) => registration.event)
    });
  } catch (error) {
    return fail(error);
  }
}
