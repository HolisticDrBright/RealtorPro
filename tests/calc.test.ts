import { describe, expect, it } from "vitest";
import { brokerSplit, goalStats, grossCommission, netIncome, pipelineTotals, fmtMoney } from "../src/lib/calc";
import { daysUntil, nextAnniversary, nextRecurrence, ymd } from "../src/lib/dates";
import { buildPriorities } from "../src/lib/priorities";
import { matchAll, scoreMatch } from "../src/lib/match";
import { buildFollowUps } from "../src/lib/followups";

describe("commission math", () => {
  const t = { purchasePrice: 3000000, commissionPct: 2.5, referralFee: 5000, brokerSplitPct: 20, expenses: 1000 };
  it("computes gross, split and net", () => {
    expect(grossCommission(t)).toBe(75000);
    expect(brokerSplit(t)).toBe(14000); // (75000 - 5000) * 20%
    expect(netIncome(t)).toBe(55000); // 75000 - 5000 - 14000 - 1000
  });
  it("formats money compactly", () => {
    expect(fmtMoney(18450000, true)).toBe("$18.45M");
    expect(fmtMoney(127500)).toBe("$127,500");
    expect(fmtMoney(null)).toBe("—");
  });
});

describe("goal stats", () => {
  it("derives remaining, pace, projection and deals needed", () => {
    const g = goalStats(200000, 127500, 11, new Date(2026, 6, 1)); // July 1 ≈ 6 months elapsed
    expect(g.remaining).toBe(72500);
    expect(g.pct).toBe(63.75);
    expect(g.monthlyAverage).toBeGreaterThan(20000);
    expect(g.projectedYearEnd).toBeGreaterThan(200000);
    expect(g.avgNetPerDeal).toBeCloseTo(11590.91, 1);
    expect(g.dealsNeeded).toBe(7);
  });
  it("handles zero closings", () => {
    const g = goalStats(200000, 0, 0, new Date(2026, 1, 1));
    expect(g.dealsNeeded).toBeNull();
    expect(g.pct).toBe(0);
  });
});

describe("pipeline totals", () => {
  it("weights by probability and ignores closed", () => {
    const t = pipelineTotals([{ estValue: 1000000, estCommission: 25000, probability: 50, stage: "qualified" }, { estValue: 2000000, estCommission: 50000, probability: 100, stage: "closed" }, { estValue: 500000, estCommission: 12500, probability: 20, stage: "new_lead" }]);
    expect(t.count).toBe(2);
    expect(t.totalVolume).toBe(1500000);
    expect(t.weightedVolume).toBe(600000);
    expect(t.potentialGci).toBe(37500);
    expect(t.weightedGci).toBe(15000);
  });
});

