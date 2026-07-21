/**
 * Buyer Scout match scoring.
 *
 * Produces an EXPLAINABLE fit score from a client's saved criteria and a
 * listing's imported facts — and ONLY those. Every reason cites the source
 * field it came from. The scorer:
 *   - never infers a missing fact (absent → reported as a missing fact / verify
 *     question, never guessed);
 *   - flags over-ceiling listings (excluded from recommendation, score kept);
 *   - surfaces near-misses (tradeoffs) and recorded fact conflicts (verify).
 *
 * It contains NO subjective or demographic input — see fair-housing.ts for the
 * guardrail that keeps such input out of criteria in the first place.
 *
 * Pure and unit-tested.
 */
import { parseMinCount, parseMoney, parseNumber } from "./listing-parse";

export interface ScoringFacts {
  price?: number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: number | null;
  lotSqft?: number | null;
  hoaMonthly?: number | null;
  /** Objective listing area/subdivision name (a field, not a judgment). */
  area?: string | null;
  /** Normalised feature phrases from listing fields (parking, lot, laundry…). */
  features?: string[];
  remarks?: string | null;
  /** Provenance chips per fact key, e.g. { price: "CSV: ListPrice" }. */
  sources?: Partial<Record<string, string>>;
  /** Recorded ledger conflicts to surface as verification questions. */
  conflicts?: { field: string; note: string }[];
}

export type HardConstraintKind =
  | "minBeds"
  | "minBaths"
  | "maxHoa"
  | "minLot"
  | "feature";

export interface HardConstraint {
  label: string;
  kind: HardConstraintKind;
  value?: number;
  keywords?: string[];
  /** Fact key used for the source citation, e.g. "beds". */
  factKey?: string;
}

export interface ScoringPref {
  label: string;
  weight: number; // 0..100
  keywords?: string[];
  factKey?: string;
}

export interface ScoringCriteria {
  ceilingAmount?: number | null;
  ceilingHard?: boolean;
  hardConstraints: HardConstraint[];
  weightedPrefs: ScoringPref[];
  areas?: string[];
  mustHaves?: ScoringPref[];
}

export interface Reason {
  text: string;
  source: string;
}

export interface MatchResult {
  score: number;
  overCeiling: boolean;
  /** True when a hard rule fails (over hard ceiling, hard numeric constraint). */
  excluded: boolean;
  reasons: Reason[];
  tradeoffs: string[];
  missingFacts: string[];
  verifyQuestions: string[];
}

const money = (n: number) =>
  "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function haystack(facts: ScoringFacts): string {
  return [facts.area ?? "", facts.remarks ?? "", ...(facts.features ?? [])]
    .join(" • ")
    .toLowerCase();
}

function keywordsHit(hay: string, keywords: string[] | undefined): boolean {
  if (!keywords || keywords.length === 0) return false;
  return keywords.some((k) => hay.includes(k.toLowerCase()));
}

function src(facts: ScoringFacts, key: string | undefined, fallback: string): string {
  return (key && facts.sources?.[key]) || fallback;
}

