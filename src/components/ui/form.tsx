"use client";

import { useEffect, useState } from "react";
import { api, toast, useLookups, fullName } from "@/lib/client";
import { SlideOver } from "./primitives";

/**
 * Schema-driven record form used by every "+ Add" / edit slide-over. Field
 * configs live in `src/components/app/entities.ts`; this renders them, posts
 * to the generic API, and surfaces validation messages inline.
 */

export type FieldType = "text" | "number" | "money" | "select" | "date" | "time" | "datetime" | "textarea" | "contact" | "property" | "transaction" | "list" | "checkbox" | "percent";
export interface Field { name: string; label: string; type?: FieldType; options?: { value: string; label: string }[] | readonly string[]; placeholder?: string; required?: boolean; half?: boolean; help?: string; default?: unknown }

export function RecordForm({ entity, fields, initial, onDone, submitLabel }: { entity: string; fields: Field[]; initial?: Record<string, unknown> | null; onDone: (item: Record<string, unknown>) => void; submitLabel?: string }) {
  const editing = !!initial?.id;
  const [values, setValues] = useState<Record<string, unknown>>(() => Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? f.default ?? (f.type === "list" ? [] : f.type === "checkbox" ? false : "")])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lk = useLookups();
  const tx = useLookups(); void tx;

  useEffect(() => { setValues(Object.fromEntries(fields.map((f) => [f.name, initial?.[f.name] ?? f.default ?? (f.type === "list" ? [] : f.type === "checkbox" ? false : "")]))); }, [initial, fields]);

  const set = (k: string, v: unknown) => setValues((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const body: Record<string, unknown> = {};
    for (const f of fields) { const v = values[f.name]; if (v === "" || v === undefined) { if (editing) body[f.name] = null; continue; } body[f.name] = v; }
    if (!editing) for (const k of Object.keys(body)) if (body[k] === null) delete body[k];
    const res = editing ? await api.update(entity, String(initial!.id), body) : await api.create(entity, body);
    setBusy(false);
    if (!res.ok) { setError(res.message ?? "Could not save."); return; }
    toast(editing ? "Saved" : "Added");
    onDone((res.data as { item: Record<string, unknown> }).item);
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-x-4 gap-y-4" noValidate>
      {fields.map((f) => {
        const v = values[f.name];
        const id = `f-${entity}-${f.name}`;
        const wrap = f.half ? "" : "col-span-2";
        const common = { id, className: "input", value: typeof v === "string" || typeof v === "number" ? String(v) : "", onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => set(f.name, e.target.value), placeholder: f.placeholder };
        let control: React.ReactNode;
        switch (f.type) {
          case "textarea": control = <textarea {...common} />; break;
          case "select": control = <select {...common}><option value="">—</option>{(f.options ?? []).map((o) => typeof o === "string" ? <option key={o} value={o}>{o.replace(/_/g, " ")}</option> : <option key={o.value} value={o.value}>{o.label}</option>)}</select>; break;
          case "contact": control = <select {...common}><option value="">— none —</option>{lk.contacts.map((c) => <option key={c.id} value={c.id}>{fullName(c)} · {c.type.replace(/_/g, " ")}</option>)}</select>; break;
          case "property": control = <select {...common}><option value="">— none —</option>{lk.properties.map((p) => <option key={p.id} value={p.id}>{p.address}, {p.city}</option>)}</select>; break;
          case "transaction": control = <TxSelect {...common} />; break;
          case "number": case "money": case "percent": control = <div className="relative">{f.type === "money" && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 text-[13px]">$</span>}<input {...common} type="text" inputMode="decimal" className={`input ${f.type === "money" ? "pl-7" : ""} tnum`} />{f.type === "percent" && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 text-[13px]">%</span>}</div>; break;
          case "date": control = <input {...common} type="date" />; break;
          case "time": control = <input {...common} type="time" />; break;
          case "datetime": control = <input {...common} type="datetime-local" value={typeof v === "string" ? v.slice(0, 16) : ""} />; break;
          case "list": control = <input id={id} className="input" value={Array.isArray(v) ? v.join(", ") : String(v ?? "")} placeholder={f.placeholder ?? "Comma-separated"} onChange={(e) => set(f.name, e.target.value.split(",").map((x) => x.trim()).filter(Boolean))} />; break;
          case "checkbox": control = <label className="inline-flex items-center gap-2 h-9 text-[13.5px]"><input id={id} type="checkbox" checked={!!v} onChange={(e) => set(f.name, e.target.checked)} />{f.help}</label>; break;
          default: control = <input {...common} type="text" />;
        }
        return <div key={f.name} className={wrap}><label htmlFor={id} className="label">{f.label}{f.required && <span className="text-crit"> *</span>}</label>{control}{f.help && f.type !== "checkbox" && <div className="text-[11.5px] text-ink-3 mt-1">{f.help}</div>}</div>;
      })}
      {error && <div role="alert" className="col-span-2 rounded-lg bg-crit-soft text-crit px-3 py-2 text-[12.5px]">{error}</div>}
      <div className="col-span-2 flex justify-end gap-2 pt-2"><button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : submitLabel ?? (editing ? "Save changes" : "Add")}</button></div>
    </form>
  );
}

function TxSelect(props: { id: string; className: string; value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void }) {
  const [items, setItems] = useState<{ id: string; propertyId: string; status: string; purchasePrice: number }[]>([]);
  const lk = useLookups();
  useEffect(() => { fetch("/api/transactions?status=escrow,closed").then((r) => r.json()).then((j) => setItems(j.items ?? [])).catch(() => {}); }, []);
  return <select {...props}><option value="">— none —</option>{items.map((t) => <option key={t.id} value={t.id}>{lk.addressOf(t.propertyId) ?? t.id} · {t.status}</option>)}</select>;
}

/** Convenience: a slide-over containing a record form. */
export function FormPanel({ open, onClose, entity, fields, initial, title, onSaved }: { open: boolean; onClose: () => void; entity: string; fields: Field[]; initial?: Record<string, unknown> | null; title: string; onSaved?: (item: Record<string, unknown>) => void }) {
  return <SlideOver open={open} onClose={onClose} title={title}>{open && <RecordForm entity={entity} fields={fields} initial={initial} onDone={(item) => { onSaved?.(item); onClose(); }} />}</SlideOver>;
}
