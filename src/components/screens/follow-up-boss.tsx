"use client";

import { fmtWhen, useApp } from "../app-state";
import { Spinner } from "../icons";
import { FUB_META } from "../ui";
import { Loading } from "../modules/shared";

/**
 * Follow Up Boss — connection status, a manual "Sync now" that pulls people,
 * tasks, notes, deals and appointments into the local database, and the sync
 * log. Writes back are limited to tasks and DRAFT notes; nothing is sent.
 */

const PERMISSIONS = [
  { scope: "Read people, deals, tasks, notes, appointments", why: "So your database is the source of truth for People & Deals, Buyer Scout and the dashboard." },
  { scope: "Create tasks", why: "Only when you press “Create FUB task” — one task, on a contact matched by FUB id." },
  { scope: "Add draft notes", why: "Voice/text captures and saved emails land as notes marked DRAFT for you to review." },
  { scope: "Never: send email/SMS, create leads, edit or delete records", why: "There is no code path for it. Every outbound message stays with you." },
];

const fmt = (iso: string) => fmtWhen(iso);

export function FubScreen() {
  const app = useApp();
  const status = app.integrations;
  if (!status) return <Loading label="Checking Follow Up Boss…" />;

  const meta = FUB_META[app.fubSync];
  const fub = status.fub;
  const lastErr = fub.log.find((l) => l.status === "error");

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 960 }}>
      <div className="card elev-sm" style={{ padding: 20, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className={meta.chipClass}>{fub.configured ? meta.chip : "Not connected"}</span>
          <h4 style={{ margin: 0, fontSize: 19 }}>{fub.configured ? meta.title : "Showing demo data"}</h4>
        </div>
        <p style={{ fontSize: 14.5, margin: 0, maxWidth: 680 }} className="text-muted">
          {fub.configured
            ? "AgentOS pulls your Follow Up Boss people, deals, tasks, notes and appointments into this machine when you press Sync now, and pushes back only tasks and draft notes you approve."
            : "No FUB_API_KEY is set, so every screen is showing the seeded fictional database. Add your key to connect your real account — nothing is sent to Follow Up Boss until you press a button."}
        </p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13.5, borderTop: "1px solid var(--color-divider)", paddingTop: 10 }}>
          <span><strong>Account</strong> &nbsp;{status.agent?.name ?? "—"}{status.agent?.email ? ` · ${status.agent.email}` : ""}</span>
          <span><strong>Last sync</strong> &nbsp;{fmtWhen(fub.lastSyncAt)}</span>
          <span><strong>Contacts</strong> &nbsp;{fub.fubLinkedContacts} linked to FUB of {fub.contactCount}</span>
          <span><strong>Scope</strong> &nbsp;Read + task/draft-note write only</span>
        </div>
        {lastErr && fub.configured && (
          <div role="alert" style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "10px 14px", fontSize: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <strong>Last sync problem {fmt(lastErr.createdAt)}.</strong> {lastErr.detail ?? "Follow Up Boss returned an error."} Your local copy is safe.
            <button className="btn btn-secondary" style={{ marginLeft: "auto" }} onClick={app.onSync}>Retry</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={app.onSync} disabled={app.syncing}>
            {app.syncing && <Spinner size={13} onDark />}
            {app.syncing ? "Syncing…" : fub.configured ? "Sync now" : "Test sync (no key)"}
          </button>
          <button className="btn btn-ghost" onClick={app.reloadIntegrations}>Refresh status</button>
        </div>
      </div>

      {!fub.configured && (
        <div className="card elev-sm" style={{ padding: 18, gap: 8 }}>
          <div className="card-kicker">Connect your account</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 14, lineHeight: 1.6 }}>
            <li>In Follow Up Boss go to <strong>Admin → API</strong> and create an API key for AgentOS.</li>
            <li>Open the <code>.env</code> file in the project folder and set <code>FUB_API_KEY=</code> to that key. Never share or commit it.</li>
            <li>Restart the app (<code>npm run dev</code>), come back here and press <strong>Sync now</strong>.</li>
          </ol>
          <p className="text-muted" style={{ margin: 0, fontSize: 13 }}>The key stays in your local .env. AgentOS uses it only for the reads and the two write actions listed below.</p>
        </div>
      )}

      <div style={{ border: "2px solid var(--color-accent)", padding: "12px 16px", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <span className="tag tag-accent">Drafts, never sends</span>
        <span style={{ fontSize: 14 }}>
          Every message AgentOS writes — emails, texts, notes — lands in Follow Up Boss as a <strong>draft</strong>. Nothing reaches a client until you review and send it yourself.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
        <div>
          <h6 style={{ margin: 0, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>What AgentOS can do in your account</h6>
          {PERMISSIONS.map((pm) => (
            <div key={pm.scope} style={{ padding: "10px 0", borderBottom: "1px solid var(--color-divider)" }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{pm.scope}</div>
              <div className="text-muted" style={{ fontSize: 13.5, marginTop: 2 }}>{pm.why}</div>
            </div>
          ))}
        </div>
        <div>
          <h6 style={{ margin: "0 0 2px" }}>Sync log</h6>
          <table className="table" style={{ fontSize: 13.5 }}>
            <thead>
              <tr><th scope="col">Time</th><th scope="col">Direction</th><th scope="col">Items</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {fub.log.map((sl) => (
                <tr key={sl.id}>
                  <td>{fmt(sl.createdAt)}</td>
                  <td>{sl.direction === "pull" ? "Pull" : "Push"}{sl.entity ? ` · ${sl.entity}` : ""}</td>
                  <td>{sl.itemCount}{sl.detail ? <div className="text-muted" style={{ fontSize: 12 }}>{sl.detail}</div> : null}</td>
                  <td><span className={sl.status === "OK" ? "tag tag-neutral" : "tag tag-accent"} style={{ fontSize: 10 }}>{sl.status}</span></td>
                </tr>
              ))}
              {fub.log.length === 0 && <tr><td colSpan={4} className="text-muted" style={{ padding: 14 }}>No syncs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
