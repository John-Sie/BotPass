import { NextResponse } from "next/server";
import { AppError, isAppError } from "@botpass/core";
import { captureException } from "@/lib/observability";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: AppError | Error | unknown) {
  if (isAppError(error)) {
    if (error.status >= 500) {
      captureException(error, { code: error.code, detail: error.detail ?? null });
    }

    return NextResponse.json(
      {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          detail: error.detail ?? null
        }
      },
      { status: error.status }
    );
  }

  const err = error instanceof Error ? error : new Error("unknown_error");
  captureException(err);
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: "internal_error",
        message: err.message
      }
    },
    { status: 500 }
  );
}
