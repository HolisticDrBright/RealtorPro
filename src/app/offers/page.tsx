"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, label, toast, useApi, useLookups } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { fmtDate, ymd } from "@/lib/dates";
import { Badge, Card, Empty, Loading, PageHeader, Segmented, Table, type Column } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

interface Offer { id: string; contactId: string | null; propertyId: string | null; listPrice: number | null; offerPrice: number; submittedAt: string | null; sellerCounter: number | null; currentOffer: number | null; financing: string | null; downPayment: number | null; closingTimeline: string | null; contingencies: string[]; status: string; notes: string | null }
const STATUSES = ["preparing", "submitted", "countered", "accepted", "rejected", "backup", "withdrawn"];

export default function OffersPage() {
  const [view, setView] = useState<"open" | "all">("open");
  const { data, loading } = useApi<{ items: Offer[] }>("/api/offers?limit=1000");
  const lk = useLookups();
  const crud = useCrud("offers");
  const rows = useMemo(() => (data?.items ?? []).filter((o) => view === "all" || ["preparing", "submitted", "countered", "backup"].includes(o.status)), [data, view]);
  const columns: Column<Offer>[] = [
    { key: "buyer", label: "Buyer", sort: (r) => lk.nameOf(r.contactId), render: (r) => r.contactId ? <Link href={`/contacts/${r.contactId}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>{lk.nameOf(r.contactId)}</Link> : "—" },
    { key: "property", label: "Property", sort: (r) => lk.addressOf(r.propertyId), render: (r) => <div><div className="font-medium">{lk.addressOf(r.propertyId) ?? "—"}</div><div className="text-[12px] text-ink-3">{lk.propertyOf(r.propertyId)?.city}</div></div> },
    { key: "listPrice", label: "List", align: "right", render: (r) => fmtMoney(r.listPrice) },
    { key: "offerPrice", label: "Offer", align: "right", render: (r) => <div>{fmtMoney(r.offerPrice)}{r.listPrice ? <div className="text-[11.5px] text-ink-3">{Math.round((r.offerPrice / r.listPrice) * 100)}% of list</div> : null}</div> },
    { key: "sellerCounter", label: "Counter", align: "right", render: (r) => fmtMoney(r.sellerCounter) },
    { key: "currentOffer", label: "Current", align: "right", className: "font-semibold", render: (r) => fmtMoney(r.currentOffer ?? r.offerPrice) },
    { key: "financing", label: "Financing", render: (r) => <div>{r.financing ?? "—"}<div className="text-[11.5px] text-ink-3">{r.downPayment ? `${fmtMoney(r.downPayment, true)} down` : ""}{r.closingTimeline ? ` · ${r.closingTimeline}` : ""}</div></div> },
    { key: "contingencies", label: "Contingencies", render: (r) => <div className="flex gap-1 flex-wrap">{(r.contingencies ?? []).map((c) => <Badge key={c} tone="neutral">{c}</Badge>)}</div> },
    { key: "submittedAt", label: "Submitted", render: (r) => fmtDate(r.submittedAt) },
    { key: "status", label: "Status", render: (r) => <Badge tone={r.status}>{label(r.status)}</Badge> },
    { key: "actions", label: "", render: (r) => <RowMenu onEdit={() => crud.openEdit(r as unknown as Record<string, unknown>)} onDelete={() => crud.remove(r.id, "offer")} extra={<select className="input h-8 w-32 text-[12px]" value={r.status} onChange={async (e) => { const s = e.target.value; const r2 = await api.update("offers", r.id, { status: s, ...(s === "submitted" && !r.submittedAt ? { submittedAt: ymd() } : {}) }); if (r2.ok) toast(`Offer → ${label(s)}`); }} aria-label="Status">{STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>} /> },
  ];
  return (
    <div className="fade-in">
      <PageHeader title="Offers" sub={`${rows.length} ${view === "open" ? "open" : "total"}`}>
        <Segmented value={view} onChange={setView} options={[{ value: "open", label: "Open" }, { value: "all", label: "All" }]} />
        <button className="btn btn-primary" onClick={() => crud.openNew()}>+ Offer</button>
      </PageHeader>
      <Card>
        {loading ? <Loading /> : rows.length === 0 ? <Empty title="No offers to track" body="Log every offer you write or receive — price, counter, financing and contingencies — so nothing slips." action={<button className="btn btn-sm" onClick={() => crud.openNew()}>+ Offer</button>} /> : <Table rows={rows} columns={columns} defaultSort={{ key: "submittedAt", dir: "desc" }} onRow={(r) => crud.openEdit(r as unknown as Record<string, unknown>)} />}
        <div className="text-[12px] text-ink-3 mt-3">When an offer is accepted, open the escrow with <button className="link" onClick={() => quickAdd("transactions", { escrowOpenedAt: ymd() })}>+ Transaction</button> — the deadline timeline is created automatically.</div>
      </Card>
      {crud.panel}
    </div>
  );
}
