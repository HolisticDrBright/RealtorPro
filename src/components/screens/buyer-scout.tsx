"use client";

import { useMemo, useState } from "react";
import type { Match } from "@/data/mock-data";
import { useApp } from "../app-state";
import { Spinner } from "../icons";
import { ErrorBox, errText, Loading, postJson, useGet } from "../modules/shared";

/**
 * Buyer Scout — buyer searches are criteria profiles saved in the local
 * database (linked to Follow Up Boss contacts by id). Pasted MLS alert emails
 * or CSV exports are ranked against those criteria using listing facts only;
 * with Claude configured, the email extraction step is done by Claude.
 */

interface MatchRow {
  id: string;
  address?: string | null;
  score: number;
  overCeiling: boolean;
  reasons: { text: string; source: string }[];
  tradeoffs: string[];
  missingFacts: string[];
  verifyQuestions: string[];
  shortlisted: boolean;
  property: { price?: string | null; beds?: number | null; baths?: number | null; sqft?: string | null; mlsNumber?: string | null; sourceMeta?: Record<string, unknown> | null } | null;
}

const money = (v?: string | null) => {
  if (!v) return "[TBD — source required]";
  const n = Number(String(v).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n > 0 ? "$" + n.toLocaleString("en-US") : v;
};

function toMatch(m: MatchRow): Match {
  const p = m.property;
  const area = (p?.sourceMeta?.area ?? p?.sourceMeta?.neighborhood ?? "") as string;
  return {
    id: m.id,
    addr: m.address ?? "[TBD — source required]",
    hood: area,
    price: money(p?.price),
    beds: p?.beds ?? 0,
    baths: p?.baths ?? 0,
    sqft: p?.sqft ?? "—",
    mls: p?.mlsNumber ? `MLS ${p.mlsNumber}` : "",
    score: m.score,
    over: m.overCeiling,
    reasons: m.reasons ?? [],
    tradeoffs: m.tradeoffs ?? [],
    verify: (m.verifyQuestions ?? []).join(" ") || null,
  };
}

export function BuyerScoutScreen() {
  const app = useApp();
  const buyer = app.buyer;
  const buyerFirst = (buyer.name || "").split(" ")[0];
  const [paste, setPaste] = useState("");
  const [source, setSource] = useState<"email" | "csv">("email");
  const [showNew, setShowNew] = useState(false);
  const matchesUrl = buyer.id ? `/api/buyer-scout/matches?criteriaProfileId=${encodeURIComponent(buyer.id)}` : "/api/buyer-scout/matches?criteriaProfileId=none";
  const { data, loading, error, reload } = useGet<{ matches: MatchRow[] }>(matchesUrl);
  const matches = useMemo(() => (data?.matches ?? []).map(toMatch), [data]);
  const savedIds = useMemo(() => new Set((data?.matches ?? []).filter((m) => m.shortlisted).map((m) => m.id)), [data]);
  const isSaved = (id: string) => app.shortlist[id] ?? savedIds.has(id);
  const shortCount = matches.filter((m) => isSaved(m.id)).length;
  const imp = app.importState === "idle" && matches.length > 0 ? "ready" : app.importState;
  const claude = app.integrations?.claude.llmProvider === "anthropic" && app.integrations.claude.configured;

  async function parse() {
    const ok = await app.onParse(paste, source);
    if (ok) {
      setPaste("");
      reload();
    }
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "240px minmax(0, 1fr)", gap: 26, alignItems: "start", maxWidth: 1320 }}>
      {/* Rail */}
      <div>
        <div style={{ display: "flex", alignItems: "center", borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>
          <h6 style={{ margin: 0, flex: 1 }}>Active searches</h6>
          <button className="btn btn-ghost" style={{ fontSize: 13, padding: "2px 8px" }} onClick={() => setShowNew((v) => !v)}>{showNew ? "Close" : "+ New"}</button>
        </div>
        <div role="list">
          {app.buyers.map((b) => {
            const selected = app.buyerId === b.id;
            return (
              <button key={b.id} role="listitem" onClick={() => app.pickBuyer(b.id)} style={{ display: "block", width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", border: "none", borderBottom: "1px solid var(--color-divider)", borderLeft: `3px solid ${selected ? "var(--color-accent)" : "transparent"}`, background: selected ? "var(--color-surface)" : "transparent", padding: "11px 10px" }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{b.name}</div>
                <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>{[b.stage, b.temperature ? `${b.temperature} lead` : null].filter(Boolean).join(" · ")}</div>
              </button>
            );
          })}
          {app.buyers.length === 0 && <div className="text-muted" style={{ fontSize: 13.5, padding: "12px 10px" }}>No buyer searches yet. Create one from a contact’s written criteria.</div>}
        </div>
      </div>

      {/* Main */}
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {showNew && <NewSearchForm onDone={() => { setShowNew(false); app.reloadBuyers(); }} />}

        {buyer.id && (
          <>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 240 }}>
                <h3 style={{ margin: "0 0 6px", fontSize: 22 }}>{buyer.name}</h3>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className="tag tag-neutral">{buyer.fubId}</span>
                  {buyer.stage && <span className="tag tag-accent">{buyer.stage}</span>}
                  <span className="text-muted" style={{ fontSize: 13, alignSelf: "center" }}>{buyer.lastTouch}</span>
                </div>
              </div>
              {buyer.contactId && <button className="btn btn-ghost" onClick={() => app.goto("people", buyer.contactId!)}>Open contact</button>}
            </div>

            <div className="card elev-sm" style={{ padding: 18 }}>
              <div className="card-kicker">Objective criteria</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 20, marginTop: 4 }}>
                <div>
                  <h6 style={{ margin: "0 0 6px", fontSize: 12 }}>Price ceiling</h6>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{buyer.ceiling}</div>
                  <h6 style={{ margin: "14px 0 6px", fontSize: 12 }}>Areas (client-drawn)</h6>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {buyer.areas.length ? buyer.areas.map((ar) => <span key={ar} className="tag tag-neutral">{ar}</span>) : <span className="text-muted" style={{ fontSize: 13 }}>Any</span>}
                  </div>
                </div>
                <div>
                  <h6 style={{ margin: "0 0 6px", fontSize: 12 }}>Hard constraints</h6>
                  {buyer.constraints.map((hc) => <div key={hc} style={{ fontSize: 14, padding: "3px 0", borderBottom: "1px solid var(--color-divider)" }}>{hc}</div>)}
                  {buyer.constraints.length === 0 && <span className="text-muted" style={{ fontSize: 13 }}>None</span>}
                </div>
                <div>
                  <h6 style={{ margin: "0 0 6px", fontSize: 12 }}>Weighted preferences</h6>
                  {buyer.prefs.map((pf) => (
                    <div key={pf.label} style={{ padding: "3px 0" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}><span>{pf.label}</span><span className="text-muted">{pf.weight}</span></div>
                      <div style={{ height: 4, background: "var(--color-neutral-300)", marginTop: 3 }}><div style={{ height: 4, background: "var(--color-accent)", width: `${Math.min(100, pf.weight)}%` }} /></div>
                    </div>
                  ))}
                  <h6 style={{ margin: "12px 0 6px", fontSize: 12 }}>Must-have features</h6>
                  {buyer.mustHaves.map((mh) => <div key={mh} style={{ fontSize: 14, fontWeight: 600, padding: "2px 0" }}>✓&nbsp; {mh}</div>)}
                  {buyer.mustHaves.length === 0 && <span className="text-muted" style={{ fontSize: 13 }}>None</span>}
                </div>
              </div>
              <div className="text-muted" style={{ fontSize: 12.5, borderTop: "1px solid var(--color-divider)", paddingTop: 8, marginTop: 6 }}>
                Matching uses only listing facts against these criteria. AgentOS does not filter or score on demographics, protected classes, or subjective neighborhood judgments.
              </div>
            </div>

            <div style={{ border: "2px solid var(--color-divider)", padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <h6 style={{ margin: 0 }}>MLS alert import</h6>
                <div className="seg" role="radiogroup" aria-label="Import source">
                  <label className={`seg-opt${source === "email" ? " is-active" : ""}`}><input type="radio" name="impsrc" checked={source === "email"} onChange={() => setSource("email")} style={hidden} /><span>Pasted alert email</span></label>
                  <label className={`seg-opt${source === "csv" ? " is-active" : ""}`}><input type="radio" name="impsrc" checked={source === "csv"} onChange={() => setSource("csv")} style={hidden} /><span>CSV text</span></label>
                </div>
                {claude && <span className="tag tag-outline">Extraction by Claude</span>}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 12, marginTop: 12, alignItems: "end" }}>
                <div className="field">
                  <label htmlFor="alert-paste">{source === "email" ? "Paste the MLS alert email body" : "Paste the MLS CSV export (with its header row)"}</label>
                  <textarea id="alert-paste" className="input" style={{ minHeight: 64 }} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={source === "email" ? "e.g. the RMLS auto-alert email body — AgentOS extracts address, price, beds, baths, sqft, and remarks" : "Address,List Price,Beds,Baths,SqFt,MLS#…"} />
                </div>
                <button className="btn btn-primary" onClick={parse} disabled={imp === "parsing" || !paste.trim()}>Parse &amp; rank</button>
              </div>

              {imp === "parsing" && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, fontSize: 14 }} role="status">
                  <Spinner />
                  Parsing rows and checking each fact against {buyerFirst}’s criteria…
                </div>
              )}
              {imp === "error" && (
                <div role="alert" style={{ marginTop: 12, background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "10px 14px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14 }}>Import failed.</strong>
                  <span style={{ fontSize: 14 }}>{app.parseErrors[buyer.id] ?? "Nothing was saved."}</span>
                </div>
              )}
              {imp === "ready" && (
                <div className="text-muted" style={{ fontSize: 13, marginTop: 10 }}>
                  {app.importedAt[buyer.id] ? `Last import ${app.importedAt[buyer.id]} · ` : ""}{matches.length} listings ranked · every match reason cites its source field
                </div>
              )}
            </div>

            {loading && <Loading label="Loading matches…" />}
            {error && <ErrorBox message={error} onRetry={reload} />}

            {matches.length > 0 && (
              <div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>
                  <h6 style={{ margin: 0 }}>Ranked matches ({matches.length})</h6>
                  <span className="tag tag-neutral">Shortlist: {shortCount}</span>
                </div>
                {matches.map((m) => (
                  <article key={m.id} style={{ display: "flex", gap: 18, padding: "18px 0", borderBottom: "1px solid var(--color-divider)" }} aria-label={m.addr}>
                    <div style={{ flex: "none", width: 62, textAlign: "left" }}>
                      <div style={{ width: 62, height: 62, display: "grid", placeItems: "center", background: m.over ? "transparent" : "var(--color-text)", color: m.over ? "var(--color-text)" : "var(--color-bg)", border: "2px solid var(--color-text)", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24 }}>
                        {m.score}
                      </div>
                      <div className="text-muted" style={{ fontSize: 10, letterSpacing: "0.08em", marginTop: 4 }}>FIT SCORE</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 16.5 }}>{m.addr}</strong>
                        <span className="text-muted" style={{ fontSize: 14 }}>
                          {[m.hood, m.price, `${m.beds} bd / ${m.baths} ba`, `${m.sqft} sqft`, m.mls].filter(Boolean).join(" · ")}
                        </span>
                        {m.over && <span className="tag tag-outline">Over price ceiling</span>}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "4px 24px", marginTop: 8 }}>
                        <div>
                          {m.reasons.map((re, i) => (
                            <div key={i} style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 14, padding: "2px 0" }}>
                              <span style={{ color: "var(--color-accent-700)", fontWeight: 800 }}>✓</span>
                              <span style={{ flex: 1 }}>{re.text} <span className="tag tag-neutral" style={{ fontSize: 10, padding: "1px 6px", marginLeft: 4 }}>{re.source}</span></span>
                            </div>
                          ))}
                        </div>
                        <div>
                          {m.tradeoffs.map((to, i) => (
                            <div key={i} className="text-muted" style={{ display: "flex", gap: 7, alignItems: "baseline", fontSize: 14, padding: "2px 0" }}>
                              <span style={{ fontWeight: 800 }}>–</span><span style={{ flex: 1 }}>{to}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {m.verify && (
                        <div style={{ marginTop: 10, background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "8px 12px", fontSize: 13.5 }}>
                          <strong>Verify before recommending:</strong> {m.verify}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                        <button className="btn btn-secondary" onClick={() => app.openDetail(m)}>Open details</button>
                        <button className="btn btn-secondary" onClick={() => app.toggleShortlist(m)} aria-pressed={isSaved(m.id)}>{isSaved(m.id) ? "Saved ✓" : "Save to shortlist"}</button>
                        <button className="btn btn-secondary" onClick={() => app.createTask(m)}>Create FUB task</button>
                        <button className="btn btn-ghost" onClick={() => app.openEmail(buyer, m)}>Draft client email</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {!loading && matches.length === 0 && imp !== "parsing" && (
              <div style={{ border: "2px dashed var(--color-divider)", padding: "34px 28px", maxWidth: 640 }}>
                <h5 style={{ margin: "0 0 6px" }}>No alerts imported for this search yet</h5>
                <p className="text-muted" style={{ fontSize: 14, margin: 0 }}>
                  Paste an MLS alert email or CSV above. AgentOS ranks each listing against {buyerFirst}’s written criteria and shows exactly which fact supports each reason — nothing is scored on vibes.
                </p>
              </div>
            )}
          </>
        )}

        {!buyer.id && !showNew && (
          <div style={{ border: "2px dashed var(--color-divider)", padding: "34px 28px", maxWidth: 640 }}>
            <h5 style={{ margin: "0 0 6px" }}>Start with a buyer’s written criteria</h5>
            <p className="text-muted" style={{ fontSize: 14, margin: "0 0 12px" }}>Pick a contact, write the price ceiling, areas, hard constraints and must-haves you agreed with them, then import MLS alerts to rank.</p>
            <button className="btn btn-primary" onClick={() => setShowNew(true)}>New buyer search</button>
          </div>
        )}
      </div>
    </section>
  );
}

function NewSearchForm({ onDone }: { onDone: () => void }) {
  const app = useApp();
  const { data } = useGet<{ contacts: { id: string; name: string; role?: string | null }[] }>("/api/contacts");
  const [contactId, setContactId] = useState("");
  const [ceiling, setCeiling] = useState("");
  const [areas, setAreas] = useState("");
  const [hard, setHard] = useState("");
  const [must, setMust] = useState("");
  const [prefs, setPrefs] = useState("");
  const [busy, setBusy] = useState(false);
  const lines = (s: string) => s.split(/\n|;/).map((x) => x.trim()).filter(Boolean);

  async function save() {
    setBusy(true);
    const weightedPrefs = lines(prefs).map((l) => {
      const m = l.match(/^(.*?)[\s:=]+(\d{1,3})$/);
      return m ? { label: m[1].trim(), weight: Math.min(100, Number(m[2])) } : { label: l, weight: 50 };
    });
    const res = await postJson("/api/buyer-criteria", {
      contactId: contactId || undefined,
      label: contactId ? undefined : "Unlinked search",
      ceilingText: ceiling || undefined,
      ceilingHard: true,
      hardConstraints: lines(hard),
      weightedPrefs,
      areas: areas.split(",").map((x) => x.trim()).filter(Boolean),
      mustHaves: lines(must),
      agreedAt: new Date().toISOString().slice(0, 10),
    });
    setBusy(false);
    if (res.ok) {
      app.say("Buyer search saved — import an MLS alert to rank listings.");
      onDone();
    } else app.say(errText(res.data));
  }

  return (
    <div className="card elev-sm" style={{ padding: 18, gap: 10 }}>
      <div className="card-kicker">New buyer search — objective criteria only</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
        <div className="field">
          <label htmlFor="ns-contact">Contact (from Follow Up Boss)</label>
          <select id="ns-contact" className="input" value={contactId} onChange={(e) => setContactId(e.target.value)}>
            <option value="">— Not linked —</option>
            {(data?.contacts ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.role ? ` · ${c.role}` : ""}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="ns-ceiling">Price ceiling (e.g. “$725,000 hard ceiling”)</label><input id="ns-ceiling" className="input" value={ceiling} onChange={(e) => setCeiling(e.target.value)} /></div>
        <div className="field"><label htmlFor="ns-areas">Areas, comma-separated</label><input id="ns-areas" className="input" value={areas} onChange={(e) => setAreas(e.target.value)} placeholder="Sellwood, Woodstock, Mt. Tabor" /></div>
        <div className="field"><label htmlFor="ns-hard">Hard constraints, one per line</label><textarea id="ns-hard" className="input" style={{ minHeight: 60 }} value={hard} onChange={(e) => setHard(e.target.value)} placeholder={"3+ bedrooms\nNo HOA"} /></div>
        <div className="field"><label htmlFor="ns-must">Must-have features, one per line</label><textarea id="ns-must" className="input" style={{ minHeight: 60 }} value={must} onChange={(e) => setMust(e.target.value)} placeholder={"Garage\nFenced yard"} /></div>
        <div className="field"><label htmlFor="ns-prefs">Weighted preferences, “label: weight” per line</label><textarea id="ns-prefs" className="input" style={{ minHeight: 60 }} value={prefs} onChange={(e) => setPrefs(e.target.value)} placeholder={"Walkable to coffee: 70\nUpdated kitchen: 40"} /></div>
      </div>
      <div className="text-muted" style={{ fontSize: 12.5 }}>Fair Housing guardrail: criteria that describe people or neighborhoods subjectively are rejected. Use listing facts.</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save search"}</button>
        <button className="btn btn-ghost" onClick={onDone}>Cancel</button>
      </div>
    </div>
  );
}

const hidden: React.CSSProperties = { position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" };
