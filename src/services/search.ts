import "server-only";
import { db } from "@/db";
import * as s from "@/db/schema";
import { loadContext } from "./context";

export interface SearchHit { kind: "contact" | "property" | "listing" | "transaction" | "note" | "task" | "opportunity"; id: string; title: string; subtitle: string | null; href: string }

/** Universal search across people, addresses, phones, listings, escrows, notes and tasks. */
export function search(q: string, limit = 25): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const digits = needle.replace(/\D/g, "");
  const ctx = loadContext();
  const hits: SearchHit[] = [];
  const has = (...vals: (string | null | undefined)[]) => vals.some((v) => v && v.toLowerCase().includes(needle)) || (digits.length >= 3 && vals.some((v) => v && v.replace(/\D/g, "").includes(digits)));

  for (const c of ctx.contacts) if (has(`${c.firstName} ${c.lastName}`, c.email, c.phone, c.spouse, c.homeAddress, ...(c.tags ?? []))) hits.push({ kind: "contact", id: c.id, title: `${c.firstName} ${c.lastName}`.trim(), subtitle: [c.type.replace(/_/g, " "), c.phone, c.email].filter(Boolean).join(" · "), href: `/contacts/${c.id}` });
  const listingsAll = db.select().from(s.listings).all();
  for (const p of ctx.properties) if (has(p.address, p.city, p.zip)) { const l = listingsAll.find((x) => x.propertyId === p.id && x.status !== "closed"); hits.push(l ? { kind: "listing", id: l.id, title: p.address, subtitle: `${p.city} · Listing · ${l.status.replace(/_/g, " ")} · $${Math.round(l.listPrice).toLocaleString()}`, href: `/listings?focus=${l.id}` } : { kind: "property", id: p.id, title: p.address, subtitle: `${p.city} · Property`, href: `/listings?property=${p.id}` }); }
  for (const t of db.select().from(s.transactions).all()) { const p = ctx.property(t.propertyId); if (has(p?.address, ctx.names(t.contactId), t.notes)) hits.push({ kind: "transaction", id: t.id, title: `${p?.address ?? "Transaction"} · $${Math.round(t.purchasePrice).toLocaleString()}`, subtitle: `${t.status} · ${t.side} side · ${ctx.names(t.contactId) ?? ""}`, href: `/transactions?focus=${t.id}` }); }
  for (const n of db.select().from(s.notes).all()) if (has(n.body)) hits.push({ kind: "note", id: n.id, title: n.body.slice(0, 90), subtitle: [ctx.names(n.contactId), ctx.addresses(n.propertyId)].filter(Boolean).join(" · ") || "Note", href: `/notes?focus=${n.id}` });
  for (const t of db.select().from(s.tasks).all()) if (has(t.title, t.notes)) hits.push({ kind: "task", id: t.id, title: t.title, subtitle: `Task · ${t.completedAt ? "done" : t.dueDate ?? "no date"}`, href: `/tasks?focus=${t.id}` });
  for (const o of db.select().from(s.opportunities).all()) if (has(o.address, o.area, o.sourceAgent, o.notes)) hits.push({ kind: "opportunity", id: o.id, title: o.address, subtitle: `Opportunity · ${o.kind.replace(/_/g, " ")} · ${o.area ?? ""}`, href: `/opportunities?focus=${o.id}` });
  return hits.slice(0, limit);
}
