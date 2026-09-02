import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, contacts, deals, notes, providerConnections, syncEvents, tasks } from "@/db/schema";
import { transactions } from "@/db/schema.dashboard";
import { getFub } from "./adapter";
import { appointmentToLocal, dealToLocal, noteToLocal, personToContact, taskToLocal } from "./mappers";
import { writeAudit } from "@/lib/audit";

/**
 * Manual, user-initiated pull from Follow Up Boss into the local database.
 * Every record is upserted by its FUB id (never matched by name). FUB stays the
 * system of record; local edits to mirrored fields are overwritten on sync,
 * while local-only fields (temperature when FUB has no tag, next step) persist.
 */
export interface SyncSummary {
  mock: boolean;
  pulled: Record<string, number>;
  status: "OK" | "error";
  detail: string;
  lastSyncAt: string;
}

export async function syncFromFub(): Promise<SyncSummary> {
  const fub = getFub();
  const now = new Date().toISOString();

  if (fub.mock) {
    const detail = "No FUB_API_KEY set — nothing pulled. The app is showing seeded demo data.";
    db.insert(syncEvents).values({ provider: "fub", direction: "pull", entity: "all", itemCount: 0, status: "OK", detail }).run();
    return { mock: true, pulled: {}, status: "OK", detail, lastSyncAt: now };
  }

  const [people, fubTasks, fubNotes, fubDeals, fubAppts] = await Promise.all([
    fub.pullPeople(),
    fub.pullTasks(),
    fub.pullNotes(),
    fub.pullDeals(),
    fub.pullAppointments(),
  ]);

  // Contacts — upsert by FUB id.
  const idByFub = new Map<string, string>();
  for (const p of people) {
    const c = personToContact(p);
    const existing = db.select().from(contacts).where(eq(contacts.fubId, c.fubId)).get();
    const mirrored = { name: c.name, role: c.role, stage: c.stage, phone: c.phone, email: c.email, tags: c.tags, source: c.source, assignedTo: c.assignedTo, lastActivityAt: c.lastActivityAt, syncStatus: "Synced", updatedAt: now };
    if (existing) {
      db.update(contacts).set({ ...mirrored, ...(c.temperature ? { temperature: c.temperature } : {}) }).where(eq(contacts.id, existing.id)).run();
      idByFub.set(c.fubId, existing.id);
    } else {
      const row = db.insert(contacts).values({ fubId: c.fubId, ...mirrored, temperature: c.temperature ?? "warm" }).returning().get();
      idByFub.set(c.fubId, row.id);
    }
  }
  const contactIdFor = (fubPersonId: string | null) => (fubPersonId ? idByFub.get(fubPersonId) ?? null : null);

  for (const t of fubTasks) {
    const m = taskToLocal(t);
    const existing = db.select().from(tasks).where(eq(tasks.fubId, m.fubId)).get();
    const values = { contactId: contactIdFor(m.personFubId), title: m.title, body: m.body, dueAt: m.dueAt, status: m.status, origin: "fub", syncedToFub: true };
    if (existing) db.update(tasks).set(values).where(eq(tasks.id, existing.id)).run();
    else db.insert(tasks).values({ fubId: m.fubId, ...values }).run();
  }

  for (const n of fubNotes) {
    const m = noteToLocal(n);
    const existing = db.select().from(notes).where(eq(notes.fubId, m.fubId)).get();
    const values = { contactId: contactIdFor(m.personFubId), subject: m.subject, body: m.body, isDraft: false, origin: "fub", syncedToFub: true, ...(m.createdAt ? { createdAt: m.createdAt } : {}) };
    if (existing) db.update(notes).set(values).where(eq(notes.id, existing.id)).run();
    else db.insert(notes).values({ fubId: m.fubId, ...values }).run();
  }

  for (const a of fubAppts) {
    const m = appointmentToLocal(a);
    const existing = db.select().from(appointments).where(eq(appointments.fubId, m.fubId)).get();
    const values = { contactId: contactIdFor(m.personFubId), title: m.title, description: m.description, location: m.location, type: m.type, startsAt: m.startsAt, endsAt: m.endsAt };
    if (existing) db.update(appointments).set(values).where(eq(appointments.id, existing.id)).run();
    else db.insert(appointments).values({ fubId: m.fubId, ...values }).run();
  }

  for (const d of fubDeals) {
    const m = dealToLocal(d);
    const contactId = contactIdFor(m.personFubId);
    const existing = db.select().from(deals).where(eq(deals.fubId, m.fubId)).get();
    const dealValues = { contactId, name: m.name, stage: m.stage, price: m.price != null ? String(m.price) : null, dealStatus: m.dealStatus, pipeline: m.pipeline, closeDate: m.closeDate, updatedAt: now };
    if (existing) db.update(deals).set(dealValues).where(eq(deals.id, existing.id)).run();
    else db.insert(deals).values({ fubId: m.fubId, ...dealValues }).run();

    // Mirror into transactions for the dashboard pipeline / YTD stats.
    const tx = db.select().from(transactions).where(eq(transactions.fubDealId, m.fubId)).get();
    const txValues = { side: m.side, contactId, address: m.name, price: m.price, status: m.txStatus, stage: m.stage, closedAt: m.txStatus === "closed" ? (m.closeDate ?? null) : null };
    if (tx) db.update(transactions).set(txValues).where(eq(transactions.id, tx.id)).run();
    else db.insert(transactions).values({ fubDealId: m.fubId, ...txValues }).run();
  }

  const pulled = { contacts: people.length, tasks: fubTasks.length, notes: fubNotes.length, deals: fubDeals.length, appointments: fubAppts.length };
  for (const [entity, count] of Object.entries(pulled)) {
    db.insert(syncEvents).values({ provider: "fub", direction: "pull", entity, itemCount: count, status: "OK", detail: `Pulled ${count} ${entity}` }).run();
  }
  const conn = db.select().from(providerConnections).where(eq(providerConnections.provider, "fub")).get();
  if (conn) db.update(providerConnections).set({ status: "connected", lastSyncAt: now, updatedAt: now }).where(eq(providerConnections.id, conn.id)).run();
  else db.insert(providerConnections).values({ provider: "fub", status: "connected", keyRef: "env:FUB_API_KEY", lastSyncAt: now, scopes: ["read:*", "write:tasks", "write:draft-notes"] }).run();

  writeAudit({ action: "fub.sync.pull", entityType: "provider_connection", metadata: pulled });
  const detail = `Pulled ${people.length} contacts, ${fubTasks.length} tasks, ${fubNotes.length} notes, ${fubDeals.length} deals, ${fubAppts.length} appointments.`;
  return { mock: false, pulled, status: "OK", detail, lastSyncAt: now };
}
