"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, toast, useApi, useToasts } from "@/lib/client";
import { Avatar, Badge } from "@/components/ui/primitives";
import { FormPanel } from "@/components/ui/form";
import { ENTITY_LABEL, FIELDS } from "./entities";
import { relative } from "@/lib/dates";

/**
 * App frame: persistent left nav, top bar (global search, + Add, notifications),
 * command palette (⌘K), keyboard shortcuts, toasts and the shared quick-add
 * slide-over. Pages render inside.
 */

export const NAV: { href: string; label: string; icon: ReactNode; key?: string }[] = [
  { href: "/", label: "Dashboard", icon: <I d="M3 3h7v7H3zM14 3h7v4h-7zM14 10h7v11h-7zM3 13h7v8H3z" />, key: "1" },
  { href: "/tasks", label: "Tasks", icon: <I d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />, key: "2" },
  { href: "/calls", label: "Calls", icon: <I d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.5 2.1L8 9.7a16 16 0 006 6l1.2-1.2a2 2 0 012.1-.5c.9.3 1.8.5 2.7.6a2 2 0 011.7 2z" />, key: "3" },
  { href: "/buyers", label: "Buyers", icon: <I d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8" />, key: "4" },
  { href: "/sellers", label: "Sellers", icon: <I d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1z" />, key: "5" },
  { href: "/listings", label: "Listings", icon: <I d="M4 4h16v16H4zM4 10h16M10 10v10" />, key: "6" },
  { href: "/pipeline", label: "Pipeline", icon: <I d="M4 6h4v12H4zM10 6h4v8h-4zM16 6h4v5h-4z" />, key: "7" },
  { href: "/transactions", label: "Transactions", icon: <I d="M3 6h18M3 12h18M3 18h12" />, key: "8" },
  { href: "/contacts", label: "Contacts", icon: <I d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z" />, key: "9" },
  { href: "/calendar", label: "Calendar", icon: <I d="M3 5h18v16H3zM3 10h18M8 3v4M16 3v4" /> },
  { href: "/income", label: "Sales & Income", icon: <I d="M12 2v20M17 6.5C17 4.6 14.8 3 12 3S7 4.6 7 6.5 9.2 10 12 10s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5" /> },
  { href: "/reports", label: "Reports", icon: <I d="M4 20V10M10 20V4M16 20v-7M22 20H2" /> },
  { href: "/notes", label: "Notes", icon: <I d="M5 3h10l4 4v14H5zM15 3v4h4M8 12h8M8 16h6" /> },
];
const MORE = [
  { href: "/offers", label: "Offers" }, { href: "/opportunities", label: "Opportunities" }, { href: "/sphere", label: "Stay in Touch" }, { href: "/followups", label: "Needs Follow-Up" },
];
function I({ d }: { d: string }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>; }

const QUICK = ["tasks", "calls", "buyers", "sellers", "contacts", "listings", "transactions", "notes"];

/** Global quick-add controller (open from anywhere). */
type QuickAddFn = (entity: string, initial?: Record<string, unknown>) => void;
let openQuick: QuickAddFn = () => {};
export const quickAdd: QuickAddFn = (e, i) => openQuick(e, i);

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [add, setAdd] = useState<{ entity: string; initial?: Record<string, unknown> } | null>(null);
  const [addMenu, setAddMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const toasts = useToasts();
  const settings = useApi<{ items: { agentName: string; title: string | null; brokerage: string | null }[] }>("/api/settings");
  const agent = settings.data?.items[0];
  const notifs = useApi<{ items: { id: string; title: string; body: string | null; kind: string; href: string | null; readAt: string | null; createdAt: string }[] }>("/api/notifications?limit=30", { refreshMs: 60000 });
  const unread = notifs.data?.items.filter((n) => !n.readAt).length ?? 0;

  useEffect(() => { openQuick = (entity, initial) => setAdd({ entity, initial }); return () => { openQuick = () => {}; }; }, []);

  // Keyboard shortcuts: ⌘K palette, "/" search, "n" new task, "c" new contact, g+digit navigation.
  useEffect(() => {
    let g = false;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName ?? "";
      const typing = /input|textarea|select/i.test(tag) || (e.target as HTMLElement)?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); return; }
      if (typing) return;
      if (e.key === "/") { e.preventDefault(); setPalette(true); return; }
      if (e.key === "Escape") { setAddMenu(false); setNotifOpen(false); return; }
      if (e.key === "g") { g = true; setTimeout(() => (g = false), 900); return; }
      if (g && /^[1-9]$/.test(e.key)) { const n = NAV.find((x) => x.key === e.key); if (n) router.push(n.href); g = false; return; }
      if (e.key === "n") { e.preventDefault(); setAdd({ entity: "tasks" }); }
      if (e.key === "c") { e.preventDefault(); setAdd({ entity: "contacts" }); }
      if (e.key === "a") { e.preventDefault(); setAddMenu(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  async function markAllRead() {
    for (const n of notifs.data?.items.filter((x) => !x.readAt) ?? []) await api.update("notifications", n.id, { readAt: new Date().toISOString() });
  }

  return (
    <div className="min-h-screen flex">
      <aside className={`${collapsed ? "w-[68px]" : "w-[228px]"} shrink-0 sticky top-0 h-screen border-r border-line bg-ground/80 flex flex-col px-3 py-4 transition-[width] duration-200`} aria-label="Primary">
        <div className="flex items-center gap-2 px-2 mb-5">
          <Link href="/" className="flex-1 min-w-0">
            <div className="text-[17px] font-bold tracking-[0.18em] leading-none truncate">{collapsed ? "V" : "VANESSA"}</div>
            {!collapsed && <div className="text-[9.5px] tracking-[0.28em] text-ink-3 mt-1">REAL ESTATE</div>}
          </Link>
          <button className="btn btn-ghost btn-icon" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}><I d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} /></button>
        </div>
        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
          {NAV.map((n) => { const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href); return <Link key={n.href} href={n.href} className={`nav-item ${active ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`} title={n.label} aria-current={active ? "page" : undefined}>{n.icon}{!collapsed && <span>{n.label}</span>}</Link>; })}
          {!collapsed && <div className="kicker px-3 mt-4 mb-1">More</div>}
          {MORE.map((n) => { const active = pathname.startsWith(n.href); return <Link key={n.href} href={n.href} className={`nav-item ${active ? "active" : ""} ${collapsed ? "justify-center px-0" : ""}`} title={n.label}>{collapsed ? <span className="text-[11px] font-semibold">{n.label[0]}</span> : <span className="pl-7">{n.label}</span>}</Link>; })}
        </nav>
        <div className={`mt-4 rounded-xl bg-ink text-white p-4 ${collapsed ? "px-2" : ""}`}>
          <div className={`flex ${collapsed ? "justify-center" : "flex-col items-center text-center"} gap-2`}>
            <Avatar name={agent?.agentName ?? "V"} size={collapsed ? 32 : 56} />
            {!collapsed && <><div className="text-[14px] font-semibold mt-1">{agent?.agentName ?? "—"}</div><div className="text-[11.5px] text-white/60">{agent?.title}</div><div className="text-[11px] tracking-[0.3em] mt-3 text-white/80 uppercase">{agent?.brokerage}</div></>}
          </div>
        </div>
        <button className={`btn btn-primary mt-3 w-full justify-center ${collapsed ? "px-0" : ""}`} onClick={() => setAddMenu(true)}>{collapsed ? "+" : "+ Quick Add"}</button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-ground/85 backdrop-blur border-b border-line px-6 h-16 flex items-center gap-4">
          <div className="flex-1 min-w-0 md:hidden" />
          <button className="hidden md:flex items-center gap-2 h-10 w-full max-w-[520px] rounded-lg border border-line bg-panel px-3 text-[13.5px] text-ink-3 hover:border-ink-3 transition-colors mx-auto" onClick={() => setPalette(true)} aria-label="Search">
            <I d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3" /><span className="flex-1 text-left">Search contacts, properties, notes, etc...</span><kbd className="text-[11px] border border-line rounded px-1.5 py-0.5 bg-ground">⌘K</kbd>
          </button>
          <div className="relative">
            <button className="btn btn-primary" onClick={() => setAddMenu((v) => !v)} aria-haspopup="menu" aria-expanded={addMenu}>+ Add <I d="M6 9l6 6 6-6" /></button>
            {addMenu && (
              <div className="absolute right-0 mt-2 w-48 card p-1.5 z-40 fade-in" role="menu" onMouseLeave={() => setAddMenu(false)}>
                {QUICK.map((e) => <button key={e} role="menuitem" className="w-full text-left px-3 h-9 rounded-md text-[13.5px] hover:bg-ground" onClick={() => { setAddMenu(false); setAdd({ entity: e }); }}>{ENTITY_LABEL[e]}</button>)}
              </div>
            )}
          </div>
          <div className="relative">
            <button className="btn btn-ghost btn-icon relative" onClick={() => setNotifOpen((v) => !v)} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
              <I d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0" />
              {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-crit text-white text-[10px] font-semibold grid place-items-center">{unread}</span>}
            </button>
            {notifOpen && (
              <div className="absolute right-0 mt-2 w-[380px] card z-40 fade-in overflow-hidden" onMouseLeave={() => setNotifOpen(false)}>
                <div className="card-head border-b border-line"><h2 className="card-title">Notifications</h2><button className="card-link" onClick={markAllRead}>Mark all read</button></div>
                <div className="max-h-[420px] overflow-y-auto">
                  {(notifs.data?.items ?? []).map((n) => (
                    <button key={n.id} className={`w-full text-left px-5 py-3 border-b border-line-2 hover:bg-ground ${n.readAt ? "opacity-60" : ""}`} onClick={async () => { if (!n.readAt) await api.update("notifications", n.id, { readAt: new Date().toISOString() }); setNotifOpen(false); if (n.href) router.push(n.href); }}>
                      <div className="flex items-center gap-2"><Badge tone={n.kind}>{n.kind}</Badge><span className="text-[13px] font-medium flex-1 truncate">{n.title}</span><span className="text-[11px] text-ink-3">{relative(n.createdAt)}</span></div>
                      {n.body && <div className="text-[12.5px] text-ink-2 mt-1">{n.body}</div>}
                    </button>
                  ))}
                  {notifs.data?.items.length === 0 && <div className="px-5 py-8 text-center text-ink-3 text-[13px]">All caught up.</div>}
                </div>
              </div>
            )}
          </div>
        </header>
        <main className="flex-1 px-6 py-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>

      <FormPanel open={!!add} onClose={() => setAdd(null)} entity={add?.entity ?? "tasks"} fields={FIELDS[add?.entity ?? "tasks"]} initial={add?.initial ?? null} title={`New ${ENTITY_LABEL[add?.entity ?? "tasks"] ?? "record"}`} onSaved={() => toast("Added")} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onAdd={(e) => setAdd({ entity: e })} />

      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[70] flex flex-col gap-2 items-center pointer-events-none">
        {toasts.map((t) => <div key={t.id} role="status" className={`fade-in rounded-lg px-4 py-2.5 text-[13px] shadow-pop ${t.kind === "err" ? "bg-crit text-white" : "bg-ink text-white"}`}>{t.msg}</div>)}
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (entity: string) => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ kind: string; id: string; title: string; subtitle: string | null; href: string }[]>([]);
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQ(""); setHits([]); setIdx(0); setTimeout(() => inputRef.current?.focus(), 30); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { if (!q.trim()) { setHits([]); return; } fetch(`/api/search?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((j) => { setHits(j.hits ?? []); setIdx(0); }).catch(() => {}); }, 120);
    return () => clearTimeout(t);
  }, [q, open]);
  const commands = [
    ...NAV.map((n) => ({ kind: "go", id: n.href, title: `Go to ${n.label}`, subtitle: n.key ? `g ${n.key}` : null, href: n.href })),
    ...MORE.map((n) => ({ kind: "go", id: n.href, title: `Go to ${n.label}`, subtitle: null, href: n.href })),
    ...QUICK.map((e) => ({ kind: "add", id: e, title: `New ${ENTITY_LABEL[e]}`, subtitle: e === "tasks" ? "n" : e === "contacts" ? "c" : null, href: `add:${e}` })),
  ].filter((c) => !q.trim() || c.title.toLowerCase().includes(q.toLowerCase()));
  const list = q.trim() ? [...hits, ...commands.slice(0, 4)] : commands;
  const go = useCallback((h: { href: string }) => { onClose(); if (h.href.startsWith("add:")) onAdd(h.href.slice(4)); else router.push(h.href); }, [onClose, onAdd, router]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-ink/25 backdrop-blur-[1px]" />
      <div role="dialog" aria-modal="true" aria-label="Search and commands" className="relative card w-[640px] max-w-[94vw] overflow-hidden fade-in" onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} className="w-full h-14 px-5 text-[15px] outline-none border-b border-line bg-transparent" placeholder="Search anything or type a command…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { onClose(); return; } if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); } if (e.key === "Enter" && list[idx]) go(list[idx]); }} />
        <div className="max-h-[420px] overflow-y-auto py-1.5">
          {list.map((h, i) => (
            <button key={h.kind + h.id} className={`w-full text-left px-5 py-2.5 flex items-center gap-3 ${i === idx ? "bg-ground" : ""}`} onMouseEnter={() => setIdx(i)} onClick={() => go(h)}>
              <Badge tone={h.kind === "go" ? "neutral" : h.kind === "add" ? "gold" : h.kind === "contact" ? "info" : h.kind === "listing" ? "active" : h.kind === "transaction" ? "escrow" : "neutral"}>{h.kind}</Badge>
              <span className="flex-1 min-w-0"><span className="block text-[13.5px] font-medium truncate">{h.title}</span>{h.subtitle && <span className="block text-[12px] text-ink-3 truncate">{h.subtitle}</span>}</span>
            </button>
          ))}
          {q.trim() && list.length === 0 && <div className="px-5 py-8 text-center text-ink-3 text-[13px]">No matches for “{q}”.</div>}
        </div>
        <div className="px-5 py-2 border-t border-line text-[11px] text-ink-3 flex gap-4"><span>↑↓ navigate</span><span>↵ open</span><span>esc close</span><span className="ml-auto">n new task · c new contact · g 1–9 pages</span></div>
      </div>
    </div>
  );
}
