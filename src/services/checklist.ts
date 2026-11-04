import "server-only";
import { and, asc, eq, gte, inArray, lte, or } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { TEMPLATES, type ChecklistTemplate, type Side, type TemplatePhase } from "@/data/checklist-templates";
import { buildItems, effectiveDue, summarize, type AnchorDates, type ChecklistSummary, type Flags, type ItemStatus } from "@/lib/checklist";
import { planFlagChange, planRecompute } from "@/lib/checklist-recompute";
import { daysUntil, ymd } from "@/lib/dates";
import { AppError } from "@/lib/errors";
import { loadContext } from "./context";

/**
 * Transaction checklist — the California seller/buyer checklist attached to a
 * transaction. The only code that writes checklist rows. It tracks and reminds:
 * nothing here generates, fills or sends a form. "Add to tasks" creates an
 * ordinary task on the to-do list so the deadline shows up with everything else.
 */

type TxRow = typeof s.transactions.$inferSelect;
const nowIso = () => new Date().toISOString();

/** Seller-side ("seller" or "both") transactions use the listing template. */
export const templateSideFor = (txSide: string): Side => (txSide === "buyer" ? "buyer" : "listing");

/** Anchor dates: acceptance falls back to the escrow-opened date; close of escrow is the closing date. */
export function anchorDates(tx: Pick<TxRow, "listingSignedAt" | "acceptanceAt" | "escrowOpenedAt" | "closingDate" | "disclosureDeliveredAt">): AnchorDates {
  return { listing_signed: tx.listingSignedAt, acceptance: tx.acceptanceAt ?? tx.escrowOpenedAt, coe: tx.closingDate, disclosure_delivery: tx.disclosureDeliveredAt };
}

function getTx(id: string): TxRow {
  const tx = db.select().from(s.transactions).where(eq(s.transactions.id, id)).get();
  if (!tx) throw new AppError("not_found", "Transaction not found.");
  return tx;
}
const asTemplate = (row: typeof s.checklistTemplates.$inferSelect): ChecklistTemplate => ({ key: row.key, side: row.side as Side, name: row.name, version: row.version, phases: row.phases as TemplatePhase[] });

/** Make sure the two seed templates exist (keeps any edits a brokerage made to `phases`). */
export function ensureTemplates() {
  for (const t of TEMPLATES) {
    if (!db.select().from(s.checklistTemplates).where(eq(s.checklistTemplates.key, t.key)).get()) db.insert(s.checklistTemplates).values({ id: `tpl-${t.key}`, key: t.key, side: t.side, name: t.name, version: t.version, phases: t.phases, isDefault: true }).run();
  }
}
function defaultTemplate(side: Side, key?: string) {
  ensureTemplates();
  const row = key ? db.select().from(s.checklistTemplates).where(eq(s.checklistTemplates.key, key)).get() : db.select().from(s.checklistTemplates).where(and(eq(s.checklistTemplates.side, side), eq(s.checklistTemplates.isDefault, true))).get();
  if (!row) throw new AppError("not_found", "No checklist template for this side.");
  return row;
}
function templateRow(id: string) {
  const row = db.select().from(s.checklistTemplates).where(eq(s.checklistTemplates.id, id)).get();
  if (!row) throw new AppError("not_found", "Checklist template not found.");
  return row;
}

export const itemsFor = (transactionId: string) => db.select().from(s.checklistItems).where(eq(s.checklistItems.transactionId, transactionId)).orderBy(asc(s.checklistItems.phaseOrder), asc(s.checklistItems.sortOrder)).all();

export function phaseNamesFor(tx: TxRow): Record<string, string> {
  const row = tx.checklistTemplateId ? db.select().from(s.checklistTemplates).where(eq(s.checklistTemplates.id, tx.checklistTemplateId)).get() : null;
  return Object.fromEntries(((row?.phases as TemplatePhase[] | undefined) ?? []).map((p) => [p.key, p.name]));
}
export const summaryFor = (tx: TxRow, items = itemsFor(tx.id)): ChecklistSummary => summarize(items, ymd(), phaseNamesFor(tx));

