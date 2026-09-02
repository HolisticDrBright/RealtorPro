/**
 * Dashboard logic — pure and unit-tested.
 *
 *   ytdStats        year-to-date closings split by side (listing / buyer):
 *                   deals, volume, GCI — GCI is never invented: it is the
 *                   recorded gci, else price × commission % when both exist.
 *   matchOffMarket  buyers × off-market properties using the same explainable
 *                   scorer as Buyer Scout (objective facts only, sources cited).
 *   buildGamePlan   deterministic daily game plan from the day's todos, calls,
 *                   appointments, buyers and deal risks (the local fallback and
 *                   the "verified facts" payload handed to Claude).
 */
import { parseMoney, parseNumber } from "./listing-parse";
import { buildScoringCriteria, scoreListing, type MatchResult, type StoredCriteria, type ScoringFacts } from "./match-scoring";

// ── YTD stats ────────────────────────────────────────────────────────────────

export interface TransactionLike {
  side: "listing" | "buyer" | string;
  status: string;
  price?: number | null;
  closedAt?: string | null;
  commissionPct?: number | null;
  gci?: number | null;
}

export interface SideStats {
  deals: number;
  volume: number;
  gci: number;
  /** Closed deals where GCI could not be determined (no gci and no commission %). */
  gciUnknown: number;
}

export interface YtdStats {
  year: number;
  listings: SideStats;
  buyers: SideStats;
  total: SideStats;
}

const empty = (): SideStats => ({ deals: 0, volume: 0, gci: 0, gciUnknown: 0 });

export function transactionGci(t: TransactionLike): number | null {
  if (typeof t.gci === "number" && Number.isFinite(t.gci)) return t.gci;
  if (typeof t.price === "number" && typeof t.commissionPct === "number") return (t.price * t.commissionPct) / 100;
  return null;
}

export function ytdStats(transactions: TransactionLike[], year: number): YtdStats {
  const listings = empty();
  const buyers = empty();
  for (const t of transactions) {
    if (t.status !== "closed" || !t.closedAt || !t.closedAt.startsWith(String(year))) continue;
    const bucket = t.side === "listing" ? listings : buyers;
    bucket.deals += 1;
    bucket.volume += t.price ?? 0;
    const g = transactionGci(t);
    if (g == null) bucket.gciUnknown += 1;
    else bucket.gci += g;
  }
  const total: SideStats = {
    deals: listings.deals + buyers.deals,
    volume: listings.volume + buyers.volume,
    gci: listings.gci + buyers.gci,
    gciUnknown: listings.gciUnknown + buyers.gciUnknown,
  };
  return { year, listings, buyers, total };
}

// ── Off-market matching ──────────────────────────────────────────────────────

export interface OffMarketProperty {
  id: string;
  address: string;
  price?: string | number | null;
  beds?: number | null;
  baths?: number | null;
  sqft?: string | number | null;
  lot?: string | null;
  features?: string[] | null;
  remarks?: string | null;
  area?: string | null;
  source?: string | null;
}

export interface BuyerProfileLike extends StoredCriteria {
  id: string;
  label: string;
  contactId?: string | null;
}

export interface OffMarketMatch {
  buyerId: string;
  buyerLabel: string;
  contactId?: string | null;
  propertyId: string;
  address: string;
  result: MatchResult;
}

export function propertyToFacts(p: OffMarketProperty): ScoringFacts {
  const src = p.source ? `Off-market: ${p.source}` : "Off-market record";
  return {
    price: typeof p.price === "number" ? p.price : parseMoney(p.price ?? null),
    beds: p.beds ?? null,
    baths: p.baths ?? null,
    sqft: typeof p.sqft === "number" ? p.sqft : parseNumber(p.sqft ?? null),
    lotSqft: parseNumber(p.lot ?? null),
    area: p.area ?? null,
    features: [...(p.features ?? []), ...(p.lot ? [p.lot] : [])],
    remarks: p.remarks ?? null,
    sources: { price: `${src} · price`, beds: `${src} · beds`, baths: `${src} · baths` },
  };
}

