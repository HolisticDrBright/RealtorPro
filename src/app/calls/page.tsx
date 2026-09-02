"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, label, smsHref, telHref, toast, useApi, useLookups, useQueryParam } from "@/lib/client";
import { addDays, fmtDate, fmtTime, ymd } from "@/lib/dates";
import { fmtMoney } from "@/lib/calc";
import { Avatar, Badge, Card, Empty, Loading, PageHeader, Segmented, SlideOver } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";

interface Call { id: string; contactId: string; scheduledDate: string | null; scheduledTime: string | null; priority: string; reason: string | null; notes: string | null; status: string; outcome: string | null; completedAt: string | null }
interface Buyer { contactId: string; temperature: string; priceMin: number | null; priceMax: number | null; targetAreas: string[] }

export default function CallsPage() {
  const qd = useQueryParam("dialer");
  const [day, setDay] = useState<"today" | "tomorrow" | "week" | "all">("today");
  const [dialer, setDialer] = useState(false);
  useEffect(() => { if (qd === "1") setDialer(true); }, [qd]);
  const [dialIdx, setDialIdx] = useState(0);
  const [outcome, setOutcome] = useState("");
  const { data, loading } = useApi<{ items: Call[] }>("/api/calls?limit=1000");
  const buyers = useApi<{ items: Buyer[] }>("/api/buyers?limit=1000");
  const lk = useLookups();
  const crud = useCrud("calls");
  const today = ymd();
  const rows = useMemo(() => {
    const all = data?.items ?? [];
    const end = ymd(addDays(new Date(), 7));
    const list = all.filter((c) => day === "all" ? true : day === "today" ? c.scheduledDate === today : day === "tomorrow" ? c.scheduledDate === ymd(addDays(new Date(), 1)) : (c.scheduledDate ?? "") >= today && (c.scheduledDate ?? "") <= end);
    const P: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...list].sort((a, b) => Number(a.status === "completed") - Number(b.status === "completed") || (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "") || P[a.priority] - P[b.priority] || (a.scheduledTime ?? "").localeCompare(b.scheduledTime ?? ""));
  }, [data, day, today]);
  const stats = { scheduled: rows.length, completed: rows.filter((c) => c.status === "completed").length };
  const typeOf = (contactId: string) => { const b = buyers.data?.items.find((x) => x.contactId === contactId); const c = lk.contactOf(contactId); return b ? `${label(b.temperature)} Buyer` : label(c?.type); };
  const queue = rows.filter((c) => c.status !== "completed");
  const current = queue[dialIdx];

  async function complete(c: Call, note?: string) { const r = await api.update("calls", c.id, { status: "completed", completedAt: new Date().toISOString(), outcome: note || undefined }); if (r.ok) toast("Call logged — last contact updated"); }
  async function reschedule(c: Call, days: number) { const r = await api.update("calls", c.id, { status: "rescheduled", scheduledDate: ymd(addDays(new Date(), days)) }); if (r.ok) toast(`Moved to ${fmtDate(ymd(addDays(new Date(), days)))}`); }

  return (
    <div className="fade-in">
      <PageHeader title="Call List" sub={<span className="tnum">{stats.scheduled} Scheduled · {stats.completed} Completed · {stats.scheduled - stats.completed} Remaining</span>}>
        <Segmented value={day} onChange={setDay} options={[{ value: "today", label: "Today" }, { value: "tomorrow", label: "Tomorrow" }, { value: "week", label: "This week" }, { value: "all", label: "All" }]} />
        <button className="btn" onClick={() => { setDialIdx(0); setDialer(true); }} disabled={queue.length === 0}>▷ Power Dialer</button>
        <button className="btn btn-primary" onClick={() => crud.openNew({ scheduledDate: today })}>+ Call</button>
      </PageHeader>
      <Card bodyClass="!px-0">
        {loading && <div className="px-5"><Loading /></div>}
        {!loading && rows.length === 0 && <div className="px-5"><Empty title="No calls on this list" body="Add calls for the people you need to reach, or schedule follow-ups from a contact’s profile." action={<button className="btn btn-sm" onClick={() => crud.openNew({ scheduledDate: today })}>+ Call</button>} /></div>}
        <table className="w-full">
          <thead><tr><th className="th pl-5">Client</th><th className="th">Phone</th><th className="th">Type</th><th className="th">Priority</th><th className="th">Reason</th><th className="th">Last contact</th><th className="th">Next follow-up</th><th className="th">Time</th><th className="th text-right pr-5">Actions</th></tr></thead>
          <tbody>
            {rows.map((c) => { const k = lk.contactOf(c.contactId); const b = buyers.data?.items.find((x) => x.contactId === c.contactId); const done = c.status === "completed"; return (
              <tr key={c.id} className={`row-hover ${done ? "opacity-60" : ""}`}>
                <td className="td pl-5"><div className="flex items-center gap-2.5"><Avatar name={lk.nameOf(c.contactId)} src={k?.photoUrl} size={32} /><div className="min-w-0"><Link href={`/contacts/${c.contactId}`} className="font-medium hover:underline">{lk.nameOf(c.contactId)}</Link><div className="text-[12px] text-ink-3 truncate">{b ? `${fmtMoney(b.priceMin, true)} – ${fmtMoney(b.priceMax, true)} · ${b.targetAreas?.[0] ?? ""}` : (k?.email ?? "")}</div></div></div></td>
                <td className="td tnum"><a className="link" href={telHref(k?.phone)}>{k?.phone ?? "—"}</a></td>
                <td className="td">{typeOf(c.contactId)}</td>
                <td className="td"><Badge tone={c.priority}>{c.priority}</Badge></td>
                <td className="td max-w-[220px]"><div className="truncate">{c.reason ?? "—"}</div>{c.outcome && <div className="text-[12px] text-ok truncate">→ {c.outcome}</div>}</td>
                <td className="td tnum text-ink-2">{fmtDate(k?.lastContactAt)}</td>
                <td className="td tnum text-ink-2">{fmtDate(k?.nextFollowUpAt)}</td>
                <td className="td tnum">{c.scheduledDate !== today ? fmtDate(c.scheduledDate) + " " : ""}{fmtTime(c.scheduledTime)}</td>
                <td className="td text-right pr-5 whitespace-nowrap">
                  <a className="btn btn-ghost btn-icon" href={telHref(k?.phone)} title="Call" aria-label="Call">☎</a>
                  <a className="btn btn-ghost btn-icon" href={smsHref(k?.phone)} title="Text" aria-label="Text">✉</a>
                  <a className="btn btn-ghost btn-icon" href={k?.email ? `mailto:${k.email}` : undefined} title="Email" aria-label="Email">@</a>
                  {!done && <button className="btn btn-ghost btn-icon" title="Complete" aria-label="Complete" onClick={() => complete(c)}>✓</button>}
                  {!done && <button className="btn btn-ghost btn-sm" title="Reschedule to tomorrow" onClick={() => reschedule(c, 1)}>+1d</button>}
                  <RowMenu onEdit={() => crud.openEdit(c as unknown as Record<string, unknown>)} onDelete={() => crud.remove(c.id, "call")} />
                </td>
              </tr>
            ); })}
          </tbody>
        </table>
      </Card>
      {crud.panel}
      <SlideOver open={dialer} onClose={() => setDialer(false)} title={`Power Dialer · ${Math.min(dialIdx + 1, queue.length)} of ${queue.length}`}>
        {!current ? <Empty title="Queue complete" body="Every call on this list is done." /> : (
          <div className="space-y-5">
            <div className="flex items-center gap-4"><Avatar name={lk.nameOf(current.contactId)} src={lk.contactOf(current.contactId)?.photoUrl} size={56} /><div><div className="text-[18px] font-semibold">{lk.nameOf(current.contactId)}</div><div className="text-ink-3">{typeOf(current.contactId)} · <a className="link tnum" href={telHref(lk.contactOf(current.contactId)?.phone)}>{lk.contactOf(current.contactId)?.phone}</a></div></div><Badge tone={current.priority} className="ml-auto">{current.priority}</Badge></div>
            <div className="rounded-lg bg-ground p-4"><div className="kicker mb-1">Reason for call</div><div className="text-[14px]">{current.reason ?? "—"}</div>{current.notes && <div className="text-[13px] text-ink-2 mt-2 whitespace-pre-wrap">{current.notes}</div>}<div className="text-[12px] text-ink-3 mt-3">Last contact {fmtDate(lk.contactOf(current.contactId)?.lastContactAt)} · Profile notes: {lk.contactOf(current.contactId) ? "see profile" : "—"}</div></div>
            <a className="btn btn-primary w-full justify-center h-11 text-[15px]" href={telHref(lk.contactOf(current.contactId)?.phone)}>☎ Call {lk.contactOf(current.contactId)?.phone}</a>
            <div><label className="label" htmlFor="outcome">Outcome / notes</label><textarea id="outcome" className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="Left voicemail · Booked showing Saturday · Wants to see comps…" /></div>
            <div className="flex gap-2 flex-wrap">
              <button className="btn btn-primary" onClick={async () => { await complete(current, outcome); setOutcome(""); }}>✓ Completed, next</button>
              <button className="btn" onClick={async () => { await reschedule(current, 1); setOutcome(""); }}>Tomorrow</button>
              <button className="btn" onClick={async () => { await reschedule(current, 7); setOutcome(""); }}>Next week</button>
              <button className="btn btn-ghost ml-auto" onClick={() => setDialIdx((i) => Math.min(queue.length, i + 1))}>Skip →</button>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
