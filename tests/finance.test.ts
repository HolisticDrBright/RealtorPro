import { describe, it, expect } from "vitest";
import {
  occupancy,
  economicOccupancy,
  noi,
  capRate,
  pricePerUnit,
  pricePerSf,
  annualizedRent,
  walt,
  tenantConcentration,
} from "@/lib/finance";

describe("derived financial calculations", () => {
  it("computes occupancy and stores the formula", () => {
    const r = occupancy(19, 21);
    expect(r.status).toBe("calculated");
    expect(r.value).toBeCloseTo((19 / 21) * 100, 5);
    expect(r.formula).toContain("occupied_units");
    expect(r.display).toMatch(/%$/);
  });

  it("computes cap rate = NOI ÷ price", () => {
    const r = capRate(474890, 8450000);
    expect(r.status).toBe("calculated");
    expect(r.value).toBeCloseTo((474890 / 8450000) * 100, 5);
  });

  it("computes price/unit and price/SF", () => {
    expect(pricePerUnit(8450000, 21).display).toBe("$402,381");
    expect(pricePerSf(8450000, 25400).display).toContain("/SF");
  });

  it("annualizes monthly rent", () => {
    expect(annualizedRent(4350).value).toBe(52200);
  });

  it("computes economic occupancy and NOI", () => {
    expect(economicOccupancy(90, 100).value).toBe(90);
    expect(noi(600000, 125110).value).toBe(474890);
  });
});

describe("missing-source / missing-input handling (never invents a number)", () => {
  it("returns pending with value null when an input is missing", () => {
    const r = capRate(null, 8450000);
    expect(r.status).toBe("pending");
    expect(r.value).toBeNull();
    expect(r.display).toBe("—");
    expect(r.missing).toContain("noi");
  });

  it("returns pending on price/SF when rentable SF is unknown", () => {
    const r = pricePerSf(8450000, null);
    expect(r.status).toBe("pending");
    expect(r.display).toBe("—");
  });

  it("guards against division by zero", () => {
    const r = capRate(474890, 0);
    expect(r.status).toBe("pending");
    expect(r.value).toBeNull();
  });

  it("WALT is pending when any lease is missing SF or term", () => {
    const r = walt([{ sf: 1000, monthsRemaining: 24 }, { sf: null, monthsRemaining: 12 }]);
    expect(r.status).toBe("pending");
    expect(r.missing.length).toBeGreaterThan(0);
  });

  it("WALT computes when every lease is complete", () => {
    const r = walt([{ sf: 1000, monthsRemaining: 24 }, { sf: 1000, monthsRemaining: 12 }]);
    expect(r.status).toBe("calculated");
    expect(r.value).toBeCloseTo(1.5, 3); // (1000*24 + 1000*12)/2000/12
  });

  it("tenant concentration is the top tenant's share of total rent", () => {
    const r = tenantConcentration([
      { tenant: "A", annualRent: 60000 },
      { tenant: "B", annualRent: 40000 },
    ]);
    expect(r.value).toBeCloseTo(60, 5);
  });
});
