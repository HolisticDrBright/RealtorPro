"use client";

import { useState } from "react";
import { useApp } from "../app-state";
import { ErrorBox, Loading, SeverityBadge, StatusBadge, postJson, errText, ScreenHeader } from "../modules/shared";

const SAMPLE = `Unit,Tenant,SqFt,Lease End,Monthly Rent,Annual Rent,Status
C-101,Blue Fin Coffee,1450,03/2028,4350,52200,Current
C-102,Vacant,1180,,,,Vacant
204,Residential 1BR,685,MTM,1595,19140,MTM
207,,702,01/2027,1675,20100,Current
305,Residential 2BR,940,11/2026,2150,25800,Current`;

interface ImportResult {
  rentRollId: string;
  unitCount: number;
  summary: { total: number; occupied: number; vacant: number; grossPotentialAnnual: number; actualAnnual: number; totalSf: number };
  findings: { code: string; severity: string; message: string; unitRef?: string }[];
  derived: { metric: string; display: string; status: string; formula: string }[];
}

export function RentRollStudioScreen() {
  const app = useApp();
  const [csv, setCsv] = useState(SAMPLE);
  const [redact, setRedact] = useState(false);
  const [localOnly, setLocalOnly] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runImport() {
    setBusy(true);
    setError(null);
    const res = await postJson("/api/rent-roll/import", { name: "Rent roll (demo)", content: csv, localOnly, redactPii: redact });
    setBusy(false);
    if (res.ok) {
      setResult(res.data as ImportResult);
      app.say(`Imported ${(res.data as ImportResult).unitCount} units · ${(res.data as ImportResult).findings.length} findings`);
    } else setError(errText(res.data));
  }
  async function doExport() {
    if (!result) return;
    const res = await postJson(`/api/rent-roll/${result.rentRollId}/export`, { redactPii: redact });
    app.say(res.ok ? (res.data as { message?: string }).message ?? "Exported workbook." : errText(res.data));
  }

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 1240 }}>
      <ScreenHeader title="Rent Roll Studio" sub="Upload → map → validate → resolve → analyze → export. Multifamily, commercial, mixed-use. Demo data is fictional." />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 24, alignItems: "start" }}>
        <div className="field">
          <label htmlFor="rr-csv">Paste a CSV rent roll (or drop a file into an XLSX-exported CSV)</label>
          <textarea id="rr-csv" className="input" style={{ minHeight: 150, fontFamily: "monospace", fontSize: 13 }} value={csv} onChange={(e) => setCsv(e.target.value)} />
        </div>
        <div className="card elev-sm" style={{ padding: 16, gap: 10 }}>
          <div className="card-kicker">Privacy</div>
          <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center" }}><input type="checkbox" checked={localOnly} onChange={(e) => setLocalOnly(e.target.checked)} /> Local-only processing</label>
          <label style={{ display: "flex", gap: 8, fontSize: 14, alignItems: "center" }}><input type="checkbox" checked={redact} onChange={(e) => setRedact(e.target.checked)} /> Redact tenant PII on export</label>
          <div className="text-muted" style={{ fontSize: 12.5 }}>AgentOS warns before sending rent-roll data to any external AI provider. This import is processed locally.</div>
          <button className="btn btn-primary btn-block" onClick={runImport} disabled={busy}>Validate &amp; analyze</button>
        </div>
      </div>

      {busy && <Loading label="Normalizing rows and checking every value…" />}
      {error && <ErrorBox message={error} onRetry={runImport} />}

      {result && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 16 }}>
            {[{ l: "Units", v: String(result.summary.total) }, { l: "Occupied", v: String(result.summary.occupied) }, { l: "Vacant", v: String(result.summary.vacant) }, ...result.derived.map((d) => ({ l: d.metric, v: d.display }))].map((s) => (
              <div key={s.l} style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 10 }}>
                <div className="text-muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.l}</div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24, margin: "4px 0 2px" }}>{s.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 28, alignItems: "start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>
                <h6 style={{ margin: 0 }}>Validation findings ({result.findings.length})</h6>
                <button className="btn btn-secondary" style={{ marginLeft: "auto" }} onClick={doExport}>Export Excel workbook</button>
              </div>
              {result.findings.length === 0 && <div className="text-muted" style={{ fontSize: 14, padding: "12px 0" }}>No validation issues found.</div>}
              {result.findings.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid var(--color-divider)" }}>
                  <SeverityBadge severity={f.severity} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{f.code.replace(/_/g, " ")} {f.unitRef && <span className="text-muted">· {f.unitRef}</span>}</div>
                    <div className="text-muted" style={{ fontSize: 13.5 }}>{f.message}</div>
                  </div>
                </div>
              ))}
            </div>
            <div>
              <h6 style={{ margin: 0, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>Derived figures (formula + source stored)</h6>
              <table className="table" style={{ fontSize: 13.5 }}>
                <thead><tr><th scope="col">Metric</th><th scope="col">Value</th><th scope="col">Status</th></tr></thead>
                <tbody>{result.derived.map((d) => <tr key={d.metric}><td style={{ fontWeight: 600 }}>{d.metric}</td><td>{d.display}</td><td><StatusBadge status={d.status} /></td></tr>)}</tbody>
              </table>
              <div className="text-muted" style={{ fontSize: 12.5, marginTop: 8 }}>Pending figures show “—” until inputs exist. The approved rent roll is available to OM Studio as a source-linked section.</div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
