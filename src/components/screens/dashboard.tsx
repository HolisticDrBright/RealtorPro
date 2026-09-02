"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InboxItem } from "@/lib/google";
import { useApp } from "../app-state";
import { ErrorBox, Loading, postJson, useGet, errText } from "../modules/shared";

/**
 * Dashboard — the daily game plan, in an Apple-glass treatment scoped to this
 * screen. Everything shown comes from local data (todos, calendar, buyers,
 * transactions, contacts, off-market records); the briefing can optionally be
 * written by Claude from those same facts. Cards can be dragged into any order;
 * the layout is remembered in this browser. This is the only screen in the
 * dashboard-only build.
 */

interface Todo { id: string; title: string; kind: string; done: boolean; contactName?: string | null; notes?: string | null }
interface Ev { id: string; title: string; startsAt: string; endsAt?: string | null; location?: string | null; source: string; contactName?: string | null }
interface Tx { id: string; side: string; address: string; priceDisplay: string; status: string; stage?: string | null; contactName?: string | null }
interface Side { deals: number; volume: number; gci: number; gciUnknown: number }
interface Buyer { id: string; contactId?: string | null; name: string; temperature: string; stage?: string | null; phone?: string | null; ceiling?: string | null; areas: string[]; hardConstraints: string[]; mustHaves: string[]; prefs: { label: string; weight: number }[] }
interface Contact { id: string; name: string; role?: string | null; stage?: string | null; phone?: string | null; nextStep?: string | null; temperature?: string | null }
interface OmMatch { buyerId: string; buyerLabel: string; contactId?: string | null; propertyId: string; address: string; result: { score: number; reasons: { text: string; source: string }[]; tradeoffs: string[]; verifyQuestions: string[] }; property?: { price?: string | number | null; beds?: number | null; baths?: number | null; sqft?: string | number | null; area?: string | null; source?: string | null } }
interface Dash {
  today: string;
  agent: { name: string };
  todos: Todo[];
  events: Ev[];
  todayEvents: Ev[];
  transactions: Tx[];
  ytd: { year: number; listings: Side; buyers: Side; total: Side };
  buyers: Buyer[];
  offMarketMatches: OmMatch[];
  risks: { id: string; name: string; riskIssue?: string | null; riskFlag?: string | null; contactId?: string | null }[];
  contacts: { hotBuyers: Contact[]; warmBuyers: Contact[]; sellers: Contact[]; pastClients: Contact[]; cold: Contact[] };
  plan: { headline: string; sections: { title: string; items: string[] }[]; provider: string };
  claudeConfigured: boolean;
  obsidianConfigured: boolean;
  inbox: InboxItem[];
  vault: { configured: boolean; vaultName: string | null; recent: { path: string; title: string; excerpt: string | null; modifiedAt: string | null; tags: string[]; uri: string }[]; tasks: { text: string; note: string; uri: string }[]; changed: boolean };
  google: { configured: boolean; connected: boolean; email: string | null; error: string | null };
}

const money = (n: number) => "$" + Math.round(n).toLocaleString("en-US");
const time = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Card ids in their default order, with the number of grid columns (of 6) each spans. */
type CardId = "briefing" | "priorities" | "calls" | "calendar" | "inbox" | "vault" | "ytd" | "transactions" | "buyers" | "offmarket" | "contacts";
const DEFAULT_ORDER: CardId[] = ["briefing", "priorities", "calls", "calendar", "inbox", "vault", "ytd", "transactions", "buyers", "offmarket", "contacts"];
const SPAN: Record<CardId, number> = { briefing: 6, priorities: 2, calls: 2, calendar: 2, inbox: 3, vault: 3, ytd: 3, transactions: 3, buyers: 3, offmarket: 3, contacts: 6 };
const LABEL: Record<CardId, string> = { briefing: "Daily briefing", priorities: "Priority tasks", calls: "Calls", calendar: "Calendar", inbox: "Inbox", vault: "Obsidian", ytd: "Year to date", transactions: "Transactions", buyers: "Buyers", offmarket: "Off-market", contacts: "Contacts" };
const ORDER_KEY = "agentos.dashboard.order.v2";

