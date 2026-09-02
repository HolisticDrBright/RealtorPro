"use client";

import { useMemo, useState } from "react";
import { label, useApi } from "@/lib/client";
import { addDays, fmtDate, fmtTime, ymd } from "@/lib/dates";
import { Badge, Card, Loading, PageHeader, Segmented } from "@/components/ui/primitives";
import { useCrud } from "@/components/app/crud";

interface Ev { id: string; source: "appointment" | "milestone" | "task"; type: string; title: string; startsAt: string; endsAt: string | null; location: string | null; contactName: string | null; address: string | null; refId: string; done?: boolean }
const TONE: Record<string, string> = { showing: "info", listing_appointment: "gold", buyer_consultation: "info", open_house: "gold", inspection: "warn", appraisal: "warn", final_walkthrough: "warn", closing: "ok", client_follow_up: "neutral", personal: "neutral", deadline: "critical" };

export default function CalendarPage() {
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const crud = useCrud("appointments");
  const range = useMemo(() => {
    if (view === "day") return { from: ymd(anchor), to: ymd(anchor) };
    if (view === "week") { const start = addDays(anchor, -((anchor.getDay() + 6) % 7)); return { from: ymd(start), to: ymd(addDays(start, 6)) }; }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1); const gridStart = addDays(first, -((first.getDay() + 6) % 7));
    return { from: ymd(gridStart), to: ymd(addDays(gridStart, 41)) };
  }, [view, anchor]);
  const { data, loading } = useApi<{ events: Ev[] }>(`/api/calendar?from=${range.from}&to=${range.to}`);
  const events = data?.events ?? [];
  const byDay = (d: string) => events.filter((e) => e.startsAt.startsWith(d));
  const days = useMemo(() => { const out: string[] = []; let d = new Date(range.from + "T12:00:00"); while (ymd(d) <= range.to) { out.push(ymd(d)); d = addDays(d, 1); } return out; }, [range]);
  const step = (n: number) => setAnchor((a) => (view === "day" ? addDays(a, n) : view === "week" ? addDays(a, 7 * n) : new Date(a.getFullYear(), a.getMonth() + n, 1)));
  const title = view === "month" ? anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" }) : view === "week" ? `${fmtDate(range.from)} – ${fmtDate(range.to, { month: "short", day: "numeric", year: "numeric" })}` : fmtDate(range.from, { weekday: "long", month: "long", day: "numeric" });
  const today = ymd();

  const Item = ({ e, compact }: { e: Ev; compact?: boolean }) => (
    <button className={`w-full text-left rounded-md px-1.5 py-1 text-[11.5px] leading-tight border-l-2 ${e.source === "milestone" ? "bg-crit-soft border-crit" : e.source === "task" ? "bg-zinc-100 border-zinc-400" : "bg-info-soft border-info"} ${e.done ? "opacity-50 line-through" : ""}`} onClick={() => e.source === "appointment" && crud.openEdit({ id: e.refId, title: e.title, type: e.type, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location })} title={`${e.title}${e.location ? ` · ${e.location}` : ""}`}>
      {e.startsAt.length > 10 && <span className="font-semibold tnum">{fmtTime(e.startsAt)} </span>}<span className={compact ? "truncate block" : ""}>{e.title}</span>{!compact && (e.contactName || e.location) && <div className="text-ink-3">{[e.contactName, e.location].filter(Boolean).join(" · ")}</div>}
    </button>
  );

  return (
    <div className="fade-in">
      <PageHeader title="Calendar" sub={title}>
        <div className="inline-flex gap-1"><button className="btn btn-sm" onClick={() => step(-1)} aria-label="Previous">←</button><button className="btn btn-sm" onClick={() => setAnchor(new Date())}>Today</button><button className="btn btn-sm" onClick={() => step(1)} aria-label="Next">→</button></div>
        <Segmented value={view} onChange={setView} options={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }]} />
        <button className="btn btn-primary" onClick={() => crud.openNew({ startsAt: `${ymd(anchor)}T10:00` })}>+ Appointment</button>
      </PageHeader>
      <div className="flex gap-2 flex-wrap mb-3 text-[11.5px] text-ink-3"><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-info-soft border-l-2 border-info" /> Appointments</span><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-crit-soft border-l-2 border-crit" /> Escrow deadlines</span><span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-zinc-100 border-l-2 border-zinc-400" /> Dated tasks</span></div>
      {loading && <Loading />}
      {view === "month" && (
        <Card bodyClass="!p-0">
          <div className="grid grid-cols-7 border-b border-line">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="th !border-0 text-center">{d}</div>)}</div>
          <div className="grid grid-cols-7">{days.map((d) => { const inMonth = Number(d.slice(5, 7)) === anchor.getMonth() + 1; const list = byDay(d); return <div key={d} className={`min-h-[104px] border-b border-r border-line-2 p-1.5 ${inMonth ? "" : "bg-ground/60 text-ink-3"}`}><div className={`text-[11.5px] tnum mb-1 ${d === today ? "inline-grid place-items-center w-5 h-5 rounded-full bg-ink text-white" : ""}`}>{Number(d.slice(8))}</div><div className="space-y-0.5">{list.slice(0, 3).map((e) => <Item key={e.id} e={e} compact />)}{list.length > 3 && <div className="text-[11px] text-ink-3">+{list.length - 3} more</div>}</div></div>; })}</div>
        </Card>
      )}
      {view === "week" && (
        <div className="grid grid-cols-7 gap-2">{days.map((d) => { const list = byDay(d); return <Card key={d} bodyClass="!px-2 !pb-2" title={<div className={`text-[12px] font-semibold ${d === today ? "text-gold-ink" : ""}`}>{fmtDate(d, { weekday: "short", day: "numeric" })}</div>}><div className="space-y-1 min-h-[220px]">{list.map((e) => <Item key={e.id} e={e} />)}{list.length === 0 && <div className="text-[11.5px] text-ink-3 px-1">—</div>}</div></Card>; })}</div>
      )}
      {view === "day" && (
        <Card>
          {byDay(range.from).length === 0 && <div className="text-[13px] text-ink-3 py-4">Nothing scheduled.</div>}
          <ul className="divide-y divide-line-2">{byDay(range.from).map((e) => <li key={e.id} className="flex gap-4 py-3"><div className="w-20 shrink-0 text-[13px] font-semibold tnum">{e.startsAt.length > 10 ? fmtTime(e.startsAt) : "All day"}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-[14px] font-medium">{e.title}</span><Badge tone={TONE[e.type] ?? "neutral"}>{label(e.type)}</Badge>{e.source !== "appointment" && <Badge tone="neutral">{e.source}</Badge>}</div><div className="text-[12.5px] text-ink-3">{[e.contactName, e.location ?? e.address, e.endsAt ? `until ${fmtTime(e.endsAt)}` : null].filter(Boolean).join(" · ")}</div></div>{e.source === "appointment" && <button className="btn btn-sm" onClick={() => crud.openEdit({ id: e.refId, title: e.title, type: e.type, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location })}>Edit</button>}</li>)}</ul>
        </Card>
      )}
      {crud.panel}
    </div>
  );
}
