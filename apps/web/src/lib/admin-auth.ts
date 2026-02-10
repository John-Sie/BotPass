import { AppError } from "@botpass/core";
import { auth } from "@/auth";

export async function requireAdminSession() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new AppError(401, "admin_unauthorized", "Admin authentication required");
  }

  if (session.user.role !== "admin") {
    throw new AppError(403, "admin_forbidden", "Admin role required");
  }

  return session;
}
