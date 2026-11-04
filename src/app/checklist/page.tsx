"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, label, toast, useApi, useQueryParam } from "@/lib/client";
import { daysUntil, fmtDate, ymd } from "@/lib/dates";
import { Badge, Card, Confirm, Empty, Loading, PageHeader, PropertyPhoto, Segmented } from "@/components/ui/primitives";
import { ANCHOR_LABELS, CONDITION_LABELS, CONDITIONS, OWNER_LABELS, type Condition } from "@/data/checklist-templates";

/**
 * Checklist — the California seller/buyer transaction checklist for each
 * escrow: tasks and required documents per phase with computed due dates.
 * Tracks and reminds only; nothing here fills, signs or sends a form.
 */

interface Summary { total: number; done: number; overdue: number; dueSoon: number; nextDue: string | null; byPhase: { phaseKey: string; name: string; total: number; done: number; nextDue: string | null }[] }
interface Row { id: string; side: string; address: string; city: string; photoUrl: string | null; contactName: string | null; closingDate: string | null; checklist: Summary | null }
interface Tx { id: string; side: string; address: string; city: string; photoUrl: string | null; contactName: string | null; contactId: string | null; propertyId: string; escrowOpenedAt: string | null; closingDate: string | null; listingSignedAt: string | null; acceptanceAt: string | null; disclosureDeliveredAt: string | null; flags: Partial<Record<Condition, boolean>> | null; anchors: Record<string, string | null | undefined> }
interface Item { id: string; phaseKey: string; sortOrder: number; code: string; title: string; kind: string; owner: string; formCode: string | null; authority: string | null; status: string; dueDate: string | null; dueOverride: string | null; notes: string | null; taskId: string | null; task: { id: string; completedAt: string | null } | null }
interface Detail { transaction: Tx; template: { id: string; name: string; version: string; phases: { key: string; name: string; order: number }[] } | null; items: Item[]; summary: Summary }

const FLAGS = CONDITIONS.filter((c) => c !== "always");
const STATUSES = ["pending", "done", "na", "waived"] as const;
const due = (i: Item) => i.dueOverride ?? i.dueDate;

export default function ChecklistPage() {
  const qtx = useQueryParam("tx");
  const list = useApi<{ items: Row[] }>("/api/checklist/transactions");
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => { if (qtx) setSelected(qtx); }, [qtx]);
  useEffect(() => { if (!selected && !qtx && list.data?.items[0]) setSelected(list.data.items[0].id); }, [list.data, selected, qtx]);
  const rows = list.data?.items ?? [];

  return (
    <div className="fade-in">
      <PageHeader title="Transaction Checklist" sub="California seller and buyer checklists for every escrow — tasks and required documents per phase, with computed due dates. It tracks and reminds; it never fills or sends a form." />
      {list.loading && <Loading />}
      {!list.loading && rows.length === 0 && <Empty title="Nothing in escrow" body="Open a transaction from an accepted offer or by moving a listing to In Escrow. Every new escrow gets a checklist automatically." action={<Link href="/transactions" className="btn btn-sm">Go to Transactions</Link>} />}
      {rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
          <div className="space-y-2">
            {rows.map((r) => { const c = r.checklist; const active = r.id === selected; return (
              <button key={r.id} className={`w-full text-left card px-4 py-3 transition-colors ${active ? "border-ink" : "hover:border-ink-3"}`} onClick={() => setSelected(r.id)} aria-current={active ? "true" : undefined}>
                <div className="flex items-center gap-3">
                  <PropertyPhoto src={r.photoUrl} address={r.address} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="text-[14px] font-semibold truncate">{r.address}</span><Badge tone={r.side}>{r.side === "both" ? "Both" : label(r.side)}</Badge></div>
                    <div className="text-[12px] text-ink-3 truncate">{[r.contactName, r.closingDate ? `closes ${fmtDate(r.closingDate)}` : null].filter(Boolean).join(" · ")}</div>
                  </div>
                </div>
                {c ? (
                  <div className="mt-2 flex items-center gap-2 text-[12px]"><div className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden"><div className="h-full bg-ink" style={{ width: `${c.total ? (c.done / c.total) * 100 : 0}%` }} /></div><span className="tnum text-ink-3">{c.done}/{c.total}</span>{c.overdue > 0 && <span className="text-crit font-semibold">{c.overdue} overdue</span>}</div>
                ) : <div className="mt-2 text-[12px] text-ink-3">No checklist yet</div>}
              </button>
            ); })}
          </div>
          {selected && <TxChecklist key={selected} id={selected} onChanged={list.reload} />}
        </div>
      )}
    </div>
  );
}

