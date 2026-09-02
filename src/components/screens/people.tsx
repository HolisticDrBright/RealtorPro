"use client";

import { DATA, type TimelineType } from "@/data/mock-data";
import { useApp } from "../app-state";

const TYPE_LABEL: Record<TimelineType, string> = {
  note: "Note",
  task: "Task",
  showing: "Showing",
  stage: "Stage",
  property: "Property",
  alert: "Alert",
};

export function PeopleScreen() {
  const app = useApp();
  const contact = DATA.contacts.find((c) => c.id === app.contactId) ?? DATA.contacts[0];
  const timeline = DATA.timelines[app.contactId] ?? [];

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1280 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, border: "2px solid var(--color-divider)", padding: "10px 14px", fontSize: 14, flexWrap: "wrap" }}>
        <span className="tag tag-accent">System of record</span>
        <span>
          <strong>Follow Up Boss holds the truth.</strong> AgentOS reads your FUB contacts, deals and history, and writes back only drafts and tasks for your approval — it never edits or deletes FUB data.
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
        <div>
          <h6 style={{ margin: "0 0 4px" }}>Contacts &amp; deals</h6>
          <table className="table" style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Stage</th>
                <th scope="col">Next step</th>
                <th scope="col">FUB sync</th>
              </tr>
            </thead>
            <tbody>
              {DATA.contacts.map((c) => {
                const selected = app.contactId === c.id;
                const synced = c.sync.indexOf("Synced") === 0;
                return (
                  <tr
                    key={c.id}
                    onClick={() => app.pickContact(c.id)}
                    style={{ cursor: "pointer", background: selected ? "color-mix(in srgb, var(--color-accent) 7%, transparent)" : "transparent" }}
                  >
                    <td>
                      <button
                        onClick={() => app.pickContact(c.id)}
                        style={{ font: "inherit", fontWeight: 600, border: "none", background: "none", padding: 0, cursor: "pointer", color: "inherit", textAlign: "left" }}
                      >
                        {c.name}
                      </button>
                      <div className="text-muted" style={{ fontSize: 12 }}>{c.role}</div>
                    </td>
                    <td><span className="tag tag-neutral">{c.stage}</span></td>
                    <td style={{ fontSize: 13.5 }}>{c.next}</td>
                    <td><span className={synced ? "tag tag-neutral" : "tag tag-outline"} style={{ fontSize: 10 }}>{c.sync}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", borderBottom: "2px solid var(--color-divider)", paddingBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <h4 style={{ margin: "0 0 4px", fontSize: 18 }}>{contact.name}</h4>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span className="tag tag-accent">{contact.stage}</span>
                <span className="tag tag-neutral">{contact.role}</span>
                <span className="text-muted" style={{ fontSize: 13, alignSelf: "center" }}>{contact.phone}</span>
              </div>
            </div>
            <button className="btn btn-ghost">Open in Follow Up Boss</button>
          </div>
          <div role="feed" aria-label="Contact timeline">
            {timeline.map((e, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "92px minmax(0, 1fr)", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div className="text-muted" style={{ fontSize: 12.5, paddingTop: 2 }}>{e.t}</div>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                    <span className={e.type === "alert" ? "tag tag-accent" : "tag tag-neutral"} style={{ fontSize: 10 }}>{TYPE_LABEL[e.type]}</span>
                    <strong style={{ fontSize: 14.5 }}>{e.title}</strong>
                  </div>
                  <div className="text-muted" style={{ fontSize: 14, marginTop: 3 }}>{e.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
