import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AppError } from "./errors";

export async function readJson<S extends z.ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new AppError("bad_request", "Request body must be valid JSON."); }
  return schema.parse(raw);
}
