export const OFF_MARKET_KINDS = ["off_market", "pocket_listing"] as const;
export const OPPORTUNITY_STATUSES = ["new", "watching", "pursuing", "matched", "dead"] as const;
export function isOffMarket(kind: string) { return (OFF_MARKET_KINDS as readonly string[]).includes(kind); }

export function filterOpportunities<T extends { id: string; kind: string; status: string; address: string; area: string | null; sourceAgent: string | null; notes: string | null }>(
  rows: T[], filters: { offMarketOnly: boolean; kind: string; status: string; query: string; focus?: string | null },
): T[] {
  const query = filters.query.trim().toLowerCase();
  return rows.filter((o) => (!filters.offMarketOnly || isOffMarket(o.kind)) &&
    (filters.kind === "all" || o.kind === filters.kind) &&
    (!filters.focus || o.id === filters.focus) &&
    (filters.status === "all" || (filters.status === "active" ? !!filters.focus || o.status !== "dead" : o.status === filters.status)) &&
    [o.address, o.area, o.sourceAgent, o.notes].some((v) => (v ?? "").toLowerCase().includes(query)));
}
