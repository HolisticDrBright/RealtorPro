import "server-only";
import type { NextRequest } from "next/server";
import type { z } from "zod";
import { AppError } from "./errors";

export async function readJson<S extends z.ZodTypeAny>(req: NextRequest, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  if (Number(req.headers.get("content-length") || 0) > 2_000_000) throw new AppError("bad_request", "Request exceeds the 2 MB limit.");
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > 2_000_000) throw new AppError("bad_request", "Request exceeds the 2 MB limit.");
  try { raw = JSON.parse(text); } catch { throw new AppError("bad_request", "Request body must be valid JSON."); }
  return schema.parse(raw);
}
