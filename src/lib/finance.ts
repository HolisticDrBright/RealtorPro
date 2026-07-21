/**
 * Source-grounded financial calculations for OM Studio and Rent Roll Studio.
 *
 * Every function returns a `DerivedResult` that carries the FORMULA and the
 * inputs it used, and computes a value ONLY when all required inputs exist.
 * A missing input yields `status: "pending"` and `value: null` (display "—") —
 * never a fabricated number. Callers store `formula` + `sourceFactIds` with the
 * result so any figure can be re-traced and recomputed.
 *
 * Pure and unit-tested.
 */

export type MetricStatus = "calculated" | "pending" | "tbd";

export interface DerivedResult {
  metric: string;
  value: number | null;
  display: string;
  unit?: string;
  formula: string;
  inputs: Record<string, number | null | undefined>;
  missing: string[];
  status: MetricStatus;
}

function present(v: number | null | undefined): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * Core helper: given named inputs and a compute function, return a pending
 * result if any input is missing, otherwise the calculated value.
 */
function derive(
  metric: string,
  formula: string,
  inputs: Record<string, number | null | undefined>,
  compute: (i: Record<string, number>) => number,
  format: (n: number) => string,
  unit?: string,
): DerivedResult {
  const missing = Object.entries(inputs)
    .filter(([, v]) => !present(v))
    .map(([k]) => k);
  if (missing.length > 0) {
    return { metric, value: null, display: "—", unit, formula, inputs, missing, status: "pending" };
  }
  const known = inputs as Record<string, number>;
  const value = compute(known);
  if (!Number.isFinite(value)) {
    return { metric, value: null, display: "—", unit, formula, inputs, missing: ["division_by_zero"], status: "pending" };
  }
  return { metric, value, display: format(value), unit, formula, inputs, missing: [], status: "calculated" };
}

// ── Formatters ───────────────────────────────────────────────────────────────
export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
export const money2 = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const pct = (n: number) => n.toFixed(2) + "%";

// ── Metrics ──────────────────────────────────────────────────────────────────

/** Physical occupancy = occupied units ÷ total units. */
export function occupancy(occupiedUnits?: number | null, totalUnits?: number | null): DerivedResult {
  return derive(
    "occupancy",
    "occupied_units ÷ total_units × 100",
    { occupiedUnits, totalUnits },
    (i) => (i.totalUnits === 0 ? NaN : (i.occupiedUnits / i.totalUnits) * 100),
    pct,
    "%",
  );
}

/** Economic occupancy = actual collected rent ÷ gross potential rent. */
export function economicOccupancy(actualRent?: number | null, grossPotentialRent?: number | null): DerivedResult {
  return derive(
    "economic_occupancy",
    "actual_rent ÷ gross_potential_rent × 100",
    { actualRent, grossPotentialRent },
    (i) => (i.grossPotentialRent === 0 ? NaN : (i.actualRent / i.grossPotentialRent) * 100),
    pct,
    "%",
  );
}

/** Annualized base rent from a monthly figure. */
export function annualizedRent(monthlyRent?: number | null): DerivedResult {
  return derive(
    "annualized_rent",
    "monthly_rent × 12",
    { monthlyRent },
    (i) => i.monthlyRent * 12,
    money,
    "USD",
  );
}

/** Vacancy loss = gross potential rent − actual rent. */
export function vacancyLoss(grossPotentialRent?: number | null, actualRent?: number | null): DerivedResult {
  return derive(
    "vacancy_loss",
    "gross_potential_rent − actual_rent",
    { grossPotentialRent, actualRent },
    (i) => i.grossPotentialRent - i.actualRent,
    money,
    "USD",
  );
}

/** Net Operating Income = Effective Gross Income − Operating Expenses. */
export function noi(effectiveGrossIncome?: number | null, operatingExpenses?: number | null): DerivedResult {
  return derive(
    "noi",
    "effective_gross_income − operating_expenses",
    { effectiveGrossIncome, operatingExpenses },
    (i) => i.effectiveGrossIncome - i.operatingExpenses,
    money,
    "USD",
  );
}

/** Cap rate = NOI ÷ price. */
export function capRate(noiValue?: number | null, price?: number | null): DerivedResult {
  return derive(
    "cap_rate",
    "NOI ÷ price × 100",
    { noi: noiValue, price },
    (i) => (i.price === 0 ? NaN : (i.noi / i.price) * 100),
    pct,
    "%",
  );
}

/** Price per unit = price ÷ units. */
export function pricePerUnit(price?: number | null, units?: number | null): DerivedResult {
  return derive(
    "price_per_unit",
    "price ÷ units",
    { price, units },
    (i) => (i.units === 0 ? NaN : i.price / i.units),
    money,
    "USD",
  );
}

