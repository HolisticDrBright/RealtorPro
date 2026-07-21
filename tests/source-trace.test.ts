import { describe, it, expect } from "vitest";
import { traceFigure, recomputeAndCompare, type FactRecord } from "@/lib/source-trace";

const facts: FactRecord[] = [
  { id: "f_noi", field: "NOI", value: "474890", source: "2025 operating statement", sourceDocumentId: "doc1" },
  { id: "f_price", field: "Asking price", value: "8450000", source: "Engagement letter", sourceDocumentId: "doc2" },
];

describe("source tracing", () => {
  it("traces a calculated figure to its source facts", () => {
    const trace = traceFigure(
      { id: "d1", metric: "cap_rate", value: 5.62, displayValue: "5.62%", formula: "NOI ÷ price", sourceFactIds: ["f_noi", "f_price"], status: "calculated" },
      facts,
    );
    expect(trace.supported).toBe(true);
    expect(trace.steps).toHaveLength(2);
    expect(trace.steps.every((s) => s.found)).toBe(true);
    expect(trace.brokenCitations).toHaveLength(0);
  });

  it("flags a broken citation when a cited fact is missing", () => {
    const trace = traceFigure(
      { id: "d2", metric: "cap_rate", value: 5.62, sourceFactIds: ["f_noi", "f_missing"], status: "calculated" },
      facts,
    );
    expect(trace.brokenCitations).toContain("f_missing");
    expect(trace.supported).toBe(false);
  });

  it("shows no number and TBD marker for a pending/tbd figure", () => {
    const pending = traceFigure({ id: "d3", metric: "price_per_sf", value: null, sourceFactIds: [], status: "pending" }, facts);
    expect(pending.display).toBe("—");
    const tbd = traceFigure({ id: "d4", metric: "price_per_sf", value: null, sourceFactIds: [], status: "tbd" }, facts);
    expect(tbd.display).toBe("[TBD — source required]");
  });

  it("recomputes a derived value and detects a mismatch", () => {
    const ok = recomputeAndCompare(
      { id: "d5", metric: "cap_rate", value: 5.62, sourceFactIds: ["f_noi", "f_price"], status: "calculated" },
      facts,
      ([noiVal, price]) => (price ? (noiVal / price) * 100 : null),
      0.01,
    );
    expect(ok.ok).toBe(true);

    const bad = recomputeAndCompare(
      { id: "d6", metric: "cap_rate", value: 9.9, sourceFactIds: ["f_noi", "f_price"], status: "calculated" },
      facts,
      ([noiVal, price]) => (price ? (noiVal / price) * 100 : null),
      0.01,
    );
    expect(bad.ok).toBe(false);
    expect(bad.reason).toMatch(/differs/);
  });
});
