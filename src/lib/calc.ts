/** Pure money / goal / pipeline math. Unit-tested; no I/O. */

export interface TxMoney {
  purchasePrice: number;
  commissionPct: number;
  referralFee: number;
  brokerSplitPct: number;
  expenses: number;
}

export function grossCommission(t: Pick<TxMoney, "purchasePrice" | "commissionPct">): number {
  return round2((t.purchasePrice * t.commissionPct) / 100);
}

/** Net = gross − referral fee − broker/team split (of gross after referral) − expenses. */
export function netIncome(t: TxMoney): number {
  const gross = grossCommission(t);
  const afterReferral = gross - t.referralFee;
  const split = (afterReferral * t.brokerSplitPct) / 100;
  return round2(afterReferral - split - t.expenses);
}

export function brokerSplit(t: TxMoney): number {
  return round2(((grossCommission(t) - t.referralFee) * t.brokerSplitPct) / 100);
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export interface GoalStats {
  goal: number;
  current: number;
  remaining: number;
  pct: number;
  monthlyTarget: number; // needed per remaining month
  monthlyAverage: number; // earned per elapsed month
  projectedYearEnd: number;
  dealsNeeded: number | null;
  avgNetPerDeal: number | null;
}

/** Goal progress as of `now`. Elapsed months are fractional so the pace is honest mid-month. */
export function goalStats(goal: number, currentNet: number, closedCount: number, now: Date): GoalStats {
  const start = new Date(now.getFullYear(), 0, 1);
  const end = new Date(now.getFullYear() + 1, 0, 1);
  const elapsed = Math.max(0.25, ((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 12);
  const remainingMonths = Math.max(0, 12 - elapsed);
  const remaining = Math.max(0, goal - currentNet);
  const monthlyAverage = currentNet / elapsed;
  const avgNetPerDeal = closedCount > 0 ? currentNet / closedCount : null;
  return {
    goal,
    current: round2(currentNet),
    remaining: round2(remaining),
    pct: goal > 0 ? Math.min(999, round2((currentNet / goal) * 100)) : 0,
    monthlyTarget: remainingMonths > 0 ? round2(remaining / remainingMonths) : 0,
    monthlyAverage: round2(monthlyAverage),
    projectedYearEnd: round2(monthlyAverage * 12),
    dealsNeeded: avgNetPerDeal && avgNetPerDeal > 0 ? Math.ceil(remaining / avgNetPerDeal) : null,
    avgNetPerDeal: avgNetPerDeal != null ? round2(avgNetPerDeal) : null,
  };
}

export interface PipelineCard { estValue: number | null; estCommission: number | null; probability: number; stage: string }

export function pipelineTotals(cards: PipelineCard[]) {
  const open = cards.filter((c) => c.stage !== "closed");
  const sum = (f: (c: PipelineCard) => number) => round2(open.reduce((a, c) => a + f(c), 0));
  return {
    totalVolume: sum((c) => c.estValue ?? 0),
    weightedVolume: sum((c) => ((c.estValue ?? 0) * c.probability) / 100),
    potentialGci: sum((c) => c.estCommission ?? 0),
    weightedGci: sum((c) => ((c.estCommission ?? 0) * c.probability) / 100),
    count: open.length,
  };
}

/** Estimated commission from a price and a percentage. */
export const estCommission = (price: number | null | undefined, pct: number) => (price ? round2((price * pct) / 100) : 0);

export const fmtMoney = (n: number | null | undefined, compact = false): string => {
  if (n == null || Number.isNaN(n)) return "—";
  if (compact) {
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(n % 1e6 === 0 ? 0 : 2).replace(/\.?0+$/, "")}M`;
    if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}K`;
  }
  return "$" + Math.round(n).toLocaleString("en-US");
};

export const pct = (a: number, b: number) => (b > 0 ? round2((a / b) * 100) : 0);
export const pricePerSqft = (price: number, sqft: number | null | undefined) => (sqft ? Math.round(price / sqft) : null);
