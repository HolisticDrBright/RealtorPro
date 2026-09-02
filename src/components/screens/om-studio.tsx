"use client";

import { useState } from "react";
import { OM } from "@/data/mock-data";
import { useApp } from "../app-state";
import { ImageSlot } from "../ui";
import { ErrorBox, Loading, StatusBadge, SeverityBadge, postJson, useGet, errText } from "../modules/shared";

interface Finding { id: string; lens: string; severity: string; pageKey?: string | null; code: string; message: string; repairAction?: string | null; status: string }
interface DraftResp { draft: { id: string; name: string; address: string | null; approvalState: string; brandProfileId: string | null }; findings: Finding[] }

const PAPER = "#faf9f8";
const INK = "#201e1d";

export function OmStudioScreen() {
  const app = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  if (openId) return <OmBuilder draftId={openId} onBack={() => setOpenId(null)} say={app.say} />;
  return <OmList onOpen={setOpenId} say={app.say} />;
}

function OmList({ onOpen, say }: { onOpen: (id: string) => void; say: (m: string) => void }) {
  const { data, loading, error, reload } = useGet<{ drafts: { id: string; name: string; address: string | null; market: string | null; assetType: string | null; price: string | null; approvalState: string; ownerName: string | null; updatedAt: string }[] }>("/api/om/drafts");
  const [creating, setCreating] = useState(false);

  async function createDemo() {
    setCreating(true);
    const res = await postJson("/api/om/drafts", { name: "New Offering Memorandum", address: "TBD", assetType: "Mixed-use", brandProfileId: "brand1", templateProfileId: "t1" });
    setCreating(false);
    if (res.ok) {
      say("OM draft created — sources first, then layout.");
      reload();
    } else say(errText(res.data));
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h3 style={{ margin: 0, fontSize: 22 }}>Offering memorandums</h3>
          <div className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>All figures are demo data — never real. Every OM is source-grounded and export-gated by the Three-Lens Review.</div>
        </div>
        <button className="btn btn-primary" onClick={createDemo} disabled={creating}>Create OM</button>
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.drafts.length === 0 && (
        <div style={{ border: "2px dashed var(--color-divider)", padding: "40px 28px", maxWidth: 640 }}>
          <div className="card-kicker" style={{ marginBottom: 6 }}>OM STUDIO</div>
          <h4 style={{ margin: "0 0 8px" }}>Your first offering memorandum starts with sources, not layout.</h4>
          <p className="text-muted" style={{ fontSize: 14, margin: "0 0 14px" }}>Attach an authorized rent roll, financials, and comps, pick a brand kit and a template you own, and AgentOS assembles a source-linked draft you can verify and export.</p>
          <button className="btn btn-primary" onClick={createDemo}>Create OM</button>
        </div>
      )}
      {data && data.drafts.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
          {data.drafts.map((d) => (
            <div key={d.id} style={{ border: "2px solid var(--color-divider)" }}>
              <div className="grayscale" style={{ aspectRatio: "16 / 9" }}><ImageSlot label={`${d.name} — hero`} ratio="16 / 9" /></div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 16 }}>{d.name}</strong>
                  <span className={d.approvalState === "Draft" ? "tag tag-neutral" : "tag tag-accent"}>{d.approvalState}</span>
                </div>
                <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>{d.address ?? "—"} · {d.market ?? "—"}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {d.assetType && <span className="tag tag-neutral">{d.assetType}</span>}
                  {d.price && <span className="tag tag-neutral">{d.price}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--color-divider)", marginTop: 12, paddingTop: 10 }}>
                  <span className="text-muted" style={{ fontSize: 12, flex: 1 }}>Edited {d.updatedAt?.slice(0, 10)} · {d.ownerName}</span>
                  <button className="btn btn-secondary" onClick={() => onOpen(d.id)}>Open</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function OmBuilder({ draftId, onBack, say }: { draftId: string; onBack: () => void; say: (m: string) => void }) {
  const { data, loading, error, reload } = useGet<DraftResp & { sections: { key: string; title: string; needsReview: boolean }[]; metrics: { metric: string; displayValue: string | null; status: string; formula: string | null }[]; disclosures: { kind: string; status: string }[] }>(`/api/om/drafts/${draftId}`);
  const [active, setActive] = useState("cover");
  const [showCompliance, setShowCompliance] = useState(false);
  const [busy, setBusy] = useState(false);

  const draft = data?.draft;
  const approved = draft?.approvalState === "Approved" || draft?.approvalState === "Exported";
  const sections = data?.sections ?? OM.pages.map((p) => ({ key: p.id, title: p.label, needsReview: !!p.flag }));
  const findings = data?.findings ?? [];

  async function runVerify() {
    setBusy(true);
    const res = await postJson(`/api/om/drafts/${draftId}/verify`, {});
    setBusy(false);
    if (res.ok) {
      setShowCompliance(true);
      say("Three-Lens Review complete.");
      reload();
    } else say(errText(res.data));
  }
  async function doExport(format: "pptx" | "pdf") {
    if (!approved) {
      say("Export locked — resolve the compliance checklist and approve for export first.");
      return;
    }
    setBusy(true);
    const res = await postJson(`/api/om/drafts/${draftId}/export`, { format });
    setBusy(false);
    say(res.ok ? (res.data as { message?: string }).message ?? "Exported." : errText(res.data));
    reload();
  }

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "2px solid var(--color-divider)", paddingBottom: 12 }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <strong style={{ fontSize: 16 }}>{draft?.name}</strong>
        <span className={approved ? "tag tag-accent" : "tag tag-outline"}>{draft?.approvalState}</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" onClick={() => doExport("pdf")} disabled={busy}>Export PDF</button>
          <button className="btn btn-secondary" onClick={() => doExport("pptx")} disabled={busy}>Export PowerPoint</button>
          <button className="btn btn-primary" onClick={runVerify} disabled={busy}>Review &amp; compliance</button>
        </div>
      </div>

      {showCompliance ? (
        <ComplianceCenter draftId={draftId} findings={findings} approvalState={draft?.approvalState ?? "Draft"} onChange={reload} onExport={doExport} say={say} onClose={() => setShowCompliance(false)} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "200px minmax(0,1fr) 264px", gap: 20, alignItems: "start" }}>
          {/* Navigator */}
          <div>
            <h6 style={{ margin: "0 0 8px" }}>Pages</h6>
            {sections.map((s, i) => {
              const on = active === s.key;
              return (
                <button key={s.key} onClick={() => setActive(s.key)} style={{ display: "flex", gap: 8, alignItems: "center", width: "100%", textAlign: "left", font: "inherit", cursor: "pointer", border: "none", borderLeft: `3px solid ${on ? "var(--color-accent)" : "transparent"}`, background: on ? "var(--color-surface)" : "transparent", padding: "8px 10px", fontSize: 13.5 }}>
                  <span className="text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ flex: 1 }}>{s.title}</span>
                  {s.needsReview && <span style={{ width: 7, height: 7, background: "var(--color-accent)" }} />}
                </button>
              );
            })}
            <div className="text-muted" style={{ fontSize: 10.5, marginTop: 8 }}>■ Ready · <span style={{ color: "var(--color-accent)" }}>■</span> Needs review</div>
          </div>

          {/* Canvas (paper — stays light in both themes) */}
          <div>
            <div data-theme="light" style={{ width: "min(660px, 100%)", aspectRatio: "17 / 22", background: PAPER, color: INK, boxShadow: "var(--shadow-md)", padding: 34, overflow: "auto" }}>
              <OmPage pageKey={active} metrics={data?.metrics ?? []} />
            </div>
            <div className="text-muted" style={{ fontSize: 12, marginTop: 8 }}>8.5 × 11 in portrait · print-preview · pages stay light in both app themes.</div>
          </div>

          {/* Inspector */}
          <div className="card elev-sm" style={{ padding: 16, gap: 12 }}>
            <div className="card-kicker">Brand kit</div>
            <div style={{ display: "flex", gap: 5 }}>{["#201e1d", "#ec3013", "#faf9f8"].map((c) => <span key={c} style={{ width: 20, height: 20, background: c, border: "1px solid var(--color-divider)" }} />)}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{OM.brandKits[0].name}</div>
            <div className="text-muted" style={{ fontSize: 12.5 }}>{OM.brandKits[0].broker}</div>
            <div className="text-muted" style={{ fontSize: 12.5 }}>Archivo type · legal disclaimer included</div>
            <div style={{ borderTop: "1px solid var(--color-divider)", paddingTop: 10 }} className="text-muted">
              <div className="card-kicker" style={{ marginBottom: 4 }}>Export lock</div>
              <span style={{ fontSize: 12.5 }}>PDF/PPTX and the Approved status unlock only after the compliance checklist is cleared.</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function OmPage({ pageKey, metrics }: { pageKey: string; metrics: { metric: string; displayValue: string | null; status: string; formula: string | null }[] }) {
  const kicker = (t: string) => <div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "#ae1800" }}>{t}</div>;
  if (pageKey === "cover") {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <div className="grayscale" style={{ flex: 1, minHeight: 200 }}><ImageSlot label="Cover — full-bleed grayscale photo" ratio="4 / 3" /></div>
        <div style={{ marginTop: 16 }}>
          {kicker("Offering Memorandum")}
          <h2 style={{ margin: "6px 0 4px", fontSize: 30, color: INK }}>{OM.projects[0].name}</h2>
          <div style={{ color: "#605d5d", fontSize: 14 }}>{OM.projects[0].addr} · {OM.projects[0].market}</div>
          <div style={{ height: 2, width: 64, background: "rgba(32,30,29,.4)", margin: "12px 0" }} />
          <div style={{ fontSize: 14 }}>A corner-anchored mixed-use offering with stabilized retail and staggered residential rollover.</div>
        </div>
      </div>
    );
  }
  if (pageKey === "financial") {
    const kpis = metrics.length ? metrics.map((mm) => ({ label: mm.metric, value: mm.status === "pending" ? "—" : mm.displayValue ?? "—", status: mm.status, src: mm.formula ?? "" })) : OM.kpis;
    return (
      <div>
        {kicker("Financial Summary")}
        <h3 style={{ margin: "6px 0 16px", fontSize: 24, color: INK }}>Financial Summary</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {kpis.map((k) => (
            <div key={k.label} style={{ borderTop: "2px solid rgba(32,30,29,.4)", paddingTop: 8 }}>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#605d5d" }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: INK, margin: "4px 0" }}>{k.value}</div>
              <StatusBadge status={k.status} />
              <div className="text-muted" style={{ fontSize: 10, marginTop: 4, color: "#605d5d" }}>{k.src}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10.5, color: "#605d5d", marginTop: 16 }}>Pending values render “—” — never an invented number. Demo data.</div>
      </div>
    );
  }
  if (pageKey === "rentroll") {
    return (
      <div>
        {kicker("Rent Roll / Tenant Summary")}
        <h3 style={{ margin: "6px 0 12px", fontSize: 24, color: INK }}>Rent Roll / Tenant Summary</h3>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
          <thead><tr>{["Unit", "Tenant", "SF", "Expires", "Monthly", "Annual", "Status"].map((h) => <th key={h} style={{ textAlign: "left", borderBottom: "2px solid rgba(32,30,29,.4)", padding: "4px 6px", color: "#605d5d", textTransform: "uppercase", fontSize: 9 }}>{h}</th>)}</tr></thead>
          <tbody>{OM.rentroll.map((r) => <tr key={r.unit}><td style={cell}>{r.unit}</td><td style={cell}>{r.tenant}</td><td style={cell}>{r.sf}</td><td style={cell}>{r.exp}</td><td style={cell}>{r.mo}</td><td style={cell}>{r.yr}</td><td style={cell}><span className={r.status === "Current" ? "tag tag-neutral" : "tag tag-outline"} style={{ fontSize: 9 }}>{r.status}</span></td></tr>)}</tbody>
        </table>
        <div style={{ fontSize: 10, color: "#605d5d", marginTop: 8 }}>{OM.rentrollNote}</div>
      </div>
    );
  }
  if (pageKey === "comps") {
    return (
      <div>
        {kicker("Comparable Sales")}
        <h3 style={{ margin: "6px 0 12px", fontSize: 24, color: INK }}>Comparable Sales</h3>
        <div className="grayscale" style={{ height: 120, marginBottom: 12 }}><ImageSlot label="Map — authorized location fields only" ratio="21 / 9" /></div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
          <thead><tr>{["Address", "Sold", "Price", "$/SF", "Dist.", "Source", "Status"].map((h) => <th key={h} style={{ textAlign: "left", borderBottom: "2px solid rgba(32,30,29,.4)", padding: "4px 6px", color: "#605d5d", textTransform: "uppercase", fontSize: 9 }}>{h}</th>)}</tr></thead>
          <tbody>{OM.comps.map((c) => <tr key={c.addr}><td style={cell}>{c.addr}</td><td style={cell}>{c.sold}</td><td style={cell}>{c.price}</td><td style={cell}>{c.psf}</td><td style={cell}>{c.dist}</td><td style={cell}>{c.source}</td><td style={cell}><span className={c.verified ? "tag tag-accent" : "tag tag-outline"} style={{ fontSize: 9 }}>{c.verified ? "Verified" : "Needs verification"}</span></td></tr>)}</tbody>
        </table>
        <div style={{ borderLeft: "3px solid rgba(32,30,29,.4)", paddingLeft: 12, marginTop: 12, fontSize: 12.5, color: INK }} contentEditable suppressContentEditableWarning>Comparable sales rationale — a transparent, source-cited narrative. Comps are not a valuation.</div>
      </div>
    );
  }
  if (pageKey === "highlights") {
    return (
      <div>
        {kicker("Investment Highlights")}
        <h3 style={{ margin: "6px 0 12px", fontSize: 24, color: INK }}>Investment Highlights</h3>
        {OM.highlights.map((h) => (
          <div key={h.n} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: "1px solid rgba(32,30,29,.18)" }}>
            <span style={{ color: "#ec3013", fontWeight: 800, fontSize: 20 }}>{h.n}</span>
            <div style={{ flex: 1, fontSize: 13 }}>{h.text}{h.flag && <div style={{ marginTop: 4 }}><span className="tag tag-outline" style={{ fontSize: 9 }}>{h.flag}</span></div>}</div>
          </div>
        ))}
      </div>
    );
  }
  if (pageKey === "risk") {
    return (
      <div>
        {kicker("Risk Factors & Disclosures")}
        <h3 style={{ margin: "6px 0 12px", fontSize: 24, color: INK }}>Risk Factors &amp; Disclosures</h3>
        {OM.risks.map((r, i) => <div key={i} style={{ display: "flex", gap: 10, padding: "6px 0", fontSize: 12.5 }}><span style={{ color: "#ae1800", fontWeight: 800 }}>{String(i + 1).padStart(2, "0")}</span><span>{r}</span></div>)}
        <div style={{ border: "1px solid rgba(32,30,29,.4)", padding: 12, marginTop: 12, fontSize: 10.5, color: "#605d5d" }}><span className="tag tag-accent" style={{ fontSize: 9 }}>Broker-approved</span> <span style={{ marginLeft: 8 }}>{OM.brandKits[0].disclaimer}</span></div>
      </div>
    );
  }
  if (pageKey === "contact") {
    return (
      <div data-theme="dark" style={{ background: "#ec3013", color: "#f3f2f2", margin: -34, padding: 34, height: "calc(100% + 68px)", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>Contact</div><h2 style={{ margin: "10px 0", fontSize: 30, color: "#f3f2f2" }}>Offers reviewed as received.</h2></div>
        <div style={{ borderTop: "2px solid rgba(255,255,255,.5)", paddingTop: 12, fontSize: 13 }}><strong>{OM.brandKits[0].broker}</strong><br />{OM.brandKits[0].contact}<br /><span style={{ fontSize: 9, opacity: 0.8 }}>{OM.brandKits[0].disclaimer}</span></div>
      </div>
    );
  }
  // Shared "unsourced" layout (overview / location / market / exec).
  const titles: Record<string, string> = { exec: "Executive Summary", overview: "Property Overview", location: "Location & Connectivity", market: "Market Overview" };
  return (
    <div>
      {kicker(titles[pageKey] ?? "Section")}
      <h3 style={{ margin: "6px 0 12px", fontSize: 24, color: INK }}>{titles[pageKey] ?? pageKey}</h3>
      {pageKey === "exec" ? (
        <div style={{ fontSize: 13, color: INK }} contentEditable suppressContentEditableWarning>Storyboard the thesis here — every sentence must be backed by an imported fact or marked [TBD — source required].</div>
      ) : (
        <div style={{ border: "2px dashed rgba(32,30,29,.4)", padding: 24, fontSize: 12.5, color: "#605d5d" }}>No sourced content yet. Attach a source — unsourced statements cannot be exported and this page will show <strong>Needs review</strong>.</div>
      )}
    </div>
  );
}

const cell: React.CSSProperties = { padding: "4px 6px", borderBottom: "1px solid rgba(32,30,29,.18)" };

function ComplianceCenter({ draftId, findings, approvalState, onChange, onExport, say, onClose }: { draftId: string; findings: Finding[]; approvalState: string; onChange: () => void; onExport: (f: "pptx" | "pdf") => void; say: (m: string) => void; onClose: () => void }) {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const blocking = findings.filter((f) => f.status === "open" && (f.severity === "critical" || f.severity === "high"));
  const resolvedCount = findings.filter((f) => f.status === "resolved").length;
  const approved = approvalState === "Approved" || approvalState === "Exported";
  const gate = approved ? "Approved for export" : blocking.length === 0 ? "Ready for your approval" : "Export locked";

  async function resolve(id: string) {
    const res = await postJson(`/api/om/findings/${id}/resolve`, {});
    if (res.ok) onChange();
    else say(errText(res.data));
  }
  async function approve() {
    setBusy(true);
    const res = await postJson(`/api/om/drafts/${draftId}/approve`, { confirm: true });
    setBusy(false);
    if (res.ok) {
      say("Approved for export — logged with a timestamp.");
      onChange();
    } else say(errText(res.data));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) minmax(0,1fr)", gap: 28, alignItems: "start" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "2px solid var(--color-divider)", paddingBottom: 10 }}>
          <h6 style={{ margin: 0 }}>Review &amp; compliance</h6>
          <span className={approved ? "tag tag-accent" : blocking.length === 0 ? "tag tag-neutral" : "tag tag-outline"}>{gate}</span>
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={onClose}>Back to builder</button>
        </div>
        <div className="text-muted" style={{ fontSize: 13, margin: "10px 0" }}>{resolvedCount} of {findings.length} resolved · findings grouped by severity</div>
        {findings.length === 0 && <div className="text-muted" style={{ fontSize: 14 }}>No findings yet — the checklist is clear.</div>}
        {findings.map((f) => (
          <div key={f.id} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--color-divider)", opacity: f.status === "resolved" ? 0.55 : 1 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <SeverityBadge severity={f.severity} />
                <span className="tag tag-neutral" style={{ fontSize: 9 }}>{f.lens}</span>
                <strong style={{ fontSize: 14 }}>{f.code.replace(/_/g, " ")}</strong>
              </div>
              <div className="text-muted" style={{ fontSize: 13.5, marginTop: 4 }}>{f.message}</div>
              {f.repairAction && <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>Repair: {f.repairAction}</div>}
            </div>
            {f.status === "resolved" ? <span className="tag tag-accent" style={{ alignSelf: "center" }}>Resolved</span> : <button className="btn btn-secondary" style={{ flex: "none", alignSelf: "center" }} onClick={() => resolve(f.id)}>Resolve</button>}
          </div>
        ))}
      </div>

      <div className="card elev-sm" style={{ padding: 18, gap: 12 }}>
        <div className="card-kicker">Approval gate</div>
        <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>Exports unlock only after every blocking finding is resolved and you confirm. Approval is logged with a timestamp.</p>
        <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 14 }}>
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
          I confirm this document is source-grounded and ready for broker review.
        </label>
        <button className="btn btn-primary" disabled={busy || approved || blocking.length > 0 || !checked} onClick={approve}>Approve for export</button>
        {blocking.length > 0 && <div className="text-muted" style={{ fontSize: 12.5 }}>{blocking.length} blocking finding(s) remain.</div>}
        {approved && (
          <div style={{ display: "flex", gap: 8, borderTop: "1px solid var(--color-divider)", paddingTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-secondary" onClick={() => onExport("pptx")}>Export PowerPoint</button>
            <button className="btn btn-secondary" onClick={() => onExport("pdf")}>Export PDF</button>
          </div>
        )}
        <div className="text-muted" style={{ fontSize: 12, borderTop: "1px solid var(--color-divider)", paddingTop: 10 }}>{OM.brandKits[0].disclaimer}</div>
      </div>
    </div>
  );
}
