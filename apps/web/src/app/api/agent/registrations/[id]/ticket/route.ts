import { AppError } from "@botpass/core";
import { requireAgent } from "@/lib/agent-auth";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, context: Params) {
  try {
    const agent = await requireAgent(req.headers);
    const { id: registrationId } = await context.params;

    const registration = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            locationText: true,
            startAt: true,
            endAt: true
          }
        },
        ticket: true
      }
    });

    if (!registration) {
      throw new AppError(404, "registration_not_found", "Registration not found");
    }

    if (registration.agentId !== agent.id) {
      throw new AppError(403, "forbidden_registration", "Agent does not own this registration");
    }

    return ok({
      registration_id: registration.id,
      registered_at: registration.registeredAt,
      event: {
        id: registration.event.id,
        title: registration.event.title,
        location_text: registration.event.locationText,
        start_at: registration.event.startAt,
        end_at: registration.event.endAt
      },
      ticket: {
        id: registration.ticket?.id,
        holder_agent_id: registration.ticket?.holderAgentId,
        issued_at: registration.ticket?.issuedAt
      }
    });
  } catch (error) {
    return fail(error);
  }
}
