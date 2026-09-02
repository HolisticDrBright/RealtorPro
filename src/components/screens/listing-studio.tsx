"use client";

import { DATA } from "@/data/mock-data";
import { useApp } from "../app-state";
import { Spinner } from "../icons";
import { ImageSlot } from "../ui";

const STEP_TEXTS = [
  "Reading 8 facts from the MLS CSV and seller disclosure",
  "Checking media authorization and logging alterations",
  "Drafting copy against brand voice “Warm, concrete, no hype”",
  "Assembling flyer, video beats, and the disclosure record",
];

const OUT_TABS: [string, string][] = [
  ["mls", "MLS description"],
  ["social", "Social plan"],
  ["flyer", "Flyer"],
  ["video", "Listing video"],
  ["disc", "Disclosure record"],
];

function ApproveChip({ k }: { k: string }) {
  const app = useApp();
  const approved = !!app.approvals[k];
  return <span className={approved ? "tag tag-accent" : "tag tag-outline"}>{approved ? "Approved" : "Needs review"}</span>;
}

export function ListingStudioScreen() {
  const app = useApp();
  const listing = DATA.listings[0];
  const camp = DATA.campaign;
  const approvedCount = Object.values(app.approvals).filter(Boolean).length;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 1240 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 22 }}>{listing.addr}</h3>
        <span style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 17 }}>{listing.price}</span>
        <span className="tag tag-accent">{listing.status}</span>
        <span className="tag tag-neutral">Sellers: Minh &amp; Claire Tran</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 28, alignItems: "start" }}>
        {/* Intake */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
          <div>
            <h6 style={{ margin: 0, borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>Intake — facts from MLS CSV &amp; disclosures</h6>
            <table className="table" style={{ fontSize: 14 }}>
              <thead>
                <tr>
                  <th scope="col">Field</th>
                  <th scope="col">Value</th>
                  <th scope="col">Source</th>
                </tr>
              </thead>
              <tbody>
                {listing.facts.map((f) => (
                  <tr key={f.field}>
                    <td style={{ fontWeight: 600 }}>{f.field}</td>
                    <td>{f.value}</td>
                    <td className="text-muted">{f.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h6 style={{ margin: "0 0 10px", borderBottom: "2px solid var(--color-divider)", paddingBottom: 8 }}>Authorized media ({listing.media.length})</h6>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {listing.media.map((md) => (
                <figure key={md.id} style={{ margin: 0 }}>
                  <ImageSlot label={md.label} />
                  <figcaption style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "space-between" }}>
                    {md.label} <span className="tag tag-neutral" style={{ fontSize: 9.5 }}>Authorized</span>
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 8 }}>
              Only media covered by the listing agreement is used. Any AI alteration is disclosed in the record below and on the asset itself.
            </div>
          </div>
        </div>

        {/* Creative controls */}
        <div className="card elev-sm" style={{ padding: 18, gap: 12 }}>
          <div className="card-kicker">Creative controls</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Select id="cc-voice" label="Brand voice" options={["Warm, concrete, no hype", "Architectural & spare", "Story-led, neighborly"]} />
            <Select id="cc-goal" label="Campaign goal" options={["Strong first weekend — open house traffic", "Reach relocation buyers", "Reposition after price change"]} />
            <Select id="cc-style" label="Interior / exterior style emphasis" options={["Period character first (Tudor details)", "Systems & updates first", "Indoor–outdoor flow"]} />
            <Select id="cc-treat" label="Visual treatment" options={["Natural light, minimal edit", "Virtual twilight (disclosed)", "B&W editorial stills"]} />
            <Select id="cc-room" label="Room focus" options={["Kitchen + living room", "Primary suite", "Yard & corner lot"]} />
            <Select id="cc-format" label="Video format" options={["9:16 vertical · 0:30", "16:9 walkthrough · 1:30", "Stills-only carousel"]} />
            <Select id="cc-mood" label="Camera mood" options={["Steady, slow push-ins", "Handheld, walkthrough pace", "Locked-off, symmetrical"]} />
            <div className="field">
              <label htmlFor="cc-budget">Budget cap</label>
              <input id="cc-budget" className="input" defaultValue="$1,200 total · $600 boosted" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="cc-dir">Creative direction (optional)</label>
            <textarea id="cc-dir" className="input" style={{ minHeight: 66 }} placeholder="e.g. Lead with the 2019 roof / 2021 furnace story — this house is 'done'. Avoid the word 'charming'." />
          </div>

          {app.campaign === "idle" && (
            <>
              <button className="btn btn-primary btn-block" onClick={app.onGenerate}>Generate campaign draft</button>
              <div className="text-muted" style={{ fontSize: 12.5 }}>
                Drafts only. Copy is built from the intake facts on the left — each claim keeps its source. Nothing publishes without your approval.
              </div>
            </>
          )}
          {app.campaign === "generating" && (
            <div role="status" style={{ borderTop: "2px solid var(--color-divider)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {STEP_TEXTS.map((text, i) => {
                const done = i < app.genStep;
                const active = i === app.genStep;
                return (
                  <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, opacity: i > app.genStep ? 0.45 : 1 }}>
                    {active && <Spinner size={13} />}
                    {done && <span style={{ color: "var(--color-accent-700)", fontWeight: 800, flex: "none" }}>✓</span>}
                    {i > app.genStep && <span style={{ width: 13, flex: "none" }} />}
                    {text}
                  </div>
                );
              })}
            </div>
          )}
          {app.campaign === "review" && (
            <div style={{ display: "flex", gap: 10, alignItems: "center", borderTop: "2px solid var(--color-divider)", paddingTop: 12 }}>
              <span className="tag tag-accent">Draft ready · {approvedCount} of 4 sections approved</span>
              <button className="btn btn-ghost" onClick={app.onGenerate}>Regenerate</button>
            </div>
          )}
        </div>
      </div>

      {app.campaign === "review" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, borderBottom: "2px solid var(--color-divider)", paddingBottom: 10, flexWrap: "wrap" }}>
            <h6 style={{ margin: 0 }}>Campaign output — ready for your review</h6>
            <div role="tablist" aria-label="Campaign outputs" style={{ display: "flex", border: "1px solid var(--color-divider)" }}>
              {OUT_TABS.map(([id, label]) => {
                const selected = app.outTab === id;
                return (
                  <button
                    key={id}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => app.setOutTab(id)}
                    style={{
                      font: "inherit",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "none",
                      padding: "7px 14px",
                      background: selected ? "var(--color-accent)" : "transparent",
                      color: selected ? "var(--color-bg)" : "inherit",
                      borderRight: "1px solid var(--color-divider)",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {app.outTab === "mls" && (
            <div style={{ maxWidth: 760, paddingTop: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <ApproveChip k="mls" />
                <span className="text-muted" style={{ fontSize: 13 }}>Every sentence is backed by an intake fact — edit freely, sources update on save.</span>
              </div>
              {camp.mls.paras.map((pp, i) => (
                <div key={i} style={{ borderLeft: "3px solid var(--color-divider)", padding: "2px 0 2px 14px", marginBottom: 14 }}>
                  <p style={{ fontSize: 15, margin: "0 0 6px" }} contentEditable suppressContentEditableWarning>{pp.text}</p>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {pp.sources.map((src) => (
                      <span key={src} className="tag tag-neutral" style={{ fontSize: 10 }}>{src}</span>
                    ))}
                  </div>
                </div>
              ))}
              <button className="btn btn-primary" onClick={() => app.approve("mls", "MLS description")} disabled={!!app.approvals.mls}>Approve MLS description</button>
            </div>
          )}

          {app.outTab === "social" && (
            <div style={{ maxWidth: 820, paddingTop: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                <ApproveChip k="social" />
                <span className="text-muted" style={{ fontSize: 13 }}>4 posts, Wed–Sat · within the $600 boost cap</span>
              </div>
              <table className="table" style={{ fontSize: 14 }}>
                <thead>
                  <tr><th scope="col">Day</th><th scope="col">Channel</th><th scope="col">Hook</th><th scope="col">Asset</th></tr>
                </thead>
                <tbody>
                  {camp.social.map((sp) => (
                    <tr key={sp.day}>
                      <td style={{ fontWeight: 600 }}>{sp.day}</td>
                      <td>{sp.channel}</td>
                      <td>{sp.hook}</td>
                      <td className="text-muted">{sp.asset}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => app.approve("social", "Social plan")} disabled={!!app.approvals.social}>Approve social plan</button>
            </div>
          )}

          {app.outTab === "flyer" && (
            <div style={{ paddingTop: 16, display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ width: 300, flex: "none", border: "2px solid var(--color-text)", padding: 14, background: "var(--color-surface)" }} aria-label="Flyer preview">
                <ImageSlot label="Exterior hero — drop photo" ratio="3 / 2" />
                <h5 style={{ margin: "10px 0 2px" }}>3117 NE Alameda St</h5>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, color: "var(--color-accent-700)", fontSize: 16 }}>$1,150,000</div>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>4 bd · 2.5 ba · 2,860 sqft · 1926 Tudor · corner lot</div>
                <div style={{ borderTop: "1px solid var(--color-divider)", marginTop: 10, paddingTop: 8, fontSize: 10.5 }}>
                  Avery Sandoval · PDX Homes · (503) 555-0100
                  <br />
                  <span className="text-muted">Open Sat 11–1 · Photo includes virtual twilight (disclosed)</span>
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 260 }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <ApproveChip k="flyer" />
                  <span className="tag tag-outline">AI-altered media: virtual twilight on hero</span>
                </div>
                <p className="text-muted" style={{ fontSize: 14, maxWidth: 460 }}>
                  Print-ready 8.5×11, front only. Uses the approved exterior hero and the fact line from the MLS CSV. The alteration disclosure prints in the footer — it cannot be removed from this template.
                </p>
                <button className="btn btn-primary" onClick={() => app.approve("flyer", "Flyer")} disabled={!!app.approvals.flyer}>Approve flyer</button>
              </div>
            </div>
          )}

          {app.outTab === "video" && (
            <div style={{ maxWidth: 680, paddingTop: 16 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <ApproveChip k="video" />
                <span className="tag tag-neutral">{camp.video.format}</span>
                <span className="tag tag-outline">AI-altered media: virtual twilight frame</span>
              </div>
              {camp.video.beats.map((vb) => (
                <div key={vb} style={{ fontSize: 14.5, padding: "7px 0", borderBottom: "1px solid var(--color-divider)" }}>{vb}</div>
              ))}
              <div className="text-muted" style={{ fontSize: 13, margin: "10px 0 14px" }}>{camp.video.disclosure}</div>
              <button className="btn btn-primary" onClick={() => app.approve("video", "Video plan")} disabled={!!app.approvals.video}>Approve video plan</button>
            </div>
          )}

          {app.outTab === "disc" && (
            <div style={{ maxWidth: 820, paddingTop: 16 }}>
              <p className="text-muted" style={{ fontSize: 14, margin: "0 0 10px" }}>
                Permanent record of every asset in this campaign and any AI alteration. Approvals here are logged with a timestamp and kept with the listing file.
              </p>
              <table className="table" style={{ fontSize: 14 }}>
                <thead>
                  <tr><th scope="col">Asset</th><th scope="col">Alteration</th><th scope="col">Status</th></tr>
                </thead>
                <tbody>
                  {camp.disclosures.map((dr) => (
                    <tr key={dr.asset}>
                      <td style={{ fontWeight: 600 }}>{dr.asset}</td>
                      <td>{dr.alteration}</td>
                      <td><span className={dr.status === "Approved" ? "tag tag-neutral" : "tag tag-outline"}>{dr.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Select({ id, label, options }: { id: string; label: string; options: string[] }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" defaultValue={options[0]}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
