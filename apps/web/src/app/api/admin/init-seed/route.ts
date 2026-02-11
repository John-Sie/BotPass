import bcrypt from "bcryptjs";
import { fail, ok } from "@/lib/response";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const existing = await prisma.adminUser.count();
    if (existing > 0) {
      return ok({ seeded: false, reason: "admin_exists" });
    }

    // Trim to avoid accidentally persisting trailing newlines from env tooling.
    const username = String(process.env.ADMIN_SEED_USERNAME ?? "admin").trim();
    const password = String(process.env.ADMIN_SEED_PASSWORD ?? "admin1234").trimEnd();

    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.adminUser.create({
      data: {
        username,
        passwordHash
      }
    });

    return ok({
      seeded: true,
      admin_id: admin.id,
      username
    });
  } catch (error) {
    return fail(error);
  }
}
