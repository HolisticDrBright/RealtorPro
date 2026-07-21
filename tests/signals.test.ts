import { describe, it, expect } from "vitest";
import {
  computeConfidence,
  signalsFromMlsExport,
  staleLeadSignal,
  anniversarySignal,
  unansweredInquirySignal,
} from "@/lib/signals";

describe("Signal Scout — confidence reflects data completeness, not likelihood", () => {
  it("confidence is the fraction of expected fields present", () => {
    const c = computeConfidence({ a: "1", b: "2" }, ["a", "b", "c", "d"]);
    expect(c.score).toBe(50);
    expect(c.basis).toMatch(/missing: c, d/);
  });

  it("builds signals only for recognized MLS statuses (never invents)", () => {
    const signals = signalsFromMlsExport([
      { address: "1 A St", status: "Expired", statusDate: "07/2026", price: "$500k" },
      { address: "2 B St", status: "Active", statusDate: "07/2026" }, // ignored
      { address: "3 C St", status: "Price Reduced", statusDate: "07/2026", price: "$400k", owner: "Jane" },
    ]);
    expect(signals).toHaveLength(2);
    expect(signals.map((s) => s.type)).toEqual(["expired", "price_reduction"]);
    // completeness drives confidence
    expect(signals[1].confidence).toBeGreaterThan(signals[0].confidence);
  });

  it("emits a stale-lead signal past the threshold", () => {
    expect(staleLeadSignal({ id: "c1", name: "Dana", lastTouchDaysAgo: 40, stage: "lead" })).not.toBeNull();
    expect(staleLeadSignal({ id: "c1", name: "Dana", lastTouchDaysAgo: 5 })).toBeNull();
  });

  it("emits an anniversary signal near a whole-year mark", () => {
    const ref = new Date("2026-07-21T00:00:00Z");
    expect(anniversarySignal({ id: "c5", name: "Lin", closedDate: "2025-07-25" }, ref)).not.toBeNull();
    expect(anniversarySignal({ id: "c5", name: "Lin", closedDate: "2026-01-01" }, ref)).toBeNull();
  });

  it("emits an unanswered-inquiry signal for inbound leads", () => {
    expect(unansweredInquirySignal({ id: "c9", name: "Sam", hasUnansweredInquiry: true })).not.toBeNull();
    expect(unansweredInquirySignal({ id: "c9", name: "Sam", hasUnansweredInquiry: false })).toBeNull();
  });
});
