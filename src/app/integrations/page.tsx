"use client";

import { useState } from "react";
import Link from "next/link";
import { ClaudeSettings, VaultSettings, ProfileSettings } from "@/components/app/connection-settings";
import type { ClaudeConnectionStatus } from "@/components/app/connection-settings";
import { BackupSettings } from "@/components/app/backup-settings";
import { api, bump, toast, useApi } from "@/lib/client";
import { fmtDateTime } from "@/lib/dates";
import { Badge, Card, Confirm, ErrorBox, Loading, PageHeader } from "@/components/ui/primitives";

interface Status { claude: ClaudeConnectionStatus; obsidian: { configured: boolean; exists: boolean; dir: string | null; dirName: string | null; writeFolder: string; noteCount: number; importable: number; linked: number; lastIndexedAt: string | null; allowClaude: boolean; include: string[]; exclude: string[] }; workspace: { contacts: number; properties: number; empty: boolean } }
interface Report { created: Record<string, number>; updated: Record<string, number>; skipped: string[] }
type Bundle = Record<string, Record<string, unknown>[]>;

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const describe = (r: Report) => [...Object.entries(r.created).map(([k, v]) => `${v} new ${k}`), ...Object.entries(r.updated).map(([k, v]) => `${v} updated ${k}`)].join(" · ") || "nothing to change";

