import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  buyerCriteriaProfiles,
  buyerMatches,
  listingImports,
  properties,
  sourceDocuments,
} from "@/db/schema";
import { readJson } from "@/lib/api";
import { scoutParseSchema } from "@/lib/validation";
import { importMlsCsv, type MappedListing } from "@/lib/csv-mapping";
import { extractListingsFromEmail, toScoringFacts } from "@/lib/scout";
import { buildScoringCriteria, scoreListing } from "@/lib/match-scoring";
import { assessCriteria } from "@/lib/fair-housing";
import { storeFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Import an MLS alert (CSV / pasted email) as a SOURCE and rank every listing
 * against a saved criteria profile using ONLY objective facts. Returns match
 * reasons (with source chips), tradeoffs, missing facts, and verify questions.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, scoutParseSchema);

    const profile = db
      .select()
      .from(buyerCriteriaProfiles)
      .where(eq(buyerCriteriaProfiles.id, input.criteriaProfileId))
      .get();
    if (!profile) throw new AppError("not_found", "Buyer criteria profile not found.");

    // Guard: refuse to rank if the stored criteria contain disallowed language.
    const fh = assessCriteria({
      ceilingText: profile.ceilingText,
      hardConstraints: profile.hardConstraints,
      weightedPrefs: profile.weightedPrefs,
      areas: profile.areas,
      mustHaves: profile.mustHaves,
    });
    if (!fh.allowed) {
      throw new AppError(
        "fair_housing_violation",
        "This search's criteria contain disallowed language and cannot be used to rank listings.",
        { violations: fh.violations },
      );
    }

    // Parse the import into listing rows.
    let listings: MappedListing[];
    if (input.source === "csv") {
      const result = importMlsCsv(input.content);
      if (result.status === "invalid") {
        throw new AppError("unprocessable", result.issues.join(" "), { issues: result.issues });
      }
      listings = result.listings;
    } else {
      listings = extractListingsFromEmail(input.content);
    }

    if (listings.length === 0) {
      throw new AppError("unprocessable", "No listings could be read from the import.");
    }

    // Validate: reject if too many rows are missing required facts (unreliable).
    const invalid = listings.filter((l) => l.missing.length > 0);
    if (invalid.length > 0 && invalid.length >= Math.ceil(listings.length / 2)) {
      throw new AppError(
        "unprocessable",
        `${invalid.length} of ${listings.length} rows are missing a required value (address/price), so ranking would be unreliable. Fix the export and re-import — nothing was saved.`,
      );
    }

    // Immutable source record for the import.
    const buf = Buffer.from(input.content, "utf8");
    const stored = storeFile("sources", input.filename ?? `alert.${input.source}.txt`, buf);
    const sourceDoc = db
      .insert(sourceDocuments)
      .values({
        kind: input.source === "csv" ? "mls_csv" : "email_text",
        filename: stored.filename,
        mimeType: input.source === "csv" ? "text/csv" : "text/plain",
        sha256: stored.sha256,
        byteSize: stored.byteSize,
        storedPath: stored.storedPath,
        meta: { criteriaProfileId: profile.id, listingCount: listings.length },
      })
      .returning()
      .get();

    const listingImport = db
      .insert(listingImports)
      .values({
        sourceDocumentId: sourceDoc.id,
        rowCount: listings.length,
        validRows: listings.length - invalid.length,
        status: invalid.length ? "partial" : "parsed",
        issues: invalid.map((l) => `Row ${l.rowIndex + 1} missing: ${l.missing.join(", ")}`),
      })
      .returning()
      .get();

    const criteria = buildScoringCriteria({
      ceilingAmount: profile.ceilingAmount,
      ceilingHard: profile.ceilingHard,
      hardConstraints: profile.hardConstraints ?? [],
      weightedPrefs: profile.weightedPrefs ?? [],
      areas: profile.areas ?? [],
      mustHaves: profile.mustHaves ?? [],
    });

    // Score valid rows, persist a property + a buyer match for each.
    const ranked = [];
    for (const listing of listings) {
      if (listing.missing.length > 0) continue;
      const facts = toScoringFacts(listing.fields, listing.sourceMeta);
      const result = scoreListing(criteria, facts);

      const property = db
        .insert(properties)
        .values({
          address: listing.fields.address!,
          mlsNumber: listing.fields.mlsNumber ?? null,
          price: listing.fields.price ?? null,
          beds: facts.beds ?? null,
          baths: facts.baths ?? null,
          sqft: listing.fields.sqft ?? null,
          status: "alert_import",
          sourceMeta: { ...listing.sourceMeta, source: "mls_alert" },
        })
        .returning()
        .get();

      const match = db
        .insert(buyerMatches)
        .values({
          criteriaProfileId: profile.id,
          propertyId: property.id,
          listingImportId: listingImport.id,
          address: property.address,
          score: result.score,
          overCeiling: result.overCeiling,
          reasons: result.reasons,
          tradeoffs: result.tradeoffs,
          missingFacts: result.missingFacts,
          verifyQuestions: result.verifyQuestions,
        })
        .returning()
        .get();
      ranked.push(match);
    }

    ranked.sort((a, b) => b.score - a.score);

    writeAudit({
      action: "buyer_scout.parse_rank",
      entityType: "listing_import",
      entityId: listingImport.id,
      metadata: {
        criteriaProfileId: profile.id,
        source: input.source,
        listingCount: listings.length,
        ranked: ranked.length,
      },
    });

    return ok({
      importId: listingImport.id,
      sourceDocumentId: sourceDoc.id,
      status: listingImport.status,
      matchCount: ranked.length,
      matches: ranked,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
