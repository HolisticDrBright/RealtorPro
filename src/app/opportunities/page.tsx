"use client";

import { useMemo, useState } from "react";
import { api, label, toast, useApi, useLookups } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { Badge, Card, Empty, Loading, PageHeader, Segmented } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

interface Opp { id: string; address: string; area: string | null; kind: string; expectedPrice: number | null; beds: number | null; baths: number | null; sqft: number | null; propertyType: string | null; sourceAgent: string | null; contactId: string | null; status: string; notes: string | null }
interface Match { candidateId: string; buyerName: string | null; temperature: string; score: number; reasons: string[]; concerns: string[]; buyerId: string }
const KINDS = ["all", "off_market", "coming_soon", "pocket_listing", "tear_down", "investment"];

export default function OpportunitiesPage() {
  const [kind, setKind] = useState("all");
  const { data, loading } = useApi<{ items: Opp[] }>("/api/opportunities?limit=1000");
  const matches = useApi<{ matches: Match[] }>("/api/match");
  const lk = useLookups();
  const crud = useCrud("opportunities");
  const rows = useMemo(() => (data?.items ?? []).filter((o) => (kind === "all" || o.kind === kind) && o.status !== "dead"), [data, kind]);
  const mFor = (id: string) => (matches.data?.matches ?? []).filter((m) => m.candidateId === id);
  return (
    <div className="fade-in">
      <PageHeader title="Property Opportunities" sub="Off-market · coming soon · pockets · tear-downs · investments — matched against buyer criteria">
        <Segmented value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: k === "all" ? "All" : label(k) }))} />
        <button className="btn btn-primary" onClick={() => crud.openNew()}>+ Opportunity</button>
      </PageHeader>
      {loading && <Loading />}
      {!loading && rows.length === 0 && <Empty title="No opportunities yet" body="Log what you hear: a seller who may list quietly, a pocket listing from another agent, a lot worth a builder’s look." action={<button className="btn btn-sm" onClick={() => crud.openNew()}>+ Opportunity</button>} />}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {rows.map((o) => { const ms = mFor(o.id); return (
          <Card key={o.id} bodyClass="pt-4">
            <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="text-[15px] font-semibold truncate">{o.address}</div><div className="text-[12.5px] text-ink-3">{o.area}{o.propertyType ? ` · ${o.propertyType}` : ""}</div></div><Badge tone="gold">{label(o.kind)}</Badge><Badge tone={o.status}>{label(o.status)}</Badge></div>
            <div className="mt-2 text-[18px] font-semibold tnum">{fmtMoney(o.expectedPrice)} <span className="text-[12px] text-ink-3 font-normal">expected</span></div>
            <div className="text-[12.5px] text-ink-2 tnum">{[o.beds && `${o.beds} bd`, o.baths && `${o.baths} ba`, o.sqft && `${o.sqft.toLocaleString()} sqft`].filter(Boolean).join(" · ") || "Details TBD"}</div>
            <div className="text-[12.5px] text-ink-3 mt-1">Source: {o.sourceAgent ?? "—"}{o.contactId ? ` · ${lk.nameOf(o.contactId)}` : ""}</div>
            {o.notes && <div className="text-[13px] mt-2 whitespace-pre-wrap">{o.notes}</div>}
            <div className="mt-3 pt-3 border-t border-line-2"><div className="kicker mb-1.5">Buyer matches {ms.length > 0 && <span className="text-gold-ink">· {ms.length}</span>}</div>{ms.length === 0 ? <div className="text-[12.5px] text-ink-3">No buyer criteria match yet.</div> : ms.map((m) => <div key={m.buyerId} className="flex items-center gap-2 py-1 text-[13px]"><span className="w-7 h-7 grid place-items-center rounded bg-ink text-white text-[11.5px] font-semibold tnum">{m.score}</span><span className="font-medium">{m.buyerName}</span><Badge tone={m.temperature}>{m.temperature}</Badge><span className="text-[11.5px] text-ink-3 truncate ml-auto">{m.reasons[0]}</span></div>)}</div>
            <div className="flex items-center gap-1 mt-3 pt-2 border-t border-line-2">
              <select className="input h-8 w-32 text-[12px]" value={o.status} onChange={async (e) => { const r = await api.update("opportunities", o.id, { status: e.target.value }); if (r.ok) toast(`→ ${label(e.target.value)}`); }} aria-label="Status">{["new", "watching", "pursuing", "matched", "dead"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
              <button className="btn btn-ghost btn-sm" onClick={() => quickAdd("notes", { body: `${o.address}: ` })}>Note</button>
              <span className="ml-auto"><RowMenu onEdit={() => crud.openEdit(o as unknown as Record<string, unknown>)} onDelete={() => crud.remove(o.id, o.address)} /></span>
            </div>
          </Card>
        ); })}
      </div>
      {crud.panel}
    </div>
  );
}
