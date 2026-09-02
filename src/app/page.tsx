"use client";

import Link from "next/link";
import { useState } from "react";
import { api, label, telHref, smsHref, toast, useApi } from "@/lib/client";
import { fmtMoney, pct } from "@/lib/calc";
import { fmtDate, fmtTime, relative } from "@/lib/dates";
import { Avatar, Badge, Bars, Card, Donut, Empty, ErrorBox, Kpi, Loading, Progress, PropertyPhoto } from "@/components/ui/primitives";
import { quickAdd } from "@/components/app/shell";
import type { PriorityItem } from "@/lib/priorities";

interface Dash {
  today: string; greeting: string; agent: { name: string };
  kpis: { ytd: { volume: number; count: number; gci: number; net: number; lastYear: { volume: number; count: number; gci: number; net: number } }; pendingVolume: number; pendingGci: number; pendingNet: number; pendingCount: number; activeListingVolume: number; activeListingCount: number; activeListingGci: number; pipeline: { value: number; gci: number } };
  goal: { goal: number; current: number; remaining: number; pct: number; monthlyTarget: number; monthlyAverage: number; projectedYearEnd: number; dealsNeeded: number | null; avgNetPerDeal: number | null; pendingNet: number; pipelineGci: number };
  monthly: { month: string; volume: number; net: number }[];
  priorities: PriorityItem[];
  schedule: { today: Sched[]; tomorrow: Sched[] };
  callList: CallRow[]; callStats: { scheduled: number; completed: number; remaining: number };
  hotBuyers: BuyerRow[]; listings: ListingRow[]; escrows: EscrowRow[];
  matches: { buyerName: string | null; address: string; score: number; kind: string }[];
  alerts: { kind: string; text: string; href: string }[];
  recent: { id: string; summary: string; occurredAt: string; contactName: string | null; type: string }[];
}
interface Sched { id: string; title: string; type: string; startsAt: string; location: string | null; contactName: string | null; address: string | null }
interface CallRow { id: string; contactId: string; contactName: string | null; phone: string | null; email: string | null; clientType: string; priceLabel: string | null; area: string | null; priority: string; reason: string | null; scheduledTime: string | null; status: string; photoUrl: string | null }
interface BuyerRow { id: string; contactId: string; contactName: string | null; temperature: string; priceMin: number | null; priceMax: number | null; targetAreas: string[]; minBeds: number | null; minBaths: number | null; minSqft: number | null; lastContactAt: string | null; nextFollowUpAt: string | null; photoUrl: string | null }
interface ListingRow { id: string; address: string; city: string; listPrice: number; beds: number | null; baths: number | null; sqft: number | null; daysOnMarket: number; status: string; photoUrl: string | null }
interface EscrowRow { id: string; address: string; city: string; purchasePrice: number; closingDate: string | null; daysToClose: number | null; photoUrl: string | null; nextMilestone: { name: string; daysUntil: number } | null }

const delta = (cur: number, prev: number) => (prev > 0 ? { pct: Math.round(((cur - prev) / prev) * 100), label: "vs last year" } : null);

