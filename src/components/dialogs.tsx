"use client";

import { useApp } from "./app-state";
import { IconMic } from "./icons";

function Backdrop({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="dialog-backdrop" style={{ zIndex: 60 }} onClick={onClose}>
      {children}
    </div>
  );
}

const stop = (e: React.MouseEvent) => e.stopPropagation();

export function NoteDialog() {
  const app = useApp();
  if (!app.noteOpen) return null;
  const bars = [100, 70, 90, 55, 80];
  return (
    <Backdrop onClose={app.closeNote}>
      <div className="dialog" role="dialog" aria-modal="true" aria-label="Capture note" onClick={stop}>
        <div className="dialog-title">Capture note</div>
        <div style={{ display: "flex", border: "1px solid var(--color-divider)", alignSelf: "flex-start" }}>
          {(["voice", "text"] as const).map((mode) => {
            const active = app.noteMode === mode;
            return (
              <button
                key={mode}
                onClick={() => app.setNoteMode(mode)}
                style={{
                  font: "inherit",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  padding: "7px 14px",
                  borderLeft: mode === "text" ? "1px solid var(--color-divider)" : undefined,
                  background: active ? "var(--color-accent)" : "transparent",
                  color: active ? "var(--color-bg)" : "inherit",
                }}
              >
                {mode === "voice" ? "Voice" : "Text"}
              </button>
            );
          })}
        </div>

        {app.noteMode === "voice" && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 0" }}>
            <button
              className="btn btn-primary"
              style={{ width: 52, height: 52, padding: 0, justifyContent: "center" }}
              onClick={app.toggleRec}
              aria-pressed={app.recording}
              aria-label="Start or stop recording"
            >
              <IconMic size={20} />
            </button>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 26 }} aria-hidden="true">
                {bars.map((h, i) => (
                  <span
                    key={i}
                    style={{
                      width: 4,
                      height: `${h}%`,
                      background: "var(--color-accent)",
                      transformOrigin: "bottom",
                      animation: app.recording ? "pulsebar 0.9s ease-in-out infinite" : "none",
                      animationDelay: `${i * 0.15}s`,
                    }}
                  />
                ))}
              </div>
              <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                {app.recording ? "Recording… tap again to stop. Transcribes on-device." : "Tap the mic to record. Audio never leaves this machine."}
              </div>
            </div>
          </div>
        )}

        {app.noteMode === "text" && (
          <div className="field">
            <label htmlFor="note-body">Note</label>
            <textarea id="note-body" className="input" style={{ minHeight: 96 }} placeholder="e.g. Mehtas want to re-walk Reedway with the inspector's checklist before offering…" />
          </div>
        )}

        <div className="field">
          <label htmlFor="note-link">Link to</label>
          <select id="note-link" className="input" defaultValue="Jordan & Priya Mehta">
            <option>Jordan &amp; Priya Mehta</option>
            <option>Dana Whitfield</option>
            <option>Marcus &amp; Elena Ruiz</option>
            <option>Minh &amp; Claire Tran</option>
            <option>3117 NE Alameda St (listing)</option>
            <option>No link — general note</option>
          </select>
        </div>
        <div className="text-muted" style={{ fontSize: 13 }}>
          Saved locally now, transcribed on-device, then queued as a <strong>draft note</strong> on the linked FUB record.
        </div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={app.closeNote}>Cancel</button>
          <button className="btn btn-primary" onClick={app.saveNote}>Save note</button>
        </div>
      </div>
    </Backdrop>
  );
}

export function EmailDialog() {
  const app = useApp();
  const email = app.email;
  if (!email) return null;
  return (
    <Backdrop onClose={app.closeEmail}>
      <div className="dialog" style={{ width: "min(560px, 100%)" }} role="dialog" aria-modal="true" aria-label="Draft client email" onClick={stop}>
        <div className="dialog-title">Draft client email</div>
        <div className="text-muted" style={{ fontSize: 13.5 }}>To: {email.to}</div>
        <div className="field">
          <label htmlFor="em-subj">Subject</label>
          <input id="em-subj" className="input" key={email.key + "s"} defaultValue={email.subject} />
        </div>
        <div className="field">
          <label htmlFor="em-body">Body — edit before saving</label>
          <textarea id="em-body" className="input" style={{ minHeight: 220, fontSize: 14 }} key={email.key + "b"} defaultValue={email.body} />
        </div>
        <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "8px 12px", fontSize: 13.5 }}>
          <strong>Draft only.</strong> This saves to Follow Up Boss as a draft — you review and send it from there. AgentOS never emails clients directly.
        </div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={app.closeEmail}>Discard</button>
          <button className="btn btn-primary" onClick={app.saveEmail}>Save draft to FUB</button>
        </div>
      </div>
    </Backdrop>
  );
}

export function DetailDialog() {
  const app = useApp();
  const d = app.detail;
  if (!d) return null;
  return (
    <Backdrop onClose={app.closeDetail}>
      <div className="dialog" style={{ width: "min(600px, 100%)" }} role="dialog" aria-modal="true" aria-label="Listing details" onClick={stop}>
        <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
          <div className="dialog-title" style={{ margin: 0 }}>{d.addr}</div>
          <span className="tag tag-neutral">{d.mls}</span>
        </div>
        <div style={{ fontSize: 15 }}>
          <strong>{d.price}</strong> · {d.beds} bd / {d.baths} ba · {d.sqft} sqft · {d.hood}
        </div>
        <div>
          <h6 style={{ margin: "0 0 4px", fontSize: 12 }}>Why it ranks {d.score}</h6>
          {d.reasons.map((re, i) => (
            <div key={i} style={{ fontSize: 14, padding: "3px 0", display: "flex", gap: 7 }}>
              <span style={{ color: "var(--color-accent-700)", fontWeight: 800 }}>✓</span>
              <span>{re.text} <span className="tag tag-neutral" style={{ fontSize: 10, marginLeft: 4 }}>{re.source}</span></span>
            </div>
          ))}
          <h6 style={{ margin: "10px 0 4px", fontSize: 12 }}>Tradeoffs</h6>
          {d.tradeoffs.map((to, i) => (
            <div key={i} className="text-muted" style={{ fontSize: 14, padding: "3px 0" }}>– {to}</div>
          ))}
        </div>
        {d.verify && (
          <div style={{ background: "var(--color-accent-100)", color: "var(--color-accent-800)", padding: "8px 12px", fontSize: 13.5 }}>
            <strong>Verify before recommending:</strong> {d.verify}
          </div>
        )}
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={app.closeDetail}>Close</button>
          <button className="btn btn-primary" onClick={app.detailSave}>Save to shortlist</button>
        </div>
      </div>
    </Backdrop>
  );
}
