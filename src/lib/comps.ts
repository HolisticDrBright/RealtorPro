/**
 * Comp Lab: normalization, freshness, and a TRANSPARENT comparability score.
 *
 * The score is a weighted blend of objective similarity dimensions the user
 * selects — it is explainable and never an appraisal or valuation conclusion.
 * This module never calls a comp "the best", invents adjustments, or fabricates
 * missing fields. Pure and unit-tested.
 */
import { parseMoney, parseNumber } from "./listing-parse";

export const COMP_FIELDS = [
  "address",
  "assetType",
  "transactionDate",
  "price",
  "size",
  "pricePerSf",
  "pricePerUnit",
  "capRate",
  "daysOnMarket",
  "distanceMi",
  "source",
  "sourceDate",
] as const;
export type CompField = (typeof COMP_FIELDS)[number];

const ALIASES: Record<CompField, string[]> = {
  address: ["address", "propertyaddress", "location", "streetaddress"],
  assetType: ["assettype", "type", "propertytype", "usetype"],
  transactionDate: ["saledate", "closedate", "listdate", "transactiondate", "date"],
  price: ["price", "saleprice", "listprice", "closeprice"],
  size: ["size", "sf", "sqft", "buildingsf", "units", "gla", "rentablesf"],
  pricePerSf: ["pricepersf", "psf", "ppsf", "priceperfoot"],
  pricePerUnit: ["priceperunit", "ppu", "perunit"],
  capRate: ["caprate", "cap", "yield"],
  daysOnMarket: ["daysonmarket", "dom", "days"],
  distanceMi: ["distance", "distancemi", "miles", "proximity"],
  source: ["source", "datasource", "provider"],
  sourceDate: ["sourcedate", "asof", "reporteddate", "dataasof"],
};

const normH = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, "");

export type CompMapping = Partial<Record<CompField, string>>;

export function detectCompMapping(headers: string[]): CompMapping {
  const mapping: CompMapping = {};
  const used = new Set<string>();
  const normalized = headers.map((h) => ({ raw: h, n: normH(h) }));
  for (const f of COMP_FIELDS) {
    const hit = normalized.find((h) => !used.has(h.raw) && ALIASES[f].includes(h.n));
    if (hit) {
      mapping[f] = hit.raw;
      used.add(hit.raw);
    }
  }
  return mapping;
}

export interface NormalizedComp {
  address: string | null;
  assetType: string | null;
  transactionDate: string | null;
  price: number | null;
  size: number | null;
  pricePerSf: number | null;
  pricePerUnit: number | null;
  capRate: number | null;
  daysOnMarket: number | null;
  distanceMi: number | null;
  source: string | null;
  sourceDate: string | null;
  verificationStatus: "verified" | "needs_verification" | "user_entered";
  missingFields: string[];
  source_raw: Record<string, string>;
}

const VERIFIED_SOURCES = /county|deed|assessor|recorder|public.?record/i;

export function normalizeComp(
  raw: Record<string, string>,
  mapping: CompMapping,
  opts: { userEntered?: boolean } = {},
): NormalizedComp {
  const g = (f: CompField): string | undefined => {
    const h = mapping[f];
    const v = h ? raw[h] : undefined;
    return v && v.trim() !== "" ? v.trim() : undefined;
  };
  const source_raw: Record<string, string> = {};
  for (const f of COMP_FIELDS) {
    const v = g(f);
    if (v !== undefined) source_raw[f] = v;
  }

  const price = parseMoney(g("price") ?? null);
  const size = parseNumber(g("size") ?? null);
  let psf = parseMoney(g("pricePerSf") ?? null);
  // Derive $/SF only when both price and size exist and $/SF is absent.
  if (psf == null && price != null && size != null && size > 0) psf = price / size;

  const missingFields: string[] = [];
  for (const f of ["address", "price", "transactionDate", "source"] as CompField[]) {
    if (!g(f)) missingFields.push(f);
  }

  const sourceStr = g("source") ?? null;
  const verificationStatus = opts.userEntered
    ? "user_entered"
    : sourceStr && VERIFIED_SOURCES.test(sourceStr)
      ? "verified"
      : "needs_verification";

  return {
    address: g("address") ?? null,
    assetType: g("assetType") ?? null,
    transactionDate: g("transactionDate") ?? null,
    price,
    size,
    pricePerSf: psf,
    pricePerUnit: parseMoney(g("pricePerUnit") ?? null),
    capRate: parseNumber(g("capRate") ?? null),
    daysOnMarket: parseNumber(g("daysOnMarket") ?? null),
    distanceMi: parseNumber(g("distanceMi") ?? null),
    source: sourceStr,
    sourceDate: g("sourceDate") ?? null,
    verificationStatus,
    missingFields,
    source_raw,
  };
}

