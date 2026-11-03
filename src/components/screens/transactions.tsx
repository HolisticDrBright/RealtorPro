"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../app-state";
import { ConfirmDialog } from "../dialogs";
import { ErrorBox, Loading, Empty, ScreenHeader, errText, patchJson, postJson, useGet } from "../modules/shared";
import { ANCHOR_LABELS, CONDITION_LABELS, CONDITIONS, OWNER_LABELS, type Condition } from "@/data/checklist-templates";

/**
 * Transactions — the California seller/buyer checklist per transaction.
 * Tracks and reminds only: nothing here generates, fills or signs a form, and
 * "Push to FUB" only queues a local draft task the agent approves on the
 * Follow Up Boss screen. Flat Modernist style, primitives from ui.tsx / shared.
 */

interface Summary { total: number; done: number; overdue: number; dueSoon: number; nextDue: string | null; byPhase: { phaseKey: string; name: string; total: number; done: number; nextDue: string | null }[] }
interface TxRow { id: string; side: string; address: string; status: string; stage: string | null; contactName: string | null; checklist: Summary | null }
interface Tx { id: string; side: string; address: string; status: string; stage: string | null; contactName: string | null; contactFubId: string | null; fubDealId: string | null; listingSignedAt: string | null; acceptanceAt: string | null; coeAt: string | null; disclosureDeliveredAt: string | null; flags: Partial<Record<Condition, boolean>> | null }
interface Item { id: string; phaseKey: string; phaseOrder: number; sortOrder: number; code: string; title: string; kind: string; owner: string; formCode: string | null; authority: string | null; status: string; dueDate: string | null; dueOverride: string | null; notes: string | null; taskId: string | null; task: { id: string; title: string; origin: string; syncedToFub: boolean; dueAt: string | null } | null; document: { id: string; filename: string; kind: string } | null }
interface Detail { transaction: Tx; template: { id: string; key: string; name: string; version: string; phases: { key: string; name: string; order: number }[] } | null; items: Item[]; summary: Summary }

const DATE_FIELDS: { key: keyof Tx & ("listingSignedAt" | "acceptanceAt" | "coeAt" | "disclosureDeliveredAt"); label: (side: string) => string }[] = [
  { key: "listingSignedAt", label: (side) => (side === "buyer" ? "Representation agreement" : ANCHOR_LABELS.listing_signed) },
  { key: "acceptanceAt", label: () => ANCHOR_LABELS.acceptance },
  { key: "coeAt", label: () => ANCHOR_LABELS.coe },
  { key: "disclosureDeliveredAt", label: () => ANCHOR_LABELS.disclosure_delivery },
];
const FLAGS = CONDITIONS.filter((c) => c !== "always");
const STATUSES = ["pending", "done", "na", "waived"] as const;
const todayYmd = () => new Date().toISOString().slice(0, 10);
const effectiveDue = (i: Item) => i.dueOverride ?? i.dueDate;

export function TransactionsScreen() {
  const app = useApp();
  const list = useGet<{ transactions: TxRow[] }>("/api/transactions");
  const [selected, setSelected] = useState<string | null>(app.selectedTransactionId);
  useEffect(() => {
    if (app.selectedTransactionId) setSelected(app.selectedTransactionId);
  }, [app.selectedTransactionId]);
  useEffect(() => {
    if (!selected && list.data?.transactions[0]) setSelected(list.data.transactions[0].id);
  }, [list.data, selected]);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1320 }}>
      <ScreenHeader title="Transactions" sub="California seller and buyer checklists — tasks and required documents per phase with computed due dates. Tracks and reminds only; it never fills or sends a form." />
      {list.loading && <Loading label="Loading transactions…" />}
      {list.error && <ErrorBox message={list.error} onRetry={list.reload} />}
      {list.data && list.data.transactions.length === 0 && <Empty kicker="Transactions" title="No active transactions" body="Create a transaction with POST /api/transactions, or mark one active on the dashboard, and its checklist appears here." />}
      {list.data && list.data.transactions.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 24, alignItems: "start" }}>
          <TxList rows={list.data.transactions} selected={selected} onSelect={setSelected} />
          {selected && <TxDetail key={selected} id={selected} onChanged={list.reload} />}
        </div>
      )}
    </section>
  );
}

