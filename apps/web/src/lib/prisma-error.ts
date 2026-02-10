import { Prisma } from "@botpass/db";
import { AppError } from "@botpass/core";

export function mapPrismaError(error: unknown, defaultCode = "database_error"): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new AppError(409, "conflict", "Unique constraint conflict", { target: error.meta?.target });
    }

    if (error.code === "P2003") {
      throw new AppError(422, "invalid_reference", "Invalid relation reference", { field: error.meta?.field_name });
    }
  }

  if (error instanceof AppError) {
    throw error;
  }

  throw new AppError(500, defaultCode, "Database operation failed");
}
