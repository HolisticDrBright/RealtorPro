"use client";

import { useCallback, useEffect, useState } from "react";

/** Small fetch helpers + shared UI states for the extended-module screens. */

export async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: { message: "Network error — your local data is safe." } } };
  }
}

export function useGet<T>(url: string): { data: T | null; loading: boolean; error: string | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetch(url)
      .then(async (r) => {
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) setError(j?.error?.message ?? "Failed to load.");
        else setData(j);
      })
      .catch(() => alive && setError("Network error."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [url, nonce]);
  return { data, loading, error, reload };
}

export function errText(data: unknown, fallback = "Something went wrong."): string {
  const e = data as { error?: { message?: string } } | null;
  return e?.error?.message ?? fallback;
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div role="status" style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0", fontSize: 14 }}>
      <span style={{ width: 14, height: 14, border: "2px solid var(--color-divider)", borderTopColor: "var(--color-accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
      {label}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "12px 16px", fontSize: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
      <strong>Couldn’t complete that.</strong> {message}
      {onRetry && (
        <button className="btn btn-secondary" style={{ marginLeft: "auto" }} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Empty({ kicker, title, body, action }: { kicker: string; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div style={{ border: "2px dashed var(--color-divider)", padding: "34px 28px", maxWidth: 640 }}>
      <div className="card-kicker" style={{ marginBottom: 6 }}>{kicker}</div>
      <h5 style={{ margin: "0 0 6px" }}>{title}</h5>
      <p className="text-muted" style={{ fontSize: 14, margin: "0 0 12px" }}>{body}</p>
      {action}
    </div>
  );
}

/** Provenance / verification badge with the standard variants. */
export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let cls = "tag tag-neutral";
  if (/calc/.test(s)) cls = "tag tag-accent";
  else if (/pending|needs|unverified|needs_verification/.test(s)) cls = "tag tag-outline";
  else if (/verified|approved|imported|current|ready|calculated/.test(s)) cls = "tag tag-neutral";
  return <span className={cls} style={{ fontSize: 10 }}>{status}</span>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const critical = /critical|high/.test(severity.toLowerCase());
  return <span className={critical ? "tag tag-accent" : "tag tag-neutral"} style={{ fontSize: 10 }}>{severity}</span>;
}

export function ScreenHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap", borderBottom: "2px solid var(--color-divider)", paddingBottom: 10 }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <h3 style={{ margin: 0, fontSize: 22 }}>{title}</h3>
        {sub && <div className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}
