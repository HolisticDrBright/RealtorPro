"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api, label, toast, useApi } from "@/lib/client";
import type { JarvisTurn } from "@/lib/jarvis";
import { Badge, Card, Empty, ErrorBox, Loading, PageHeader } from "@/components/ui/primitives";
import { speakJarvis, useJarvisVoice } from "./jarvis-voice";

export function JarvisChat({ id }: { id?: string }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false), [voiceConsent, setVoiceConsent] = useState(false);
  const [allowScheduling, setAllowScheduling] = useState(true), [autoSend, setAutoSend] = useState(false);
  const [allowExternal, setAllowExternal] = useState(true);
  const [readAloud, setReadAloud] = useState(false), [busy, setBusy] = useState(false), [deciding, setDeciding] = useState(false);
  const [error, setError] = useState<string | null>(null), [pendingId, setPendingId] = useState<string | null>(null);
  const sending = useRef(false), spoken = useRef<string | null>(null);
  const history = useApi<{ items: Pick<JarvisTurn, "id" | "question" | "status" | "createdAt">[] }>("/api/jarvis");
  const current = useApi<{ item: JarvisTurn }>(id ? `/api/jarvis/${id}` : null, { refreshMs: 4000 });
  const turn = current.data?.item;
  const waiting = busy || turn?.status === "pending";
  const voice = useJarvisVoice((text) => {
    const combined = [question.trim(), text].filter(Boolean).join(" ").slice(0, 4000);
    setQuestion(combined);
    if (autoSend && consent && !waiting) void send(combined);
  });
  useEffect(() => { try { setConsent(sessionStorage.getItem("jarvis-crm-consent-v2") === "yes"); setAllowExternal(sessionStorage.getItem("jarvis-external") !== "no"); setAllowScheduling(sessionStorage.getItem("jarvis-changes") !== "no"); setVoiceConsent(sessionStorage.getItem("jarvis-voice") === "yes"); setAutoSend(sessionStorage.getItem("jarvis-auto-send") === "yes"); setReadAloud(sessionStorage.getItem("jarvis-read-aloud") === "yes"); } catch { /* session-only preferences */ } }, []);
  function voicePreference(key: string, value: boolean) { try { sessionStorage.setItem(key, value ? "yes" : "no"); } catch { /* still works for this view */ } }
  useEffect(() => {
    if (readAloud && turn?.status === "complete" && turn.answer && spoken.current !== turn.id) {
      spoken.current = turn.id;
      speakJarvis(`${turn.drafts.length ? "Proposed changes need your approval. " : ""}${turn.answer}`);
    }
  }, [readAloud, turn]);
  function consentChanged(value: boolean) { setConsent(value); try { sessionStorage.setItem("jarvis-crm-consent-v2", value ? "yes" : "no"); } catch { /* still works without persistence */ } }
  async function send(text: string) {
    if (!consent || !text.trim() || sending.current || waiting) return;
    sending.current = true; setBusy(true); setError(null); voice.stop();
    const requestId = crypto.randomUUID(); setPendingId(requestId);
    try {
      const result = await api.post<{ item: JarvisTurn }>("/api/jarvis", { id: requestId, question: text.trim(), parentId: turn?.status === "complete" ? turn.id : null, consent: true, allowScheduling, allowChanges: allowScheduling, allowExternal });
      if (!result.ok) { setError(result.message ?? "Jarvis could not answer. Check saved history before trying again."); return; }
      setQuestion("");
      router.push(`/jarvis/${result.data.item.id}`);
    } finally { sending.current = false; setBusy(false); history.reload(); }
  }
  async function decide(approve: boolean) {
    if (!turn?.reviewId || deciding) return;
    setDeciding(true); setError(null);
    const result = await api.post("/api/import/apply", { reviewId: turn.reviewId, approve, confirm: true });
    setDeciding(false);
    if (!result.ok) setError(result.message ?? "Could not update the review.");
    else { toast(approve ? "Approved changes applied to the displayed destination" : "Drafts discarded"); current.reload(); }
  }
  return <div className="fade-in">
    <PageHeader title="Ask Jarvis" sub="Your saved records, a spoken question, and a clear next step."><Link href="/jarvis" className="btn">New conversation</Link><Link href="/integrations" className="btn">Claude connection</Link></PageHeader>
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-4 min-w-0">
        <Card title="Talk to your command center">
          <p className="text-[13px] text-ink-3">Jarvis can read and propose changes across your app records, read permitted Obsidian notes directly, and read your selected Google Calendar. Vault access follows the Claude-sharing and folder controls in Integrations. Questions, answers and proposals are saved locally. No access to credentials, hidden/excluded files, Gmail or files outside your vault.</p>
          <label className="flex items-start gap-2 text-[13px] mt-3"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => consentChanged(e.target.checked)} />Allow Jarvis to send my questions, relevant app records, permitted vault text, selected Google Calendar details and recent conversation context to Claude for this browser session.</label>
          <label className="flex items-start gap-2 text-[13px] mt-2"><input type="checkbox" className="mt-1" checked={allowExternal} onChange={(e) => { setAllowExternal(e.target.checked); voicePreference("jarvis-external", e.target.checked); }} />Include the connected vault and selected Google Calendar (when permitted in Integrations).</label>
          <label className="flex items-start gap-2 text-[13px] mt-2"><input type="checkbox" className="mt-1" checked={allowScheduling} onChange={(e) => { setAllowScheduling(e.target.checked); voicePreference("jarvis-changes", e.target.checked); }} />Allow app changes, vault edits and calendar drafts (I must approve before anything is saved).</label>
          <Link href="/integrations" className="link text-[12px] mt-2 inline-block">Manage vault privacy / Connect Google Calendar →</Link>
          <form onSubmit={(e) => { e.preventDefault(); void send(question); }} className="mt-4">
            <label htmlFor="jarvis-question" className="label">{turn ? "Ask a follow-up" : "Your question"}</label>
            <textarea id="jarvis-question" className="input min-h-28" value={question} maxLength={4000} disabled={!!waiting || voice.listening} onChange={(e) => setQuestion(e.target.value)} placeholder="Which investors want multifamily? What does Sarah want in her next home? Draft a call reminder for…" />
            <div className="flex flex-wrap gap-2 mt-3">
              <button type="button" className={`btn ${voice.listening ? "text-crit" : ""}`} disabled={!voice.supported || (!voice.listening && (!voiceConsent || !!waiting))} onClick={() => voice.listening ? voice.stop() : voice.start()}>{voice.listening ? "Stop microphone" : "Microphone"}</button>
              <button className="btn btn-primary" type="submit" disabled={!consent || !question.trim() || !!waiting || voice.listening}>{waiting ? "Jarvis is working…" : "Ask Jarvis"}</button>
            </div>
          </form>
          <details className="text-[12px] text-ink-3 mt-4" open={!voiceConsent}>
            <summary className="cursor-pointer font-medium">Voice & privacy</summary>
            <p className="mt-2">Browser speech recognition may send audio to its provider and may need internet access. Read-aloud uses a local voice when available, otherwise the browser’s voice service. RealtorPro does not store audio. Voice support varies by browser; typing or Mac dictation remains available.</p>
            <label className="flex items-start gap-2 mt-2"><input type="checkbox" checked={voiceConsent} onChange={(e) => { setVoiceConsent(e.target.checked); voicePreference("jarvis-voice", e.target.checked); if (!e.target.checked) voice.stop(); }} />Allow browser speech recognition when I press Microphone.</label>
            <label className="flex items-start gap-2 mt-2"><input type="checkbox" checked={autoSend} onChange={(e) => { setAutoSend(e.target.checked); voicePreference("jarvis-auto-send", e.target.checked); }} />Send my recognized question automatically after I speak.</label>
            <label className="flex items-start gap-2 mt-2"><input type="checkbox" checked={readAloud} onChange={(e) => { setReadAloud(e.target.checked); voicePreference("jarvis-read-aloud", e.target.checked); if (!e.target.checked) window.speechSynthesis?.cancel(); }} />Read Jarvis answers aloud using the browser/device voice.</label>
          </details>
          {!voice.supported && <p className="text-[12px] text-ink-3 mt-2">Microphone recognition is unavailable here. Type or dictate into the text box instead.</p>}
          {voice.listening && <p role="status" className="text-[13px] mt-2">Listening… stops after one utterance or 60 seconds. Stop microphone cancels recognition.</p>}
          {voice.error && <ErrorBox message={voice.error} />}
          <p className="text-[12px] text-ink-3 mt-3">Uses your existing Anthropic API billing. Up to 6 model requests per question. One review at a time: up to 20 app changes, one vault edit, or one Google event. Specify local or Google Calendar when scheduling. No dialing, emails, invitations or automatic background monitoring.</p>
        </Card>
        {error && <ErrorBox message={error} />}
        {error && pendingId && <Link className="link text-[13px]" href={`/jarvis/${pendingId}`}>Check whether this question was saved before retrying →</Link>}
        {current.loading && <Loading />}
        {current.error && <ErrorBox message={current.error} onRetry={current.reload} />}
        {turn && <Card title={<span className="flex items-center gap-2">Jarvis <Badge>{turn.status}</Badge></span>}>
          <p className="text-[13px] font-medium whitespace-pre-wrap break-words mb-4">You: {turn.question}</p>
          {turn.status === "pending" && <p role="status">Still working. This question is saved. If the app restarted or this lasts more than two minutes, start a new conversation; Jarvis will not automatically bill you for a retry.</p>}
          {turn.error && <ErrorBox message={turn.error} />}
          {turn.answer && <><p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed">{turn.answer}</p><div className="flex flex-wrap gap-2 mt-3"><button className="btn btn-sm" onClick={() => { if (!speakJarvis(turn.answer!)) setError("Read-aloud is unavailable in this browser."); }}>Read answer aloud</button><button className="btn btn-sm" onClick={() => window.speechSynthesis?.cancel()}>Stop speaking</button></div></>}
          {turn.drafts.length > 0 && <div className="mt-4 border-t border-line pt-4">
            <h2 className="font-semibold">{turn.reviewStatus === "applied" ? "Approved changes applied" : turn.reviewStatus === "pending" ? "Review before saving — drafts only" : "Drafts not applied"}</h2>
            <p className="text-[12px] text-ink-3 mt-1">Verify the destination, people, fields, dates and time zone. Local app zone: {turn.timeZone}; Google times include explicit offsets. No invitations or calls are sent. Deleting a contact or property may also remove linked records. Vault edits keep a recovery copy.</p>
            {turn.drafts.map((draft, i) => <div key={i} className="rounded-lg border border-line p-3 mt-3"><div className="font-medium text-sm">{label(draft.action || "create")} · {label(draft.entity)}{draft.id ? ` · ${turn.sources.find((s) => s.id === draft.id)?.label || draft.id}` : ""}</div><dl className="text-[13px] mt-2 space-y-1">{Object.entries(draft.fields).map(([field, value]) => <div key={field} className="flex flex-wrap justify-between gap-2"><dt className="text-ink-3">{label(field.replace(/([A-Z])/g, " $1"))}</dt><dd className="break-words min-w-0 whitespace-pre-wrap max-w-full">{turn.sources.find((s) => s.id === value)?.label ?? (typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "—"))}</dd></div>)}</dl></div>)}
            {!!turn.reviewPreview && <details className="mt-3"><summary className="cursor-pointer text-sm font-medium">Full before / after preview</summary><pre className="text-xs bg-ground rounded p-3 whitespace-pre-wrap break-words max-h-96 overflow-auto">{JSON.stringify(turn.reviewPreview, null, 2)}</pre></details>}
            {turn.reviewStatus === "pending" && <div className="flex flex-wrap gap-2 mt-3"><button className="btn btn-primary" disabled={deciding} onClick={() => void decide(true)}>Approve & save {turn.drafts.length} {turn.drafts.length === 1 ? "item" : "items"}</button><button className="btn" disabled={deciding} onClick={() => void decide(false)}>Discard drafts</button></div>}
            <Link href="/reviews" className="link text-[12px] mt-2 inline-block">Open Review Inbox →</Link>
          </div>}
          {turn.sources.length > 0 && <details className="mt-4 border-t border-line pt-3"><summary className="text-[13px] font-medium cursor-pointer">Records Jarvis consulted ({turn.sources.length})</summary><ul className="mt-2 space-y-1 text-[13px]">{turn.sources.map((source) => <li key={`${source.entity}:${source.id}`}><Link className="link" href={source.href}>{source.label}</Link> <span className="text-ink-3">· {label(source.entity)}</span></li>)}</ul></details>}
          <p className="text-[11px] text-ink-3 mt-4">{turn.model} · {turn.createdAt}{turn.usage ? ` · ${turn.usage.inputTokens.toLocaleString()} input / ${turn.usage.outputTokens.toLocaleString()} output tokens · ${turn.usage.requests} requests` : ""}. Exact cost: check Anthropic usage. Answers can be mistaken; verify important details in the linked records.</p>
        </Card>}
        {!id && !busy && <Empty title="Start with a question" body="Try: “Which buyers need a follow-up?” or “What is Alex’s investment budget?” For scheduling, include the person, date, time and appointment duration." />}
      </div>
      <Card title="Saved questions">
        {history.error && <ErrorBox message={history.error} onRetry={history.reload} />}
        {!history.data?.items.length && <p className="text-[13px] text-ink-3">No saved questions yet.</p>}
        <ul className="space-y-3 text-[13px]">{history.data?.items.map((item) => <li key={item.id}><Link className="link block break-words" href={`/jarvis/${item.id}`}>{item.question.slice(0, 120)}</Link><span className="text-ink-3 text-[11px]">{item.status}</span></li>)}</ul>
      </Card>
    </div>
  </div>;
}
