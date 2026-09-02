"use client";

import Link from "next/link";
import { useState } from "react";
import { api, label, telHref, toast, useApi, useLookups } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { Avatar, Badge, Card, Empty, Loading, PageHeader, Segmented, Table, type Column } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

interface Seller { id: string; contactId: string; propertyAddress: string | null; city: string | null; estimatedValue: number | null; expectedListPrice: number | null; timeline: string | null; motivation: string | null; listingAppointmentAt: string | null; probability: number; stage: string; notes: string | null }
const STAGES = ["lead", "contacted", "appointment_scheduled", "preparing_home", "agreement_signed", "coming_soon", "active", "sold"];

export default function SellersPage() {
  const [mode, setMode] = useState<"board" | "table">("board");
  const [q, setQ] = useState("");
  const { data, loading } = useApi<{ items: Seller[] }>("/api/sellers?limit=1000");
  const lk = useLookups();
  const crud = useCrud("sellers");
  const [drag, setDrag] = useState<string | null>(null);
  const rows = data?.items ?? [];
  const pipelineValue = rows.filter((s) => s.stage !== "sold").reduce((a, s) => a + (s.expectedListPrice ?? s.estimatedValue ?? 0), 0);
  const weighted = rows.filter((s) => s.stage !== "sold").reduce((a, s) => a + ((s.expectedListPrice ?? s.estimatedValue ?? 0) * s.probability) / 100, 0);

  async function move(id: string, stage: string) { const r = await api.update("sellers", id, { stage }); if (r.ok) toast(`Moved to ${label(stage)}`); }
  const columns: Column<Seller>[] = [
    { key: "name", label: "Seller", sort: (r) => lk.nameOf(r.contactId), render: (r) => <div className="flex items-center gap-2"><Avatar name={lk.nameOf(r.contactId)} src={lk.contactOf(r.contactId)?.photoUrl} size={28} /><div><Link href={`/contacts/${r.contactId}`} className="font-medium hover:underline">{lk.nameOf(r.contactId)}</Link><div className="text-[12px] text-ink-3 tnum"><a href={telHref(lk.contactOf(r.contactId)?.phone)} className="link">{lk.contactOf(r.contactId)?.phone}</a></div></div></div> },
    { key: "propertyAddress", label: "Property", render: (r) => <div><div>{r.propertyAddress ?? "—"}</div><div className="text-[12px] text-ink-3">{r.city}</div></div> },
    { key: "estimatedValue", label: "Est. value", align: "right", render: (r) => fmtMoney(r.estimatedValue) },
    { key: "expectedListPrice", label: "Expected list", align: "right", render: (r) => fmtMoney(r.expectedListPrice) },
    { key: "stage", label: "Stage", render: (r) => <Badge tone={r.stage === "active" ? "active" : r.stage === "sold" ? "closed" : "neutral"}>{label(r.stage)}</Badge> },
    { key: "probability", label: "Prob.", align: "right", render: (r) => `${r.probability}%` },
    { key: "timeline", label: "Timeline" },
    { key: "listingAppointmentAt", label: "Appointment", render: (r) => fmtDateTime(r.listingAppointmentAt) },
    { key: "lastContact", label: "Last contact", sort: (r) => lk.contactOf(r.contactId)?.lastContactAt, render: (r) => fmtDate(lk.contactOf(r.contactId)?.lastContactAt) },
    { key: "actions", label: "", render: (r) => <RowMenu onEdit={() => crud.openEdit(r as unknown as Record<string, unknown>)} onDelete={() => crud.remove(r.id, `${lk.nameOf(r.contactId)}'s seller record`)} /> },
  ];

  return (
    <div className="fade-in">
      <PageHeader title="Seller Pipeline" sub={<span className="tnum">{rows.filter((s) => s.stage !== "sold").length} potential sellers · {fmtMoney(pipelineValue, true)} expected volume · {fmtMoney(weighted, true)} weighted</span>}>
        <input className="input w-56" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter sellers" />
        <Segmented value={mode} onChange={setMode} options={[{ value: "board", label: "Stages" }, { value: "table", label: "Table" }]} />
        <button className="btn btn-primary" onClick={() => crud.openNew()}>+ Seller</button>
      </PageHeader>
      {loading && <Loading />}
      {!loading && rows.length === 0 && <Empty title="No potential sellers yet" body="Track every homeowner who might list: value, timeline, motivation and the appointment." action={<button className="btn btn-sm" onClick={() => crud.openNew()}>+ Seller</button>} />}
      {mode === "board" && rows.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {STAGES.map((st) => { const cards = rows.filter((s) => s.stage === st && (!q || `${lk.nameOf(s.contactId)} ${s.propertyAddress}`.toLowerCase().includes(q.toLowerCase()))); return (
            <div key={st} className="w-[250px] shrink-0 rounded-xl bg-zinc-100/70 p-2" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) { move(drag, st); setDrag(null); } }}>
              <div className="flex items-center px-2 py-1.5"><span className="kicker">{label(st)}</span><span className="ml-auto text-[11.5px] text-ink-3 tnum">{cards.length}</span></div>
              <div className="space-y-2 min-h-[60px]">
                {cards.map((s) => <div key={s.id} draggable onDragStart={() => setDrag(s.id)} className={`card p-3 cursor-grab ${drag === s.id ? "dragging" : ""}`} onClick={() => crud.openEdit(s as unknown as Record<string, unknown>)}>
                  <div className="flex items-center gap-2"><Avatar name={lk.nameOf(s.contactId)} src={lk.contactOf(s.contactId)?.photoUrl} size={26} /><span className="text-[13px] font-medium truncate">{lk.nameOf(s.contactId)}</span><span className="ml-auto text-[11px] text-ink-3 tnum">{s.probability}%</span></div>
                  <div className="text-[12.5px] mt-1.5 truncate">{s.propertyAddress ?? "—"}{s.city ? `, ${s.city}` : ""}</div>
                  <div className="text-[13px] font-semibold tnum mt-0.5">{fmtMoney(s.expectedListPrice ?? s.estimatedValue)}</div>
                  <div className="text-[11.5px] text-ink-3 mt-1 truncate">{[s.timeline, s.motivation].filter(Boolean).join(" · ")}</div>
                  {s.listingAppointmentAt && <div className="text-[11.5px] text-gold-ink mt-1">Appt {fmtDateTime(s.listingAppointmentAt)}</div>}
                </div>)}
              </div>
            </div>
          ); })}
        </div>
      )}
      {mode === "table" && rows.length > 0 && <Card><Table rows={rows} columns={columns} filter={q} defaultSort={{ key: "probability", dir: "desc" }} onRow={(r) => crud.openEdit(r as unknown as Record<string, unknown>)} /></Card>}
      <div className="mt-3 text-[12px] text-ink-3">Tip: drag a card between stages. Once a seller signs, add the listing with <button className="link" onClick={() => quickAdd("listings")}>+ Listing</button>.</div>
      {crud.panel}
    </div>
  );
}