function TxChecklist({ id, onChanged }: { id: string; onChanged: () => void }) {
  const { data, loading, error, reload } = useApi<Detail>(`/api/checklist/transactions/${id}`);
  const [phase, setPhase] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = () => { reload(); onChanged(); };
  const phases = useMemo(() => data?.template?.phases.slice().sort((a, b) => a.order - b.order) ?? [], [data]);
  const current = phase ?? phases[0]?.key ?? null;
  const items = useMemo(() => (data?.items ?? []).filter((i) => i.phaseKey === current).sort((a, b) => a.sortOrder - b.sortOrder), [data, current]);

  async function patchTx(body: Record<string, unknown>, okMsg: string) {
    setBusy(true);
    const r = await api.update("transactions", id, body);
    setBusy(false);
    if (r.ok) { toast(okMsg); refresh(); } else toast(r.message ?? "Could not save", "err");
  }
  async function patchItem(item: Item, body: Record<string, unknown>, okMsg?: string) {
    const r = await api.update("checklist/items", item.id, body);
    if (r.ok) { if (okMsg) toast(okMsg); refresh(); } else toast(r.message ?? "Could not save", "err");
  }
  async function addTask(item: Item) {
    const r = await api.post<{ message: string }>(`/api/checklist/items/${item.id}/task`);
    if (r.ok) { toast(r.data.message); refresh(); } else toast(r.message ?? "Could not add task", "err");
  }
  async function reset() {
    setConfirmReset(false);
    const r = await api.post(`/api/checklist/transactions/${id}`, { reset: true });
    if (r.ok) { toast("Checklist rebuilt from the template"); refresh(); } else toast(r.message ?? "Could not reset", "err");
  }
  async function start() {
    const r = await api.post(`/api/checklist/transactions/${id}`, {});
    if (r.ok) { toast("Checklist started"); refresh(); } else toast(r.message ?? "Could not start", "err");
  }

  if (loading) return <Loading />;
  if (error || !data) return <Card><div className="text-[13px] text-crit">{error ?? "Could not load this checklist."}</div></Card>;
  const tx = data.transaction;
  const flags = tx.flags ?? {};
  const today = ymd();
  const dateFields: { key: "listingSignedAt" | "acceptanceAt" | "closingDate" | "disclosureDeliveredAt"; label: string; hint?: string }[] = [
    { key: "listingSignedAt", label: tx.side === "buyer" ? "Representation agreement" : ANCHOR_LABELS.listing_signed },
    { key: "acceptanceAt", label: ANCHOR_LABELS.acceptance, hint: !tx.acceptanceAt && tx.escrowOpenedAt ? `using escrow opened ${fmtDate(tx.escrowOpenedAt)}` : undefined },
    { key: "closingDate", label: ANCHOR_LABELS.coe },
    { key: "disclosureDeliveredAt", label: ANCHOR_LABELS.disclosure_delivery },
  ];

  return (
    <div className="space-y-4 min-w-0">
      <Card title={<h2 className="card-title flex items-center gap-2 min-w-0"><span className="truncate normal-case tracking-normal text-[16px]">{tx.address}</span><Badge tone={tx.side}>{tx.side === "both" ? "Both sides" : `${label(tx.side)} side`}</Badge></h2>} action={<span className="card-link">{data.template ? `${data.template.name} · v${data.template.version}` : ""}</span>}>
        <div className="text-[12.5px] text-ink-3 mb-3">{[tx.city, tx.contactName ? <Link key="c" href={`/contacts/${tx.contactId}`} className="link">{tx.contactName}</Link> : null].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && " · "}{x}</span>)} · <Link href={`/transactions?focus=${tx.id}`} className="link">transaction</Link></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dateFields.map((f) => (
            <label key={f.key} className="block"><span className="kicker block mb-1">{f.label}</span><input type="date" className="input h-9" value={tx[f.key] ?? ""} disabled={busy} onChange={(e) => patchTx({ [f.key]: e.target.value || null }, e.target.value ? "Date saved — due dates recomputed (overrides and done items kept)" : "Date cleared")} aria-label={f.label} />{f.hint && <span className="block text-[11px] text-ink-3 mt-0.5">{f.hint}</span>}</label>
          ))}
        </div>
        <div className="mt-3">
          <div className="kicker mb-1.5">Conditions — switch on what applies; conditional items appear or retire</div>
          <div className="flex flex-wrap gap-1.5">
            {FLAGS.map((f) => { const on = !!flags[f]; return <button key={f} className={`pill cursor-pointer ${on ? "bg-ink text-white" : "bg-ground text-ink-2 hover:bg-zinc-200"}`} aria-pressed={on} disabled={busy} onClick={() => patchTx({ flags: { ...flags, [f]: !on } }, `${CONDITION_LABELS[f]} ${on ? "off" : "on"}`)}>{on ? "✓ " : ""}{CONDITION_LABELS[f]}</button>; })}
          </div>
        </div>
      </Card>

      {data.items.length === 0 ? (
        <Empty title="No checklist yet" body={`Start the California ${tx.side === "buyer" ? "buyer" : "seller"} checklist for this escrow. The dates above drive the deadlines; conditions switch optional items on.`} action={<button className="btn btn-primary btn-sm" onClick={start}>Start checklist</button>} />
      ) : (
        <Card bodyClass="pt-4">
          <div className="flex items-center gap-3 flex-wrap text-[13px] mb-3">
            <strong>{data.summary.done}/{data.summary.total} complete</strong>
            {data.summary.overdue > 0 && <span className="text-crit font-semibold">{data.summary.overdue} overdue</span>}
            {data.summary.dueSoon > 0 && <span>{data.summary.dueSoon} due within 7 days</span>}
            {data.summary.nextDue && <span className="text-ink-3">Next due {fmtDate(data.summary.nextDue)}</span>}
          </div>
          <Segmented value={current ?? ""} onChange={setPhase} options={phases.map((p) => { const b = data.summary.byPhase.find((x) => x.phaseKey === p.key); return { value: p.key, label: `${p.order}. ${p.name.split(",")[0]}`, count: b ? b.done : undefined }; })} />
          {(["task", "document"] as const).map((kind) => { const rows = items.filter((i) => i.kind === kind); if (!rows.length) return null; return (
            <div key={kind} className="mt-4">
              <div className="kicker mb-1">{kind === "task" ? "Tasks" : "Documents"} · {rows.length}</div>
              <ul className="divide-y divide-line-2">
                {rows.map((i) => <ItemRow key={i.id} item={i} today={today} onStatus={(st) => patchItem(i, { status: st })} onOverride={(v) => patchItem(i, { dueOverride: v || null }, v ? "Due date overridden" : "Override cleared")} onNotes={(v) => patchItem(i, { notes: v || null })} onTask={() => addTask(i)} />)}
              </ul>
            </div>
          ); })}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-line-2 text-[12px] text-ink-3">
            <span>Day counts are the RPA defaults; business days skip weekends only. Verify every deadline against the contract.</span>
            <button className="btn btn-sm ml-auto" onClick={() => setConfirmReset(true)}>Reset checklist</button>
          </div>
        </Card>
      )}
      <Confirm open={confirmReset} title="Reset this checklist?" body="Every item is rebuilt from the template using the current dates and conditions. Statuses, overrides and notes on this escrow's items are discarded." confirmLabel="Reset" onConfirm={reset} onCancel={() => setConfirmReset(false)} />
    </div>
  );
}

