import { describe, it, expect } from "vitest";
import {
  requiresDisclosure,
  buildVisualizationDisclosure,
  enforceDisclosure,
  disclosureKindForVisualization,
} from "@/lib/disclosures";

describe("disclosure enforcement", () => {
  it("requires a disclosure for every concept-visualization type", () => {
    for (const t of ["site_boundary", "land_teaser", "massing", "future_use", "construction_sequence", "aerial_reel"]) {
      expect(requiresDisclosure(t), t).toBe(true);
    }
  });

  it("uses the construction label for construction-sequence videos", () => {
    expect(disclosureKindForVisualization("construction_sequence")).toBe("construction");
    const d = buildVisualizationDisclosure("construction_sequence");
    expect(d.text).toMatch(/not actual construction progress/i);
  });

  it("uses the conceptual-visualization disclosure for teasers/massing", () => {
    const d = buildVisualizationDisclosure("land_teaser");
    expect(d.text).toMatch(/Conceptual visualization only/i);
    expect(d.editable).toBe(true);
  });

  it("blocks export when a required disclosure is missing or unapproved", () => {
    expect(enforceDisclosure({ visualizationType: "land_teaser", disclosureText: "", approved: false })).toMatch(/missing/i);
    expect(enforceDisclosure({ visualizationType: "land_teaser", disclosureText: "Conceptual only.", approved: false })).toMatch(/approved/i);
    expect(enforceDisclosure({ visualizationType: "land_teaser", disclosureText: "Conceptual only.", approved: true })).toBeNull();
  });
});
