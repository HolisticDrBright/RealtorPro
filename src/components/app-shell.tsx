"use client";

import { useEffect } from "react";
import { fmtWhen, useApp } from "./app-state";
import { DashboardScreen } from "./screens/dashboard";

/**
 * Dashboard-only shell: a slim top bar and the dashboard. No sidebar, no
 * other screens. The same API and database power the full app on the
 * `claude/agentos-live-data` branch.
 */
export function AppShell() {
  const app = useApp();
  const s = app.integrations;
  const live = s?.dataMode === "live";

  // Surface the result of a Google connection round-trip (?google=connected|denied|error).
  useEffect(() => {
    const u = new URL(window.location.href);
    const g = u.searchParams.get("google");
    if (!g) return;
    app.say(g === "connected" ? "Google connected — calendar and inbox now feed the briefing (read-only)." : g === "denied" ? "Google connection cancelled." : `Google connection failed: ${u.searchParams.get("message") ?? "unknown error"}`);
    u.searchParams.delete("google"); u.searchParams.delete("message");
    window.history.replaceState({}, "", u.pathname + (u.search || ""));
    app.reloadIntegrations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function disconnectGoogle() {
    await fetch("/api/google/disconnect", { method: "POST" });
    app.say("Google disconnected — local tokens removed.");
    app.reloadIntegrations();
  }

  return (
    <div className="lite-root">
      <header className="lite-bar">
        <div className="lite-brand">
          <span className="lite-wordmark">AgentOS</span>
          <span className="lite-sub">Dashboard</span>
        </div>
        <div className="lite-meta">
          {s?.agent?.name && <span>{s.agent.name}</span>}
          <span className={`lite-chip ${live ? "on" : ""}`} title={live ? `Follow Up Boss connected · last sync ${fmtWhen(s?.fub.lastSyncAt)}` : "Set FUB_API_KEY in .env to connect your account"}>
            {live ? "Live · Follow Up Boss" : "Demo data"}
          </span>
          {s?.claude.configured && <span className="lite-chip on" title={`Claude · ${s.claude.model}`}>Claude</span>}
          {s?.obsidian.exists && <span className="lite-chip on" title={`${s.obsidian.noteCount} notes indexed`}>Obsidian</span>}
          {s?.google.connected ? (
            <button className="lite-chip on" style={{ cursor: "pointer", font: "inherit", fontSize: 11.5, background: "transparent" }} onClick={disconnectGoogle} title={`Connected as ${s.google.email ?? "Google"} · click to disconnect`}>Google ✓</button>
          ) : s?.google.configured ? (
            <a className="lite-btn" href="/api/google/auth" style={{ textDecoration: "none" }}>Connect Google</a>
          ) : null}
          <button className="lite-btn" onClick={app.onSync} disabled={app.syncing}>{app.syncing ? "Syncing…" : "Sync FUB"}</button>
          <button className="lite-btn" onClick={app.toggleTheme} aria-label="Toggle dark mode">{app.theme === "light" ? "Dark" : "Light"}</button>
        </div>
      </header>

      <main className="lite-main">
        <DashboardScreen />
      </main>

      <footer className="lite-foot">
        Local-first · Follow Up Boss stays the system of record · Google and Obsidian are read in place · drafts and tasks only.
      </footer>

      {app.toast && (
        <div role="status" className="lite-toast">{app.toast}</div>
      )}
    </div>
  );
}