/** Build the checklist for a transaction. Refuses when one exists unless `reset`. */
export function instantiateChecklist(transactionId: string, opts: { templateKey?: string; reset?: boolean } = {}) {
  const tx = getTx(transactionId);
  const existing = itemsFor(transactionId);
  if (existing.length && !opts.reset) throw new AppError("conflict", "This transaction already has a checklist. Reset it to rebuild (progress is lost).");
  const tpl = defaultTemplate(templateSideFor(tx.side), opts.templateKey);
  const built = buildItems(asTemplate(tpl), (tx.flags ?? {}) as Flags, anchorDates(tx));
  db.transaction((trx) => {
    if (existing.length) trx.delete(s.checklistItems).where(eq(s.checklistItems.transactionId, transactionId)).run();
    for (const b of built) trx.insert(s.checklistItems).values({ ...b, transactionId, templateId: tpl.id }).run();
    trx.update(s.transactions).set({ checklistTemplateId: tpl.id, updatedAt: nowIso() }).where(eq(s.transactions.id, transactionId)).run();
  });
  db.insert(s.activities).values({ contactId: tx.contactId ?? null, type: "system", summary: `${existing.length ? "Rebuilt" : "Started"} the ${tpl.name} checklist (${built.length} items)`, refType: "transaction", refId: transactionId, occurredAt: nowIso() }).run();
  return { template: tpl, items: itemsFor(transactionId) };
}

/** Re-run due-date rules after a date changed. Overrides and done items are never touched. */
export function recomputeDueDates(transactionId: string): number {
  const tx = getTx(transactionId);
  if (!tx.checklistTemplateId) return 0;
  const plan = planRecompute(asTemplate(templateRow(tx.checklistTemplateId)), itemsFor(transactionId), anchorDates(tx));
  db.transaction((trx) => { for (const p of plan) trx.update(s.checklistItems).set({ dueDate: p.dueDate, updatedAt: nowIso() }).where(eq(s.checklistItems.id, p.id)).run(); });
  return plan.length;
}

/** Apply the transaction's (already saved) flags: add newly applicable items, retire pending ones, revive na ones. */
export function applyFlags(transactionId: string): { added: number; markedNa: number; revived: number } {
  const tx = getTx(transactionId);
  if (!tx.checklistTemplateId) return { added: 0, markedNa: 0, revived: 0 };
  const tplRow = templateRow(tx.checklistTemplateId);
  const plan = planFlagChange(asTemplate(tplRow), itemsFor(transactionId), (tx.flags ?? {}) as Flags, anchorDates(tx));
  db.transaction((trx) => {
    for (const b of plan.add) trx.insert(s.checklistItems).values({ ...b, transactionId, templateId: tplRow.id }).run();
    if (plan.markNa.length) trx.update(s.checklistItems).set({ status: "na", updatedAt: nowIso() }).where(inArray(s.checklistItems.id, plan.markNa)).run();
    if (plan.revive.length) trx.update(s.checklistItems).set({ status: "pending", updatedAt: nowIso() }).where(inArray(s.checklistItems.id, plan.revive)).run();
  });
  return { added: plan.add.length, markedNa: plan.markNa.length, revived: plan.revive.length };
}

export function getItem(id: string) {
  const row = db.select().from(s.checklistItems).where(eq(s.checklistItems.id, id)).get();
  if (!row) throw new AppError("not_found", "Checklist item not found.");
  return row;
}

export interface ItemPatch { status?: ItemStatus; dueOverride?: string | null; notes?: string | null }
export function updateItem(id: string, patch: ItemPatch) {
  const row = getItem(id);
  const set: Partial<typeof row> = { updatedAt: nowIso() };
  if (patch.status !== undefined) { set.status = patch.status; set.completedAt = patch.status === "done" ? (row.completedAt ?? nowIso()) : null; }
  if (patch.dueOverride !== undefined) set.dueOverride = patch.dueOverride;
  if (patch.notes !== undefined) set.notes = patch.notes;
  const updated = db.update(s.checklistItems).set(set).where(eq(s.checklistItems.id, id)).returning().get();
  // Keep a linked task in step: completing the item completes the task.
  if (patch.status === "done" && row.taskId) db.update(s.tasks).set({ completedAt: nowIso(), updatedAt: nowIso() }).where(and(eq(s.tasks.id, row.taskId), eq(s.tasks.completedAt, null as unknown as string))).run();
  return updated;
}

