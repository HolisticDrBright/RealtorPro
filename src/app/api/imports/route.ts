import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  columnMappings,
  facts as factsTable,
  listingImports,
  properties,
  sourceDocuments,
} from "@/db/schema";
import { readJson } from "@/lib/api";
import { csvImportSchema } from "@/lib/validation";
import { importMlsCsv, type CanonicalField } from "@/lib/csv-mapping";
import { parseNumber } from "@/lib/listing-parse";
import { storeFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * MLS CSV import.
 * - Detects/uses a column mapping (optionally saved for reuse).
 * - Stores the uploaded CSV as an IMMUTABLE source document (hashed on disk).
 * - Persists one property + an append-only fact ledger per VALID row.
 * - Reports missing/conflicting facts as issues. NEVER infers a missing fact.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, csvImportSchema);

    // Resolve a saved mapping if requested.
    let savedMapping = input.mapping;
    if (input.mappingId) {
      const row = db.select().from(columnMappings).where(eq(columnMappings.id, input.mappingId)).get();
      if (!row) throw new AppError("not_found", "Saved column mapping not found.");
      savedMapping = row.mapping;
    }

    const result = importMlsCsv(input.csv, savedMapping);

    // Immutable source record.
    const buf = Buffer.from(input.csv, "utf8");
    const stored = storeFile("sources", input.filename ?? "mls-import.csv", buf);
    const sourceDoc = db
      .insert(sourceDocuments)
      .values({
        kind: "mls_csv",
        filename: stored.filename,
        mimeType: "text/csv",
        sha256: stored.sha256,
        byteSize: stored.byteSize,
        storedPath: stored.storedPath,
        meta: { detection: result.detection, rowCount: result.rowCount },
      })
      .returning()
      .get();

    // Optionally save the mapping for reuse.
    let savedMappingId: string | undefined;
    if (input.saveMappingName && Object.keys(result.detection.mapping).length > 0) {
      const m = db
        .insert(columnMappings)
        .values({
          name: input.saveMappingName,
          sourceType: "mls_csv",
          mapping: result.detection.mapping as Record<string, string>,
        })
        .returning()
        .get();
      savedMappingId = m.id;
    }

    // Persist valid rows as property + fact ledger.
    const createdProperties: { id: string; address: string }[] = [];
    for (const listing of result.listings) {
      if (listing.missing.length > 0) continue; // do not persist rows missing required facts
      const f = listing.fields;
      const property = db
        .insert(properties)
        .values({
          address: f.address!,
          mlsNumber: f.mlsNumber ?? null,
          price: f.price ?? null,
          beds: parseNumber(f.beds ?? null),
          baths: parseNumber(f.baths ?? null),
          sqft: f.sqft ?? null,
          lot: f.lot ?? null,
          propertyType: f.propertyType ?? null,
          features: f.features ? [f.features] : [],
          remarks: f.remarks ?? null,
          openHouse: f.openHouse ?? null,
          status: "imported",
          sourceMeta: listing.sourceMeta,
        })
        .returning()
        .get();

      const listingImport = db
        .insert(listingImports)
        .values({
          sourceDocumentId: sourceDoc.id,
          columnMappingId: savedMappingId ?? input.mappingId ?? null,
          propertyId: property.id,
          rowCount: 1,
          validRows: 1,
          status: "parsed",
          issues: [],
        })
        .returning()
        .get();

      // Append a fact per present field, each citing its source column.
      for (const field of Object.keys(f) as CanonicalField[]) {
        db.insert(factsTable)
          .values({
            propertyId: property.id,
            listingImportId: listingImport.id,
            sourceDocumentId: sourceDoc.id,
            field,
            value: f[field] ?? null,
            source: `CSV: ${result.detection.mapping[field] ?? field}`,
            confidence: "reported",
          })
          .run();
      }
      createdProperties.push({ id: property.id, address: property.address });
    }

    writeAudit({
      action: "import.mls_csv",
      entityType: "source_document",
      entityId: sourceDoc.id,
      metadata: {
        rowCount: result.rowCount,
        validRows: result.validRows,
        status: result.status,
        issues: result.issues,
        propertiesCreated: createdProperties.length,
      },
    });

    return ok(
      {
        sourceDocumentId: sourceDoc.id,
        detection: result.detection,
        status: result.status,
        rowCount: result.rowCount,
        validRows: result.validRows,
        issues: result.issues,
        properties: createdProperties,
        savedMappingId,
      },
      { status: result.status === "invalid" ? 422 : 200 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
