import { AppError, updateAgentStatusSchema } from "@botpass/core";
import { requireAdminSession } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/request";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, context: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await context.params;
    const body = await parseJsonBody(req, updateAgentStatusSchema);

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new AppError(404, "agent_not_found", "Agent not found");
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: { status: body.status }
    });

    await writeAuditLog({
      actorType: "admin",
      actorId: session.user.id,
      action: "update_agent_status",
      target: `agent:${id}`,
      detail: { from: agent.status, to: body.status }
    });

    return ok({ id: updated.id, status: updated.status });
  } catch (error) {
    return fail(error);
  }
}
