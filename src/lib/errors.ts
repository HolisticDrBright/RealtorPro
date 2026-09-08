import { NextResponse } from "next/server";
import { ZodError } from "zod";

export type ErrorCode = "bad_request" | "validation_error" | "not_found" | "conflict" | "unprocessable" | "internal_error";
const STATUS: Record<ErrorCode, number> = { bad_request: 400, validation_error: 422, not_found: 404, conflict: 409, unprocessable: 422, internal_error: 500 };

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
  // SQLite errors can be wrapped by Drizzle. Reveal only this known, actionable constraint.
  const cause = err instanceof Error && err.cause ? err.cause : err;
  if (cause instanceof Error && cause.message.includes("UNIQUE constraint failed: investors.contact_id")) {
    return NextResponse.json({ error: { code: "conflict", message: "This contact already has an investor profile. Edit the existing profile instead." } }, { status: 409 });
  }
  if (err instanceof AppError) return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: STATUS[err.code] });
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`);
    return NextResponse.json({ error: { code: "validation_error", message: issues.join("; "), details: err.issues } }, { status: 422 });
  }
  console.error("Request failed", err instanceof Error ? err.name : "UnknownError");
  return NextResponse.json({ error: { code: "internal_error", message: "The request failed. Refresh to check the result before trying again." } }, { status: 500 });
}

export function ok<T>(data: T, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}
