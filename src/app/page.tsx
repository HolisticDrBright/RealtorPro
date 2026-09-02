"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

/* ---------- Rearrangeable layout: order is saved per browser, new blocks append, unknown ids drop. ---------- */
const KPI_ORDER = ["kpi-volume", "kpi-count", "kpi-net", "kpi-pipeline", "goal", "kpi-pending", "kpi-active"];
const CARD_ORDER = ["priorities", "schedule", "calls", "hotBuyers", "listings", "escrows", "chart", "goalTracker", "alerts", "recent", "matches"];

function useLayoutOrder(key: string, defaults: string[]) {
  const [ids, setIds] = useState(defaults);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
      if (Array.isArray(saved)) setIds([...saved.filter((id) => typeof id === "string" && defaults.includes(id)), ...defaults.filter((id) => !saved.includes(id))]);
    } catch { /* no saved layout */ }
  }, [key, defaults]);
  const move = useCallback((from: string, to: string) => setIds((prev) => {
    const i = prev.indexOf(from), j = prev.indexOf(to);
    if (i < 0 || j < 0 || i === j) return prev;
    const next = [...prev]; next.splice(i, 1); next.splice(j, 0, from);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
    return next;
  }), [key]);
  const reset = useCallback(() => { try { localStorage.removeItem(key); } catch { /* ignore */ } setIds(defaults); }, [key, defaults]);
  return { ids, move, reset, custom: ids.join() !== defaults.join() };
}

interface DragState { group: string; ids: string[]; drag: string | null; over: string | null; setDrag: (v: string | null) => void; setOver: (v: string | null) => void; onMove: (from: string, to: string) => void }

const LABELS: Record<string, string> = { "kpi-volume": "YTD Sales Volume", "kpi-count": "YTD Closed Transactions", "kpi-net": "YTD GCI / Net Income", "kpi-pipeline": "Pipeline Value", goal: "Annual Income Goal", "kpi-pending": "Pending Volume", "kpi-active": "Active Listing Volume", priorities: "Today’s Priorities", schedule: "Today’s Schedule", calls: "Call List", hotBuyers: "Hot Buyers", listings: "Active Listings", escrows: "In Escrow", chart: "YTD Sales Performance", goalTracker: "Income Goal Tracker", alerts: "Smart Alerts", recent: "Recent Activity", matches: "Buyer Matches" };

/**
 * A grid cell the user can pick up by its ⋮⋮ handle and drop onto another
 * cell. Uses pointer events, so it works with a mouse, a trackpad and a finger
 * on a phone or tablet. Only the handle starts a move, so lists inside keep
 * their own behaviour and text stays selectable. Arrow keys on the handle
 * move the box one step at a time.
 */
