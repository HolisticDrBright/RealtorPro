import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { applyImport, ImportBundle } from "@/services/importer";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Dry-run a bundle: what would be created / updated / skipped. */
export async function POST(req: NextRequest) {
  try { const { bundle, source } = await readJson(req, z.object({ bundle: ImportBundle, source: z.string().max(40).default("import") })); return ok({ report: applyImport(bundle, { dryRun: true, source }), bundle }); } catch (err) { return errorResponse(err); }
}
