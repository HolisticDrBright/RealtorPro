import { describe, it, expect } from "vitest";
import { CA_BUYER_TEMPLATE, CA_SELLER_TEMPLATE, TEMPLATES, type TemplateItem } from "@/data/checklist-templates";
import { addBusinessDays, applies, buildItems, computeDueDate, effectiveDue, findTemplateItem, summarize, type BuiltItem } from "@/lib/checklist";
import { planRecompute, planFlagChange } from "@/lib/checklist-recompute";

const codes = (items: BuiltItem[]) => items.map((i) => i.code);

describe("template content", () => {
  it("ships a seller and a buyer template with four phases each and unique codes per phase", () => {
    expect(TEMPLATES.map((t) => t.side)).toEqual(["listing", "buyer"]);
    expect(CA_SELLER_TEMPLATE.phases.map((p) => p.key)).toEqual(["prelisting", "disclosures", "active", "escrow"]);
    expect(CA_BUYER_TEMPLATE.phases.map((p) => p.key)).toEqual(["representation", "offer", "escrow", "closing"]);
    for (const t of TEMPLATES) for (const ph of t.phases) {
      const seen = new Set<string>();
      for (const i of ph.items) {
        expect(seen.has(i.code), `${t.key}/${ph.key} duplicate ${i.code}`).toBe(false);
        seen.add(i.code);
        if (i.kind === "document" && i.formCode) expect(i.formCode).toMatch(/^[A-Z0-9]+$/);
      }
    }
  });
  it("encodes the handoff's key timelines", () => {
    const rule = (t: typeof CA_BUYER_TEMPLATE, code: string) => t.phases.flatMap((p) => p.items).find((i) => i.code === code)?.dueRule;
    expect(rule(CA_BUYER_TEMPLATE, "T-BUY-12")).toEqual({ anchor: "acceptance", days: 3, businessDays: true }); // deposit
    expect(rule(CA_BUYER_TEMPLATE, "T-BUY-13")).toEqual({ anchor: "acceptance", days: 3 }); // loan app
    expect(rule(CA_BUYER_TEMPLATE, "T-BUY-21")).toEqual({ anchor: "acceptance", days: 17 }); // investigation CR
    expect(rule(CA_BUYER_TEMPLATE, "T-BUY-23")).toEqual({ anchor: "acceptance", days: 21 }); // loan CR
    expect(rule(CA_BUYER_TEMPLATE, "T-BUY-27")).toEqual({ anchor: "coe", days: -3, businessDays: true }); // Closing Disclosure
    expect(rule(CA_BUYER_TEMPLATE, "T-BUY-28")).toEqual({ anchor: "coe", days: -5 }); // VP
    expect(rule(CA_BUYER_TEMPLATE, "T-BUY-03")).toEqual({ anchor: "listing_signed", days: 90 }); // BRBC expiry
    expect(rule(CA_SELLER_TEMPLATE, "T-SELL-24")).toEqual({ anchor: "acceptance", days: 7 }); // disclosures delivered
    expect(rule(CA_SELLER_TEMPLATE, "T-SELL-25")).toEqual({ anchor: "disclosure_delivery", days: 5 }); // rescission
    expect(rule(CA_SELLER_TEMPLATE, "T-SELL-35")).toEqual({ anchor: "coe", days: 0 }); // COE
  });
});