function TxList({ rows, selected, onSelect }: { rows: TxRow[]; selected: string | null; onSelect: (id: string) => void }) {
  return (
    <div role="list" aria-label="Active transactions" style={{ borderTop: "2px solid var(--color-divider)" }}>
      {rows.map((t) => {
        const active = t.id === selected;
        const c = t.checklist;
        return (
          <button
            key={t.id}
            role="listitem"
            onClick={() => onSelect(t.id)}
            aria-current={active ? "true" : undefined}
            style={{ display: "block", width: "100%", textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer", border: "none", borderBottom: "1px solid var(--color-divider)", borderLeft: `3px solid ${active ? "var(--color-accent)" : "transparent"}`, background: active ? "color-mix(in srgb, var(--color-accent) 8%, transparent)" : "transparent", padding: "12px 12px 12px 10px" }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className={t.side === "listing" ? "tag tag-accent" : "tag tag-neutral"} style={{ fontSize: 10 }}>{t.side === "listing" ? "Listing" : "Buyer"}</span>
              <span style={{ fontWeight: 700, fontSize: 14.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.address}</span>
            </div>
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 3 }}>{[t.contactName, t.stage].filter(Boolean).join(" · ") || t.status}</div>
            {c ? (
              <div style={{ fontSize: 12.5, marginTop: 5, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Progress done={c.done} total={c.total} />
                <span>{c.done}/{c.total}</span>
                {c.nextDue && <span className="text-muted">next {c.nextDue}</span>}
                {c.overdue > 0 && <span style={{ color: "var(--color-accent)", fontWeight: 800 }}>{c.overdue} overdue</span>}
              </div>
            ) : (
              <div className="text-muted" style={{ fontSize: 12.5, marginTop: 5 }}>No checklist yet</div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <span aria-hidden="true" style={{ display: "inline-block", width: 64, height: 6, background: "var(--color-divider)", position: "relative" }}>
      <span style={{ position: "absolute", inset: 0, width: `${pct}%`, background: "var(--color-accent)" }} />
    </span>
  );
}

function TxDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const app = useApp();
  const { data, loading, error, reload } = useGet<Detail>(`/api/transactions/${id}`);
  const [phase, setPhase] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [dates, setDates] = useState<Record<string, string>>({});
  const refresh = () => { reload(); onChanged(); };

  useEffect(() => {
    if (data) setDates(Object.fromEntries(DATE_FIELDS.map((f) => [f.key, data.transaction[f.key] ?? ""])));
  }, [data]);

  const phases = useMemo(() => data?.template?.phases.slice().sort((a, b) => a.order - b.order) ?? [], [data]);
  const current = phase ?? phases[0]?.key ?? null;
  const items = useMemo(() => (data?.items ?? []).filter((i) => i.phaseKey === current).sort((a, b) => a.sortOrder - b.sortOrder), [data, current]);

  async function run(label: string, fn: () => Promise<{ ok: boolean; data: unknown }>, okMsg?: (d: unknown) => string) {
    setBusy(label);
    const res = await fn();
    setBusy(null);
    if (res.ok) { if (okMsg) app.say(okMsg(res.data)); refresh(); } else app.say(errText(res.data));
    return res.ok;
  }
  const saveDate = (key: string) => {
    const value = dates[key] ?? "";
    if ((data?.transaction[key as keyof Tx] ?? "") === value) return;
    void run(`date:${key}`, () => patchJson(`/api/transactions/${id}`, { [key]: value || null }), (d) => { const n = (d as { recomputed?: number }).recomputed ?? 0; return n ? `Date saved — ${n} due date${n === 1 ? "" : "s"} recomputed (overrides and done items untouched).` : "Date saved."; });
  };
  const toggleFlag = (flag: Condition, on: boolean) =>
    run(`flag:${flag}`, () => patchJson(`/api/transactions/${id}`, { flags: { [flag]: on } }), (d) => { const r = (d as { flagResult?: { added: number; markedNa: number; revived: number } }).flagResult; return r ? `${CONDITION_LABELS[flag]} ${on ? "on" : "off"} — ${r.added + r.revived} item${r.added + r.revived === 1 ? "" : "s"} added, ${r.markedNa} marked N/A.` : "Saved."; });
  const patchItem = (item: Item, body: Record<string, unknown>, msg?: string) => run(`item:${item.id}`, () => patchJson(`/api/checklist/items/${item.id}`, body), msg ? () => msg : undefined);
  const pushFub = (item: Item) => run(`fub:${item.id}`, () => postJson(`/api/checklist/items/${item.id}/push-fub`, {}), (d) => (d as { message?: string }).message ?? "Draft task queued.");
  const attach = async (item: Item, file: File) => {
    setBusy(`attach:${item.id}`);
    const fd = new FormData();
    fd.append("file", file);
    let res: { ok: boolean; data: unknown };
    try {
      const r = await fetch(`/api/checklist/items/${item.id}/attach`, { method: "POST", body: fd });
      res = { ok: r.ok, data: await r.json().catch(() => ({})) };
    } catch {
      res = { ok: false, data: { error: { message: "Upload failed — your local data is safe." } } };
    }
    setBusy(null);
    if (res.ok) { app.say((res.data as { message?: string }).message ?? "Attached."); refresh(); } else app.say(errText(res.data));
  };
  const resetChecklist = () => { setConfirmReset(false); void run("reset", () => postJson(`/api/transactions/${id}/checklist`, { reset: true }), () => "Checklist rebuilt from the template."); };
  const startChecklist = () => run("start", () => postJson(`/api/transactions/${id}/checklist`, {}), () => "Checklist created.");
  const doExport = (format: "pdf" | "xlsx") => run(`export:${format}`, () => postJson(`/api/transactions/${id}/export`, { format }), (d) => (d as { message?: string }).message ?? "Exported.");

  if (loading) return <Loading label="Loading checklist…" />;
  if (error || !data) return <ErrorBox message={error ?? "No data."} onRetry={reload} />;
  const tx = data.transaction;
  const flags = tx.flags ?? {};
  const today = todayYmd();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Header */}
      <div style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 12 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
          <span className={tx.side === "listing" ? "tag tag-accent" : "tag tag-neutral"}>{tx.side === "listing" ? "Listing" : "Buyer"}</span>
          <h3 style={{ margin: 0, fontSize: 22 }}>{tx.address}</h3>
          <span className="text-muted" style={{ fontSize: 13.5 }}>{[tx.contactName, tx.stage, tx.status].filter(Boolean).join(" · ")}</span>
          <span className="text-muted" style={{ fontSize: 12.5, marginLeft: "auto" }}>{data.template ? `${data.template.name} · v${data.template.version}` : "No template"}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginTop: 12 }}>
          {DATE_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={`d-${f.key}`}>{f.label(tx.side)}</label>
              <input id={`d-${f.key}`} type="date" className="input" value={dates[f.key] ?? ""} onChange={(e) => setDates((s) => ({ ...s, [f.key]: e.target.value }))} onBlur={() => saveDate(f.key)} disabled={busy?.startsWith("date:")} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="card-kicker" style={{ marginBottom: 6 }}>Conditions — switch on what applies; conditional items appear or retire</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {FLAGS.map((f) => {
              const on = !!flags[f];
              return (
                <button key={f} className={on ? "tag tag-accent" : "tag tag-outline"} style={{ cursor: "pointer", font: "inherit", fontSize: 11.5, padding: "4px 9px" }} aria-pressed={on} onClick={() => toggleFlag(f, !on)} disabled={busy?.startsWith("flag:")}>
                  {on ? "✓ " : ""}{CONDITION_LABELS[f]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {data.items.length === 0 ? (
        <Empty kicker="Checklist" title="No checklist for this transaction yet" body={`Start the default ${tx.side === "buyer" ? "buyer" : "seller"} checklist. Dates above drive the computed deadlines; conditions switch optional items on.`} action={<button className="btn btn-primary" onClick={startChecklist} disabled={busy === "start"}>Start checklist</button>} />
      ) : (
        <>
          {/* Summary + phase tabs */}
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", fontSize: 13.5 }}>
            <strong>{data.summary.done}/{data.summary.total} complete</strong>
            {data.summary.overdue > 0 && <span style={{ color: "var(--color-accent)", fontWeight: 800 }}>{data.summary.overdue} overdue</span>}
            {data.summary.dueSoon > 0 && <span>{data.summary.dueSoon} due within 7 days</span>}
            {data.summary.nextDue && <span className="text-muted">Next due {data.summary.nextDue}</span>}
          </div>
          <div role="tablist" aria-label="Phases" style={{ display: "flex", borderBottom: "2px solid var(--color-divider)", gap: 2, flexWrap: "wrap" }}>
            {phases.map((p) => {
              const s = data.summary.byPhase.find((b) => b.phaseKey === p.key);
              const active = p.key === current;
              return (
                <button key={p.key} role="tab" aria-selected={active} onClick={() => setPhase(p.key)} style={{ font: "inherit", fontWeight: 700, fontSize: 13.5, cursor: "pointer", border: "none", background: "transparent", color: active ? "var(--color-accent)" : "inherit", padding: "8px 12px", borderBottom: `3px solid ${active ? "var(--color-accent)" : "transparent"}`, marginBottom: -2 }}>
                  {p.order}. {p.name} <span className="text-muted" style={{ fontWeight: 500 }}>{s ? `${s.done}/${s.total}` : ""}</span>
                </button>
              );
            })}
          </div>

          {(["task", "document"] as const).map((kind) => {
            const rows = items.filter((i) => i.kind === kind);
            if (!rows.length) return null;
            return (
              <div key={kind}>
                <h6 style={{ margin: "0 0 2px", fontSize: 12 }}>{kind === "task" ? "Tasks" : "Documents"} · {rows.length}</h6>
                <div role="list">
                  {rows.map((i) => <ItemRow key={i.id} item={i} today={today} busy={busy} onStatus={(s) => patchItem(i, { status: s })} onOverride={(v) => patchItem(i, { dueOverride: v || null }, v ? "Due date overridden." : "Override cleared.")} onNotes={(v) => patchItem(i, { notes: v || null })} onPush={() => pushFub(i)} onAttach={(f) => attach(i, f)} />)}
                </div>
              </div>
            );
          })}

          {/* Footer */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", borderTop: "2px solid var(--color-divider)", paddingTop: 12 }}>
            <button className="btn btn-secondary" onClick={() => doExport("pdf")} disabled={busy?.startsWith("export")}>Export PDF</button>
            <button className="btn btn-secondary" onClick={() => doExport("xlsx")} disabled={busy?.startsWith("export")}>Export XLSX</button>
            <span className="text-muted" style={{ fontSize: 12.5 }}>Exports record an approval and land in workspace/exports.</span>
            <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setConfirmReset(true)} disabled={busy === "reset"}>Reset checklist</button>
          </div>
        </>
      )}

      {confirmReset && <ConfirmDialog title="Reset this checklist?" body="Every item is rebuilt from the template using the current dates and conditions. Statuses, overrides, notes and attachments on this transaction's items are discarded. Audit history is kept." confirmLabel="Reset checklist" onConfirm={resetChecklist} onCancel={() => setConfirmReset(false)} />}
    </div>
  );
}

function ItemRow({ item: i, today, busy, onStatus, onOverride, onNotes, onPush, onAttach }: { item: Item; today: string; busy: string | null; onStatus: (s: string) => void; onOverride: (v: string) => void; onNotes: (v: string) => void; onPush: () => void; onAttach: (f: File) => void }) {
  const due = effectiveDue(i);
  const open = i.status === "pending";
  const overdue = open && !!due && due < today;
  const [notes, setNotes] = useState(i.notes ?? "");
  const [override, setOverride] = useState(i.dueOverride ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const rowBusy = busy === `item:${i.id}` || busy === `fub:${i.id}` || busy === `attach:${i.id}`;
  return (
    <div role="listitem" style={{ display: "grid", gridTemplateColumns: "22px minmax(0, 1fr) auto", gap: "6px 12px", padding: "10px 0", borderBottom: "1px solid var(--color-divider)", opacity: i.status === "na" ? 0.55 : 1, alignItems: "start" }}>
      <input type="checkbox" checked={i.status === "done"} onChange={(e) => onStatus(e.target.checked ? "done" : "pending")} aria-label={`Mark ${i.title} ${i.status === "done" ? "pending" : "done"}`} disabled={rowBusy} style={{ marginTop: 3, accentColor: "var(--color-accent)", width: 16, height: 16 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
          <span className="tag tag-neutral" style={{ fontSize: 10 }}>{i.code}</span>
          <span style={{ fontWeight: 600, fontSize: 14.5, textDecoration: i.status === "done" ? "line-through" : "none" }}>{i.title}</span>
          <span className="tag tag-outline" style={{ fontSize: 10 }} title={OWNER_LABELS[i.owner as keyof typeof OWNER_LABELS] ?? i.owner}>{i.owner}</span>
          {i.formCode && <span className="text-muted" style={{ fontSize: 12 }}>C.A.R. {i.formCode}</span>}
          {i.authority && <span className="text-muted" style={{ fontSize: 12 }}>· {i.authority}</span>}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12.5 }}>
            <span className={overdue ? "tag tag-accent" : "tag tag-neutral"} style={{ fontSize: 10 }}>{due ? (overdue ? `Overdue ${due}` : `Due ${due}`) : "No date"}</span>
            <input type="date" className="input" style={{ width: 150, padding: "3px 6px", fontSize: 12.5 }} value={override} onChange={(e) => setOverride(e.target.value)} onBlur={() => { if (override !== (i.dueOverride ?? "")) onOverride(override); }} aria-label={`Override due date for ${i.title}`} title={i.dueDate ? `Computed ${i.dueDate}; set a date to override` : "Set a due date"} />
          </label>
          <select className="input" style={{ width: 110, padding: "3px 6px", fontSize: 12.5 }} value={i.status} onChange={(e) => onStatus(e.target.value)} aria-label={`Status for ${i.title}`} disabled={rowBusy}>
            {STATUSES.map((s) => <option key={s} value={s}>{s === "na" ? "N/A" : s}</option>)}
          </select>
          <input className="input" style={{ flex: 1, minWidth: 160, padding: "3px 8px", fontSize: 12.5 }} placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (notes !== (i.notes ?? "")) onNotes(notes); }} aria-label={`Notes for ${i.title}`} />
        </div>
        {(i.task || i.document) && (
          <div className="text-muted" style={{ fontSize: 12.5, marginTop: 5, display: "flex", gap: 10, flexWrap: "wrap" }}>
            {i.task && <span>Draft task{i.task.syncedToFub ? " · synced to FUB" : " · awaiting approval on the Follow Up Boss screen"}{i.task.dueAt ? ` · due ${i.task.dueAt}` : ""}</span>}
            {i.document && <span>Attached: {i.document.filename}</span>}
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {i.kind === "document" && (
          <>
            <input ref={fileRef} type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onAttach(f); e.target.value = ""; }} aria-label={`Attach file to ${i.title}`} />
            <button className="btn btn-secondary" style={{ fontSize: 13, padding: "5px 10px" }} onClick={() => fileRef.current?.click()} disabled={rowBusy}>{i.document ? "Replace" : "Attach"}</button>
          </>
        )}
        {(open || i.taskId) && <button className="btn btn-ghost" style={{ fontSize: 13, padding: "5px 10px" }} onClick={onPush} disabled={rowBusy || !!i.taskId} title="Queues a local draft task; you approve the push on the Follow Up Boss screen">{i.taskId ? "Task queued" : "Push to FUB"}</button>}
      </div>
    </div>
  );
}
