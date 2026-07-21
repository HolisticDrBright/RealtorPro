import { describe, it, expect } from "vitest";
import {
  detectCompMapping,
  normalizeComp,
  scoreComp,
  freshness,
  DEFAULT_WEIGHTS,
} from "@/lib/comps";
import { parseCsv } from "@/lib/csv-mapping";

describe("comp normalization", () => {
  it("normalizes an authorized comp export and sets verification from source", () => {
    const { headers, rows } = parseCsv(
      "Address,Sale Date,Sale Price,SF,Distance,Source\n2204 SE Division St,04/2026,\"$7,900,000\",24000,0.8,County deed",
    );
    const mapping = detectCompMapping(headers);
    const c = normalizeComp(rows[0], mapping);
    expect(c.price).toBe(7900000);
    expect(c.pricePerSf).toBeCloseTo(7900000 / 24000, 2); // derived only from present inputs
    expect(c.verificationStatus).toBe("verified"); // county deed source
  });

  it("marks broker-reported comps as needs_verification and records missing fields", () => {
    const { headers, rows } = parseCsv("Address,Sale Price,Source\n811 SE Stark St,\"$9,100,000\",Broker-reported");
    const c = normalizeComp(rows[0], detectCompMapping(headers));
    expect(c.verificationStatus).toBe("needs_verification");
    expect(c.missingFields).toContain("transactionDate");
  });

  it("labels user-entered comps distinctly", () => {
    const { headers, rows } = parseCsv("Address,Sale Price\nUser Comp,\"$1\"");
    const c = normalizeComp(rows[0], detectCompMapping(headers), { userEntered: true });
    expect(c.verificationStatus).toBe("user_entered");
  });
});

describe("transparent comparability score (never a valuation)", () => {
  it("blends only dimensions that have data, weighted by the selected weights", () => {
    const comp = normalizeComp(
      { Address: "A", Distance: "0", Source: "County deed", "Sale Date": "01/2026", SF: "1000" },
      { address: "Address", distanceMi: "Distance", source: "Source", transactionDate: "Sale Date", size: "SF" },
    );
    const res = scoreComp(comp, { size: 1000, assetType: null, pricePerSf: null }, DEFAULT_WEIGHTS);
    expect(res.score).toBeGreaterThan(0);
    expect(res.score).toBeLessThanOrEqual(100);
    // Only the dimensions with data contribute.
    expect(res.contributingDimensions).toContain("distance");
    expect(res.contributingDimensions).toContain("sizeSimilarity");
    expect(res.contributingDimensions).not.toContain("psfSimilarity");
  });

  it("scores 0 when no comparable dimensions have data", () => {
    const comp = normalizeComp({ Address: "A" }, { address: "Address" });
    expect(scoreComp(comp, {}).score).toBe(0);
  });

  it("labels freshness by source year", () => {
    expect(freshness("06/2026", 2026)).toBe("fresh");
    expect(freshness("12/2025", 2026)).toBe("aging");
    expect(freshness("01/2023", 2026)).toBe("stale");
  });
});
