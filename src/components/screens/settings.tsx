"use client";

import { useState } from "react";
import { fmtWhen, useApp } from "../app-state";
import { errText, postJson } from "../modules/shared";

/**
 * Settings — the agent profile from the local database, the three data
 * connections (Follow Up Boss, Claude, Obsidian) with live status, local data
 * controls, and appearance.
 */

const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(1) + " MB";
const fmt = (iso: string | null) => fmtWhen(iso, "never");

export function SettingsScreen() {
  const app = useApp();
  const s = app.integrations;
  const agent = s?.agent;
  const [indexing, setIndexing] = useState(false);

  async function indexVault() {
    setIndexing(true);
    const res = await postJson("/api/obsidian/sync", {});
    setIndexing(false);
    if (res.ok) {
      const r = (res.data as { result: { added: number; updated: number; removed: number; linked: number; total: number } }).result;
      app.say(`Vault indexed: ${r.total} notes (${r.added} new, ${r.updated} updated, ${r.removed} removed, ${r.linked} linked to contacts or properties).`);
      app.reloadIntegrations();
    } else app.say(errText(res.data));
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, maxWidth: 1100, alignItems: "start" }}>
      <div className="card elev-sm" style={{ padding: 18, gap: 12 }}>
        <div className="card-kicker">Profile</div>
        <Field id="st-name" label="Name on outgoing drafts" value={agent?.name ?? ""} />
        <Field id="st-lic" label="License" value={agent?.license ?? ""} />
        <Field id="st-area" label="Service areas" value={(agent?.serviceAreas ?? []).join(", ")} />
        <p className="text-muted" style={{ margin: 0, fontSize: 12.5 }}>Edit the profile in <code>src/db/seed.ts</code> or the <code>user_profiles</code> table; an in-app editor is on the roadmap.</p>
      </div>

      <div className="card elev-sm" style={{ padding: 18, gap: 12 }}>
        <div className="card-kicker">Data connections</div>
        <Conn
          name="Follow Up Boss"
          ok={!!s?.fub.configured}
          okLabel="Connected"
          badLabel="Demo data"
          detail={s ? (s.fub.configured ? `${s.fub.fubLinkedContacts} contacts linked · last sync ${fmt(s.fub.lastSyncAt)}` : "Set FUB_API_KEY in .env, restart, then Sync now.") : "Checking…"}
          action={<button className="btn btn-secondary" onClick={app.onSync} disabled={app.syncing}>{app.syncing ? "Syncing…" : "Sync now"}</button>}
        />
        <Conn
          name="Claude"
          ok={!!s?.claude.configured}
          okLabel={s?.claude.llmProvider === "anthropic" ? `On · ${s.claude.model}` : "Briefing only"}
          badLabel="Off"
          detail={s ? (s.claude.configured ? (s.claude.llmProvider === "anthropic" ? "Writes the daily game plan, extracts listings from pasted alerts, and drafts Listing Studio copy from the fact ledger." : "Writes the daily game plan. Set AGENTOS_LLM_PROVIDER=anthropic to also use Claude for extraction and drafting.") : "Set ANTHROPIC_API_KEY in .env and restart. Claude only ever writes text for you to read; it never contacts clients.") : "Checking…"}
          action={<button className="btn btn-ghost" onClick={() => app.goto("dashboard")}>Try the briefing</button>}
        />
        <Conn
          name="Obsidian vault"
          ok={!!s?.obsidian.exists}
          okLabel={s?.obsidian.dirName ?? "Linked"}
          badLabel={s?.obsidian.configured ? "Folder not found" : "Not linked"}
          detail={s ? (s.obsidian.exists ? `${s.obsidian.noteCount} notes indexed · last ${fmt(s.obsidian.lastIndexedAt)} · AgentOS writes only into “${s.obsidian.writeFolder}/” · Claude ${s.obsidian.allowClaude ? "may read excerpts" : "cannot read the vault"}` : "Set OBSIDIAN_VAULT_DIR in .env to your vault folder and restart. Notes are read in place and never edited.") : "Checking…"}
          action={<button className="btn btn-secondary" onClick={indexVault} disabled={indexing || !s?.obsidian.exists}>{indexing ? "Indexing…" : "Re-index vault"}</button>}
          last
        />
      </div>

      <div className="card elev-sm" style={{ padding: 18, gap: 12 }}>
        <div className="card-kicker">Defaults</div>
        <div className="field">
          <label htmlFor="st-voice">Default brand voice</label>
          <select id="st-voice" className="input" defaultValue={agent?.defaultBrandVoice ?? "Warm, concrete, no hype"}>
            <option>Warm, concrete, no hype</option>
            <option>Architectural &amp; spare</option>
            <option>Story-led, neighborly</option>
          </select>
        </div>
        <Field id="st-quiet" label="Quiet hours (no draft pushes)" value={agent?.quietHours ?? ""} />
        <div className="field">
          <label htmlFor="st-cadence">Nurture cadence</label>
          <select id="st-cadence" className="input" defaultValue={agent?.nurtureCadence ?? "Quarterly + anniversaries"}>
            <option>Quarterly + anniversaries</option>
            <option>Monthly</option>
            <option>Manual only</option>
          </select>
        </div>
      </div>

      <div className="card elev-sm" style={{ padding: 18, gap: 10 }}>
        <div className="card-kicker">Local data</div>
        <p style={{ fontSize: 14, margin: 0 }} className="text-muted">
          Everything AgentOS stores — the mirrored FUB records, criteria, imports, drafts, the disclosure log and the vault index — lives on this machine{s ? ` (${mb(s.workspaceBytes)} in the workspace folder)` : ""}. Follow Up Boss and your vault remain the systems of record.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={app.onExport}>Export all local data</button>
        </div>
        <p className="text-muted" style={{ margin: 0, fontSize: 12.5 }}>To erase local data run <code>npm run db:reset</code>; it never touches Follow Up Boss or your vault.</p>
      </div>

      <div className="card elev-sm" style={{ padding: 18, gap: 8 }}>
        <div className="card-kicker">Appearance</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
          <span>Theme</span>
          <button className="btn btn-secondary" onClick={app.toggleTheme}>{app.theme === "light" ? "Switch to dark" : "Switch to light"}</button>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, marginTop: 6 }}>
          <span>Interface</span>
          <button className="btn btn-secondary" onClick={app.toggleUi}>{app.ui === "glass" ? "Switch to Modernist (flat)" : "Switch to Apple glass"}</button>
        </div>
        <div className="card-kicker" style={{ marginTop: 8 }}>Keyboard</div>
        <Row k="Capture note" v="N" />
        <Row k="Close dialog" v="Esc" last />
      </div>
    </section>
  );
}

function Conn({ name, ok, okLabel, badLabel, detail, action, last }: { name: string; ok: boolean; okLabel: string; badLabel: string; detail: string; action: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderBottom: last ? "none" : "1px solid var(--color-divider)" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ fontSize: 14.5 }}>{name}</strong>
          <span className={ok ? "tag tag-accent" : "tag tag-outline"} style={{ fontSize: 10 }}>{ok ? okLabel : badLabel}</span>
        </div>
        <div className="text-muted" style={{ fontSize: 13, marginTop: 3 }}>{detail}</div>
      </div>
      <div style={{ flex: "none" }}>{action}</div>
    </div>
  );
}

function Field({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" defaultValue={value} key={value} readOnly />
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, padding: "5px 0", borderBottom: last ? "none" : "1px solid var(--color-divider)" }}>
      <span>{k}</span>
      <strong>{v}</strong>
    </div>
  );
}
