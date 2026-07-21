import { describe, it, expect } from "vitest";
import {
  checkText,
  assessCriteria,
  assessText,
} from "@/lib/fair-housing";
import { DATA } from "@/data/mock-data";

describe("Fair Housing guardrails", () => {
  it("flags steering language (schools / safe / good area)", () => {
    const v = checkText("Find a family-friendly home in a safe neighborhood with good schools");
    expect(v.length).toBeGreaterThan(0);
    expect(v.some((x) => x.category === "steering")).toBe(true);
    expect(assessText("safe neighborhood with good schools").allowed).toBe(false);
  });

  it("rejects familial-status targeting", () => {
    expect(checkText("adults only, no kids").some((x) => x.category === "familial_status")).toBe(true);
  });

  it("rejects protected-class (race) targeting", () => {
    const v = checkText("prefer white buyers only");
    expect(v.some((x) => x.category === "race_ethnicity")).toBe(true);
  });

  it("rejects religion and disability targeting", () => {
    expect(checkText("great christian community values").some((x) => x.category === "religion")).toBe(true);
    expect(checkText("not suitable for the disabled").some((x) => x.category === "disability")).toBe(true);
  });

  it("rejects subjective neighborhood / demographic ranking", () => {
    const v = checkText("rank by the up-and-coming vibe and demographics of the neighbors");
    expect(v.some((x) => x.category === "subjective_neighborhood")).toBe(true);
  });

  it("allows objective criteria with geographic areas", () => {
    const result = assessCriteria({
      ceilingText: "$700,000 (hard)",
      hardConstraints: ["3+ beds, 2+ baths", "Off-street parking required", "Max HOA $150/mo"],
      weightedPrefs: [{ label: "Fenced yard (dog)" }, { label: "Updated kitchen" }],
      areas: ["Sellwood-Moreland", "Woodstock", "Mt. Tabor"],
      mustHaves: ["In-unit laundry"],
    });
    expect(result.allowed).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it("blocks a criteria object that hides steering language in a constraint", () => {
    const result = assessCriteria({ hardConstraints: ["must be in a good school district"] });
    expect(result.allowed).toBe(false);
  });

  it("does not flag the seeded demo buyer criteria", () => {
    for (const b of DATA.buyers) {
      const result = assessCriteria({
        ceilingText: b.ceiling,
        hardConstraints: b.constraints,
        weightedPrefs: b.prefs,
        areas: b.areas,
        mustHaves: b.mustHaves,
      });
      expect(result.allowed, `${b.name} criteria should be allowed`).toBe(true);
    }
  });
});
