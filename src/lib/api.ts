import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AppError } from "./errors";

/**
 * Read and validate a JSON request body against a Zod schema. Returns the
 * schema's OUTPUT type (so `.default()`s are applied and non-optional).
 */
export async function readJson<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError("bad_request", "Request body must be valid JSON.");
  }
  return schema.parse(raw);
}

export const runtime = "nodejs";
