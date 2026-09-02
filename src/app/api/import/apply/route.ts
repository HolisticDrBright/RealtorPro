import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { applyImport, ImportBundle } from "@/services/importer";
import { notify } from "@/services/hooks";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Write a previously previewed bundle into the database. */
export async function POST(req: NextRequest) {
  try {
    const { bundle, source } = await readJson(req, z.object({ bundle: ImportBundle, source: z.string().max(40).default("import") }));
    const report = applyImport(bundle, { dryRun: false, source });
    const n = Object.values(report.created).reduce((a, b) => a + b, 0) + Object.values(report.updated).reduce((a, b) => a + b, 0);
    if (n) notify({ title: `Imported ${n} record${n === 1 ? "" : "s"} from ${source}`, body: Object.entries(report.created).map(([k, v]) => `${v} ${k}`).join(", ") || undefined, kind: "success", href: "/contacts" });
    return ok({ report });
  } catch (err) { return errorResponse(err); }
}
