import type { NextRequest } from "next/server";
import { db } from "@/db";
import { compSets, comps as compsTable } from "@/db/schema.modules";
import { sourceDocuments } from "@/db/schema";
import { readJson } from "@/lib/api";
import { compImportSchema } from "@/lib/validation.modules";
import { parseCsv } from "@/lib/csv-mapping";
import { detectCompMapping, normalizeComp, scoreComp, DEFAULT_WEIGHTS } from "@/lib/comps";
import { storeFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Import comps from an authorized CSV/XLSX/MLS export, normalize, and score each
 * comp transparently. Never produces an appraisal/valuation conclusion.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, compImportSchema);
    const { headers, rows } = parseCsv(input.content);
    if (headers.length === 0) throw new AppError("unprocessable", "The comp file is empty or has no header row.");

    const mapping = detectCompMapping(headers);
    const weights = input.weights ?? DEFAULT_WEIGHTS;
    const subject = input.subject ?? {};

    const stored = storeFile("sources", "comps.csv", Buffer.from(input.content, "utf8"));
    const sourceDoc = db
      .insert(sourceDocuments)
      .values({ kind: "mls_csv", filename: stored.filename, mimeType: "text/csv", sha256: stored.sha256, byteSize: stored.byteSize, storedPath: stored.storedPath, meta: { mapping } })
      .returning()
      .get();

    const set = db
      .insert(compSets)
      .values({ propertyId: input.propertyId ?? null, sourceDocumentId: sourceDoc.id, name: input.name, compType: input.compType, weights, filters: {} })
      .returning()
      .get();

    const results = rows.map((r) => {
      const c = normalizeComp(r, mapping, { userEntered: input.compType === "user" });
      const score = scoreComp(c, subject, weights);
      const saved = db
        .insert(compsTable)
        .values({ compSetId: set.id, address: c.address, assetType: c.assetType, transactionDate: c.transactionDate, price: c.price, size: c.size, pricePerSf: c.pricePerSf, pricePerUnit: c.pricePerUnit, capRate: c.capRate, daysOnMarket: c.daysOnMarket, distanceMi: c.distanceMi, source: c.source, sourceDate: c.sourceDate, verificationStatus: c.verificationStatus, missingFields: c.missingFields, score: score.score })
        .returning()
        .get();
      return { ...saved, breakdown: score.breakdown };
    });

    writeAudit({ action: "comps.import", entityType: "comp_set", entityId: set.id, metadata: { count: results.length, compType: input.compType } });
    return ok({ compSetId: set.id, count: results.length, comps: results }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