/** Core scorer — pure. */
export function scoreListing(criteria: ScoringCriteria, facts: ScoringFacts): MatchResult {
  const reasons: Reason[] = [];
  const tradeoffs: string[] = [];
  const missingFacts: string[] = [];
  const verifyQuestions: string[] = [];
  let overCeiling = false;
  let excluded = false;

  const hay = haystack(facts);

  // ── Price ceiling ──────────────────────────────────────────────────────────
  if (criteria.ceilingAmount != null) {
    if (facts.price == null) {
      missingFacts.push("List price is missing — cannot check it against the ceiling.");
    } else if (facts.price <= criteria.ceilingAmount) {
      const delta = criteria.ceilingAmount - facts.price;
      reasons.push({
        text: `List ${money(facts.price)} — ${money(delta)} under the ${money(criteria.ceilingAmount)} ceiling`,
        source: src(facts, "price", "listing price"),
      });
    } else {
      overCeiling = true;
      const delta = facts.price - criteria.ceilingAmount;
      tradeoffs.push(
        `${money(delta)} over the ${criteria.ceilingHard ? "hard " : ""}ceiling${criteria.ceilingHard ? " — excluded from recommendations unless the ceiling changes" : ""}`,
      );
      if (criteria.ceilingHard) excluded = true;
    }
  }

  // ── Hard constraints ────────────────────────────────────────────────────────
  for (const hc of criteria.hardConstraints) {
    switch (hc.kind) {
      case "minBeds":
      case "minBaths":
      case "minLot": {
        const factVal =
          hc.kind === "minBeds" ? facts.beds : hc.kind === "minBaths" ? facts.baths : facts.lotSqft;
        const noun = hc.kind === "minBeds" ? "bedrooms" : hc.kind === "minBaths" ? "bathrooms" : "lot size";
        if (factVal == null) {
          missingFacts.push(`${noun} not stated — cannot confirm "${hc.label}".`);
        } else if (hc.value != null && factVal >= hc.value) {
          reasons.push({ text: `Meets ${hc.label} (${factVal})`, source: src(facts, hc.factKey ?? hc.kind, "listing facts") });
        } else {
          tradeoffs.push(`Below hard constraint "${hc.label}" (${factVal})`);
          excluded = true;
        }
        break;
      }
      case "maxHoa": {
        if (facts.hoaMonthly == null) {
          missingFacts.push(`HOA fee not stated — cannot confirm "${hc.label}".`);
        } else if (hc.value != null && facts.hoaMonthly <= hc.value) {
          reasons.push({ text: `HOA ${money(facts.hoaMonthly)}/mo — under the ${money(hc.value)} max`, source: src(facts, "hoa", "listing facts") });
        } else {
          tradeoffs.push(`HOA ${money(facts.hoaMonthly)}/mo exceeds the ${money(hc.value ?? 0)} max — hard constraint conflict`);
          excluded = true;
        }
        break;
      }
      case "feature": {
        if (keywordsHit(hay, hc.keywords)) {
          reasons.push({ text: `Satisfies ${hc.label}`, source: src(facts, hc.factKey, "listing facts") });
        } else {
          // Absence isn't provable from the feature list — verify, don't fail.
          verifyQuestions.push(`Confirm required "${hc.label}" — not found in the imported listing facts.`);
        }
        break;
      }
    }
  }

  // ── Must-have features ──────────────────────────────────────────────────────
  let mustHavePenalty = 1;
  for (const mh of criteria.mustHaves ?? []) {
    if (keywordsHit(hay, mh.keywords)) {
      reasons.push({ text: `Covers must-have: ${mh.label}`, source: src(facts, mh.factKey, "listing facts") });
    } else {
      verifyQuestions.push(`Must-have "${mh.label}" not confirmed in imported facts — verify with the listing agent.`);
      mustHavePenalty *= 0.75;
    }
  }

  // ── Weighted preferences ────────────────────────────────────────────────────
  const totalWeight = criteria.weightedPrefs.reduce((s, p) => s + p.weight, 0);
  let gained = 0;
  for (const pref of criteria.weightedPrefs) {
    if (keywordsHit(hay, pref.keywords)) {
      gained += pref.weight;
      reasons.push({ text: `${pref.label} (weighted ${pref.weight})`, source: src(facts, pref.factKey, "listing facts") });
    } else {
      tradeoffs.push(`${pref.label} not evidenced in listing facts (weight ${pref.weight})`);
    }
  }
  const prefScore = totalWeight > 0 ? gained / totalWeight : 1;

  // ── Fact conflicts → verification ───────────────────────────────────────────
  for (const c of facts.conflicts ?? []) {
    verifyQuestions.push(`${c.field}: ${c.note}`);
  }

  let score = Math.round(prefScore * 100 * mustHavePenalty);
  score = Math.max(0, Math.min(100, score));

  return { score, overCeiling, excluded, reasons, tradeoffs, missingFacts, verifyQuestions };
}

// ─────────────────────────────────────────────────────────────────────────────
// Builders: turn stored criteria strings into structured scoring inputs.
// These parse only what is explicitly written; they add no assumptions.
// ─────────────────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  "the", "a", "an", "or", "and", "of", "for", "with", "in", "on", "to", "near",
  "required", "min", "max", "no", "1", "2", "3", "4", "5", "hard",
]);

export function keywordsFromLabel(label: string): string[] {
  const cleaned = label.toLowerCase().replace(/\([^)]*\)/g, " ");
  const words = cleaned.split(/[^a-z0-9]+/).filter((w) => w && !STOPWORDS.has(w));
  // Keep multi-word phrase plus individual salient words.
  const phrase = words.join(" ");
  return Array.from(new Set([phrase, ...words])).filter(Boolean);
}

/** Parse a hard-constraint phrase into a structured constraint. */
export function parseHardConstraint(label: string): HardConstraint {
  const l = label.toLowerCase();
  if (/\bbed/.test(l)) {
    return { label, kind: "minBeds", value: parseMinCount(l) ?? undefined, factKey: "beds" };
  }
  if (/\bbath/.test(l)) {
    return { label, kind: "minBaths", value: parseMinCount(l) ?? undefined, factKey: "baths" };
  }
  if (/hoa/.test(l)) {
    return { label, kind: "maxHoa", value: parseMoney(l) ?? undefined, factKey: "hoa" };
  }
  if (/\blot\b/.test(l)) {
    return { label, kind: "minLot", value: parseNumber(l) ?? undefined, factKey: "lot" };
  }
  return { label, kind: "feature", keywords: keywordsFromLabel(label) };
}

export interface StoredCriteria {
  ceilingAmount?: number | null;
  ceilingHard?: boolean;
  hardConstraints?: string[];
  weightedPrefs?: { label: string; weight: number }[];
  areas?: string[];
  mustHaves?: string[];
}

/** Build a ScoringCriteria from stored (string-based) criteria. */
export function buildScoringCriteria(stored: StoredCriteria): ScoringCriteria {
  return {
    ceilingAmount: stored.ceilingAmount ?? null,
    ceilingHard: stored.ceilingHard ?? true,
    hardConstraints: (stored.hardConstraints ?? []).map(parseHardConstraint),
    weightedPrefs: (stored.weightedPrefs ?? []).map((p) => ({
      label: p.label,
      weight: p.weight,
      keywords: keywordsFromLabel(p.label),
    })),
    areas: stored.areas ?? [],
    mustHaves: (stored.mustHaves ?? []).map((m) => ({
      label: m,
      weight: 100,
      keywords: keywordsFromLabel(m),
    })),
  };
}
