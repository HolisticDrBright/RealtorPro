import "server-only";
import { and, asc, desc, eq, gte, inArray, like, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { buyerCriteriaProfiles, contacts, deals, properties, userProfiles } from "@/db/schema";
import { calendarEvents, todos, transactions } from "@/db/schema.dashboard";
import { matchOffMarket, ytdStats, type GamePlanInput, type OffMarketProperty } from "@/lib/dashboard";
import { buildGamePlan } from "@/lib/dashboard";
import { googleForDashboard, googleStatus } from "@/services/google";
import { vaultToday } from "@/services/obsidian";

export function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

const money = (n: number | null | undefined) => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));

/** Everything the dashboard renders, in one query pass. */
export function loadDashboard() {
  const today = todayYmd();
  const year = Number(today.slice(0, 4));
  const agent = db.select().from(userProfiles).get();

  // Todos: due today or overdue-and-open.
  const todoRows = db
    .select()
    .from(todos)
    .where(or(eq(todos.dueDate, today), and(lt(todos.dueDate, today), eq(todos.done, false))))
    .orderBy(asc(todos.done), asc(todos.createdAt))
    .all();

  const contactRows = db.select().from(contacts).all();
  const nameOf = (id: string | null | undefined) => contactRows.find((c) => c.id === id)?.name ?? null;

  // Calendar: today + next 7 days.
  const weekEnd = new Date(Date.now() + 7 * 86400_000).toISOString();
  const eventRows = db
    .select()
    .from(calendarEvents)
    .where(and(gte(calendarEvents.startsAt, `${today}T00:00:00`), lt(calendarEvents.startsAt, weekEnd)))
    .orderBy(asc(calendarEvents.startsAt))
    .all();
  const todayEvents = eventRows.filter((e) => e.startsAt.slice(0, 10) === today);

  // Transactions.
  const txRows = db.select().from(transactions).orderBy(desc(transactions.createdAt)).all();
  const active = txRows.filter((t) => t.status === "active" || t.status === "pending");
  const ytd = ytdStats(txRows, year);

  // Buyers + criteria.
  const profiles = db.select().from(buyerCriteriaProfiles).all();
  const buyers = profiles.map((p) => {
    const c = contactRows.find((x) => x.id === p.contactId);
    return {
      id: p.id,
      contactId: p.contactId,
      name: c?.name ?? p.label ?? "Buyer",
      temperature: c?.temperature ?? "warm",
      stage: c?.stage ?? null,
      phone: c?.phone ?? null,
      ceiling: p.ceilingText,
      areas: p.areas ?? [],
      hardConstraints: p.hardConstraints ?? [],
      mustHaves: p.mustHaves ?? [],
      prefs: p.weightedPrefs ?? [],
    };
  });

  // Off-market matches.
  const offMarket = db.select().from(properties).where(eq(properties.status, "off_market")).all();
  const omProps: OffMarketProperty[] = offMarket.map((p) => ({
    id: p.id,
    address: p.address,
    price: p.price,
    beds: p.beds,
    baths: p.baths,
    sqft: p.sqft,
    lot: p.lot,
    features: p.features ?? [],
    remarks: p.remarks,
    area: (p.sourceMeta as { hood?: string } | null)?.hood ?? null,
    source: (p.sourceMeta as { source?: string } | null)?.source ?? null,
  }));
  const offMarketMatches = matchOffMarket(
    profiles.map((p) => ({ id: p.id, label: nameOf(p.contactId) ?? p.label ?? "Buyer", contactId: p.contactId, ceilingAmount: p.ceilingAmount, ceilingHard: p.ceilingHard, hardConstraints: p.hardConstraints ?? [], weightedPrefs: p.weightedPrefs ?? [], areas: p.areas ?? [], mustHaves: p.mustHaves ?? [] })),
    omProps,
  ).map((m) => ({ ...m, property: omProps.find((p) => p.id === m.propertyId) }));

  // Deal risks.
  const risks = db.select().from(deals).where(inArray(deals.riskFlag, ["high", "med"])).all();

  // Contacts by temperature/role.
  const byTemp = (t: string) => contactRows.filter((c) => c.temperature === t);
  const contactsView = {
    hotBuyers: contactRows.filter((c) => c.temperature === "hot" && /buyer/i.test(c.role ?? "")),
    warmBuyers: contactRows.filter((c) => c.temperature === "warm" && /buyer/i.test(c.role ?? "")),
    sellers: contactRows.filter((c) => /seller/i.test(c.role ?? "")),
    pastClients: contactRows.filter((c) => /past/i.test(c.role ?? "")),
    cold: byTemp("cold"),
  };

  const planInput: GamePlanInput = {
    date: today,
    agentName: agent?.name ?? "Agent",
    priorities: todoRows.filter((t) => t.kind === "priority").map((t) => ({ title: t.title, done: t.done })),
    tasks: todoRows.filter((t) => t.kind === "task").map((t) => ({ title: t.title, done: t.done })),
    calls: todoRows.filter((t) => t.kind === "call").map((t) => ({ title: t.title, contact: nameOf(t.contactId), done: t.done })),
    appointments: todayEvents.map((e) => ({ time: new Date(e.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }), title: e.title, location: e.location })),
    hotBuyers: buyers.filter((b) => b.temperature === "hot").map((b) => ({ name: b.name, ceiling: b.ceiling, areas: b.areas })),
    activeTransactions: active.map((t) => ({ address: t.address, side: t.side, status: t.status, price: t.price })),
    dealRisks: risks.map((r) => ({ deal: r.name, issue: r.riskIssue ?? "" })),
    offMarketMatches: offMarketMatches.slice(0, 5).map((m) => ({ buyer: m.buyerLabel, address: m.address, score: m.result.score })),
    ytd,
  };

  return {
    today,
    agent: { name: agent?.name ?? "Agent" },
    todos: todoRows.map((t) => ({ ...t, contactName: nameOf(t.contactId) })),
    events: eventRows.map((e) => ({ ...e, contactName: nameOf(e.contactId) })),
    todayEvents: todayEvents.map((e) => ({ ...e, contactName: nameOf(e.contactId) })),
    transactions: active.map((t) => ({ ...t, contactName: nameOf(t.contactId), priceDisplay: money(t.price) })),
    ytd,
    buyers,
    offMarketMatches,
    risks,
    contacts: contactsView,
    plan: buildGamePlan(planInput),
    planInput,
  };
}

/**
 * Dashboard + live context: re-indexes the Obsidian vault when it changed,
 * refreshes the Google calendar mirror / inbox snapshot (read-only, cached),
 * and feeds both into the game plan. Never throws because of a connector —
 * failures are reported in `google.error` and the local data still renders.
 */
export async function loadDashboardLive() {
  let vault: ReturnType<typeof vaultToday>;
  try { vault = vaultToday(todayYmd()); } catch { vault = { configured: false, vaultName: null, recent: [], tasks: [], changed: false }; }
  const g = await googleForDashboard();
  const base = loadDashboard(); // after the calendar mirror so Google events are included
  const planInput: GamePlanInput = {
    ...base.planInput,
    inbox: g.inbox.map((m) => ({ from: m.from, subject: m.subject, snippet: m.snippet, important: m.important })),
    vaultTasks: vault.tasks.map((t) => t.text),
  };
  const gs = googleStatus();
  return { ...base, planInput, plan: buildGamePlan(planInput), inbox: g.inbox, vault, google: { configured: gs.configured, connected: gs.connected, email: gs.email, error: g.error } };
}
