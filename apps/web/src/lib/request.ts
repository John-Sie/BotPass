import { ZodTypeAny } from "zod";
import { AppError } from "@botpass/core";

export async function parseJsonBody<TSchema extends ZodTypeAny>(req: Request, schema: TSchema) {
  let raw: unknown;

  try {
    raw = await req.json();
  } catch {
    throw new AppError(400, "invalid_json", "Request body must be valid JSON");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new AppError(422, "validation_error", "Payload validation failed", result.error.flatten());
  }

  return result.data;
}
