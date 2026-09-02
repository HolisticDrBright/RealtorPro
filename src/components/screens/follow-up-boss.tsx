"use client";

import { DATA } from "@/data/mock-data";
import { useApp } from "../app-state";
import { Spinner } from "../icons";
import { FUB_META } from "../ui";

export function FubScreen() {
  const app = useApp();
  const meta = FUB_META[app.fubSync];
  const lastSync = app.fubSync === "disconnected" ? "—" : app.lastSync;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 900 }}>
      <div className="card elev-sm" style={{ padding: 20, gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span className={meta.chipClass}>{meta.chip}</span>
          <h4 style={{ margin: 0, fontSize: 19 }}>{meta.title}</h4>
        </div>
        <p style={{ fontSize: 14.5, margin: 0, maxWidth: 640 }} className="text-muted">{meta.body}</p>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13.5, borderTop: "1px solid var(--color-divider)", paddingTop: 10 }}>
          <span><strong>Account</strong> &nbsp;Avery Sandoval · averys@pdxhomes.example</span>
          <span><strong>Last sync</strong> &nbsp;{lastSync}</span>
          <span><strong>Scope</strong> &nbsp;Read + draft-write only</span>
        </div>
        {meta.showErr && (
          <div role="alert" style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "10px 14px", fontSize: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <strong>Push failed 8:15 AM.</strong> 1 draft note (Whitfield) was not delivered — FUB rate-limited the request. Your local copy is safe.
            <button className="btn btn-secondary" style={{ marginLeft: "auto" }} onClick={app.onSync}>Retry push</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {meta.connected ? (
            <>
              <button className="btn btn-primary" onClick={app.onSync} disabled={app.syncing}>
                {app.syncing && <Spinner size={13} onDark />}
                {app.syncing ? "Syncing…" : "Sync now"}
              </button>
              <button className="btn btn-secondary">Pause sync</button>
              <button className="btn btn-ghost">Disconnect account</button>
            </>
          ) : (
            <>
              <button className="btn btn-primary">Connect Follow Up Boss</button>
              <button className="btn btn-ghost">What gets shared?</button>
            </>
          )}
        </div>
      </div>

      <div style={{ border: "2px solid var(--color-accent)", padding: "12px 16px", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
        <span className="tag tag-accent">Drafts, never sends</span>
        <span style={{ fontSize: 14 }}>
          Every message AgentOS writes — emails, texts, notes — lands in Follow Up Boss as a <strong>draft</strong>. Nothing reaches a client until you review and send it yourself.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
        <div>
          <h6 style={{ margin: 0, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>What AgentOS can do in your account</h6>
          {DATA.fub.permissions.map((pm) => (
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
              {DATA.fub.log.map((sl, i) => (
                <tr key={i}>
                  <td>{sl.time}</td>
                  <td>{sl.dir}</td>
                  <td>{sl.items}</td>
                  <td><span className="tag tag-neutral" style={{ fontSize: 10 }}>{sl.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
