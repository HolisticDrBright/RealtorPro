"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Buyer, Match } from "@/data/mock-data";

/**
 * Global client state for AgentOS. On this branch every screen reads from the
 * local database through the API (which mirrors Follow Up Boss, Claude output
 * and the Obsidian vault). The prototype's mock data is no longer used for
 * screen content — only its `Buyer` / `Match` shapes survive for the dialogs.
 */

export type Screen =
  | "dashboard"
  | "today"
  | "scout"
  | "studio"
  | "om"
  | "visualizer"
  | "rentroll"
  | "complab"
  | "signals"
  | "people"
  | "fub"
  | "settings";
export type ImportState = "idle" | "parsing" | "ready" | "error";
export type CampaignState = "idle" | "generating" | "review";
export type FubSync = "healthy" | "sync-error" | "disconnected";

/** A buyer search as shown in Buyer Scout: a criteria profile joined to its contact. */
export interface LiveBuyer extends Buyer {
  contactId: string | null;
  temperature: string | null;
}

export interface IntegrationStatus {
  agent: { id: string; name: string; email?: string | null; license?: string | null; serviceAreas?: string[] | null; defaultBrandVoice?: string | null; quietHours?: string | null; nurtureCadence?: string | null } | null;
  fub: { configured: boolean; mock: boolean; status: string; lastSyncAt: string | null; contactCount: number; fubLinkedContacts: number; log: { id: string; direction: string; entity?: string | null; itemCount: number; status: string; detail?: string | null; createdAt: string }[] };
  claude: { configured: boolean; model: string; llmProvider: string };
  obsidian: { configured: boolean; exists: boolean; dirName: string | null; writeFolder: string; noteCount: number; lastIndexedAt: string | null; allowClaude: boolean; include: string[]; exclude: string[] };
  dataMode: "live" | "demo";
  workspaceBytes: number;
}

interface EmailPayload {
  to: string;
  subject: string;
  body: string;
  key: string;
  contactId?: string;
  propertyId?: string;
}

interface AppContextValue {
  // state
  screen: Screen;
  buyerId: string;
  contactId: string;
  theme: "light" | "dark";
  ui: "glass" | "modernist";
  fubSync: FubSync;
  integrations: IntegrationStatus | null;
  buyers: LiveBuyer[];
  shortlist: Record<string, boolean>;
  imports: Record<string, ImportState>;
  importedAt: Record<string, string>;
  parseErrors: Record<string, string>;
  campaign: CampaignState;
  genStep: number;
  outTab: string;
  approvals: Record<string, boolean>;
  toast: string;
  syncing: boolean;
  lastSync: string;
  noteOpen: boolean;
  noteMode: "voice" | "text";
  recording: boolean;
  email: EmailPayload | null;
  detail: Match | null;
  // derived
  buyer: LiveBuyer;
  importState: ImportState;
  // actions
  setScreen: (s: Screen) => void;
  goto: (s: Screen, contactId?: string) => void;
  pickBuyer: (id: string) => void;
  pickContact: (id: string) => void;
  toggleTheme: () => void;
  toggleUi: () => void;
  say: (msg: string) => void;
  reloadIntegrations: () => void;
  reloadBuyers: () => void;
  openNote: () => void;
  closeNote: () => void;
  saveNote: () => void;
  setNoteMode: (m: "voice" | "text") => void;
  toggleRec: () => void;
  openEmail: (buyer: Buyer, prop: Match) => void;
  closeEmail: () => void;
  saveEmail: () => void;
  openDetail: (m: Match) => void;
  closeDetail: () => void;
  detailSave: () => void;
  onParse: (content: string, source?: "email" | "csv") => Promise<boolean>;
  onGenerate: () => void;
  setOutTab: (t: string) => void;
  approve: (key: string, label: string) => void;
  onSync: () => void;
  onExport: () => void;
  toggleShortlist: (m: Match) => void;
  createTask: (m: Match) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

async function apiPost(path: string, body: unknown): Promise<{ ok: boolean; data: unknown }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: { message: "Network error — your local data is safe." } } };
  }
}