/** Add the item to the to-do list as a real task (shows in Tasks and Today's Priorities). Idempotent. */
export function addTask(itemId: string) {
  const row = getItem(itemId);
  if (row.taskId) { const existing = db.select().from(s.tasks).where(eq(s.tasks.id, row.taskId)).get(); if (existing) return { item: row, task: existing, created: false }; }
  const tx = getTx(row.transactionId);
  const due = effectiveDue(row);
  const d = due ? daysUntil(due) : null;
  const task = db.insert(s.tasks).values({ title: row.title, category: "escrow", priority: d != null && d <= 3 ? "critical" : d != null && d <= 7 ? "high" : "medium", dueDate: due, contactId: tx.contactId ?? null, propertyId: tx.propertyId, transactionId: tx.id, notes: `Checklist ${row.code}${row.formCode ? ` · C.A.R. ${row.formCode}` : ""}` }).returning().get();
  const item = db.update(s.checklistItems).set({ taskId: task.id, updatedAt: nowIso() }).where(eq(s.checklistItems.id, itemId)).returning().get();
  return { item, task, created: true };
}

/** Everything the Checklist page needs for one transaction. */
export function checklistDetail(transactionId: string) {
  const tx = getTx(transactionId);
  const ctx = loadContext();
  const p = ctx.property(tx.propertyId);
  const items = itemsFor(transactionId);
  const tpl = tx.checklistTemplateId ? db.select().from(s.checklistTemplates).where(eq(s.checklistTemplates.id, tx.checklistTemplateId)).get() : null;
  const taskIds = items.map((i) => i.taskId).filter((t): t is string => !!t);
  const taskRows = taskIds.length ? db.select().from(s.tasks).where(inArray(s.tasks.id, taskIds)).all() : [];
  return {
    transaction: { ...tx, address: p?.address ?? "—", city: p?.city ?? "", photoUrl: p?.photoUrl ?? null, contactName: ctx.names(tx.contactId), anchors: anchorDates(tx) },
    template: tpl ? { id: tpl.id, key: tpl.key, name: tpl.name, version: tpl.version, phases: (tpl.phases as TemplatePhase[]).map((ph) => ({ key: ph.key, name: ph.name, order: ph.order })) } : null,
    items: items.map((i) => ({ ...i, task: taskRows.find((t) => t.id === i.taskId) ?? null })),
    summary: summaryFor(tx, items),
  };
}

/** Escrow transactions with checklist progress (the Checklist page list). */
export function checklistList() {
  const ctx = loadContext();
  return db.select().from(s.transactions).where(eq(s.transactions.status, "escrow")).all()
    .map((tx) => { const items = itemsFor(tx.id); const p = ctx.property(tx.propertyId); return { id: tx.id, side: tx.side, status: tx.status, address: p?.address ?? "—", city: p?.city ?? "", photoUrl: p?.photoUrl ?? null, contactName: ctx.names(tx.contactId), closingDate: tx.closingDate, checklist: items.length ? summaryFor(tx, items) : null }; })
    .sort((a, b) => (a.closingDate ?? "").localeCompare(b.closingDate ?? ""));
}

/** Open items with an effective due date in [from, to] across escrows (dashboard priorities). */
export function dueBetween(from: string, to: string) {
  const escrows = db.select().from(s.transactions).where(eq(s.transactions.status, "escrow")).all();
  if (!escrows.length) return [];
  const ctx = loadContext();
  const byId = new Map(escrows.map((t) => [t.id, t]));
  return db.select().from(s.checklistItems)
    .where(and(inArray(s.checklistItems.transactionId, escrows.map((t) => t.id)), eq(s.checklistItems.status, "pending"), or(and(gte(s.checklistItems.dueOverride, from), lte(s.checklistItems.dueOverride, to)), and(gte(s.checklistItems.dueDate, from), lte(s.checklistItems.dueDate, to)))))
    .all()
    .map((r) => ({ ...r, due: effectiveDue(r)!, address: ctx.addresses(byId.get(r.transactionId)?.propertyId ?? null) }))
    .filter((r) => r.due >= from && r.due <= to)
    .sort((a, b) => a.due.localeCompare(b.due) || a.sortOrder - b.sortOrder);
}
