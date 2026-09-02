"use client";

import { useState } from "react";
import { api, bump, toast, useApi } from "@/lib/client";
import { fmtDateTime } from "@/lib/dates";
import { Badge, Card, Confirm, Loading, PageHeader } from "@/components/ui/primitives";

interface Status { claude: { configured: boolean; model: string }; obsidian: { configured: boolean; exists: boolean; dir: string | null; dirName: string | null; writeFolder: string; noteCount: number; importable: number; linked: number; lastIndexedAt: string | null; allowClaude: boolean }; workspace: { contacts: number; properties: number; empty: boolean } }
interface Report { created: Record<string, number>; updated: Record<string, number>; skipped: string[] }
type Bundle = Record<string, Record<string, unknown>[]>;

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const describe = (r: Report) => [...Object.entries(r.created).map(([k, v]) => `${v} new ${k}`), ...Object.entries(r.updated).map(([k, v]) => `${v} updated ${k}`)].join(" · ") || "nothing to change";

export default function IntegrationsPage() {
  const { data, loading, reload } = useApi<Status>("/api/integrations/status");
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [folder, setFolder] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [preview, setPreview] = useState<{ bundle: Bundle; report: Report; source: string; notes?: { path: string; title: string; type?: string }[]; model?: string } | null>(null);

  async function run(label: string, fn: () => Promise<void>) { setBusy(label); try { await fn(); } finally { setBusy(null); } }
  async function reindex() { const r = await api.post<{ result: { total: number; added: number; updated: number; linked: number } }>("/api/obsidian/sync"); if (r.ok) toast(`Indexed ${r.data.result.total} notes · ${r.data.result.linked} linked to records`); else toast(r.message ?? "Failed", "err"); reload(); }
  async function previewVault() { const r = await api.post<{ report: Report; bundle: Bundle; notes: { path: string; title: string; type: string }[] }>("/api/obsidian/import", { dryRun: true }); if (r.ok) setPreview({ bundle: r.data.bundle, report: r.data.report, source: "Obsidian", notes: r.data.notes }); else toast(r.message ?? "Failed", "err"); }
  async function previewClaude() { const r = await api.post<{ bundle: Bundle; preview: Report; model: string }>("/api/claude/extract", { text }); if (r.ok) { setPreview({ bundle: r.data.bundle, report: r.data.preview, source: "Claude", model: r.data.model }); toast(`Claude found ${sum(r.data.preview.created) + sum(r.data.preview.updated)} records — review below`); } else toast(r.message ?? "Failed", "err"); }
  async function previewClaudeVault() {
    const r = await api.post<{ bundle: Bundle; preview: Report; model: string; notesRead: number; batches: number; notes: { path: string; title: string }[] }>("/api/obsidian/extract", { folder: folder.trim() || undefined });
    if (r.ok) { setPreview({ bundle: r.data.bundle, report: r.data.preview, source: "Obsidian via Claude", notes: r.data.notes, model: r.data.model }); toast(`Claude read ${r.data.notesRead} notes and found ${sum(r.data.preview.created) + sum(r.data.preview.updated)} records — review below`); }
    else toast(r.message ?? "Failed", "err");
  }
  async function apply() { if (!preview) return; const r = await api.post<{ report: Report }>("/api/import/apply", { bundle: preview.bundle, source: preview.source }); if (r.ok) { toast(`Imported: ${describe(r.data.report)}`); setPreview(null); setText(""); bump(); reload(); } else toast(r.message ?? "Import failed", "err"); }
  async function clearAll() { setConfirmClear(false); const r = await api.post<{ total: number }>("/api/admin/clear", { confirm: "DELETE" }); if (r.ok) { toast(`Removed ${r.data.total} records. The command center is empty and ready for your data.`); bump(); reload(); } else toast(r.message ?? "Failed", "err"); }

  if (loading || !data) return <Loading rows={5} />;
  const o = data.obsidian, c = data.claude, w = data.workspace;
  const claudeVaultReady = c.configured && o.exists && o.allowClaude;
  return (
    <div className="fade-in">
      <PageHeader title="Integrations" sub="Claude and your Obsidian vault feed the dashboard. Everything is reviewed before it is saved." />

      <Card className="mb-4" title={<h2 className="card-title flex items-center gap-2">Your data <Badge tone={w.empty ? "neutral" : "ok"}>{w.empty ? "Empty" : `${w.contacts} contacts · ${w.properties} properties`}</Badge></h2>} action={!w.empty && <button className="card-link text-crit" onClick={() => setConfirmClear(true)}>Start fresh: delete every record</button>}>
        <div className="text-[13px] text-ink-2">
          {w.empty
            ? <p>The command center is empty. Fill it three ways, in any order: paste text for Claude to read (left), import from your Obsidian vault (right), or let Claude Cowork / Desktop add records through the MCP server (bottom). You can also add records by hand with <b>+ Add</b>.</p>
            : <p>The app ships with fictional Orange County sample data so every screen has something to show. When you are ready for real data, press <b>Start fresh</b>: it deletes every contact, property, listing, escrow, task, call, appointment, note and alert, and keeps your name, brokerage, income goal and commission defaults. The same thing from a terminal: <code>npm run db:clear</code>.</p>}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={<h2 className="card-title flex items-center gap-2">Claude <Badge tone={c.configured ? "ok" : "neutral"}>{c.configured ? `On · ${c.model}` : "Not connected"}</Badge></h2>}>
          {!c.configured && <div className="rounded-lg bg-ground p-4 text-[13px] space-y-2"><div className="font-medium">Connect in two steps</div><ol className="list-decimal pl-5 space-y-1 text-ink-2"><li>Get an API key at console.anthropic.com → API Keys.</li><li>Open <code>.env</code> in the project folder, set <code>ANTHROPIC_API_KEY=</code> to the key, restart <code>npm run dev</code>.</li></ol></div>}
          <div className="mt-3 text-[13px] text-ink-2">Paste anything — an email thread, meeting notes, a spreadsheet export, an Obsidian note, a lead sheet. Claude turns it into contacts, buyers, sellers, properties, listings, escrows, tasks and notes. You review the list, then import.</div>
          <textarea className="input mt-3 min-h-[160px]" placeholder={"e.g.\nMet the Andersons at the Coral Ridge open house. Mark & Lisa, (714) 555-7788, looking $2–3.5M in North Tustin, need a flat lot for a pool and space for in-laws, pre-approved with Chase. Follow up Friday.\nAlso: seller at 1 Pelican Hill Cir (Steven Brooks) may list in October around $8.5M, off-market first."} value={text} onChange={(e) => setText(e.target.value)} disabled={!c.configured} />
          <div className="flex gap-2 mt-2 flex-wrap"><button className="btn btn-primary" disabled={!c.configured || !text.trim() || busy === "claude"} onClick={() => run("claude", previewClaude)}>{busy === "claude" ? "Reading…" : "Extract records with Claude"}</button><span className="text-[12px] text-ink-3 self-center">Nothing is saved until you press Import below.</span></div>
        </Card>

        <Card title={<h2 className="card-title flex items-center gap-2">Obsidian vault <Badge tone={o.exists ? "ok" : "neutral"}>{o.exists ? o.dirName : o.configured ? "Folder not found" : "Not connected"}</Badge></h2>}>
          {!o.exists && <div className="rounded-lg bg-ground p-4 text-[13px] space-y-2"><div className="font-medium">Connect</div><ol className="list-decimal pl-5 space-y-1 text-ink-2"><li>Open <code>.env</code> and set <code>OBSIDIAN_VAULT_DIR=</code> to your vault folder{o.dir ? ` (currently ${o.dir}, which doesn't exist)` : ""}, e.g. <code>/Users/you/Documents/MyVault</code> on a Mac or <code>C:\Users\you\Documents\MyVault</code> on Windows.</li><li>Restart <code>npm run dev</code> and press Re-index.</li></ol></div>}
          {o.exists && <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px]">{[["Notes indexed", o.noteCount], ["Linked to a contact", o.linked], ["Notes with type: frontmatter", o.importable], ["Last indexed", fmtDateTime(o.lastIndexedAt)], ["App writes only into", `${o.writeFolder}/`]].map(([k, v]) => <div key={String(k)} className="flex justify-between gap-3 border-b border-line-2 py-1.5"><dt className="text-ink-3">{k}</dt><dd className="font-medium">{String(v)}</dd></div>)}</dl>}
          <div className="flex gap-2 mt-3 flex-wrap"><button className="btn" disabled={!o.exists || busy === "index"} onClick={() => run("index", reindex)}>{busy === "index" ? "Indexing…" : "Re-index vault"}</button><button className="btn btn-primary" disabled={!o.exists || busy === "vault"} onClick={() => run("vault", previewVault)}>{busy === "vault" ? "Reading…" : "Import typed notes"}</button></div>

          <div className="mt-4 rounded-lg border border-line p-3">
            <div className="text-[13px] font-medium flex items-center gap-2">Let Claude read the vault <Badge tone={claudeVaultReady ? "ok" : "neutral"}>{claudeVaultReady ? "Ready" : "Off"}</Badge></div>
            <p className="text-[12.5px] text-ink-2 mt-1">For vaults where the notes are written however you like — no frontmatter needed. Claude reads the notes and proposes contacts, buyers, sellers, properties, listings, escrows and tasks; you review, then import. Note text is sent to the Anthropic API for this, so it is off until you allow it.</p>
            {!claudeVaultReady && <ol className="list-decimal pl-5 mt-2 space-y-1 text-[12.5px] text-ink-2">{!c.configured && <li>Connect Claude (left).</li>}{!o.exists && <li>Connect the vault (above).</li>}{!o.allowClaude && <li>In <code>.env</code> set <code>OBSIDIAN_ALLOW_CLAUDE=true</code>, then restart <code>npm run dev</code>.</li>}</ol>}
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
              <div className="overflow-x-auto"><table className="w-full text-[12.5px]"><tbody>{rows.map((r, i) => <tr key={i} className="border-b border-line-2 align-top"><td className="py-1.5 pr-3 font-medium whitespace-nowrap">{String(r.name ?? r.address ?? r.title ?? r.body ?? "").slice(0, 60)}</td><td className="py-1.5 text-ink-2">{Object.entries(r).filter(([k, v]) => !["name", "address", "title", "body"].includes(k) && v != null && v !== "" && !(Array.isArray(v) && v.length === 0)).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(" · ").slice(0, 400)}</td></tr>)}</tbody></table></div>
            </div>
          ))}
          {Object.values(preview.bundle).every((v) => v.length === 0) && <div className="text-[13px] text-ink-3 mb-3">Nothing recognisable in that text.</div>}
          {preview.report.skipped.length > 0 && <div className="text-[12.5px] text-ink-3 mb-3">Skipped: {preview.report.skipped.join("; ")}</div>}
          <div className="flex gap-2"><button className="btn btn-primary" disabled={busy === "apply"} onClick={() => run("apply", apply)}>{busy === "apply" ? "Importing…" : "Import into the command center"}</button><button className="btn" onClick={() => setPreview(null)}>Discard</button></div>
        </Card>
      )}

      <Card className="mt-4" title="Let Claude (Cowork, Desktop, or Claude Code) update this dashboard directly">
        <div className="text-[13px] text-ink-2 space-y-2">
          <p>The app ships an MCP server so a Claude agent on your computer can read and write your records — add listings it found, update to-dos from your email, log calls, or walk through your Obsidian vault folder by folder and import what it finds. Run <code>npm run mcp:config</code> to print the config block, then paste it into Claude Desktop / Cowork → Settings → Developer → Edit Config (or <code>claude mcp add</code> for Claude Code). Keep the app running (<code>npm run dev</code>) while Claude works.</p>
          <p>Tools it gets: <code>get_dashboard</code>, <code>search</code>, <code>list_records</code>, <code>create_record</code>, <code>update_record</code>, <code>import_records</code>, <code>add_tasks</code>, <code>log_activity</code>. Every write goes through the same validation and business rules as the buttons in this app.</p>
          <p className="text-ink-3">Try: “Read every note in my Obsidian vault’s Clients folder and import the people, their buying criteria and any listings into my command center. Preview first.”</p>
        </div>
      </Card>

      <Confirm open={confirmClear} title="Delete every record?" body="All contacts, buyers, sellers, properties, listings, escrows, offers, tasks, calls, appointments, notes, opportunities and alerts will be removed. Your name, brokerage, income goal and commission defaults stay. This cannot be undone." confirmLabel="Delete everything" onConfirm={clearAll} onCancel={() => setConfirmClear(false)} />
    </div>
  );
}
