"use client";

import { useApp } from "../app-state";
import { ErrorBox, Loading, useGet } from "../modules/shared";

/**
 * Today — the classic "next best actions" view, built from the same live data
 * as the dashboard: today's to-dos and calls, calendar events, deal-risk flags
 * from Follow Up Boss deals, and fresh off-market matches.
 */

interface Todo { id: string; title: string; kind: string; done: boolean; contactName?: string | null; contactId?: string | null }
interface Ev { id: string; title: string; startsAt: string; location?: string | null; source: string; contactName?: string | null }
interface Tx { id: string; side: string; address: string; priceDisplay: string; status: string }
interface Risk { id: string; name: string; riskIssue?: string | null; riskFlag?: string | null; contactId?: string | null }
interface OmMatch { buyerLabel: string; contactId?: string | null; address: string; result: { score: number } }
interface Dash {
  today: string;
  agent: { name: string };
  todos: Todo[];
  todayEvents: Ev[];
  transactions: Tx[];
  buyers: { id: string }[];
  risks: Risk[];
  offMarketMatches: OmMatch[];
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function TodayScreen() {
  const app = useApp();
  const { data, loading, error, reload } = useGet<Dash>("/api/dashboard");
  if (loading) return <Loading label="Loading today…" />;
  if (error || !data) return <ErrorBox message={error ?? "No data."} onRetry={reload} />;

  const first = data.agent.name.split(" ")[0];
  const open = data.todos.filter((t) => !t.done);
  const priorities = open.filter((t) => t.kind === "priority");
  const calls = open.filter((t) => t.kind === "call");
  const highRisks = data.risks.filter((r) => r.riskFlag === "high");
  const active = data.transactions.filter((t) => t.status === "active" || t.status === "pending");
  const next = data.todayEvents.find((e) => new Date(e.startsAt).getTime() > Date.now());
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLabel = new Date(data.today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const stats = [
    { label: "Appointments today", value: String(data.todayEvents.length), sub: next ? `Next at ${time(next.startsAt)}` : data.todayEvents.length ? "All done for today" : "Calendar is clear" },
    { label: "To-dos open", value: String(open.length), sub: `${priorities.length} priority · ${calls.length} calls` },
    { label: "Active buyers", value: String(data.buyers.length), sub: `${data.offMarketMatches.length} off-market matches` },
    { label: "Transactions in play", value: String(active.length), sub: `${highRisks.length} need attention` },
  ];

  const actions = [
    ...highRisks.map((r) => ({ id: `risk-${r.id}`, title: `Protect the ${r.name} deal`, detail: r.riskIssue ?? "Flagged in Follow Up Boss.", due: "Act today", entity: "Deal", screen: "people" as const, contactId: r.contactId ?? undefined, high: true })),
    ...priorities.map((t) => ({ id: t.id, title: t.title, detail: t.contactName ? `With ${t.contactName}` : "From today’s to-do list", due: "Priority", entity: "To-do", screen: "dashboard" as const, contactId: t.contactId ?? undefined, high: true })),
    ...calls.map((t) => ({ id: t.id, title: t.title, detail: t.contactName ? `Call ${t.contactName}` : "Call to make today", due: "Today", entity: "Call", screen: t.contactId ? ("people" as const) : ("dashboard" as const), contactId: t.contactId ?? undefined, high: false })),
    ...data.offMarketMatches.slice(0, 3).map((m, i) => ({ id: `om-${i}`, title: `Show ${m.buyerLabel} the off-market at ${m.address}`, detail: `Fit score ${m.result.score} against their written criteria`, due: "This week", entity: "Buyer match", screen: "scout" as const, contactId: m.contactId ?? undefined, high: false })),
    ...open.filter((t) => t.kind !== "priority" && t.kind !== "call").map((t) => ({ id: t.id, title: t.title, detail: t.contactName ? `With ${t.contactName}` : "To-do", due: "Today", entity: "To-do", screen: "dashboard" as const, contactId: t.contactId ?? undefined, high: false })),
  ];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1240 }}>
      <div>
        <h6 style={{ margin: "0 0 4px", color: "var(--color-accent)" }}>{dateLabel}</h6>
        <h2 style={{ margin: 0, fontSize: 26 }}>
          {greeting}, {first}. {data.todayEvents.length} appointment{data.todayEvents.length === 1 ? "" : "s"}, {highRisks.length} deal{highRisks.length === 1 ? "" : "s"} need{highRisks.length === 1 ? "s" : ""} attention.
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 10 }}>
            <div className="text-muted" style={{ fontSize: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>{s.label}</div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 30, lineHeight: 1.1, margin: "4px 0 2px" }}>{s.value}</div>
            <div className="text-muted" style={{ fontSize: 13 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>
            <h6 style={{ margin: 0 }}>Next best actions</h6>
            <span className="text-muted" style={{ fontSize: 13 }}>{actions.length} queued · deal risks first, then priorities, calls and matches</span>
          </div>
          <div role="list">
            {actions.map((a) => (
              <div key={a.id} role="listitem" style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "13px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 15.5 }}>{a.title}</div>
                  <div className="text-muted" style={{ fontSize: 14, marginTop: 2 }}>{a.detail}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                    <span className={a.high ? "tag tag-accent" : "tag tag-neutral"}>{a.due}</span>
                    <span className="tag tag-neutral">{a.entity}</span>
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ flex: "none" }} onClick={() => app.goto(a.screen, a.contactId)} aria-label={`Open ${a.title}`}>Open</button>
              </div>
            ))}
            {actions.length === 0 && <div className="text-muted" style={{ padding: "18px 0", fontSize: 14 }}>Nothing queued. Paste today’s to-do list on the Dashboard or sync Follow Up Boss.</div>}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h6 style={{ margin: 0, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>Today’s appointments</h6>
            {data.todayEvents.map((ap) => (
              <div key={ap.id} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 14, width: 64, flex: "none", paddingTop: 1 }}>{time(ap.startsAt)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{ap.title}</div>
                  <div className="text-muted" style={{ fontSize: 13 }}>{[ap.contactName, ap.location].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <span className="tag tag-neutral" style={{ alignSelf: "flex-start" }}>{ap.source === "fub" ? "FUB" : ap.source === "ics" ? "Calendar" : "Local"}</span>
              </div>
            ))}
            {data.todayEvents.length === 0 && <div className="text-muted" style={{ padding: "12px 0", fontSize: 14 }}>No appointments today.</div>}
          </div>

          <div>
            <h6 style={{ margin: 0, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>Deal-risk alerts</h6>
            {data.risks.map((r) => (
              <div key={r.id} style={{ padding: "11px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span className={r.riskFlag === "high" ? "tag tag-accent" : "tag tag-neutral"}>{r.riskFlag === "high" ? "Act today" : "Watch"}</span>
                  <span style={{ fontWeight: 600, fontSize: 14.5 }}>{r.name}</span>
                </div>
                <div className="text-muted" style={{ fontSize: 13.5, margin: "5px 0 7px" }}>{r.riskIssue ?? "Flagged for attention."}</div>
                <button className="btn btn-ghost" style={{ fontSize: 14 }} onClick={() => app.goto("people", r.contactId ?? undefined)}>Open deal</button>
              </div>
            ))}
            {data.risks.length === 0 && <div className="text-muted" style={{ padding: "12px 0", fontSize: 14 }}>No deals flagged.</div>}
          </div>
        </div>
      </div>
    </section>
  );
}
