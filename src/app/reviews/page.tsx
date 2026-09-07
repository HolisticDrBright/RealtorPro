"use client";
import { useState } from "react";
import { api, toast, useApi } from "@/lib/client";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui/primitives";
interface Review { id: string; source: string; status: string; createdAt: string; payload: { action: string; entity?: string }; preview: unknown; result: unknown }
export default function ReviewsPage() {
  const { data, loading, error, reload } = useApi<{ items: Review[] }>("/api/reviews");
  const [busy, setBusy] = useState<string | null>(null);
  async function decide(id: string, approve: boolean) {
    setBusy(id);
    try { const r = await api.post("/api/import/apply", { reviewId: id, approve, confirm: true }); if (r.ok) { toast(approve ? "Approved changes saved; backup created" : "Proposal discarded"); reload(); } else toast(r.message || "Review failed", "err"); }
    finally { setBusy(null); }
  }
  return <div className="fade-in"><PageHeader title="Review Inbox" sub="AI proposes. You decide. Every approval has a database backup and cannot be applied twice." />
    {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={reload} /> : !data?.items.length ? <Empty title="Nothing waiting for review" body="Extract notes in Integrations or ask your connected Claude agent to propose changes." /> : data.items.map((r) => <Card key={r.id} className="mb-4" title={<span>{r.source} · {r.payload.action} {r.payload.entity} <Badge>{r.status}</Badge></span>}>
      <p className="text-xs text-ink-3 mb-2">{r.createdAt} · {r.id}</p>
      <details open={r.status === "pending"}><summary className="cursor-pointer text-sm font-medium">Full proposed fields and preview</summary><div className="grid lg:grid-cols-2 gap-3 mt-2"><pre className="text-xs bg-ground p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap break-words">{JSON.stringify(r.payload, null, 2)}</pre><pre className="text-xs bg-ground p-3 rounded overflow-auto max-h-96 whitespace-pre-wrap break-words">{JSON.stringify(r.preview, null, 2)}</pre></div></details>
      {r.status === "pending" && <div className="flex gap-2 mt-3"><button className="btn btn-primary" disabled={!!busy} onClick={() => decide(r.id, true)}>{busy === r.id ? "Saving…" : "Approve these changes"}</button><button className="btn" disabled={!!busy} onClick={() => decide(r.id, false)}>Discard</button></div>}
    </Card>)}
  </div>;
}
