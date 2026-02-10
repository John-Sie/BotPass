import { AppError } from "@botpass/core";
import { ulid } from "ulid";
import { requireAgent } from "@/lib/agent-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { enforceRateAndModeration } from "@/lib/moderation";
import { provider, reportOpenClawAction } from "@/lib/openclaw";
import { mapPrismaError } from "@/lib/prisma-error";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: Params) {
  try {
    const agent = await requireAgent(req.headers);
    const { id: eventId } = await context.params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { _count: { select: { registrations: true } } }
    });

    if (!event) {
      throw new AppError(404, "event_not_found", "Event not found");
    }

    if (new Date() >= event.endAt) {
      throw new AppError(422, "event_registration_closed", "Registration is only allowed before event end time");
    }

    if (event._count.registrations >= event.capacity) {
      throw new AppError(409, "capacity_full", "Event capacity reached");
    }

    await enforceRateAndModeration({
      agentId: agent.id,
      eventId,
      action: "register"
    });

    const registrationId = ulid();

    const registration = await prisma.$transaction(async (tx) => {
      const created = await tx.eventRegistration.create({
        data: {
          id: registrationId,
          eventId,
          agentId: agent.id
        }
      });

      await tx.ticket.create({
        data: {
          registrationId,
          holderAgentId: agent.id
        }
      });

      return created;
    });

    await writeAuditLog({
      actorType: "agent",
      actorId: agent.id,
      action: "register_event",
      target: `event:${eventId}`,
      detail: { registration_id: registration.id }
    });

    await reportOpenClawAction(() => provider.register_event(eventId));

    return ok({
      registration_id: registration.id,
      registered_at: registration.registeredAt
    });
  } catch (error) {
    try {
      mapPrismaError(error, "register_failed");
    } catch (mapped) {
      return fail(mapped);
    }
    return fail(error);
  }
}
