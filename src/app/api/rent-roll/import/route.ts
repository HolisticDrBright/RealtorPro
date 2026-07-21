import type { NextRequest } from "next/server";
import { db } from "@/db";
import { rentRollFindings, rentRollUnits, rentRolls } from "@/db/schema.modules";
import { sourceDocuments } from "@/db/schema";
import { readJson } from "@/lib/api";
import { rentRollImportSchema } from "@/lib/validation.modules";
import { parseCsv } from "@/lib/csv-mapping";
import { detectRentRollMapping, normalizeUnit, validateRentRoll, summarizeRentRoll } from "@/lib/rent-roll";
import { occupancy, economicOccupancy, capRate } from "@/lib/finance";
import { storeFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Rent Roll import: parse → map → normalize (source-vs-normalized) → validate.
 * Uncertain/derived values are flagged `needsReview`; nothing is auto-replaced.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, rentRollImportSchema);
    const { headers, rows } = parseCsv(input.content);
    if (headers.length === 0) throw new AppError("unprocessable", "The rent roll file is empty or has no header row.");

    const mapping = detectRentRollMapping(headers, input.mapping);
    const units = rows.map((r) => normalizeUnit(r, mapping));
    const findings = validateRentRoll(units);
    const summary = summarizeRentRoll(units);

    const stored = storeFile("sources", "rent-roll.csv", Buffer.from(input.content, "utf8"));
    const sourceDoc = db
      .insert(sourceDocuments)
      .values({ kind: "mls_csv", filename: stored.filename, mimeType: "text/csv", sha256: stored.sha256, byteSize: stored.byteSize, storedPath: stored.storedPath, meta: { mapping } })
      .returning()
      .get();

    const rr = db
      .insert(rentRolls)
      .values({ propertyId: input.propertyId ?? null, sourceDocumentId: sourceDoc.id, name: input.name, status: findings.length ? "validated" : "analyzed", unitCount: units.length, localOnly: input.localOnly, redactPii: input.redactPii })
      .returning()
      .get();

    for (const u of units) {
      db.insert(rentRollUnits)
        .values({ rentRollId: rr.id, unit: u.unit, tenant: u.tenant, sf: u.sf, leaseStart: u.leaseStart, leaseEnd: u.leaseEnd, monthlyRent: u.monthlyRent, annualRent: u.annualRent, deposit: u.deposit, concessions: u.concessions, arrears: u.arrears, status: u.status, notes: u.notes, sourceRaw: u.source, needsReview: u.needsReview })
        .run();
    }
    for (const f of findings) {
      db.insert(rentRollFindings).values({ rentRollId: rr.id, unitRef: f.unitRef, code: f.code, severity: f.severity, message: f.message, sourceValue: f.sourceValue, normalizedValue: f.normalizedValue }).run();
    }

    // Derived metrics — computed only when inputs exist.
    const derived = [
      occupancy(summary.occupied, summary.total),
      economicOccupancy(summary.actualAnnual, summary.grossPotentialAnnual),
      capRate(null, null), // NOI/price not provided at import → pending
    ];

    writeAudit({ action: "rent_roll.import", entityType: "rent_roll", entityId: rr.id, metadata: { units: units.length, findings: findings.length } });

    return ok({ rentRollId: rr.id, mapping, unitCount: units.length, summary, findingsCount: findings.length, findings, derived }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