export default function DashboardPage() {
  const { data, loading, error, reload } = useApi<Dash>("/api/dashboard", { refreshMs: 60000 });
  const [order, setOrder] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  if (loading) return <Loading rows={6} />;
  if (error || !data) return <ErrorBox message={error ?? "No data"} onRetry={reload} />;
  const k = data.kpis, g = data.goal;
  const prios = order ? [...data.priorities].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : data.priorities;

  async function completePriority(p: PriorityItem, done: boolean) {
    if (p.taskId) { await api.update("tasks", p.taskId, { completedAt: done ? new Date().toISOString() : null }); toast(done ? "Task completed" : "Reopened"); }
    else if (p.kind === "call") { await api.update("calls", p.id.replace("call-", ""), { status: "completed", completedAt: new Date().toISOString() }); toast("Call logged"); }
    else if (p.kind === "milestone") { await api.update("milestones", p.id.replace("ms-", ""), { completedAt: new Date().toISOString() }); toast("Milestone complete"); }
    else toast("Open the item to work it — this one isn't a checkbox task", "err");
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-end gap-4 flex-wrap">
        <div><h1 className="text-[22px] font-semibold tracking-tight flex items-center gap-2">{data.greeting} <span className="text-gold" aria-hidden="true">☼</span></h1><div className="text-[13px] text-ink-3">{fmtDate(data.today, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div></div>
      </div>

      {/* Row 1 — KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Kpi label="YTD Sales Volume" value={fmtMoney(k.ytd.volume)} delta={delta(k.ytd.volume, k.ytd.lastYear.volume)} spark={data.monthly.map((m) => m.volume)} />
        <Kpi label="YTD Closed Transactions" value={String(k.ytd.count)} delta={delta(k.ytd.count, k.ytd.lastYear.count)} spark={data.monthly.map((m) => m.net)} />
        <Kpi label="YTD GCI / Net Income" value={fmtMoney(k.ytd.net)} sub={<span>GCI {fmtMoney(k.ytd.gci)}</span>} delta={delta(k.ytd.net, k.ytd.lastYear.net)} spark={data.monthly.map((m) => m.net)} />
        <div className="card px-5 py-4 col-span-2 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap"><div className="kicker">Annual Income Goal</div><div className="ml-auto text-[18px] font-semibold tnum">{g.pct}%</div></div>
          <div className="mt-1.5 text-[22px] font-semibold tracking-tight tnum leading-none">{fmtMoney(g.current)} <span className="text-ink-3 font-normal">/ {fmtMoney(g.goal)}</span></div>
          <Progress pct={g.pct} className="mt-3" />
          <div className="grid grid-cols-3 gap-2 mt-3 text-[12px]"><div><div className="text-ink-3">Remaining</div><div className="font-medium tnum">{fmtMoney(g.remaining)}</div></div><div><div className="text-ink-3">Monthly required</div><div className="font-medium tnum">{fmtMoney(g.monthlyTarget)}</div></div><div><div className="text-ink-3">Projected year-end</div><div className="font-medium tnum">{fmtMoney(g.projectedYearEnd)}</div></div></div>
        </div>
        <Kpi label="Pending Volume" value={fmtMoney(k.pendingVolume)} sub={<Link href="/transactions" className="link text-info">{k.pendingCount} transaction{k.pendingCount === 1 ? "" : "s"} · {fmtMoney(k.pendingNet)} net pending</Link>} />
        <Kpi label="Active Listing Volume" value={fmtMoney(k.activeListingVolume)} sub={<Link href="/listings" className="link text-info">{k.activeListingCount} listing{k.activeListingCount === 1 ? "" : "s"}</Link>} />
        <Kpi label="Pipeline Value" value={fmtMoney(k.pipeline.value)} sub={<span className="text-ok">Est. GCI {fmtMoney(k.pipeline.gci)}</span>} />
      </div>

      {/* Row 2 — priorities · schedule · calls */}
      <div className="grid gap-4 xl:grid-cols-[1.25fr_0.8fr_1.4fr]">
        <Card title={<h2 className="card-title flex items-center gap-2">Today’s Priorities <span className="pill bg-crit text-white normal-case tracking-normal">{prios.length}</span></h2>} action={<Link href="/tasks" className="card-link">View all tasks →</Link>}>
          {prios.length === 0 && <Empty title="Nothing urgent" body="No overdue tasks, deadlines or neglected hot buyers. Enjoy it — or add a task." action={<button className="btn btn-sm" onClick={() => quickAdd("tasks")}>+ Task</button>} />}
          <ul className="divide-y divide-line-2">
            {prios.map((p) => (
              <li key={p.id} draggable onDragStart={() => setDrag(p.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => { if (!drag || drag === p.id) return; const ids = prios.map((x) => x.id); const from = ids.indexOf(drag), to = ids.indexOf(p.id); ids.splice(from, 1); ids.splice(to, 0, drag); setOrder(ids); setDrag(null); }} className={`flex items-center gap-3 py-2.5 ${drag === p.id ? "dragging" : ""}`}>
                <button className="check" aria-label={`Complete ${p.title}`} onClick={() => completePriority(p, true)} />
                <div className="flex-1 min-w-0">
                  <Link href={p.href} className="text-[13.5px] font-medium hover:underline truncate block">{p.title}</Link>
                  {p.subtitle && <div className="text-[12px] text-ink-3 truncate">{p.subtitle}</div>}
                </div>
                <Badge tone={p.priority}>{p.priority}</Badge>
                <span className="text-[12px] text-ink-3 w-16 text-right tnum">{p.dueTime ? fmtTime(p.dueTime) : p.dueDate ? fmtDate(p.dueDate) : ""}</span>
                <span className="text-ink-3 cursor-grab select-none" aria-hidden="true">⋮⋮</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Today’s Schedule" action={<Link href="/calendar" className="card-link">View calendar →</Link>}>
          {data.schedule.today.length === 0 && <Empty title="No appointments today" action={<button className="btn btn-sm" onClick={() => quickAdd("appointments")}>+ Appointment</button>} />}
          <ul className="divide-y divide-line-2">{data.schedule.today.map((a) => <li key={a.id} className="flex gap-3 py-3"><div className="w-16 shrink-0 text-[13px] font-semibold tnum">{fmtTime(a.startsAt)}</div><div className="min-w-0"><div className="text-[13.5px] font-medium truncate">{a.title}</div><div className="text-[12px] text-ink-3 truncate">{[a.contactName, a.location ?? a.address].filter(Boolean).join(" · ")}</div></div></li>)}</ul>
          {data.schedule.tomorrow.length > 0 && <><div className="kicker mt-4 mb-1">Tomorrow</div><ul className="divide-y divide-line-2">{data.schedule.tomorrow.map((a) => <li key={a.id} className="flex gap-3 py-2"><div className="w-16 shrink-0 text-[12.5px] text-ink-3 tnum">{fmtTime(a.startsAt)}</div><div className="text-[12.5px] truncate">{a.title}</div></li>)}</ul></>}
        </Card>

        <Card title="Call List" action={<span className="ml-auto text-[12px] text-ink-3 tnum">{data.callStats.scheduled} Scheduled · {data.callStats.completed} Completed · {data.callStats.remaining} Remaining</span>}>
          {data.callList.length === 0 && <Empty title="No calls scheduled today" action={<button className="btn btn-sm" onClick={() => quickAdd("calls")}>+ Call</button>} />}
          <ul className="divide-y divide-line-2">
            {data.callList.filter((c) => c.status !== "completed").slice(0, 6).map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={c.contactName} src={c.photoUrl} size={34} />
                <div className="min-w-0 flex-1"><Link href={`/contacts/${c.contactId}`} className="text-[13.5px] font-medium hover:underline truncate block">{c.contactName}</Link><div className="text-[12px] text-ink-3 truncate">{c.clientType}{c.priceLabel ? ` · ${c.priceLabel}` : ""}</div></div>
                <div className="w-[112px] shrink-0 hidden lg:block"><div className="text-[12.5px] tnum whitespace-nowrap">{c.phone ?? "—"}</div><div className="text-[12px] text-ink-3 truncate">{c.area ?? ""}</div></div>
                <div className="w-[68px] shrink-0 text-right"><Badge tone={c.priority}>{c.priority}</Badge><div className="text-[11.5px] text-ink-3 mt-0.5 tnum">{fmtTime(c.scheduledTime) || "—"}</div></div>
                <div className="flex items-center gap-1">
                  <a className="btn btn-ghost btn-icon" href={telHref(c.phone)} aria-label="Call" title="Call">☎</a>
                  <a className="btn btn-ghost btn-icon" href={smsHref(c.phone)} aria-label="Text" title="Text">✉</a>
                  <a className="btn btn-ghost btn-icon" href={c.email ? `mailto:${c.email}` : undefined} aria-label="Email" title="Email">@</a>
                  <button className="btn btn-ghost btn-icon" aria-label="Complete" title="Mark complete" onClick={async () => { await api.update("calls", c.id, { status: "completed", completedAt: new Date().toISOString() }); toast("Call logged"); }}>✓</button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center mt-2"><Link href="/calls" className="card-link ml-0">View full call list →</Link><Link href="/calls?dialer=1" className="btn btn-sm ml-auto">▷ Start Power Dialer</Link></div>
        </Card>
      </div>

      {/* Row 3 — hot buyers · active listings · in escrow */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={<h2 className="card-title">Hot Buyers <span className="text-crit" aria-hidden="true">●</span></h2>} action={<Link href="/buyers" className="card-link">View all →</Link>}>
          <div className="grid grid-cols-[1fr_auto_auto] text-[11px] text-ink-3 uppercase tracking-wide pb-1 gap-3"><span /><span>Last contact</span><span>Next follow-up</span></div>
          <ul className="divide-y divide-line-2">
            {data.hotBuyers.slice(0, 4).map((b) => (
              <li key={b.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0"><Avatar name={b.contactName} src={b.photoUrl} size={36} /><div className="min-w-0"><div className="flex items-center gap-1.5"><Link href={`/contacts/${b.contactId}`} className="text-[13.5px] font-medium hover:underline truncate">{b.contactName}</Link>{b.temperature === "hot" && <span className="text-crit text-[11px]" aria-label="hot">●</span>}</div><div className="text-[12px] text-ink-3 truncate">{fmtMoney(b.priceMin, true)} – {fmtMoney(b.priceMax, true)} · {b.targetAreas?.slice(0, 2).join(", ")}</div><div className="text-[12px] text-ink-3 truncate">{[b.minBeds && `${b.minBeds} bd`, b.minBaths && `${b.minBaths} ba`, b.minSqft && `${b.minSqft.toLocaleString()}+ sqft`].filter(Boolean).join(" · ")}</div></div></div>
                <div className="text-[12.5px] tnum">{fmtDate(b.lastContactAt)}</div>
                <div className="text-[12.5px] tnum">{fmtDate(b.nextFollowUpAt)}</div>
              </li>
            ))}
          </ul>
          {data.hotBuyers.length === 0 && <Empty title="No active buyers" action={<button className="btn btn-sm" onClick={() => quickAdd("buyers")}>+ Buyer</button>} />}
        </Card>
        <Card title="Active Listings" action={<Link href="/listings" className="card-link">View all →</Link>}>
          <ul className="divide-y divide-line-2">
            {data.listings.slice(0, 3).map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5"><PropertyPhoto src={l.photoUrl} address={l.address} size="sm" /><div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium truncate">{l.address}</div><div className="text-[12px] text-ink-3 truncate">{l.city}</div></div><div className="text-right"><div className="text-[13.5px] font-semibold tnum">{fmtMoney(l.listPrice)}</div><div className="text-[11.5px] text-ink-3 tnum">{l.beds} bd · {l.baths} ba · {l.sqft?.toLocaleString()} sqft</div><div className="text-[11.5px] text-ink-3">{l.daysOnMarket < 0 ? `Launches in ${-l.daysOnMarket}d` : `${l.daysOnMarket} Days on Market`}</div></div></li>
            ))}
          </ul>
          {data.listings.length === 0 && <Empty title="No active listings" action={<button className="btn btn-sm" onClick={() => quickAdd("listings")}>+ Listing</button>} />}
        </Card>
        <Card title="In Escrow" action={<Link href="/transactions" className="card-link">View all →</Link>}>
          <ul className="divide-y divide-line-2">
            {data.escrows.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5"><PropertyPhoto src={e.photoUrl} address={e.address} size="sm" /><div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium truncate">{e.address}</div><div className="text-[12px] text-ink-3 truncate">{e.city}</div></div><div className="text-right"><div className="text-[13.5px] font-semibold tnum">{fmtMoney(e.purchasePrice)}</div><div className="text-[11.5px] text-ink-3">Close: {fmtDate(e.closingDate, { month: "short", day: "numeric", year: "numeric" })}</div></div><div className="text-right w-14"><div className={`text-[20px] font-semibold tnum leading-none ${e.daysToClose != null && e.daysToClose <= 7 ? "text-crit" : "text-ok"}`}>{e.daysToClose ?? "—"}</div><div className="text-[10.5px] text-ink-3">Days to Close</div></div></li>
            ))}
          </ul>
          {data.escrows.length === 0 && <Empty title="Nothing in escrow" />}
        </Card>
      </div>

      {/* Row 4 — chart · goal · alerts · activity */}
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr_1fr_0.9fr]">
        <Card title="YTD Sales Performance" action={<span className="card-link">This Year</span>}>
          <Bars data={data.monthly} series={[{ key: "volume", label: "Sales Volume", color: "#18181b" }, { key: "net", label: "Net Income", color: "#b8962e" }]} />
        </Card>
        <Card title="Income Goal Tracker">
          <div className="flex gap-5 items-center">
            <Donut pct={g.pct} label="of your goal" />
            <dl className="text-[12.5px] flex-1 space-y-1.5">
              {[["Current Net Income", fmtMoney(g.current)], ["Remaining to Goal", fmtMoney(g.remaining)], ["Monthly Target", fmtMoney(g.monthlyTarget)], ["Monthly Average", fmtMoney(g.monthlyAverage)], ["Projected Year-End", fmtMoney(g.projectedYearEnd)], ["Pending in Escrow", fmtMoney(g.pendingNet)], ["Deals Needed to Hit Goal", g.dealsNeeded == null ? "—" : String(g.dealsNeeded)]].map(([l, v]) => <div key={l} className="flex justify-between gap-3"><dt className="text-ink-3">{l}</dt><dd className="font-medium tnum">{v}</dd></div>)}
            </dl>
          </div>
        </Card>
        <Card title="Smart Alerts" action={<Link href="/followups" className="card-link">View all alerts →</Link>}>
          <ul className="space-y-2.5">{data.alerts.slice(0, 7).map((a, i) => <li key={i} className="flex items-start gap-2.5 text-[12.5px]"><span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${a.kind === "critical" ? "bg-crit" : a.kind === "warn" ? "bg-warn" : a.kind === "ok" ? "bg-ok" : "bg-info"}`} /><Link href={a.href} className="hover:underline">{a.text}</Link></li>)}</ul>
        </Card>
        <Card title="Recent Activity">
          <ul className="space-y-2.5">{data.recent.slice(0, 7).map((r) => <li key={r.id} className="flex gap-3 text-[12.5px]"><span className="flex-1 min-w-0 truncate">{r.summary}</span><span className="text-ink-3 shrink-0 tnum">{relative(r.occurredAt)}</span></li>)}</ul>
        </Card>
      </div>

      {data.matches.length > 0 && (
        <Card title="Buyer Matches" action={<Link href="/buyers?tab=matches" className="card-link">Run Buyer Match →</Link>}>
          <div className="flex gap-2 flex-wrap">{data.matches.slice(0, 6).map((m, i) => <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 h-8 text-[12.5px]"><span className="font-semibold tnum text-gold-ink">{m.score}</span>{m.buyerName} ↔ {m.address}<Badge tone={m.kind === "listing" ? "active" : "gold"}>{label(m.kind)}</Badge></span>)}</div>
          <div className="text-[11.5px] text-ink-3 mt-2">Matched on price, area, size and stated must-haves. Volume in escrow is {pct(k.pendingVolume, k.pendingVolume + k.activeListingVolume)}% of tracked inventory.</div>
        </Card>
      )}
    </div>
  );
}
