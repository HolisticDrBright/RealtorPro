"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, label, toast, useApi, useLookups, useQueryParam } from "@/lib/client";
import { fmtMoney, grossCommission, netIncome } from "@/lib/calc";
import { daysUntil, fmtDate, ymd } from "@/lib/dates";
import { Badge, Card, Empty, Loading, PageHeader, PropertyPhoto, Segmented, SlideOver } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

interface Tx { id: string; propertyId: string; listingId: string | null; contactId: string | null; side: string; status: string; purchasePrice: number; commissionPct: number; referralFee: number; brokerSplitPct: number; expenses: number; escrowOpenedAt: string | null; closingDate: string | null; closedAt: string | null; notes: string | null }
interface Ms { id: string; transactionId: string; name: string; dueDate: string | null; completedAt: string | null; sortOrder: number; notes: string | null }

export default function TransactionsPage() {
  const qf = useQueryParam("focus");
  const [view, setView] = useState<"escrow" | "closed" | "cancelled">("escrow");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (qf) setOpen(qf); }, [qf]);
  const { data, loading } = useApi<{ items: Tx[] }>("/api/transactions?limit=1000");
  const ms = useApi<{ items: Ms[] }>("/api/milestones?limit=5000");
  const lk = useLookups();
  const crud = useCrud("transactions");
  const rows = useMemo(() => (data?.items ?? []).filter((t) => t.status === view).sort((a, b) => (a.closingDate ?? "").localeCompare(b.closingDate ?? "")), [data, view]);
  const current = data?.items.find((t) => t.id === open) ?? null;
  const msFor = (id: string) => (ms.data?.items ?? []).filter((m) => m.transactionId === id).sort((a, b) => a.sortOrder - b.sortOrder);
  const counts = { escrow: data?.items.filter((t) => t.status === "escrow").length ?? 0, closed: data?.items.filter((t) => t.status === "closed").length ?? 0, cancelled: data?.items.filter((t) => t.status === "cancelled").length ?? 0 };

  return (
    <div className="fade-in">
      <PageHeader title="Transactions" sub={`${counts.escrow} in escrow · ${fmtMoney(rows.reduce((a, t) => a + netIncome(t), 0))} net ${view === "escrow" ? "pending" : "earned"} in view`}>
        <Segmented value={view} onChange={setView} options={[{ value: "escrow", label: "In Escrow", count: counts.escrow }, { value: "closed", label: "Closed", count: counts.closed }, { value: "cancelled", label: "Cancelled", count: counts.cancelled }]} />
        <button className="btn btn-primary" onClick={() => crud.openNew({ escrowOpenedAt: ymd() })}>+ Transaction</button>
      </PageHeader>
      {loading && <Loading />}
      {!loading && rows.length === 0 && <Empty title={`Nothing ${view === "escrow" ? "in escrow" : view}`} body="Open a transaction from an accepted offer or by moving a listing to In Escrow." action={<button className="btn btn-sm" onClick={() => crud.openNew()}>+ Transaction</button>} />}
      <div className="space-y-3">
        {rows.map((t) => { const p = lk.propertyOf(t.propertyId); const list = msFor(t.id); const next = list.filter((m) => !m.completedAt && m.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))[0]; const dtc = t.closingDate ? daysUntil(t.closingDate) : null; const done = list.filter((m) => m.completedAt).length; return (
          <Card key={t.id} className="cursor-pointer hover:border-ink-3 transition-colors" bodyClass="pt-4">
            <div className="flex items-center gap-4" onClick={() => setOpen(t.id)}>
              <PropertyPhoto src={p?.photoUrl} address={p?.address ?? ""} />
              <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[15px] font-semibold truncate">{p?.address}</span><Badge tone={t.side}>{t.side === "both" ? "Both sides" : `${label(t.side)} side`}</Badge><Badge tone={t.status}>{label(t.status)}</Badge></div><div className="text-[12.5px] text-ink-3">{p?.city} · {t.contactId ? <Link href={`/contacts/${t.contactId}`} className="link" onClick={(e) => e.stopPropagation()}>{lk.nameOf(t.contactId)}</Link> : "No client linked"} · opened {fmtDate(t.escrowOpenedAt)}</div>
                {view === "escrow" && list.length > 0 && <div className="mt-2 flex items-center gap-2"><div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden"><div className="h-full bg-ink" style={{ width: `${(done / list.length) * 100}%` }} /></div><span className="text-[11.5px] text-ink-3 tnum">{done}/{list.length} milestones</span></div>}
              </div>
              <div className="text-right"><div className="text-[16px] font-semibold tnum">{fmtMoney(t.purchasePrice)}</div><div className="text-[12px] text-ink-3 tnum">GCI {fmtMoney(grossCommission(t))} · net {fmtMoney(netIncome(t))}</div></div>
              {view === "escrow" && <div className="text-right w-[150px]">{next ? <><div className={`text-[12.5px] font-medium ${daysUntil(next.dueDate!) <= 3 ? "text-crit" : ""}`}>{next.name}</div><div className="text-[11.5px] text-ink-3">{daysUntil(next.dueDate!) < 0 ? `${-daysUntil(next.dueDate!)}d overdue` : daysUntil(next.dueDate!) === 0 ? "due today" : `in ${daysUntil(next.dueDate!)}d`}</div></> : <div className="text-[12px] text-ink-3">All milestones done</div>}</div>}
              <div className="text-center w-16"><div className={`text-[22px] font-semibold tnum leading-none ${dtc != null && dtc <= 7 ? "text-crit" : "text-ok"}`}>{view === "escrow" ? dtc ?? "—" : ""}</div><div className="text-[10.5px] text-ink-3">{view === "escrow" ? "Days to Close" : `Closed ${fmtDate(t.closedAt ?? t.closingDate)}`}</div></div>
            </div>
          </Card>
        ); })}
      </div>

      <SlideOver open={!!current} onClose={() => setOpen(null)} title={current ? `${lk.addressOf(current.propertyId)} · ${label(current.status)}` : ""} wide>
        {current && <TxDetail t={current} milestones={msFor(current.id)} lk={lk} onEdit={() => crud.openEdit(current as unknown as Record<string, unknown>)} onDelete={() => { setOpen(null); crud.remove(current.id, lk.addressOf(current.propertyId) ?? "transaction"); }} />}
      </SlideOver>
      {crud.panel}
    </div>
  );
}

