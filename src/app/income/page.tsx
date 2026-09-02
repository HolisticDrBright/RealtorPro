"use client";

import { useState } from "react";
import { label, useApi } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { fmtDate } from "@/lib/dates";
import { Badge, Card, Donut, Kpi, Loading, PageHeader, Progress, Table, type Column } from "@/components/ui/primitives";
import { useCrud } from "@/components/app/crud";

interface Row { id: string; closed: string; address: string; city: string; side: string; purchasePrice: number; commissionPct: number; gross: number; referralFee: number; split: number; expenses: number; net: number; clientName: string | null }
interface Report { rows: Row[]; totals: { count: number; volume: number; gci: number; net: number; referral: number; split: number; expenses: number; avgPrice: number; avgCommissionPct: number; avgGci: number; avgNet: number; buyerSide: number; listingSide: number }; cities: string[]; years: string[] }
interface Dash { goal: { goal: number; current: number; remaining: number; pct: number; monthlyTarget: number; monthlyAverage: number; projectedYearEnd: number; dealsNeeded: number | null; avgNetPerDeal: number | null; pendingNet: number; pipelineGci: number } }

export default function IncomePage() {
  const year = new Date().getFullYear();
  const [f, setF] = useState({ year: String(year), month: "", quarter: "", city: "", side: "" });
  const qs = Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
  const { data, loading } = useApi<Report>(`/api/income?${qs}`);
  const dash = useApi<Dash>("/api/dashboard");
  const crud = useCrud("transactions");
  const g = dash.data?.goal;
  const columns: Column<Row>[] = [
    { key: "closed", label: "Closing date", render: (r) => fmtDate(r.closed, { month: "short", day: "numeric", year: "numeric" }) },
    { key: "address", label: "Property", render: (r) => <div><div className="font-medium">{r.address}</div><div className="text-[12px] text-ink-3">{r.clientName}</div></div> },
    { key: "city", label: "City" },
    { key: "side", label: "Side", render: (r) => <Badge tone={r.side}>{r.side === "both" ? "Both" : label(r.side)}</Badge> },
    { key: "purchasePrice", label: "Closed price", align: "right", render: (r) => fmtMoney(r.purchasePrice) },
    { key: "commissionPct", label: "Comm. %", align: "right", render: (r) => `${r.commissionPct}%` },
    { key: "gross", label: "Gross commission", align: "right", render: (r) => fmtMoney(r.gross) },
    { key: "referralFee", label: "Referral fee", align: "right", render: (r) => fmtMoney(r.referralFee) },
    { key: "split", label: "Team / broker split", align: "right", render: (r) => fmtMoney(r.split) },
    { key: "expenses", label: "Expenses", align: "right", render: (r) => fmtMoney(r.expenses) },
    { key: "net", label: "Net income", align: "right", className: "font-semibold", render: (r) => fmtMoney(r.net) },
  ];
  const t = data?.totals;
  return (
    <div className="fade-in">
      <PageHeader title="Sales & Income" sub={`${t?.count ?? 0} closings in view`}>
        <select className="input w-28" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} aria-label="Year"><option value="">All years</option>{(data?.years.length ? data.years : [String(year)]).map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <select className="input w-28" value={f.quarter} onChange={(e) => setF({ ...f, quarter: e.target.value, month: "" })} aria-label="Quarter"><option value="">Quarter</option>{[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}</select>
        <select className="input w-32" value={f.month} onChange={(e) => setF({ ...f, month: e.target.value, quarter: "" })} aria-label="Month"><option value="">Month</option>{Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2000, i, 1).toLocaleString("en-US", { month: "long" })}</option>)}</select>
        <select className="input w-40" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} aria-label="City"><option value="">All cities</option>{data?.cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <select className="input w-32" value={f.side} onChange={(e) => setF({ ...f, side: e.target.value })} aria-label="Side"><option value="">Both sides</option><option value="buyer">Buyer side</option><option value="seller">Listing side</option></select>
        <button className="btn btn-primary" onClick={() => crud.openNew({ status: "closed" })}>+ Closed deal</button>
      </PageHeader>

      {g && (
        <Card className="mb-4" title={`$${Math.round(g.goal).toLocaleString()} Income Goal`}>
          <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
            <Donut pct={g.pct} size={150} label="complete" />
            <div>
              <div className="flex items-baseline gap-2"><span className="text-[26px] font-semibold tnum tracking-tight">{fmtMoney(g.current)}</span><span className="text-ink-3">of {fmtMoney(g.goal)} net income</span></div>
              <Progress pct={g.pct} className="mt-2 mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-[13px]">
                {[["Remaining income needed", fmtMoney(g.remaining)], ["Monthly target (remaining months)", fmtMoney(g.monthlyTarget)], ["Current monthly average", fmtMoney(g.monthlyAverage)], ["Projected year-end income", fmtMoney(g.projectedYearEnd)], ["Income pending in escrow", fmtMoney(g.pendingNet)], ["Potential income in pipeline", fmtMoney(g.pipelineGci)], ["Average net per closing", fmtMoney(g.avgNetPerDeal)], ["Deals needed to hit goal", g.dealsNeeded == null ? "—" : `≈ ${g.dealsNeeded} more closing${g.dealsNeeded === 1 ? "" : "s"}`]].map(([k, v]) => <div key={k}><div className="text-ink-3 text-[12px]">{k}</div><div className="font-semibold tnum text-[15px]">{v}</div></div>)}
              </div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 mb-4">
        <Kpi label="Closed volume" value={fmtMoney(t?.volume ?? 0, true)} /><Kpi label="Total GCI" value={fmtMoney(t?.gci ?? 0, true)} /><Kpi label="Total net income" value={fmtMoney(t?.net ?? 0, true)} /><Kpi label="Avg sale price" value={fmtMoney(t?.avgPrice ?? 0, true)} />
        <Kpi label="Avg commission" value={`${t?.avgCommissionPct ?? 0}%`} sub={`${fmtMoney(t?.avgGci ?? 0, true)} avg GCI`} /><Kpi label="Buyer-side" value={String(t?.buyerSide ?? 0)} /><Kpi label="Listing-side" value={String(t?.listingSide ?? 0)} /><Kpi label="Avg net / closing" value={fmtMoney(t?.avgNet ?? 0, true)} />
      </div>

      <Card title="Closed transactions">
        {loading ? <Loading /> : <Table rows={data?.rows ?? []} columns={columns} defaultSort={{ key: "closed", dir: "desc" }} onRow={(r) => crud.openEdit({ id: r.id })} empty="No closed transactions match these filters." />}
        {t && t.count > 0 && <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 pt-3 border-t border-line text-[12.5px] tnum"><span><b>Totals</b></span><span>Volume {fmtMoney(t.volume)}</span><span>GCI {fmtMoney(t.gci)}</span><span>Referral {fmtMoney(t.referral)}</span><span>Split {fmtMoney(t.split)}</span><span>Expenses {fmtMoney(t.expenses)}</span><span className="font-semibold">Net {fmtMoney(t.net)}</span></div>}
      </Card>
      {crud.panel}
    </div>
  );
}