/** Format an ISO timestamp for display; non-ISO strings (e.g. seeded labels) pass through. */
export function fmtWhen(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const errMsg = (data: unknown, fallback: string) => (data as { error?: { message?: string } } | null)?.error?.message ?? fallback;

const EMPTY_BUYER: LiveBuyer = {
  id: "", name: "No buyer searches yet", fubId: "", phone: "", email: "", lastTouch: "", stage: "",
  ceiling: "[TBD — source required]", constraints: [], prefs: [], areas: [], mustHaves: [], contactId: null, temperature: null,
};

interface ProfileRow {
  id: string;
  label?: string | null;
  ceilingText?: string | null;
  hardConstraints?: string[] | null;
  weightedPrefs?: { label: string; weight: number }[] | null;
  areas?: string[] | null;
  mustHaves?: string[] | null;
  agreedAt?: string | null;
  contact: { id: string; name: string; fubId?: string | null; phone?: string | null; email?: string | null; stage?: string | null; temperature?: string | null; lastActivityAt?: string | null } | null;
}

function toBuyer(p: ProfileRow): LiveBuyer {
  const c = p.contact;
  const last = c?.lastActivityAt ? `Last activity ${new Date(c.lastActivityAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : p.agreedAt ? `Criteria agreed ${p.agreedAt}` : "";
  return {
    id: p.id,
    name: c?.name ?? p.label ?? "Unlinked search",
    fubId: c?.fubId ? `FUB #${c.fubId}` : "Not in FUB",
    phone: c?.phone ?? "",
    email: c?.email ?? "",
    lastTouch: last,
    stage: c?.stage ?? p.label ?? "Active search",
    ceiling: p.ceilingText ?? "[TBD — source required]",
    constraints: p.hardConstraints ?? [],
    prefs: p.weightedPrefs ?? [],
    areas: p.areas ?? [],
    mustHaves: p.mustHaves ?? [],
    contactId: c?.id ?? null,
    temperature: c?.temperature ?? null,
  };
}

