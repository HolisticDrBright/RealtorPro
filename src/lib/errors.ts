import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Structured, user-readable error handling for API routes.
 *
 * Every failure returns a consistent JSON envelope:
 *   { error: { code, message, details? } }
 * so the frontend can render a readable error state rather than a raw stack.
 */

export type ErrorCode =
  | "bad_request"
  | "validation_error"
  | "not_found"
  | "unauthorized"
  | "conflict"
  | "unprocessable"
  | "rate_limited"
  | "fair_housing_violation"
  | "approval_required"
  | "provider_error"
  | "unsafe_path"
  | "internal_error";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_error: 422,
  not_found: 404,
  unauthorized: 401,
  conflict: 409,
  unprocessable: 422,
  rate_limited: 429,
  fair_housing_violation: 422,
  approval_required: 403,
  provider_error: 502,
  unsafe_path: 400,
  internal_error: 500,
};

export class AppError extends Error {
  code: ErrorCode;
  details?: unknown;
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.details = details;
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof AppError) {
    return NextResponse.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: STATUS[err.code] },
    );
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "validation_error",
          message: "One or more fields are invalid.",
          details: err.flatten(),
        },
      },
      { status: 422 },
    );
  }
  // Unknown error — log server-side, return a safe generic message.
  console.error("[agentos] unhandled error:", err);
  return NextResponse.json(
    {
      error: {
        code: "internal_error",
        message: "Something went wrong. Your local data is safe.",
      },
    },
    { status: 500 },
  );
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}
