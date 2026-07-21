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
import { DATA, draftEmail, type Buyer, type Match } from "@/data/mock-data";

/**
 * Global client state for AgentOS — a faithful port of the design prototype's
 * state class. Screen content comes from the ported mock data; the interactive
 * workflows (parse & rank, generate, sync, create task/note, approvals, export)
 * additionally call the real backend API and fall back to the prototype's
 * simulated behavior if the API is unavailable, so screens never break.
 */

export type Screen = "today" | "scout" | "studio" | "people" | "fub" | "settings";
export type ImportState = "idle" | "parsing" | "ready" | "error";
export type CampaignState = "idle" | "generating" | "review";
export type FubSync = "healthy" | "sync-error" | "disconnected";

/** Map Buyer Scout buyer ids → seeded criteria-profile ids and contact ids. */
const CRITERIA_PROFILE: Record<string, string> = { b1: "cp-b1", b2: "cp-b2", b3: "cp-b3" };
const BUYER_CONTACT: Record<string, string> = { b1: "c1", b2: "c2", b3: "c3" };

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
  fubSync: FubSync;
  shortlist: Record<string, boolean>;
  imports: Record<string, ImportState>;
  importedAt: Record<string, string>;
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
  buyer: Buyer;
  importState: ImportState;
  // actions
  setScreen: (s: Screen) => void;
  goto: (s: Screen, contactId?: string) => void;
  pickBuyer: (id: string) => void;
  pickContact: (id: string) => void;
  toggleTheme: () => void;
  say: (msg: string) => void;
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
  onParse: () => void;
  onGenerate: () => void;
  setOutTab: (t: string) => void;
  approve: (key: string, label: string) => void;
  onSync: () => void;
  onExport: () => void;
  toggleShortlist: (m: Match) => void;
  createTask: (m: Match) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

