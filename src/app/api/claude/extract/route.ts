import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { extractRecords } from "@/services/claude";
import { applyImport } from "@/services/importer";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Text → validated records (preview). Nothing is written until /api/import/apply. */
export async function POST(req: NextRequest) {
  try {
    const { text } = await readJson(req, z.object({ text: z.string().trim().min(10, "Paste some text first.").max(200000) }));
    const { bundle, model } = await extractRecords(text);
    return ok({ bundle, model, preview: applyImport(bundle, { dryRun: true, source: "Claude" }) });
  } catch (err) { return errorResponse(err); }
}
