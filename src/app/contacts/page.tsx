"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { label, telHref, useApi, useQueryParam } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { daysUntil, fmtDate } from "@/lib/dates";
import { Avatar, Badge, Card, Empty, Loading, PageHeader, Segmented, Table, type Column } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";

interface Contact { id: string; firstName: string; lastName: string; photoUrl: string | null; phone: string | null; email: string | null; type: string; leadSource: string | null; tags: string[]; priceMin: number | null; priceMax: number | null; preferredAreas: string[]; stage: string; lastContactAt: string | null; nextFollowUpAt: string | null; homeAddress: string | null; archived: boolean }
const TYPES = ["all", "buyer", "seller", "past_client", "lead", "agent", "vendor", "sphere"] as const;

export default function ContactsPage() {
  const qf = useQueryParam("filter");
  const [type, setType] = useState<(typeof TYPES)[number]>("all");
  const [q, setQ] = useState("");
  const [onlyFollow, setOnlyFollow] = useState(false);
  useEffect(() => { if (qf === "followup") setOnlyFollow(true); }, [qf]);
  const { data, loading } = useApi<{ items: Contact[] }>("/api/contacts?archived=false&limit=1000");
  const crud = useCrud("contacts");
  const rows = useMemo(() => (data?.items ?? []).filter((c) => (type === "all" || c.type === type) && (!onlyFollow || (c.nextFollowUpAt && daysUntil(c.nextFollowUpAt) < 0))), [data, type, onlyFollow]);
  const counts = Object.fromEntries(TYPES.map((t) => [t, t === "all" ? data?.items.length ?? 0 : data?.items.filter((c) => c.type === t).length ?? 0]));
  const columns: Column<Contact>[] = [
    { key: "name", label: "Name", sort: (r) => `${r.lastName} ${r.firstName}`, render: (r) => <div className="flex items-center gap-2.5"><Avatar name={`${r.firstName} ${r.lastName}`} src={r.photoUrl} size={30} /><div><Link href={`/contacts/${r.id}`} className="font-medium hover:underline">{r.firstName} {r.lastName}</Link><div className="text-[12px] text-ink-3">{r.tags?.slice(0, 3).join(" · ")}</div></div></div> },
    { key: "type", label: "Type", render: (r) => <Badge tone={r.type}>{label(r.type)}</Badge> },
    { key: "phone", label: "Phone", render: (r) => <a className="link tnum" href={telHref(r.phone)} onClick={(e) => e.stopPropagation()}>{r.phone ?? "—"}</a> },
    { key: "email", label: "Email", render: (r) => r.email ? <a className="link" href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()}>{r.email}</a> : "—" },
    { key: "stage", label: "Stage", render: (r) => label(r.stage) },
    { key: "priceMax", label: "Price range", align: "right", render: (r) => r.priceMin || r.priceMax ? `${fmtMoney(r.priceMin, true)} – ${fmtMoney(r.priceMax, true)}` : "—" },
    { key: "preferredAreas", label: "Areas", render: (r) => r.preferredAreas?.join(", ") || "—" },
    { key: "leadSource", label: "Source", render: (r) => label(r.leadSource) },
    { key: "lastContactAt", label: "Last contact", render: (r) => fmtDate(r.lastContactAt) },
    { key: "nextFollowUpAt", label: "Next follow-up", render: (r) => <span className={r.nextFollowUpAt && daysUntil(r.nextFollowUpAt) < 0 ? "text-crit font-medium" : ""}>{fmtDate(r.nextFollowUpAt)}</span> },
    { key: "actions", label: "", render: (r) => <RowMenu onEdit={() => crud.openEdit(r as unknown as Record<string, unknown>)} onDelete={() => crud.remove(r.id, `${r.firstName} ${r.lastName}`)} /> },
  ];
  return (
    <div className="fade-in">
      <PageHeader title="Contacts" sub={`${rows.length} people`}>
        <input className="input w-60" placeholder="Search name, phone, email, tag…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search contacts" />
        <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={onlyFollow} onChange={(e) => setOnlyFollow(e.target.checked)} /> Overdue follow-ups</label>
        <button className="btn btn-primary" onClick={() => crud.openNew()}>+ Contact</button>
      </PageHeader>
      <div className="mb-4 overflow-x-auto"><Segmented value={type} onChange={setType} options={TYPES.map((t) => ({ value: t, label: t === "all" ? "All" : label(t), count: counts[t] }))} /></div>
      <Card>{loading ? <Loading /> : rows.length === 0 ? <Empty title="No contacts here" action={<button className="btn btn-sm" onClick={() => crud.openNew()}>+ Contact</button>} /> : <Table rows={rows} columns={columns} filter={q} defaultSort={{ key: "name", dir: "asc" }} />}</Card>
      {crud.panel}
    </div>
  );
}