/** Price per SF = price ÷ rentable square feet. */
export function pricePerSf(price?: number | null, rentableSf?: number | null): DerivedResult {
  return derive(
    "price_per_sf",
    "price ÷ rentable_sf",
    { price, rentableSf },
    (i) => (i.rentableSf === 0 ? NaN : i.price / i.rentableSf),
    (n) => money(n) + "/SF",
    "USD/SF",
  );
}

/** Rent per SF (annualized) = annual rent ÷ square feet. */
export function rentPerSf(annualRent?: number | null, sf?: number | null): DerivedResult {
  return derive(
    "rent_per_sf",
    "annual_rent ÷ sf",
    { annualRent, sf },
    (i) => (i.sf === 0 ? NaN : i.annualRent / i.sf),
    (n) => money2(n) + "/SF",
    "USD/SF",
  );
}

export interface LeaseTermInput {
  sf?: number | null;
  monthsRemaining?: number | null;
}

/**
 * Weighted Average Lease Term (WALT) by square footage, in years.
 * Returns pending if any lease is missing SF or months-remaining.
 */
export function walt(leases: LeaseTermInput[]): DerivedResult {
  const inputs: Record<string, number | null | undefined> = { leaseCount: leases.length };
  const missing: string[] = [];
  let weightedMonths = 0;
  let totalSf = 0;
  leases.forEach((l, idx) => {
    if (!present(l.sf)) missing.push(`lease_${idx}_sf`);
    if (!present(l.monthsRemaining)) missing.push(`lease_${idx}_months`);
    if (present(l.sf) && present(l.monthsRemaining)) {
      weightedMonths += l.sf * l.monthsRemaining;
      totalSf += l.sf;
    }
  });
  if (leases.length === 0 || missing.length > 0 || totalSf === 0) {
    return {
      metric: "walt",
      value: null,
      display: "—",
      unit: "years",
      formula: "Σ(sf × months_remaining) ÷ Σ(sf) ÷ 12",
      inputs,
      missing: leases.length === 0 ? ["no_leases"] : missing,
      status: "pending",
    };
  }
  const years = weightedMonths / totalSf / 12;
  return {
    metric: "walt",
    value: years,
    display: years.toFixed(1) + " yrs",
    unit: "years",
    formula: "Σ(sf × months_remaining) ÷ Σ(sf) ÷ 12",
    inputs,
    missing: [],
    status: "calculated",
  };
}

export interface TenantShare {
  tenant: string;
  annualRent: number;
}

/**
 * Tenant concentration = the largest tenant's share of total annual rent.
 * Returns pending if no rents are known.
 */
export function tenantConcentration(tenants: TenantShare[]): DerivedResult {
  const total = tenants.reduce((s, t) => s + (present(t.annualRent) ? t.annualRent : 0), 0);
  if (tenants.length === 0 || total === 0) {
    return {
      metric: "tenant_concentration",
      value: null,
      display: "—",
      unit: "%",
      formula: "max(tenant_annual_rent) ÷ Σ(annual_rent) × 100",
      inputs: { tenantCount: tenants.length },
      missing: ["annual_rent"],
      status: "pending",
    };
  }
  const top = Math.max(...tenants.map((t) => t.annualRent));
  const share = (top / total) * 100;
  return {
    metric: "tenant_concentration",
    value: share,
    display: pct(share),
    unit: "%",
    formula: "max(tenant_annual_rent) ÷ Σ(annual_rent) × 100",
    inputs: { tenantCount: tenants.length, total },
    missing: [],
    status: "calculated",
  };
}

export interface RolloverBucket {
  year: string;
  sf: number;
  pctOfTotal: number | null;
}

/** Lease rollover schedule by expiration year (% of total SF expiring). */
export function leaseRollover(
  leases: { leaseEndYear: string | null; sf: number | null }[],
): { buckets: RolloverBucket[]; totalSf: number; missing: string[] } {
  const missing: string[] = [];
  let totalSf = 0;
  const byYear = new Map<string, number>();
  leases.forEach((l, idx) => {
    if (!present(l.sf)) {
      missing.push(`lease_${idx}_sf`);
      return;
    }
    totalSf += l.sf;
    const year = l.leaseEndYear ?? "unknown";
    byYear.set(year, (byYear.get(year) ?? 0) + l.sf);
  });
  const buckets: RolloverBucket[] = [...byYear.entries()]
    .map(([year, sf]) => ({ year, sf, pctOfTotal: totalSf > 0 ? (sf / totalSf) * 100 : null }))
    .sort((a, b) => a.year.localeCompare(b.year));
  return { buckets, totalSf, missing };
}
