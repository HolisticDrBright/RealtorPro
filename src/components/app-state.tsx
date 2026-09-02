"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

/**
 * Client state for the dashboard-only build of AgentOS. Deliberately small:
 * theme, toast messages, the live integration status (Follow Up Boss, Claude,
 * Obsidian) and a manual FUB sync. Everything else lives in the API.
 */

export interface IntegrationStatus {
  agent: { id: string; name: string; email?: string | null } | null;
  fub: { configured: boolean; mock: boolean; status: string; lastSyncAt: string | null; contactCount: number; fubLinkedContacts: number };
  claude: { configured: boolean; model: string; llmProvider: string };
  obsidian: { configured: boolean; exists: boolean; dirName: string | null; noteCount: number };
  google: { configured: boolean; connected: boolean; email: string | null; redirectUri: string };
  dataMode: "live" | "demo";
}

interface AppContextValue {
  theme: "light" | "dark";
  toggleTheme: () => void;
  toast: string;
  say: (msg: string) => void;
  integrations: IntegrationStatus | null;
  reloadIntegrations: () => void;
  syncing: boolean;
  onSync: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

/** Format an ISO timestamp for display; non-ISO strings pass through. */
export function fmtWhen(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [toast, setToast] = useState("");
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(""), 3600);
  }, []);

  const reloadIntegrations = useCallback(() => {
    fetch("/api/integrations/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: IntegrationStatus | null) => j && setIntegrations(j))
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadIntegrations();
    try {
      const saved = window.localStorage.getItem("agentos.theme");
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch { /* ignore */ }
  }, [reloadIntegrations]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      try { window.localStorage.setItem("agentos.theme", next); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const onSync = useCallback(() => {
    setSyncing(true);
    fetch("/api/fub/sync", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        say(r.ok ? (j.detail ?? "Synced with Follow Up Boss") : (j?.error?.message ?? "Sync failed — your local copy is safe."));
      })
      .catch(() => say("Network error — your local data is safe."))
      .finally(() => {
        setSyncing(false);
        reloadIntegrations();
      });
  }, [say, reloadIntegrations]);

  const value: AppContextValue = { theme, toggleTheme, toast, say, integrations, reloadIntegrations, syncing, onSync };

  return (
    <div data-theme={theme} data-ui="lite" style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)" }}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </div>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}
