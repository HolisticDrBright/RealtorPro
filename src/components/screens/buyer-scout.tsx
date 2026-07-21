"use client";

import { DATA } from "@/data/mock-data";
import { useApp } from "../app-state";
import { Spinner } from "../icons";

export function BuyerScoutScreen() {
  const app = useApp();
  const buyer = app.buyer;
  const buyerFirst = (buyer.name || "").split(" ")[0];
  const imp = app.importState;
  const matches = imp === "ready" ? DATA.matches[buyer.id] ?? [] : [];
  const shortCount = Object.values(app.shortlist).filter(Boolean).length;

  return (
    <section style={{ display: "grid", gridTemplateColumns: "230px minmax(0, 1fr)", gap: 26, alignItems: "start", maxWidth: 1280 }}>
      {/* Rail */}
      <div>
        <h6 style={{ margin: 0, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>Active searches</h6>
        <div role="list">
          {DATA.buyers.map((b) => {
            const selected = app.buyerId === b.id;
            return (
              <button
                key={b.id}
                role="listitem"
                onClick={() => app.pickBuyer(b.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  font: "inherit",
                  cursor: "pointer",
                  border: "none",
                  borderBottom: "1px solid var(--color-divider)",
                  borderLeft: `3px solid ${selected ? "var(--color-accent)" : "transparent"}`,
                  background: selected ? "var(--color-surface)" : "transparent",
                  padding: "11px 10px",
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.name}</div>
                <div className="text-muted" style={{ fontSize: 11.5, marginTop: 2 }}>{b.stage}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 22 }}>{buyer.name}</h3>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span className="tag tag-neutral">{buyer.fubId}</span>
              <span className="tag tag-accent">{buyer.stage}</span>
              <span className="text-muted" style={{ fontSize: 12, alignSelf: "center" }}>{buyer.lastTouch}</span>
            </div>
          </div>
          <button className="btn btn-secondary">Edit criteria</button>
          <button className="btn btn-ghost">Open in Follow Up Boss</button>
        </div>

        {/* Objective criteria */}
        <div className="card elev-sm" style={{ padding: 18 }}>
          <div className="card-kicker">Objective criteria — agreed with client Jul 15</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 20, marginTop: 4 }}>
            <div>
              <h6 style={{ margin: "0 0 6px", fontSize: 11 }}>Price ceiling</h6>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{buyer.ceiling}</div>
              <h6 style={{ margin: "14px 0 6px", fontSize: 11 }}>Areas (client-drawn)</h6>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {buyer.areas.map((ar) => (
                  <span key={ar} className="tag tag-neutral">{ar}</span>
                ))}
              </div>
            </div>
            <div>
              <h6 style={{ margin: "0 0 6px", fontSize: 11 }}>Hard constraints</h6>
              {buyer.constraints.map((hc) => (
                <div key={hc} style={{ fontSize: 13, padding: "3px 0", borderBottom: "1px solid var(--color-divider)" }}>{hc}</div>
              ))}
            </div>
            <div>
              <h6 style={{ margin: "0 0 6px", fontSize: 11 }}>Weighted preferences</h6>
              {buyer.prefs.map((pf) => (
                <div key={pf.label} style={{ padding: "3px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span>{pf.label}</span>
                    <span className="text-muted">{pf.weight}</span>
                  </div>
                  <div style={{ height: 4, background: "var(--color-neutral-300)", marginTop: 3 }}>
                    <div style={{ height: 4, background: "var(--color-accent)", width: `${pf.weight}%` }} />
                  </div>
                </div>
              ))}
              <h6 style={{ margin: "12px 0 6px", fontSize: 11 }}>Must-have features</h6>
              {buyer.mustHaves.map((mh) => (
                <div key={mh} style={{ fontSize: 13, fontWeight: 600, padding: "2px 0" }}>✓&nbsp; {mh}</div>
              ))}
            </div>
          </div>
          <div className="text-muted" style={{ fontSize: 11.5, borderTop: "1px solid var(--color-divider)", paddingTop: 8, marginTop: 6 }}>
            Matching uses only listing facts against these criteria. AgentOS does not filter or score on demographics, protected classes, or subjective neighborhood judgments.
          </div>
        </div>

        {/* MLS alert import */}
        <div style={{ border: "2px solid var(--color-divider)", padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h6 style={{ margin: 0 }}>MLS alert import</h6>
            <div className="seg" role="radiogroup" aria-label="Import source">
              <label className="seg-opt"><input type="radio" name="impsrc" style={hidden} /><span>CSV file</span></label>
              <label className="seg-opt"><input type="radio" name="impsrc" style={hidden} /><span>PDF flyer</span></label>
              <label className="seg-opt is-active"><input type="radio" name="impsrc" defaultChecked style={hidden} /><span>Pasted alert email</span></label>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, marginTop: 12, alignItems: "end" }}>
            <div className="field">
              <label htmlFor="alert-paste">Paste the alert email, or drop a CSV / PDF anywhere in this box</label>
              <textarea
                id="alert-paste"
                className="input"
                style={{ minHeight: 64 }}
                placeholder="e.g. the RMLS auto-alert email body — AgentOS extracts address, price, beds, baths, sqft, and remarks"
              />
            </div>
            <button className="btn btn-primary" onClick={app.onParse} disabled={imp === "parsing"}>
              Parse &amp; rank
            </button>
          </div>

          {imp === "parsing" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 13 }} role="status">
              <Spinner />
              Parsing rows and checking each fact against {buyerFirst}’s criteria…
            </div>
          )}
          {imp === "error" && (
            <div role="alert" style={{ marginTop: 12, background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 13 }}>Import failed.</strong>
              <span style={{ fontSize: 13 }}>2 of 6 rows are missing a list price, so ranking would be unreliable. Fix the export and re-import — nothing was saved.</span>
              <button className="btn btn-secondary" style={{ marginLeft: "auto" }} onClick={app.onParse}>Retry import</button>
            </div>
          )}
          {imp === "ready" && (
            <div className="text-muted" style={{ fontSize: 12, marginTop: 10 }}>
              Last import {app.importedAt[buyer.id] || "just now"} · {matches.length} listings ranked · every match reason cites its source field
            </div>
          )}
        </div>

        {imp === "ready" && (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>
              <h6 style={{ margin: 0 }}>Ranked matches ({matches.length})</h6>
              <span className="tag tag-neutral">Shortlist: {shortCount}</span>
            </div>
            {matches.map((m) => (
              <article key={m.id} style={{ display: "flex", gap: 18, padding: "18px 0", borderBottom: "1px solid var(--color-divider)" }} aria-label={m.addr}>
                <div style={{ flex: "none", width: 62, textAlign: "left" }}>
                  <div
                    style={{
                      width: 62,
                      height: 62,
                      display: "grid",
                      placeItems: "center",
                      background: m.over ? "transparent" : "var(--color-text)",
                      color: m.over ? "var(--color-text)" : "var(--color-bg)",
                      border: "2px solid var(--color-text)",
                      fontFamily: "var(--font-heading)",
                      fontWeight: 800,
                      fontSize: 24,
                    }}
                  >
                    {m.score}
                  </div>
                  <div className="text-muted" style={{ fontSize: 10, letterSpacing: "0.08em", marginTop: 4 }}>FIT SCORE</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                    <strong style={{ fontSize: 15.5 }}>{m.addr}</strong>
                    <span className="text-muted" style={{ fontSize: 13 }}>
                      {m.hood} · {m.price} · {m.beds} bd / {m.baths} ba · {m.sqft} sqft · {m.mls}
                    </span>
                    {m.over && <span className="tag tag-outline">Over price ceiling</span>}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "4px 24px", marginTop: 8 }}>
                    <div>
                      {m.reasons.map((re, i) => (
                        <div key={i} style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 13, padding: "2px 0" }}>
                          <span style={{ color: "var(--color-accent-700)", fontWeight: 800 }}>✓</span>
                          <span style={{ flex: 1 }}>
                            {re.text}{" "}
                            <span className="tag tag-neutral" style={{ fontSize: 10, padding: "1px 6px", marginLeft: 4 }}>{re.source}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                    <div>
                      {m.tradeoffs.map((to, i) => (
                        <div key={i} className="text-muted" style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 13, padding: "2px 0" }}>
                          <span style={{ fontWeight: 800 }}>–</span>
                          <span style={{ flex: 1 }}>{to}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {m.verify && (
                    <div style={{ marginTop: 10, background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "8px 12px", fontSize: 12.5 }}>
                      <strong>Verify before recommending:</strong> {m.verify}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    <button className="btn btn-secondary" onClick={() => app.openDetail(m)}>Open details</button>
                    <button className="btn btn-secondary" onClick={() => app.toggleShortlist(m)} aria-pressed={!!app.shortlist[m.id]}>
                      {app.shortlist[m.id] ? "Saved ✓" : "Save to shortlist"}
                    </button>
                    <button className="btn btn-secondary" onClick={() => app.createTask(m)}>Create FUB task</button>
                    <button className="btn btn-ghost" onClick={() => app.openEmail(buyer, m)}>Draft client email</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {imp === "idle" && (
          <div style={{ border: "2px dashed var(--color-divider)", padding: "34px 28px", maxWidth: 640 }}>
            <h5 style={{ margin: "0 0 6px" }}>No alerts imported for this search yet</h5>
            <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
              Paste an MLS alert email or drop the CSV above. AgentOS ranks each listing against {buyerFirst}’s written criteria and shows exactly which fact supports each reason — nothing is scored on vibes.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

const hidden: React.CSSProperties = { position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" };
