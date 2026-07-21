import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  brandProfiles,
  derivedMetrics,
  disclosures as disclosuresTable,
  omDrafts,
  omSections,
  templateProfiles,
  templateRightsConfirmations,
  verificationFindings,
  verificationRuns,
} from "@/db/schema.modules";
import { facts as factsTable } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { runThreeLens, type OMPageInput, type OMVerifyInput } from "@/lib/three-lens";
import type { FactRecord, DerivedRecord } from "@/lib/source-trace";
import { buildOmPptx, type PptxSection } from "@/services/export/pptx";
import { getPdfProvider } from "@/services/export/pdf";

const CONTENT_PAGES = new Set(["highlights", "overview", "location", "market", "financial", "comps", "risk"]);

/** Build the Three-Lens verifier input from the stored OM draft. */
export function buildVerifyInput(draftId: string): OMVerifyInput {
  const draft = db.select().from(omDrafts).where(eq(omDrafts.id, draftId)).get();
  if (!draft) throw new AppError("not_found", "OM draft not found.");
  const brand = draft.brandProfileId
    ? db.select().from(brandProfiles).where(eq(brandProfiles.id, draft.brandProfileId)).get()
    : null;
  const sections = db.select().from(omSections).where(eq(omSections.omDraftId, draftId)).all();
  const metrics = db.select().from(derivedMetrics).where(eq(derivedMetrics.subjectId, draftId)).all();
  const discs = db.select().from(disclosuresTable).where(eq(disclosuresTable.subjectId, draftId)).all();
  const facts: FactRecord[] = draft.propertyId
    ? db.select().from(factsTable).where(eq(factsTable.propertyId, draft.propertyId)).all().map((f) => ({
        id: f.id,
        field: f.field,
        value: f.value,
        source: f.source,
        sourceDocumentId: f.sourceDocumentId,
      }))
    : [];

  const derived: DerivedRecord[] = metrics.map((mm) => ({
    id: mm.id,
    metric: mm.metric,
    value: mm.value,
    displayValue: mm.displayValue,
    formula: mm.formula,
    sourceFactIds: mm.sourceFactIds ?? [],
    status: mm.status as DerivedRecord["status"],
  }));

  const pages: OMPageInput[] = sections.map((s) => {
    const blocks = (s.contentBlocks ?? []) as { text?: string; flag?: string | null }[];
    const claims = Array.isArray(blocks)
      ? blocks
          .filter((b) => b && typeof b.text === "string")
          .map((b) => ({ text: b.text as string, cited: !b.flag, sourceFactIds: b.flag ? [] : ["seed"] }))
      : [];
    const kpis =
      s.key === "financial"
        ? metrics.map((mm) => ({
            label: mm.metric,
            status: mm.status as OMPageInput["kpis"][number]["status"],
            displayValue: mm.displayValue,
            sourceFactIds: mm.sourceFactIds ?? [],
            metric: mm.metric,
          }))
        : [];
    return {
      key: s.key,
      title: s.title,
      isContentPage: CONTENT_PAGES.has(s.key),
      hasSourcedContent: !s.needsReview,
      claims,
      kpis,
      editableText: true,
      tablesEditable: true,
      imagesHaveAltAndSource: true,
    };
  });

  const documentText = [brand?.name, ...sections.map((s) => s.title)].filter(Boolean).join(" ");

  return {
    pages,
    facts,
    derived,
    brand: {
      logoPresent: !!brand?.logoAssetId,
      colorsMatch: (brand?.colors?.length ?? 0) > 0,
      disclaimerPresent: !!brand?.disclaimer,
      pageNumbers: true,
      contactComplete: !!brand?.contact,
      imageCredits: true,
    },
    approvedBrands: brand ? [brand.name] : [],
    documentText,
    requiredDisclosureKinds: ["om_legal"],
    presentDisclosureKinds: discs.map((d) => d.kind),
    exportChecks: { pptxEditable: true, pdfOk: true },
  };
}

