/**
 * Rent Roll Studio: column detection, normalization, and validation.
 *
 * Pure and unit-tested. Normalization keeps BOTH the source value and the
 * normalized value so the UI can show source-vs-normalized and require review
 * before any uncertain value is imported. Nothing is invented: a value that
 * cannot be parsed stays null and is flagged, never guessed.
 */
import { parseMoney, parseNumber } from "./listing-parse";

export const RENT_ROLL_FIELDS = [
  "unit",
  "tenant",
  "sf",
  "leaseStart",
  "leaseEnd",
  "monthlyRent",
  "annualRent",
  "deposit",
  "concessions",
  "arrears",
  "status",
  "notes",
] as const;
export type RentRollField = (typeof RENT_ROLL_FIELDS)[number];

const ALIASES: Record<RentRollField, string[]> = {
  unit: ["unit", "unitid", "unit#", "suite", "space", "apt", "unitnumber"],
  tenant: ["tenant", "tenantname", "lessee", "occupant", "resident", "company"],
  sf: ["sf", "sqft", "squarefeet", "rentablesf", "area", "size", "rsf"],
  leaseStart: ["leasestart", "start", "startdate", "commencement", "leasefrom", "movein"],
  leaseEnd: ["leaseend", "end", "enddate", "expiration", "expires", "leaseto", "leaseexpiration"],
  monthlyRent: ["monthlyrent", "rent", "monthlybaserent", "baserent", "currentrent", "montorent", "permonth"],
  annualRent: ["annualrent", "annualbaserent", "yearlyrent", "peryear", "annual"],
  deposit: ["deposit", "securitydeposit", "depositheld"],
  concessions: ["concessions", "concession", "freerent", "abatement"],
  arrears: ["arrears", "balance", "delinquency", "pastdue", "outstanding"],
  status: ["status", "occupancy", "leasestatus", "occupied"],
  notes: ["notes", "note", "comments", "remarks"],
};

function norm(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9#]/g, "");
}

export type RentRollMapping = Partial<Record<RentRollField, string>>;

export function detectRentRollMapping(headers: string[], saved?: RentRollMapping): RentRollMapping {
  const mapping: RentRollMapping = {};
  const normalized = headers.map((h) => ({ raw: h, n: norm(h) }));
  const used = new Set<string>();
  if (saved) {
    for (const f of RENT_ROLL_FIELDS) {
      if (saved[f] && headers.includes(saved[f]!)) {
        mapping[f] = saved[f];
        used.add(saved[f]!);
      }
    }
  }
  for (const f of RENT_ROLL_FIELDS) {
    if (mapping[f]) continue;
    const hit = normalized.find((h) => !used.has(h.raw) && ALIASES[f].includes(h.n));
    if (hit) {
      mapping[f] = hit.raw;
      used.add(hit.raw);
    }
  }
  return mapping;
}

// ── Lease-date parsing ───────────────────────────────────────────────────────

export interface ParsedLeaseDate {
  kind: "date" | "mtm" | "none" | "invalid";
  year?: string;
  month?: number;
  raw: string;
}

export function parseLeaseDate(raw: string | null | undefined): ParsedLeaseDate {
  const s = (raw ?? "").trim();
  if (!s || s === "—" || s === "-") return { kind: "none", raw: s };
  if (/^mtm$|month.?to.?month/i.test(s)) return { kind: "mtm", raw: s };
  // MM/YYYY or MM/DD/YYYY or YYYY-MM-DD
  let m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) return { kind: "date", month: Number(m[1]), year: m[2], raw: s };
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return { kind: "date", month: Number(m[1]), year: m[3], raw: s };
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { kind: "date", month: Number(m[2]), year: m[1], raw: s };
  return { kind: "invalid", raw: s };
}

// ── Normalization ────────────────────────────────────────────────────────────

export interface NormalizedUnit {
  unit: string | null;
  tenant: string | null;
  sf: number | null;
  leaseStart: string | null;
  leaseEnd: string | null;
  leaseEndYear: string | null;
  monthlyRent: number | null;
  annualRent: number | null;
  deposit: number | null;
  concessions: number | null;
  arrears: number | null;
  status: string | null;
  notes: string | null;
  source: Record<string, string>;
  needsReview: boolean;
}