describe("conditional filtering", () => {
  const item = (condition: TemplateItem["condition"]) => ({ condition });
  it("always applies; other conditions need their flag", () => {
    expect(applies(item("always"), {})).toBe(true);
    expect(applies(item("pre1978"), {})).toBe(false);
    expect(applies(item("pre1978"), { pre1978: true })).toBe(true);
    expect(applies(item("hoa"), { pre1978: true })).toBe(false);
  });
  it("pre1978 toggles FLD; hoa toggles HOA1/HOA2 on the seller template", () => {
    const off = codes(buildItems(CA_SELLER_TEMPLATE, {}, {}));
    expect(off).not.toContain("FLD");
    expect(off).not.toContain("HOA1");
    expect(off).not.toContain("HOA2");
    expect(off).toContain("TDS");
    const on = codes(buildItems(CA_SELLER_TEMPLATE, { pre1978: true, hoa: true }, {}));
    expect(on).toContain("FLD");
    expect(on).toContain("HOA1");
    expect(on).toContain("HOA2");
    expect(on.length).toBeGreaterThan(off.length);
  });
  it("assigns phase order and a strictly increasing sortOrder that is stable across flag changes", () => {
    const items = buildItems(CA_BUYER_TEMPLATE, { financed: true }, {});
    for (let i = 1; i < items.length; i++) expect(items[i].sortOrder).toBeGreaterThan(items[i - 1].sortOrder);
    const fewer = buildItems(CA_BUYER_TEMPLATE, {}, {});
    for (const f of fewer) expect(items.find((i) => i.code === f.code && i.phaseKey === f.phaseKey)?.sortOrder).toBe(f.sortOrder);
    expect(items[0].phaseKey).toBe("representation");
    expect(items[items.length - 1].phaseKey).toBe("closing");
    expect(items.every((i) => i.status === "pending")).toBe(true);
  });
});

describe("due-date math", () => {
  it("calendar offsets, including COE − 5", () => {
    expect(computeDueDate({ anchor: "acceptance", days: 17 }, { acceptance: "2026-11-03" })).toBe("2026-11-20");
    expect(computeDueDate({ anchor: "acceptance", days: 21 }, { acceptance: "2026-11-03" })).toBe("2026-11-24");
    expect(computeDueDate({ anchor: "coe", days: -5 }, { coe: "2026-12-15" })).toBe("2026-12-10");
    expect(computeDueDate({ anchor: "coe", days: 0 }, { coe: "2026-12-15" })).toBe("2026-12-15");
  });
  it("business days skip the weekend: a Friday acceptance puts the deposit on Wednesday", () => {
    // 2026-11-06 is a Friday.
    expect(computeDueDate({ anchor: "acceptance", days: 3, businessDays: true }, { acceptance: "2026-11-06" })).toBe("2026-11-11");
    expect(addBusinessDays("2026-11-07", 1)).toBe("2026-11-09"); // Saturday → Monday
    expect(computeDueDate({ anchor: "coe", days: -3, businessDays: true }, { coe: "2026-11-10" })).toBe("2026-11-05"); // Tue → previous Thu
  });
  it("returns null when the anchor is missing or malformed", () => {
    expect(computeDueDate({ anchor: "coe", days: -5 }, { acceptance: "2026-11-03" })).toBeNull();
    expect(computeDueDate({ anchor: "acceptance", days: 7 }, { acceptance: "11/03/2026" })).toBeNull();
  });
  it("dueOverride wins over the computed date", () => {
    expect(effectiveDue({ dueDate: "2026-11-20", dueOverride: "2026-11-25" })).toBe("2026-11-25");
    expect(effectiveDue({ dueDate: "2026-11-20", dueOverride: null })).toBe("2026-11-20");
    expect(effectiveDue({})).toBeNull();
  });
  it("buildItems computes dates for dated items and leaves the rest null", () => {
    const items = buildItems(CA_BUYER_TEMPLATE, { financed: true }, { acceptance: "2026-11-06", coe: "2026-12-15" });
    const by = Object.fromEntries(items.map((i) => [i.code, i]));
    expect(by["T-BUY-12"].dueDate).toBe("2026-11-11");
    expect(by["T-BUY-21"].dueDate).toBe("2026-11-23");
    expect(by["T-BUY-28"].dueDate).toBe("2026-12-10");
    expect(by["T-BUY-17"].dueDate).toBeNull(); // disclosure_delivery not set
    expect(by["RPA"].dueDate).toBeNull();
  });
});

