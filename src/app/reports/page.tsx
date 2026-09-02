"use client";

import { useState } from "react";
import { label, useApi } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { Bars, Card, Kpi, Loading, PageHeader, Table, type Column } from "@/components/ui/primitives";

interface Src { source: string; leads: number; closings: number; revenue: number; net: number; conversion: number }
interface Analytics { year: number; monthly: { month: string; volume: number; net: number; gci: number; closed: number; buyer: number; seller: number }[]; totals: { closed: number; volume: number; gci: number; net: number; avgPrice: number; avgCommission: number; avgNet: number; listingsTaken: number; listingsSold: number; buyerTx: number; sellerTx: number; avgDaysToClose: number | null; leadConversion: number; listingConversion: number }; leadSources: Src[]; years: string[] }

export default function ReportsPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, loading } = useApi<Analytics>(`/api/analytics?year=${year}`);
  if (loading || !data) return <Loading rows={6} />;
  const t = data.totals;
  const srcCols: Column<Src & { id: string }>[] = [
    { key: "source", label: "Source", render: (r) => <span className="font-medium">{label(r.source)}</span> },
    { key: "leads", label: "Leads", align: "right" }, { key: "closings", label: "Closings", align: "right" },
    { key: "revenue", label: "Revenue (GCI)", align: "right", render: (r) => fmtMoney(r.revenue) }, { key: "net", label: "Net income", align: "right", render: (r) => fmtMoney(r.net) },
    { key: "conversion", label: "Conversion", align: "right", render: (r) => `${r.conversion}%` },
    { key: "share", label: "Share of net", render: (r) => <div className="flex items-center gap-2"><div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden"><div className="h-full bg-gold" style={{ width: `${t.net ? (r.net / t.net) * 100 : 0}%` }} /></div><span className="tnum text-[12px] w-10 text-right">{t.net ? Math.round((r.net / t.net) * 100) : 0}%</span></div> },
  ];
  return (
    <div className="fade-in">
      <PageHeader title="Reports" sub="Business analytics"><select className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Year">{(data.years.length ? data.years : [String(year)]).map((y) => <option key={y} value={y}>{y}</option>)}</select></PageHeader>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 mb-4">
        <Kpi label="Transactions closed" value={String(t.closed)} sub={`${t.buyerTx} buyer · ${t.sellerTx} seller`} /><Kpi label="Sales volume" value={fmtMoney(t.volume, true)} /><Kpi label="Net income" value={fmtMoney(t.net, true)} sub={`GCI ${fmtMoney(t.gci, true)}`} />
        <Kpi label="Average sale price" value={fmtMoney(t.avgPrice, true)} /><Kpi label="Average commission" value={fmtMoney(t.avgCommission, true)} sub={`net ${fmtMoney(t.avgNet, true)}`} /><Kpi label="Avg days to close" value={t.avgDaysToClose == null ? "—" : String(t.avgDaysToClose)} />
        <Kpi label="Listings taken" value={String(t.listingsTaken)} /><Kpi label="Listings sold" value={String(t.listingsSold)} /><Kpi label="Lead conversion" value={`${t.leadConversion}%`} sub="Leads → closings" /><Kpi label="Listing conversion" value={`${t.listingConversion}%`} sub="Seller leads → signed" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2 mb-4">
        <Card title="Monthly sales volume & net income"><Bars data={data.monthly} series={[{ key: "volume", label: "Volume", color: "#18181b" }, { key: "net", label: "Net income", color: "#b8962e" }]} /></Card>
        <Card title="Transactions closed per month"><Bars data={data.monthly} series={[{ key: "buyer", label: "Buyer side", color: "#2f5fbe" }, { key: "seller", label: "Seller side", color: "#b8962e" }]} money={false} /></Card>
      </div>
      <Card title="Lead sources — where the money actually comes from"><Table rows={data.leadSources.map((s) => ({ ...s, id: s.source }))} columns={srcCols} defaultSort={{ key: "net", dir: "desc" }} empty="No lead-source data yet." /></Card>
    </div>
  );
}
