import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { addDays, nextRecurrence, ymd } from "@/lib/dates";
import { estCommission } from "@/lib/calc";
import type { EntityName } from "@/lib/registry";

/**
 * Side effects that keep the model coherent: a completed call updates the
 * contact's last-contact date, a listing moving to escrow opens a transaction,
 * a closed transaction updates the client and the listing, and so on. All are
 * explicit and small so the flow is easy to follow.
 */

type Row = Record<string, unknown>;
const now = () => new Date().toISOString();

export function logActivity(a: { contactId?: string | null; type: string; summary: string; refType?: string; refId?: string }) {
  db.insert(s.activities).values({ contactId: a.contactId ?? null, type: a.type, summary: a.summary, refType: a.refType ?? null, refId: a.refId ?? null, occurredAt: now() }).run();
}
export function notify(n: { title: string; body?: string; kind?: string; href?: string }) {
  db.insert(s.notifications).values({ title: n.title, body: n.body ?? null, kind: n.kind ?? "info", href: n.href ?? null }).run();
}
const touch = (contactId: string | null | undefined) => contactId && db.update(s.contacts).set({ lastContactAt: now(), updatedAt: now() }).where(eq(s.contacts.id, contactId)).run();
const addr = (propertyId: string | null | undefined) => (propertyId ? db.select().from(s.properties).where(eq(s.properties.id, propertyId)).get()?.address ?? "property" : "property");
const who = (contactId: string | null | undefined) => { if (!contactId) return null; const c = db.select().from(s.contacts).where(eq(s.contacts.id, contactId)).get(); return c ? `${c.firstName} ${c.lastName}`.trim() : null; };

export function defaultMilestones(transactionId: string, escrowOpenedAt: string, closingDate: string | null) {
  const open = new Date(escrowOpenedAt + "T12:00:00");
  const close = closingDate ? new Date(closingDate + "T12:00:00") : addDays(open, 30);
  const span = Math.max(10, Math.round((close.getTime() - open.getTime()) / 86400000));
  const at = (f: number) => ymd(addDays(open, Math.round(span * f)));
  const plan: [string, string][] = [
    ["Offer Accepted", ymd(open)], ["Deposit Due", at(0.1)], ["Inspection", at(0.25)], ["Inspection Contingency", at(0.4)], ["Appraisal", at(0.4)], ["Loan Contingency", at(0.55)],
    ["Seller Disclosures", at(0.2)], ["Repair Requests", at(0.45)], ["Final Walkthrough", at(0.93)], ["Contingency Removal", at(0.6)], ["Closing", ymd(close)],
  ];
  plan.forEach(([name, dueDate], i) => db.insert(s.milestones).values({ transactionId, name, dueDate, sortOrder: i, completedAt: i === 0 ? now() : null }).run());
}

export function afterCreate(entity: EntityName, row: Row) {
  switch (entity) {
    case "buyers": db.update(s.contacts).set({ type: "buyer", updatedAt: now() }).where(and(eq(s.contacts.id, row.contactId as string), eq(s.contacts.type, "lead"))).run(); break;
    case "sellers": db.update(s.contacts).set({ type: "seller", updatedAt: now() }).where(and(eq(s.contacts.id, row.contactId as string), eq(s.contacts.type, "lead"))).run(); break;
    case "notes": if (row.contactId) logActivity({ contactId: row.contactId as string, type: "note", summary: String(row.body).slice(0, 140), refType: "note", refId: row.id as string }); break;
    case "appointments": if (row.contactId) logActivity({ contactId: row.contactId as string, type: row.type === "showing" ? "showing" : "meeting", summary: `Scheduled: ${row.title}`, refType: "appointment", refId: row.id as string }); break;
    case "offers": if (row.contactId) { logActivity({ contactId: row.contactId as string, type: "offer", summary: `Offer ${row.status} on ${addr(row.propertyId as string)} at $${Number(row.offerPrice).toLocaleString()}`, refType: "offer", refId: row.id as string }); db.update(s.buyers).set({ offersMade: (db.select().from(s.buyers).where(eq(s.buyers.contactId, row.contactId as string)).get()?.offersMade ?? 0) + 1 }).where(eq(s.buyers.contactId, row.contactId as string)).run(); } break;
    case "transactions": {
      const existing = db.select().from(s.milestones).where(eq(s.milestones.transactionId, row.id as string)).all();
      if (existing.length === 0 && row.status === "escrow") defaultMilestones(row.id as string, (row.escrowOpenedAt as string) ?? ymd(), (row.closingDate as string) ?? null);
      if (row.contactId) { db.update(s.contacts).set({ stage: row.status === "closed" ? "closed" : "in_escrow", updatedAt: now() }).where(eq(s.contacts.id, row.contactId as string)).run(); logActivity({ contactId: row.contactId as string, type: "transaction", summary: `${row.status === "closed" ? "Closed" : "Opened escrow on"} ${addr(row.propertyId as string)}`, refType: "transaction", refId: row.id as string }); }
      if (row.listingId) db.update(s.listings).set({ status: row.status === "closed" ? "closed" : "in_escrow", updatedAt: now() }).where(eq(s.listings.id, row.listingId as string)).run();
      break;
    }
    case "listings": if (row.sellerContactId) db.update(s.contacts).set({ stage: "active_seller", updatedAt: now() }).where(and(eq(s.contacts.id, row.sellerContactId as string), eq(s.contacts.stage, "new_lead"))).run(); break;
  }
}

