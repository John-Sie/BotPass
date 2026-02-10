import { prisma } from "./db";

export async function writeAuditLog(input: {
  actorType: string;
  actorId: string;
  action: string;
  target: string;
  detail?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorType: input.actorType,
      actorId: input.actorId,
      action: input.action,
      target: input.target,
      detail: input.detail === undefined ? undefined : (input.detail as object)
    }
  });
}
