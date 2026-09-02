"use client";

import { useMemo, useState } from "react";
import { useApp } from "../app-state";
import { ErrorBox, Loading, useGet } from "../modules/shared";

/**
 * People & Deals — every contact in the local database (mirrored from Follow
 * Up Boss on sync, plus local-only records) and a unified timeline per contact:
 * FUB notes / tasks / appointments / deals and any Obsidian notes linked to them.
 */

interface ContactRow {
  id: string;
  fubId?: string | null;
  name: string;
  role?: string | null;
  stage?: string | null;
  nextStep?: string | null;
  phone?: string | null;
  email?: string | null;
  temperature?: string | null;
  tags?: string[] | null;
  source?: string | null;
  lastActivityAt?: string | null;
  openTasks: number;
}
type EntryType = "note" | "task" | "showing" | "stage" | "alert" | "vault";
interface Entry { t: string | null; type: EntryType; title: string; body: string; source: string }

const TYPE_LABEL: Record<EntryType, string> = { note: "Note", task: "Task", showing: "Appointment", stage: "Deal", alert: "Alert", vault: "Obsidian" };
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" }) : "—");

export function PeopleScreen() {
  const app = useApp();
  const { data, loading, error, reload } = useGet<{ contacts: ContactRow[] }>("/api/contacts");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "sellers" | "past">("all");

  const contacts = useMemo(() => {
    const list = data?.contacts ?? [];
    const needle = q.trim().toLowerCase();
    return list.filter((c) => {
      if (filter === "hot" && c.temperature !== "hot") return false;
      if (filter === "warm" && c.temperature !== "warm") return false;
      if (filter === "sellers" && !/seller/i.test(c.role ?? "")) return false;
      if (filter === "past" && !/past/i.test(c.role ?? "")) return false;
      if (!needle) return true;
      return [c.name, c.email, c.phone, c.stage, c.role, ...(c.tags ?? [])].some((v) => (v ?? "").toLowerCase().includes(needle));
    });
  }, [data, q, filter]);

  const contact = contacts.find((c) => c.id === app.contactId) ?? contacts[0] ?? null;
  const live = app.integrations?.dataMode === "live";

  if (loading) return <Loading label="Loading contacts…" />;
  if (error || !data) return <ErrorBox message={error ?? "No data."} onRetry={reload} />;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1320 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, border: "2px solid var(--color-divider)", padding: "10px 14px", fontSize: 14, flexWrap: "wrap" }}>
        <span className="tag tag-accent">{live ? "Live · Follow Up Boss" : "Demo data"}</span>
        <span>
          <strong>Follow Up Boss holds the truth.</strong> AgentOS mirrors your FUB contacts, deals and history into this machine on each sync, and writes back only drafts and tasks for your approval — it never edits or deletes FUB data.
          {!live && " Add FUB_API_KEY in .env and press Sync now (Follow Up Boss tab) to replace the seeded demo people with your real database."}
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr)", gap: 28, alignItems: "start" }}>
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
            <h6 style={{ margin: 0 }}>Contacts &amp; deals</h6>
            <span className="text-muted" style={{ fontSize: 13 }}>{contacts.length} of {data.contacts.length}</span>
            <input className="input" aria-label="Search contacts" placeholder="Search name, email, phone, tag…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginLeft: "auto", maxWidth: 260 }} />
          </div>
          <div className="seg" role="radiogroup" aria-label="Filter contacts" style={{ marginBottom: 10 }}>
            {(["all", "hot", "warm", "sellers", "past"] as const).map((f) => (
              <label key={f} className={`seg-opt${filter === f ? " is-active" : ""}`}>
                <input type="radio" name="people-filter" checked={filter === f} onChange={() => setFilter(f)} style={hidden} />
                <span>{{ all: "All", hot: "Hot buyers", warm: "Warm buyers", sellers: "Sellers", past: "Past clients" }[f]}</span>
              </label>
            ))}
          </div>
          <table className="table" style={{ fontSize: 14 }}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Stage</th>
                <th scope="col">Next step</th>
                <th scope="col">FUB</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const selected = contact?.id === c.id;
                return (
                  <tr key={c.id} onClick={() => app.pickContact(c.id)} style={{ cursor: "pointer", background: selected ? "color-mix(in srgb, var(--color-accent) 7%, transparent)" : "transparent" }}>
                    <td>
                      <button onClick={() => app.pickContact(c.id)} style={{ font: "inherit", fontWeight: 600, border: "none", background: "none", padding: 0, cursor: "pointer", color: "inherit", textAlign: "left" }}>
                        {c.name}
                      </button>
                      <div className="text-muted" style={{ fontSize: 12 }}>
                        {[c.role, c.temperature ? `${c.temperature} lead` : null].filter(Boolean).join(" · ")}
                      </div>
                    </td>
                    <td>{c.stage ? <span className="tag tag-neutral">{c.stage}</span> : <span className="text-muted">—</span>}</td>
                    <td style={{ fontSize: 13.5 }}>{c.nextStep ?? (c.openTasks ? `${c.openTasks} open task${c.openTasks === 1 ? "" : "s"}` : <span className="text-muted">—</span>)}</td>
                    <td><span className={c.fubId ? "tag tag-neutral" : "tag tag-outline"} style={{ fontSize: 10 }}>{c.fubId ? `#${c.fubId}` : "Local only"}</span></td>
                  </tr>
                );
              })}
              {contacts.length === 0 && (
                <tr><td colSpan={4} className="text-muted" style={{ padding: 18 }}>No contacts match. {data.contacts.length === 0 ? "Sync Follow Up Boss to pull your database." : "Clear the search or filter."}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {contact && <ContactPanel contact={contact} />}
      </div>
    </section>
  );
}

