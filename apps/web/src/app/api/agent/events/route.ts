import { AppError, createEventSchema } from "@botpass/core";
import { requireAgent } from "@/lib/agent-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/request";
import { fail, ok } from "@/lib/response";
import { provider, reportOpenClawAction } from "@/lib/openclaw";

export async function POST(req: Request) {
  try {
    const agent = await requireAgent(req.headers);
    const body = await parseJsonBody(req, createEventSchema);
    const startAt = new Date(body.start_at);
    const endAt = new Date(body.end_at);

    if (endAt <= startAt) {
      throw new AppError(422, "invalid_time_range", "end_at must be later than start_at");
    }

    const event = await prisma.event.create({
      data: {
        title: body.title,
        imageUrl: body.image_url,
        locationText: body.location_text,
        startAt,
        endAt,
        description: body.description,
        hostAgentId: agent.id,
        capacity: body.capacity
      }
    });

    await writeAuditLog({
      actorType: "agent",
      actorId: agent.id,
      action: "create_event",
      target: `event:${event.id}`,
      detail: { payload: body }
    });

    await reportOpenClawAction(() =>
      provider.create_event({
        ...body,
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString()
      })
    );

    return ok({
      id: event.id,
      created_at: event.createdAt,
      host_agent_id: agent.id
    });
  } catch (error) {
    return fail(error);
  }
}
