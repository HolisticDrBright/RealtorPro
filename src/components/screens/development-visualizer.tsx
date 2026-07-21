"use client";

import { useState } from "react";
import { useApp } from "../app-state";
import { ImageSlot } from "../ui";
import { ErrorBox, Loading, StatusBadge, postJson, errText, useGet, ScreenHeader } from "../modules/shared";

const TYPES: { id: string; label: string }[] = [
  { id: "site_boundary", label: "Site-boundary overlay" },
  { id: "land_teaser", label: "Conceptual land/development teaser" },
  { id: "massing", label: "Architectural massing concept" },
  { id: "future_use", label: "Future-use concept board" },
  { id: "construction_sequence", label: "Conceptual construction-sequence video" },
  { id: "aerial_reel", label: "Aerial/Reel social teaser" },
];

export function DevelopmentVisualizerScreen() {
  const app = useApp();
  const [openId, setOpenId] = useState<string | null>(null);
  if (openId) return <VizProject projectId={openId} onBack={() => setOpenId(null)} say={app.say} />;
  return <VizList onOpen={setOpenId} say={app.say} />;
}

function VizList({ onOpen, say }: { onOpen: (id: string) => void; say: (m: string) => void }) {
  const { data, loading, error, reload } = useGet<{ projects: { id: string; name: string; address: string | null; visualizationType: string; status: string }[] }>("/api/visualizer/projects");
  const [type, setType] = useState("land_teaser");
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    const res = await postJson("/api/visualizer/projects", { name: `${TYPES.find((t) => t.id === type)?.label} (demo)`, address: "TBD", visualizationType: type });
    setBusy(false);
    if (res.ok) {
      say("Visualization project created — source & rights review next.");
      reload();
    } else say(errText(res.data));
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1100 }}>
      <ScreenHeader title="Development Visualizer" sub="Turn authorized aerials, site plans, surveys, and maps into controlled concept visualizations. Conceptual only — never a survey or literal recording." />
      <div className="card elev-sm" style={{ padding: 16, gap: 10, maxWidth: 640 }}>
        <div className="card-kicker">New visualization</div>
        <div className="field">
          <label htmlFor="viz-type">Visualization type</label>
          <select id="viz-type" className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" style={{ alignSelf: "flex-start" }} onClick={create} disabled={busy}>Create project</button>
      </div>

      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.projects.length === 0 && <div className="text-muted" style={{ fontSize: 13 }}>No visualization projects yet.</div>}
      {data && data.projects.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 18 }}>
          {data.projects.map((p) => (
            <div key={p.id} style={{ border: "2px solid var(--color-divider)", padding: 14 }}>
              <div className="grayscale" style={{ aspectRatio: "16 / 9", marginBottom: 10 }}><ImageSlot label="Authorized aerial / site plan" ratio="16 / 9" /></div>
              <strong style={{ fontSize: 14 }}>{p.name}</strong>
              <div className="text-muted" style={{ fontSize: 12, margin: "4px 0 10px" }}>{TYPES.find((t) => t.id === p.visualizationType)?.label} · {p.status}</div>
              <button className="btn btn-secondary" onClick={() => onOpen(p.id)}>Open</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

interface ProjResp {
  project: { id: string; name: string; visualizationType: string; status: string };
  sources: { id: string; kind: string; label: string | null; rightsConfirmed: boolean; boundaryVerified: boolean; boundaryBasis: string | null }[];
  storyboard: { id: string; format: string; durationSec: number; visualDirection: string; cameraMovement: string; boundaryStyle: string; disclosureMode: string; budgetCapUsd: number } | null;
  jobs: { id: string; type: string; status: string; disclosureId: string | null; costEstimateUsd: number | null }[];
  boundaryAvailable: boolean;
}

function VizProject({ projectId, onBack, say }: { projectId: string; onBack: () => void; say: (m: string) => void }) {
  const { data, loading, error, reload } = useGet<ProjResp>(`/api/visualizer/projects/${projectId}`);
  const [busy, setBusy] = useState(false);
  const [board, setBoard] = useState({ format: "16:9", durationSec: 15, visualDirection: "architectural editorial", cameraMovement: "slow push-in", boundaryStyle: "none", disclosureMode: "brokerage", budgetCapUsd: 50 });

  async function addSource(kind: string, basis: string) {
    const res = await postJson(`/api/visualizer/projects/${projectId}`, { projectId, kind, label: `${kind} (authorized)`, rightsConfirmed: true, boundaryVerified: basis !== "none", boundaryBasis: basis });
    say(res.ok ? "Source added — rights confirmed." : errText(res.data));
    reload();
  }
  async function saveBoard() {
    setBusy(true);
    const res = await postJson("/api/visualizer/storyboards", { projectId, ...board, durationSec: board.durationSec });
    setBusy(false);
    say(res.ok ? "Visual direction saved." : errText(res.data));
    reload();
  }
  async function generate(type: "image" | "video" | "overlay") {
    setBusy(true);
    const res = await postJson("/api/visualizer/jobs", { projectId, type });
    setBusy(false);
    say(res.ok ? "Generated (mock) — review and approve the disclosure before export." : errText(res.data));
    reload();
  }
  async function approveDisclosureAndExport(jobId: string, disclosureId: string | null) {
    if (disclosureId) await postJson(`/api/disclosures/${disclosureId}/approve`, {});
    const res = await postJson(`/api/visualizer/jobs/${jobId}/export`, {});
    say(res.ok ? "Exported with its required disclosure." : errText(res.data));
    reload();
  }

  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error ?? "Not found."} onRetry={reload} />;

  const boundaryBlocked = board.boundaryStyle !== "none" && !data.boundaryAvailable;
  const typeLabel = TYPES.find((t) => t.id === data.project.visualizationType)?.label;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "2px solid var(--color-divider)", paddingBottom: 10, flexWrap: "wrap" }}>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
        <strong style={{ fontSize: 15 }}>{data.project.name}</strong>
        <span className="tag tag-neutral">{typeLabel}</span>
      </div>

      {/* Source & rights review */}
      <div>
        <h6 style={{ margin: "0 0 8px", borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>Source &amp; rights review</h6>
        <div className="text-muted" style={{ fontSize: 12, marginBottom: 10 }}>Only authorized, licensed, or brokerage/MLS-approved media may be used. A boundary overlay requires a verified boundary source.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button className="btn btn-secondary" onClick={() => addSource("aerial", "none")}>+ Authorized aerial</button>
          <button className="btn btn-secondary" onClick={() => addSource("survey", "survey")}>+ Survey (verifies boundary)</button>
          <button className="btn btn-secondary" onClick={() => addSource("geojson", "geojson")}>+ Approved GeoJSON</button>
        </div>
        {data.sources.map((s) => (
          <div key={s.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
            <span className="tag tag-neutral">{s.kind}</span>
            <span style={{ flex: 1 }}>{s.label}</span>
            <span className="tag tag-neutral" style={{ fontSize: 10 }}>Rights confirmed</span>
            {s.boundaryVerified && <span className="tag tag-accent" style={{ fontSize: 10 }}>Boundary verified · {s.boundaryBasis}</span>}
          </div>
        ))}
        <div style={{ marginTop: 10 }}>
          {data.boundaryAvailable
            ? <span className="tag tag-accent">Boundary overlay available</span>
            : <span className="tag tag-outline">Boundary overlay unavailable — add a survey, site plan, or approved GIS/GeoJSON</span>}
        </div>
      </div>

      {/* Visual direction controls */}
      <div className="card elev-sm" style={{ padding: 18, gap: 12 }}>
        <div className="card-kicker">Visual direction</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Sel label="Format" val={board.format} set={(v) => setBoard({ ...board, format: v })} opts={["16:9", "9:16", "square"]} />
          <Sel label="Duration (s)" val={String(board.durationSec)} set={(v) => setBoard({ ...board, durationSec: Number(v) })} opts={["10", "15", "30", "45"]} />
          <Sel label="Visual direction" val={board.visualDirection} set={(v) => setBoard({ ...board, visualDirection: v })} opts={["architectural editorial", "modern urban", "warm lifestyle", "institutional investment", "custom"]} />
          <Sel label="Camera movement" val={board.cameraMovement} set={(v) => setBoard({ ...board, cameraMovement: v })} opts={["static aerial", "slow push-in", "top-down descent", "orbit", "lateral glide"]} />
          <Sel label="Boundary style" val={board.boundaryStyle} set={(v) => setBoard({ ...board, boundaryStyle: v })} opts={["none", "subtle", "glow"]} />
          <Sel label="Disclosure mode" val={board.disclosureMode} set={(v) => setBoard({ ...board, disclosureMode: v })} opts={["brokerage", "enhanced", "custom"]} />
        </div>
        {boundaryBlocked && (
          <div role="alert" style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "10px 14px", fontSize: 12.5 }}>
            A boundary overlay requires a verified boundary source. Add a survey, site plan, or approved GIS/GeoJSON, or set boundary style to “none”.
          </div>
        )}
        <div className="text-muted" style={{ fontSize: 11.5 }}>Required disclosure will be attached: “{data.project.visualizationType === "construction_sequence" ? "Conceptual construction visualization — not actual construction progress." : "Conceptual visualization only. Not a survey, site plan, construction schedule, or representation of actual property condition."}”</div>
        <button className="btn btn-secondary" style={{ alignSelf: "flex-start" }} onClick={saveBoard} disabled={busy || boundaryBlocked}>Save visual direction</button>
      </div>

      {/* Generation queue + review/export */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>
          <h6 style={{ margin: 0 }}>Generation queue</h6>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => generate("image")} disabled={busy}>Generate image</button>
            <button className="btn btn-secondary" onClick={() => generate("video")} disabled={busy}>Generate video</button>
            <button className="btn btn-secondary" onClick={() => generate("overlay")} disabled={busy || !data.boundaryAvailable}>Generate overlay</button>
          </div>
        </div>
        {data.jobs.length === 0 && <div className="text-muted" style={{ fontSize: 13, padding: "12px 0" }}>No jobs yet. Generation runs on the local mock provider — approval + disclosure required before export.</div>}
        {data.jobs.map((j) => (
          <div key={j.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--color-divider)", fontSize: 13 }}>
            <span className="tag tag-neutral">{j.type}</span>
            <StatusBadge status={j.status} />
            <span className="text-muted" style={{ flex: 1 }}>est. ${(j.costEstimateUsd ?? 0).toFixed(2)}</span>
            {(j.status === "review") && <button className="btn btn-primary" onClick={() => approveDisclosureAndExport(j.id, j.disclosureId)}>Approve disclosure &amp; export</button>}
            {j.status === "approved" && <span className="tag tag-accent">Exported</span>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Sel({ label, val, set, opts }: { label: string; val: string; set: (v: string) => void; opts: string[] }) {
  const id = `viz-${label.replace(/\W/g, "")}`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={val} onChange={(e) => set(e.target.value)}>
        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