function ContactPanel({ contact }: { contact: ContactRow }) {
  const { data, loading, error, reload } = useGet<{ timeline: Entry[] }>(`/api/contacts/${contact.id}/timeline`);
  const fubUrl = contact.fubId && /^\d+$/.test(contact.fubId) ? `https://app.followupboss.com/2/people/view/${contact.fubId}` : null;
  const vaultCount = data?.timeline.filter((e) => e.type === "vault").length ?? 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap", borderBottom: "2px solid var(--color-divider)", paddingBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h4 style={{ margin: "0 0 4px", fontSize: 18 }}>{contact.name}</h4>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {contact.stage && <span className="tag tag-accent">{contact.stage}</span>}
            {contact.role && <span className="tag tag-neutral">{contact.role}</span>}
            {(contact.tags ?? []).slice(0, 4).map((t) => <span key={t} className="tag tag-outline">{t}</span>)}
            <span className="text-muted" style={{ fontSize: 13, alignSelf: "center" }}>{[contact.phone, contact.email].filter(Boolean).join(" · ")}</span>
          </div>
          {(contact.source || contact.lastActivityAt) && (
            <div className="text-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {[contact.source ? `Source: ${contact.source}` : null, contact.lastActivityAt ? `Last activity ${when(contact.lastActivityAt)}` : null].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        {fubUrl ? (
          <a className="btn btn-ghost" href={fubUrl} target="_blank" rel="noreferrer">Open in Follow Up Boss</a>
        ) : (
          <span className="tag tag-outline" style={{ alignSelf: "center" }}>Not linked to FUB</span>
        )}
      </div>

      {loading && <Loading label="Loading timeline…" />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="text-muted" style={{ fontSize: 12.5, padding: "8px 0" }}>
            {data.timeline.length} entries{vaultCount ? ` · ${vaultCount} from your Obsidian vault` : ""}
          </div>
          <div role="feed" aria-label="Contact timeline">
            {data.timeline.map((e, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "92px minmax(0, 1fr)", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--color-divider)" }}>
                <div className="text-muted" style={{ fontSize: 12.5, paddingTop: 2 }}>{when(e.t)}</div>
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                    <span className={e.type === "alert" ? "tag tag-accent" : e.type === "vault" ? "tag tag-outline" : "tag tag-neutral"} style={{ fontSize: 10 }}>{TYPE_LABEL[e.type]}</span>
                    <strong style={{ fontSize: 14.5 }}>{e.title}</strong>
                  </div>
                  {e.body && <div className="text-muted" style={{ fontSize: 14, marginTop: 3, whiteSpace: "pre-wrap" }}>{e.body}</div>}
                  <div className="text-muted" style={{ fontSize: 11.5, marginTop: 3 }}>{e.source}</div>
                </div>
              </div>
            ))}
            {data.timeline.length === 0 && (
              <div className="text-muted" style={{ padding: "18px 0", fontSize: 14 }}>
                No history yet for this contact. Notes, tasks and appointments arrive with the next Follow Up Boss sync; Obsidian notes appear once the vault is indexed and a note names this person.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const hidden: React.CSSProperties = { position: "absolute", opacity: 0, width: 0, height: 0, pointerEvents: "none" };
