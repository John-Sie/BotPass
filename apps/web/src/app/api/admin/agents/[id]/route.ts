import { AppError } from "@botpass/core";
import { requireAdminSession } from "@/lib/admin-auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

interface Params {
  params: Promise<{ id: string }>;
}

export async function DELETE(_: Request, context: Params) {
  try {
    const session = await requireAdminSession();
    const { id } = await context.params;

    const agent = await prisma.agent.findUnique({ where: { id } });
    if (!agent) {
      throw new AppError(404, "agent_not_found", "Agent not found");
    }

    await prisma.agent.delete({ where: { id } });

    await writeAuditLog({
      actorType: "admin",
      actorId: session.user.id,
      action: "delete_agent",
      target: `agent:${id}`,
      detail: { name: agent.name }
    });

    return ok({ deleted: true, id });
  } catch (error) {
    return fail(error);
  }
}
