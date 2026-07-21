"use client";

import { useApp } from "../app-state";

export function SettingsScreen() {
  const app = useApp();
  return (
    <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, maxWidth: 1100, alignItems: "start" }}>
      <div className="card elev-sm" style={{ padding: 18, gap: 12 }}>
        <div className="card-kicker">Profile</div>
        <Field id="st-name" label="Name on outgoing drafts" value="Avery Sandoval" />
        <Field id="st-lic" label="License" value="OR #201415632 · PDX Homes" />
        <Field id="st-area" label="Service areas" value="Portland metro — inner east side, N Portland" />
      </div>

      <div className="card elev-sm" style={{ padding: 18, gap: 12 }}>
        <div className="card-kicker">Defaults</div>
        <div className="field">
          <label htmlFor="st-voice">Default brand voice</label>
          <select id="st-voice" className="input" defaultValue="Warm, concrete, no hype">
            <option>Warm, concrete, no hype</option>
            <option>Architectural &amp; spare</option>
            <option>Story-led, neighborly</option>
          </select>
        </div>
        <Field id="st-quiet" label="Quiet hours (no draft pushes)" value="9:00 PM – 7:00 AM" />
        <div className="field">
          <label htmlFor="st-cadence">Nurture cadence</label>
          <select id="st-cadence" className="input" defaultValue="Quarterly + anniversaries">
            <option>Quarterly + anniversaries</option>
            <option>Monthly</option>
            <option>Manual only</option>
          </select>
        </div>
      </div>

      <div className="card elev-sm" style={{ padding: 18, gap: 10 }}>
        <div className="card-kicker">Local data</div>
        <p style={{ fontSize: 13, margin: 0 }} className="text-muted">
          Everything AgentOS stores — criteria, imports, drafts, the disclosure log — lives on this machine. 84 MB used. Follow Up Boss remains the system of record for client data.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={app.onExport}>Export all local data</button>
          <button className="btn btn-ghost">Erase local data…</button>
        </div>
      </div>

      <div className="card elev-sm" style={{ padding: 18, gap: 8 }}>
        <div className="card-kicker">Appearance</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
          <span>Theme</span>
          <button className="btn btn-secondary" onClick={app.toggleTheme}>
            {app.theme === "light" ? "Switch to dark" : "Switch to light"}
          </button>
        </div>
        <div className="card-kicker" style={{ marginTop: 8 }}>Keyboard</div>
        <Row k="Search" v="⌘K" />
        <Row k="Capture note" v="N" />
        <Row k="Close dialog" v="Esc" last />
      </div>
    </section>
  );
}

function Field({ id, label, value }: { id: string; label: string; value: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" defaultValue={value} />
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "5px 0", borderBottom: last ? "none" : "1px solid var(--color-divider)" }}>
      <span>{k}</span>
      <strong>{v}</strong>
    </div>
  );
}
