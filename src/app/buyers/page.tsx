"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, label, smsHref, telHref, toast, useApi, useLookups, useQueryParam } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { daysSince, fmtDate } from "@/lib/dates";
import { Avatar, Badge, Card, Empty, Loading, PageHeader, Segmented, SlideOver } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

interface Buyer { id: string; contactId: string; temperature: string; priority: string; priceMin: number | null; priceMax: number | null; targetAreas: string[]; minBeds: number | null; minBaths: number | null; minSqft: number | null; lotRequirements: string | null; propertyType: string | null; mustHaves: string[]; dealBreakers: string[]; financingType: string | null; preApprovalAmount: number | null; timeline: string | null; propertiesSent: number; propertiesToured: number; offersMade: number; status: string; notes: string | null }
interface Match { buyerId: string; buyerName: string | null; temperature: string; candidateId: string; kind: string; address: string; area: string | null; price: number | null; beds: number | null; baths: number | null; sqft: number | null; score: number; reasons: string[]; concerns: string[] }

const rank: Record<string, number> = { hot: 0, warm: 1, nurture: 2 };

export default function BuyersPage() {
  const qt = useQueryParam("tab");
  const [tab, setTab] = useState<"buyers" | "matches">("buyers");
  useEffect(() => { if (qt === "matches") setTab("matches"); }, [qt]);
  const [temp, setTemp] = useState<"all" | "hot" | "warm" | "nurture">("all");
  const [open, setOpen] = useState<Buyer | null>(null);
  const { data, loading } = useApi<{ items: Buyer[] }>("/api/buyers?status=active,paused&limit=1000");
  const matches = useApi<{ matches: Match[] }>(tab === "matches" || open ? "/api/match" : null);
  const lk = useLookups();
  const crud = useCrud("buyers");
  const rows = useMemo(() => [...(data?.items ?? [])].filter((b) => temp === "all" || b.temperature === temp).sort((a, b) => rank[a.temperature] - rank[b.temperature] || (lk.contactOf(a.contactId)?.lastContactAt ?? "").localeCompare(lk.contactOf(b.contactId)?.lastContactAt ?? "")), [data, temp, lk]);
  const counts = { all: data?.items.length ?? 0, hot: data?.items.filter((b) => b.temperature === "hot").length ?? 0, warm: data?.items.filter((b) => b.temperature === "warm").length ?? 0, nurture: data?.items.filter((b) => b.temperature === "nurture").length ?? 0 };

  async function setTemperature(b: Buyer, t: string) { const r = await api.update("buyers", b.id, { temperature: t }); if (r.ok) toast(`${lk.nameOf(b.contactId)} → ${t.toUpperCase()}`); }
  async function bumpCount(b: Buyer, key: "propertiesSent" | "propertiesToured") { await api.update("buyers", b.id, { [key]: b[key] + 1 }); }

  return (
    <div className="fade-in">
      <PageHeader title="Buyers" sub={`${counts.hot} hot · ${counts.warm} warm · ${counts.nurture} nurture`}>
        <Segmented value={tab} onChange={setTab} options={[{ value: "buyers", label: "Buyers" }, { value: "matches", label: "Buyer Match" }]} />
        {tab === "buyers" && <Segmented value={temp} onChange={setTemp} options={[{ value: "all", label: "All", count: counts.all }, { value: "hot", label: "Hot", count: counts.hot }, { value: "warm", label: "Warm", count: counts.warm }, { value: "nurture", label: "Nurture", count: counts.nurture }]} />}
        <button className="btn btn-primary" onClick={() => crud.openNew()}>+ Buyer</button>
      </PageHeader>

      {tab === "buyers" && (
        <>
          {loading && <Loading />}
          {!loading && rows.length === 0 && <Empty title="No buyers yet" body="Add a buyer profile with their criteria — the dashboard and Buyer Match use it to surface fits." action={<button className="btn btn-sm" onClick={() => crud.openNew()}>+ Buyer</button>} />}
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {rows.map((b) => { const c = lk.contactOf(b.contactId); const since = daysSince(c?.lastContactAt); return (
              <Card key={b.id} className="cursor-pointer hover:border-ink-3 transition-colors" bodyClass="pt-4">
                <div onClick={() => setOpen(b)}>
                  <div className="flex items-start gap-3">
                    <Avatar name={lk.nameOf(b.contactId)} src={c?.photoUrl} size={44} />
                    <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[15px] font-semibold truncate">{lk.nameOf(b.contactId)}</span><Badge tone={b.temperature}>{b.temperature}</Badge></div><div className="text-[12.5px] text-ink-3 truncate"><a className="link tnum" href={telHref(c?.phone)} onClick={(e) => e.stopPropagation()}>{c?.phone}</a>{c?.email ? ` · ${c.email}` : ""}</div></div>
                    <Badge tone={b.priority}>{b.priority}</Badge>
                  </div>
                  <div className="mt-3 text-[18px] font-semibold tnum tracking-tight">{fmtMoney(b.priceMin, true)} – {fmtMoney(b.priceMax, true)}</div>
                  <div className="text-[12.5px] text-ink-2 mt-0.5">{b.targetAreas?.join(", ") || "Any area"} · {[b.minBeds && `${b.minBeds}+ bd`, b.minBaths && `${b.minBaths}+ ba`, b.minSqft && `${b.minSqft.toLocaleString()}+ sqft`].filter(Boolean).join(" · ")}</div>
                  <div className="flex gap-1.5 flex-wrap mt-2">{b.mustHaves?.map((m) => <Badge key={m} tone="ok">✓ {m}</Badge>)}{b.dealBreakers?.map((m) => <Badge key={m} tone="critical">✕ {m}</Badge>)}</div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-[12px]"><div><div className="text-ink-3">Last contact</div><div className={`font-medium ${since != null && since >= 5 && b.temperature === "hot" ? "text-crit" : ""}`}>{fmtDate(c?.lastContactAt)}{since != null ? ` (${since}d)` : ""}</div></div><div><div className="text-ink-3">Next follow-up</div><div className="font-medium">{fmtDate(c?.nextFollowUpAt)}</div></div><div><div className="text-ink-3">Timeline</div><div className="font-medium truncate">{b.timeline ?? "—"}</div></div></div>
                  <div className="flex gap-4 mt-3 text-[12px] text-ink-3 tnum"><span>{b.propertiesSent} sent</span><span>{b.propertiesToured} toured</span><span>{b.offersMade} offers</span><span className="ml-auto">{b.financingType ?? ""}{b.preApprovalAmount ? ` · pre-approved ${fmtMoney(b.preApprovalAmount, true)}` : ""}</span></div>
                </div>
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-line-2">
                  <div className="inline-flex rounded-md border border-line p-0.5">{["hot", "warm", "nurture"].map((t) => <button key={t} className={`h-6 px-2 rounded text-[11px] font-semibold uppercase ${b.temperature === t ? "bg-ink text-white" : "text-ink-3 hover:text-ink"}`} onClick={() => setTemperature(b, t)}>{t}</button>)}</div>
                  <a className="btn btn-ghost btn-icon" href={telHref(c?.phone)} aria-label="Call">☎</a><a className="btn btn-ghost btn-icon" href={smsHref(c?.phone)} aria-label="Text">✉</a>
                  <button className="btn btn-ghost btn-sm" onClick={() => quickAdd("calls", { contactId: b.contactId })}>Schedule call</button>
                  <span className="ml-auto"><RowMenu onEdit={() => crud.openEdit(b as unknown as Record<string, unknown>)} onDelete={() => crud.remove(b.id, `${lk.nameOf(b.contactId)}'s buyer profile`)} /></span>
                </div>
              </Card>
            ); })}
          </div>
        </>
      )}

      {tab === "matches" && (
        <Card title="Buyer Match — active listings and opportunities vs. buyer criteria" bodyClass="!px-0">
          {!matches.data && <div className="px-5"><Loading /></div>}
          {matches.data && matches.data.matches.length === 0 && <div className="px-5"><Empty title="No matches yet" body="Matches appear when a listing or opportunity fits a buyer’s price, area, size and must-haves." /></div>}
          <table className="w-full"><thead><tr><th className="th pl-5">Score</th><th className="th">Buyer</th><th className="th">Property</th><th className="th">Why it fits</th><th className="th">Confirm</th><th className="th pr-5 text-right">Actions</th></tr></thead>
            <tbody>{matches.data?.matches.map((m) => <tr key={m.buyerId + m.candidateId} className="row-hover"><td className="td pl-5"><span className="inline-grid place-items-center w-11 h-11 rounded-lg bg-ink text-white font-semibold tnum">{m.score}</span></td><td className="td"><div className="font-medium">{m.buyerName}</div><Badge tone={m.temperature}>{m.temperature}</Badge></td><td className="td"><div className="font-medium">{m.address}</div><div className="text-[12px] text-ink-3">{[m.area, fmtMoney(m.price), m.beds && `${m.beds} bd`, m.baths && `${m.baths} ba`, m.sqft && `${m.sqft.toLocaleString()} sqft`].filter(Boolean).join(" · ")} · <Badge tone={m.kind === "listing" ? "active" : "gold"}>{label(m.kind)}</Badge></div></td><td className="td text-[12.5px]">{m.reasons.map((r) => <div key={r} className="text-ok">✓ {r}</div>)}</td><td className="td text-[12.5px] text-ink-2">{m.concerns.map((r) => <div key={r}>· {r}</div>)}</td><td className="td pr-5 text-right whitespace-nowrap"><button className="btn btn-ghost btn-sm" onClick={async () => { const b = data?.items.find((x) => x.id === m.buyerId); if (b) { await bumpCount(b, "propertiesSent"); toast("Marked as sent"); } }}>Mark sent</button><button className="btn btn-ghost btn-sm" onClick={() => quickAdd("appointments", { title: `Showing — ${m.address}`, type: "showing", contactId: data?.items.find((x) => x.id === m.buyerId)?.contactId, location: m.address })}>Schedule showing</button></td></tr>)}</tbody>
          </table>
        </Card>
      )}

      <SlideOver open={!!open} onClose={() => setOpen(null)} title={open ? `${lk.nameOf(open.contactId)} · Buyer profile` : ""} wide>
        {open && (() => { const b = data?.items.find((x) => x.id === open.id) ?? open; const c = lk.contactOf(b.contactId); return (
          <div className="space-y-5">
            <div className="flex items-center gap-4"><Avatar name={lk.nameOf(b.contactId)} src={c?.photoUrl} size={56} /><div><div className="text-[18px] font-semibold">{lk.nameOf(b.contactId)} <Badge tone={b.temperature}>{b.temperature}</Badge></div><div className="text-ink-3 text-[13px]"><a className="link" href={telHref(c?.phone)}>{c?.phone}</a> · {c?.email} · <Link href={`/contacts/${b.contactId}`} className="link">Open contact</Link></div></div><button className="btn ml-auto" onClick={() => crud.openEdit(b as unknown as Record<string, unknown>)}>Edit criteria</button></div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[13px]">
              {[["Price range", `${fmtMoney(b.priceMin)} – ${fmtMoney(b.priceMax)}`], ["Target areas", b.targetAreas?.join(", ")], ["Minimum bedrooms", b.minBeds], ["Minimum bathrooms", b.minBaths], ["Minimum sq ft", b.minSqft?.toLocaleString()], ["Lot requirements", b.lotRequirements], ["Property type", b.propertyType], ["Financing", b.financingType], ["Pre-approval", fmtMoney(b.preApprovalAmount)], ["Timeline", b.timeline], ["Properties sent / toured", `${b.propertiesSent} / ${b.propertiesToured}`], ["Offers made", b.offersMade], ["Last contact", fmtDate(c?.lastContactAt)], ["Next follow-up", fmtDate(c?.nextFollowUpAt)]].map(([k, v]) => <div key={String(k)} className="flex justify-between gap-3 border-b border-line-2 py-1.5"><dt className="text-ink-3">{k}</dt><dd className="font-medium text-right">{v || "—"}</dd></div>)}
            </dl>
            <div><div className="kicker mb-1">Must-haves</div><div className="flex gap-1.5 flex-wrap">{b.mustHaves?.length ? b.mustHaves.map((m) => <Badge key={m} tone="ok">{m}</Badge>) : <span className="text-ink-3 text-[13px]">None listed</span>}</div></div>
            <div><div className="kicker mb-1">Deal breakers</div><div className="flex gap-1.5 flex-wrap">{b.dealBreakers?.length ? b.dealBreakers.map((m) => <Badge key={m} tone="critical">{m}</Badge>) : <span className="text-ink-3 text-[13px]">None listed</span>}</div></div>
            {b.notes && <div><div className="kicker mb-1">Notes</div><p className="text-[13.5px] whitespace-pre-wrap">{b.notes}</p></div>}
            <div><div className="kicker mb-2">Matches</div>{(matches.data?.matches ?? []).filter((m) => m.buyerId === b.id).length === 0 ? <div className="text-ink-3 text-[13px]">No current listing or opportunity matches this criteria.</div> : (matches.data?.matches ?? []).filter((m) => m.buyerId === b.id).map((m) => <div key={m.candidateId} className="flex items-center gap-3 py-2 border-b border-line-2"><span className="w-9 h-9 grid place-items-center rounded-md bg-ink text-white text-[13px] font-semibold tnum">{m.score}</span><div className="min-w-0 flex-1"><div className="text-[13.5px] font-medium truncate">{m.address} <Badge tone={m.kind === "listing" ? "active" : "gold"}>{label(m.kind)}</Badge></div><div className="text-[12px] text-ink-3 truncate">{m.reasons.join(" · ")}</div></div><span className="tnum text-[13px]">{fmtMoney(m.price)}</span></div>)}</div>
            <div className="flex gap-2"><button className="btn" onClick={() => bumpCount(b, "propertiesSent")}>+1 sent</button><button className="btn" onClick={() => bumpCount(b, "propertiesToured")}>+1 toured</button><button className="btn" onClick={() => quickAdd("offers", { contactId: b.contactId })}>New offer</button><button className="btn" onClick={() => quickAdd("calls", { contactId: b.contactId })}>Schedule call</button></div>
          </div>
        ); })()}
      </SlideOver>
      {crud.panel}
    </div>
  );
}
