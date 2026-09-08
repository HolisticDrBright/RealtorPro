"use client";
import Link from "next/link";
import { useState } from "react";
import { api, toast, useApi } from "@/lib/client";
import type { MatchDraft } from "@/lib/match-drafts";
import { Card, Empty, ErrorBox, PageHeader } from "@/components/ui/primitives";
interface Packet { id: string; title: string; filename: string; vaultPath: string | null; createdAt: string }
export default function MatchPacketPage() {
  const data = useApi<{ drafts: MatchDraft[]; packets: Packet[] }>("/api/match-packets");
  const [title, setTitle] = useState("Buyer match handoff");
  const [approved, setApproved] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ path: string; uri: string } | null>(null);
  const selected = data.data?.drafts.filter((d) => d.inPacket) || [];
  async function toggle(d: MatchDraft) {
    setBusy(true); setApproved(false); setError(null);
    try { const r = await api.post("/api/match-drafts/" + d.id, { action: "select", inPacket: !d.inPacket }); if (!r.ok) setError(r.message || "Could not update selection"); } finally { setBusy(false); }
  }
  async function saveVault(id: string) {
    setBusy(true); setError(null);
    try { const r = await api.post<{ path: string; uri: string }>("/api/match-packets/" + id, { saveToVault: true }); if (r.ok) { setSaved(r.data); toast("PDF saved to your connected vault"); } else setError(r.message || "PDF saved locally, but vault export failed. Download it below or reconnect your vault."); }
    finally { setBusy(false); data.reload(); }
  }
  async function create(vault: boolean) {
    setBusy(true); setError(null); setSaved(null);
    try {
      const r = await api.post<{ item: Packet }>("/api/match-packets", { id: crypto.randomUUID(), title, drafts: selected.map((d) => ({ id: d.id, revision: d.revision })), approved });
      if (!r.ok) { setError(r.message || "Could not prepare PDF. Refresh to check saved packets before retrying."); return; }
      setApproved(false); data.reload();
      if (vault) await saveVault(r.data.item.id);
      else { toast("PDF ready in Saved packets"); window.location.assign("/api/match-packets/" + r.data.item.id); }
    } finally { setBusy(false); }
  }
  return <div className="fade-in max-w-5xl">
    <PageHeader title="Buyer match · PDF packet" sub="Finish matching, review the selection, then hand one PDF to Claude"><Link className="btn" href="/buyers?tab=matches">← Continue matching</Link></PageHeader>
    <p className="text-sm text-ink-2 mb-4">One PDF with each buyer’s recipient address, property facts, fit reasons, concerns, email and text. Includes a Gmail-browser handoff prompt. No messages are sent, no Gmail API is needed, and sent counts stay unchanged.</p>
    {(error || data.error) && <ErrorBox message={error || data.error || "Request failed"} />}
    {saved && <p className="text-sm mb-4">Saved: <a className="link break-all" href={saved.uri}>{saved.path}</a></p>}
    <Card title={`Selected for next packet: ${selected.length}`}>
      {data.loading && <p>Loading draft queue…</p>}
      {!data.loading && !data.data?.drafts.length && <Empty title="No completed match drafts yet" body="Click Match next to a property, then generate its email and text." action={<Link className="btn" href="/buyers?tab=matches">Go to Buyer Match</Link>} />}
      <div className="space-y-3">{data.data?.drafts.map((d) => {
        const facts = JSON.parse(d.context) as { buyerName: string; property: { address: string } };
        return <div key={d.id} className="flex items-start gap-3 border-b border-line pb-3">
          <input type="checkbox" className="mt-1" aria-label={`Include ${facts.buyerName} - ${facts.property.address}`} checked={d.inPacket} disabled={busy} onChange={() => void toggle(d)} />
          <div className="min-w-0 flex-1"><div className="font-medium text-sm">{facts.buyerName} · {facts.property.address}</div><p className="text-xs text-ink-3 break-all">{d.recipient || "Missing recipient — add it before the Gmail handoff"} · {d.createdAt}</p><p className="text-sm mt-1">{d.subject}</p><details className="text-sm mt-1"><summary className="cursor-pointer link">Review messages</summary><p className="whitespace-pre-wrap mt-2">{d.email}</p><p className="whitespace-pre-wrap mt-3"><b>Text:</b> {d.sms}</p></details><Link className="link text-sm mt-2 inline-block" href={"/buyer-match-drafts?" + new URLSearchParams({ buyerId: d.buyerId, candidateId: d.candidateId, kind: d.kind, draft: d.id })}>Edit draft</Link></div>
        </div>;
      })}</div>
      <p className="text-xs text-ink-3 mt-3">Shows the latest 200 completed drafts. Select one version per buyer/property, up to 50 matches per packet. Exported drafts are unchecked automatically; your saved PDFs remain below.</p>
      <label className="label mt-4" htmlFor="packet-title">PDF title</label><input id="packet-title" className="input" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex gap-2 text-sm mt-4"><input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} /><span>I reviewed the selected messages and recipients. I understand this PDF contains private client information, not a bulk email to forward to buyers.</span></label>
      <div className="flex flex-wrap gap-2 mt-4"><button className="btn btn-primary" disabled={busy || !approved || !selected.length || selected.length > 50 || !title.trim()} onClick={() => void create(true)}>{busy ? "Preparing…" : "Save PDF to Obsidian vault"}</button><button className="btn" disabled={busy || !approved || !selected.length || selected.length > 50 || !title.trim()} onClick={() => void create(false)}>Download PDF instead</button></div>
      <p className="text-xs text-ink-3 mt-2">Vault destination: configured export folder / Buyer Matches. Existing files are never overwritten. Vault text sharing with Claude is not required for this local export.</p>
    </Card>
    <Card title="Saved packets" className="mt-4">{!data.data?.packets.length && <p className="text-sm text-ink-3">Completed PDFs will appear here, including after you restart the app.</p>}<div className="space-y-3">{data.data?.packets.map((p) => <div key={p.id} className="flex flex-wrap gap-2 items-center border-b border-line pb-3"><div className="flex-1 min-w-48"><p className="font-medium text-sm">{p.title}</p><p className="text-xs text-ink-3 break-all">{p.vaultPath || "Saved locally"} · {p.createdAt}</p></div><a className="btn btn-sm" href={"/api/match-packets/" + p.id}>Download PDF</a><button className="btn btn-sm" disabled={busy} onClick={() => void saveVault(p.id)}>{p.vaultPath ? "Verify / save to vault" : "Save to vault"}</button></div>)}</div></Card>
  </div>;
}