/** Persisted card order (localStorage, per browser). Unknown ids are dropped, missing ids appended. */
function useCardOrder() {
  const [order, setOrder] = useState<CardId[]>(DEFAULT_ORDER);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ORDER_KEY);
      if (raw) {
        const saved = (JSON.parse(raw) as string[]).filter((id): id is CardId => DEFAULT_ORDER.includes(id as CardId));
        setOrder([...saved, ...DEFAULT_ORDER.filter((id) => !saved.includes(id))]);
      }
    } catch { /* keep default */ }
  }, []);
  const persist = (next: CardId[]) => {
    setOrder(next);
    try { window.localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* private mode etc. */ }
  };
  const move = useCallback((from: CardId, to: CardId) => {
    setOrder((cur) => {
      if (from === to) return cur;
      const next = cur.filter((id) => id !== from);
      next.splice(next.indexOf(to), 0, from);
      try { window.localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const shift = useCallback((id: CardId, dir: -1 | 1) => {
    setOrder((cur) => {
      const i = cur.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      try { window.localStorage.setItem(ORDER_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  const reset = () => persist(DEFAULT_ORDER);
  return { order, move, shift, reset, customized: order.join() !== DEFAULT_ORDER.join() };
}

export function DashboardScreen() {
  const app = useApp();
  const { data, loading, error, reload } = useGet<Dash>("/api/dashboard");
  const [briefing, setBriefing] = useState<{ text: string; provider: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState("");
  const [showImport, setShowImport] = useState(false);
  const layout = useCardOrder();
  const [dragging, setDragging] = useState<CardId | null>(null);
  const dragRef = useRef<CardId | null>(null);
  const [over, setOver] = useState<CardId | null>(null);

  // Keep the page current: refresh every 60s while visible and whenever the
  // window regains focus (vault edits and new mail show up without a reload).
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") reload(); };
    const id = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(id); window.removeEventListener("focus", tick); };
  }, [reload]);

  async function toggle(t: Todo) {
    await postPatch(`/api/todos/${t.id}`, { done: !t.done });
    reload();
  }
  async function askClaude() {
    setBusy(true);
    const res = await postJson("/api/dashboard/briefing", {});
    setBusy(false);
    if (res.ok) {
      const b = (res.data as { briefing: { text: string; provider: string } }).briefing;
      setBriefing(b);
      app.say(b.provider === "local" ? "Game plan built from today’s facts (add ANTHROPIC_API_KEY for Claude’s version)." : `Game plan written by ${b.provider}.`);
    } else app.say(errText(res.data));
  }
  async function saveToVault() {
    if (!data) return;
    const planText = briefing?.text ?? [data.plan.headline, ...data.plan.sections.map((s) => `## ${s.title}\n${s.items.map((i) => `- ${i}`).join("\n")}`)].join("\n\n");
    const res = await postJson("/api/obsidian/write", { title: `Game plan ${data.today}`, content: planText, subfolder: "Game plans" });
    if (res.ok) app.say(`Saved to your vault: ${(res.data as { path: string }).path}`);
    else app.say(errText(res.data));
  }
  async function importList() {
    const res = await postJson("/api/todos", { text: importText });
    if (res.ok) {
      app.say(`Added ${(res.data as { todos: unknown[] }).todos.length} items to today.`);
      setImportText("");
      setShowImport(false);
      reload();
    } else app.say(errText(res.data));
  }

  if (loading) return <Loading label="Building today’s game plan…" />;
  if (error || !data) return <ErrorBox message={error ?? "No data."} onRetry={reload} />;

  const priorities = data.todos.filter((t) => t.kind === "priority");
  const tasks = data.todos.filter((t) => t.kind === "task");
  const calls = data.todos.filter((t) => t.kind === "call");
  const done = data.todos.filter((t) => t.done).length;
  const hot = data.buyers.filter((b) => b.temperature === "hot");
  const warm = data.buyers.filter((b) => b.temperature !== "hot");

  /** Split the briefing text into its titled sections so the titles render bold. */
  const briefingBlocks = briefing ? splitBriefing(briefing.text) : null;

  const cards: Record<CardId, React.ReactNode> = {
    briefing: (
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(280px,1fr)", gap: 24 }}>
        <div>
          <div className="glass-kicker">{new Date(data.today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · Daily briefing</div>
          <h2 style={{ margin: "6px 0 10px", fontSize: 26, lineHeight: 1.15 }}>{briefingBlocks ? briefingBlocks.headline : data.plan.headline}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px 20px" }}>
            {(briefingBlocks ? briefingBlocks.sections : data.plan.sections).map((s, si) => (
              <div key={si}>
                <div className="glass-section-title">{s.title}</div>
                {s.items.map((i, idx) => <div key={idx} style={{ fontSize: 13.5, padding: "2px 0" }}>• {i}</div>)}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
            <button className="glass-btn primary" onClick={askClaude} disabled={busy}>{busy ? "Writing…" : data.claudeConfigured ? "Ask Claude for today’s game plan" : "Build game plan"}</button>
            <button className="glass-btn" onClick={() => setShowImport((v) => !v)}>Paste today’s to-do list</button>
            {data.obsidianConfigured && (
              <button className="glass-btn" onClick={saveToVault} disabled={busy}>Save game plan to Obsidian</button>
            )}
            <span className="text-muted" style={{ fontSize: 12.5 }}>{data.claudeConfigured ? "Claude uses only the facts shown here." : "Set ANTHROPIC_API_KEY to let Claude write it."}</span>
          </div>
          {showImport && (
            <div style={{ marginTop: 12 }}>
              <textarea className="input" style={{ minHeight: 90, borderRadius: 12 }} placeholder={"One item per line. Prefix ! for a priority, call: for a call.\n! Reply to Ruiz addendum\ncall: Lender re: appraisal\nOrder lockbox"} value={importText} onChange={(e) => setImportText(e.target.value)} />
              <button className="glass-btn primary" style={{ marginTop: 8 }} onClick={importList} disabled={!importText.trim()}>Add to today</button>
            </div>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignContent: "start" }}>
          <Stat tint="tint-blue" label="Appointments" value={String(data.todayEvents.length)} sub={data.todayEvents[0] ? `Next ${time(data.todayEvents[0].startsAt)}` : "Clear"} />
          <Stat tint="tint-mint" label="To-do done" value={`${done}/${data.todos.length}`} sub={`${priorities.filter((p) => !p.done).length} priorities open`} />
          <Stat tint="tint-violet" label="Calls to make" value={String(calls.filter((c) => !c.done).length)} sub="Today" />
          <Stat tint="tint-peach" label="Deal-risk alerts" value={String(data.risks.length)} sub={data.risks.filter((r) => r.riskFlag === "high").length + " act today"} />
        </div>
      </div>
    ),
    priorities: (
      <>
        <div className="glass-kicker">Priority tasks</div>
        <div className="glass-title">Do these first</div>
        {priorities.length === 0 && <Muted>No priorities set — paste today’s list above.</Muted>}
        {priorities.map((t) => <TodoRow key={t.id} t={t} onToggle={toggle} accent />)}
        <div className="glass-section-title" style={{ marginTop: 14 }}>Today’s to-do</div>
        {tasks.map((t) => <TodoRow key={t.id} t={t} onToggle={toggle} />)}
      </>
    ),
    calls: (
      <>
        <div className="glass-kicker">Calls to make today</div>
        <div className="glass-title">{calls.filter((c) => !c.done).length} left</div>
        {calls.length === 0 && <Muted>No calls queued.</Muted>}
        {calls.map((t) => (
          <div key={t.id} className="glass-row">
            <button className={`glass-check ${t.done ? "on" : ""}`} onClick={() => toggle(t)} aria-pressed={t.done}>{t.done ? "✓" : ""}</button>
            <div style={{ flex: 1, minWidth: 0, opacity: t.done ? 0.5 : 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{t.contactName ?? t.title}</div>
              <div className="text-muted" style={{ fontSize: 13 }}>{t.contactName ? t.title : ""}{t.notes ? ` · ${t.notes}` : ""}</div>
            </div>
            {t.notes && /\d{3}/.test(t.notes) && <a className="glass-pill accent" href={`tel:${t.notes.replace(/[^\d+]/g, "")}`} style={{ textDecoration: "none" }}>Call</a>}
          </div>
        ))}
      </>
    ),
    calendar: (
      <>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <div>
            <div className="glass-kicker">Work calendar</div>
            <div className="glass-title">Today</div>
          </div>
          <span className="glass-pill" style={{ marginLeft: "auto" }}>{data.google.connected ? "Google + local" : "Local · .ics import"}</span>
        </div>
        {data.todayEvents.length === 0 && <Muted>Nothing on the calendar today.</Muted>}
        {data.todayEvents.map((e) => (
          <div key={e.id} className="glass-row">
            <div style={{ width: 62, flex: "none", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 13.5 }}>{time(e.startsAt)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{e.title}</div>
              <div className="text-muted" style={{ fontSize: 13 }}>{[e.contactName, e.location].filter(Boolean).join(" · ")}</div>
            </div>
            <span className="glass-pill">{e.source}</span>
          </div>
        ))}
        {data.events.filter((e) => e.startsAt.slice(0, 10) !== data.today).length > 0 && (
          <>
            <div className="glass-section-title" style={{ marginTop: 12 }}>Coming up</div>
            {data.events.filter((e) => e.startsAt.slice(0, 10) !== data.today).slice(0, 5).map((e) => (
              <div key={e.id} className="glass-row" style={{ fontSize: 13.5 }}><span className="text-muted" style={{ width: 92, flex: "none" }}>{dayLabel(e.startsAt)}</span><span>{e.title}</span></div>
            ))}
          </>
        )}
        <Muted small>{data.google.connected ? `Google Calendar (${data.google.email ?? "connected"}) is mirrored read-only every couple of minutes.` : "Connect Google above to pull your calendar; Outlook exports can be imported as .ics."}</Muted>
      </>
    ),
    inbox: (
      <>
        <div className="glass-kicker">Inbox · Gmail</div>
        <div className="glass-title">{data.google.connected ? `${data.inbox.length} from the last day` : "Not connected"}</div>
        {!data.google.connected && (
          <Muted>
            {data.google.configured
              ? <>Read-only access to your calendar and inbox subjects. <a href="/api/google/auth" style={{ color: "var(--color-accent-700)", fontWeight: 600 }}>Connect Google</a> to include them in the briefing.</>
              : "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env (see .env.example), restart, then connect from the top bar."}
          </Muted>
        )}
        {data.google.error && <Muted>Google: {data.google.error}</Muted>}
        {data.google.connected && data.inbox.length === 0 && !data.google.error && <Muted>Nothing new in the inbox today.</Muted>}
        {data.inbox.map((m) => (
          <div key={m.id} className="glass-row">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontWeight: m.unread ? 700 : 600, fontSize: 14.5, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.subject}</span>
                {m.important && <span className="glass-pill accent" style={{ fontSize: 10 }}>flagged</span>}
                {m.unread && <span className="glass-pill" style={{ fontSize: 10 }}>unread</span>}
              </div>
              <div className="text-muted" style={{ fontSize: 13 }}>{m.from}{m.receivedAt ? ` · ${time(m.receivedAt)}` : ""}</div>
              {m.snippet && <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>{m.snippet}</div>}
            </div>
            {m.threadId && <a className="glass-btn" style={{ padding: "4px 10px", fontSize: 12, textDecoration: "none" }} href={`https://mail.google.com/mail/u/0/#inbox/${m.threadId}`} target="_blank" rel="noreferrer">Open</a>}
          </div>
        ))}
        {data.google.connected && <Muted small>Subjects and snippets only — AgentOS never reads full bodies, never sends mail, and never marks anything read.</Muted>}
      </>
    ),
    vault: (
      <>
        <div className="glass-kicker">Obsidian · {data.vault.vaultName ?? "vault"}</div>
        <div className="glass-title">{data.vault.configured ? `${data.vault.tasks.length} open task${data.vault.tasks.length === 1 ? "" : "s"} · ${data.vault.recent.length} recent notes` : "Not linked"}</div>
        {!data.vault.configured && <Muted>Set OBSIDIAN_VAULT_DIR in .env to your vault folder and restart. Notes are read in place; changes made in Obsidian (by you or by Claude) appear here automatically.</Muted>}
        {data.vault.tasks.length > 0 && (
          <>
            <div className="glass-section-title">From your notes</div>
            {data.vault.tasks.map((t, i) => (
              <div key={i} className="glass-row" style={{ alignItems: "baseline" }}>
                <span style={{ fontWeight: 800, color: "var(--color-accent-700)" }}>☐</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 500 }}>{t.text}</div>
                  <a className="text-muted" href={t.uri} style={{ fontSize: 12.5, color: "inherit" }}>{t.note}</a>
                </div>
              </div>
            ))}
          </>
        )}
        {data.vault.recent.length > 0 && (
          <>
            <div className="glass-section-title" style={{ marginTop: data.vault.tasks.length ? 12 : 0 }}>Recently edited</div>
            {data.vault.recent.map((n) => (
              <div key={n.path} className="glass-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={n.uri} style={{ fontWeight: 600, fontSize: 14.5, color: "inherit", textDecoration: "none" }}>{n.title}</a>
                  <div className="text-muted" style={{ fontSize: 12.5 }}>{[n.modifiedAt ? dayLabel(n.modifiedAt) + " " + time(n.modifiedAt) : null, n.path].filter(Boolean).join(" · ")}</div>
                  {n.excerpt && <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.excerpt}</div>}
                </div>
              </div>
            ))}
          </>
        )}
        {data.vault.configured && <Muted small>Open tasks come from today’s daily note, notes tagged #agentos, and the AgentOS folder. Links open in Obsidian.</Muted>}
      </>
    ),
    ytd: (
      <>
        <div className="glass-kicker">Year to date · {data.ytd.year}</div>
        <div className="glass-title">Closings</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          <YtdCol label="Total" s={data.ytd.total} />
          <YtdCol label="Listings" s={data.ytd.listings} />
          <YtdCol label="Buyers" s={data.ytd.buyers} />
        </div>
        {data.ytd.total.gciUnknown > 0 && <Muted small>{data.ytd.total.gciUnknown} closing(s) have no recorded GCI or commission % — excluded from GCI, never estimated.</Muted>}
      </>
    ),
    transactions: (
      <>
        <div className="glass-kicker">Active transactions</div>
        <div className="glass-title">{data.transactions.length} in play</div>
        {data.transactions.map((t) => (
          <div key={t.id} className="glass-row" style={{ alignItems: "center" }}>
            <span className={`glass-pill ${t.side === "listing" ? "accent" : ""}`}>{t.side === "listing" ? "Listing" : "Buyer"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{t.address}</div>
              <div className="text-muted" style={{ fontSize: 13 }}>{[t.contactName, t.stage].filter(Boolean).join(" · ")}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800 }}>{t.priceDisplay}</div>
              <span className="glass-pill" style={{ fontSize: 10 }}>{t.status}</span>
            </div>
          </div>
        ))}
      </>
    ),
    buyers: (
      <>
        <div className="glass-kicker">Active buyers</div>
        <div className="glass-title">{hot.length} hot · {warm.length} warm</div>
        {[...hot, ...warm].map((b) => (
          <div key={b.id} className="glass-row" style={{ flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", width: "100%" }}>
              <span className={`glass-pill ${b.temperature === "hot" ? "accent" : ""}`}>{b.temperature}</span>
              <strong style={{ fontSize: 14.5, flex: 1 }}>{b.name}</strong>
            </div>
            <div className="text-muted" style={{ fontSize: 13 }}>{b.ceiling ?? "Ceiling [TBD — source required]"} · {b.areas.join(", ") || "areas TBD"}</div>
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {b.hardConstraints.map((c) => <span key={c} className="glass-pill" style={{ fontSize: 10 }}>{c}</span>)}
              {b.mustHaves.map((c) => <span key={c} className="glass-pill" style={{ fontSize: 10 }}>✓ {c}</span>)}
            </div>
          </div>
        ))}
      </>
    ),
    offmarket: (
      <>
        <div className="glass-kicker">Off-market matches</div>
        <div className="glass-title">{data.offMarketMatches.length} worth a look</div>
        {data.offMarketMatches.length === 0 && <Muted>No off-market properties match a buyer’s written criteria yet.</Muted>}
        {data.offMarketMatches.map((m) => (
          <div key={m.buyerId + m.propertyId} className="glass-row">
            <div style={{ width: 44, height: 44, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--color-text)", color: "var(--color-bg)", fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 18, flex: "none" }}>{m.result.score}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.buyerLabel} ↔ {m.address}</div>
              <div className="text-muted" style={{ fontSize: 13 }}>{[m.property?.price, m.property?.beds != null ? `${m.property.beds} bd` : null, m.property?.area, m.property?.source ? `via ${m.property.source}` : null].filter(Boolean).join(" · ")}</div>
              {m.result.reasons.slice(0, 2).map((r, i) => <div key={i} style={{ fontSize: 13, marginTop: 2 }}><span style={{ color: "var(--color-accent-700)", fontWeight: 800 }}>✓</span> {r.text} <span className="glass-pill" style={{ fontSize: 9.5 }}>{r.source}</span></div>)}
              {m.result.verifyQuestions[0] && <div className="text-muted" style={{ fontSize: 12.5, marginTop: 2 }}>Verify: {m.result.verifyQuestions[0]}</div>}
            </div>
          </div>
        ))}
        <Muted small>Matched on objective facts only — same scorer as Buyer Scout. Never on demographics or neighborhood judgments.</Muted>
      </>
    ),
    contacts: (
      <>
        <div className="glass-kicker">Contacts</div>
        <div className="glass-title">Who to keep close</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
          <ContactList title="Hot buyers" list={data.contacts.hotBuyers} accent />
          <ContactList title="Warm buyers" list={data.contacts.warmBuyers} />
          <ContactList title="Sellers" list={data.contacts.sellers} />
          <ContactList title="Past clients" list={data.contacts.pastClients} />
        </div>
      </>
    ),
  };

  return (
    <div className="glass-scene" style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1320 }}>
      <div className="text-muted" style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 12.5, flexWrap: "wrap" }}>
        <span>Drag any card by its handle to rearrange the dashboard. The layout is saved in this browser.</span>
        {layout.customized && <button className="glass-btn" style={{ padding: "3px 10px", fontSize: 12 }} onClick={layout.reset}>Reset layout</button>}
      </div>
      <div className="dash-grid">
        {layout.order.map((id, idx) => (
          <section
            key={id}
            className={`glass dash-card${dragging === id ? " is-dragging" : ""}${over === id && dragging && dragging !== id ? " is-over" : ""}`}
            style={{ gridColumn: `span ${SPAN[id]}` }}
            aria-label={LABEL[id]}
            onDragOver={(e) => { if (!dragRef.current) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== id) setOver(id); }}
            onDragLeave={() => { if (over === id) setOver(null); }}
            onDrop={(e) => { e.preventDefault(); const from = (e.dataTransfer.getData("text/plain") || dragRef.current) as CardId | null; if (from) layout.move(from, id); dragRef.current = null; setDragging(null); setOver(null); }}
          >
            <div
              className="dash-handle"
              title="Drag to move"
              draggable
              onDragStart={(e) => { dragRef.current = id; setDragging(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); }}
              onDragEnd={() => { dragRef.current = null; setDragging(null); setOver(null); }}
            >
              <span aria-hidden="true">⠿</span>
              <span className="dash-handle-label">{LABEL[id]}</span>
              <span className="dash-handle-btns">
                <button type="button" aria-label={`Move ${LABEL[id]} earlier`} disabled={idx === 0} onClick={() => layout.shift(id, -1)}>↑</button>
                <button type="button" aria-label={`Move ${LABEL[id]} later`} disabled={idx === layout.order.length - 1} onClick={() => layout.shift(id, 1)}>↓</button>
              </span>
            </div>
            {cards[id]}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Turn Claude's plain-text briefing into a headline + titled sections (a line with no bullet followed by bullets). */
function splitBriefing(text: string): { headline: string; sections: { title: string; items: string[] }[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const headline = lines.shift() ?? "";
  const sections: { title: string; items: string[] }[] = [];
  for (const l of lines) {
    const bullet = l.match(/^(?:[-•*]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      if (!sections.length) sections.push({ title: "Today", items: [] });
      sections[sections.length - 1].items.push(bullet[1]);
    } else {
      sections.push({ title: l.replace(/[:：]\s*$/, ""), items: [] });
    }
  }
  return { headline, sections: sections.filter((s) => s.items.length || s.title) };
}

async function postPatch(url: string, body: unknown) {
  try {
    await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    /* local-only; ignore */
  }
}

function Stat({ label, value, sub, tint }: { label: string; value: string; sub?: string; tint?: string }) {
  return (
    <div className={`glass-stat ${tint ?? ""}`}>
      <div className="text-muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 26, lineHeight: 1.1, margin: "2px 0" }}>{value}</div>
      {sub && <div className="text-muted" style={{ fontSize: 12.5 }}>{sub}</div>}
    </div>
  );
}

function YtdCol({ label, s }: { label: string; s: Side }) {
  return (
    <div className="glass-stat">
      <div className="text-muted" style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontFamily: "var(--font-heading)", fontWeight: 800, fontSize: 24, margin: "2px 0" }}>{s.deals} <span style={{ fontSize: 13, fontWeight: 600, opacity: 0.6 }}>deals</span></div>
      <div style={{ fontSize: 13.5 }}>{money(s.volume)} <span className="text-muted">volume</span></div>
      <div style={{ fontSize: 13.5 }}>{money(s.gci)} <span className="text-muted">GCI</span></div>
    </div>
  );
}

function TodoRow({ t, onToggle, accent }: { t: Todo; onToggle: (t: Todo) => void; accent?: boolean }) {
  return (
    <div className="glass-row">
      <button className={`glass-check ${t.done ? "on" : ""}`} onClick={() => onToggle(t)} aria-pressed={t.done} aria-label={`Mark ${t.title}`}>{t.done ? "✓" : ""}</button>
      <div style={{ flex: 1, minWidth: 0, opacity: t.done ? 0.5 : 1, textDecoration: t.done ? "line-through" : "none" }}>
        <div style={{ fontWeight: accent ? 700 : 500, fontSize: 14.5 }}>{t.title}</div>
        {t.contactName && <div className="text-muted" style={{ fontSize: 12.5 }}>{t.contactName}</div>}
      </div>
    </div>
  );
}

function ContactList({ title, list, accent }: { title: string; list: Contact[]; accent?: boolean }) {
  return (
    <div>
      <div className="glass-section-title" style={{ color: accent ? "var(--color-accent)" : undefined }}>{title} · {list.length}</div>
      {list.length === 0 && <Muted small>None yet.</Muted>}
      {list.map((c) => (
        <div key={c.id} style={{ padding: "6px 0", borderBottom: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)" }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
          <div className="text-muted" style={{ fontSize: 12.5 }}>
            {[c.stage, c.nextStep].filter(Boolean).join(" · ")}
            {c.phone && <> · <a href={`tel:${c.phone.replace(/[^\d+]/g, "")}`} style={{ color: "inherit" }}>{c.phone}</a></>}
          </div>
        </div>
      ))}
    </div>
  );
}

function Muted({ children, small }: { children: React.ReactNode; small?: boolean }) {
  return <div className="text-muted" style={{ fontSize: small ? 11 : 13, marginTop: small ? 10 : 4 }}>{children}</div>;
}