/** Score every buyer against every off-market property; return matches ≥ minScore, best first. */
export function matchOffMarket(profiles: BuyerProfileLike[], properties: OffMarketProperty[], minScore = 40): OffMarketMatch[] {
  const out: OffMarketMatch[] = [];
  for (const b of profiles) {
    const criteria = buildScoringCriteria(b);
    for (const p of properties) {
      const result = scoreListing(criteria, propertyToFacts(p));
      if (result.excluded || result.score < minScore) continue;
      out.push({ buyerId: b.id, buyerLabel: b.label, contactId: b.contactId, propertyId: p.id, address: p.address, result });
    }
  }
  return out.sort((a, b) => b.result.score - a.result.score);
}

// ── Game plan ────────────────────────────────────────────────────────────────

export interface GamePlanInput {
  date: string; // YYYY-MM-DD
  agentName: string;
  priorities: { title: string; done: boolean }[];
  tasks: { title: string; done: boolean }[];
  calls: { title: string; contact?: string | null; done: boolean }[];
  appointments: { time: string; title: string; location?: string | null }[];
  hotBuyers: { name: string; ceiling?: string | null; areas?: string[] }[];
  activeTransactions: { address: string; side: string; status: string; price?: number | null }[];
  dealRisks: { deal: string; issue: string }[];
  offMarketMatches: { buyer: string; address: string; score: number }[];
  ytd: YtdStats;
  /** Optional read-only context from Gmail (subject lines + snippets, never bodies). */
  inbox?: { from: string; subject: string; snippet: string; important?: boolean }[];
  /** Optional open checkbox tasks pulled from the Obsidian vault (daily note / AgentOS folder). */
  vaultTasks?: string[];
}

export interface GamePlanSection {
  title: string;
  items: string[];
}
export interface GamePlan {
  headline: string;
  sections: GamePlanSection[];
  provider: string;
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

/** Deterministic, source-only game plan (no invented facts). */
export function buildGamePlan(input: GamePlanInput): GamePlan {
  const openPriorities = input.priorities.filter((p) => !p.done);
  const openCalls = input.calls.filter((c) => !c.done);
  const openTasks = input.tasks.filter((t) => !t.done);
  const first = input.agentName.split(" ")[0] || "there";

  const headline = `Good morning, ${first}. ${input.appointments.length} appointment${input.appointments.length === 1 ? "" : "s"}, ${openPriorities.length} priorit${openPriorities.length === 1 ? "y" : "ies"}, ${openCalls.length} call${openCalls.length === 1 ? "" : "s"} to make.`;

  const sections: GamePlanSection[] = [];
  if (input.dealRisks.length) sections.push({ title: "Protect the deals", items: input.dealRisks.map((r) => `${r.deal} — ${r.issue}`) });
  if (openPriorities.length) sections.push({ title: "Priorities", items: openPriorities.map((p) => p.title) });
  if (input.vaultTasks?.length) sections.push({ title: "From your vault", items: input.vaultTasks.slice(0, 8) });
  if (input.appointments.length) sections.push({ title: "Schedule", items: input.appointments.map((a) => `${a.time} · ${a.title}${a.location ? ` · ${a.location}` : ""}`) });
  if (input.inbox?.length) sections.push({ title: "From your inbox", items: input.inbox.slice(0, 6).map((m) => `${m.from} — ${m.subject}${m.important ? " (flagged)" : ""}`) });
  if (openCalls.length) sections.push({ title: "Calls to make", items: openCalls.map((c) => c.contact ? `${c.contact} — ${c.title}` : c.title) });
  if (input.offMarketMatches.length) sections.push({ title: "Off-market matches to review", items: input.offMarketMatches.map((m) => `${m.buyer} ↔ ${m.address} (fit ${m.score})`) });
  if (input.hotBuyers.length) sections.push({ title: "Hot buyers to touch", items: input.hotBuyers.map((b) => `${b.name}${b.ceiling ? ` · ceiling ${b.ceiling}` : ""}${b.areas?.length ? ` · ${b.areas.join(", ")}` : ""}`) });
  if (openTasks.length) sections.push({ title: "Everything else today", items: openTasks.map((t) => t.title) });
  sections.push({
    title: "Year to date",
    items: [
      `${input.ytd.total.deals} closings · ${money(input.ytd.total.volume)} volume · ${money(input.ytd.total.gci)} GCI`,
      `Listings ${input.ytd.listings.deals} (${money(input.ytd.listings.gci)}) · Buyers ${input.ytd.buyers.deals} (${money(input.ytd.buyers.gci)})`,
    ],
  });
  return { headline, sections, provider: "local" };
}
