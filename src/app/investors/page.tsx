"use client";

import Link from "next/link";
import { useState } from "react";
import { fullName, label, useApi, useQueryParam, type ContactLite } from "@/lib/client";
import { fmtMoney } from "@/lib/calc";
import { fmtDate, ymd } from "@/lib/dates";
import type { Investor } from "@/lib/investors";
import { Avatar, Badge, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";
import { quickAdd } from "@/components/app/shell";

export default function InvestorsPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const focus = useQueryParam("contactId");
  const investors = useApi<{ items: Investor[] }>("/api/investors?limit=1000");
  const contacts = useApi<{ items: ContactLite[] }>("/api/contacts?limit=1000");
  const crud = useCrud("investors");
  const newContact = useCrud("contacts", { onSaved: (item) => crud.openNew({ contactId: item.id }) });
  const contactMap = new Map((contacts.data?.items ?? []).map((c) => [c.id, c]));
  const rows = investors.data?.items ?? [];
  const filtered = rows.filter((r) => (!focus || r.contactId === focus) && (status === "all" || r.status === status) &&
    `${fullName(contactMap.get(r.contactId))} ${label(r.strategy)} ${r.targetAreas?.join(" ")} ${r.propertyTypes?.join(" ")} ${r.notes ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  const error = investors.error || contacts.error;
  const loading = investors.loading || contacts.loading;
  const due = rows.filter((r) => { const date = contactMap.get(r.contactId)?.nextFollowUpAt; return r.status === "active" && date && date.slice(0, 10) <= ymd(); }).length;

  return <div className="fade-in">
    <PageHeader title="Investors" sub="Buying criteria, relationships and the next conversation—all in one place.">
      <button className="btn" onClick={() => crud.openNew()}>+ Existing contact profile</button>
      <button className="btn btn-primary" onClick={() => newContact.openNew({ type: "investor" })}>+ New investor contact</button>
    </PageHeader>
    <div className="rounded-xl border border-line bg-panel/80 p-4 mb-4">
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        {!loading && !error && <><Badge tone="active">{rows.filter((r) => r.status === "active").length} active investors</Badge><span>{due} active follow-ups due</span></>}
        <Link href="/opportunities" className="link">Open opportunities →</Link>
        <Link href="/integrations" className="link">Import from notes →</Link>
      </div>
      <p className="text-[12px] text-ink-3 mt-2">Capital is self-reported, not verified. Return targets are client preferences—not forecasts. Claude imports require your approval in Review Inbox.</p>
    </div>
    <div className="flex flex-wrap gap-2 mb-4">
      <input className="input max-w-sm" aria-label="Search investors" placeholder="Search name, market, strategy…" value={query} onChange={(e) => setQuery(e.target.value)} />
      <select className="input w-36" aria-label="Investor status" value={status} onChange={(e) => setStatus(e.target.value)}>{["all", "active", "nurture", "paused"].map((s) => <option key={s} value={s}>{label(s)}</option>)}</select>
      {focus && <a className="btn" href="/investors">Show all investors</a>}
    </div>
    {error && <ErrorBox message={error} onRetry={() => { investors.reload(); contacts.reload(); }} />}
    {loading && <Loading />}
    {!loading && !error && !rows.length && <Empty title="Build your investor network" body="Start with a new contact, add a profile to someone already in Contacts, or review an import from your connected vault. No sample investors are added." action={<button className="btn btn-primary" onClick={() => newContact.openNew({ type: "investor" })}>+ New investor contact</button>} />}
    {!loading && !error && rows.length > 0 && !filtered.length && <Empty title="No matching investors" body="Try a different search or status." />}
    {!loading && !error && <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
      {filtered.map((r) => { const contact = contactMap.get(r.contactId); return <Card key={r.id} title={<Link href={`/contacts/${r.contactId}`} className="flex items-center gap-2 hover:underline"><Avatar name={fullName(contact)} size={30} />{contact ? fullName(contact) : "Open linked contact"}</Link>} action={<Badge tone={r.status === "active" ? "active" : "neutral"}>{label(r.status)}</Badge>}>
        <div className="flex flex-wrap gap-2 mb-3"><Badge tone="gold">{label(r.strategy)}</Badge>{r.propertyTypes?.map((t, i) => <Badge key={`${t}-${i}`} tone="neutral">{t}</Badge>)}</div>
        <dl className="text-[13px] space-y-2">
          <Detail name="Purchase budget" value={r.budgetMin == null && r.budgetMax == null ? "Not provided" : `${fmtMoney(r.budgetMin)} – ${fmtMoney(r.budgetMax)}`} />
          <Detail name="Self-reported capital" value={r.availableCapital == null ? "Not provided" : fmtMoney(r.availableCapital)} />
          <Detail name="Target markets" value={r.targetAreas?.join(", ")} />
          <Detail name="Financing" value={r.financingType} />
          <Detail name="Timeline" value={r.timeline} />
          <Detail name="Target cap rate" value={r.targetCapRate == null ? null : `${r.targetCapRate}%`} />
          <Detail name="Target cash-on-cash" value={r.targetCashOnCash == null ? null : `${r.targetCashOnCash}%`} />
          <Detail name="Next follow-up" value={contact?.nextFollowUpAt ? fmtDate(contact.nextFollowUpAt) : "Not scheduled"} />
        </dl>
        <details className="mt-3 border-t border-line-2 pt-3 text-[13px]"><summary className="cursor-pointer font-medium">Requirements & notes</summary><div className="mt-2 space-y-2"><p><span className="text-ink-3">Must-haves: </span>{r.mustHaves?.join(", ") || "Not provided"}</p><p><span className="text-ink-3">Deal breakers: </span>{r.dealBreakers?.join(", ") || "Not provided"}</p><p className="whitespace-pre-wrap">{r.notes || "No investor notes yet."}</p></div></details>
        <div className="flex flex-wrap items-center gap-1 mt-4 border-t border-line-2 pt-3">
          <button className="btn btn-sm" onClick={() => quickAdd("tasks", { contactId: r.contactId })}>+ Task</button>
          <button className="btn btn-sm" onClick={() => quickAdd("calls", { contactId: r.contactId, scheduledDate: ymd() })}>+ Call</button>
          <Link href={`/contacts/${r.contactId}`} className="btn btn-sm">Follow-up</Link>
          <RowMenu onEdit={() => crud.openEdit(r as unknown as Record<string, unknown>)} onDelete={() => crud.remove(r.id, `${fullName(contact)}'s investor profile`)} />
        </div>
      </Card>; })}
    </div>}
    {rows.length === 1000 && <p className="text-ink-3 mt-3">Showing the first 1,000 investor profiles. Search and counts apply to this loaded set.</p>}
    {newContact.panel}{crud.panel}
  </div>;
}

function Detail({ name, value }: { name: string; value?: string | null }) {
  return <div className="flex justify-between gap-4"><dt className="text-ink-3 shrink-0">{name}</dt><dd className="text-right break-words min-w-0">{value || "Not provided"}</dd></div>;
}
