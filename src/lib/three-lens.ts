/**
 * The mandatory Three-Lens OM Review (pure, unit-tested).
 *
 *   Lens 1 — Source & number verification: re-trace every figure, recompute
 *            derived values, flag missing inputs / broken citations / unsupported
 *            claims / numbers shown for pending values.
 *   Lens 2 — Design & brand verification: check against the selected brand /
 *            template (logo, colors, disclaimer, page numbers, contact block,
 *            unapproved external branding, image credits, disclosure labels).
 *   Lens 3 — Editability & export verification: confirm real editable text and
 *            tables, image source/alt retention, and successful PPTX/PDF export.
 *
 * The verifier never compares against or recreates a competitor template.
 */
import { scanForExternalBranding, type BrandingMatch } from "./branding-scan";
import { traceFigure, type DerivedRecord, type FactRecord } from "./source-trace";

export type Lens = "source" | "design" | "export";
export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  lens: Lens;
  severity: Severity;
  pageKey?: string;
  code: string;
  message: string;
  repairAction?: string;
  autoFixable: boolean;
}

export interface OMClaim {
  text: string;
  cited: boolean;
  sourceFactIds?: string[];
}

export interface OMKpi {
  label: string;
  status: "imported" | "calculated" | "pending" | "tbd";
  displayValue: string | null;
  sourceFactIds?: string[];
  metric?: string;
}

export interface OMPageInput {
  key: string;
  title: string;
  isContentPage: boolean;
  hasSourcedContent: boolean;
  claims: OMClaim[];
  kpis: OMKpi[];
  editableText: boolean;
  tablesEditable: boolean;
  imagesHaveAltAndSource: boolean;
}

export interface OMVerifyInput {
  pages: OMPageInput[];
  facts: FactRecord[];
  derived: DerivedRecord[];
  brand: {
    logoPresent: boolean;
    colorsMatch: boolean;
    disclaimerPresent: boolean;
    pageNumbers: boolean;
    contactComplete: boolean;
    imageCredits: boolean;
  };
  approvedBrands: string[];
  documentText: string;
  requiredDisclosureKinds: string[];
  presentDisclosureKinds: string[];
  exportChecks: { pptxEditable: boolean; pdfOk: boolean };
}

export interface PageState {
  key: string;
  state: "ready" | "needs_review";
  findingCount: number;
}

export interface ThreeLensResult {
  findings: Finding[];
  pageStates: PageState[];
  countsBySeverity: Record<Severity, number>;
  externalBranding: BrandingMatch[];
  ready: boolean;
}

// ── Lens 1 ───────────────────────────────────────────────────────────────────
function lensSource(input: OMVerifyInput): Finding[] {
  const findings: Finding[] = [];
  const derivedById = new Map(input.derived.map((d) => [d.metric, d]));

  for (const page of input.pages) {
    for (const claim of page.claims) {
      if (!claim.cited || (claim.sourceFactIds ?? []).length === 0) {
        findings.push({
          lens: "source",
          severity: "high",
          pageKey: page.key,
          code: "unsupported_claim",
          message: `Unsupported claim on ${page.title}: "${truncate(claim.text)}"`,
          repairAction: "Cite a source fact or remove the claim.",
          autoFixable: false,
        });
      }
    }
    for (const kpi of page.kpis) {
      // A pending / TBD figure must NOT show a real number.
      if ((kpi.status === "pending" || kpi.status === "tbd") && kpi.displayValue && !/^[—-]$/.test(kpi.displayValue) && kpi.displayValue !== "[TBD — source required]") {
        findings.push({
          lens: "source",
          severity: "critical",
          pageKey: page.key,
          code: "number_without_source",
          message: `${kpi.label} is ${kpi.status} but shows a value ("${kpi.displayValue}").`,
          repairAction: "Render '—' until the source is attached.",
          autoFixable: true,
        });
      }
      // Broken citation trace on imported/calculated figures.
      if (kpi.metric && (kpi.status === "imported" || kpi.status === "calculated")) {
        const d = derivedById.get(kpi.metric);
        if (d) {
          const trace = traceFigure(d, input.facts);
          if (trace.brokenCitations.length > 0) {
            findings.push({
              lens: "source",
              severity: "high",
              pageKey: page.key,
              code: "broken_citation",
              message: `${kpi.label} cites fact(s) that no longer exist: ${trace.brokenCitations.join(", ")}.`,
              repairAction: "Re-attach the source document or recompute.",
              autoFixable: false,
            });
          } else if (!trace.supported) {
            findings.push({
              lens: "source",
              severity: "medium",
              pageKey: page.key,
              code: "missing_source",
              message: `${kpi.label} has no source fact attached.`,
              repairAction: "Attach the source fact or mark the figure pending.",
              autoFixable: false,
            });
          }
        }
      }
    }
  }
  return findings;
}