export function afterUpdate(entity: EntityName, before: Row, after: Row) {
  switch (entity) {
    case "tasks":
      if (!before.completedAt && after.completedAt) {
        if (after.contactId) logActivity({ contactId: after.contactId as string, type: "task", summary: `Completed: ${after.title}`, refType: "task", refId: after.id as string });
        const next = after.recurrence !== "none" && after.dueDate ? nextRecurrence(after.dueDate as string, after.recurrence as string) : null;
        if (next) db.insert(s.tasks).values({ title: after.title as string, category: after.category as string, priority: after.priority as string, dueDate: next, dueTime: (after.dueTime as string) ?? null, contactId: (after.contactId as string) ?? null, propertyId: (after.propertyId as string) ?? null, transactionId: (after.transactionId as string) ?? null, recurrence: after.recurrence as string, notes: (after.notes as string) ?? null }).run();
      }
      break;
    case "calls":
      if (before.status !== "completed" && after.status === "completed") { touch(after.contactId as string); logActivity({ contactId: after.contactId as string, type: "call", summary: `Call${after.reason ? ` — ${after.reason}` : ""}${after.outcome ? `: ${after.outcome}` : ""}`, refType: "call", refId: after.id as string }); }
      break;
    case "contacts":
      if (before.stage !== after.stage) logActivity({ contactId: after.id as string, type: "system", summary: `Moved to ${String(after.stage).replace(/_/g, " ")}`, refType: "contact", refId: after.id as string });
      break;
    case "buyers":
      if (before.temperature !== after.temperature) logActivity({ contactId: after.contactId as string, type: "system", summary: `Buyer temperature → ${String(after.temperature).toUpperCase()}` });
      break;
    case "listings":
      if (before.status !== after.status) {
        if (after.sellerContactId) logActivity({ contactId: after.sellerContactId as string, type: "system", summary: `Listing ${addr(after.propertyId as string)} → ${String(after.status).replace(/_/g, " ")}` });
        if (after.status === "in_escrow") {
          const tx = db.select().from(s.transactions).where(and(eq(s.transactions.listingId, after.id as string), eq(s.transactions.status, "escrow"))).get();
          if (!tx) {
            const open = ymd();
            const closing = ymd(addDays(new Date(), 30));
            const created = db.insert(s.transactions).values({ propertyId: after.propertyId as string, listingId: after.id as string, contactId: (after.sellerContactId as string) ?? null, side: "seller", status: "escrow", purchasePrice: Number(after.listPrice), commissionPct: Number(after.commissionPct ?? 2.5), escrowOpenedAt: open, closingDate: closing }).returning().get();
            defaultMilestones(created.id, open, closing);
            if (after.sellerContactId) db.update(s.contacts).set({ stage: "in_escrow", updatedAt: now() }).where(eq(s.contacts.id, after.sellerContactId as string)).run();
            notify({ title: `Escrow opened — ${addr(after.propertyId as string)}`, body: `Transaction created from the listing at $${Number(after.listPrice).toLocaleString()} · est. GCI $${estCommission(Number(after.listPrice), Number(after.commissionPct ?? 2.5)).toLocaleString()}. Review the timeline.`, kind: "success", href: "/transactions" });
          }
        }
        if (after.status === "offer_received") notify({ title: `Offer received — ${addr(after.propertyId as string)}`, kind: "info", href: "/offers" });
      }
      break;
    case "transactions":
      if (before.status !== "closed" && after.status === "closed") {
        if (!after.closedAt) db.update(s.transactions).set({ closedAt: ymd(), updatedAt: now() }).where(eq(s.transactions.id, after.id as string)).run();
        if (after.listingId) db.update(s.listings).set({ status: "closed", updatedAt: now() }).where(eq(s.listings.id, after.listingId as string)).run();
        if (after.contactId) { db.update(s.contacts).set({ type: "past_client", stage: "closed", updatedAt: now() }).where(eq(s.contacts.id, after.contactId as string)).run(); logActivity({ contactId: after.contactId as string, type: "transaction", summary: `Closed ${addr(after.propertyId as string)} at $${Number(after.purchasePrice).toLocaleString()}`, refType: "transaction", refId: after.id as string }); db.update(s.buyers).set({ status: "closed" }).where(eq(s.buyers.contactId, after.contactId as string)).run(); }
        db.update(s.milestones).set({ completedAt: now() }).where(and(eq(s.milestones.transactionId, after.id as string), isNull(s.milestones.completedAt))).run();
        notify({ title: `Closed — ${addr(after.propertyId as string)}`, body: "YTD volume, GCI, net income and goal progress updated.", kind: "success", href: "/income" });
      }
      if (before.status !== "cancelled" && after.status === "cancelled" && after.listingId) db.update(s.listings).set({ status: "active", updatedAt: now() }).where(eq(s.listings.id, after.listingId as string)).run();
      break;
    case "offers":
      if (before.status !== after.status && after.contactId) {
        logActivity({ contactId: after.contactId as string, type: "offer", summary: `Offer on ${addr(after.propertyId as string)} → ${after.status}`, refType: "offer", refId: after.id as string });
        const stage = after.status === "accepted" ? "in_escrow" : after.status === "countered" ? "negotiating" : after.status === "submitted" ? "offer_submitted" : null;
        if (stage) db.update(s.contacts).set({ stage, updatedAt: now() }).where(eq(s.contacts.id, after.contactId as string)).run();
        if (after.status === "accepted") notify({ title: `Offer accepted — ${addr(after.propertyId as string)}`, body: `${who(after.contactId as string) ?? "Buyer"} · $${Number(after.currentOffer ?? after.offerPrice).toLocaleString()}. Open a transaction to start the escrow timeline.`, kind: "success", href: "/transactions" });
      }
      break;
    case "touchpoints":
      if (!before.completedAt && after.completedAt) { touch(after.contactId as string); logActivity({ contactId: after.contactId as string, type: "meeting", summary: `Stay-in-touch: ${String(after.kind).replace(/_/g, " ")}`, refType: "touchpoint", refId: after.id as string }); }
      break;
  }
}
