"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, label, telHref, toast, useApi, useLookups, useQueryParam } from "@/lib/client";
import { estCommission, fmtMoney, pricePerSqft } from "@/lib/calc";
import { daysSince, fmtDate } from "@/lib/dates";
import { Badge, Card, Empty, Loading, PageHeader, PropertyPhoto, Segmented, SlideOver } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

interface Listing { id: string; propertyId: string; sellerContactId: string | null; listPrice: number; status: string; listedAt: string | null; showings: number; offers: number; openHouses: number; commissionPct: number; nextAction: string | null; notes: string | null }
const STATUSES = ["coming_soon", "off_market", "active", "price_improvement", "offer_received", "in_negotiation", "in_escrow", "closed", "withdrawn"];

export default function ListingsPage() {
  const qf = useQueryParam("focus");
  const [status, setStatus] = useState<string>("live");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => { if (qf) setOpen(qf); }, [qf]);
  const { data, loading } = useApi<{ items: Listing[] }>("/api/listings?limit=1000");
  const lk = useLookups();
  const crud = useCrud("listings");
  const props = useCrud("properties");
  const matches = useApi<{ matches: { candidateId: string; buyerName: string | null; score: number; kind: string }[] }>("/api/match");
  const rows = useMemo(() => (data?.items ?? []).filter((l) => status === "all" ? true : status === "live" ? !["closed", "withdrawn", "in_escrow"].includes(l.status) : l.status === status).filter((l) => !q || `${lk.addressOf(l.propertyId)} ${lk.propertyOf(l.propertyId)?.city} ${lk.nameOf(l.sellerContactId)}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => b.listPrice - a.listPrice), [data, status, q, lk]);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, (data?.items ?? []).filter((l) => l.status === s).length]));
  const current = data?.items.find((l) => l.id === open) ?? null;
  const matchCount = (id: string) => matches.data?.matches.filter((m) => m.candidateId === id).length ?? 0;

  async function setStatusOf(l: Listing, s: string) { const r = await api.update("listings", l.id, { status: s }); if (r.ok) toast(s === "in_escrow" ? "Escrow opened — transaction and timeline created" : `Status → ${label(s)}`); }

  return (
    <div className="fade-in">
      <PageHeader title="Listings" sub={`${rows.length} shown · ${fmtMoney(rows.reduce((a, l) => a + l.listPrice, 0), true)} · est. GCI ${fmtMoney(rows.reduce((a, l) => a + estCommission(l.listPrice, l.commissionPct), 0), true)}`}>
        <input className="input w-52" placeholder="Filter by address, seller…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter listings" />
        <select className="input w-48" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="live">Live (not closed)</option><option value="all">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{label(s)} ({counts[s]})</option>)}</select>
        <button className="btn" onClick={() => props.openNew()}>+ Property</button>
        <button className="btn btn-primary" onClick={() => crud.openNew({ listedAt: new Date().toISOString().slice(0, 10) })}>+ Listing</button>
      </PageHeader>
      {loading && <Loading />}
      {!loading && rows.length === 0 && <Empty title="No listings match" body="Add a property first, then a listing on it. Coming-soon and off-market listings count toward pipeline value." action={<button className="btn btn-sm" onClick={() => crud.openNew()}>+ Listing</button>} />}
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {rows.map((l) => { const p = lk.propertyOf(l.propertyId); const dom = l.listedAt ? daysSince(l.listedAt) ?? 0 : 0; const n = matchCount(l.id); return (
          <div key={l.id} className="card overflow-hidden cursor-pointer hover:border-ink-3 transition-colors" onClick={() => setOpen(l.id)}>
            <PropertyPhoto src={p?.photoUrl} address={p?.address ?? ""} size="lg" className="!rounded-none" />
            <div className="p-4">
              <div className="flex items-start gap-2"><div className="min-w-0 flex-1"><div className="text-[15px] font-semibold truncate">{p?.address}</div><div className="text-[12.5px] text-ink-3">{p?.city} {p?.zip}</div></div><Badge tone={l.status}>{label(l.status)}</Badge></div>
              <div className="mt-2 flex items-baseline gap-2"><span className="text-[20px] font-semibold tnum tracking-tight">{fmtMoney(l.listPrice)}</span><span className="text-[12px] text-ink-3 tnum">{pricePerSqft(l.listPrice, p?.sqft) ? `$${pricePerSqft(l.listPrice, p?.sqft)?.toLocaleString()}/sqft` : ""}</span></div>
              <div className="text-[12.5px] text-ink-2 tnum">{p?.beds} bd · {p?.baths} ba · {p?.sqft?.toLocaleString()} sqft{p?.lotSqft ? ` · ${p.lotSqft.toLocaleString()} lot` : ""}</div>
              <div className="grid grid-cols-4 gap-2 mt-3 text-center text-[12px]"><div><div className="font-semibold tnum">{dom < 0 ? `in ${-dom}d` : dom}</div><div className="text-ink-3">{dom < 0 ? "Launch" : "DOM"}</div></div><div><div className="font-semibold tnum">{l.showings}</div><div className="text-ink-3">Showings</div></div><div><div className="font-semibold tnum">{l.offers}</div><div className="text-ink-3">Offers</div></div><div><div className="font-semibold tnum">{l.openHouses}</div><div className="text-ink-3">Open</div></div></div>
              <div className="mt-3 text-[12.5px] flex items-center gap-2"><span className="text-ink-3">Next:</span><span className="truncate flex-1">{l.nextAction ?? "—"}</span>{n > 0 && <Badge tone="gold">{n} buyer match{n === 1 ? "" : "es"}</Badge>}</div>
            </div>
          </div>
        ); })}
      </div>

      <SlideOver open={!!current} onClose={() => setOpen(null)} title={current ? lk.addressOf(current.propertyId) ?? "Listing" : ""} wide>
        {current && (() => { const l = current; const p = lk.propertyOf(l.propertyId); const seller = lk.contactOf(l.sellerContactId); const ms = matches.data?.matches.filter((m) => m.candidateId === l.id) ?? []; return (
          <div className="space-y-5">
            <PropertyPhoto src={p?.photoUrl} address={p?.address ?? ""} size="lg" />
            <div className="flex items-start gap-3"><div className="flex-1"><div className="text-[20px] font-semibold tnum">{fmtMoney(l.listPrice)} <span className="text-[13px] text-ink-3 font-normal">{pricePerSqft(l.listPrice, p?.sqft) ? `$${pricePerSqft(l.listPrice, p?.sqft)?.toLocaleString()}/sqft` : ""}</span></div><div className="text-[13px] text-ink-2">{p?.beds} bd · {p?.baths} ba · {p?.sqft?.toLocaleString()} sqft · {p?.lotSqft?.toLocaleString()} lot · {p?.propertyType} · built {p?.yearBuilt ?? "—"}</div>{p?.view && <div className="text-[13px] text-ink-2">{p.view}</div>}</div><Badge tone={l.status}>{label(l.status)}</Badge></div>
            <div><div className="kicker mb-1.5">Status</div><div className="flex gap-1.5 flex-wrap">{STATUSES.map((s) => <button key={s} className={`btn btn-sm ${l.status === s ? "btn-primary" : ""}`} onClick={() => setStatusOf(l, s)}>{label(s)}</button>)}</div><div className="text-[11.5px] text-ink-3 mt-1.5">Moving to In Escrow creates the transaction and its deadline timeline automatically.</div></div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">
              {[["Listing date", fmtDate(l.listedAt, { month: "short", day: "numeric", year: "numeric" })], ["Days on market", l.listedAt ? daysSince(l.listedAt) : "—"], ["Showings", l.showings], ["Offers", l.offers], ["Open houses", l.openHouses], ["Commission", `${l.commissionPct}%`], ["Estimated commission", fmtMoney(estCommission(l.listPrice, l.commissionPct))], ["Next action", l.nextAction]].map(([k, v]) => <div key={String(k)} className="flex justify-between gap-3 border-b border-line-2 py-1.5"><dt className="text-ink-3">{k}</dt><dd className="font-medium text-right">{v ?? "—"}</dd></div>)}
            </dl>
            <div className="rounded-lg bg-ground p-4"><div className="kicker mb-1">Seller</div>{seller ? <div className="text-[13.5px]"><Link href={`/contacts/${seller.id}`} className="font-medium hover:underline">{lk.nameOf(seller.id)}</Link> · <a className="link tnum" href={telHref(seller.phone)}>{seller.phone}</a>{seller.email ? ` · ${seller.email}` : ""}</div> : <div className="text-ink-3 text-[13px]">No seller linked.</div>}</div>
            <div className="flex gap-2 flex-wrap"><button className="btn" onClick={() => api.update("listings", l.id, { showings: l.showings + 1 })}>+1 showing</button><button className="btn" onClick={() => api.update("listings", l.id, { openHouses: l.openHouses + 1 })}>+1 open house</button><button className="btn" onClick={() => quickAdd("offers", { propertyId: l.propertyId, listPrice: l.listPrice })}>Log offer</button><button className="btn" onClick={() => quickAdd("appointments", { title: `Showing — ${p?.address}`, type: "showing", propertyId: l.propertyId, location: p?.address })}>Schedule showing</button><button className="btn" onClick={() => quickAdd("notes", { propertyId: l.propertyId })}>Note</button><span className="ml-auto"><RowMenu onEdit={() => crud.openEdit(l as unknown as Record<string, unknown>)} onDelete={() => crud.remove(l.id, p?.address ?? "listing")} extra={<button className="btn btn-ghost btn-sm" onClick={() => props.openEdit(p as unknown as Record<string, unknown>)}>Edit property</button>} /></span></div>
            <div><div className="kicker mb-2">Buyer matches</div>{ms.length === 0 ? <div className="text-ink-3 text-[13px]">No active buyer matches this listing yet.</div> : ms.map((m) => <div key={m.buyerName ?? ""} className="flex items-center gap-3 py-1.5 border-b border-line-2 text-[13px]"><span className="w-8 h-8 grid place-items-center rounded bg-ink text-white text-[12px] font-semibold tnum">{m.score}</span>{m.buyerName}</div>)}</div>
            {l.notes && <div><div className="kicker mb-1">Notes</div><p className="text-[13.5px] whitespace-pre-wrap">{l.notes}</p></div>}
          </div>
        ); })()}
      </SlideOver>
      {crud.panel}{props.panel}
    </div>
  );
}
