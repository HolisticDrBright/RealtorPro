"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { api, label, smsHref, telHref, toast, useApi, useLookups } from "@/lib/client";
import { fmtMoney, grossCommission, netIncome } from "@/lib/calc";
import { addDays, daysSince, fmtDate, fmtDateTime, fmtTime, relative, ymd } from "@/lib/dates";
import { Avatar, Badge, Card, Empty, Loading, PageHeader } from "@/components/ui/primitives";
import { useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

interface Contact { id: string; firstName: string; lastName: string; photoUrl: string | null; phone: string | null; email: string | null; spouse: string | null; birthday: string | null; homeAddress: string | null; type: string; leadSource: string | null; tags: string[]; priceMin: number | null; priceMax: number | null; preferredAreas: string[]; currentProperty: string | null; stage: string; estValue: number | null; estCommission: number | null; probability: number; nextAction: string | null; lastContactAt: string | null; nextFollowUpAt: string | null; checkBackAt: string | null; notes: string | null }
interface Activity { id: string; type: string; summary: string; occurredAt: string }
interface Tx { id: string; propertyId: string; side: string; status: string; purchasePrice: number; commissionPct: number; referralFee: number; brokerSplitPct: number; expenses: number; closedAt: string | null; closingDate: string | null }

export default function ContactPage() {
  const { id } = useParams<{ id: string }>();
  const c = useApi<{ item: Contact }>(`/api/contacts/${id}`);
  const acts = useApi<{ items: Activity[] }>(`/api/activities?contactId=${id}&limit=200`);
  const txs = useApi<{ items: Tx[] }>(`/api/transactions?contactId=${id}`);
  const tasks = useApi<{ items: { id: string; title: string; dueDate: string | null; dueTime: string | null; completedAt: string | null; priority: string }[] }>(`/api/tasks?contactId=${id}`);
  const notes = useApi<{ items: { id: string; body: string; createdAt: string; pinned: boolean }[] }>(`/api/notes?contactId=${id}`);
  const appts = useApi<{ items: { id: string; title: string; startsAt: string; type: string }[] }>(`/api/appointments?contactId=${id}`);
  const buyer = useApi<{ items: { id: string; temperature: string; priceMin: number | null; priceMax: number | null; targetAreas: string[]; timeline: string | null }[] }>(`/api/buyers?contactId=${id}`);
  const seller = useApi<{ items: { id: string; stage: string; propertyAddress: string | null; expectedListPrice: number | null }[] }>(`/api/sellers?contactId=${id}`);
  const vault = useApi<{ notes: { id: string; title: string; excerpt: string | null; path: string; uri: string; modifiedAt: string | null }[]; status: { exists: boolean } }>(`/api/obsidian/notes?contactId=${id}`);
  const lk = useLookups();
  const crud = useCrud("contacts");
  const [logType, setLogType] = useState("call");
  const [logText, setLogText] = useState("");
  const k = c.data?.item;
  if (c.loading || !k) return <Loading rows={6} />;
  const name = `${k.firstName} ${k.lastName}`.trim();
  const closed = (txs.data?.items ?? []).filter((t) => t.status === "closed");
  const volume = closed.reduce((a, t) => a + t.purchasePrice, 0);
  const gci = closed.reduce((a, t) => a + grossCommission(t), 0);
  const since = daysSince(k.lastContactAt);

  async function logTouch() {
    if (!logText.trim()) return;
    await api.create("activities", { contactId: id, type: logType, summary: logText.trim(), occurredAt: new Date().toISOString() });
    await api.update("contacts", id, { lastContactAt: new Date().toISOString() });
    setLogText(""); toast("Logged — last contact updated");
  }
  async function scheduleFollowUp(days: number) { const r = await api.update("contacts", id, { nextFollowUpAt: ymd(addDays(new Date(), days)) }); if (r.ok) toast(`Follow-up set for ${fmtDate(ymd(addDays(new Date(), days)))}`); }

  return (
    <div className="fade-in">
      <div className="text-[12.5px] text-ink-3 mb-3"><Link href="/contacts" className="link">Contacts</Link> / {name}</div>
      <PageHeader title={name} sub={<span className="flex items-center gap-2 flex-wrap"><Badge tone={k.type}>{label(k.type)}</Badge><span>Stage: {label(k.stage)}</span><span>· Source: {label(k.leadSource)}</span>{k.tags?.map((t) => <Badge key={t} tone="neutral">{t}</Badge>)}</span>}>
        <a className="btn" href={telHref(k.phone)}>☎ Call</a><a className="btn" href={smsHref(k.phone)}>✉ Text</a><a className="btn" href={k.email ? `mailto:${k.email}` : undefined}>@ Email</a>
        <button className="btn" onClick={() => quickAdd("tasks", { contactId: id })}>+ Task</button>
        <button className="btn" onClick={() => quickAdd("calls", { contactId: id, scheduledDate: ymd() })}>+ Call</button>
        <button className="btn btn-primary" onClick={() => crud.openEdit(k as unknown as Record<string, unknown>)}>Edit</button>
        <button className="btn btn-ghost text-crit" onClick={() => { crud.remove(id, name); }}>Delete</button>
      </PageHeader>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr_340px]">
        <div className="space-y-4">
          <Card>
            <div className="flex items-center gap-4 pt-4"><Avatar name={name} src={k.photoUrl} size={64} /><div className="min-w-0"><div className="text-[16px] font-semibold">{name}</div><div className="text-[13px] text-ink-2 tnum"><a className="link" href={telHref(k.phone)}>{k.phone ?? "—"}</a></div><div className="text-[13px] text-ink-2 truncate">{k.email ? <a className="link" href={`mailto:${k.email}`}>{k.email}</a> : "—"}</div></div></div>
            <dl className="mt-4 text-[13px] space-y-1.5">
              {[["Spouse / partner", k.spouse], ["Birthday", k.birthday ? fmtDate(k.birthday, { month: "long", day: "numeric" }) : null], ["Home address", k.homeAddress], ["Current property", k.currentProperty], ["Price range", k.priceMin || k.priceMax ? `${fmtMoney(k.priceMin)} – ${fmtMoney(k.priceMax)}` : null], ["Preferred areas", k.preferredAreas?.join(", ")], ["Last contact", k.lastContactAt ? `${fmtDate(k.lastContactAt)} (${since}d ago)` : "never"], ["Next follow-up", fmtDate(k.nextFollowUpAt)], ["Check back", fmtDate(k.checkBackAt)], ["Next action", k.nextAction]].map(([kk, v]) => <div key={String(kk)} className="flex justify-between gap-3 border-b border-line-2 py-1.5"><dt className="text-ink-3">{kk}</dt><dd className="font-medium text-right">{v || "—"}</dd></div>)}
            </dl>
            <div className="flex gap-2 mt-3 flex-wrap"><span className="text-[12px] text-ink-3 self-center">Follow up in</span>{[1, 3, 7, 30].map((d) => <button key={d} className="btn btn-sm" onClick={() => scheduleFollowUp(d)}>{d}d</button>)}</div>
          </Card>
          <Card title={`Business with ${k.firstName}`}>
            <div className="grid grid-cols-3 gap-2 text-center"><div><div className="text-[18px] font-semibold tnum">{closed.length}</div><div className="text-[11.5px] text-ink-3">Closings</div></div><div><div className="text-[18px] font-semibold tnum">{fmtMoney(volume, true)}</div><div className="text-[11.5px] text-ink-3">Volume</div></div><div><div className="text-[18px] font-semibold tnum">{fmtMoney(gci, true)}</div><div className="text-[11.5px] text-ink-3">GCI generated</div></div></div>
            {buyer.data?.items[0] && <div className="mt-3 rounded-lg bg-ground p-3 text-[13px]"><div className="flex items-center gap-2"><span className="font-medium">Buyer profile</span><Badge tone={buyer.data.items[0].temperature}>{buyer.data.items[0].temperature}</Badge><Link href="/buyers" className="card-link">Open →</Link></div><div className="text-ink-2 mt-1">{fmtMoney(buyer.data.items[0].priceMin, true)} – {fmtMoney(buyer.data.items[0].priceMax, true)} · {buyer.data.items[0].targetAreas?.join(", ")} · {buyer.data.items[0].timeline}</div></div>}
            {seller.data?.items[0] && <div className="mt-3 rounded-lg bg-ground p-3 text-[13px]"><div className="flex items-center gap-2"><span className="font-medium">Seller profile</span><Badge tone="gold">{label(seller.data.items[0].stage)}</Badge><Link href="/sellers" className="card-link">Open →</Link></div><div className="text-ink-2 mt-1">{seller.data.items[0].propertyAddress} · {fmtMoney(seller.data.items[0].expectedListPrice)}</div></div>}
            {!buyer.data?.items[0] && !seller.data?.items[0] && <div className="flex gap-2 mt-3"><button className="btn btn-sm" onClick={() => quickAdd("buyers", { contactId: id })}>+ Buyer profile</button><button className="btn btn-sm" onClick={() => quickAdd("sellers", { contactId: id })}>+ Seller profile</button></div>}
            {(txs.data?.items ?? []).length > 0 && <ul className="mt-3 divide-y divide-line-2 text-[13px]">{txs.data!.items.map((t) => <li key={t.id} className="flex items-center gap-2 py-1.5"><Badge tone={t.status}>{t.status}</Badge><span className="flex-1 truncate">{lk.addressOf(t.propertyId)}</span><span className="tnum">{fmtMoney(t.purchasePrice, true)}</span><span className="text-ink-3 tnum text-[12px]">net {fmtMoney(netIncome(t), true)}</span></li>)}</ul>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Log a touch">
            <div className="flex gap-2"><select className="input w-32" value={logType} onChange={(e) => setLogType(e.target.value)} aria-label="Type">{["call", "text", "email", "showing", "meeting", "note"].map((t) => <option key={t} value={t}>{label(t)}</option>)}</select><input className="input" placeholder="What happened? (e.g. Left voicemail re: Pelican Hill)" value={logText} onChange={(e) => setLogText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && logTouch()} /><button className="btn btn-primary" onClick={logTouch}>Log</button></div>
          </Card>
          <Card title="Activity timeline">
            {(acts.data?.items ?? []).length === 0 && <Empty title="No activity yet" body="Calls, texts, emails, showings, meetings, offers, transactions and notes appear here." />}
            <ol className="relative border-l border-line ml-2">
              {(acts.data?.items ?? []).map((a) => <li key={a.id} className="ml-4 py-2"><span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-panel border-2 border-zinc-300" /><div className="flex items-center gap-2"><Badge tone={a.type === "transaction" ? "closed" : a.type === "offer" ? "gold" : "neutral"}>{a.type}</Badge><span className="text-[13.5px]">{a.summary}</span><span className="ml-auto text-[11.5px] text-ink-3 tnum shrink-0" title={fmtDateTime(a.occurredAt)}>{relative(a.occurredAt)}</span></div></li>)}
            </ol>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Open tasks" action={<button className="card-link" onClick={() => quickAdd("tasks", { contactId: id })}>+ Task</button>}>
            {(tasks.data?.items ?? []).filter((t) => !t.completedAt).length === 0 && <div className="text-[13px] text-ink-3">None.</div>}
            <ul className="divide-y divide-line-2">{(tasks.data?.items ?? []).filter((t) => !t.completedAt).map((t) => <li key={t.id} className="flex items-center gap-2 py-2"><button className="check" onClick={() => api.update("tasks", t.id, { completedAt: new Date().toISOString() })} aria-label="Complete" /><span className="flex-1 text-[13px] truncate">{t.title}</span><Badge tone={t.priority}>{t.priority}</Badge><span className="text-[11.5px] text-ink-3 tnum">{fmtDate(t.dueDate)}{t.dueTime ? ` ${fmtTime(t.dueTime)}` : ""}</span></li>)}</ul>
          </Card>
          <Card title="Upcoming" action={<button className="card-link" onClick={() => quickAdd("appointments", { contactId: id })}>+ Appointment</button>}>
            {(appts.data?.items ?? []).filter((a) => a.startsAt >= ymd()).length === 0 && <div className="text-[13px] text-ink-3">Nothing scheduled.</div>}
            <ul className="divide-y divide-line-2">{(appts.data?.items ?? []).filter((a) => a.startsAt >= ymd()).slice(0, 5).map((a) => <li key={a.id} className="py-2 text-[13px]"><div className="font-medium">{a.title}</div><div className="text-[12px] text-ink-3">{fmtDateTime(a.startsAt)} · {label(a.type)}</div></li>)}</ul>
          </Card>
          <Card title="Notes" action={<button className="card-link" onClick={() => quickAdd("notes", { contactId: id })}>+ Note</button>}>
            {k.notes && <p className="text-[13px] whitespace-pre-wrap rounded-lg bg-gold-soft/60 p-3 mb-2">{k.notes}</p>}
            {(notes.data?.items ?? []).map((n) => <div key={n.id} className="py-2 border-b border-line-2 text-[13px]"><div className="whitespace-pre-wrap">{n.pinned && <span className="text-gold mr-1">★</span>}{n.body}</div><div className="text-[11.5px] text-ink-3 mt-1">{relative(n.createdAt)}</div></div>)}
            {!k.notes && (notes.data?.items ?? []).length === 0 && <div className="text-[13px] text-ink-3">No notes yet.</div>}
          </Card>
          {vault.data?.status.exists && (
            <Card title="Obsidian">
              {(vault.data.notes ?? []).length === 0 && <div className="text-[13px] text-ink-3">No vault notes mention {k.firstName} yet. Add <code>contact: {name}</code> to a note’s frontmatter or a [[{name}]] wikilink.</div>}
              {(vault.data.notes ?? []).map((n) => <a key={n.id} href={n.uri} className="block py-2 border-b border-line-2 text-[13px] hover:bg-ground rounded"><div className="font-medium">{n.title}</div>{n.excerpt && <div className="text-ink-3 text-[12.5px] line-clamp-2">{n.excerpt}</div>}<div className="text-[11.5px] text-ink-3 mt-0.5">{n.path} · {fmtDate(n.modifiedAt)}</div></a>)}
            </Card>
          )}
        </div>
      </div>
      {crud.panel}
    </div>
  );
}
