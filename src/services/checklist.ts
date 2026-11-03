import "server-only";
import { and, asc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { sourceDocuments, tasks, deals } from "@/db/schema";
import { transactions } from "@/db/schema.dashboard";
import { checklistItems, checklistTemplates, type ChecklistItemRow } from "@/db/schema.checklists";
import { TEMPLATES, type ChecklistTemplate, type Side, type TemplatePhase } from "@/data/checklist-templates";
import { buildItems, effectiveDue, summarize, type AnchorDates, type ChecklistSummary, type Flags, type ItemStatus } from "@/lib/checklist";
import { planFlagChange, planRecompute } from "@/lib/checklist-recompute";
import { writeAudit } from "@/lib/audit";
import { AppError } from "@/lib/errors";

/**
 * Transaction checklist service — the only code that writes checklist rows.
 * The checklist tracks and reminds. It never generates, fills or signs a form
 * and never contacts Follow Up Boss directly: `pushToFub` only creates a LOCAL
 * draft task (`origin: "local"`, `syncedToFub: false`) that the agent approves
 * on the Follow Up Boss screen. Every mutation writes an audit row.
 */

const nowIso = () => new Date().toISOString();
export const todayYmd = () => new Date().toISOString().slice(0, 10);

type TxRow = typeof transactions.$inferSelect;

function anchorDates(tx: TxRow): AnchorDates {
  return { listing_signed: tx.listingSignedAt, acceptance: tx.acceptanceAt, coe: tx.coeAt, disclosure_delivery: tx.disclosureDeliveredAt };
}

function getTx(transactionId: string): TxRow {
  const tx = db.select().from(transactions).where(eq(transactions.id, transactionId)).get();
  if (!tx) throw new AppError("not_found", "Transaction not found.");
  return tx;
}

function templateRow(id: string) {
  const row = db.select().from(checklistTemplates).where(eq(checklistTemplates.id, id)).get();
  if (!row) throw new AppError("not_found", "Checklist template not found.");
  return row;
}

const asTemplate = (row: typeof checklistTemplates.$inferSelect): ChecklistTemplate => ({ key: row.key, side: row.side as Side, name: row.name, version: row.version, phases: row.phases as TemplatePhase[] });

/** Make sure the seed templates exist (idempotent upsert by key; keeps brokerage edits to `phases`). */
export function ensureTemplates(): void {
  for (const t of TEMPLATES) {
    const existing = db.select().from(checklistTemplates).where(eq(checklistTemplates.key, t.key)).get();
    if (!existing) db.insert(checklistTemplates).values({ key: t.key, side: t.side, name: t.name, version: t.version, phases: t.phases, isDefault: true }).run();
  }
}

export function listTemplates() {
  ensureTemplates();
  return db.select().from(checklistTemplates).orderBy(asc(checklistTemplates.side)).all();
}

function defaultTemplateFor(side: string, templateKey?: string) {
  ensureTemplates();
  const row = templateKey
    ? db.select().from(checklistTemplates).where(eq(checklistTemplates.key, templateKey)).get()
    : db.select().from(checklistTemplates).where(and(eq(checklistTemplates.side, side), eq(checklistTemplates.isDefault, true))).get();
  if (!row) throw new AppError("not_found", templateKey ? `No checklist template "${templateKey}".` : `No default checklist template for the ${side} side.`);
  return row;
}

export function itemsFor(transactionId: string): ChecklistItemRow[] {
  return db.select().from(checklistItems).where(eq(checklistItems.transactionId, transactionId)).orderBy(asc(checklistItems.phaseOrder), asc(checklistItems.sortOrder)).all();
}

export function phaseNamesFor(tx: TxRow): Record<string, string> {
  if (!tx.checklistTemplateId) return {};
  const row = db.select().from(checklistTemplates).where(eq(checklistTemplates.id, tx.checklistTemplateId)).get();
  return Object.fromEntries(((row?.phases as TemplatePhase[] | undefined) ?? []).map((p) => [p.key, p.name]));
}

export function summaryFor(tx: TxRow, items = itemsFor(tx.id)): ChecklistSummary {
  return summarize(items, todayYmd(), phaseNamesFor(tx));
}

/** Instantiate the checklist for a transaction. Refuses (409) when rows exist unless `reset`. */
export function instantiateChecklist(transactionId: string, opts: { templateKey?: string; reset?: boolean } = {}) {
  const tx = getTx(transactionId);
  const existing = itemsFor(transactionId);
  if (existing.length && !opts.reset) throw new AppError("conflict", "This transaction already has a checklist. Pass reset: true to rebuild it (progress will be lost).");
  const tpl = defaultTemplateFor(tx.side, opts.templateKey);
  const built = buildItems(asTemplate(tpl), (tx.flags ?? {}) as Flags, anchorDates(tx));
  db.transaction((trx) => {
    if (existing.length) trx.delete(checklistItems).where(eq(checklistItems.transactionId, transactionId)).run();
    for (const b of built) trx.insert(checklistItems).values({ ...b, transactionId, templateId: tpl.id }).run();
    trx.update(transactions).set({ checklistTemplateId: tpl.id }).where(eq(transactions.id, transactionId)).run();
  });
  writeAudit({ action: "checklist.instantiated", entityType: "transaction", entityId: transactionId, metadata: { templateKey: tpl.key, version: tpl.version, items: built.length, reset: !!opts.reset && existing.length > 0 } });
  return { template: tpl, items: itemsFor(transactionId) };
}

/** Re-run the due-date rules after an anchor date changed. Overrides and done items are never touched. */
export function recomputeDueDates(transactionId: string): { updated: number } {
  const tx = getTx(transactionId);
  if (!tx.checklistTemplateId) return { updated: 0 };
  const tpl = asTemplate(templateRow(tx.checklistTemplateId));
  const plan = planRecompute(tpl, itemsFor(transactionId), anchorDates(tx));
  const stamp = nowIso();
  db.transaction((trx) => {
    for (const p of plan) trx.update(checklistItems).set({ dueDate: p.dueDate, updatedAt: stamp }).where(eq(checklistItems.id, p.id)).run();
  });
  if (plan.length) writeAudit({ action: "checklist.item_updated", entityType: "transaction", entityId: transactionId, metadata: { reason: "recompute_due_dates", updated: plan.length } });
  return { updated: plan.length };
}

/** Apply a flags change: add newly applicable items, mark no-longer-applicable pending items `na`, revive `na` items that apply again. */
export function updateFlags(transactionId: string, flags: Flags): { added: number; markedNa: number; revived: number } {
  const tx = getTx(transactionId);
  const merged: Flags = { ...((tx.flags ?? {}) as Flags), ...flags };
  db.update(transactions).set({ flags: merged }).where(eq(transactions.id, transactionId)).run();
  if (!tx.checklistTemplateId) return { added: 0, markedNa: 0, revived: 0 };
  const tplRow = templateRow(tx.checklistTemplateId);
  const plan = planFlagChange(asTemplate(tplRow), itemsFor(transactionId), merged, anchorDates({ ...tx, flags: merged }));
  const stamp = nowIso();
  db.transaction((trx) => {
    for (const b of plan.add) trx.insert(checklistItems).values({ ...b, transactionId, templateId: tplRow.id }).run();
    if (plan.markNa.length) trx.update(checklistItems).set({ status: "na", updatedAt: stamp }).where(inArray(checklistItems.id, plan.markNa)).run();
    if (plan.revive.length) trx.update(checklistItems).set({ status: "pending", updatedAt: stamp }).where(inArray(checklistItems.id, plan.revive)).run();
  });
  writeAudit({ action: "checklist.item_updated", entityType: "transaction", entityId: transactionId, metadata: { reason: "flags", flags: merged, added: plan.add.length, markedNa: plan.markNa.length, revived: plan.revive.length } });
  return { added: plan.add.length, markedNa: plan.markNa.length, revived: plan.revive.length };
}

export interface ItemPatch { status?: ItemStatus; dueOverride?: string | null; notes?: string | null; sourceDocumentId?: string | null }

export function getItem(itemId: string): ChecklistItemRow {
  const row = db.select().from(checklistItems).where(eq(checklistItems.id, itemId)).get();
  if (!row) throw new AppError("not_found", "Checklist item not found.");
  return row;
}

/** Patch one item. Setting status "done" stamps completedAt; leaving "done" clears it. */
export function updateItem(itemId: string, patch: ItemPatch): ChecklistItemRow {
  const row = getItem(itemId);
  const set: Partial<ChecklistItemRow> = { updatedAt: nowIso() };
  if (patch.status !== undefined) {
    set.status = patch.status;
    set.completedAt = patch.status === "done" ? (row.status === "done" ? row.completedAt : nowIso()) : null;
  }
  if (patch.dueOverride !== undefined) set.dueOverride = patch.dueOverride;
  if (patch.notes !== undefined) set.notes = patch.notes;
  if (patch.sourceDocumentId !== undefined) set.sourceDocumentId = patch.sourceDocumentId;
  const updated = db.update(checklistItems).set(set).where(eq(checklistItems.id, itemId)).returning().get();
  writeAudit({ action: "checklist.item_updated", entityType: "checklist_item", entityId: itemId, metadata: { transactionId: row.transactionId, code: row.code, patch } });
  return updated;
}

/** Link a received document (a `source_documents` row) and mark the item done. */
export function attachDocument(itemId: string, sourceDocumentId: string): ChecklistItemRow {
  const row = getItem(itemId);
  const doc = db.select().from(sourceDocuments).where(eq(sourceDocuments.id, sourceDocumentId)).get();
  if (!doc) throw new AppError("not_found", "Source document not found.");
  const updated = db.update(checklistItems).set({ sourceDocumentId, status: "done", completedAt: row.completedAt ?? nowIso(), updatedAt: nowIso() }).where(eq(checklistItems.id, itemId)).returning().get();
  writeAudit({ action: "checklist.document_attached", entityType: "checklist_item", entityId: itemId, metadata: { transactionId: row.transactionId, code: row.code, sourceDocumentId, kind: doc.kind, filename: doc.filename } });
  return updated;
}

/**
 * Create a LOCAL draft task for the item. It is pushed to Follow Up Boss only
 * when the agent approves it on the FUB screen — this function never calls the
 * FUB adapter. `dealId` is set only when the transaction's `fubDealId` maps to
 * a local deal row (deals are linked by FUB id, never by name).
 */
export function pushToFub(itemId: string) {
  const row = getItem(itemId);
  if (row.taskId) {
    const existing = db.select().from(tasks).where(eq(tasks.id, row.taskId)).get();
    if (existing) return { item: row, task: existing, created: false };
  }
  const tx = getTx(row.transactionId);
  const deal = tx.fubDealId ? db.select().from(deals).where(eq(deals.fubId, tx.fubDealId)).get() : undefined;
  const due = effectiveDue(row);
  const task = db
    .insert(tasks)
    .values({ dealId: deal?.id ?? null, contactId: tx.contactId ?? null, title: row.title, body: `Transaction checklist · ${tx.address} · ${row.code}`, dueAt: due, origin: "local", syncedToFub: false })
    .returning()
    .get();
  const item = db.update(checklistItems).set({ taskId: task.id, updatedAt: nowIso() }).where(eq(checklistItems.id, itemId)).returning().get();
  writeAudit({ action: "checklist.pushed_to_fub", entityType: "checklist_item", entityId: itemId, metadata: { transactionId: tx.id, taskId: task.id, dealId: deal?.id ?? null, dueAt: due, draft: true } });
  return { item, task, created: true };
}

/** Items with an effective due date in [from, to] across active/pending transactions (the Today screen). */
export function dueBetween(from: string, to: string) {
  const activeTx = db.select().from(transactions).where(or(eq(transactions.status, "active"), eq(transactions.status, "pending"))).all();
  if (!activeTx.length) return [];
  const byId = new Map(activeTx.map((t) => [t.id, t]));
  const rows = db
    .select()
    .from(checklistItems)
    .where(and(inArray(checklistItems.transactionId, activeTx.map((t) => t.id)), eq(checklistItems.status, "pending"), or(and(gte(checklistItems.dueOverride, from), lte(checklistItems.dueOverride, to)), and(gte(checklistItems.dueDate, from), lte(checklistItems.dueDate, to)))))
    .all();
  return rows
    .map((r) => ({ ...r, due: effectiveDue(r), transaction: { id: r.transactionId, address: byId.get(r.transactionId)?.address ?? "", side: byId.get(r.transactionId)?.side ?? "" } }))
    .filter((r) => r.due && r.due >= from && r.due <= to)
    .sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : a.sortOrder - b.sortOrder));
}