function Sortable({ id, className = "", state, children }: { id: string; className?: string; state: DragState; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const isTarget = state.over === id && !!state.drag && state.drag !== id;
  const selector = `[data-sortable][data-group="${state.group}"]`;
  const under = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>(selector)?.dataset.sortable ?? null;

  function begin(e: React.PointerEvent<HTMLSpanElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    const el = ref.current; if (!el) return;
    const startX = e.clientX, startY = e.clientY;
    let lifted = false;
    state.setDrag(id);
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!lifted && Math.hypot(dx, dy) > 4) { lifted = true; el.classList.add("lifted"); }
      if (lifted) el.style.transform = `translate(${dx}px, ${dy}px)`;
      const o = under(ev.clientX, ev.clientY);
      state.setOver(o && o !== id ? o : null);
      // Nudge the page when dragging near the top or bottom edge (long pages, phones).
      if (ev.clientY < 70) window.scrollBy(0, -10); else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 10);
    };
    const finish = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", finish); window.removeEventListener("pointercancel", finish);
      el.classList.remove("lifted"); el.style.transform = "";
      const o = ev.type === "pointerup" ? under(ev.clientX, ev.clientY) : null;
      if (o && o !== id) state.onMove(id, o);
      state.setDrag(null); state.setOver(null);
    };
    window.addEventListener("pointermove", onMove); window.addEventListener("pointerup", finish); window.addEventListener("pointercancel", finish);
  }
  function keys(e: React.KeyboardEvent<HTMLSpanElement>) {
    const i = state.ids.indexOf(id);
    if (["ArrowLeft", "ArrowUp"].includes(e.key) && i > 0) { e.preventDefault(); state.onMove(id, state.ids[i - 1]); }
    if (["ArrowRight", "ArrowDown"].includes(e.key) && i >= 0 && i < state.ids.length - 1) { e.preventDefault(); state.onMove(id, state.ids[i + 1]); }
  }
  return (
    <div ref={ref} data-sortable={id} data-group={state.group} className={`sortable ${className} ${state.drag === id ? "dragging" : ""} ${isTarget ? "drop-target" : ""}`}>
      <span className="drag-handle" role="button" tabIndex={0} title="Drag to move this box (arrow keys also work)" aria-label={`Move ${LABELS[id] ?? id}`} onPointerDown={begin} onKeyDown={keys}>⋮⋮</span>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { data, loading, error, reload } = useApi<Dash>("/api/dashboard", { refreshMs: 60000 });
  const [order, setOrder] = useState<string[] | null>(null);
  const [pdrag, setPdrag] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const kpiLayout = useLayoutOrder("cc.dashboard.kpis", KPI_ORDER);
  const cardLayout = useLayoutOrder("cc.dashboard.cards", CARD_ORDER);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const kpiDrag: DragState = { group: "kpis", ids: kpiLayout.ids, drag, over, setDrag, setOver, onMove: kpiLayout.move };
  const cardDrag: DragState = { group: "cards", ids: cardLayout.ids, drag, over, setDrag, setOver, onMove: cardLayout.move };
  if (loading) return <Loading rows={6} />;
  if (error || !data) return <ErrorBox message={error ?? "No data"} onRetry={reload} />;
  const k = data.kpis, g = data.goal;
  const prios = order ? [...data.priorities].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)) : data.priorities;
  const customLayout = kpiLayout.custom || cardLayout.custom;

  async function completePriority(p: PriorityItem, done: boolean) {
    if (p.taskId) { await api.update("tasks", p.taskId, { completedAt: done ? new Date().toISOString() : null }); toast(done ? "Task completed" : "Reopened"); }
    else if (p.kind === "call") { await api.update("calls", p.id.replace("call-", ""), { status: "completed", completedAt: new Date().toISOString() }); toast("Call logged"); }
    else if (p.kind === "milestone") { await api.update("milestones", p.id.replace("ms-", ""), { completedAt: new Date().toISOString() }); toast("Milestone complete"); }
    else if (p.kind === "vault") window.open(p.href, "_self");
    else toast("Open the item to work it — this one isn't a checkbox task", "err");
  }
  async function askClaude() {
    setBriefBusy(true);
    const r = await api.post<{ text: string | null; configured: boolean }>("/api/claude/briefing");
    setBriefBusy(false);
    if (!r.ok) { toast(r.message ?? "Claude failed", "err"); return; }
    if (!r.data.configured) { toast("Add ANTHROPIC_API_KEY in .env to let Claude write the briefing (see Integrations)", "err"); return; }
    setBriefing(r.data.text);
  }

  // KPI strip — small tiles; the goal tile is double width. Users can reorder within the strip.
  const kpis: Record<string, { cls?: string; node: ReactNode }> = {
    "kpi-volume": { node: <Kpi label="YTD Sales Volume" value={fmtMoney(k.ytd.volume)} delta={delta(k.ytd.volume, k.ytd.lastYear.volume)} spark={data.monthly.map((m) => m.volume)} /> },
    "kpi-count": { node: <Kpi label="YTD Closed Transactions" value={String(k.ytd.count)} delta={delta(k.ytd.count, k.ytd.lastYear.count)} spark={data.monthly.map((m) => m.net)} /> },
    "kpi-net": { node: <Kpi label="YTD GCI / Net Income" value={fmtMoney(k.ytd.net)} sub={<span>GCI {fmtMoney(k.ytd.gci)}</span>} delta={delta(k.ytd.net, k.ytd.lastYear.net)} spark={data.monthly.map((m) => m.net)} /> },
    "kpi-pipeline": { node: <Kpi label="Pipeline Value" value={fmtMoney(k.pipeline.value)} sub={<span className="text-ok">Est. GCI {fmtMoney(k.pipeline.gci)}</span>} /> },
    goal: {
      cls: "col-span-2",
      node: (
        <div className="card px-5 py-4 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap"><div className="kicker">Annual Income Goal</div><div className="ml-auto text-[18px] font-semibold tnum">{g.pct}%</div></div>
          <div className="mt-1.5 text-[22px] font-semibold tracking-tight tnum leading-none">{fmtMoney(g.current)} <span className="text-ink-3 font-normal">/ {fmtMoney(g.goal)}</span></div>
          <Progress pct={g.pct} className="mt-3" />
          <div className="grid grid-cols-3 gap-2 mt-3 text-[12px]"><div><div className="text-ink-3">Remaining</div><div className="font-medium tnum">{fmtMoney(g.remaining)}</div></div><div><div className="text-ink-3">Monthly required</div><div className="font-medium tnum">{fmtMoney(g.monthlyTarget)}</div></div><div><div className="text-ink-3">Projected year-end</div><div className="font-medium tnum">{fmtMoney(g.projectedYearEnd)}</div></div></div>
        </div>
      ),
    },
    "kpi-pending": { node: <Kpi label="Pending Volume" value={fmtMoney(k.pendingVolume)} sub={<Link href="/transactions" className="link text-info">{k.pendingCount} transaction{k.pendingCount === 1 ? "" : "s"} · {fmtMoney(k.pendingNet)} net pending</Link>} /> },
    "kpi-active": { node: <Kpi label="Active Listing Volume" value={fmtMoney(k.activeListingVolume)} sub={<Link href="/listings" className="link text-info">{k.activeListingCount} listing{k.activeListingCount === 1 ? "" : "s"}</Link>} /> },
  };

  // Cards — one flowing grid (6 columns at laptop width, 12 at desktop); each card declares how many it spans.
  const cards: Record<string, { cls: string; node: ReactNode } | null> = {
    priorities: {
      cls: "lg:col-span-3 2xl:col-span-4",
      node: (
        <Card title={<h2 className="card-title flex items-center gap-2">Today’s Priorities <span className="pill bg-crit text-white normal-case tracking-normal">{prios.length}</span></h2>} action={<span className="ml-auto flex items-center gap-3"><button className="card-link !ml-0 text-gold-ink" onClick={askClaude} disabled={briefBusy}>{briefBusy ? "Claude is writing…" : briefing ? "Refresh Claude briefing" : "✦ Ask Claude for a game plan"}</button><Link href="/tasks" className="card-link !ml-0">View all tasks →</Link></span>}>
          {briefing && <div className="mb-3 rounded-lg bg-gold-soft/70 p-3 text-[13px] whitespace-pre-wrap leading-relaxed"><div className="kicker text-gold-ink mb-1">Claude’s game plan</div>{briefing}</div>}
          {prios.length === 0 && <Empty title="Nothing urgent" body="No overdue tasks, deadlines or neglected hot buyers. Enjoy it — or add a task." action={<button className="btn btn-sm" onClick={() => quickAdd("tasks")}>+ Task</button>} />}
          <ul className="divide-y divide-line-2">
            {prios.map((p) => (
              <li key={p.id} draggable onDragStart={(e) => { e.stopPropagation(); setPdrag(p.id); }} onDragOver={(e) => { if (pdrag) e.preventDefault(); }} onDrop={(e) => { if (!pdrag) return; e.stopPropagation(); if (pdrag === p.id) return; const ids = prios.map((x) => x.id); const from = ids.indexOf(pdrag), to = ids.indexOf(p.id); ids.splice(from, 1); ids.splice(to, 0, pdrag); setOrder(ids); setPdrag(null); }} onDragEnd={() => setPdrag(null)} className={`flex items-center gap-3 py-2.5 ${pdrag === p.id ? "dragging" : ""}`}>
                <button className="check" aria-label={`Complete ${p.title}`} onClick={() => completePriority(p, true)} />
                <div className="flex-1 min-w-0">
                  {p.kind === "vault" ? <a href={p.href} className="text-[13.5px] font-medium hover:underline truncate block">{p.title}</a> : <Link href={p.href} className="text-[13.5px] font-medium hover:underline truncate block">{p.title}</Link>}
                  {p.subtitle && <div className="text-[12px] text-ink-3 truncate">{p.subtitle}</div>}
                </div>
                <Badge tone={p.priority}>{p.priority}</Badge>
                <span className="text-[12px] text-ink-3 w-16 text-right tnum">{p.dueTime ? fmtTime(p.dueTime) : p.dueDate ? fmtDate(p.dueDate) : ""}</span>
                <span className="text-ink-3 cursor-grab select-none" aria-hidden="true">⋮⋮</span>
              </li>
            ))}
          </ul>
        </Card>
      ),
    },
    schedule: {
      cls: "lg:col-span-3 2xl:col-span-3",
      node: (
        <Card title="Today’s Schedule" action={<Link href="/calendar" className="card-link">View calendar →</Link>}>
          {data.schedule.today.length === 0 && <Empty title="No appointments today" action={<button className="btn btn-sm" onClick={() => quickAdd("appointments")}>+ Appointment</button>} />}
          <ul className="divide-y divide-line-2">{data.schedule.today.map((a) => <li key={a.id} className="flex gap-3 py-3"><div className="w-16 shrink-0 text-[13px] font-semibold tnum">{fmtTime(a.startsAt)}</div><div className="min-w-0"><div className="text-[13.5px] font-medium truncate">{a.title}</div><div className="text-[12px] text-ink-3 truncate">{[a.contactName, a.location ?? a.address].filter(Boolean).join(" · ")}</div></div></li>)}</ul>
          {data.schedule.tomorrow.length > 0 && <><div className="kicker mt-4 mb-1">Tomorrow</div><ul className="divide-y divide-line-2">{data.schedule.tomorrow.map((a) => <li key={a.id} className="flex gap-3 py-2"><div className="w-16 shrink-0 text-[12.5px] text-ink-3 tnum">{fmtTime(a.startsAt)}</div><div className="text-[12.5px] truncate">{a.title}</div></li>)}</ul></>}
        </Card>
      ),
    },
    calls: {
      cls: "lg:col-span-6 2xl:col-span-5",
      node: (
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
      ),
    },
    hotBuyers: {
      cls: "lg:col-span-3 2xl:col-span-4",
      node: (
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
      ),
    },
    listings: {
      cls: "lg:col-span-3 2xl:col-span-4",
      node: (
        <Card title="Active Listings" action={<Link href="/listings" className="card-link">View all →</Link>}>
          <ul className="divide-y divide-line-2">
            {data.listings.slice(0, 3).map((l) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5"><PropertyPhoto src={l.photoUrl} address={l.address} size="sm" /><div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium truncate">{l.address}</div><div className="text-[12px] text-ink-3 truncate">{l.city}</div></div><div className="text-right"><div className="text-[13.5px] font-semibold tnum">{fmtMoney(l.listPrice)}</div><div className="text-[11.5px] text-ink-3 tnum">{l.beds} bd · {l.baths} ba · {l.sqft?.toLocaleString()} sqft</div><div className="text-[11.5px] text-ink-3">{l.daysOnMarket < 0 ? `Launches in ${-l.daysOnMarket}d` : `${l.daysOnMarket} Days on Market`}</div></div></li>
            ))}
          </ul>
          {data.listings.length === 0 && <Empty title="No active listings" action={<button className="btn btn-sm" onClick={() => quickAdd("listings")}>+ Listing</button>} />}
        </Card>
      ),
    },
    escrows: {
      cls: "lg:col-span-3 2xl:col-span-4",
      node: (
        <Card title="In Escrow" action={<Link href="/transactions" className="card-link">View all →</Link>}>
          <ul className="divide-y divide-line-2">
            {data.escrows.slice(0, 3).map((e) => (
              <li key={e.id} className="flex items-center gap-3 py-2.5"><PropertyPhoto src={e.photoUrl} address={e.address} size="sm" /><div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium truncate">{e.address}</div><div className="text-[12px] text-ink-3 truncate">{e.city}</div></div><div className="text-right"><div className="text-[13.5px] font-semibold tnum">{fmtMoney(e.purchasePrice)}</div><div className="text-[11.5px] text-ink-3">Close: {fmtDate(e.closingDate, { month: "short", day: "numeric", year: "numeric" })}</div></div><div className="text-right w-14"><div className={`text-[20px] font-semibold tnum leading-none ${e.daysToClose != null && e.daysToClose <= 7 ? "text-crit" : "text-ok"}`}>{e.daysToClose ?? "—"}</div><div className="text-[10.5px] text-ink-3">Days to Close</div></div></li>
            ))}
          </ul>
          {data.escrows.length === 0 && <Empty title="Nothing in escrow" />}
        </Card>
      ),
    },
    chart: {
      cls: "lg:col-span-3 2xl:col-span-4",
      node: (
        <Card title="YTD Sales Performance" action={<span className="card-link">This Year</span>}>
          <Bars data={data.monthly} series={[{ key: "volume", label: "Sales Volume", color: "#18181b" }, { key: "net", label: "Net Income", color: "#b8962e" }]} />
        </Card>
      ),
    },
    goalTracker: {
      cls: "lg:col-span-3 2xl:col-span-3",
      node: (
        <Card title="Income Goal Tracker">
          <div className="flex gap-5 items-center">
            <Donut pct={g.pct} label="of your goal" />
            <dl className="text-[12.5px] flex-1 space-y-1.5">
              {[["Current Net Income", fmtMoney(g.current)], ["Remaining to Goal", fmtMoney(g.remaining)], ["Monthly Target", fmtMoney(g.monthlyTarget)], ["Monthly Average", fmtMoney(g.monthlyAverage)], ["Projected Year-End", fmtMoney(g.projectedYearEnd)], ["Pending in Escrow", fmtMoney(g.pendingNet)], ["Deals Needed to Hit Goal", g.dealsNeeded == null ? "—" : String(g.dealsNeeded)]].map(([l, v]) => <div key={l} className="flex justify-between gap-3"><dt className="text-ink-3">{l}</dt><dd className="font-medium tnum">{v}</dd></div>)}
            </dl>
          </div>
        </Card>
      ),
    },
    alerts: {
      cls: "lg:col-span-3 2xl:col-span-3",
      node: (
        <Card title="Smart Alerts" action={<Link href="/followups" className="card-link">View all alerts →</Link>}>
          <ul className="space-y-2.5">{data.alerts.slice(0, 7).map((a, i) => <li key={i} className="flex items-start gap-2.5 text-[12.5px]"><span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${a.kind === "critical" ? "bg-crit" : a.kind === "warn" ? "bg-warn" : a.kind === "ok" ? "bg-ok" : "bg-info"}`} /><Link href={a.href} className="hover:underline">{a.text}</Link></li>)}</ul>
        </Card>
      ),
    },
    recent: {
      cls: "lg:col-span-3 2xl:col-span-2",
      node: (
        <Card title="Recent Activity">
          <ul className="space-y-2.5">{data.recent.slice(0, 7).map((r) => <li key={r.id} className="flex gap-3 text-[12.5px]"><span className="flex-1 min-w-0 truncate">{r.summary}</span><span className="text-ink-3 shrink-0 tnum">{relative(r.occurredAt)}</span></li>)}</ul>
        </Card>
      ),
    },
    matches: data.matches.length === 0 ? null : {
      cls: "lg:col-span-6 2xl:col-span-12",
      node: (
        <Card title="Buyer Matches" action={<Link href="/buyers?tab=matches" className="card-link">Run Buyer Match →</Link>}>
          <div className="flex gap-2 flex-wrap">{data.matches.slice(0, 6).map((m, i) => <span key={i} className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 h-8 text-[12.5px]"><span className="font-semibold tnum text-gold-ink">{m.score}</span>{m.buyerName} ↔ {m.address}<Badge tone={m.kind === "listing" ? "active" : "gold"}>{label(m.kind)}</Badge></span>)}</div>
          <div className="text-[11.5px] text-ink-3 mt-2">Matched on price, area, size and stated must-haves. Volume in escrow is {pct(k.pendingVolume, k.pendingVolume + k.activeListingVolume)}% of tracked inventory.</div>
        </Card>
      ),
    },
  };

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-end gap-4 flex-wrap">
        <div><h1 className="text-[22px] font-semibold tracking-tight flex items-center gap-2">{data.greeting} <span className="text-gold" aria-hidden="true">☼</span></h1><div className="text-[13px] text-ink-3">{fmtDate(data.today, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</div></div>
        <div className="ml-auto text-[12px] text-ink-3 flex items-center gap-3">
          <span className="hidden md:inline">Drag the ⋮⋮ handle on any box to rearrange</span>
          {customLayout && <button className="card-link !ml-0 underline-offset-2 hover:underline" onClick={() => { kpiLayout.reset(); cardLayout.reset(); toast("Layout reset"); }}>Reset layout</button>}
        </div>
      </div>

      {/* Row 1 — KPIs (reorderable within the strip) */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8">
        {kpiLayout.ids.map((id) => kpis[id] && <Sortable key={id} id={id} className={kpis[id].cls ?? ""} state={kpiDrag}>{kpis[id].node}</Sortable>)}
      </div>

      {/* Cards — one flowing grid; drop a card on another to take its place */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-6 2xl:grid-cols-12">
        {cardLayout.ids.map((id) => { const c = cards[id]; return c && <Sortable key={id} id={id} className={c.cls} state={cardDrag}>{c.node}</Sortable>; })}
      </div>
    </div>
  );
}
