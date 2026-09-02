"use client";

import Link from "next/link";
import { api, label, telHref, toast, useApi } from "@/lib/client";
import { fmtDate } from "@/lib/dates";
import { Badge, Card, Empty, Loading, PageHeader } from "@/components/ui/primitives";
import { useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

interface Sphere { birthdays: { contactId: string; name: string | null; date: string; days: number }[]; anniversaries: { contactId: string; name: string | null; address: string | null; date: string; days: number; years: number }[]; touchpoints: { id: string; contactId: string; kind: string; dueDate: string; notes: string | null; name: string | null; days: number }[]; neglected: { contactId: string; name: string | null; type: string; phone: string | null; days: number | null }[] }

export default function SpherePage() {
  const { data, loading } = useApi<Sphere>("/api/sphere");
  const crud = useCrud("touchpoints");
  if (loading || !data) return <Loading rows={6} />;
  const when = (d: number) => (d < 0 ? `${-d}d overdue` : d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d}d`);
  return (
    <div className="fade-in">
      <PageHeader title="Stay in Touch" sub="Birthdays · home anniversaries · gifts · holiday outreach · quarterly check-ins · home-value updates · referral asks"><button className="btn btn-primary" onClick={() => crud.openNew()}>+ Touchpoint</button></PageHeader>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Scheduled touchpoints">
          {data.touchpoints.length === 0 && <Empty title="Nothing scheduled" action={<button className="btn btn-sm" onClick={() => crud.openNew()}>+ Touchpoint</button>} />}
          <ul className="divide-y divide-line-2">{data.touchpoints.map((t) => <li key={t.id} className="flex items-center gap-3 py-2.5"><button className="check" aria-label="Done" onClick={async () => { const r = await api.update("touchpoints", t.id, { completedAt: new Date().toISOString() }); if (r.ok) toast("Logged — last contact updated"); }} /><div className="flex-1 min-w-0"><Link href={`/contacts/${t.contactId}`} className="text-[13.5px] font-medium hover:underline">{t.name}</Link><div className="text-[12px] text-ink-3 truncate">{label(t.kind)}{t.notes ? ` · ${t.notes}` : ""}</div></div><span className={`text-[12px] tnum ${t.days < 0 ? "text-crit font-medium" : "text-ink-3"}`}>{fmtDate(t.dueDate)} · {when(t.days)}</span></li>)}</ul>
        </Card>
        <Card title="Clients I haven’t contacted recently" action={<span className="card-link">60+ days · past clients & sphere</span>}>
          {data.neglected.length === 0 && <Empty title="Everyone’s been touched recently" />}
          <ul className="divide-y divide-line-2">{data.neglected.map((c) => <li key={c.contactId} className="flex items-center gap-3 py-2.5"><div className="flex-1 min-w-0"><Link href={`/contacts/${c.contactId}`} className="text-[13.5px] font-medium hover:underline">{c.name}</Link><div className="text-[12px] text-ink-3"><Badge tone={c.type}>{label(c.type)}</Badge> · {c.days == null ? "never contacted" : `${c.days} days since contact`}</div></div><a className="btn btn-sm" href={telHref(c.phone)}>☎ Call</a><button className="btn btn-sm" onClick={() => quickAdd("calls", { contactId: c.contactId, reason: "Check-in", scheduledDate: new Date().toISOString().slice(0, 10) })}>Schedule</button></li>)}</ul>
        </Card>
        <Card title="Upcoming birthdays">
          {data.birthdays.length === 0 && <div className="text-[13px] text-ink-3">None in the next 45 days.</div>}
          <ul className="divide-y divide-line-2">{data.birthdays.map((b) => <li key={b.contactId} className="flex items-center gap-3 py-2.5"><Link href={`/contacts/${b.contactId}`} className="text-[13.5px] font-medium hover:underline flex-1">{b.name}</Link><span className="text-[12.5px] tnum">{fmtDate(b.date, { month: "long", day: "numeric" })}</span><Badge tone={b.days <= 1 ? "critical" : "neutral"}>{when(b.days)}</Badge><button className="btn btn-sm" onClick={() => quickAdd("tasks", { title: `Birthday — ${b.name}`, dueDate: b.date, contactId: b.contactId, category: "client_follow_up" })}>+ Task</button></li>)}</ul>
        </Card>
        <Card title="Home purchase anniversaries">
          {data.anniversaries.length === 0 && <div className="text-[13px] text-ink-3">None in the next 45 days.</div>}
          <ul className="divide-y divide-line-2">{data.anniversaries.map((a) => <li key={a.contactId + a.date} className="flex items-center gap-3 py-2.5"><div className="flex-1 min-w-0"><Link href={`/contacts/${a.contactId}`} className="text-[13.5px] font-medium hover:underline">{a.name}</Link><div className="text-[12px] text-ink-3 truncate">{a.address} · {a.years} year{a.years === 1 ? "" : "s"}</div></div><span className="text-[12.5px] tnum">{fmtDate(a.date)}</span><Badge tone="neutral">{when(a.days)}</Badge><button className="btn btn-sm" onClick={() => crud.openNew({ contactId: a.contactId, kind: "anniversary", dueDate: a.date, notes: `${a.years}-year anniversary — ${a.address}` })}>Plan gift</button></li>)}</ul>
        </Card>
      </div>
      {crud.panel}
    </div>
  );
}