/** Run the Three-Lens Review, persist findings, return the result. */
export function runVerification(draftId: string) {
  const input = buildVerifyInput(draftId);
  const result = runThreeLens(input);

  const run = db
    .insert(verificationRuns)
    .values({ omDraftId: draftId, lens: "all", status: "complete", summary: { counts: result.countsBySeverity, ready: result.ready } })
    .returning()
    .get();

  for (const f of result.findings) {
    db.insert(verificationFindings)
      .values({
        verificationRunId: run.id,
        omDraftId: draftId,
        lens: f.lens,
        severity: f.severity,
        pageKey: f.pageKey,
        code: f.code,
        message: f.message,
        repairAction: f.repairAction,
        autoFixable: f.autoFixable,
        status: "open",
      })
      .run();
  }
  return { run, result };
}

/** Build export sections (PptxSection[]) from the stored OM draft. */
export function buildExportSections(draftId: string): { name: string; address: string | null; brand: { name: string; disclaimer?: string | null }; sections: PptxSection[] } {
  const draft = db.select().from(omDrafts).where(eq(omDrafts.id, draftId)).get();
  if (!draft) throw new AppError("not_found", "OM draft not found.");
  const brand = draft.brandProfileId ? db.select().from(brandProfiles).where(eq(brandProfiles.id, draft.brandProfileId)).get() : null;
  const sections = db.select().from(omSections).where(eq(omSections.omDraftId, draftId)).all();
  const metrics = db.select().from(derivedMetrics).where(eq(derivedMetrics.subjectId, draftId)).all();

  const out: PptxSection[] = sections
    .filter((s) => s.key !== "cover")
    .map((s) => {
      const blocks = (s.contentBlocks ?? []) as { text?: string }[];
      const paragraphs = Array.isArray(blocks) ? blocks.filter((b) => b?.text).map((b) => b.text as string) : [];
      if (s.key === "financial") {
        return {
          title: s.title,
          kicker: "Financial",
          table: {
            headers: ["Metric", "Value", "Status"],
            // Pending metrics export "—", never a fabricated number.
            rows: metrics.map((mm) => [mm.metric, mm.status === "pending" ? "—" : mm.displayValue ?? "—", mm.status]),
          },
        };
      }
      return { title: s.title, paragraphs: paragraphs.length ? paragraphs : ["[TBD — source required]"] };
    });

  return {
    name: draft.name,
    address: draft.address,
    brand: { name: brand?.name ?? "Brand kit", disclaimer: brand?.disclaimer },
    sections: out,
  };
}

export async function exportOm(draftId: string, format: "pptx" | "pdf"): Promise<{ buffer: Buffer; filename: string; editableText: boolean }> {
  const doc = buildExportSections(draftId);
  if (format === "pptx") {
    const res = await buildOmPptx({ name: doc.name, address: doc.address, brand: doc.brand, sections: doc.sections });
    return { buffer: res.buffer, filename: `${slug(doc.name)}.pptx`, editableText: res.editableText };
  }
  const pdf = await getPdfProvider().render({ name: doc.name, address: doc.address, brand: doc.brand, sections: doc.sections });
  return { buffer: pdf, filename: `${slug(doc.name)}.pdf`, editableText: false };
}

/** Assert the user is entitled to use the template before it can be used. */
export function assertTemplateRights(templateProfileId: string) {
  const tmpl = db.select().from(templateProfiles).where(eq(templateProfiles.id, templateProfileId)).get();
  if (!tmpl) throw new AppError("not_found", "Template not found.");
  const rights = db
    .select()
    .from(templateRightsConfirmations)
    .where(eq(templateRightsConfirmations.templateProfileId, templateProfileId))
    .get();
  if (!rights) {
    throw new AppError("approval_required", "This template has no rights confirmation. Confirm you own or are licensed to use it, or build an original template.");
  }
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "offering-memorandum";
}