describe("recompute and flag changes (pure planners used by the service)", () => {
  const base = buildItems(CA_BUYER_TEMPLATE, { financed: true }, { acceptance: "2026-11-06", coe: "2026-12-15" });
  const rows = base.map((i, idx) => ({ ...i, id: `i${idx}` }));
  it("recomputes from new anchors but never touches overrides or done items", () => {
    const vp = rows.find((r) => r.code === "T-BUY-28")!;
    const cr = rows.find((r) => r.code === "T-BUY-21")!;
    const dep = rows.find((r) => r.code === "T-BUY-12")!;
    cr.dueOverride = "2026-11-30";
    dep.status = "done";
    const plan = planRecompute(CA_BUYER_TEMPLATE, rows, { acceptance: "2026-11-06", coe: "2026-12-22" });
    const upd = Object.fromEntries(plan.map((p) => [p.id, p.dueDate]));
    expect(upd[vp.id]).toBe("2026-12-17"); // COE − 5 moved
    expect(plan.find((p) => p.id === dep.id)).toBeUndefined(); // done item untouched
    const crUpdate = plan.find((p) => p.id === cr.id);
    expect(crUpdate?.dueDate ?? cr.dueDate).toBe("2026-11-23"); // computed stays
    expect(cr.dueOverride).toBe("2026-11-30"); // override untouched
    expect(findTemplateItem(CA_BUYER_TEMPLATE, "closing", "T-BUY-28")?.dueRule).toEqual({ anchor: "coe", days: -5 });
  });
  it("adds newly applicable items and marks no-longer-applicable pending items na", () => {
    const sellerRows = buildItems(CA_SELLER_TEMPLATE, { pre1978: true }, {}).map((i, idx) => ({ ...i, id: `s${idx}` }));
    const fld = sellerRows.find((r) => r.code === "FLD")!;
    const plan = planFlagChange(CA_SELLER_TEMPLATE, sellerRows, { pre1978: false, hoa: true }, {});
    expect(plan.add.map((a) => a.code)).toEqual(expect.arrayContaining(["HOA1", "HOA2", "T-SELL-03", "T-SELL-14"]));
    expect(plan.markNa).toContain(fld.id);
    // A done item stays as history even when its condition is switched off.
    fld.status = "done";
    const plan2 = planFlagChange(CA_SELLER_TEMPLATE, sellerRows, { pre1978: false }, {});
    expect(plan2.markNa).not.toContain(fld.id);
    // Switching a flag back on revives an na item instead of duplicating it.
    fld.status = "na";
    const plan3 = planFlagChange(CA_SELLER_TEMPLATE, sellerRows, { pre1978: true }, {});
    expect(plan3.revive).toContain(fld.id);
    expect(plan3.add.map((a) => a.code)).not.toContain("FLD");
  });
});

describe("summary", () => {
  it("counts totals, done, overdue, due-soon and per-phase next due; na items are excluded", () => {
    const items = [
      { phaseKey: "offer", phaseOrder: 2, status: "done", dueDate: "2026-11-01" },
      { phaseKey: "offer", phaseOrder: 2, status: "pending", dueDate: "2026-11-01" }, // overdue
      { phaseKey: "escrow", phaseOrder: 3, status: "pending", dueDate: "2026-11-05", dueOverride: "2026-11-04" }, // due soon (override)
      { phaseKey: "escrow", phaseOrder: 3, status: "pending", dueDate: "2026-12-01" }, // later
      { phaseKey: "escrow", phaseOrder: 3, status: "waived" },
      { phaseKey: "closing", phaseOrder: 4, status: "na", dueDate: "2026-11-02" }, // excluded
      { phaseKey: "closing", phaseOrder: 4, status: "pending" }, // undated
    ];
    const s = summarize(items, "2026-11-03", { offer: "Offer", escrow: "Escrow", closing: "Closing" });
    expect(s.total).toBe(6);
    expect(s.done).toBe(2);
    expect(s.overdue).toBe(1);
    expect(s.dueSoon).toBe(1);
    expect(s.nextDue).toBe("2026-11-01");
    expect(s.byPhase.map((p) => [p.phaseKey, p.total, p.done, p.nextDue])).toEqual([
      ["offer", 2, 1, "2026-11-01"],
      ["escrow", 3, 1, "2026-11-04"],
      ["closing", 1, 0, null],
    ]);
    expect(s.byPhase[1].name).toBe("Escrow");
  });
});
