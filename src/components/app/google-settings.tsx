"use client";
import { useState } from "react";
import Link from "next/link";
import { api, useApi, toast } from "@/lib/client";
import { Badge, Card, ErrorBox } from "@/components/ui/primitives";
interface Status { configured: boolean; connected: boolean; calendarId: string | null; calendarName: string | null; timeZone: string | null; error: string | null }
export function GoogleSettings() {
  const status = useApi<Status>("/api/google");
  const calendars = useApi<{ items: { id: string; name: string; timeZone: string }[]; incomplete: boolean }>(status.data?.connected ? "/api/google?mode=calendars" : null);
  const [clientId, setClientId] = useState(""), [secret, setSecret] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState<string | null>(null), [origin, setOrigin] = useState("");
  async function run(action: string, extra = {}) {
    setBusy(true); setError(null);
    try { const r = await api.post<{ url?: string; warning?: string }>("/api/google", { action, ...extra });
      if (!r.ok) { setError(r.message || "Google Calendar request failed"); return; }
      if (r.data.url) { window.location.assign(r.data.url); return; }
      if (action === "configure") { setSecret(""); setClientId(""); }
      if (r.data.warning) setError(r.data.warning); else toast("Google Calendar settings updated");
      status.reload(); calendars.reload();
    } finally { setBusy(false); }
  }
  const connected = status.data?.connected;
  return <Card className="mb-4" title={<span>Google Calendar <Badge tone={connected ? "ok" : "neutral"}>{connected ? "Authorized" : "Not connected"}</Badge></span>}>
    <p className="text-[13px] text-ink-2">Connect your Google account, then select a writable calendar. Jarvis can read that calendar and propose new events for approval. No Gmail access, invitations or automatic two-way sync.</p>
    <details className="mt-3 text-[13px]" open={!status.data?.configured} onToggle={() => { if (!origin) setOrigin(window.location.origin); }}><summary className="cursor-pointer font-medium">One-time Google setup</summary>
      <ol className="list-decimal pl-5 space-y-1 mt-2"><li>In <a className="link" href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com" target="_blank" rel="noreferrer">Google Cloud</a>, create/select a project and enable Google Calendar API.</li><li>Configure Google Auth Platform → Audience. For personal testing, add your Google email as a test user.</li><li>Create an OAuth client of type <b>Web application</b>. Add this exact authorized redirect URI: <code className="break-all">{origin || "http://127.0.0.1:3000"}/google/callback</code>.</li><li>Paste its client ID and client secret below. These are app credentials, not your Google password. Saved credentials use macOS Keychain or Windows account encryption.</li></ol>
      <p className="text-ink-3 mt-2">Testing-mode authorization can expire after seven days; reconnect when prompted. Use the same localhost address throughout sign-in. Open RealtorPro in your normal browser if Google rejects an embedded browser.</p>
      <label className="label mt-3" htmlFor="google-client">Google OAuth client ID</label><input id="google-client" className="input" autoComplete="off" value={clientId} onChange={(e) => setClientId(e.target.value)} />
      <label className="label mt-3" htmlFor="google-secret">Google OAuth client secret</label><input id="google-secret" className="input" type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} />
      <button className="btn mt-3" disabled={busy || !clientId.trim() || !secret.trim()} onClick={() => void run("configure", { clientId, clientSecret: secret })}>Save Google setup{connected ? " (disconnects current account)" : ""}</button>
    </details>
    <div className="flex flex-wrap gap-2 mt-3"><button className="btn btn-primary" disabled={busy || !status.data?.configured} onClick={() => void run("connect")}>{connected ? "Reconnect Google Calendar" : "Connect Google Calendar"}</button>{connected && <button className="btn" disabled={busy} onClick={() => void run("disconnect")}>Disconnect Google Calendar</button>}<button className="btn" disabled={busy} onClick={() => { status.reload(); calendars.reload(); }}>Refresh connection</button></div>
    {connected && <><label className="label mt-3" htmlFor="google-calendar">Calendar Jarvis may access</label><select id="google-calendar" className="input" disabled={busy || !calendars.data} value={status.data?.calendarId || ""} onChange={(e) => { if (e.target.value) void run("select", { calendarId: e.target.value }); }}><option value="">Choose a calendar…</option>{calendars.data?.items.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.timeZone}</option>)}</select>{calendars.data?.incomplete && <p>Only the first 100 writable calendars are shown.</p>}<p className="text-[12px] text-ink-3 mt-2">{status.data?.calendarId ? `Selected: ${status.data.calendarName} · ${status.data.timeZone}. Test it below or ask Jarvis about your schedule.` : "Select a calendar to enable Jarvis access."}</p></>}
    {(error || status.error || status.data?.error || calendars.error) && <ErrorBox message={error || status.error || status.data?.error || calendars.error || "Connection failed"} />}
    {status.data?.calendarId && <GoogleAgenda />}
  </Card>;
}
export function GoogleAgenda() {
  const [range] = useState(() => ({ start: new Date().toISOString(), end: new Date(Date.now() + 7 * 86400000).toISOString() }));
  const events = useApi<{ calendarName: string; incomplete: boolean; items: { id: string; summary: string; start: { dateTime?: string; date?: string } }[] }>("/api/google?mode=events&" + new URLSearchParams(range));
  return <div className="mt-4 border-t border-line pt-3"><div className="flex gap-3 items-center"><h3 className="text-sm font-medium">Google events · next 7 days</h3><button className="btn btn-sm" onClick={events.reload}>Test / refresh calendar</button></div>{events.error && <ErrorBox message={events.error} />}{events.loading ? <p className="text-sm mt-2">Reading Google Calendar…</p> : events.data && <><p className="text-xs text-ink-3 mt-2">{events.data.calendarName}{events.data.incomplete ? " · More events exist; this list is incomplete" : ""}</p>{!events.data.items.length && <p className="text-sm mt-2">Connection works. No events in the next 7 days.</p>}<ul className="space-y-2 mt-2 text-sm">{events.data.items.map((e) => <li key={e.id}>{e.start.dateTime ? new Date(e.start.dateTime).toLocaleString() : e.start.date} — {e.summary}</li>)}</ul></>}</div>;
}
export function GoogleCalendarPanel() {
  const status = useApi<Status>("/api/google");
  return <Card className="mt-4" title="Google Calendar"><p className="text-sm text-ink-3">The grid above shows local RealtorPro records. Google events are listed separately below; no automatic two-way synchronization.</p><Link href="/integrations" className="link text-sm mt-2 inline-block">Connect / manage Google Calendar →</Link>{status.error && <ErrorBox message={status.error} />}{status.data?.calendarId ? <GoogleAgenda key={status.data.calendarId} /> : <p className="text-sm mt-2">Choose a connected Google calendar in Integrations to view events here.</p>}</Card>;
}