describe("dates", () => {
  it("counts days and rolls anniversaries forward", () => {
    const now = new Date(2026, 8, 2, 10);
    expect(daysUntil("2026-09-05", now)).toBe(3);
    expect(daysUntil("2026-08-30", now)).toBe(-3);
    expect(nextAnniversary("1978-03-14", now)).toBe("2027-03-14");
    expect(nextAnniversary("1978-09-02", now)).toBe("2026-09-02");
    expect(nextRecurrence("2026-01-31", "monthly")).toBe("2026-03-03"); // JS month roll — acceptable, documented
    expect(nextRecurrence("2026-09-02", "weekly")).toBe("2026-09-09");
    expect(ymd(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("priorities", () => {
  const now = new Date(2026, 8, 2, 9);
  const names = (id: string | null) => (id === "c1" ? "Sarah Thompson" : id === "c2" ? "James Pickford" : null);
  const addresses = (id: string | null) => (id === "p1" ? "14 Shoreline" : null);
  it("ranks overdue tasks, imminent milestones and neglected hot buyers first", () => {
    const items = buildPriorities({
      now, names, addresses,
      tasks: [{ id: "t1", title: "Low task due next week", priority: "low", dueDate: "2026-09-09", dueTime: null, contactId: null, propertyId: null, transactionId: null, completedAt: null, sortOrder: 0 }, { id: "t2", title: "Overdue photos", priority: "medium", dueDate: "2026-08-31", dueTime: null, contactId: null, propertyId: "p1", transactionId: null, completedAt: null, sortOrder: 1 }, { id: "t3", title: "Done", priority: "critical", dueDate: "2026-09-02", dueTime: null, contactId: null, propertyId: null, transactionId: null, completedAt: "x", sortOrder: 2 }],
      calls: [], buyers: [{ id: "b1", contactId: "c1", temperature: "hot", lastContactAt: "2026-08-20T00:00:00Z", timeline: null }], listings: [],
      milestones: [{ id: "m1", transactionId: "e1", name: "Inspection Contingency", dueDate: "2026-09-03", completedAt: null }, { id: "m2", transactionId: "e1", name: "Closing", dueDate: "2026-09-30", completedAt: null }],
      offers: [{ id: "o1", contactId: "c2", propertyId: "p1", status: "countered", submittedAt: "2026-09-01" }], appointments: [], contacts: [],
    });
    const ids = items.map((i) => i.id);
    expect(ids).not.toContain("task-t1");
    expect(ids).not.toContain("task-t3");
    expect(ids).not.toContain("ms-m2");
    expect(ids[0]).toBe("ms-m1"); // due tomorrow → critical
    expect(items.find((i) => i.id === "task-t2")?.priority).toBe("critical");
    expect(items.find((i) => i.id === "buyer-b1")?.subtitle).toContain("13 days");
    expect(items.find((i) => i.id === "offer-o1")?.title).toContain("Respond to counter");
  });
});

describe("buyer match", () => {
  const buyer = { id: "b1", contactId: "c1", temperature: "hot", priceMin: 3000000, priceMax: 5000000, targetAreas: ["Newport Coast"], minBeds: 4, minBaths: 3, minSqft: 3000, propertyType: "Single Family", mustHaves: ["ocean view"], dealBreakers: ["interior courtyard"] };
  it("scores a strong match with reasons and rejects deal breakers / far-over-budget", () => {
    const good = scoreMatch(buyer, { id: "l1", kind: "listing", address: "14 Shoreline", area: "Newport Coast", price: 4650000, beds: 5, baths: 5.5, sqft: 4800, propertyType: "Single Family", features: ["Ocean view, Catalina"] });
    expect(good?.score).toBeGreaterThanOrEqual(90);
    expect(good?.reasons).toContain("Within price range");
    expect(scoreMatch(buyer, { id: "l2", kind: "listing", address: "x", area: "Newport Coast", price: 4000000, beds: 5, baths: 4, sqft: 4000, propertyType: "Single Family", features: ["interior courtyard"] })).toBeNull();
    expect(scoreMatch(buyer, { id: "l3", kind: "listing", address: "x", area: "Newport Coast", price: 6000000, beds: 5, baths: 4, sqft: 4000, propertyType: "Single Family", features: [] })).toBeNull();
    const weak = scoreMatch(buyer, { id: "l4", kind: "opportunity", address: "x", area: "Irvine", price: 4000000, beds: 3, baths: 2, sqft: 2000, propertyType: "Condo", features: [] });
    expect(weak).toBeNull();
  });
  it("sorts all matches by score", () => {
    const r = matchAll([buyer], [{ id: "a", kind: "listing", address: "a", area: "Newport Coast", price: 4000000, beds: 4, baths: 3, sqft: 3200, propertyType: "Single Family", features: ["ocean view"] }, { id: "b", kind: "listing", address: "b", area: "Newport Coast", price: 5200000, beds: 4, baths: 3, sqft: 3200, propertyType: "Single Family", features: [] }]);
    expect(r.map((x) => x.candidateId)).toEqual(["a", "b"]);
    expect(r[1].concerns[0]).toMatch(/over budget/);
  });
});

describe("follow-ups", () => {
  it("buckets contacts by urgency", () => {
    const now = new Date(2026, 8, 2);
    const items = buildFollowUps(
      [
        { id: "a", type: "buyer", stage: "qualified", lastContactAt: "2026-08-20", nextFollowUpAt: "2026-08-30", checkBackAt: null, archived: false },
        { id: "b", type: "buyer", stage: "active_buyer", lastContactAt: "2026-08-25", nextFollowUpAt: null, checkBackAt: null, archived: false },
        { id: "c", type: "sphere", stage: "nurture", lastContactAt: "2026-06-01", nextFollowUpAt: null, checkBackAt: null, archived: false },
        { id: "d", type: "past_client", stage: "closed", lastContactAt: "2026-08-30", nextFollowUpAt: null, checkBackAt: null, archived: false },
        { id: "e", type: "vendor", stage: "nurture", lastContactAt: null, nextFollowUpAt: null, checkBackAt: null, archived: false },
      ],
      [{ contactId: "b", temperature: "hot", timeline: null, status: "active" }],
      now,
    );
    expect(items.find((i) => i.contactId === "a")?.bucket).toBe("overdue");
    expect(items.find((i) => i.contactId === "b")?.bucket).toBe("hot_no_contact");
    expect(items.find((i) => i.contactId === "c")?.bucket).toBe("30d");
    expect(items.some((i) => i.contactId === "d")).toBe(false);
    expect(items.some((i) => i.contactId === "e")).toBe(false);
    expect(items[0].contactId).toBe("a");
  });
});
