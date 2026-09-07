import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { errorResponse, ok } from "@/lib/errors";
import { createBackup, listBackups, restoreBackup } from "@/services/backups";
export const runtime = "nodejs";
export async function GET() { try { return ok({ backups: listBackups() }); } catch (e) { return errorResponse(e); } }
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, z.discriminatedUnion("action", [z.object({ action: z.literal("create") }), z.object({ action: z.literal("restore"), id: z.string(), confirm: z.literal("RESTORE") })]));
    return ok(input.action === "create" ? await createBackup() : await restoreBackup(input.id));
  } catch (e) { return errorResponse(e); }
}