async function apiPost(path: string, body: unknown): Promise<unknown | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [screen, setScreen] = useState<Screen>("today");
  const [buyerId, setBuyerId] = useState("b1");
  const [contactId, setContactId] = useState("c3");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [fubSync] = useState<FubSync>("healthy");
  const [shortlist, setShortlist] = useState<Record<string, boolean>>({});
  const [imports, setImports] = useState<Record<string, ImportState>>({});
  const [importedAt, setImportedAt] = useState<Record<string, string>>({ b1: "today 7:02 AM" });
  const [campaign, setCampaign] = useState<CampaignState>("idle");
  const [genStep, setGenStep] = useState(0);
  const [outTab, setOutTab] = useState("mls");
  const [approvals, setApprovals] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState("Today 9:42 AM");
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

  const buyer = useMemo(
    () => DATA.buyers.find((b) => b.id === buyerId) ?? DATA.buyers[0],
    [buyerId],
  );

  const defImp: Record<string, ImportState> = { b1: "ready", b2: "idle", b3: "idle" };
  const importState = imports[buyerId] ?? defImp[buyerId] ?? "idle";

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

  const onParse = useCallback(() => {
    const id = buyerId;
    const name = buyer.name;
    setImports((s) => ({ ...s, [id]: "parsing" }));
    // Fire the real backend in the background (best-effort); UI keeps the
    // prototype's simulated latency + demo states for design fidelity.
    const textarea = document.getElementById("alert-paste") as HTMLTextAreaElement | null;
    const content = textarea?.value?.trim();
    if (content) {
      void apiPost("/api/buyer-scout/parse", {
        criteriaProfileId: CRITERIA_PROFILE[id] ?? id,
        source: "email",
        content,
      });
    }
    if (stepTimer.current) clearTimeout(stepTimer.current);
    stepTimer.current = setTimeout(() => {
      const err = id === "b3"; // demo: the Ruiz search always errors
      setImports((s) => ({ ...s, [id]: err ? "error" : "ready" }));
      setImportedAt((s) => ({ ...s, [id]: "just now" }));
      if (!err) {
        const n = (DATA.matches[id] ?? []).length;
        say(`Ranked ${n} listings against ${name}’s written criteria`);
      }
    }, 1600);
  }, [buyerId, buyer.name, say]);

  const onGenerate = useCallback(() => {
    setCampaign("generating");
    setGenStep(0);
    setApprovals({});
    // Kick the real job in the background against the seeded Alameda listing.
    void apiPost("/api/studio/jobs", {
      propertyId: "l1",
      type: "campaign",
      settings: {
        brandVoice: "Warm, concrete, no hype",
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
  }, [say]);

  const approve = useCallback(
    (key: string, label: string) => {
      setApprovals((s) => ({ ...s, [key]: true }));
      void apiPost("/api/approvals", {
        targetType: "section",
        targetId: `alameda-${key}`,
        label,
        approvedBy: "Avery Sandoval",
      });
      say(`${label} approved — recorded in the disclosure log with a timestamp`);
    },
    [say],
  );

  const onSync = useCallback(() => {
    setSyncing(true);
    if (stepTimer.current) clearTimeout(stepTimer.current);
    stepTimer.current = setTimeout(() => {
      setSyncing(false);
      setLastSync("Just now");
    }, 1500);
    void apiPost("/api/fub/sync", {}).then((res) => {
      const detail = (res as { detail?: string } | null)?.detail;
      say(detail ?? "Synced with Follow Up Boss — 3 records pulled, 2 drafts pushed");
    });
  }, [say]);

  const onExport = useCallback(() => {
    void apiPost("/api/exports", {}).then((res) => {
      const ok = res as { export?: { filename?: string } } | null;
      say(
        ok?.export?.filename
          ? `Exported ${ok.export.filename} — criteria, imports, drafts, and the disclosure log`
          : "Exported agentos-backup.zip — criteria, imports, drafts, and the disclosure log",
      );
    });
  }, [say]);

  const toggleShortlist = useCallback(
    (m: Match) => {
      const was = !!shortlist[m.id];
      setShortlist((s) => ({ ...s, [m.id]: !was }));
      if (!was) {
        void apiPost("/api/shortlists/items", {
          criteriaProfileId: CRITERIA_PROFILE[buyerId] ?? buyerId,
          matchId: `bm-${m.id}`,
        });
      }
      say(was ? "Removed from shortlist" : `Saved to ${buyer.name}’s shortlist`);
    },
    [shortlist, buyerId, buyer.name, say],
  );

  const createTask = useCallback(
    (m: Match) => {
      void apiPost("/api/fub/tasks", {
        contactId: BUYER_CONTACT[buyerId] ?? buyerId,
        title: `Show ${m.addr}`,
      }).then((res) => {
        const msg = (res as { message?: string } | null)?.message;
        say(msg ?? `Task created in Follow Up Boss: “Show ${m.addr}” — due tomorrow, assigned to you`);
      });
    },
    [buyerId, say],
  );

  const openEmail = useCallback((b: Buyer, prop: Match) => {
    const d = draftEmail(b, prop);
    setEmail({ to: b.email, subject: d.subject, body: d.body, key: prop.id, contactId: BUYER_CONTACT[b.id] });
  }, []);

  const saveEmail = useCallback(() => {
    const e = email;
    setEmail(null);
    if (e) {
      void apiPost("/api/drafts", {
        kind: "email",
        contactId: e.contactId,
        subject: e.subject,
        body: e.body,
      });
    }
    say("Email draft saved to Follow Up Boss — review and send it from FUB");
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
      setDetail(null);
    }
    say("Saved to shortlist");
  }, [detail, say]);

  const value: AppContextValue = {
    screen,
    buyerId,
    contactId,
    theme,
    fubSync,
    shortlist,
    imports,
    importedAt,
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
    say,
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
    <div data-theme={theme} style={{ minHeight: "100vh", background: "var(--color-bg)", color: "var(--color-text)" }}>
      <AppContext.Provider value={value}>{children}</AppContext.Provider>
    </div>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppStateProvider");
  return ctx;
}
