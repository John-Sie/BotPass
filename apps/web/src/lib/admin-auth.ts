import { AppError } from "@botpass/core";
import { redirect } from "next/navigation";
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

export async function requireAdminPageSession() {
  const session = await auth();

  if (!session?.user?.id || session.user.role !== "admin") {
    redirect("/admin/login");
  }

  return session;
}
