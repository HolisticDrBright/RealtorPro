import { describe, it, expect } from "vitest";
import {
  scoreListing,
  buildScoringCriteria,
  parseHardConstraint,
  type ScoringCriteria,
  type ScoringFacts,
} from "@/lib/match-scoring";

const baseCriteria: ScoringCriteria = {
  ceilingAmount: 700_000,
  ceilingHard: true,
  hardConstraints: [
    { label: "3+ beds", kind: "minBeds", value: 3, factKey: "beds" },
    { label: "Max HOA $150/mo", kind: "maxHoa", value: 150, factKey: "hoa" },
  ],
  weightedPrefs: [
    { label: "Fenced yard", weight: 90, keywords: ["fenced", "yard"] },
    { label: "Updated kitchen", weight: 70, keywords: ["updated kitchen", "remodel"] },
  ],
  mustHaves: [{ label: "Off-street parking", weight: 100, keywords: ["garage", "driveway", "off-street"] }],
};

describe("scoreListing", () => {
  it("credits an under-ceiling price with a reason citing its source", () => {
    const facts: ScoringFacts = {
      price: 674_900,
      beds: 3,
      hoaMonthly: 100,
      features: ["fenced yard", "detached garage", "kitchen remodel 2023"],
      sources: { price: "CSV: ListPrice" },
    };
    const r = scoreListing(baseCriteria, facts);
    expect(r.overCeiling).toBe(false);
    expect(r.excluded).toBe(false);
    const priceReason = r.reasons.find((x) => /under the/.test(x.text));
    expect(priceReason?.source).toBe("CSV: ListPrice");
    // Both prefs evidenced → full pref score.
    expect(r.score).toBe(100);
  });

  it("flags an over-hard-ceiling listing as excluded but keeps a score", () => {
    const facts: ScoringFacts = { price: 724_900, beds: 4, hoaMonthly: 0, features: ["garage", "fenced yard", "updated kitchen"] };
    const r = scoreListing(baseCriteria, facts);
    expect(r.overCeiling).toBe(true);
    expect(r.excluded).toBe(true);
    expect(r.tradeoffs.join(" ")).toMatch(/over the hard ceiling/i);
    expect(r.score).toBeGreaterThan(0); // score preserved, exclusion is a flag
  });

  it("reports a missing fact instead of inferring it", () => {
    const facts: ScoringFacts = { price: null, beds: 3, features: ["garage"] };
    const r = scoreListing(baseCriteria, facts);
    expect(r.missingFacts.join(" ")).toMatch(/list price is missing/i);
    // No fabricated price reason.
    expect(r.reasons.some((x) => /ceiling/i.test(x.text))).toBe(false);
  });

  it("excludes on a hard numeric constraint failure (HOA over max)", () => {
    const facts: ScoringFacts = { price: 400_000, beds: 3, hoaMonthly: 545, features: ["garage", "fenced yard", "updated kitchen"] };
    const r = scoreListing(baseCriteria, facts);
    expect(r.excluded).toBe(true);
    expect(r.tradeoffs.join(" ")).toMatch(/exceeds the .* max/i);
  });

  it("reflects preference weights in the score", () => {
    const facts: ScoringFacts = { price: 500_000, beds: 3, hoaMonthly: 0, features: ["fenced yard", "garage"] };
    // Only the 90-weight pref is met (of 90+70=160) → 90/160 ≈ 56, must-have met.
    const r = scoreListing(baseCriteria, facts);
    expect(r.score).toBe(Math.round((90 / 160) * 100));
  });

  it("penalizes an unconfirmed must-have and raises a verify question", () => {
    const facts: ScoringFacts = { price: 500_000, beds: 3, hoaMonthly: 0, features: ["fenced yard", "updated kitchen"] };
    const r = scoreListing(baseCriteria, facts);
    expect(r.verifyQuestions.join(" ")).toMatch(/off-street parking/i);
    // Must-have penalty applied (×0.75), so below the full pref score of 100.
    expect(r.score).toBe(75);
  });

  it("surfaces recorded fact conflicts as verification questions", () => {
    const facts: ScoringFacts = {
      price: 500_000,
      beds: 3,
      hoaMonthly: 0,
      features: ["garage", "fenced yard", "updated kitchen"],
      conflicts: [{ field: "LivingArea", note: "CSV 1,940 vs county 1,876" }],
    };
    const r = scoreListing(baseCriteria, facts);
    expect(r.verifyQuestions.join(" ")).toMatch(/1,940 vs county 1,876/);
  });
});

describe("buildScoringCriteria / parseHardConstraint", () => {
  it("parses hard-constraint strings without inventing values", () => {
    expect(parseHardConstraint("3+ beds, 2+ baths")).toMatchObject({ kind: "minBeds", value: 3 });
    expect(parseHardConstraint("Max HOA $150/mo")).toMatchObject({ kind: "maxHoa", value: 150 });
    expect(parseHardConstraint("Off-street parking required").kind).toBe("feature");
  });

  it("builds keyword-based prefs from stored labels", () => {
    const c = buildScoringCriteria({
      ceilingAmount: 700_000,
      hardConstraints: ["3+ beds"],
      weightedPrefs: [{ label: "Fenced yard (dog)", weight: 90 }],
      mustHaves: ["Off-street parking"],
    });
    expect(c.weightedPrefs[0].keywords).toContain("fenced yard");
    expect(c.mustHaves?.[0].keywords).toContain("parking");
  });
});
