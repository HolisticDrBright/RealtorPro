import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { parseCsv } from "@/lib/csv-mapping";
import { detectRentRollMapping, normalizeUnit, validateRentRoll, summarizeRentRoll } from "@/lib/rent-roll";
import { occupancy, capRate, pricePerUnit } from "@/lib/finance";
import { detectCompMapping, normalizeComp, scoreComp } from "@/lib/comps";
import { decideBoundary } from "@/lib/boundary";
import { buildVisualizationDisclosure, enforceDisclosure } from "@/lib/disclosures";
import { remoteNeedsApproval } from "@/lib/gates";
import { runThreeLens, type OMVerifyInput } from "@/lib/three-lens";
import { buildRentRollWorkbook } from "@/services/export/xlsx";
import { buildOmPptx } from "@/services/export/pptx";

// ── 1. uploaded CSV → rent-roll workbook export ──────────────────────────────
describe("integration: uploaded CSV → clean rent-roll workbook", () => {
  it("parses, validates, and exports a workbook with the six required tabs", async () => {
    const csv = `Unit,Tenant,SqFt,Lease End,Monthly Rent,Status
C-101,Blue Fin Coffee,1450,03/2028,4350,Current
204,Residential 1BR,685,MTM,1595,Current
C-102,Vacant,1180,,,Vacant`;
    const { headers, rows } = parseCsv(csv);
    const mapping = detectRentRollMapping(headers);
    const units = rows.map((r) => normalizeUnit(r, mapping));
    const findings = validateRentRoll(units);
    const s = summarizeRentRoll(units);
    const derived = [occupancy(s.occupied, s.total)];

    const buffer = await buildRentRollWorkbook({ name: "Demo", headers, originalRows: rows, units, findings, derived });
    expect(buffer.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const tabs = wb.worksheets.map((w) => w.name);
    expect(tabs).toEqual([
      "Original Import",
      "Clean Rent Roll",
      "Validation Findings",
      "Lease Expiration Schedule",
      "Property Summary",
      "Assumptions & Sources",
    ]);
    // Derived value carries its status text (not a fabricated number when pending).
    const summary = wb.getWorksheet("Property Summary")!;
    expect(summary.getCell("A2").value).toBe("occupancy");
  });
});

// ── 2. imported comp file → OM comps section with sources ────────────────────
describe("integration: imported comp file → OM section with sources", () => {
  it("normalizes comps and builds a section where every row carries its source", () => {
    const csv = `Address,Sale Date,Sale Price,SF,Distance,Source
2204 SE Division St,04/2026,"$7,900,000",24000,0.8,County deed
811 SE Stark St,06/2026,"$9,100,000",26600,1.1,Broker-reported`;
    const { headers, rows } = parseCsv(csv);
    const mapping = detectCompMapping(headers);
    const comps = rows.map((r) => normalizeComp(r, mapping));
    const subject = { size: 25000, pricePerSf: 330, assetType: null };

    const section = {
      key: "comps",
      title: "Comparable Sales",
      rows: comps.map((c) => ({
        address: c.address,
        price: c.price,
        source: c.source,
        verification: c.verificationStatus,
        score: scoreComp(c, subject).score,
      })),
    };
    expect(section.rows).toHaveLength(2);
    expect(section.rows.every((r) => r.source)).toBe(true);
    expect(section.rows[0].verification).toBe("verified");
    expect(section.rows[1].verification).toBe("needs_verification");
  });
});

// ── 3. visualization request → disclosure → review → approved export ─────────
describe("integration: visualization request → disclosure → review → approved export", () => {
  it("blocks a boundary overlay without a verified source, then gates export on disclosure + approval", () => {
    // No verified boundary → overlay prohibited.
    const noSource = decideBoundary([{ boundaryVerified: false, boundaryBasis: "none" }], "glow");
    expect(noSource.allowed).toBe(false);

    // With a verified survey → overlay allowed.
    const withSurvey = decideBoundary([{ boundaryVerified: true, boundaryBasis: "survey" }], "glow");
    expect(withSurvey.allowed).toBe(true);

    // Mandatory disclosure for a land teaser.
    const disc = buildVisualizationDisclosure("land_teaser");
    expect(disc.required).toBe(true);

    // Export blocked until the disclosure is approved.
    expect(enforceDisclosure({ visualizationType: "land_teaser", disclosureText: disc.text, approved: false })).not.toBeNull();
    // A remote job also needs explicit approval before it runs.
    expect(remoteNeedsApproval({ isRemote: true, approvedForRemote: false })).toBe(true);

    // After approvals, export is clear.
    expect(enforceDisclosure({ visualizationType: "land_teaser", disclosureText: disc.text, approved: true })).toBeNull();
    expect(remoteNeedsApproval({ isRemote: true, approvedForRemote: true })).toBe(false);
  });
});

// ── 4. OM draft → three-lens → findings → repaired export ────────────────────
function omInput(repaired: boolean): OMVerifyInput {
  return {
    pages: [
      {
        key: "highlights",
        title: "Investment Highlights",
        isContentPage: true,
        hasSourcedContent: true,
        claims: [{ text: "Below-market rents.", cited: repaired, sourceFactIds: repaired ? ["f1"] : [] }],
        kpis: [],
        editableText: true,
        tablesEditable: true,
        imagesHaveAltAndSource: true,
      },
    ],
    facts: repaired ? [{ id: "f1", field: "Comp set", value: "x", source: "Comp Lab" }] : [],
    derived: [],
    brand: { logoPresent: true, colorsMatch: true, disclaimerPresent: true, pageNumbers: true, contactComplete: true, imageCredits: true },
    approvedBrands: ["PDX Homes"],
    documentText: "Prepared by PDX Homes.",
    requiredDisclosureKinds: ["om_legal"],
    presentDisclosureKinds: ["om_legal"],
    exportChecks: { pptxEditable: true, pdfOk: true },
  };
}

describe("integration: OM draft → Three-Lens Review → findings → repaired export", () => {
  it("finds an unsupported claim, then exports an editable PPTX after repair", async () => {
    const before = runThreeLens(omInput(false));
    expect(before.ready).toBe(false);
    expect(before.findings.some((f) => f.code === "unsupported_claim")).toBe(true);

    const after = runThreeLens(omInput(true));
    expect(after.ready).toBe(true);

    // Editable PPTX export (real text + tables, never flattened imagery).
    const pptx = await buildOmPptx({
      name: "Hawthorne Exchange",
      address: "1134 SE Hawthorne Blvd",
      brand: { name: "PDX Homes — Commercial", disclaimer: "Demo document — not an offer." },
      sections: [
        { title: "Executive Summary", kicker: "OM", paragraphs: ["Corner-anchored mixed-use block."], sources: ["Rent roll Jul 2026"] },
        { title: "Financial Summary", table: { headers: ["Metric", "Value", "Status"], rows: [["Cap rate", "5.62%", "Calculated"], ["Price / SF", "—", "Pending"]] } },
      ],
    });
    expect(pptx.editableText).toBe(true);
    expect(pptx.editableTables).toBe(true);
    expect(pptx.slideCount).toBe(3); // cover + 2 sections
    expect(pptx.buffer.byteLength).toBeGreaterThan(1000);
  });
});
