import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { compSets, comps, exportRecords } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { compExportSchema } from "@/lib/validation.modules";
import { buildCompWorkbook } from "@/services/export/xlsx";
import { getPdfProvider } from "@/services/export/pdf";
import type { NormalizedComp } from "@/lib/comps";
import { storeFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** Export the comp set as an XLSX workbook or a client-facing PDF (disclaimed). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, compExportSchema);
    const set = db.select().from(compSets).where(eq(compSets.id, id)).get();
    if (!set) throw new AppError("not_found", "Comp set not found.");
    const rows = db.select().from(comps).where(eq(comps.compSetId, id)).all();

    const normalized: (NormalizedComp & { score?: number | null })[] = rows.map((c) => ({
      address: c.address,
      assetType: c.assetType,
      transactionDate: c.transactionDate,
      price: c.price,
      size: c.size,
      pricePerSf: c.pricePerSf,
      pricePerUnit: c.pricePerUnit,
      capRate: c.capRate,
      daysOnMarket: c.daysOnMarket,
      distanceMi: c.distanceMi,
      source: c.source,
      sourceDate: c.sourceDate,
      verificationStatus: c.verificationStatus as NormalizedComp["verificationStatus"],
      missingFields: c.missingFields ?? [],
      source_raw: {},
      score: c.score,
    }));

    let buffer: Buffer;
    let filename: string;
    if (input.format === "xlsx") {
      buffer = await buildCompWorkbook({ name: set.name, comps: normalized });
      filename = `${set.name.replace(/[^a-z0-9]+/gi, "-")}-comps.xlsx`;
    } else {
      buffer = await getPdfProvider().render({
        name: `${set.name} — Comparable Sales`,
        address: null,
        brand: { name: "Comp Lab", disclaimer: "Comparability scores are transparency aids, not appraisals or valuations. Agent-entered adjustments are assumptions. Demo data." },
        sections: [
          {
            title: "Comparable Sales",
            table: { headers: ["Address", "Date", "Price", "$/SF", "Verification"], rows: normalized.map((c) => [c.address ?? "", c.transactionDate ?? "", c.price ?? "", c.pricePerSf ?? "", c.verificationStatus]) },
          },
        ],
      });
      filename = `${set.name.replace(/[^a-z0-9]+/gi, "-")}-comps.pdf`;
    }

    const stored = storeFile("exports", filename, buffer);
    const record = db.insert(exportRecords).values({ subjectType: "comp_set", subjectId: id, format: input.format, storedPath: stored.storedPath, sha256: stored.sha256, byteSize: stored.byteSize }).returning().get();
    writeAudit({ action: "comps.export", entityType: "export_record", entityId: record.id, metadata: { format: input.format } });
    return ok({ export: record, message: `Exported ${filename}.` }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