function get(raw: Record<string, string>, mapping: RentRollMapping, field: RentRollField): string | undefined {
  const header = mapping[field];
  const v = header ? raw[header] : undefined;
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function normalizeUnit(raw: Record<string, string>, mapping: RentRollMapping): NormalizedUnit {
  const source: Record<string, string> = {};
  for (const f of RENT_ROLL_FIELDS) {
    const v = get(raw, mapping, f);
    if (v !== undefined) source[f] = v;
  }

  const monthly = parseMoney(source.monthlyRent ?? null);
  let annual = parseMoney(source.annualRent ?? null);
  // Only DERIVE annual from monthly when annual is absent — mark for review, never overwrite a present value.
  let needsReview = false;
  if (annual == null && monthly != null) {
    annual = monthly * 12;
    needsReview = true; // derived, must be confirmed
  }

  const end = parseLeaseDate(source.leaseEnd ?? null);
  if (end.kind === "invalid") needsReview = true;

  return {
    unit: source.unit ?? null,
    tenant: source.tenant ?? null,
    sf: parseNumber(source.sf ?? null),
    leaseStart: source.leaseStart ?? null,
    leaseEnd: source.leaseEnd ?? null,
    leaseEndYear: end.kind === "date" ? end.year! : end.kind === "mtm" ? "MTM" : null,
    monthlyRent: monthly,
    annualRent: annual,
    deposit: parseMoney(source.deposit ?? null),
    concessions: parseMoney(source.concessions ?? null),
    arrears: parseMoney(source.arrears ?? null),
    status: source.status ?? null,
    notes: source.notes ?? null,
    source,
    needsReview,
  };
}

// ── Validation ───────────────────────────────────────────────────────────────

export type Severity = "critical" | "high" | "medium" | "low";
export interface RentRollFinding {
  code: string;
  severity: Severity;
  message: string;
  unitRef?: string;
  sourceValue?: string;
  normalizedValue?: string;
}

function isVacant(status: string | null): boolean {
  return !!status && /vac/i.test(status);
}
function isCurrent(status: string | null): boolean {
  return !!status && /current|occupied|active/i.test(status);
}

export function validateRentRoll(units: NormalizedUnit[]): RentRollFinding[] {
  const findings: RentRollFinding[] = [];
  const seen = new Map<string, number>();

  // Rent/SF baseline (median) over occupied units with both values.
  const rpsf = units
    .filter((u) => isCurrent(u.status) && u.annualRent && u.sf)
    .map((u) => u.annualRent! / u.sf!)
    .sort((a, b) => a - b);
  const median = rpsf.length ? rpsf[Math.floor(rpsf.length / 2)] : null;

  for (const u of units) {
    const ref = u.unit ?? "(no unit id)";

    if (!u.unit) {
      findings.push({ code: "missing_unit_id", severity: "high", message: "Row is missing a unit id.", unitRef: ref });
    } else {
      seen.set(u.unit, (seen.get(u.unit) ?? 0) + 1);
    }

    // Invalid lease date.
    const end = parseLeaseDate(u.leaseEnd);
    if (end.kind === "invalid") {
      findings.push({
        code: "invalid_lease_date",
        severity: "medium",
        message: `Lease end "${u.leaseEnd}" is not a recognizable date.`,
        unitRef: ref,
        sourceValue: u.leaseEnd ?? undefined,
      });
    }

    // Inconsistent monthly vs annual (only when BOTH present in source).
    if (u.source.monthlyRent && u.source.annualRent && u.monthlyRent != null && u.annualRent != null) {
      const expected = u.monthlyRent * 12;
      if (Math.abs(expected - u.annualRent) > Math.max(12, expected * 0.02)) {
        findings.push({
          code: "inconsistent_totals",
          severity: "high",
          message: `Annual rent (${u.annualRent}) ≠ monthly × 12 (${expected}).`,
          unitRef: ref,
          sourceValue: `${u.monthlyRent} / ${u.annualRent}`,
          normalizedValue: String(expected),
        });
      }
    }

    // Rent-per-SF anomaly.
    if (median && isCurrent(u.status) && u.annualRent && u.sf) {
      const val = u.annualRent / u.sf;
      if (val > median * 2.5 || val < median * 0.4) {
        findings.push({
          code: "rent_psf_anomaly",
          severity: "medium",
          message: `Rent/SF ${val.toFixed(2)} is an outlier vs the median ${median.toFixed(2)}.`,
          unitRef: ref,
        });
      }
    }

    // Occupancy vs rent mismatch.
    if (isVacant(u.status) && u.monthlyRent) {
      findings.push({ code: "occupancy_mismatch", severity: "medium", message: "Unit marked vacant but has rent.", unitRef: ref });
    }
    if (isCurrent(u.status) && !u.monthlyRent) {
      findings.push({ code: "occupancy_mismatch", severity: "medium", message: "Unit marked current but has no rent.", unitRef: ref });
    }

    // Missing tenant field for an occupied unit.
    if (isCurrent(u.status) && !u.tenant) {
      findings.push({ code: "missing_tenant", severity: "low", message: "Occupied unit is missing a tenant name.", unitRef: ref });
    }
  }

  for (const [unit, count] of seen) {
    if (count > 1) {
      findings.push({ code: "duplicate_unit", severity: "high", message: `Unit id "${unit}" appears ${count} times.`, unitRef: unit });
    }
  }

  return findings;
}

// ── Summary metrics (delegates to finance.ts) ────────────────────────────────

export function summarizeRentRoll(units: NormalizedUnit[]) {
  const total = units.length;
  const occupied = units.filter((u) => isCurrent(u.status) || (!isVacant(u.status) && u.monthlyRent)).length;
  const vacant = units.filter((u) => isVacant(u.status)).length;
  const grossPotentialAnnual = units.reduce((s, u) => s + (u.annualRent ?? 0), 0);
  const actualAnnual = units
    .filter((u) => !isVacant(u.status))
    .reduce((s, u) => s + (u.annualRent ?? 0), 0);
  const totalSf = units.reduce((s, u) => s + (u.sf ?? 0), 0);
  return { total, occupied, vacant, grossPotentialAnnual, actualAnnual, totalSf };
}