function TxDetail({ t, milestones, lk, onEdit, onDelete }: { t: Tx; milestones: Ms[]; lk: ReturnType<typeof useLookups>; onEdit: () => void; onDelete: () => void }) {
  const [newMs, setNewMs] = useState("");
  const gross = grossCommission(t), net = netIncome(t);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-ground p-3"><div className="kicker">Purchase price</div><div className="text-[18px] font-semibold tnum">{fmtMoney(t.purchasePrice)}</div></div>
        <div className="rounded-lg bg-ground p-3"><div className="kicker">Gross commission</div><div className="text-[18px] font-semibold tnum">{fmtMoney(gross)}</div><div className="text-[11.5px] text-ink-3">{t.commissionPct}%</div></div>
        <div className="rounded-lg bg-gold-soft p-3"><div className="kicker text-gold-ink">Estimated net</div><div className="text-[18px] font-semibold tnum text-gold-ink">{fmtMoney(net)}</div><div className="text-[11.5px] text-gold-ink/80">after {t.brokerSplitPct}% split, {fmtMoney(t.referralFee)} referral, {fmtMoney(t.expenses)} expenses</div></div>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
        {[["Client", t.contactId ? <Link key="c" href={`/contacts/${t.contactId}`} className="link">{lk.nameOf(t.contactId)}</Link> : "—"], ["Representing", t.side === "both" ? "Both sides" : label(t.side)], ["Escrow opened", fmtDate(t.escrowOpenedAt, { month: "short", day: "numeric", year: "numeric" })], ["Closing date", fmtDate(t.closingDate, { month: "short", day: "numeric", year: "numeric" })], ["Days until closing", t.closingDate && t.status === "escrow" ? daysUntil(t.closingDate) : "—"], ["Status", label(t.status)]].map(([k, v]) => <div key={String(k)} className="flex justify-between gap-3 border-b border-line-2 py-1.5"><dt className="text-ink-3">{k}</dt><dd className="font-medium text-right">{v as React.ReactNode}</dd></div>)}
      </dl>
      <div>
        <div className="flex items-center mb-2"><div className="kicker">Transaction timeline</div><span className="ml-auto text-[11.5px] text-ink-3">Deadlines within 72 hours are highlighted</span></div>
        <ol className="relative border-l border-line ml-2 space-y-1">
          {milestones.map((m) => { const d = m.dueDate ? daysUntil(m.dueDate) : null; const urgent = !m.completedAt && d != null && d <= 3; return (
            <li key={m.id} className={`ml-4 flex items-center gap-3 rounded-lg px-2 py-1.5 ${urgent ? "bg-crit-soft" : ""}`}>
              <span className={`absolute -left-[5px] w-2.5 h-2.5 rounded-full border-2 ${m.completedAt ? "bg-ink border-ink" : urgent ? "bg-crit border-crit" : "bg-panel border-zinc-300"}`} />
              <button className={`check ${m.completedAt ? "on" : ""}`} onClick={async () => { await api.update("milestones", m.id, { completedAt: m.completedAt ? null : new Date().toISOString() }); }} aria-label={`Complete ${m.name}`}>{m.completedAt ? "✓" : ""}</button>
              <div className="flex-1 min-w-0"><div className={`text-[13.5px] ${m.completedAt ? "line-through text-ink-3" : "font-medium"}`}>{m.name}</div>{m.notes && <div className="text-[12px] text-ink-3">{m.notes}</div>}</div>
              <input type="date" className="input h-8 w-36 text-[12px]" value={m.dueDate ?? ""} onChange={(e) => api.update("milestones", m.id, { dueDate: e.target.value || null })} aria-label={`${m.name} due date`} />
              <span className={`text-[11.5px] w-20 text-right tnum ${urgent ? "text-crit font-medium" : "text-ink-3"}`}>{m.completedAt ? "done" : d == null ? "" : d < 0 ? `${-d}d overdue` : d === 0 ? "today" : `in ${d}d`}</span>
              <button className="btn btn-ghost btn-icon text-ink-3" aria-label="Remove milestone" onClick={() => api.remove("milestones", m.id)}>✕</button>
            </li>
          ); })}
        </ol>
        <form className="flex gap-2 mt-3 ml-6" onSubmit={async (e) => { e.preventDefault(); if (!newMs.trim()) return; await api.create("milestones", { transactionId: t.id, name: newMs.trim(), sortOrder: milestones.length }); setNewMs(""); }}><input className="input" placeholder="Add a milestone (e.g. HOA documents)" value={newMs} onChange={(e) => setNewMs(e.target.value)} /><button className="btn">Add</button></form>
      </div>
      <div className="flex gap-2 flex-wrap">
        {t.status === "escrow" && <button className="btn btn-primary" onClick={async () => { const r = await api.update("transactions", t.id, { status: "closed", closedAt: ymd() }); if (r.ok) toast("Closed — YTD, GCI, net income and goal updated"); }}>Mark closed</button>}
        {t.status === "escrow" && <button className="btn" onClick={async () => { const r = await api.update("transactions", t.id, { status: "cancelled" }); if (r.ok) toast("Marked cancelled"); }}>Cancel escrow</button>}
        <button className="btn" onClick={() => quickAdd("tasks", { transactionId: t.id, propertyId: t.propertyId, contactId: t.contactId, category: "escrow" })}>+ Task</button>
        <button className="btn" onClick={() => quickAdd("notes", { transactionId: t.id, propertyId: t.propertyId, contactId: t.contactId })}>+ Note</button>
        <span className="ml-auto"><RowMenu onEdit={onEdit} onDelete={onDelete} /></span>
      </div>
      {t.notes && <div><div className="kicker mb-1">Notes</div><p className="text-[13.5px] whitespace-pre-wrap">{t.notes}</p></div>}
    </div>
  );
}
