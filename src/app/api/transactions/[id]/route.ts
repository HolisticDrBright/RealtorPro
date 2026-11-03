import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, sourceDocuments, tasks } from "@/db/schema";
import { transactions } from "@/db/schema.dashboard";
import { checklistTemplates } from "@/db/schema.checklists";
import { readJson } from "@/lib/api";
import { patchTransactionSchema } from "@/lib/validation.checklist";
import { itemsFor, recomputeDueDates, summaryFor, updateFlags } from "@/services/checklist";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";
import type { TemplatePhase } from "@/data/checklist-templates";

export const runtime = "nodejs";

function detail(id: string) {
  const tx = db.select().from(transactions).where(eq(transactions.id, id)).get();
  if (!tx) throw new AppError("not_found", "Transaction not found.");
  const contact = tx.contactId ? db.select({ id: contacts.id, name: contacts.name, fubId: contacts.fubId }).from(contacts).where(eq(contacts.id, tx.contactId)).get() : null;
  const items = itemsFor(id);
  const tpl = tx.checklistTemplateId ? db.select().from(checklistTemplates).where(eq(checklistTemplates.id, tx.checklistTemplateId)).get() : null;
  const taskIds = items.map((i) => i.taskId).filter((t): t is string => !!t);
  const docIds = items.map((i) => i.sourceDocumentId).filter((t): t is string => !!t);
  const taskRows = taskIds.length ? db.select().from(tasks).all().filter((t) => taskIds.includes(t.id)) : [];
  const docRows = docIds.length ? db.select({ id: sourceDocuments.id, filename: sourceDocuments.filename, kind: sourceDocuments.kind, createdAt: sourceDocuments.createdAt }).from(sourceDocuments).all().filter((d) => docIds.includes(d.id)) : [];
  return {
    transaction: { ...tx, contactName: contact?.name ?? null, contactFubId: contact?.fubId ?? null },
    template: tpl ? { id: tpl.id, key: tpl.key, name: tpl.name, version: tpl.version, phases: (tpl.phases as TemplatePhase[]).map((p) => ({ key: p.key, name: p.name, order: p.order })) } : null,
    items: items.map((i) => ({ ...i, task: taskRows.find((t) => t.id === i.taskId) ?? null, document: docRows.find((d) => d.id === i.sourceDocumentId) ?? null })),
    summary: summaryFor(tx, items),
  };
}

/** Transaction detail with its checklist: { transaction, template, items, summary }. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return ok(detail(id));
  } catch (err) {
    return errorResponse(err);
  }
}

const DATE_KEYS = ["listingSignedAt", "acceptanceAt", "coeAt", "disclosureDeliveredAt"] as const;

/** Patch dates / flags / stage. A date change recomputes due dates; a flags change adds or retires conditional items. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { flags, ...fields } = await readJson(req, patchTransactionSchema);
    const existing = db.select().from(transactions).where(eq(transactions.id, id)).get();
    if (!existing) throw new AppError("not_found", "Transaction not found.");
    const changedKeys = Object.keys(fields);
    if (changedKeys.length) db.update(transactions).set(fields).where(eq(transactions.id, id)).run();
    const datesChanged = DATE_KEYS.some((k) => k in fields && fields[k] !== existing[k]);
    const recompute = datesChanged ? recomputeDueDates(id) : { updated: 0 };
    const flagResult = flags ? updateFlags(id, flags) : null;
    writeAudit({ action: "transaction.updated", entityType: "transaction", entityId: id, metadata: { fields: changedKeys, flags: flags ?? null, recomputed: recompute.updated, flagResult } });
    return ok({ ...detail(id), recomputed: recompute.updated, flagResult });
  } catch (err) {
    return errorResponse(err);
  }
}
