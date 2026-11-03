import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals } from "@/db/schema";
import { exportRecords } from "@/db/schema.modules";
import { transactions } from "@/db/schema.dashboard";
import { checklistTemplates } from "@/db/schema.checklists";
import { readJson } from "@/lib/api";
import { exportChecklistSchema } from "@/lib/validation.checklist";
import { buildChecklistWorkbook } from "@/services/export/xlsx";
import { getPdfProvider } from "@/services/export/pdf";
import { itemsFor } from "@/services/checklist";
import { effectiveDue } from "@/lib/checklist";
import { ANCHOR_LABELS, CONDITION_LABELS, type Condition, type TemplatePhase } from "@/data/checklist-templates";
import { storeFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

const DISCLAIMER = "Transaction checklist — tracking only. This export does not generate, fill or sign any form and is not legal advice. Verify every deadline against the executed contract. Business-day math skips weekends only.";

/** Export the checklist as PDF or XLSX. Records an approval and an export record, like the other module exports. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, exportChecklistSchema);
    const tx = db.select().from(transactions).where(eq(transactions.id, id)).get();
    if (!tx) throw new AppError("not_found", "Transaction not found.");
    const items = itemsFor(id);
    if (!items.length) throw new AppError("unprocessable", "This transaction has no checklist to export.");
    const tpl = tx.checklistTemplateId ? db.select().from(checklistTemplates).where(eq(checklistTemplates.id, tx.checklistTemplateId)).get() : null;
    const phaseName = Object.fromEntries(((tpl?.phases as TemplatePhase[] | undefined) ?? []).map((p) => [p.key, p.name]));
    const flagsOn = Object.entries((tx.flags ?? {}) as Partial<Record<Condition, boolean>>).filter(([, v]) => v).map(([k]) => CONDITION_LABELS[k as Condition] ?? k);
    const dates = [
      { label: tx.side === "buyer" ? "Representation agreement signed" : ANCHOR_LABELS.listing_signed, value: tx.listingSignedAt },
      { label: ANCHOR_LABELS.acceptance, value: tx.acceptanceAt },
      { label: ANCHOR_LABELS.coe, value: tx.coeAt },
      { label: ANCHOR_LABELS.disclosure_delivery, value: tx.disclosureDeliveredAt },
    ];
    const rows = items.map((i) => ({ phase: phaseName[i.phaseKey] ?? i.phaseKey, code: i.code, kind: i.kind, title: i.title, owner: i.owner, formCode: i.formCode, status: i.status, due: i.dueDate, override: i.dueOverride, authority: i.authority, notes: i.notes, completedAt: i.completedAt }));
    const slug = tx.address.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "transaction";

    let buffer: Buffer;
    let filename: string;
    if (input.format === "xlsx") {
      buffer = await buildChecklistWorkbook({ address: tx.address, side: tx.side, templateName: tpl?.name ?? "—", dates, flags: flagsOn, items: rows });
      filename = `${slug}-checklist.xlsx`;
    } else {
      const phases = [...new Set(items.map((i) => i.phaseKey))];
      buffer = await getPdfProvider().render({
        name: `${tx.address} — ${tx.side === "buyer" ? "Buyer" : "Seller"} checklist`,
        address: tx.address,
        brand: { name: "AgentOS · Transaction Checklist", disclaimer: DISCLAIMER },
        sections: [
          { title: "Key dates & conditions", paragraphs: [...dates.map((d) => `${d.label}: ${d.value ?? "—"}`), `Conditions on: ${flagsOn.join(", ") || "none"}`, `Template: ${tpl?.name ?? "—"} (v${tpl?.version ?? "?"})`] },
          ...phases.map((p) => ({
            title: phaseName[p] ?? p,
            table: { headers: ["Code", "Item", "Owner", "Form", "Status", "Due"], rows: items.filter((i) => i.phaseKey === p).map((i) => [i.code, i.title, i.owner, i.formCode ?? "", i.status, effectiveDue(i) ?? ""]) },
          })),
        ],
      });
      filename = `${slug}-checklist.pdf`;
    }

    const stored = storeFile("exports", filename, buffer);
    const approval = db.insert(approvals).values({ targetType: "checklist_export", targetId: id, label: `Checklist export (${input.format})`, approvedBy: input.approvedBy }).returning().get();
    const record = db.insert(exportRecords).values({ subjectType: "transaction_checklist", subjectId: id, format: input.format, storedPath: stored.storedPath, sha256: stored.sha256, byteSize: stored.byteSize, metadata: { approvalId: approval.id, items: items.length } }).returning().get();
    writeAudit({ action: "checklist.exported", entityType: "export_record", entityId: record.id, metadata: { transactionId: id, format: input.format, approvalId: approval.id, filename } });
    return ok({ export: record, approval, message: `Exported ${filename} to workspace/exports.` }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
