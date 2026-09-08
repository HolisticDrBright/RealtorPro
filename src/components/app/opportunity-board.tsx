"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { filterOpportunities, OFF_MARKET_KINDS, OPPORTUNITY_STATUSES } from "@/lib/opportunities";
import { api, label, toast, useApi, useLookups } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

interface Opp { id: string; address: string; area: string | null; kind: string; expectedPrice: number | null; beds: number | null; baths: number | null; sqft: number | null; propertyType: string | null; sourceAgent: string | null; contactId: string | null; status: string; notes: string | null }
interface Match { candidateId: string; buyerName: string | null; temperature: string; score: number; reasons: string[]; concerns: string[]; buyerId: string }
const KINDS = ["all", "off_market", "coming_soon", "pocket_listing", "tear_down", "investment"];

export function OpportunityBoard({ offMarketOnly = false }: { offMarketOnly?: boolean }) {
  const [kind, setKind] = useState("all");
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const focus = useSearchParams().get("focus");
  const { data, loading, error, reload } = useApi<{ items: Opp[] }>(`/api/opportunities?limit=1000${offMarketOnly ? "&kind=off_market,pocket_listing" : ""}`);
  const matches = useApi<{ matches: Match[] }>("/api/match");
  const lk = useLookups();
  const crud = useCrud("opportunities");
  const rows = filterOpportunities(data?.items ?? [], { offMarketOnly, kind, status, query, focus });
  const add = () => crud.openNew({ kind: offMarketOnly ? "off_market" : kind === "all" ? "off_market" : kind });
  const mFor = (id: string) => (matches.data?.matches ?? []).filter((m) => m.candidateId === id);
  return (
    <div className="fade-in">
      <PageHeader title={offMarketOnly ? "Off-Market" : "Property Opportunities"} sub={offMarketOnly ? "Track private property leads, sources and next steps." : "Off-market · coming soon · pockets · tear-downs · investments"}>
        <Link href={offMarketOnly ? "/opportunities" : "/off-market"} className="btn">{offMarketOnly ? "All opportunities" : "Off-Market tab"}</Link>
        <button className="btn btn-primary" onClick={add}>{offMarketOnly ? "+ Off-market lead" : "+ Opportunity"}</button>
      </PageHeader>
      {offMarketOnly && <p className="text-[13px] text-ink-3 mb-4">Off-market and pocket-listing records share the same data as Opportunities. Add leads yourself or approve imports from your connected notes. No automatic scraping or outreach. Confirm availability and permission to share before marketing a property.</p>}
      <div className="flex flex-wrap gap-2 mb-4">
        <input className="input max-w-sm" aria-label="Search property leads" placeholder="Search address, area, source or notes…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input w-40" aria-label="Lead type" value={kind} onChange={(e) => setKind(e.target.value)}>{(offMarketOnly ? ["all", ...OFF_MARKET_KINDS] : KINDS).map((k) => <option key={k} value={k}>{label(k)}</option>)}</select>
        <select className="input w-40" aria-label="Lead status filter" value={status} onChange={(e) => setStatus(e.target.value)}><option value="active">Active leads</option><option value="all">All statuses</option>{OPPORTUNITY_STATUSES.map((s) => <option key={s} value={s}>{s === "dead" ? "Archived / dead" : label(s)}</option>)}</select>
        {focus && <Link href={offMarketOnly ? "/off-market" : "/opportunities"} className="btn">Clear focused lead</Link>}
      </div>
      {error && <ErrorBox message={error} onRetry={reload} />}
      {loading && <Loading />}
      {!loading && !error && rows.length === 0 && <Empty title={offMarketOnly ? "No off-market leads to show" : "No opportunities to show"} body="Add a property lead, or change the search and filters. Archived leads remain available under All statuses." action={<button className="btn btn-sm" onClick={add}>{offMarketOnly ? "+ Off-market lead" : "+ Opportunity"}</button>} />}
      {matches.error && <ErrorBox message={`Buyer matches unavailable: ${matches.error}`} onRetry={matches.reload} />}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {!error && rows.map((o) => { const ms = mFor(o.id); return (
          <Card key={o.id} bodyClass="pt-4">
            <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="text-[15px] font-semibold truncate">{o.address}</div><div className="text-[12.5px] text-ink-3">{o.area}{o.propertyType ? ` · ${o.propertyType}` : ""}</div></div><Badge tone="gold">{label(o.kind)}</Badge><Badge tone={o.status}>{label(o.status)}</Badge></div>
            <div className="mt-2 text-[18px] font-semibold tnum">{fmtMoney(o.expectedPrice)} <span className="text-[12px] text-ink-3 font-normal">expected</span></div>
            <div className="text-[12.5px] text-ink-2 tnum">{[o.beds && `${o.beds} bd`, o.baths && `${o.baths} ba`, o.sqft && `${o.sqft.toLocaleString()} sqft`].filter(Boolean).join(" · ") || "Details TBD"}</div>
            <div className="text-[12.5px] text-ink-3 mt-1">Source: {o.sourceAgent ?? "—"}{o.contactId ? ` · ${lk.nameOf(o.contactId)}` : ""}</div>
            {o.notes && <div className="text-[13px] mt-2 whitespace-pre-wrap">{o.notes}</div>}
            <div className="mt-3 pt-3 border-t border-line-2"><div className="kicker mb-1.5">Buyer criteria matches {ms.length > 0 && <span className="text-gold-ink">· {ms.length}</span>}</div>{matches.loading ? <p className="text-[12.5px] text-ink-3">Checking criteria…</p> : matches.error ? <p className="text-[12.5px] text-ink-3">Matches could not be loaded.</p> : ms.length === 0 ? <div className="text-[12.5px] text-ink-3">No buyer criteria match yet.</div> : ms.map((m) => <details key={m.buyerId} className="py-1 text-[13px]"><summary className="cursor-pointer">{m.buyerName ?? "Buyer"} · Score {m.score} · {label(m.temperature)}</summary><p className="text-ink-3 mt-1">{m.reasons.join(" · ")}</p>{m.concerns.length > 0 && <p className="text-crit mt-1">Check: {m.concerns.join(" · ")}</p>}</details>)}</div>
            <div className="flex flex-wrap items-center gap-1 mt-3 pt-2 border-t border-line-2">
              <select className="input h-8 w-32 text-[12px]" value={o.status} onChange={async (e) => { const next = e.target.value; const r = await api.update("opportunities", o.id, { status: next }); toast(r.ok ? `→ ${label(next)}` : r.message ?? "Could not update status", r.ok ? "ok" : "err"); }} aria-label={`Status for ${o.address}`}>{OPPORTUNITY_STATUSES.map((s) => <option key={s} value={s}>{s === "dead" ? "Archived / dead" : label(s)}</option>)}</select>
              <button className="btn btn-ghost btn-sm" onClick={() => quickAdd("notes", { body: `${o.address}: `, contactId: o.contactId })}>Note</button>
              <button className="btn btn-ghost btn-sm" onClick={() => quickAdd("tasks", { title: `Follow up on ${o.address}`, contactId: o.contactId })}>+ Task</button>
              <span className="ml-auto"><RowMenu onEdit={() => crud.openEdit(o as unknown as Record<string, unknown>)} onDelete={() => crud.remove(o.id, o.address)} /></span>
            </div>
          </Card>
        ); })}
      </div>
      {(data?.items.length ?? 0) === 1000 && <p className="text-[12px] text-ink-3 mt-3">Showing the first 1,000 records; search applies to this loaded set.</p>}
      <p className="text-[12px] text-ink-3 mt-3">Buyer matches are criteria-based suggestions, not verified suitability or availability. Changing a lead to a different type may move it out of this tab; find it in All opportunities.</p>
      {crud.panel}
    </div>
  );
}
