import "server-only";
import { and, asc, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { estCommission, goalStats, grossCommission, netIncome, pipelineTotals, pricePerSqft, round2 } from "@/lib/calc";
import { addDays, daysSince, daysUntil, greeting, nextAnniversary, ymd } from "@/lib/dates";
import { buildPriorities } from "@/lib/priorities";
import { matchAll, type BuyerCriteria, type Candidate } from "@/lib/match";
import { buildFollowUps } from "@/lib/followups";
import { loadContext } from "./context";
import { indexVaultIfChanged, vaultTasks } from "./obsidian";

/** Everything the home screen needs in one pass. */
export function loadDashboard(now = new Date()) {
  const ctx = loadContext();
  const today = ymd(now);
  const year = now.getFullYear();
  const settings = ctx.settings;
  const goal = settings?.annualGoal ?? 200000;

  // ── Money ──────────────────────────────────────────────────────────────
  const allTx = db.select().from(s.transactions).all();
  const closedYtd = allTx.filter((t) => t.status === "closed" && (t.closedAt ?? t.closingDate ?? "").startsWith(String(year)));
  const closedLastYtd = allTx.filter((t) => t.status === "closed" && (t.closedAt ?? t.closingDate ?? "").startsWith(String(year - 1)) && (t.closedAt ?? t.closingDate ?? "").slice(5) <= today.slice(5));
  const escrows = allTx.filter((t) => t.status === "escrow");
  const sum = <T,>(rows: T[], f: (r: T) => number) => round2(rows.reduce((a, r) => a + f(r), 0));
  const ytd = {
    volume: sum(closedYtd, (t) => t.purchasePrice),
    count: closedYtd.length,
    gci: sum(closedYtd, grossCommission),
    net: sum(closedYtd, netIncome),
    lastYear: { volume: sum(closedLastYtd, (t) => t.purchasePrice), count: closedLastYtd.length, gci: sum(closedLastYtd, grossCommission), net: sum(closedLastYtd, netIncome) },
  };
  const pendingVolume = sum(escrows, (t) => t.purchasePrice);
  const pendingNet = sum(escrows, netIncome);
  const pendingGci = sum(escrows, grossCommission);
  const listingsAll = db.select().from(s.listings).all();
  const activeListings = listingsAll.filter((l) => ["active", "coming_soon", "price_improvement", "offer_received", "in_negotiation", "off_market"].includes(l.status));
  const activeListingVolume = sum(activeListings, (l) => l.listPrice);
  const activeListingGci = sum(activeListings, (l) => estCommission(l.listPrice, l.commissionPct));
  const buyersAll = db.select().from(s.buyers).where(eq(s.buyers.status, "active")).all();
  const buyerGci = sum(buyersAll, (b) => estCommission(b.priceMax ?? b.priceMin ?? 0, settings?.defaultCommissionPct ?? 2.5));
  const sellersAll = db.select().from(s.sellers).where(ne(s.sellers.stage, "sold")).all();
  const sellerGci = sum(sellersAll.filter((x) => !["active", "coming_soon"].includes(x.stage)), (x) => estCommission(x.expectedListPrice ?? x.estimatedValue ?? 0, settings?.defaultCommissionPct ?? 2.5));
  const pipeline = { value: round2(activeListingVolume + pendingVolume + sum(buyersAll, (b) => b.priceMax ?? 0) + sum(sellersAll, (x) => x.expectedListPrice ?? 0)), gci: round2(activeListingGci + pendingGci + buyerGci + sellerGci), fromBuyers: buyerGci, fromSellers: sellerGci, fromListings: activeListingGci, fromEscrows: pendingGci };
  const goalS = goalStats(goal, ytd.net, ytd.count, now);
  const contactCards = ctx.contacts.filter((c) => !c.archived).map((c) => ({ estValue: c.estValue, estCommission: c.estCommission, probability: c.probability, stage: c.stage }));
  const pipelineKanban = pipelineTotals(contactCards);

  // Monthly chart (this year): volume + net per month.
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: new Date(year, i, 1).toLocaleString("en-US", { month: "short" }), volume: 0, net: 0, gci: 0, count: 0 }));
  for (const t of closedYtd) { const m = Number((t.closedAt ?? t.closingDate)!.slice(5, 7)) - 1; monthly[m].volume += t.purchasePrice; monthly[m].net += netIncome(t); monthly[m].gci += grossCommission(t); monthly[m].count++; }

  // ── Today ──────────────────────────────────────────────────────────────
  const tasks = db.select().from(s.tasks).all();
  const calls = db.select().from(s.calls).where(eq(s.calls.scheduledDate, today)).orderBy(asc(s.calls.scheduledTime)).all();
  const appts = db.select().from(s.appointments).where(and(gte(s.appointments.startsAt, today), lt(s.appointments.startsAt, ymd(addDays(now, 2))))).orderBy(asc(s.appointments.startsAt)).all();
  const milestonesOpen = escrows.length ? db.select().from(s.milestones).where(inArray(s.milestones.transactionId, escrows.map((t) => t.id))).all() : [];
  const offers = db.select().from(s.offers).all();
  const opportunities = db.select().from(s.opportunities).where(ne(s.opportunities.status, "dead")).all();

  let vTasks: { text: string; note: string; uri: string }[] = [];
  try { indexVaultIfChanged(); vTasks = vaultTasks(); } catch { /* vault optional */ }
  const priorities = buildPriorities({
    now, names: ctx.names, addresses: ctx.addresses, vaultTasks: vTasks,
    tasks, calls: db.select().from(s.calls).where(eq(s.calls.status, "scheduled")).all(),
    buyers: buyersAll.map((b) => ({ id: b.id, contactId: b.contactId, temperature: b.temperature, lastContactAt: ctx.contact(b.contactId)?.lastContactAt ?? null, timeline: b.timeline })),
    listings: listingsAll, milestones: milestonesOpen, offers, appointments: appts,
    contacts: ctx.contacts.filter((c) => !c.archived),
  });

  const enrichAppt = (a: typeof appts[number]) => ({ ...a, contactName: ctx.names(a.contactId), address: ctx.addresses(a.propertyId) });
  const schedule = { today: appts.filter((a) => a.startsAt.startsWith(today)).map(enrichAppt), tomorrow: appts.filter((a) => a.startsAt.startsWith(ymd(addDays(now, 1)))).map(enrichAppt) };

  const callList = calls.map((c) => { const k = ctx.contact(c.contactId); const b = buyersAll.find((x) => x.contactId === c.contactId); return { ...c, contactName: ctx.names(c.contactId), phone: k?.phone ?? null, email: k?.email ?? null, clientType: b ? (b.temperature === "hot" ? "Hot Buyer" : b.temperature === "warm" ? "Warm Buyer" : "Nurture Buyer") : (k?.type ?? "lead").replace(/_/g, " "), priceLabel: b ? `${money(b.priceMin)} – ${money(b.priceMax)}` : null, area: b?.targetAreas?.[0] ?? k?.preferredAreas?.[0] ?? null, lastContactAt: k?.lastContactAt ?? null, nextFollowUpAt: k?.nextFollowUpAt ?? null, photoUrl: k?.photoUrl ?? null }; });
  const callStats = { scheduled: calls.length, completed: calls.filter((c) => c.status === "completed").length, remaining: calls.filter((c) => c.status !== "completed").length };

  // ── Buyers / listings / escrows ────────────────────────────────────────
  const rank = { hot: 0, warm: 1, nurture: 2 } as Record<string, number>;
  const hotBuyers = buyersAll.map((b) => { const k = ctx.contact(b.contactId); return { ...b, contactName: ctx.names(b.contactId), phone: k?.phone ?? null, email: k?.email ?? null, photoUrl: k?.photoUrl ?? null, lastContactAt: k?.lastContactAt ?? null, nextFollowUpAt: k?.nextFollowUpAt ?? null }; }).sort((a, b) => (rank[a.temperature] ?? 3) - (rank[b.temperature] ?? 3) || (a.lastContactAt ?? "").localeCompare(b.lastContactAt ?? ""));

  const listingCards = activeListings.map((l) => { const p = ctx.property(l.propertyId); return { ...l, address: p?.address ?? "—", city: p?.city ?? "", beds: p?.beds ?? null, baths: p?.baths ?? null, sqft: p?.sqft ?? null, lotSqft: p?.lotSqft ?? null, photoUrl: p?.photoUrl ?? null, pricePerSqft: pricePerSqft(l.listPrice, p?.sqft), daysOnMarket: l.listedAt ? daysSince(l.listedAt, now) ?? 0 : 0, sellerName: ctx.names(l.sellerContactId), sellerPhone: ctx.contact(l.sellerContactId)?.phone ?? null, estCommission: estCommission(l.listPrice, l.commissionPct) }; }).sort((a, b) => b.listPrice - a.listPrice);

  const escrowCards = escrows.map((t) => { const p = ctx.property(t.propertyId); const ms = milestonesOpen.filter((m) => m.transactionId === t.id).sort((a, b) => a.sortOrder - b.sortOrder); const next = ms.filter((m) => !m.completedAt && m.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0] ?? null; return { ...t, address: p?.address ?? "—", city: p?.city ?? "", photoUrl: p?.photoUrl ?? null, clientName: ctx.names(t.contactId), gross: grossCommission(t), net: netIncome(t), daysToClose: t.closingDate ? daysUntil(t.closingDate, now) : null, nextMilestone: next ? { ...next, daysUntil: daysUntil(next.dueDate!, now) } : null, urgent: ms.filter((m) => !m.completedAt && m.dueDate && daysUntil(m.dueDate, now) <= 3).map((m) => ({ ...m, daysUntil: daysUntil(m.dueDate!, now) })), milestones: ms }; }).sort((a, b) => (a.closingDate ?? "").localeCompare(b.closingDate ?? ""));

  // ── Matches, follow-ups, alerts ────────────────────────────────────────
  const criteria: BuyerCriteria[] = buyersAll.map((b) => ({ id: b.id, contactId: b.contactId, temperature: b.temperature, priceMin: b.priceMin, priceMax: b.priceMax, targetAreas: b.targetAreas ?? [], minBeds: b.minBeds, minBaths: b.minBaths, minSqft: b.minSqft, propertyType: b.propertyType, mustHaves: b.mustHaves ?? [], dealBreakers: b.dealBreakers ?? [] }));
  const candidates: Candidate[] = [
    ...activeListings.map((l) => { const p = ctx.property(l.propertyId)!; return { id: l.id, kind: "listing" as const, address: p.address, area: p.city, price: l.listPrice, beds: p.beds, baths: p.baths, sqft: p.sqft, propertyType: p.propertyType, features: [p.view ?? "", p.notes ?? "", l.notes ?? ""] }; }),
    ...opportunities.map((o) => ({ id: o.id, kind: "opportunity" as const, address: o.address, area: o.area, price: o.expectedPrice, beds: o.beds, baths: o.baths, sqft: o.sqft, propertyType: o.propertyType, features: [o.notes ?? ""] })),
  ];
  const matches = matchAll(criteria, candidates).slice(0, 12).map((m) => ({ ...m, buyerName: ctx.names(m.contactId), address: candidates.find((c) => c.id === m.candidateId)?.address ?? "" }));
  const followUps = buildFollowUps(ctx.contacts, buyersAll, now).slice(0, 8).map((f) => ({ ...f, name: ctx.names(f.contactId), phone: ctx.contact(f.contactId)?.phone ?? null }));

  const overdueTasks = tasks.filter((t) => !t.completedAt && t.dueDate && daysUntil(t.dueDate, now) < 0).length;
  const overdueFollowUps = ctx.contacts.filter((c) => !c.archived && c.nextFollowUpAt && daysUntil(c.nextFollowUpAt, now) < 0).length;
  const alerts: { kind: "critical" | "warn" | "info" | "ok"; text: string; href: string }[] = [];
  for (const b of hotBuyers.filter((x) => x.temperature === "hot")) { const d = daysSince(b.lastContactAt, now); if (d == null || d >= 5) alerts.push({ kind: "critical", text: `${b.contactName} (hot buyer) hasn't been contacted in ${d ?? "—"} days`, href: "/buyers" }); }
  for (const e of escrowCards) for (const u of e.urgent) alerts.push({ kind: u.daysUntil <= 1 ? "critical" : "warn", text: `${u.name} for ${e.address} due ${u.daysUntil < 0 ? `${-u.daysUntil}d ago` : u.daysUntil === 0 ? "today" : u.daysUntil === 1 ? "tomorrow" : `in ${u.daysUntil} days`}`, href: "/transactions" });
  if (pendingNet > 0) alerts.push({ kind: "info", text: `${money(pendingGci)} gross commission currently in escrow (${money(pendingNet)} net)`, href: "/transactions" });
  const listingMatchCounts = new Map<string, number>();
  for (const m of matches) if (m.kind === "listing") listingMatchCounts.set(m.candidateId, (listingMatchCounts.get(m.candidateId) ?? 0) + 1);
  for (const [lid, n] of listingMatchCounts) if (n >= 2) { const l = listingCards.find((x) => x.id === lid); if (l) alerts.push({ kind: "info", text: `${l.address} matches ${n} active buyers`, href: "/buyers" }); }
  if (overdueFollowUps) alerts.push({ kind: "warn", text: `${overdueFollowUps} client follow-up${overdueFollowUps === 1 ? "" : "s"} overdue`, href: "/contacts?filter=followup" });
  if (overdueTasks) alerts.push({ kind: "warn", text: `${overdueTasks} task${overdueTasks === 1 ? "" : "s"} overdue`, href: "/tasks?view=overdue" });
  for (const c of ctx.contacts) if (c.birthday && !c.archived) { const d = daysUntil(nextAnniversary(c.birthday, now), now); if (d <= 1) alerts.push({ kind: "info", text: `${ctx.names(c.id)}'s birthday ${d === 0 ? "is today" : "is tomorrow"}`, href: `/contacts/${c.id}` }); }
  alerts.push({ kind: "ok", text: `You are ${goalS.pct}% toward your ${money(goal)} annual goal`, href: "/income" });

  const recent = db.select().from(s.activities).orderBy(desc(s.activities.occurredAt)).limit(10).all().map((a) => ({ ...a, contactName: ctx.names(a.contactId) }));
  const unread = db.select().from(s.notifications).where(eq(s.notifications.readAt, null as unknown as string)).all().length;

  return {
    now: now.toISOString(), today, greeting: `${greeting(now)}, ${(settings?.agentName ?? "Vanessa").split(" ")[0]}`, agent: { name: settings?.agentName ?? "Vanessa Smith", title: settings?.title ?? "", brokerage: settings?.brokerage ?? "" },
    kpis: { ytd, pendingVolume, pendingGci, pendingNet, pendingCount: escrows.length, activeListingVolume, activeListingCount: activeListings.length, activeListingGci, pipeline, pipelineKanban },
    goal: { ...goalS, pendingNet, pipelineGci: pipeline.gci },
    monthly, priorities, schedule, callList, callStats, hotBuyers, listings: listingCards, escrows: escrowCards, matches, followUps, alerts, recent, unread,
  };
}

const money = (n: number | null | undefined) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
