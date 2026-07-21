"use client";

import { DATA } from "@/data/mock-data";
import { useApp, type Screen } from "../app-state";

export function TodayScreen() {
  const app = useApp();
  const t = DATA.today;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1240 }}>
      <div>
        <h6 style={{ margin: "0 0 4px", color: "var(--color-accent)" }}>{t.date}</h6>
        <h2 style={{ margin: 0, fontSize: 26 }}>
          Good morning, Avery. Three appointments, two deals need attention.
        </h2>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 }}>
        {t.stats.map((s) => (
          <div key={s.label} style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 10 }}>
            <div className="text-muted" style={{ fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {s.label}
            </div>
            <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 30, lineHeight: 1.1, margin: "4px 0 2px" }}>
              {s.value}
            </div>
            <div className="text-muted" style={{ fontSize: 12 }}>
              {s.sub}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.45fr) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>
            <h6 style={{ margin: 0 }}>Next best actions</h6>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {t.actions.length} queued · ordered by deadline and deal impact
            </span>
          </div>
          <div role="list">
            {t.actions.map((a) => (
              <div
                key={a.id}
                role="listitem"
                style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "13px 0", borderBottom: "1px solid var(--color-divider)" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14.5 }}>{a.title}</div>
                  <div className="text-muted" style={{ fontSize: 13, marginTop: 2 }}>
                    {a.detail}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 7, flexWrap: "wrap" }}>
                    <span className={a.priority === "high" ? "tag tag-accent" : "tag tag-neutral"}>{a.due}</span>
                    <span className="tag tag-neutral">{a.entity}</span>
                  </div>
                </div>
                <button
                  className="btn btn-secondary"
                  style={{ flex: "none" }}
                  onClick={() => app.goto(a.screen as Screen, a.contactId)}
                  aria-label={`Open ${a.title}`}
                >
                  Open
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div>
            <h6 style={{ margin: 0, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>Today’s appointments</h6>
            {t.appointments.map((ap) => (
              <div key={ap.time + ap.title} style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 13, width: 64, flex: "none", paddingTop: 1 }}>{ap.time}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{ap.title}</div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    {ap.who} · {ap.where}
                  </div>
                </div>
                <span className="tag tag-neutral" style={{ alignSelf: "flex-start" }}>{ap.type}</span>
              </div>
            ))}
          </div>

          <div>
            <h6 style={{ margin: 0, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>Deal-risk alerts</h6>
            {t.risks.map((r) => (
              <div key={r.deal} style={{ padding: "11px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                  <span className={r.severity === "high" ? "tag tag-accent" : "tag tag-neutral"}>{r.severity === "high" ? "Act today" : "Watch"}</span>
                  <span style={{ fontWeight: 600, fontSize: 13.5 }}>{r.deal}</span>
                </div>
                <div className="text-muted" style={{ fontSize: 12.5, margin: "5px 0 7px" }}>{r.issue}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="text-muted" style={{ fontSize: 11 }}>{r.age}</span>
                  <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => app.goto("people", r.contactId)}>
                    Open deal
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