// ── Lens 2 ───────────────────────────────────────────────────────────────────
function lensDesign(input: OMVerifyInput): { findings: Finding[]; externalBranding: BrandingMatch[] } {
  const findings: Finding[] = [];
  const b = input.brand;
  const add = (code: string, message: string, severity: Severity, repairAction: string, autoFixable = false) =>
    findings.push({ lens: "design", severity, code, message, repairAction, autoFixable });

  if (!b.logoPresent) add("missing_logo", "Brand logo is missing from the document.", "high", "Add the brand kit logo.", true);
  if (!b.colorsMatch) add("wrong_colors", "Colors do not match the selected brand profile.", "medium", "Apply the brand color palette.", true);
  if (!b.disclaimerPresent) add("missing_disclaimer", "The brand legal disclaimer is missing.", "high", "Insert the brand disclaimer.", true);
  if (!b.pageNumbers) add("missing_page_numbers", "Page numbers are missing.", "low", "Enable page numbering.", true);
  if (!b.contactComplete) add("incomplete_contact", "The contact block is incomplete.", "medium", "Complete the broker/contact block.", true);
  if (!b.imageCredits) add("missing_image_credits", "One or more images are missing credits.", "low", "Add image credits/source references.", false);

  // Disclosure labels present?
  for (const kind of input.requiredDisclosureKinds) {
    if (!input.presentDisclosureKinds.includes(kind)) {
      add("missing_disclosure_label", `Required disclosure "${kind}" is missing.`, "high", "Add the required disclosure label.", true);
    }
  }

  // Unapproved external branding → flag for human review (never auto-remove).
  const externalBranding = scanForExternalBranding(input.documentText, input.approvedBrands);
  for (const m of externalBranding) {
    add("unapproved_external_branding", m.message, "high", "Confirm you are licensed to use this mark, or remove it (manual).", false);
  }

  return { findings, externalBranding };
}

// ── Lens 3 ───────────────────────────────────────────────────────────────────
function lensExport(input: OMVerifyInput): Finding[] {
  const findings: Finding[] = [];
  for (const page of input.pages) {
    if (!page.editableText) {
      findings.push({ lens: "export", severity: "critical", pageKey: page.key, code: "flattened_text", message: `${page.title}: copy is not real editable text.`, repairAction: "Regenerate the page with editable text boxes.", autoFixable: false });
    }
    if (!page.tablesEditable) {
      findings.push({ lens: "export", severity: "high", pageKey: page.key, code: "flattened_table", message: `${page.title}: a table is flattened imagery, not an editable table.`, repairAction: "Rebuild the table as native cells.", autoFixable: false });
    }
    if (!page.imagesHaveAltAndSource) {
      findings.push({ lens: "export", severity: "medium", pageKey: page.key, code: "missing_alt_or_source", message: `${page.title}: an image is missing alt text or a source reference.`, repairAction: "Add alt text and a source reference.", autoFixable: false });
    }
  }
  if (!input.exportChecks.pptxEditable) {
    findings.push({ lens: "export", severity: "critical", code: "pptx_not_editable", message: "PPTX export did not produce editable text/tables.", repairAction: "Fix the PPTX generation.", autoFixable: false });
  }
  if (!input.exportChecks.pdfOk) {
    findings.push({ lens: "export", severity: "high", code: "pdf_export_failed", message: "PDF export did not complete.", repairAction: "Retry the PDF export (local fallback).", autoFixable: false });
  }
  return findings;
}

const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

function truncate(s: string, n = 60) {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

export function runThreeLens(input: OMVerifyInput): ThreeLensResult {
  const l1 = lensSource(input);
  const { findings: l2, externalBranding } = lensDesign(input);
  const l3 = lensExport(input);
  const findings = [...l1, ...l2, ...l3];

  const byPage = new Map<string, number>();
  for (const f of findings) {
    if (f.pageKey) byPage.set(f.pageKey, (byPage.get(f.pageKey) ?? 0) + 1);
  }
  const pageStates: PageState[] = input.pages.map((p) => {
    const count = byPage.get(p.key) ?? 0;
    const needsReview = count > 0 || (p.isContentPage && !p.hasSourcedContent);
    return { key: p.key, state: needsReview ? "needs_review" : "ready", findingCount: count };
  });

  const countsBySeverity = SEVERITIES.reduce(
    (acc, s) => ({ ...acc, [s]: findings.filter((f) => f.severity === s).length }),
    {} as Record<Severity, number>,
  );

  const ready = findings.filter((f) => f.severity === "critical" || f.severity === "high").length === 0;

  return { findings, pageStates, countsBySeverity, externalBranding, ready };
}
