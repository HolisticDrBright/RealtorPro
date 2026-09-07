import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { vaultBundle } from "@/services/obsidian";
import { proposeImport } from "@/services/reviews";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Import records from notes whose frontmatter has `type: contact|buyer|seller|property|listing|transaction|task|opportunity`. */
export async function POST(req: NextRequest) {
  try {
    await readJson(req, z.object({ dryRun: z.literal(true).default(true) }));
    const { bundle, notes } = vaultBundle();
    return ok({ ...proposeImport(bundle, "Obsidian"), bundle, notes, dryRun: true });
  } catch (err) { return errorResponse(err); }
}