/** Freshness label from a source date (relative to a reference date). */
export function freshness(sourceDate: string | null, refYear = 2026): "fresh" | "aging" | "stale" | "unknown" {
  if (!sourceDate) return "unknown";
  const m = sourceDate.match(/(\d{4})/);
  if (!m) return "unknown";
  const age = refYear - Number(m[1]);
  if (age <= 0) return "fresh";
  if (age === 1) return "aging";
  return "stale";
}

export interface CompWeights {
  distance: number;
  recency: number;
  sizeSimilarity: number;
  psfSimilarity: number;
  assetMatch: number;
}

export const DEFAULT_WEIGHTS: CompWeights = {
  distance: 0.3,
  recency: 0.25,
  sizeSimilarity: 0.2,
  psfSimilarity: 0.15,
  assetMatch: 0.1,
};

export interface CompSubject {
  size?: number | null;
  pricePerSf?: number | null;
  assetType?: string | null;
}

export interface CompScore {
  score: number;
  breakdown: Record<keyof CompWeights, number>;
  contributingDimensions: string[];
}

/**
 * Transparent 0–100 comparability score: each dimension yields a 0–1 similarity,
 * blended by the selected weights over the dimensions that have data. This is an
 * explainability aid, NOT a valuation — it never ranks a comp as "best".
 */
export function scoreComp(comp: NormalizedComp, subject: CompSubject, weights: CompWeights = DEFAULT_WEIGHTS): CompScore {
  const dims: Partial<Record<keyof CompWeights, number>> = {};

  if (comp.distanceMi != null) {
    // 0 mi → 1.0, 5+ mi → 0.
    dims.distance = Math.max(0, 1 - comp.distanceMi / 5);
  }
  const fresh = freshness(comp.sourceDate ?? comp.transactionDate);
  if (fresh !== "unknown") {
    dims.recency = fresh === "fresh" ? 1 : fresh === "aging" ? 0.6 : 0.3;
  }
  if (comp.size != null && subject.size != null && subject.size > 0) {
    dims.sizeSimilarity = 1 - Math.min(1, Math.abs(comp.size - subject.size) / subject.size);
  }
  if (comp.pricePerSf != null && subject.pricePerSf != null && subject.pricePerSf > 0) {
    dims.psfSimilarity = 1 - Math.min(1, Math.abs(comp.pricePerSf - subject.pricePerSf) / subject.pricePerSf);
  }
  if (comp.assetType != null && subject.assetType != null) {
    dims.assetMatch = comp.assetType.toLowerCase() === subject.assetType.toLowerCase() ? 1 : 0;
  }

  let totalWeight = 0;
  let weighted = 0;
  const breakdown = {} as Record<keyof CompWeights, number>;
  const contributingDimensions: string[] = [];
  (Object.keys(weights) as (keyof CompWeights)[]).forEach((k) => {
    const sim = dims[k];
    breakdown[k] = sim ?? 0;
    if (sim != null) {
      weighted += sim * weights[k];
      totalWeight += weights[k];
      contributingDimensions.push(k);
    }
  });

  const score = totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) : 0;
  return { score, breakdown, contributingDimensions };
}
