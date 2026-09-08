import { describe, expect, it } from "vitest";
import { filterOpportunities, isOffMarket } from "@/lib/opportunities";

const rows = ["off_market", "pocket_listing", "coming_soon", "investment", "tear_down"].map((kind, i) => ({ id: String(i), kind, status: "new", address: `${i} Test Road`, area: "Test Market", sourceAgent: "Test Source", notes: null }));
const defaults = { offMarketOnly: true, kind: "all", status: "active", query: "" };
describe("Off-Market shared opportunity views", () => {
  it("includes private leads and pockets but not coming-soon or investment records", () => {
    expect(filterOpportunities(rows, defaults).map((r) => r.kind)).toEqual(["off_market", "pocket_listing"]);
    expect(isOffMarket("coming_soon")).toBe(false);
  });
  it("preserves the all-opportunities view without copying records", () => {
    const filtered = filterOpportunities(rows, { ...defaults, offMarketOnly: false });
    expect(filtered).toHaveLength(5); expect(filtered[0]).toBe(rows[0]);
  });
  it("searches addresses, areas, sources and notes case-insensitively", () => {
    expect(filterOpportunities(rows, { ...defaults, query: " 1 TEST " })).toEqual([rows[1]]);
    expect(filterOpportunities(rows, { ...defaults, query: "source" })).toHaveLength(2);
    expect(filterOpportunities(rows, { ...defaults, query: "market" })).toHaveLength(2);
    expect(filterOpportunities([{ ...rows[0], notes: "Builder referral" }], { ...defaults, query: "builder" })).toHaveLength(1);
  });
  it("archives without losing the record and supports recovery", () => {
    const archived = [{ ...rows[0], status: "dead" }];
    expect(filterOpportunities(archived, defaults)).toHaveLength(0);
    expect(filterOpportunities(archived, { ...defaults, status: "dead" })).toHaveLength(1);
    expect(filterOpportunities(archived, { ...defaults, status: "all" })).toHaveLength(1);
  });
  it("filters stages and private-lead subtypes together", () => {
    expect(filterOpportunities(rows, { ...defaults, kind: "pocket_listing", status: "new" })).toEqual([rows[1]]);
    expect(filterOpportunities(rows, { ...defaults, status: "pursuing" })).toHaveLength(0);
  });
  it("supports a focused search result, including an archived lead", () => {
    expect(filterOpportunities([{ ...rows[0], status: "dead" }, rows[1]], { ...defaults, focus: "0" })).toHaveLength(1);
    expect(filterOpportunities(rows, { ...defaults, focus: "2" })).toHaveLength(0);
  });
});
