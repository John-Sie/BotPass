import { NextResponse } from "next/server";
import { AppError, isAppError } from "@botpass/core";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(error: AppError | Error | unknown) {
  if (isAppError(error)) {
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
