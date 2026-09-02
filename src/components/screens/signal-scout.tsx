"use client";

import { useState } from "react";
import { useApp } from "../app-state";
import { ErrorBox, Loading, StatusBadge, postJson, errText, useGet, ScreenHeader } from "../modules/shared";

interface Signal { id: string; type: string; reason: string; sourceKind: string; sourceRef: string | null; sourceDate: string | null; confidence: number; confidenceBasis: string | null; suggestedAction: string | null; relatedLabel: string | null; status: string; contactId: string | null }

export function SignalScoutScreen() {
  const app = useApp();
  const [filter, setFilter] = useState("");
  const url = filter ? `/api/signals?status=${filter}` : "/api/signals";
  const { data, loading, error, reload } = useGet<{ signals: Signal[] }>(url);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    const res = await postJson("/api/signals/generate", { fromFub: true, staleThresholdDays: 30 });
    setBusy(false);
    app.say(res.ok ? `Refreshed queue — ${(res.data as { count: number }).count} new signal(s)` : errText(res.data));
    reload();
  }
  async function act(id: string, action: string, extra: Record<string, unknown> = {}) {
    const res = await postJson(`/api/signals/${id}/action`, { action, ...extra });
    app.say(res.ok ? (res.data as { message?: string }).message ?? "Done." : errText(res.data));
    reload();
  }

  const signals = (data?.signals ?? []).filter((s) => filter === "" || s.status === filter);

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1100 }}>
      <ScreenHeader
        title="Signal Scout"
        sub="An explainable opportunity queue — not a “who will sell” predictor. Confidence reflects data completeness, never likelihood of selling."
        action={<button className="btn btn-primary" onClick={generate} disabled={busy}>Refresh queue</button>}
      />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {["", "new", "pursued", "snoozed", "dismissed"].map((f) => (
          <button key={f || "all"} className={`seg-opt ${filter === f ? "is-active" : ""}`} style={{ border: "1px solid var(--color-divider)", cursor: "pointer", background: filter === f ? "var(--color-accent)" : "transparent", color: filter === f ? "var(--color-bg)" : "inherit" }} onClick={() => setFilter(f)}>{f || "All"}</button>
        ))}
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && signals.length === 0 && <div className="text-muted" style={{ fontSize: 14, padding: "16px 0" }}>No signals in this view. Refresh the queue or upload an authorized MLS status export.</div>}

      {signals.map((s) => (
        <div key={s.id} style={{ border: "1px solid var(--color-divider)", padding: "14px 16px", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ flex: "none", width: 62, textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 22 }}>{s.confidence}</div>
            <div className="text-muted" style={{ fontSize: 9, letterSpacing: "0.06em" }}>CONFIDENCE</div>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span className="tag tag-accent">{s.type.replace(/_/g, " ")}</span>
              <strong style={{ fontSize: 15 }}>{s.relatedLabel ?? "Opportunity"}</strong>
              <StatusBadge status={s.status} />
            </div>
            <div className="text-muted" style={{ fontSize: 14, marginTop: 4 }}>{s.reason}</div>
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>Source: {s.sourceKind}{s.sourceRef ? ` · ${s.sourceRef}` : ""}{s.sourceDate ? ` · ${s.sourceDate}` : ""} · Why surfaced: {s.confidenceBasis}</div>
            {s.suggestedAction && <div style={{ fontSize: 13.5, marginTop: 6 }}><strong>Suggested:</strong> {s.suggestedAction}</div>}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button className="btn btn-secondary" onClick={() => act(s.id, "pursue")}>Pursue</button>
              <button className="btn btn-secondary" onClick={() => act(s.id, "create_task", { taskTitle: `Follow up: ${s.relatedLabel ?? s.type}` })}>Create FUB task</button>
              <button className="btn btn-secondary" onClick={() => act(s.id, "draft_outreach")}>Draft outreach</button>
              <button className="btn btn-ghost" onClick={() => act(s.id, "snooze", { snoozeDays: 7, reason: "Not now" })}>Snooze</button>
              <button className="btn btn-ghost" onClick={() => act(s.id, "dismiss", { reason: "Not a fit" })}>Dismiss</button>
            </div>
          </div>
        </div>
      ))}
      <div className="text-muted" style={{ fontSize: 12.5 }}>Outreach is draft-only — AgentOS never auto-sends email/SMS/calls or creates leads. Every score, action, and FUB write is audited.</div>
    </section>
  );
}
