"use client";

import Link from "next/link";
import { useState } from "react";
import { api, label, smsHref, telHref, toast, useApi } from "@/lib/client";
import { addDays, fmtDate, ymd } from "@/lib/dates";
import { Avatar, Badge, Card, Empty, Loading, PageHeader, Segmented } from "@/components/ui/primitives";
import { quickAdd } from "@/components/app/shell";

interface Item { contactId: string; bucket: string; reason: string; days: number | null; urgency: number; name: string; type: string; phone: string | null; email: string | null; lastContactAt: string | null; nextFollowUpAt: string | null; photoUrl: string | null }
const BUCKETS: { value: string; label: string }[] = [{ value: "all", label: "All" }, { value: "overdue", label: "Overdue" }, { value: "hot_no_contact", label: "Hot, no contact" }, { value: "7d", label: "7+ days" }, { value: "14d", label: "14+ days" }, { value: "30d", label: "30+ days" }, { value: "timeline", label: "Upcoming timeline" }, { value: "check_back", label: "Check back" }];

export default function FollowUpsPage() {
  const [b, setB] = useState("all");
  const { data, loading } = useApi<{ items: Item[] }>("/api/followups");
  const rows = (data?.items ?? []).filter((i) => b === "all" || i.bucket === b);
  const counts = Object.fromEntries(BUCKETS.map((x) => [x.value, x.value === "all" ? data?.items.length ?? 0 : data?.items.filter((i) => i.bucket === x.value).length ?? 0]));
  async function schedule(i: Item, days: number) { const r = await api.update("contacts", i.contactId, { nextFollowUpAt: ymd(addDays(new Date(), days)) }); if (r.ok) toast(`Follow-up with ${i.name} set for ${fmtDate(ymd(addDays(new Date(), days)))}`); }
  async function touched(i: Item) { const r = await api.update("contacts", i.contactId, { lastContactAt: new Date().toISOString(), nextFollowUpAt: null }); if (r.ok) { await api.create("activities", { contactId: i.contactId, type: "call", summary: "Follow-up completed", occurredAt: new Date().toISOString() }); toast("Marked contacted"); } }
  return (
    <div className="fade-in">
      <PageHeader title="Needs Follow-Up" sub="Automatically surfaced from every contact’s last touch, follow-up date, buyer temperature and timeline" />
      <div className="mb-4 overflow-x-auto"><Segmented value={b} onChange={setB} options={BUCKETS.map((x) => ({ ...x, count: counts[x.value] }))} /></div>
      <Card>
        {loading && <Loading />}
        {!loading && rows.length === 0 && <Empty title="Nobody needs a follow-up here" body="You’re current with everyone in this bucket." />}
        <ul className="divide-y divide-line-2">
          {rows.map((i) => <li key={i.contactId} className="flex items-center gap-3 py-3">
            <Avatar name={i.name} src={i.photoUrl} size={36} />
            <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><Link href={`/contacts/${i.contactId}`} className="text-[13.5px] font-medium hover:underline">{i.name}</Link><Badge tone={i.type}>{label(i.type)}</Badge><Badge tone={i.bucket === "overdue" || i.bucket === "hot_no_contact" ? "critical" : i.bucket === "30d" ? "warn" : "neutral"}>{BUCKETS.find((x) => x.value === i.bucket)?.label}</Badge></div><div className="text-[12.5px] text-ink-3">{i.reason} · last contact {fmtDate(i.lastContactAt)}{i.nextFollowUpAt ? ` · follow-up ${fmtDate(i.nextFollowUpAt)}` : ""}</div></div>
            <a className="btn btn-ghost btn-icon" href={telHref(i.phone)} aria-label="Call">☎</a><a className="btn btn-ghost btn-icon" href={smsHref(i.phone)} aria-label="Text">✉</a>
            <button className="btn btn-sm" onClick={() => touched(i)}>Contacted</button>
            <div className="inline-flex gap-1">{[1, 3, 7].map((d) => <button key={d} className="btn btn-sm" onClick={() => schedule(i, d)} title={`Follow up in ${d} days`}>+{d}d</button>)}</div>
            <button className="btn btn-sm" onClick={() => quickAdd("calls", { contactId: i.contactId, scheduledDate: ymd(), reason: i.reason })}>Add to call list</button>
          </li>)}
        </ul>
      </Card>
    </div>
  );
}
