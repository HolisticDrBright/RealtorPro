"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { api, toast, useApi, useLookups } from "@/lib/client";
import { fmtDateTime } from "@/lib/dates";
import { Badge, Card, Empty, Loading, PageHeader } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";

interface Note { id: string; body: string; contactId: string | null; propertyId: string | null; transactionId: string | null; pinned: boolean; createdAt: string }

export default function NotesPage() {
  const [q, setQ] = useState("");
  const [quick, setQuick] = useState("");
  const [attach, setAttach] = useState<{ contactId?: string; propertyId?: string }>({});
  const { data, loading } = useApi<{ items: Note[] }>("/api/notes?limit=1000");
  const lk = useLookups();
  const crud = useCrud("notes");
  const rows = useMemo(() => (data?.items ?? []).filter((n) => !q || `${n.body} ${lk.nameOf(n.contactId)} ${lk.addressOf(n.propertyId)}`.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)), [data, q, lk]);
  async function save() { if (!quick.trim()) return; const r = await api.create("notes", { body: quick.trim(), ...attach }); if (r.ok) { setQuick(""); toast("Note captured"); } }
  return (
    <div className="fade-in">
      <PageHeader title="Notes" sub="Quick capture · searchable · attach to a contact, property or transaction"><input className="input w-64" placeholder="Search notes…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search notes" /><button className="btn btn-primary" onClick={() => crud.openNew()}>+ Note</button></PageHeader>
      <Card className="mb-4">
        <div className="pt-4"><textarea className="input" placeholder="Seller at 123 Main may list in October… (Enter to save, Shift+Enter for a new line)" value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); save(); } }} /></div>
        <div className="flex gap-2 mt-2 flex-wrap"><select className="input w-56" value={attach.contactId ?? ""} onChange={(e) => setAttach({ ...attach, contactId: e.target.value || undefined })} aria-label="Attach to contact"><option value="">Attach to contact…</option>{lk.contacts.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>)}</select><select className="input w-56" value={attach.propertyId ?? ""} onChange={(e) => setAttach({ ...attach, propertyId: e.target.value || undefined })} aria-label="Attach to property"><option value="">Attach to property…</option>{lk.properties.map((p) => <option key={p.id} value={p.id}>{p.address}</option>)}</select><button className="btn btn-primary ml-auto" onClick={save} disabled={!quick.trim()}>Save note</button></div>
      </Card>
      {loading && <Loading />}
      {!loading && rows.length === 0 && <Empty title="No notes" body="Capture intelligence fast — who might list, what a buyer loves, what an agent hinted." />}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((n) => <Card key={n.id} bodyClass="pt-4">
          <div className="text-[13.5px] whitespace-pre-wrap">{n.pinned && <span className="text-gold mr-1" title="Pinned">★</span>}{n.body}</div>
          <div className="flex items-center gap-2 mt-3 flex-wrap text-[12px]">{n.contactId && <Link href={`/contacts/${n.contactId}`} className="hover:underline"><Badge tone="info">{lk.nameOf(n.contactId)}</Badge></Link>}{n.propertyId && <Badge tone="gold">{lk.addressOf(n.propertyId)}</Badge>}{n.transactionId && <Badge tone="escrow">transaction</Badge>}<span className="ml-auto text-ink-3 tnum">{fmtDateTime(n.createdAt)}</span></div>
          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-line-2"><button className="btn btn-ghost btn-sm" onClick={() => api.update("notes", n.id, { pinned: !n.pinned })}>{n.pinned ? "Unpin" : "Pin"}</button><span className="ml-auto"><RowMenu onEdit={() => crud.openEdit(n as unknown as Record<string, unknown>)} onDelete={() => crud.remove(n.id, "note")} /></span></div>
        </Card>)}
      </div>
      {crud.panel}
    </div>
  );
}
