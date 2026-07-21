import { describe, it, expect } from "vitest";
import { runThreeLens, type OMVerifyInput } from "@/lib/three-lens";

function baseInput(): OMVerifyInput {
  return {
    pages: [
      {
        key: "highlights",
        title: "Investment Highlights",
        isContentPage: true,
        hasSourcedContent: true,
        claims: [
          { text: "94.2% occupied per the rent roll.", cited: true, sourceFactIds: ["f1"] },
          { text: "In-place rents sit below the comp set.", cited: false },
        ],
        kpis: [],
        editableText: true,
        tablesEditable: true,
        imagesHaveAltAndSource: true,
      },
      {
        key: "financial",
        title: "Financial Summary",
        isContentPage: true,
        hasSourcedContent: true,
        claims: [],
        kpis: [
          { label: "Cap rate", status: "calculated", displayValue: "5.62%", sourceFactIds: ["f1", "f2"], metric: "cap_rate" },
          { label: "Price / SF", status: "pending", displayValue: "$332/SF" }, // pending but shows a number → finding
        ],
        editableText: true,
        tablesEditable: true,
        imagesHaveAltAndSource: true,
      },
    ],
    facts: [
      { id: "f1", field: "NOI", value: "474890", source: "T-12" },
      { id: "f2", field: "Price", value: "8450000", source: "LOI" },
    ],
    derived: [{ id: "d1", metric: "cap_rate", value: 5.62, sourceFactIds: ["f1", "f2"], status: "calculated" }],
    brand: {
      logoPresent: true,
      colorsMatch: true,
      disclaimerPresent: true,
      pageNumbers: true,
      contactComplete: true,
      imageCredits: true,
    },
    approvedBrands: ["PDX Homes — Commercial"],
    documentText: "Hawthorne Exchange offering memorandum by PDX Homes — Commercial.",
    requiredDisclosureKinds: ["om_legal"],
    presentDisclosureKinds: ["om_legal"],
    exportChecks: { pptxEditable: true, pdfOk: true },
  };
}

describe("Three-Lens Review", () => {
  it("Lens 1 flags an unsupported claim and a number shown for a pending figure", () => {
    const res = runThreeLens(baseInput());
    const codes = res.findings.map((f) => f.code);
    expect(codes).toContain("unsupported_claim");
    expect(codes).toContain("number_without_source");
  });

  it("Lens 2 flags a missing required disclosure", () => {
    const input = baseInput();
    input.presentDisclosureKinds = [];
    const res = runThreeLens(input);
    expect(res.findings.some((f) => f.code === "missing_disclosure_label" && f.lens === "design")).toBe(true);
  });

  it("Lens 2 flags unapproved external branding for human review", () => {
    const input = baseInput();
    input.documentText += " Styled after a JLL package.";
    const res = runThreeLens(input);
    expect(res.findings.some((f) => f.code === "unapproved_external_branding")).toBe(true);
    expect(res.externalBranding.map((b) => b.brand)).toContain("JLL");
  });

  it("Lens 3 flags flattened text and failed exports", () => {
    const input = baseInput();
    input.pages[0].editableText = false;
    input.exportChecks.pdfOk = false;
    const res = runThreeLens(input);
    const codes = res.findings.map((f) => f.code);
    expect(codes).toContain("flattened_text");
    expect(codes).toContain("pdf_export_failed");
  });

  it("is not ready while critical/high findings remain, and ready once resolved", () => {
    const notReady = runThreeLens(baseInput());
    expect(notReady.ready).toBe(false);

    // Repaired document: cite the claim, render the pending figure as '—'.
    const repaired = baseInput();
    repaired.pages[0].claims[1] = { text: "In-place rents sit below the comp set.", cited: true, sourceFactIds: ["f3"] };
    repaired.facts.push({ id: "f3", field: "Comp set", value: "see comps", source: "Comp Lab" });
    repaired.pages[1].kpis[1].displayValue = "—";
    const res = runThreeLens(repaired);
    expect(res.findings.filter((f) => f.severity === "critical" || f.severity === "high")).toHaveLength(0);
    expect(res.ready).toBe(true);
  });

  it("marks a content page needs_review when it has no sourced content", () => {
    const input = baseInput();
    input.pages.push({
      key: "market",
      title: "Market Overview",
      isContentPage: true,
      hasSourcedContent: false,
      claims: [],
      kpis: [],
      editableText: true,
      tablesEditable: true,
      imagesHaveAltAndSource: true,
    });
    const res = runThreeLens(input);
    expect(res.pageStates.find((p) => p.key === "market")?.state).toBe("needs_review");
  });
});
