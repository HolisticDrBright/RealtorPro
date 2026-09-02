import { describe, it, expect } from "vitest";
import { ytdStats, transactionGci, matchOffMarket, buildGamePlan, type GamePlanInput } from "@/lib/dashboard";
import { parseIcs, icsDateToIso } from "@/lib/ics";

describe("YTD closings stats", () => {
  const tx = [
    { side: "listing", status: "closed", price: 800000, closedAt: "2026-01-24", commissionPct: 2.5, gci: 20000 },
    { side: "buyer", status: "closed", price: 600000, closedAt: "2026-02-18", commissionPct: 2.5 }, // gci derived
    { side: "buyer", status: "closed", price: 500000, closedAt: "2026-04-11" }, // gci unknown
    { side: "listing", status: "closed", price: 900000, closedAt: "2025-12-30", gci: 22500 }, // prior year
    { side: "buyer", status: "pending", price: 512000 }, // not closed
  ];
  it("counts only closings in the given year, split by side", () => {
    const s = ytdStats(tx, 2026);
    expect(s.listings.deals).toBe(1);
    expect(s.buyers.deals).toBe(2);
    expect(s.total.deals).toBe(3);
    expect(s.total.volume).toBe(800000 + 600000 + 500000);
  });
  it("uses recorded GCI, derives from commission % when both inputs exist, never estimates otherwise", () => {
    expect(transactionGci({ side: "buyer", status: "closed", gci: 123 })).toBe(123);
    expect(transactionGci({ side: "buyer", status: "closed", price: 600000, commissionPct: 2.5 })).toBe(15000);
    expect(transactionGci({ side: "buyer", status: "closed", price: 500000 })).toBeNull();
    const s = ytdStats(tx, 2026);
    expect(s.total.gci).toBe(20000 + 15000);
    expect(s.total.gciUnknown).toBe(1);
  });
});

describe("off-market matching (buyers × off-market properties)", () => {
  const buyer = { id: "cp1", label: "Mehta", ceilingAmount: 700000, ceilingHard: true, hardConstraints: ["3+ beds"], weightedPrefs: [{ label: "Fenced yard", weight: 90 }, { label: "Updated kitchen", weight: 70 }], mustHaves: ["Off-street parking"], areas: ["Woodstock"] };
  it("scores an off-market property with cited reasons and excludes over-ceiling ones", () => {
    const props = [
      { id: "om1", address: "5218 SE 41st Ave", price: "$685,000", beds: 3, baths: 2, features: ["fenced yard", "detached garage", "updated kitchen"], source: "owner-authorized" },
      { id: "om2", address: "1 Too Pricey Ln", price: "$900,000", beds: 4, features: ["fenced yard", "garage", "updated kitchen"] },
    ];
    const matches = matchOffMarket([buyer], props);
    expect(matches.map((m) => m.propertyId)).toEqual(["om1"]);
    expect(matches[0].result.reasons.some((r) => /Off-market: owner-authorized/.test(r.source))).toBe(true);
  });
  it("returns nothing when no property meets the minimum fit", () => {
    expect(matchOffMarket([buyer], [{ id: "x", address: "x", price: "$500,000", beds: 3, features: [] }])).toHaveLength(0);
  });
});

describe("daily game plan (local, facts-only)", () => {
  const input: GamePlanInput = {
    date: "2026-07-21",
    agentName: "Avery Sandoval",
    priorities: [{ title: "Reply to addendum", done: false }, { title: "Done thing", done: true }],
    tasks: [{ title: "Order lockbox", done: false }],
    calls: [{ title: "Appraisal check", contact: "Dana", done: false }],
    appointments: [{ time: "10:30 AM", title: "Showing", location: "Reedway" }],
    hotBuyers: [{ name: "Mehta", ceiling: "$700k", areas: ["Woodstock"] }],
    activeTransactions: [],
    dealRisks: [{ deal: "Ruiz", issue: "contingency expires" }],
    offMarketMatches: [{ buyer: "Mehta", address: "5218 SE 41st", score: 82 }],
    ytd: { year: 2026, listings: { deals: 1, volume: 1, gci: 1, gciUnknown: 0 }, buyers: { deals: 0, volume: 0, gci: 0, gciUnknown: 0 }, total: { deals: 1, volume: 1, gci: 1, gciUnknown: 0 } },
  };
  it("builds a headline and ordered sections from open items only", () => {
    const plan = buildGamePlan(input);
    expect(plan.headline).toMatch(/Good morning, Avery\. 1 appointment, 1 priority, 1 call/);
    expect(plan.sections[0].title).toBe("Protect the deals");
    const pri = plan.sections.find((s) => s.title === "Priorities")!;
    expect(pri.items).toEqual(["Reply to addendum"]); // completed item excluded
    expect(plan.sections.at(-1)?.title).toBe("Year to date");
    expect(plan.provider).toBe("local");
  });
});

describe("ICS import", () => {
  it("parses folded VEVENTs with UTC and floating times", () => {
    const ics = ["BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:abc", "SUMMARY:Showing — Reedway", "LOCATION:4823 SE Reedway St", "DTSTART:20260721T173000Z", "DTEND:20260721T181500Z", "DESCRIPTION:Bring the ", " inspector checklist", "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const ev = parseIcs(ics);
    expect(ev).toHaveLength(1);
    expect(ev[0].title).toBe("Showing — Reedway");
    expect(ev[0].startsAt).toBe("2026-07-21T17:30:00Z");
    expect(ev[0].description).toBe("Bring the inspector checklist");
    expect(icsDateToIso("garbage")).toBeNull();
  });
});