export default function IntegrationsPage() {
  const { data, error, loading, reload } = useApi<Status>("/api/integrations/status");
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [folder, setFolder] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [preview, setPreview] = useState<{ reviewId: string; bundle: Bundle; report: Report; source: string; notes?: { path: string; title: string; type?: string }[]; model?: string } | null>(null);

  async function run(label: string, fn: () => Promise<void>) { setBusy(label); try { await fn(); } finally { setBusy(null); } }
  async function reindex() { const r = await api.post<{ result: { total: number; added: number; updated: number; linked: number } }>("/api/obsidian/sync"); if (r.ok) toast(`Indexed ${r.data.result.total} notes · ${r.data.result.linked} linked to records`); else toast(r.message ?? "Failed", "err"); reload(); }
  async function previewVault() { const r = await api.post<{ reviewId: string; report: Report; bundle: Bundle; notes: { path: string; title: string; type: string }[] }>("/api/obsidian/import", { dryRun: true }); if (r.ok) setPreview({ reviewId: r.data.reviewId, bundle: r.data.bundle, report: r.data.report, source: "Obsidian", notes: r.data.notes }); else toast(r.message ?? "Failed", "err"); }
  async function previewClaude() { const r = await api.post<{ reviewId: string; bundle: Bundle; preview: Report; model: string }>("/api/claude/extract", { text }); if (r.ok) { setPreview({ reviewId: r.data.reviewId, bundle: r.data.bundle, report: r.data.preview, source: "Claude", model: r.data.model }); toast(`Claude found ${sum(r.data.preview.created) + sum(r.data.preview.updated)} records — review below`); } else toast(r.message ?? "Failed", "err"); }
  async function previewClaudeVault() {
    const r = await api.post<{ reviewId: string; bundle: Bundle; preview: Report; model: string; notesRead: number; batches: number; notes: { path: string; title: string }[] }>("/api/obsidian/extract", { folder: folder.trim() || undefined });
    if (r.ok) { setPreview({ reviewId: r.data.reviewId, bundle: r.data.bundle, report: r.data.preview, source: "Obsidian via Claude", notes: r.data.notes, model: r.data.model }); toast(`Claude read ${r.data.notesRead} notes and found ${sum(r.data.preview.created) + sum(r.data.preview.updated)} records — review below`); }
    else toast(r.message ?? "Failed", "err");
  }
  async function apply() { if (!preview) return; const r = await api.post<{ report: Report }>("/api/import/apply", { reviewId: preview.reviewId, approve: true, confirm: true }); if (r.ok) { toast(`Imported: ${describe(r.data.report)}`); setPreview(null); setText(""); bump(); reload(); } else toast(r.message ?? "Import failed", "err"); }
  async function clearAll() { setConfirmClear(false); const r = await api.post<{ total: number }>("/api/admin/clear", { confirm: "DELETE" }); if (r.ok) { toast(`Removed ${r.data.total} records. The command center is empty and ready for your data.`); bump(); reload(); } else toast(r.message ?? "Failed", "err"); }

  if (loading) return <Loading rows={5} />;
  if (error || !data) return <ErrorBox message={error || "Cannot load connections"} onRetry={reload} />;
  const o = data.obsidian, c = data.claude, w = data.workspace;
  const claudeVaultReady = c.configured && o.exists && o.allowClaude;
  return (
    <div className="fade-in">
      <PageHeader title="Integrations" sub="Claude and your Obsidian vault feed the dashboard. Everything is reviewed before it is saved." />
      <ProfileSettings />

      <Card className="mb-4" title={<h2 className="card-title flex items-center gap-2">Your data <Badge tone={w.empty ? "neutral" : "ok"}>{w.empty ? "Empty" : `${w.contacts} contacts · ${w.properties} properties`}</Badge></h2>} action={!w.empty && <button className="card-link text-crit" onClick={() => setConfirmClear(true)}>Start fresh: delete every record</button>}>
        <div className="text-[13px] text-ink-2">
          {w.empty
            ? <p>The command center is empty. Fill it three ways, in any order: paste text for Claude to read (left), import from your Obsidian vault (right), or let Claude Cowork / Desktop add records through the MCP server (bottom). You can also add records by hand with <b>+ Add</b>.</p>
            : <p>This workspace contains your saved records. <b>Start fresh</b> deletes every contact, property, listing, escrow, task, call, appointment, note and alert, and keeps your name, brokerage, income goal and commission defaults. An automatic database backup is created before clearing.</p>}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={<h2 className="card-title flex items-center gap-2">Claude <Badge tone={c.configured ? "ok" : "neutral"}>{c.configured ? `${c.verifiedAt ? "Verified" : "Configured"} · ${c.model}` : "Not connected"}</Badge></h2>}>
          <ClaudeSettings {...c} reload={reload} />
          <div className="mt-3 text-[13px] text-ink-2">Paste anything — an email thread, meeting notes, a spreadsheet export, an Obsidian note, a lead sheet. Claude turns it into contacts, buyers, sellers, properties, listings, escrows, tasks and notes. You review the list, then import.</div>
          <textarea className="input mt-3 min-h-[160px]" placeholder={"e.g.\nMet the Andersons at the Coral Ridge open house. Mark & Lisa, (714) 555-7788, looking $2–3.5M in North Tustin, need a flat lot for a pool and space for in-laws, pre-approved with Chase. Follow up Friday.\nAlso: seller at 1 Pelican Hill Cir (Steven Brooks) may list in October around $8.5M, off-market first."} value={text} onChange={(e) => setText(e.target.value)} disabled={!c.configured} />
          <div className="flex gap-2 mt-2 flex-wrap"><button className="btn btn-primary" disabled={!c.configured || !text.trim() || busy === "claude"} onClick={() => run("claude", previewClaude)}>{busy === "claude" ? "Reading…" : "Extract records with Claude"}</button><span className="text-[12px] text-ink-3 self-center">Nothing is saved until you press Import below.</span></div>
        </Card>

        <Card title={<h2 className="card-title flex items-center gap-2">Obsidian vault <Badge tone={o.exists ? "ok" : "neutral"}>{o.exists ? o.dirName : o.configured ? "Folder not found" : "Not connected"}</Badge></h2>}>
          <VaultSettings key={`${o.dir}-${o.allowClaude}`} dir={o.dir} include={o.include} exclude={o.exclude} allowClaude={o.allowClaude} isMac={c.platform === "darwin"} reload={reload} />
          {o.exists && <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">{[["Notes indexed", o.noteCount], ["Linked to a contact", o.linked], ["Notes with type: frontmatter", o.importable], ["Last indexed", fmtDateTime(o.lastIndexedAt)], ["App writes only into", `${o.writeFolder}/`]].map(([k, v]) => <div key={String(k)} className="flex justify-between gap-3 border-b border-line-2 py-1.5"><dt className="text-ink-3">{k}</dt><dd className="font-medium">{String(v)}</dd></div>)}</dl>}
          <div className="flex gap-2 mt-3 flex-wrap"><button className="btn" disabled={!o.exists || busy === "index"} onClick={() => run("index", reindex)}>{busy === "index" ? "Indexing…" : "Re-index vault"}</button><button className="btn btn-primary" disabled={!o.exists || busy === "vault"} onClick={() => run("vault", previewVault)}>{busy === "vault" ? "Reading…" : "Import typed notes"}</button></div>

          <div className="mt-4 rounded-lg border border-line p-3">
            <div className="text-[13px] font-medium flex items-center gap-2">Let Claude read the vault <Badge tone={claudeVaultReady ? "ok" : "neutral"}>{claudeVaultReady ? "Ready" : "Off"}</Badge></div>
            <p className="text-[12.5px] text-ink-2 mt-1">Claude reads up to the 20 newest notes in the chosen folder per request and proposes CRM records. API charges apply. Larger selections are capped at 240,000 characters and five requests; oversized notes are rejected instead of silently cut off. Use one client folder at a time. Nothing is imported without your review.</p>
            {!claudeVaultReady && <ol className="list-decimal pl-5 mt-2 space-y-1 text-[12.5px] text-ink-2">{!c.configured && <li>Connect Claude (left).</li>}{!o.exists && <li>Connect the vault (above).</li>}{!o.allowClaude && <li>Enable “Allow selected vault text” above, then Save & connect vault.</li>}</ol>}
            <div className="flex gap-2 mt-2 flex-wrap items-center">
              <input className="input h-9 max-w-[220px]" placeholder="Only this folder (optional)" value={folder} onChange={(e) => setFolder(e.target.value)} disabled={!claudeVaultReady} />
              <button className="btn btn-primary" disabled={!claudeVaultReady || busy === "claude-vault"} onClick={() => run("claude-vault", previewClaudeVault)}>{busy === "claude-vault" ? "Claude is reading… (a minute or two for big vaults)" : "Read vault with Claude"}</button>
            </div>
          </div>

          <details className="mt-4 text-[13px]"><summary className="cursor-pointer font-medium">How to make a note importable without Claude</summary>
            <p className="text-ink-2 mt-2">Add frontmatter with a <code>type</code>. Any fields you leave out stay blank. Money can be written as <code>$2.5M</code> or <code>725k</code>.</p>
            <pre className="mt-2 rounded-lg bg-ground p-3 text-[12px] overflow-x-auto">{`---
type: buyer
name: Mark & Lisa Anderson
phone: (714) 555-7788
email: mark@example.com
temperature: warm
priceMin: $2M
priceMax: $3.5M
areas: [North Tustin, Lemon Heights]
minBeds: 4
mustHaves: [flat lot, in-law suite]
dealBreakers: [steep driveway]
timeline: 6-12 months
nextFollowUp: 2026-09-05
---
Met at the Coral Ridge open house. Want a pool…`}</pre>
            <p className="text-ink-2 mt-2">Other types: <code>contact</code> (add <code>contactType: seller</code>, <code>leadSource</code>), <code>seller</code> (<code>address, estimatedValue, expectedListPrice, motivation</code>), <code>property</code> (<code>address, city, beds, baths, sqft, view</code>), <code>listing</code> (<code>address, listPrice, status, seller, listedAt</code>), <code>transaction</code> (<code>address, client, side, status, price, closingDate</code>), <code>task</code> (<code>title, due, priority, contact</code>), <code>opportunity</code> (<code>address, kind, price, source</code>).</p>
            <p className="text-ink-2 mt-2">Notes without a <code>type</code> still count: any note whose frontmatter, title or <code>[[wikilink]]</code> names a contact or address appears on that record, and open <code>- [ ]</code> checkboxes in today’s daily note or in notes tagged <code>#command-center</code> show up in Today’s Priorities.</p>
          </details>
        </Card>
      </div>

      {preview && (
        <Card className="mt-4" title={<h2 className="card-title">Review import from {preview.source}</h2>} action={<span className="card-link">{describe(preview.report)}{preview.model ? ` · ${preview.model}` : ""}</span>}>
          {preview.notes && <div className="text-[12.5px] text-ink-3 mb-2">{preview.notes.length} note{preview.notes.length === 1 ? "" : "s"} read: {preview.notes.slice(0, 12).map((n) => n.type ? `${n.title} (${n.type})` : n.title).join(", ")}{preview.notes.length > 12 ? ` and ${preview.notes.length - 12} more` : ""}</div>}
          {Object.entries(preview.bundle).filter(([, v]) => v.length).map(([kind, rows]) => (
            <div key={kind} className="mb-4"><div className="kicker mb-1.5">{kind} · {rows.length}</div>
              <div className="overflow-x-auto"><table className="w-full text-[12.5px]"><tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line-2 align-top"><td className="py-1.5 pr-3 font-medium whitespace-nowrap">{String(r.name ?? r.address ?? r.title ?? r.body ?? "")}</td><td className="py-1.5 text-ink-2">{Object.entries(r).filter(([k, v]) => !["name", "address", "title", "body"].includes(k) && v != null && v !== "" && !(Array.isArray(v) && v.length === 0)).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ")}</td></tr>)}</tbody></table></div>
            </div>
          ))}
          {Object.values(preview.bundle).every((v) => v.length === 0) && <div className="text-[13px] text-ink-3 mb-3">Nothing recognisable in that text.</div>}
          {preview.report.skipped.length > 0 && <div className="text-[12.5px] text-ink-3 mb-3">Skipped: {preview.report.skipped.join("; ")}</div>}
          <div className="flex gap-2"><button className="btn btn-primary" disabled={busy === "apply"} onClick={() => run("apply", apply)}>{busy === "apply" ? "Importing…" : "Import into the command center"}</button><button className="btn" onClick={async () => { const r = await api.post("/api/import/apply", { reviewId: preview.reviewId, approve: false, confirm: true }); if (r.ok) setPreview(null); else toast(r.message || "Could not discard", "err"); }}>Discard</button></div>
        </Card>
      )}

      <Card className="mt-4" title="Review Inbox & Claude Desktop">
        <div className="text-[13px] text-ink-2 space-y-2">
          <p>Claude Desktop, Cowork and Claude Code can read CRM records and propose changes through the included MCP connection. Writes wait for your approval here; agents cannot approve their own changes.</p>
          <p>Run <code>npm run mcp:config</code> for the connection settings. Keep this app running. Only connect a trusted desktop agent: its read tools can access CRM information.</p>
          <Link className="btn btn-primary" href="/reviews">Open Review Inbox</Link>
        </div>
      </Card>
      <BackupSettings />
      <Card className="mt-4" title="Other integrations">
        <p className="text-[13px] text-ink-2">Gmail, Google Calendar, Follow Up Boss, OM Studio, Rent Roll Studio, Comp Lab and Signal Scout are not connected or implemented in this command-center branch. The calendar currently shows local appointments only.</p>
      </Card>

      <Confirm open={confirmClear} title="Delete every record?" body="All contacts, buyers, sellers, properties, listings, escrows, offers, tasks, calls, appointments, notes, opportunities and alerts will be removed. Your name, brokerage, income goal and commission defaults stay. An automatic database backup is created first. Restore it from Backups if needed." confirmLabel="Delete everything" onConfirm={clearAll} onCancel={() => setConfirmClear(false)} />
    </div>
  );
}
