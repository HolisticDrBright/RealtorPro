import "server-only";
import ExcelJS from "exceljs";
import type { NormalizedUnit, RentRollFinding } from "@/lib/rent-roll";
import type { DerivedResult } from "@/lib/finance";
import type { NormalizedComp } from "@/lib/comps";

/**
 * XLSX exports (ExcelJS) — real editable workbooks, not flattened images.
 * Every workbook includes an "Assumptions & Sources" tab so derived figures
 * carry their formula and provenance.
 */

function autoWidth(ws: ExcelJS.Worksheet) {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(48, max + 2);
  });
}

export interface RentRollWorkbookInput {
  name: string;
  headers: string[];
  originalRows: Record<string, string>[];
  units: NormalizedUnit[];
  findings: RentRollFinding[];
  derived: DerivedResult[];
  redactPii?: boolean;
}

/** Rent-roll workbook with the six required tabs. */
export async function buildRentRollWorkbook(input: RentRollWorkbookInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AgentOS — Rent Roll Studio";
  wb.created = new Date(0); // deterministic

  const redact = (tenant: string | null) =>
    input.redactPii && tenant ? tenant.replace(/[A-Za-z]/g, "•") : tenant ?? "";

  // 1. Original Import (verbatim source)
  const orig = wb.addWorksheet("Original Import");
  orig.addRow(input.headers);
  for (const row of input.originalRows) orig.addRow(input.headers.map((h) => row[h] ?? ""));
  autoWidth(orig);

  // 2. Clean Rent Roll (normalized)
  const clean = wb.addWorksheet("Clean Rent Roll");
  clean.addRow(["Unit", "Tenant", "SF", "Lease Start", "Lease End", "Monthly Rent", "Annual Rent", "Status", "Needs Review"]);
  for (const u of input.units) {
    clean.addRow([
      u.unit ?? "",
      redact(u.tenant),
      u.sf ?? "",
      u.leaseStart ?? "",
      u.leaseEnd ?? "",
      u.monthlyRent ?? "",
      u.annualRent ?? "",
      u.status ?? "",
      u.needsReview ? "Yes" : "",
    ]);
  }
  autoWidth(clean);

  // 3. Validation Findings
  const val = wb.addWorksheet("Validation Findings");
  val.addRow(["Severity", "Code", "Unit", "Message", "Source", "Normalized"]);
  for (const f of input.findings) {
    val.addRow([f.severity, f.code, f.unitRef ?? "", f.message, f.sourceValue ?? "", f.normalizedValue ?? ""]);
  }
  autoWidth(val);

  // 4. Lease Expiration Schedule
  const exp = wb.addWorksheet("Lease Expiration Schedule");
  exp.addRow(["Expiration Year", "Units", "Total SF"]);
  const byYear = new Map<string, { count: number; sf: number }>();
  for (const u of input.units) {
    const y = u.leaseEndYear ?? "unknown";
    const cur = byYear.get(y) ?? { count: 0, sf: 0 };
    cur.count += 1;
    cur.sf += u.sf ?? 0;
    byYear.set(y, cur);
  }
  [...byYear.entries()].sort().forEach(([y, v]) => exp.addRow([y, v.count, v.sf]));
  autoWidth(exp);

  // 5. Property Summary (derived)
  const sum = wb.addWorksheet("Property Summary");
  sum.addRow(["Metric", "Value", "Status"]);
  for (const d of input.derived) sum.addRow([d.metric, d.display, d.status]);
  autoWidth(sum);

  // 6. Assumptions & Sources
  const assum = wb.addWorksheet("Assumptions & Sources");
  assum.addRow(["Metric", "Formula", "Inputs", "Missing", "Status"]);
  for (const d of input.derived) {
    assum.addRow([d.metric, d.formula, JSON.stringify(d.inputs), d.missing.join(", "), d.status]);
  }
  assum.addRow([]);
  assum.addRow(["Note", "Figures marked pending have no value until the required source is attached. Demo data is fictional."]);
  autoWidth(assum);

  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

export interface CompWorkbookInput {
  name: string;
  comps: (NormalizedComp & { score?: number | null })[];
}

/** Comparable-sales workbook (comparison table + sources). */
export async function buildCompWorkbook(input: CompWorkbookInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "AgentOS — Comp Lab";
  wb.created = new Date(0);

  const table = wb.addWorksheet("Comparison");
  table.addRow(["Address", "Asset Type", "Date", "Price", "Size", "$/SF", "Cap Rate", "Distance (mi)", "Source", "Verification", "Score"]);
  for (const c of input.comps) {
    table.addRow([
      c.address ?? "",
      c.assetType ?? "",
      c.transactionDate ?? "",
      c.price ?? "",
      c.size ?? "",
      c.pricePerSf ?? "",
      c.capRate ?? "",
      c.distanceMi ?? "",
      c.source ?? "",
      c.verificationStatus,
      c.score ?? "",
    ]);
  }
  autoWidth(table);

  const sources = wb.addWorksheet("Sources & Notes");
  sources.addRow(["Address", "Source", "Source Date", "Verification", "Missing Fields"]);
  for (const c of input.comps) {
    sources.addRow([c.address ?? "", c.source ?? "", c.sourceDate ?? "", c.verificationStatus, (c.missingFields ?? []).join(", ")]);
  }
  sources.addRow([]);
  sources.addRow(["Note", "Comparability scores are transparency aids, not appraisals or valuations. Agent-entered adjustments are assumptions, not facts."]);
  autoWidth(sources);

  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}