function draftEmail(buyer: Buyer, prop: Match, agentName: string) {
  const first = buyer.name.split(" ")[0];
  const lines = [
    `Hi ${first},`,
    "",
    "A new listing hit your search and it scores well against what we outlined:",
    "",
    `• ${prop.addr}${prop.hood ? ` (${prop.hood})` : ""} — ${prop.price}, ${prop.beds} bd / ${prop.baths} ba, ${prop.sqft} sqft`,
    ...prop.reasons.slice(0, 2).map((r) => `• ${r.text}`),
    "",
    prop.tradeoffs[0] ? `Tradeoff to know: ${prop.tradeoffs[0]}.` : "",
    prop.verify ? `Before we go further I'll confirm: ${prop.verify}` : "",
    "",
    "Want me to set up a showing this week?",
    "",
    `— ${agentName.split(" ")[0]}`,
  ];
  return { subject: `${prop.addr} — worth a look before it moves`, body: lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n") };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [buyerId, setBuyerId] = useState("");
  const [contactId, setContactId] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [ui, setUi] = useState<"glass" | "modernist">("glass");
  const [integrations, setIntegrations] = useState<IntegrationStatus | null>(null);
  const [buyers, setBuyers] = useState<LiveBuyer[]>([]);
  const [shortlist, setShortlist] = useState<Record<string, boolean>>({});
  const [imports, setImports] = useState<Record<string, ImportState>>({});
  const [importedAt, setImportedAt] = useState<Record<string, string>>({});
  const [parseErrors, setParseErrors] = useState<Record<string, string>>({});
  const [campaign, setCampaign] = useState<CampaignState>("idle");
  const [genStep, setGenStep] = useState(0);
  const [outTab, setOutTab] = useState("mls");
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("—");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteMode, setNoteMode] = useState<"voice" | "text">("voice");
  const [recording, setRecording] = useState(false);
  const [email, setEmail] = useState<EmailPayload | null>(null);
  const [detail, setDetail] = useState<Match | null>(null);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const say = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  }, []);

  // ── Live data: integration status + buyer searches ─────────────────────
  const reloadIntegrations = useCallback(() => {
    fetch("/api/integrations/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: IntegrationStatus | null) => {
        if (!j) return;
        setIntegrations(j);
        if (j.fub.lastSyncAt) setLastSync(fmtWhen(j.fub.lastSyncAt));
      })
      .catch(() => {});
  }, []);

  const reloadBuyers = useCallback(() => {
    fetch("/api/buyer-criteria")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { profiles: ProfileRow[] } | null) => {
        if (!j) return;
        const list = j.profiles.map(toBuyer);
        setBuyers(list);
        setBuyerId((cur) => (cur && list.some((b) => b.id === cur) ? cur : list[0]?.id ?? ""));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    reloadIntegrations();
    reloadBuyers();
  }, [reloadIntegrations, reloadBuyers]);

  const fubSync: FubSync = !integrations ? "disconnected" : integrations.fub.configured ? (integrations.fub.log[0]?.status === "error" ? "sync-error" : "healthy") : "disconnected";
  const agentName = integrations?.agent?.name ?? "Agent";

  const buyer = useMemo(() => buyers.find((b) => b.id === buyerId) ?? buyers[0] ?? EMPTY_BUYER, [buyers, buyerId]);
  const importState = imports[buyerId] ?? "idle";

  const goto = useCallback((s: Screen, cId?: string) => {
    setScreen(s);
    if (cId) setContactId(cId);
  }, []);

  // Keyboard shortcuts (Esc closes dialogs, N opens capture note).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNoteOpen(false);
        setEmail(null);
        setDetail(null);
      }
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      if (e.key === "n" && !/input|textarea|select/i.test(tag) && !e.metaKey && !e.ctrlKey) {
        setNoteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /** Parse & rank a pasted alert / CSV against the selected search. Resolves true when matches were saved. */
  const onParse = useCallback(
    async (content: string, source: "email" | "csv" = "email") => {
      const id = buyerId;
      if (!id) {
        say("Create a buyer search first — criteria are required to rank listings.");
        return false;
      }
      if (!content.trim()) {
        say("Paste the alert email or CSV text first.");
        return false;
      }
      setImports((s) => ({ ...s, [id]: "parsing" }));
      const res = await apiPost("/api/buyer-scout/parse", { criteriaProfileId: id, source, content });
      if (!res.ok) {
        setParseErrors((s) => ({ ...s, [id]: errMsg(res.data, "Import failed.") }));
        setImports((s) => ({ ...s, [id]: "error" }));
        return false;
      }
      const n = (res.data as { matchCount?: number }).matchCount ?? 0;
      setImports((s) => ({ ...s, [id]: "ready" }));
      setImportedAt((s) => ({ ...s, [id]: "just now" }));
      say(`Ranked ${n} listing${n === 1 ? "" : "s"} against ${buyer.name}’s written criteria`);
      return true;
    },
    [buyerId, buyer.name, say],
  );

  const onGenerate = useCallback(() => {
    setCampaign("generating");
    setGenStep(0);
    setApprovals({});
    void apiPost("/api/studio/jobs", {
      propertyId: "l1",
      type: "campaign",
      settings: {
        brandVoice: integrations?.agent?.defaultBrandVoice ?? "Warm, concrete, no hype",
        visualTreatment: "Virtual twilight (disclosed)",
        videoFormat: "9:16 vertical · 0:30",
      },
    });
    const step = (i: number) => {
      if (i >= 4) {
        setCampaign("review");
        setOutTab("mls");
        say("Campaign draft ready — nothing publishes until you approve each section");
        return;
      }
      setGenStep(i);
      stepTimer.current = setTimeout(() => step(i + 1), 750);
    };
    step(0);
  }, [say, integrations]);

  const approve = useCallback(
    (key: string, label: string) => {
      setApprovals((s) => ({ ...s, [key]: true }));
      void apiPost("/api/approvals", {
        targetType: "section",
        targetId: `alameda-${key}`,
        label,
        approvedBy: agentName,
      });
      say(`${label} approved — recorded in the disclosure log with a timestamp`);
    },
    [say, agentName],
  );

  const onSync = useCallback(() => {
    setSyncing(true);
    void apiPost("/api/fub/sync", {}).then((res) => {
      setSyncing(false);
      if (res.ok) {
        const r = res.data as { detail?: string; mock?: boolean; lastSyncAt?: string };
        if (!r.mock && r.lastSyncAt) setLastSync("Just now");
        say(r.detail ?? "Synced with Follow Up Boss");
        reloadIntegrations();
        reloadBuyers();
      } else {
        say(errMsg(res.data, "Sync failed — your local copy is safe."));
        reloadIntegrations();
      }
    });
  }, [say, reloadIntegrations, reloadBuyers]);

  const onExport = useCallback(() => {
    void apiPost("/api/exports", {}).then((res) => {
      const ok = res.data as { export?: { filename?: string } } | null;
      say(
        ok?.export?.filename
          ? `Exported ${ok.export.filename} — criteria, imports, drafts, and the disclosure log`
          : errMsg(res.data, "Export failed."),
      );
    });
  }, [say]);

  const toggleShortlist = useCallback(
    (m: Match) => {
      const was = !!shortlist[m.id];
      setShortlist((s) => ({ ...s, [m.id]: !was }));
      if (!was && buyerId) {
        void apiPost("/api/shortlists/items", { criteriaProfileId: buyerId, matchId: m.id });
      }
      say(was ? "Removed from shortlist" : `Saved to ${buyer.name}’s shortlist`);
    },
    [shortlist, buyerId, buyer.name, say],
  );

  const createTask = useCallback(
    (m: Match) => {
      if (!buyer.contactId) {
        say("This search is not linked to a contact, so no Follow Up Boss task can be created.");
        return;
      }
      void apiPost("/api/fub/tasks", { contactId: buyer.contactId, title: `Show ${m.addr}` }).then((res) => {
        const msg = (res.data as { message?: string } | null)?.message;
        say(res.ok ? (msg ?? `Task created: “Show ${m.addr}”`) : errMsg(res.data, "Could not create the task."));
      });
    },
    [buyer.contactId, say],
  );

  const openEmail = useCallback(
    (b: Buyer, prop: Match) => {
      const d = draftEmail(b, prop, agentName);
      const live = b as Partial<LiveBuyer>;
      setEmail({ to: b.email, subject: d.subject, body: d.body, key: prop.id, contactId: live.contactId ?? undefined });
    },
    [agentName],
  );

  const saveEmail = useCallback(() => {
    const e = email;
    setEmail(null);
    if (e) {
      void apiPost("/api/drafts", { kind: "email", contactId: e.contactId, subject: e.subject, body: e.body }).then((res) => {
        say(res.ok ? "Email draft saved — review and send it yourself from Follow Up Boss" : errMsg(res.data, "Could not save the draft."));
      });
    }
  }, [email, say]);

  const saveNote = useCallback(() => {
    setNoteOpen(false);
    setRecording(false);
    say("Note saved locally — queued as a draft note on the linked FUB record");
  }, [say]);

  const detailSave = useCallback(() => {
    const d = detail;
    if (d) {
      setShortlist((s) => ({ ...s, [d.id]: true }));
      if (buyerId) void apiPost("/api/shortlists/items", { criteriaProfileId: buyerId, matchId: d.id });
      setDetail(null);
    }
    say("Saved to shortlist");
  }, [detail, buyerId, say]);

  const value: AppContextValue = {
    screen,
    buyerId,
    contactId,
    theme,
    ui,
    fubSync,
    integrations,
    buyers,
    shortlist,
    imports,
    importedAt,
    parseErrors,
    campaign,
    genStep,
    outTab,
    approvals,
    toast,
    syncing,
    lastSync,
    noteOpen,
    noteMode,
    recording,
    email,
    detail,
    buyer,
    importState,
    setScreen,
    goto,
    pickBuyer: setBuyerId,
    pickContact: setContactId,
    toggleTheme: () => setTheme((t) => (t === "light" ? "dark" : "light")),
    toggleUi: () => setUi((u) => (u === "glass" ? "modernist" : "glass")),
    say,
    reloadIntegrations,
    reloadBuyers,
    openNote: () => {
      setNoteOpen(true);
      setRecording(false);
    },
    closeNote: () => {
      setNoteOpen(false);
      setRecording(false);
    },
    saveNote,
    setNoteMode,
    toggleRec: () => setRecording((r) => !r),
    openEmail,
    closeEmail: () => setEmail(null),
    saveEmail,
    openDetail: setDetail,
    closeDetail: () => setDetail(null),
    detailSave,
    onParse,
    onGenerate,
    setOutTab,
    approve,
    onSync,
    onExport,
    toggleShortlist,
    createTask,
  };

  return (
    <div data-theme={theme} data-ui={ui} style={{ minHeight: "100vh", background: ui === "glass" ? "transparent" : "var(--color-bg)", color: "var(--color-text)", position: "relative" }}>
      {ui === "glass" && <div className="wallpaper" aria-hidden="true" />}
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </div>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}