function ItemRow({ item: i, today, onStatus, onOverride, onNotes, onTask }: { item: Item; today: string; onStatus: (s: string) => void; onOverride: (v: string) => void; onNotes: (v: string) => void; onTask: () => void }) {
  const d = due(i);
  const open = i.status === "pending";
  const days = d ? daysUntil(d) : null;
  const overdue = open && days != null && days < 0;
  const [notes, setNotes] = useState(i.notes ?? "");
  const [override, setOverride] = useState(i.dueOverride ?? "");
  return (
    <li className={`py-2.5 flex items-start gap-3 ${i.status === "na" ? "opacity-50" : ""}`}>
      <button className={`check mt-0.5 ${i.status === "done" ? "on" : ""}`} onClick={() => onStatus(i.status === "done" ? "pending" : "done")} aria-label={`Mark ${i.title} ${i.status === "done" ? "pending" : "done"}`}>{i.status === "done" ? "✓" : ""}</button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge>{i.code}</Badge>
          <span className={`text-[13.5px] font-medium ${i.status === "done" ? "line-through text-ink-3" : ""}`}>{i.title}</span>
          <span className="text-[11.5px] text-ink-3" title={OWNER_LABELS[i.owner as keyof typeof OWNER_LABELS] ?? i.owner}>{i.owner}</span>
          {i.formCode && <span className="text-[11.5px] text-ink-3">C.A.R. {i.formCode}</span>}
          {i.authority && <span className="text-[11.5px] text-ink-3">· {i.authority}</span>}
        </div>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <Badge tone={overdue ? "crit" : days != null && days <= 3 && open ? "warn" : "neutral"}>{d ? (overdue ? `${-days!}d overdue · ${fmtDate(d)}` : days === 0 ? "Due today" : `Due ${fmtDate(d)}`) : "No date"}</Badge>
          <input type="date" className="input h-8 w-36 text-[12px]" value={override} onChange={(e) => setOverride(e.target.value)} onBlur={() => { if (override !== (i.dueOverride ?? "")) onOverride(override); }} aria-label={`Override due date for ${i.title}`} title={i.dueDate ? `Computed ${i.dueDate}; set a date to override` : "Set a due date"} />
          <select className="input h-8 w-28 text-[12px]" value={i.status} onChange={(e) => onStatus(e.target.value)} aria-label={`Status for ${i.title}`}>{STATUSES.map((st) => <option key={st} value={st}>{st === "na" ? "N/A" : st}</option>)}</select>
          <input className="input h-8 flex-1 min-w-[160px] text-[12px]" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (notes !== (i.notes ?? "")) onNotes(notes); }} aria-label={`Notes for ${i.title}`} />
          {open && !i.taskId && <button className="btn btn-sm" onClick={onTask}>+ Task</button>}
          {i.taskId && <Link href="/tasks" className="text-[11.5px] text-ink-3 hover:underline">{i.task?.completedAt ? "Task done" : "On your task list"}</Link>}
        </div>
      </div>
    </li>
  );
}
