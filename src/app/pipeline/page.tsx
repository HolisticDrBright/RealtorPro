"use client";

import Link from "next/link";
import { useState } from "react";
import { api, label, toast, useApi } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { fmtDate } from "@/lib/dates";
import { Avatar, Badge, Kpi, Loading, PageHeader } from "@/components/ui/primitives";
import { useCrud } from "@/components/app/crud";

interface Cardd { id: string; name: string; type: string; stage: string; stageOrder: number; estValue: number | null; estCommission: number | null; probability: number; nextAction: string | null; nextFollowUpAt: string | null; lastContactAt: string | null; phone: string | null; temperature: string | null }
interface Pipe { stages: string[]; cards: Cardd[]; totals: { totalVolume: number; weightedVolume: number; potentialGci: number; weightedGci: number; count: number } }

export default function PipelinePage() {
  const { data, loading } = useApi<Pipe>("/api/pipeline");
  const [drag, setDrag] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const crud = useCrud("contacts");
  async function move(id: string, stage: string, order: number) { const r = await api.update("contacts", id, { stage, stageOrder: order }); if (r.ok) toast(`Moved to ${label(stage)}`); }
  if (loading || !data) return <Loading rows={6} />;
  return (
    <div className="fade-in">
      <PageHeader title="Sales Pipeline" sub={`${data.totals.count} open opportunities`}>
        <input className="input w-56" placeholder="Filter by name…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter" />
        <button className="btn btn-primary" onClick={() => crud.openNew({ stage: "new_lead" })}>+ Lead</button>
      </PageHeader>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-5">
        <Kpi label="Total Pipeline Volume" value={fmtMoney(data.totals.totalVolume)} />
        <Kpi label="Weighted Pipeline Volume" value={fmtMoney(data.totals.weightedVolume)} sub="By probability" />
        <Kpi label="Potential GCI" value={fmtMoney(data.totals.potentialGci)} />
        <Kpi label="Weighted Potential GCI" value={fmtMoney(data.totals.weightedGci)} sub="By probability" />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {data.stages.map((st) => { const cards = data.cards.filter((c) => c.stage === st && (!q || c.name.toLowerCase().includes(q.toLowerCase()))); const vol = cards.reduce((a, c) => a + (c.estValue ?? 0), 0); return (
          <div key={st} className="w-[236px] shrink-0 rounded-xl bg-zinc-100/70 p-2 flex flex-col" onDragOver={(e) => e.preventDefault()} onDrop={() => { if (drag) { move(drag, st, cards.length); setDrag(null); } }}>
            <div className="px-2 py-1.5"><div className="flex items-center"><span className="kicker">{label(st)}</span><span className="ml-auto text-[11.5px] text-ink-3 tnum">{cards.length}</span></div><div className="text-[11.5px] text-ink-3 tnum">{fmtMoney(vol, true)}</div></div>
            <div className="space-y-2 min-h-[80px] flex-1">
              {cards.map((c, i) => (
                <div key={c.id} draggable onDragStart={() => setDrag(c.id)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.stopPropagation(); if (drag && drag !== c.id) { move(drag, st, i); setDrag(null); } }} className={`card p-3 cursor-grab ${drag === c.id ? "dragging" : ""}`}>
                  <div className="flex items-center gap-2"><Avatar name={c.name} size={26} /><Link href={`/contacts/${c.id}`} className="text-[13px] font-medium truncate hover:underline">{c.name}</Link>{c.temperature === "hot" && <span className="text-crit text-[10px]">●</span>}</div>
                  <div className="flex items-center gap-2 mt-2 text-[12px]"><Badge tone={c.type}>{label(c.type)}</Badge><span className="ml-auto tnum text-ink-3">{c.probability}%</span></div>
                  <div className="mt-1.5 text-[13px] font-semibold tnum">{fmtMoney(c.estValue, true)} <span className="text-ink-3 font-normal text-[11.5px]">· {fmtMoney(c.estCommission, true)} GCI</span></div>
                  {c.nextAction && <div className="text-[11.5px] text-ink-2 mt-1 truncate">→ {c.nextAction}</div>}
                  <div className="text-[11px] text-ink-3 mt-1 tnum">Follow-up {fmtDate(c.nextFollowUpAt)}</div>
                </div>
              ))}
            </div>
          </div>
        ); })}
      </div>
      {crud.panel}
    </div>
  );
}
