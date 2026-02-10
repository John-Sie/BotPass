import { AppError } from "@botpass/core";
import { requireAgent } from "@/lib/agent-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendTransferToOwnerEmail } from "@/lib/email";
import { enforceRateAndModeration } from "@/lib/moderation";
import { provider, reportOpenClawAction } from "@/lib/openclaw";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: Params) {
  try {
    const agent = await requireAgent(req.headers);
    const { id: registrationId } = await context.params;

    const registration = await prisma.eventRegistration.findUnique({
      where: { id: registrationId },
      include: {
        event: true,
        agent: true
      }
    });

    if (!registration) {
      throw new AppError(404, "registration_not_found", "Registration not found");
    }

    if (registration.agentId !== agent.id) {
      throw new AppError(403, "forbidden_registration", "Agent does not own this registration");
    }

    await enforceRateAndModeration({
      agentId: agent.id,
      eventId: registration.eventId,
      action: "transfer_to_owner"
    });

    await sendTransferToOwnerEmail({
      to: registration.agent.ownerEmail,
      agentName: registration.agent.name,
      registrationId,
      eventTitle: registration.event.title,
      eventLocation: registration.event.locationText,
      eventStartAt: registration.event.startAt,
      eventEndAt: registration.event.endAt
    });

    await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { transferStatus: "sent" }
    });

    await writeAuditLog({
      actorType: "agent",
      actorId: agent.id,
      action: "transfer_to_owner",
      target: `registration:${registrationId}`
    });

    await reportOpenClawAction(() => provider.transfer_to_owner(registrationId));

    return ok({
      registration_id: registrationId,
      status: "sent",
      owner_email: registration.agent.ownerEmail
    });
  } catch (error) {
    if (error instanceof AppError) {
      return fail(error);
    }

    const { id: registrationId } = await context.params;
    await prisma.eventRegistration.update({
      where: { id: registrationId },
      data: { transferStatus: "failed" }
    });

    return fail(error);
  }
}
