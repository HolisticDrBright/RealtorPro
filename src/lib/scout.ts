/**
 * Buyer Scout helpers: turn imported listing data (CSV rows or a pasted MLS
 * alert email) into scoring facts. Pure and dependency-light.
 *
 * These extractors only capture values that are explicitly present. Anything
 * absent stays absent — the scorer then reports it as a missing fact rather than
 * guessing (no inference of listing facts, ever).
 */
import type { CanonicalField, MappedListing } from "./csv-mapping";
import { parseMoney, parseNumber } from "./listing-parse";
import type { ScoringFacts } from "./match-scoring";

/** Build ScoringFacts from a mapped CSV listing row. */
export function toScoringFacts(
  fields: Partial<Record<CanonicalField, string>>,
  sourceMeta: Record<string, string> = {},
): ScoringFacts {
  const featureParts: string[] = [];
  for (const key of ["features", "propertyType"] as CanonicalField[]) {
    if (fields[key]) featureParts.push(fields[key]!);
  }
  // Carry any extra headers that look feature-ish into the feature haystack.
  for (const [k, v] of Object.entries(sourceMeta)) {
    if (/feature|parking|laundry|view|amenit|garage|lot/i.test(k)) featureParts.push(`${k}: ${v}`);
  }

  // Look for an HOA fee in extra columns.
  let hoa: number | null = null;
  for (const [k, v] of Object.entries(sourceMeta)) {
    if (/hoa|associationfee/i.test(k)) {
      hoa = parseMoney(v);
      break;
    }
  }

  const sources: ScoringFacts["sources"] = {};
  if (fields.price) sources.price = "CSV: price";
  if (fields.beds) sources.beds = "CSV: beds";
  if (fields.baths) sources.baths = "CSV: baths";
  if (hoa != null) sources.hoa = "CSV: HOA";

  return {
    price: parseMoney(fields.price ?? null),
    beds: parseNumber(fields.beds ?? null),
    baths: parseNumber(fields.baths ?? null),
    sqft: parseNumber(fields.sqft ?? null),
    lotSqft: parseNumber(fields.lot ?? null),
    hoaMonthly: hoa,
    area: sourceMeta["Subdivision"] ?? sourceMeta["Area"] ?? null,
    features: featureParts,
    remarks: fields.remarks ?? null,
    sources,
  };
}

/**
 * Extract listings from a pasted MLS alert email (best effort, deterministic).
 * Each detected block yields a MappedListing-shaped record; a block with no
 * price is reported as missing `price` (required) so ranking is not attempted.
 */
export function extractListingsFromEmail(text: string): MappedListing[] {
  // Split into blocks on blank lines or "MLS #"/"MLS#" markers.
  const blocks = text
    .split(/\n\s*\n|(?=MLS\s*#)/i)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  const listings: MappedListing[] = [];
  blocks.forEach((block, rowIndex) => {
    const fields: Partial<Record<CanonicalField, string>> = {};
    const addr = block.match(
      /\d{1,6}\s+[NSEW]{0,2}\s*[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+)*\s+(?:St|Street|Ave|Avenue|Blvd|Rd|Road|Dr|Drive|Ln|Lane|Ct|Way|Pkwy|Pl|Ter)\b(?:\s+#?\s*\d+[A-Za-z]?)?/i,
    );
    if (addr) fields.address = addr[0].trim();
    // The alert block itself is an explicit, citable source of remarks/features,
    // so preference keywords can be evidenced against it (never inferred).
    fields.remarks = block.replace(/\s+/g, " ").trim();
    const price = block.match(/\$\s?[\d,]+(?:\.\d+)?/);
    if (price) fields.price = price[0].trim();
    const beds = block.match(/(\d+(?:\.\d+)?)\s*(?:bd|bed|beds|bedrooms?)\b/i);
    if (beds) fields.beds = beds[1];
    const baths = block.match(/(\d+(?:\.\d+)?)\s*(?:ba|bath|baths|bathrooms?)\b/i);
    if (baths) fields.baths = baths[1];
    const sqft = block.match(/([\d,]+)\s*(?:sq\s?\.?\s?ft|sqft|square feet)\b/i);
    if (sqft) fields.sqft = sqft[1];
    const mls = block.match(/MLS\s*#?\s*([A-Za-z0-9-]+)/i);
    if (mls) fields.mlsNumber = mls[1];

    const missing: CanonicalField[] = [];
    if (!fields.address) missing.push("address");
    if (!fields.price) missing.push("price");

    // Only keep blocks that at least look like a listing (address or price).
    if (fields.address || fields.price) {
      listings.push({ fields, sourceMeta: {}, missing, rowIndex });
    }
  });
  return listings;
}
