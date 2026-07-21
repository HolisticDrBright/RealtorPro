import { describe, it, expect } from "vitest";
import { decideBoundary, hasVerifiedBoundary } from "@/lib/boundary";

describe("boundary-source requirement", () => {
  it("allows the 'none' style with no sources", () => {
    expect(decideBoundary([], "none").allowed).toBe(true);
  });

  it("prohibits a glow/subtle overlay without a verified boundary source", () => {
    const d = decideBoundary([{ boundaryVerified: false, boundaryBasis: "none" }], "glow");
    expect(d.allowed).toBe(false);
    expect(d.reason).toMatch(/verified boundary source/i);
  });

  it("permits an overlay once a survey / site plan / GeoJSON / manual source verifies it", () => {
    for (const basis of ["survey", "site_plan", "geojson", "manual"] as const) {
      const d = decideBoundary([{ boundaryVerified: true, boundaryBasis: basis }], "glow");
      expect(d.allowed, basis).toBe(true);
      expect(d.basis).toBe(basis);
    }
  });

  it("does not treat an unverified 'geojson' row as a valid boundary", () => {
    expect(hasVerifiedBoundary([{ boundaryVerified: false, boundaryBasis: "geojson" }])).toBe(false);
    expect(decideBoundary([{ boundaryVerified: false, boundaryBasis: "geojson" }], "subtle").allowed).toBe(false);
  });
});
