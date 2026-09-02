import "server-only";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { afterCreate, afterUpdate, logActivity } from "./hooks";
import { parseMoney } from "@/lib/obsidian";

/**
 * One import pipeline for every source (Obsidian frontmatter, Claude
 * extraction, future CSV/MLS): a validated `ImportBundle` is matched against
 * existing rows and upserted. Contacts match on email → phone → full name;
 * properties on address; buyer/seller profiles on their contact; listings on
 * property; transactions on property + price; tasks on title + due date.
 * Nothing is ever duplicated because the same person shows up twice.
 */

const money = z.preprocess((v) => (typeof v === "string" ? parseMoney(v) : v), z.number().finite().nullable()).nullable().optional();
const str = z.string().trim().max(2000).nullable().optional();
const list = z.union([z.array(z.string()), z.string().transform((v) => v.split(/[,;]/).map((x) => x.trim()).filter(Boolean))]).optional();
const num = z.preprocess((v) => (typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : v), z.number().finite().nullable()).nullable().optional();

export const ImportBundle = z.object({
  contacts: z.array(z.object({
    name: z.string().min(1), phone: str, email: str, type: z.enum(s.CONTACT_TYPES).nullable().optional(), leadSource: z.enum(s.LEAD_SOURCES).nullable().optional(), spouse: str, birthday: str, homeAddress: str,
    priceMin: money, priceMax: money, preferredAreas: list, tags: list, stage: z.enum(s.PIPELINE_STAGES).nullable().optional(), nextAction: str, nextFollowUpAt: str, notes: str,
    // Optional inline profiles
    buyer: z.object({ temperature: z.enum(s.BUYER_TEMPS).nullable().optional(), priceMin: money, priceMax: money, targetAreas: list, minBeds: num, minBaths: num, minSqft: num, propertyType: str, mustHaves: list, dealBreakers: list, financingType: str, preApprovalAmount: money, timeline: str, notes: str }).nullable().optional(),
    seller: z.object({ propertyAddress: str, city: str, estimatedValue: money, expectedListPrice: money, timeline: str, motivation: str, stage: z.enum(s.SELLER_STAGES).nullable().optional(), probability: num, notes: str }).nullable().optional(),
  })).default([]),
  properties: z.array(z.object({ address: z.string().min(1), city: str, zip: str, beds: num, baths: num, sqft: num, lotSqft: num, propertyType: str, yearBuilt: num, view: str, notes: str })).default([]),
  listings: z.array(z.object({ address: z.string().min(1), city: str, listPrice: money, status: z.enum(s.LISTING_STATUSES).nullable().optional(), listedAt: str, sellerName: str, commissionPct: num, showings: num, offers: num, nextAction: str, notes: str })).default([]),
  transactions: z.array(z.object({ address: z.string().min(1), city: str, clientName: str, side: z.enum(["buyer", "seller", "both"]).nullable().optional(), status: z.enum(s.TX_STATUSES).nullable().optional(), purchasePrice: money, commissionPct: num, referralFee: money, brokerSplitPct: num, expenses: money, escrowOpenedAt: str, closingDate: str, closedAt: str, leadSource: str, notes: str })).default([]),
  tasks: z.array(z.object({ title: z.string().min(1), priority: z.enum(s.PRIORITIES).nullable().optional(), category: z.enum(s.TASK_CATEGORIES).nullable().optional(), dueDate: str, dueTime: str, contactName: str, address: str, notes: str })).default([]),
  opportunities: z.array(z.object({ address: z.string().min(1), area: str, kind: z.enum(s.OPPORTUNITY_KINDS).nullable().optional(), expectedPrice: money, beds: num, baths: num, sqft: num, sourceAgent: str, notes: str })).default([]),
  notes: z.array(z.object({ body: z.string().min(1), contactName: str, address: str })).default([]),
});
export type ImportBundleT = z.infer<typeof ImportBundle>;

export interface ImportReport { created: Record<string, number>; updated: Record<string, number>; skipped: string[] }

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();
const digits = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").slice(-10);
const now = () => new Date().toISOString();
const clean = <T extends Record<string, unknown>>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== "")) as Partial<T>;

