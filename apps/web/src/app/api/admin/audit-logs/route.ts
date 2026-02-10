import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { fail, ok } from "@/lib/response";

export async function GET(req: Request) {
  try {
    await requireAdminSession();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number.parseInt(searchParams.get("limit") ?? "50", 10), 200);

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: Number.isFinite(limit) ? limit : 50
    });

    return ok(logs);
  } catch (error) {
    return fail(error);
  }
}
