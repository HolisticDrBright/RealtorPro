import "server-only";
import { db } from "@/db";
import * as s from "@/db/schema";
import { brokerSplit, grossCommission, netIncome, round2 } from "@/lib/calc";
import { daysBetween } from "@/lib/dates";
import { loadContext } from "./context";

export interface IncomeFilters { year?: number; month?: number; quarter?: number; city?: string; side?: string }

/** Closed-transaction table + totals with filters. */
export function incomeReport(f: IncomeFilters) {
  const ctx = loadContext();
  const rows = db.select().from(s.transactions).all().filter((t) => t.status === "closed").map((t) => {
    const p = ctx.property(t.propertyId);
    const closed = t.closedAt ?? t.closingDate ?? "";
    return { ...t, closed, address: p?.address ?? "—", city: p?.city ?? "", clientName: ctx.names(t.contactId), gross: grossCommission(t), split: brokerSplit(t), net: netIncome(t) };
  }).filter((r) => {
    if (f.year && !r.closed.startsWith(String(f.year))) return false;
    const m = Number(r.closed.slice(5, 7));
    if (f.month && m !== f.month) return false;
    if (f.quarter && Math.ceil(m / 3) !== f.quarter) return false;
    if (f.city && r.city.toLowerCase() !== f.city.toLowerCase()) return false;
    if (f.side && r.side !== f.side) return false;
    return true;
  }).sort((a, b) => b.closed.localeCompare(a.closed));
  const sum = (fn: (r: typeof rows[number]) => number) => round2(rows.reduce((a, r) => a + fn(r), 0));
  const n = rows.length;
  const buyerSide = rows.filter((r) => r.side === "buyer" || r.side === "both").length;
  const listingSide = rows.filter((r) => r.side === "seller" || r.side === "both").length;
  const totals = {
    count: n, volume: sum((r) => r.purchasePrice), gci: sum((r) => r.gross), net: sum((r) => r.net), referral: sum((r) => r.referralFee), split: sum((r) => r.split), expenses: sum((r) => r.expenses),
    avgPrice: n ? round2(sum((r) => r.purchasePrice) / n) : 0, avgCommissionPct: n ? round2(rows.reduce((a, r) => a + r.commissionPct, 0) / n) : 0, avgGci: n ? round2(sum((r) => r.gross) / n) : 0, avgNet: n ? round2(sum((r) => r.net) / n) : 0, buyerSide, listingSide,
  };
  const cities = [...new Set(db.select().from(s.properties).all().map((p) => p.city).filter(Boolean))].sort();
  const years = [...new Set(db.select().from(s.transactions).all().map((t) => (t.closedAt ?? t.closingDate ?? "").slice(0, 4)).filter(Boolean))].sort().reverse();
  return { rows, totals, cities, years };
}

/** Business analytics for a year: monthly series, counts, averages, conversion, lead sources. */
export function analytics(year: number) {
  const ctx = loadContext();
  const tx = db.select().from(s.transactions).all();
  const closed = tx.filter((t) => t.status === "closed" && (t.closedAt ?? t.closingDate ?? "").startsWith(String(year)));
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: new Date(year, i, 1).toLocaleString("en-US", { month: "short" }), volume: 0, net: 0, gci: 0, closed: 0, buyer: 0, seller: 0 }));
  for (const t of closed) { const m = Number((t.closedAt ?? t.closingDate)!.slice(5, 7)) - 1; monthly[m].volume += t.purchasePrice; monthly[m].net += netIncome(t); monthly[m].gci += grossCommission(t); monthly[m].closed++; if (t.side !== "seller") monthly[m].buyer++; if (t.side !== "buyer") monthly[m].seller++; }
  const n = closed.length;
  const avg = (f: (t: typeof closed[number]) => number) => (n ? round2(closed.reduce((a, t) => a + f(t), 0) / n) : 0);
  const listingsAll = db.select().from(s.listings).all();
  const listingsTaken = listingsAll.filter((l) => (l.listedAt ?? l.createdAt).startsWith(String(year))).length;
  const listingsSold = closed.filter((t) => t.listingId).length;
  const daysToClose = closed.filter((t) => t.escrowOpenedAt && (t.closedAt ?? t.closingDate)).map((t) => daysBetween(t.escrowOpenedAt!, (t.closedAt ?? t.closingDate)!));
  const contacts = ctx.contacts;
  const leads = contacts.filter((c) => c.createdAt.startsWith(String(year)) || c.type === "lead");
  const converted = contacts.filter((c) => closed.some((t) => t.contactId === c.id));
  const sellerRows = db.select().from(s.sellers).all();
  const listingConversion = sellerRows.length ? round2((sellerRows.filter((x) => ["agreement_signed", "coming_soon", "active", "sold"].includes(x.stage)).length / sellerRows.length) * 100) : 0;

  // Lead sources: contacts by source, closings/revenue by the transaction's source (falls back to the contact's).
  const sources = new Map<string, { source: string; leads: number; closings: number; revenue: number; net: number }>();
  const bucket = (src: string | null | undefined) => { const k = src || "other"; if (!sources.has(k)) sources.set(k, { source: k, leads: 0, closings: 0, revenue: 0, net: 0 }); return sources.get(k)!; };
  for (const c of contacts) bucket(c.leadSource).leads++;
  for (const t of closed) { const b = bucket(t.leadSource ?? ctx.contact(t.contactId)?.leadSource); b.closings++; b.revenue += grossCommission(t); b.net += netIncome(t); }
  const leadSources = [...sources.values()].map((x) => ({ ...x, revenue: round2(x.revenue), net: round2(x.net), conversion: x.leads ? round2((x.closings / x.leads) * 100) : 0 })).sort((a, b) => b.net - a.net);

  return {
    year, monthly, totals: { closed: n, volume: round2(closed.reduce((a, t) => a + t.purchasePrice, 0)), gci: round2(closed.reduce((a, t) => a + grossCommission(t), 0)), net: round2(closed.reduce((a, t) => a + netIncome(t), 0)), avgPrice: avg((t) => t.purchasePrice), avgCommission: avg(grossCommission), avgNet: avg(netIncome), listingsTaken, listingsSold, buyerTx: closed.filter((t) => t.side !== "seller").length, sellerTx: closed.filter((t) => t.side !== "buyer").length, avgDaysToClose: daysToClose.length ? Math.round(daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length) : null, leadConversion: leads.length ? round2((converted.length / leads.length) * 100) : 0, listingConversion },
    leadSources,
    years: [...new Set(tx.map((t) => (t.closedAt ?? t.closingDate ?? "").slice(0, 4)).filter(Boolean))].sort().reverse(),
  };
}
