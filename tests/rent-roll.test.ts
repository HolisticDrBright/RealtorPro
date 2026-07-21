import { describe, it, expect } from "vitest";
import {
  detectRentRollMapping,
  normalizeUnit,
  validateRentRoll,
  parseLeaseDate,
  summarizeRentRoll,
  type NormalizedUnit,
} from "@/lib/rent-roll";
import { parseCsv } from "@/lib/csv-mapping";

const CSV = `Unit,Tenant,SqFt,Lease End,Monthly Rent,Annual Rent,Status
C-101,Blue Fin Coffee,1450,03/2028,4350,52200,Current
C-102,Vacant,1180,,,,Vacant
204,Residential 1BR,685,MTM,1595,19140,MTM
207,,702,01/2027,1675,20100,Current
C-101,Duplicate Co,900,bad-date,9999,10000,Current`;

function normalizeCsv(csv: string): NormalizedUnit[] {
  const { headers, rows } = parseCsv(csv);
  const mapping = detectRentRollMapping(headers);
  return rows.map((r) => normalizeUnit(r, mapping));
}

describe("rent-roll mapping + normalization", () => {
  it("detects rent-roll columns via aliases", () => {
    const mapping = detectRentRollMapping(["Unit", "Tenant", "SqFt", "Lease End", "Monthly Rent"]);
    expect(mapping.unit).toBe("Unit");
    expect(mapping.sf).toBe("SqFt");
    expect(mapping.leaseEnd).toBe("Lease End");
    expect(mapping.monthlyRent).toBe("Monthly Rent");
  });

  it("keeps source value and marks derived annual rent for review", () => {
    const { headers, rows } = parseCsv("Unit,Monthly Rent\nA,1000");
    const mapping = detectRentRollMapping(headers);
    const u = normalizeUnit(rows[0], mapping);
    expect(u.monthlyRent).toBe(1000);
    expect(u.annualRent).toBe(12000); // derived
    expect(u.needsReview).toBe(true); // must be confirmed
    expect(u.source.monthlyRent).toBe("1000");
  });

  it("parses lease dates and flags invalid ones", () => {
    expect(parseLeaseDate("03/2028").kind).toBe("date");
    expect(parseLeaseDate("MTM").kind).toBe("mtm");
    expect(parseLeaseDate("").kind).toBe("none");
    expect(parseLeaseDate("bad-date").kind).toBe("invalid");
  });
});

describe("rent-roll validation", () => {
  const units = normalizeCsv(CSV);
  const findings = validateRentRoll(units);
  const codes = findings.map((f) => f.code);

  it("flags duplicate unit ids", () => {
    expect(codes).toContain("duplicate_unit");
  });
  it("flags an invalid lease date", () => {
    expect(codes).toContain("invalid_lease_date");
  });
  it("flags occupancy/rent mismatch (current but no rent; vacant-with-rent)", () => {
    const currentNoRent = normalizeCsv("Unit,Status,Monthly Rent\nA,Current,");
    expect(validateRentRoll(currentNoRent).map((f) => f.code)).toContain("occupancy_mismatch");
    const vacantWithRent = normalizeCsv("Unit,Status,Monthly Rent\nB,Vacant,1200");
    expect(validateRentRoll(vacantWithRent).map((f) => f.code)).toContain("occupancy_mismatch");
  });
  it("flags a missing tenant on an occupied unit", () => {
    expect(codes).toContain("missing_tenant");
  });
  it("flags inconsistent monthly vs annual totals", () => {
    const bad = normalizeCsv("Unit,Monthly Rent,Annual Rent\nA,1000,50000");
    expect(validateRentRoll(bad).map((f) => f.code)).toContain("inconsistent_totals");
  });

  it("summarizes occupancy without inventing values", () => {
    const s = summarizeRentRoll(units);
    expect(s.total).toBe(units.length);
    expect(s.vacant).toBeGreaterThanOrEqual(1);
  });
});
