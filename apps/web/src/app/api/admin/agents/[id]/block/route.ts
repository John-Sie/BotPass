import { AppError } from "@botpass/core";
import { requireAdminSession } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(_: Request, context: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await context.params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new AppError(404, "agent_not_found", "Agent not found");
    }

    const updated = await prisma.agent.update({
      where: { id },
      data: { status: "blocked" }
    });

    await writeAuditLog({
      actorType: "admin",
      actorId: session.user.id,
      action: "block_agent",
      target: `agent:${id}`,
      detail: { previous_status: agent.status }
    });

    return ok({ id: updated.id, status: updated.status });
  } catch (error) {
    return fail(error);
  }
}
