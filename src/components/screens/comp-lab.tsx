"use client";

import { useState } from "react";
import { useApp } from "../app-state";
import { ErrorBox, Loading, StatusBadge, postJson, errText, ScreenHeader } from "../modules/shared";

const SAMPLE = `Address,Asset Type,Sale Date,Sale Price,SF,Distance,Cap Rate,Source
2204 SE Division St,Mixed-use,04/2026,"$7,900,000",24000,0.8,5.4,County deed
811 SE Stark St,Mixed-use,06/2026,"$9,100,000",26600,1.1,,Broker-reported
5030 NE Sandy Blvd,Mixed-use,12/2025,"$6,200,000",20600,2.3,5.9,County deed`;

interface CompRow { id: string; address: string | null; transactionDate: string | null; price: number | null; pricePerSf: number | null; distanceMi: number | null; source: string | null; verificationStatus: string; score: number | null; missingFields: string[] }

export function CompLabScreen() {
  const app = useApp();
  const [csv, setCsv] = useState(SAMPLE);
  const [comps, setComps] = useState<CompRow[] | null>(null);
  const [setId, setSetId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runImport() {
    setBusy(true);
    setError(null);
    const res = await postJson("/api/comps/import", { name: "Comp set (demo)", compType: "sales", content: csv, subject: { size: 25000, pricePerSf: 330, assetType: "Mixed-use" } });
    setBusy(false);
    if (res.ok) {
      const d = res.data as { compSetId: string; comps: CompRow[] };
      setComps(d.comps);
      setSetId(d.compSetId);
      app.say(`Imported ${d.comps.length} comps from an authorized source`);
    } else setError(errText(res.data));
  }
  async function doExport(format: "xlsx" | "pdf") {
    if (!setId) return;
    const res = await postJson(`/api/comps/${setId}/export`, { format });
    app.say(res.ok ? (res.data as { message?: string }).message ?? "Exported." : errText(res.data));
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1240 }}>
      <ScreenHeader title="Comp Lab" sub="Import authorized MLS/provider/public-record exports → normalize → compare → export. Never an appraisal or valuation." />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "start" }}>
        <div className="field">
          <label htmlFor="cl-csv">Paste an authorized comps CSV (sales, lease, active, pending)</label>
          <textarea id="cl-csv" className="input" style={{ minHeight: 130, fontFamily: "monospace", fontSize: 12 }} value={csv} onChange={(e) => setCsv(e.target.value)} />
        </div>
        <div className="card elev-sm" style={{ padding: 16, gap: 10 }}>
          <div className="card-kicker">Transparency</div>
          <div className="text-muted" style={{ fontSize: 11.5 }}>Scores blend only the objective dimensions with data (distance, recency, size, $/SF, asset match) using your weights. AgentOS never calls a comp “the best” or invents adjustments.</div>
          <button className="btn btn-primary btn-block" onClick={runImport} disabled={busy}>Normalize &amp; score</button>
        </div>
      </div>

      {busy && <Loading label="Normalizing and scoring comps…" />}
      {error && <ErrorBox message={error} onRetry={runImport} />}

      {comps && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>
            <h6 style={{ margin: 0 }}>Comparison ({comps.length})</h6>
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => doExport("xlsx")}>Export workbook</button>
              <button className="btn btn-secondary" onClick={() => doExport("pdf")}>Client PDF</button>
            </div>
          </div>
          <table className="table" style={{ fontSize: 13 }}>
            <thead><tr><th scope="col">Score</th><th scope="col">Address</th><th scope="col">Date</th><th scope="col">Price</th><th scope="col">$/SF</th><th scope="col">Dist.</th><th scope="col">Source</th><th scope="col">Verification</th></tr></thead>
            <tbody>
              {comps.map((c) => (
                <tr key={c.id}>
                  <td><span style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>{c.score ?? "—"}</span></td>
                  <td style={{ fontWeight: 600 }}>{c.address}{c.missingFields.length > 0 && <div className="text-muted" style={{ fontSize: 10 }}>missing: {c.missingFields.join(", ")}</div>}</td>
                  <td>{c.transactionDate ?? "—"}</td>
                  <td>{c.price != null ? "$" + c.price.toLocaleString() : "—"}</td>
                  <td>{c.pricePerSf != null ? "$" + Math.round(c.pricePerSf) + "/SF" : "—"}</td>
                  <td>{c.distanceMi != null ? c.distanceMi + " mi" : "—"}</td>
                  <td className="text-muted">{c.source}</td>
                  <td><StatusBadge status={c.verificationStatus.replace(/_/g, " ")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-muted" style={{ fontSize: 11.5, marginTop: 8 }}>Every comp shows its source, missing fields, and verification status. Manual adjustments are labeled agent-entered assumptions, not facts.</div>
        </div>
      )}
    </section>
  );
}