function splitName(full: string) { const parts = full.trim().split(/\s+/); return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") }; }

export function findContact(name?: string | null, email?: string | null, phone?: string | null) {
  const all = db.select().from(s.contacts).all();
  if (email) { const c = all.find((x) => norm(x.email) === norm(email)); if (c) return c; }
  if (phone && digits(phone).length >= 7) { const c = all.find((x) => digits(x.phone) === digits(phone)); if (c) return c; }
  if (name) { const c = all.find((x) => norm(`${x.firstName} ${x.lastName}`) === norm(name)); if (c) return c; }
  return null;
}
export function findProperty(address: string) {
  const a = norm(address);
  return db.select().from(s.properties).all().find((p) => norm(p.address) === a || a.startsWith(norm(p.address)) || norm(p.address).startsWith(a.split(",")[0])) ?? null;
}

/** Apply a bundle. `dryRun` returns the report without writing. */
export function applyImport(bundle: ImportBundleT, opts: { dryRun?: boolean; source?: string } = {}): ImportReport {
  const report: ImportReport = { created: {}, updated: {}, skipped: [] };
  const bump = (k: "created" | "updated", e: string) => (report[k][e] = (report[k][e] ?? 0) + 1);
  const dry = !!opts.dryRun;
  const src = opts.source ?? "import";

  const ensureContact = (name: string | null | undefined, extra: Record<string, unknown> = {}) => {
    if (!name) return null;
    const existing = findContact(name, extra.email as string | undefined, extra.phone as string | undefined);
    if (existing) return existing;
    if (dry) { bump("created", "contacts"); return { id: `dry-${name}` } as typeof s.contacts.$inferSelect; }
    const row = db.insert(s.contacts).values({ ...splitName(name), type: "lead", leadSource: "other", ...clean(extra) } as never).returning().get();
    bump("created", "contacts");
    logActivity({ contactId: row.id, type: "system", summary: `Imported from ${src}` });
    return row;
  };
  const ensureProperty = (address: string, extra: Record<string, unknown> = {}) => {
    const existing = findProperty(address);
    if (existing) { if (!dry && Object.keys(clean(extra)).length) db.update(s.properties).set({ ...clean(extra), updatedAt: now() } as never).where(eq(s.properties.id, existing.id)).run(); return existing; }
    if (dry) { bump("created", "properties"); return { id: `dry-${address}` } as typeof s.properties.$inferSelect; }
    const row = db.insert(s.properties).values({ address, city: (extra.city as string) ?? "", ...clean(extra) } as never).returning().get();
    bump("created", "properties");
    return row;
  };

  for (const c of bundle.contacts) {
    const { buyer, seller, name, ...fields } = c;
    const existing = findContact(name, c.email, c.phone);
    const patch = clean({ ...fields, ...(existing ? {} : splitName(name)) });
    let contact = existing;
    if (existing) { if (!dry) { db.update(s.contacts).set({ ...patch, updatedAt: now() } as never).where(eq(s.contacts.id, existing.id)).run(); afterUpdate("contacts", existing as never, { ...existing, ...patch } as never); } bump("updated", "contacts"); }
    else { if (!dry) { contact = db.insert(s.contacts).values({ ...splitName(name), type: c.type ?? (buyer ? "buyer" : seller ? "seller" : "lead"), leadSource: c.leadSource ?? "other", ...patch } as never).returning().get(); logActivity({ contactId: contact.id, type: "system", summary: `Imported from ${src}` }); } bump("created", "contacts"); }
    if (buyer && contact && !dry) {
      const b = db.select().from(s.buyers).where(eq(s.buyers.contactId, contact.id)).get();
      const vals = clean({ ...buyer, temperature: buyer.temperature ?? undefined });
      if (b) { db.update(s.buyers).set({ ...vals, updatedAt: now() } as never).where(eq(s.buyers.id, b.id)).run(); bump("updated", "buyers"); }
      else { const row = db.insert(s.buyers).values({ contactId: contact.id, ...vals } as never).returning().get(); afterCreate("buyers", row as never); bump("created", "buyers"); }
    } else if (buyer && dry) bump(db.select().from(s.buyers).where(eq(s.buyers.contactId, contact?.id ?? "")).get() ? "updated" : "created", "buyers");
    if (seller && contact && !dry) {
      const x = db.select().from(s.sellers).where(eq(s.sellers.contactId, contact.id)).get();
      const vals = clean({ ...seller, stage: seller.stage ?? undefined, probability: seller.probability ?? undefined });
      if (x) { db.update(s.sellers).set({ ...vals, updatedAt: now() } as never).where(eq(s.sellers.id, x.id)).run(); bump("updated", "sellers"); }
      else { const row = db.insert(s.sellers).values({ contactId: contact.id, ...vals } as never).returning().get(); afterCreate("sellers", row as never); bump("created", "sellers"); }
    } else if (seller && dry) bump(db.select().from(s.sellers).where(eq(s.sellers.contactId, contact?.id ?? "")).get() ? "updated" : "created", "sellers");
  }

  for (const p of bundle.properties) { const { address, ...rest } = p; const existed = !!findProperty(address); ensureProperty(address, rest); if (existed) bump("updated", "properties"); }

  for (const l of bundle.listings) {
    const { address, city, sellerName, listPrice, ...rest } = l;
    if (!listPrice) { report.skipped.push(`Listing ${address}: no list price`); continue; }
    const prop = ensureProperty(address, { city });
    const seller = ensureContact(sellerName, { type: "seller" });
    const existing = db.select().from(s.listings).all().find((x) => x.propertyId === prop.id && !["closed", "withdrawn"].includes(x.status));
    const vals = clean({ ...rest, listPrice, status: rest.status ?? undefined, sellerContactId: seller?.id });
    if (existing) { if (!dry) { db.update(s.listings).set({ ...vals, updatedAt: now() } as never).where(eq(s.listings.id, existing.id)).run(); afterUpdate("listings", existing as never, { ...existing, ...vals } as never); } bump("updated", "listings"); }
    else { if (!dry) { const row = db.insert(s.listings).values({ propertyId: prop.id, ...vals } as never).returning().get(); afterCreate("listings", row as never); } bump("created", "listings"); }
  }

  for (const t of bundle.transactions) {
    const { address, city, clientName, purchasePrice, ...rest } = t;
    if (!purchasePrice) { report.skipped.push(`Transaction ${address}: no purchase price`); continue; }
    const prop = ensureProperty(address, { city });
    const client = ensureContact(clientName);
    const existing = db.select().from(s.transactions).all().find((x) => x.propertyId === prop.id && Math.abs(x.purchasePrice - purchasePrice) < 1);
    const vals = clean({ ...rest, purchasePrice, contactId: client?.id, side: rest.side ?? undefined, status: rest.status ?? undefined });
    if (existing) { if (!dry) { db.update(s.transactions).set({ ...vals, updatedAt: now() } as never).where(eq(s.transactions.id, existing.id)).run(); afterUpdate("transactions", existing as never, { ...existing, ...vals } as never); } bump("updated", "transactions"); }
    else { if (!dry) { const row = db.insert(s.transactions).values({ propertyId: prop.id, ...vals } as never).returning().get(); afterCreate("transactions", row as never); } bump("created", "transactions"); }
  }

  for (const k of bundle.tasks) {
    const { title, contactName, address, ...rest } = k;
    const contact = contactName ? findContact(contactName) : null;
    const prop = address ? findProperty(address) : null;
    const existing = db.select().from(s.tasks).all().find((x) => norm(x.title) === norm(title) && (x.dueDate ?? null) === (rest.dueDate ?? null));
    if (existing) { report.skipped.push(`Task already exists: ${title}`); continue; }
    if (!dry) db.insert(s.tasks).values({ title, ...clean({ ...rest, priority: rest.priority ?? undefined, category: rest.category ?? undefined }), contactId: contact?.id ?? null, propertyId: prop?.id ?? null } as never).run();
    bump("created", "tasks");
  }

  for (const o of bundle.opportunities) {
    const existing = db.select().from(s.opportunities).all().find((x) => norm(x.address) === norm(o.address));
    const vals = clean({ ...o, kind: o.kind ?? undefined });
    if (existing) { if (!dry) db.update(s.opportunities).set({ ...vals, updatedAt: now() } as never).where(eq(s.opportunities.id, existing.id)).run(); bump("updated", "opportunities"); }
    else { if (!dry) db.insert(s.opportunities).values(vals as never).run(); bump("created", "opportunities"); }
  }

  for (const n of bundle.notes) {
    const contact = n.contactName ? findContact(n.contactName) : null;
    const prop = n.address ? findProperty(n.address) : null;
    const dup = db.select().from(s.notes).all().find((x) => norm(x.body) === norm(n.body));
    if (dup) { report.skipped.push(`Note already exists: ${n.body.slice(0, 40)}…`); continue; }
    if (!dry) { const row = db.insert(s.notes).values({ body: n.body, contactId: contact?.id ?? null, propertyId: prop?.id ?? null }).returning().get(); afterCreate("notes", row as never); }
    bump("created", "notes");
  }
  return report;
}
