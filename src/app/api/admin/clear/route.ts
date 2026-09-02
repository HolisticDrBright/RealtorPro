import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { clearAllData } from "@/services/admin";
import { indexVaultIfChanged } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Delete every record (sample data included). Settings are kept. Requires confirm: "DELETE". */
export async function POST(req: NextRequest) {
  try {
    await readJson(req, z.object({ confirm: z.literal("DELETE") }));
    const removed = clearAllData();
    try { indexVaultIfChanged(); } catch { /* vault optional */ }
    return ok({ removed, total: Object.values(removed).reduce((a, b) => a + b, 0) });
  } catch (err) { return errorResponse(err); }
}
