import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exportRecords, rentRollFindings, rentRollUnits, rentRolls } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { rentRollExportSchema } from "@/lib/validation.modules";
import { buildRentRollWorkbook } from "@/services/export/xlsx";
import { occupancy, economicOccupancy } from "@/lib/finance";
import { summarizeRentRoll, type NormalizedUnit, type RentRollFinding, type Severity } from "@/lib/rent-roll";
import { storeFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** Export the cleaned rent roll as an editable XLSX workbook (six tabs). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, rentRollExportSchema);
    const rr = db.select().from(rentRolls).where(eq(rentRolls.id, id)).get();
    if (!rr) throw new AppError("not_found", "Rent roll not found.");

    const unitRows = db.select().from(rentRollUnits).where(eq(rentRollUnits.rentRollId, id)).all();
    const findingRows = db.select().from(rentRollFindings).where(eq(rentRollFindings.rentRollId, id)).all();

    const units: NormalizedUnit[] = unitRows.map((u) => ({
      unit: u.unit,
      tenant: u.tenant,
      sf: u.sf,
      leaseStart: u.leaseStart,
      leaseEnd: u.leaseEnd,
      leaseEndYear: u.leaseEnd && /\d{4}/.test(u.leaseEnd) ? u.leaseEnd.match(/(\d{4})/)![1] : u.leaseEnd === "MTM" ? "MTM" : null,
      monthlyRent: u.monthlyRent,
      annualRent: u.annualRent,
      deposit: u.deposit,
      concessions: u.concessions,
      arrears: u.arrears,
      status: u.status,
      notes: u.notes,
      source: (u.sourceRaw ?? {}) as Record<string, string>,
      needsReview: u.needsReview,
    }));
    const findings: RentRollFinding[] = findingRows.map((f) => ({ code: f.code, severity: f.severity as Severity, message: f.message, unitRef: f.unitRef ?? undefined, sourceValue: f.sourceValue ?? undefined, normalizedValue: f.normalizedValue ?? undefined }));

    const summary = summarizeRentRoll(units);
    const derived = [occupancy(summary.occupied, summary.total), economicOccupancy(summary.actualAnnual, summary.grossPotentialAnnual)];
    const headers = Object.keys(units[0]?.source ?? { Unit: "" });

    const buffer = await buildRentRollWorkbook({
      name: rr.name,
      headers,
      originalRows: units.map((u) => u.source),
      units,
      findings,
      derived,
      redactPii: input.redactPii || rr.redactPii,
    });
    const stored = storeFile("exports", `${rr.name.replace(/[^a-z0-9]+/gi, "-")}.xlsx`, buffer);

    const record = db
      .insert(exportRecords)
      .values({ subjectType: "rent_roll", subjectId: id, format: "xlsx", storedPath: stored.storedPath, sha256: stored.sha256, byteSize: stored.byteSize, metadata: { redactPii: input.redactPii } })
      .returning()
      .get();

    writeAudit({ action: "rent_roll.export", entityType: "export_record", entityId: record.id, metadata: { byteSize: stored.byteSize } });
    return ok({ export: record, message: `Exported ${stored.filename}.` }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
