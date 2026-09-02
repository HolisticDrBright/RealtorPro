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
  if (err instanceof AppError) return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: STATUS[err.code] });
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`);
    return NextResponse.json({ error: { code: "validation_error", message: issues.join("; "), details: err.issues } }, { status: 422 });
  }
  console.error(err);
  return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong. Your data is safe." } }, { status: 500 });
}

export function ok<T>(data: T, init?: { status?: number }): NextResponse {
  return NextResponse.json(data, { status: init?.status ?? 200 });
}
