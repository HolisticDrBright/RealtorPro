/**
 * Source tracing: re-trace any displayed figure to its source document(s) or
 * formula, and recompute derived values. Pure and unit-tested.
 */
import { TBD } from "./disclosures";

export type FigureStatus = "imported" | "calculated" | "pending" | "tbd";

export interface FactRecord {
  id: string;
  field: string;
  value: string | null;
  source: string;
  sourceDocumentId?: string | null;
}

export interface DerivedRecord {
  id: string;
  metric: string;
  value: number | null;
  displayValue?: string | null;
  formula?: string | null;
  sourceFactIds?: string[];
  status: FigureStatus;
}

export interface TraceStep {
  factId: string;
  field: string;
  value: string | null;
  source: string;
  sourceDocumentId?: string | null;
  found: boolean;
}

export interface FigureTrace {
  metric: string;
  status: FigureStatus;
  display: string;
  formula: string | null;
  steps: TraceStep[];
  brokenCitations: string[];
  supported: boolean;
}

/**
 * Trace a derived figure back to the facts it cites. A citation that points to
 * a fact id not present in `facts` is a BROKEN citation. Pending/TBD figures
 * display no number.
 */
export function traceFigure(derived: DerivedRecord, facts: FactRecord[]): FigureTrace {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const steps: TraceStep[] = (derived.sourceFactIds ?? []).map((fid) => {
    const f = byId.get(fid);
    return {
      factId: fid,
      field: f?.field ?? "(unknown)",
      value: f?.value ?? null,
      source: f?.source ?? "(missing source)",
      sourceDocumentId: f?.sourceDocumentId ?? null,
      found: !!f,
    };
  });
  const brokenCitations = steps.filter((s) => !s.found).map((s) => s.factId);

  const display =
    derived.status === "pending" || derived.status === "tbd"
      ? derived.status === "tbd"
        ? TBD
        : "—"
      : (derived.displayValue ?? (derived.value != null ? String(derived.value) : "—"));

  const supported =
    (derived.status === "imported" || derived.status === "calculated") &&
    brokenCitations.length === 0 &&
    steps.length > 0;

  return {
    metric: derived.metric,
    status: derived.status,
    display,
    formula: derived.formula ?? null,
    steps,
    brokenCitations,
    supported,
  };
}

/**
 * Recompute a derived value from its cited facts using a provided compute fn,
 * and compare to the stored value. Returns a mismatch when they disagree.
 */
export function recomputeAndCompare(
  derived: DerivedRecord,
  facts: FactRecord[],
  compute: (values: number[]) => number | null,
  tolerance = 0.5,
): { ok: boolean; recomputed: number | null; stored: number | null; reason?: string } {
  const byId = new Map(facts.map((f) => [f.id, f]));
  const nums: number[] = [];
  for (const fid of derived.sourceFactIds ?? []) {
    const f = byId.get(fid);
    if (!f || f.value == null) {
      return { ok: false, recomputed: null, stored: derived.value, reason: `missing input fact ${fid}` };
    }
    const n = Number(String(f.value).replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(n)) return { ok: false, recomputed: null, stored: derived.value, reason: `non-numeric fact ${fid}` };
    nums.push(n);
  }
  const recomputed = compute(nums);
  if (recomputed == null || derived.value == null) {
    return { ok: recomputed === derived.value, recomputed, stored: derived.value };
  }
  const ok = Math.abs(recomputed - derived.value) <= tolerance;
  return { ok, recomputed, stored: derived.value, reason: ok ? undefined : "recomputed value differs from stored value" };
}
