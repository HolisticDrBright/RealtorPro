/**
 * MLS CSV import: parsing, column-mapping detection, and validation.
 *
 * Pure and dependency-free so it is fully unit-testable. Critically, this module
 * NEVER infers a missing listing fact — a value that is not present in the CSV
 * stays absent and is reported as an issue, not guessed.
 */

/** Canonical listing fields AgentOS understands. */
export const CANONICAL_FIELDS = [
  "address",
  "mlsNumber",
  "price",
  "beds",
  "baths",
  "sqft",
  "lot",
  "propertyType",
  "features",
  "remarks",
  "openHouse",
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

/** Header aliases used for auto-detection (normalised: lowercase, alnum only). */
const ALIASES: Record<CanonicalField, string[]> = {
  address: ["address", "streetaddress", "fulladdress", "propertyaddress", "unparsedaddress"],
  mlsNumber: ["mls", "mls#", "ml#", "mlsnumber", "mlsnum", "listingid", "listnumber"],
  price: ["listprice", "price", "lp", "askingprice", "currentprice"],
  beds: ["beds", "bed", "bedrooms", "bedroomstotal", "br", "totalbedrooms"],
  baths: ["baths", "bath", "bathrooms", "bathroomstotal", "ba", "totalbaths"],
  sqft: ["sqft", "sf", "squarefeet", "livingarea", "livingareasqft", "gla"],
  lot: ["lot", "lotsize", "lotsizesquarefeet", "lotsqft", "lotsizearea", "lotsizeacres"],
  propertyType: ["propertytype", "type", "propertysubtype", "structuretype"],
  features: ["features", "lotfeatures", "interiorfeatures", "exteriorfeatures", "amenities"],
  remarks: ["remarks", "publicremarks", "description", "marketingremarks", "agentremarks"],
  openHouse: ["openhouse", "oh", "openhousedetails", "openhousedate"],
};

/** Fields that must be present for a row to be rankable/usable. */
export const REQUIRED_FIELDS: CanonicalField[] = ["address", "price"];

function normHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9#]/g, "");
}

// ─────────────────────────────────────────────────────────────────────────────
// CSV parsing (RFC-4180-ish: quotes, escaped quotes, embedded newlines)
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, ""); // strip BOM

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      // Skip fully blank lines.
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim() !== "")) rows.push(row);
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows: dataRows };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mapping detection
// ─────────────────────────────────────────────────────────────────────────────

export type ColumnMapping = Partial<Record<CanonicalField, string>>;

export interface MappingDetection {
  mapping: ColumnMapping;
  /** Canonical fields that could not be matched to any header. */
  unmatched: CanonicalField[];
  /** Headers not mapped to any canonical field (carried as source metadata). */
  extraHeaders: string[];
}

/**
 * Detect a column mapping from CSV headers. Exact/alias matches only — no fuzzy
 * guessing that could silently mis-map a fact.
 */
export function detectMapping(
  headers: string[],
  saved?: ColumnMapping,
): MappingDetection {
  const mapping: ColumnMapping = {};
  const normalized = headers.map((h) => ({ raw: h, norm: normHeader(h) }));
  const usedHeaders = new Set<string>();

  // Saved mapping wins when its headers are present.
  if (saved) {
    for (const field of CANONICAL_FIELDS) {
      const savedHeader = saved[field];
      if (savedHeader && headers.includes(savedHeader)) {
        mapping[field] = savedHeader;
        usedHeaders.add(savedHeader);
      }
    }
  }

  for (const field of CANONICAL_FIELDS) {
    if (mapping[field]) continue;
    const aliases = ALIASES[field];
    const hit = normalized.find(
      (h) => !usedHeaders.has(h.raw) && aliases.includes(h.norm),
    );
    if (hit) {
      mapping[field] = hit.raw;
      usedHeaders.add(hit.raw);
    }
  }

  const unmatched = CANONICAL_FIELDS.filter((f) => !mapping[f]);
  const extraHeaders = headers.filter((h) => !usedHeaders.has(h));
  return { mapping, unmatched, extraHeaders };
}

// ─────────────────────────────────────────────────────────────────────────────
// Apply mapping + validate
// ─────────────────────────────────────────────────────────────────────────────

export interface MappedListing {
  fields: Partial<Record<CanonicalField, string>>;
  sourceMeta: Record<string, string>;
  /** Missing required fields for this row. */
  missing: CanonicalField[];
  rowIndex: number;
}

export interface ImportResult {
  detection: MappingDetection;
  listings: MappedListing[];
  issues: string[];
  status: "parsed" | "partial" | "invalid";
  rowCount: number;
  validRows: number;
}

/**
 * Full import pipeline: parse → detect mapping → apply → validate.
 * `savedMapping` lets a previously saved reusable mapping override detection.
 */
export function importMlsCsv(csvText: string, savedMapping?: ColumnMapping): ImportResult {
  const { headers, rows } = parseCsv(csvText);
  if (headers.length === 0) {
    return {
      detection: { mapping: {}, unmatched: [...CANONICAL_FIELDS], extraHeaders: [] },
      listings: [],
      issues: ["The file is empty or has no header row."],
      status: "invalid",
      rowCount: 0,
      validRows: 0,
    };
  }

  const detection = detectMapping(headers, savedMapping);
  const issues: string[] = [];

  // Required canonical fields that no header maps to at all.
  const structurallyMissing = REQUIRED_FIELDS.filter((f) => !detection.mapping[f]);
  if (structurallyMissing.length) {
    issues.push(
      `No column maps to required field(s): ${structurallyMissing.join(", ")}. Map them and re-import.`,
    );
  }

  const listings: MappedListing[] = rows.map((row, rowIndex) => {
    const fields: Partial<Record<CanonicalField, string>> = {};
    for (const field of CANONICAL_FIELDS) {
      const header = detection.mapping[field];
      if (header) {
        const value = row[header];
        if (value && value.trim() !== "") fields[field] = value.trim();
      }
    }
    const sourceMeta: Record<string, string> = {};
    for (const h of detection.extraHeaders) {
      if (row[h] && row[h].trim() !== "") sourceMeta[h] = row[h].trim();
    }
    const missing = REQUIRED_FIELDS.filter((f) => !fields[f]);
    return { fields, sourceMeta, missing, rowIndex };
  });

  const invalidRows = listings.filter((l) => l.missing.length > 0);
  if (invalidRows.length) {
    issues.push(
      `${invalidRows.length} of ${rows.length} row(s) are missing a required value (${REQUIRED_FIELDS.join("/")}) — ranking would be unreliable.`,
    );
  }

  const validRows = listings.length - invalidRows.length;
  let status: ImportResult["status"] = "parsed";
  if (structurallyMissing.length || validRows === 0) status = "invalid";
  else if (invalidRows.length) status = "partial";

  return {
    detection,
    listings,
    issues,
    status,
    rowCount: rows.length,
    validRows,
  };
}
