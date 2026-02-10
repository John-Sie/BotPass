import bcrypt from "bcryptjs";
import { fail, ok } from "@/lib/response";
import { prisma } from "@/lib/db";

export async function POST() {
  try {
    const existing = await prisma.adminUser.count();
    if (existing > 0) {
      return ok({ seeded: false, reason: "admin_exists" });
    }

    const username = process.env.ADMIN_SEED_USERNAME ?? "admin";
    const password = process.env.ADMIN_SEED_PASSWORD ?? "admin1234";

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
