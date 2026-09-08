"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, toast, useApi } from "@/lib/client";
import type { MatchDraft } from "@/lib/match-drafts";
import { Card, ErrorBox } from "@/components/ui/primitives";
type Draft = MatchDraft & { stale: boolean };
type Pair = { buyerId: string; candidateId: string; kind: string };
export function MatchComposer({ pair, initialId }: { pair: Pair; initialId: string | null }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [fields, setFields] = useState({ recipient: "", subject: "", email: "", sms: "" });
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [tone, setTone] = useState("warm"), [instructions, setInstructions] = useState("");
  const history = useApi<{ items: { id: string; subject: string; status: string; createdAt: string }[] }>("/api/match-drafts?" + new URLSearchParams(pair));
  const { buyerId, candidateId, kind } = pair;
  function show(d: Draft) {
    setDraft(d); setFields({ recipient: d.recipient, subject: d.subject, email: d.email, sms: d.sms });
    const url = new URL(window.location.href); url.searchParams.set("draft", d.id); window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    let cancelled = false;
    async function load() {
      let id = initialId;
      if (!id) {
        const h = await api.get<{ items: { id: string }[] }>("/api/match-drafts?" + new URLSearchParams({ buyerId, candidateId, kind }));
        if (!h.ok) { if (!cancelled) { setError(h.message || "Could not load saved drafts"); setLoading(false); } return; }
        id = h.data.items[0]?.id || null;
      }
      if (id) {
        const r = await api.get<{ item: Draft }>("/api/match-drafts?id=" + encodeURIComponent(id));
        if (!cancelled) { if (r.ok) show(r.data.item); else setError(r.message || "Could not load draft"); }
      }
      if (!cancelled) setLoading(false);
    }
    void load(); return () => { cancelled = true; };
  }, [buyerId, candidateId, kind, initialId]);
  async function loadDraft(id: string) {
    if (!id) return; setBusy(true); setError(null);
    try { const r = await api.get<{ item: Draft }>("/api/match-drafts?id=" + encodeURIComponent(id)); if (r.ok) show(r.data.item); else setError(r.message || "Could not load draft"); }
    finally { setBusy(false); }
  }
  async function generate() {
    setBusy(true); setError(null); const id = crypto.randomUUID();
    const url = new URL(window.location.href); url.searchParams.set("draft", id); window.history.replaceState(null, "", url);
    try {
      const r = await api.post<{ item: Draft }>("/api/match-drafts", { ...pair, id, consent, options: { tone, instructions } });
      if (r.ok) show(r.data.item); else setError(r.message || "Could not generate draft. Refresh to check saved history before retrying.");
    } finally { setBusy(false); history.reload(); }
  }
  async function save() {
    if (!draft) return; setBusy(true); setError(null);
    try {
      const r = await api.post<{ item: Draft }>("/api/match-drafts/" + draft.id, { action: "edit", revision: draft.revision, fields });
      if (r.ok) { show(r.data.item); toast("Draft edits saved for your PDF packet"); } else setError(r.message || "Could not save edits");
    } finally { setBusy(false); }
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); toast("Copied"); } catch { toast("Copy failed. Select and copy the text manually.", "err"); } }
  function change(key: keyof typeof fields, value: string) { setFields((old) => ({ ...old, [key]: value })); }
  const locked = busy;
  return <div className="space-y-4 max-w-4xl">
    <p className="text-sm text-ink-2">Create a personalized email and text using saved property facts and this buyer’s criteria. Nothing is sent and “properties sent” is not increased. Private CRM notes and vault text are excluded.</p>
    {(error || history.error) && <ErrorBox message={error || history.error || "Request failed"} />}
    {loading && <p>Loading saved drafts…</p>}
    {!!history.data?.items.length && <label className="label">Saved drafts<select className="input mt-1" disabled={busy} value={draft?.id || ""} onChange={(e) => { if (!draft || window.confirm("Open another saved draft? Unsaved edits will be lost.")) void loadDraft(e.target.value); }}><option value="">Choose a draft…</option>{history.data.items.map((d) => <option key={d.id} value={d.id}>{d.subject || d.status} · {d.createdAt}</option>)}</select></label>}
    <Card title={draft ? "Create another version" : "Match · write email + text"}>
      <label className="label" htmlFor="match-tone">Tone</label><select id="match-tone" className="input" value={tone} disabled={busy} onChange={(e) => setTone(e.target.value)}><option value="warm">Warm and personal</option><option value="professional">Professional</option><option value="concise">Concise</option></select>
      <label className="label mt-3" htmlFor="match-instructions">Writing preferences (optional)</label><textarea id="match-instructions" className="input min-h-20" maxLength={1500} value={instructions} disabled={busy} onChange={(e) => setInstructions(e.target.value)} placeholder="For example: highlight the layout, keep it relaxed, and suggest a weekend showing." />
      <label className="flex items-start gap-2 text-sm mt-3"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>Allow the buyer’s first name, search criteria, property facts and these instructions to be sent to Claude. API usage is billed to my Anthropic account.</span></label>
      <button className="btn btn-primary mt-3" disabled={busy || loading || !consent} onClick={() => { if (!draft || window.confirm("Generate a new paid version? Save any edits first.")) void generate(); }}>{busy ? "Working…" : draft ? "Generate new version" : "Generate email + text"}</button>
    </Card>
    {draft && <Card title="Review your match messages">
      {draft.error && <ErrorBox message={draft.error} />}
      {draft.status === "pending" && <p className="text-sm">Generation is pending. <button className="link" onClick={() => void loadDraft(draft.id)}>Check saved result</button>. If the app restarted during generation, create a new version; this request is not retried automatically.</p>}
      {draft.status === "complete" && <>
        {draft.stale && <p className="text-sm text-warn mb-3">The buyer or property has changed, or this is no longer an active match. Verify current details or generate a new version.</p>}
        <details className="text-sm mb-3"><summary className="cursor-pointer">Facts used · verify before sharing</summary><pre className="whitespace-pre-wrap break-words text-xs mt-2">{JSON.stringify(JSON.parse(draft.context), null, 2)}</pre></details>
        <label className="label" htmlFor="match-to">Buyer email address</label><input id="match-to" type="email" className="input" maxLength={254} disabled={locked} value={fields.recipient} onChange={(e) => change("recipient", e.target.value)} />
        <label className="label mt-3" htmlFor="match-subject">Email subject</label><input id="match-subject" className="input" maxLength={200} disabled={locked} value={fields.subject} onChange={(e) => change("subject", e.target.value)} />
        <label className="label mt-3" htmlFor="match-email">Email message</label><textarea id="match-email" className="input min-h-72" maxLength={12000} disabled={locked} value={fields.email} onChange={(e) => change("email", e.target.value)} />
        <button className="btn btn-sm mt-2" onClick={() => void copy(fields.subject + "\n\n" + fields.email)}>Copy email</button>
        <label className="label mt-4" htmlFor="match-sms">Text message · {fields.sms.length} characters</label><textarea id="match-sms" className="input min-h-28" maxLength={1600} disabled={locked} value={fields.sms} onChange={(e) => change("sms", e.target.value)} />
        <button className="btn btn-sm mt-2" onClick={() => void copy(fields.sms)}>Copy text</button><p className="text-xs text-ink-3 mt-1">Paste into Messages or your texting app. Long texts may use multiple SMS segments. No automatic texting.</p>
        <div className="flex flex-wrap gap-2 mt-4"><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>Save edits for PDF</button><Link className="btn" href="/buyer-match-packet">Review PDF packet →</Link><Link className="btn" href="/buyers?tab=matches">Match another buyer</Link></div>
        <p className="text-sm text-ink-3 mt-3">Completed drafts are added to your PDF queue. Save edits before leaving. Review the packet when you have finished matching everyone; no Gmail connection is needed.</p>
      </>}
    </Card>}
  </div>;
}
