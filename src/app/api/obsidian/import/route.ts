import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { importFromVault, vaultBundle } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Import records from notes whose frontmatter has `type: contact|buyer|seller|property|listing|transaction|task|opportunity`. */
export async function POST(req: NextRequest) {
  try {
    const { dryRun } = await readJson(req, z.object({ dryRun: z.boolean().default(true) }));
    const { bundle, notes } = vaultBundle();
    return ok({ report: importFromVault(dryRun), bundle, notes, dryRun });
  } catch (err) { return errorResponse(err); }
}
