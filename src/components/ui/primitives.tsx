"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { fmtMoney } from "@/lib/calc";

/* ── Badges ────────────────────────────────────────────────────────────── */
const TONES: Record<string, string> = {
  critical: "bg-crit-soft text-crit", high: "bg-warn-soft text-warn", medium: "bg-gold-soft text-gold-ink", low: "bg-zinc-100 text-ink-2",
  hot: "bg-crit-soft text-crit", warm: "bg-warn-soft text-warn", nurture: "bg-zinc-100 text-ink-2",
  active: "bg-ok-soft text-ok", coming_soon: "bg-info-soft text-info", off_market: "bg-zinc-100 text-ink-2", price_improvement: "bg-warn-soft text-warn", offer_received: "bg-gold-soft text-gold-ink", in_negotiation: "bg-gold-soft text-gold-ink", in_escrow: "bg-info-soft text-info", closed: "bg-ok-soft text-ok", withdrawn: "bg-zinc-100 text-ink-3",
  escrow: "bg-info-soft text-info", cancelled: "bg-zinc-100 text-ink-3", preparing: "bg-zinc-100 text-ink-2", submitted: "bg-info-soft text-info", countered: "bg-warn-soft text-warn", accepted: "bg-ok-soft text-ok", rejected: "bg-crit-soft text-crit", backup: "bg-gold-soft text-gold-ink",
  scheduled: "bg-zinc-100 text-ink-2", completed: "bg-ok-soft text-ok", rescheduled: "bg-warn-soft text-warn", buyer: "bg-info-soft text-info", seller: "bg-gold-soft text-gold-ink", both: "bg-ok-soft text-ok", past_client: "bg-ok-soft text-ok", lead: "bg-zinc-100 text-ink-2", agent: "bg-zinc-100 text-ink-2", vendor: "bg-zinc-100 text-ink-2", sphere: "bg-zinc-100 text-ink-2",
  new: "bg-info-soft text-info", watching: "bg-zinc-100 text-ink-2", pursuing: "bg-gold-soft text-gold-ink", matched: "bg-ok-soft text-ok", dead: "bg-zinc-100 text-ink-3",
  ok: "bg-ok-soft text-ok", warn: "bg-warn-soft text-warn", info: "bg-info-soft text-info", success: "bg-ok-soft text-ok", gold: "bg-gold-soft text-gold-ink", neutral: "bg-zinc-100 text-ink-2",
};
export function Badge({ tone, children, className = "" }: { tone?: string; children: ReactNode; className?: string }) {
  const t = tone && TONES[tone] ? TONES[tone] : TONES.neutral;
  return <span className={`pill ${t} ${className}`}>{children}</span>;
}
export const statusLabel = (s: string | null | undefined) => (s ? s.replace(/_/g, " ") : "—");

/* ── Avatar ────────────────────────────────────────────────────────────── */
const HUES = ["#d9c9a5", "#c9d4d9", "#d9cbc9", "#cdd9c9", "#d6c9d9", "#d9d6c9"];
export function Avatar({ name, src, size = 32 }: { name: string | null | undefined; src?: string | null; size?: number }) {
  const n = name ?? "?";
  const initials = n.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  const hue = HUES[(n.charCodeAt(0) + n.length) % HUES.length];
  if (src) return <img src={src} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  return <span className="rounded-full grid place-items-center shrink-0 font-semibold text-ink" style={{ width: size, height: size, background: hue, fontSize: Math.max(10, size * 0.36) }} aria-hidden="true">{initials}</span>;
}

/* ── Property photo placeholder ────────────────────────────────────────── */
export function PropertyPhoto({ src, address, className = "", size = "md" }: { src?: string | null; address: string; className?: string; size?: "sm" | "md" | "lg" }) {
  const h = size === "sm" ? "h-14 w-20" : size === "lg" ? "h-40 w-full" : "h-16 w-24";
  if (src) return <img src={src} alt={address} className={`${h} rounded-lg object-cover shrink-0 ${className}`} />;
  const seed = address.length % 5;
  const grads = ["linear-gradient(135deg,#e8e4da,#cfc7b5)", "linear-gradient(135deg,#dfe5e8,#b9c6cd)", "linear-gradient(135deg,#e9e2dc,#cdbdb1)", "linear-gradient(135deg,#e2e8df,#bfcbb8)", "linear-gradient(135deg,#e6e2ea,#c6bccd)"];
  return (
    <div className={`${h} rounded-lg shrink-0 grid place-items-center ${className}`} style={{ background: grads[seed] }} aria-hidden="true">
      <svg width={size === "lg" ? 34 : 22} height={size === "lg" ? 34 : 22} viewBox="0 0 24 24" fill="none" stroke="rgba(24,24,27,.45)" strokeWidth="1.6"><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" /></svg>
    </div>
  );
}

/* ── Cards / KPIs ──────────────────────────────────────────────────────── */
export function Card({ title, action, children, className = "", bodyClass = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`card flex flex-col min-w-0 ${className}`}>
      {(title || action) && <div className="card-head">{typeof title === "string" ? <h2 className="card-title">{title}</h2> : title}{action}</div>}
      <div className={`px-5 pb-4 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, sub, delta, spark, tone }: { label: string; value: string; sub?: ReactNode; delta?: { pct: number; label: string } | null; spark?: number[]; tone?: string }) {
  return (
    <div className="card px-5 py-4 min-w-0">
      <div className="kicker">{label}</div>
      <div className="mt-1.5 text-[22px] font-semibold tracking-tight tnum leading-none whitespace-nowrap">{value}</div>
      <div className="mt-2 flex items-end gap-3 min-h-[28px]">
        <div className="text-[12px] text-ink-3 flex-1 min-w-0">
          {delta && <span className={`inline-flex items-center gap-1 font-medium whitespace-nowrap ${delta.pct >= 0 ? "text-ok" : "text-crit"}`}><Arrow up={delta.pct >= 0} />{Math.abs(delta.pct)}% {delta.label}</span>}
          {delta === null && <span>No prior-year data</span>}
          {sub && <div className={tone ? `text-${tone}` : ""}>{sub}</div>}
        </div>
        {spark && spark.length > 1 && <span className="hidden 2xl:block"><Sparkline data={spark} /></span>}
      </div>
    </div>
  );
}
function Arrow({ up }: { up: boolean }) { return <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d={up ? "M1 7l4-4 4 4" : "M1 3l4 4 4-4"} fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>; }

export function Sparkline({ data, w = 84, h = 26 }: { data: number[]; w?: number; h?: number }) {
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * (h - 3) - 1}`).join(" ");
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0 text-ink" aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /><polyline points={pts} fill="none" stroke="#b8962e" strokeWidth="1.5" strokeDasharray="3 60" /></svg>;
}

export function Progress({ pct, className = "" }: { pct: number; className?: string }) {
  return <div className={`h-2 rounded-full bg-zinc-100 overflow-hidden ${className}`}><div className="h-full rounded-full bg-gold transition-[width] duration-500" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>;
}

export function Donut({ pct, size = 128, label }: { pct: number; size?: number; label?: ReactNode }) {
  const r = (size - 14) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct));
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#efefec" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#b8962e" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(p / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center"><div><div className="text-[22px] font-semibold tnum leading-none">{p}%</div>{label && <div className="text-[11px] text-ink-3 mt-1">{label}</div>}</div></div>
    </div>
  );
}

/** Grouped bar chart (up to two series), pure SVG, tabular labels. */
export function Bars({ data, series, height = 180, money = true }: { data: Record<string, number | string>[]; series: { key: string; label: string; color: string }[]; height?: number; money?: boolean }) {
  const w = 640;
  const padL = 44, padB = 22, padT = 8;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const nice = niceMax(max);
  const gw = (w - padL) / data.length;
  const bw = Math.min(14, (gw - 10) / series.length);
  const y = (v: number) => padT + (height - padB - padT) * (1 - v / nice);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * nice);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full h-auto" role="img" aria-label="Chart">
        {ticks.map((t) => <g key={t}><line x1={padL} x2={w} y1={y(t)} y2={y(t)} stroke="#efefec" /><text x={padL - 6} y={y(t) + 3} textAnchor="end" fontSize="9.5" fill="#8a8a93" className="tnum">{money ? fmtMoney(t, true) : t}</text></g>)}
        {data.map((d, i) => (
          <g key={i}>
            {series.map((s, j) => { const v = Number(d[s.key]) || 0; const x = padL + i * gw + (gw - series.length * bw - (series.length - 1) * 3) / 2 + j * (bw + 3); return <rect key={s.key} x={x} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))} rx="2" fill={s.color}><title>{`${d.month ?? i}: ${s.label} ${money ? fmtMoney(v) : v}`}</title></rect>; })}
            <text x={padL + i * gw + gw / 2} y={height - 6} textAnchor="middle" fontSize="10" fill="#8a8a93">{String(d.month ?? d.label ?? i)}</text>
          </g>
        ))}
      </svg>
      <div className="flex gap-4 mt-1 text-[11.5px] text-ink-3">{series.map((s) => <span key={s.key} className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />{s.label}</span>)}</div>
    </div>
  );
}
function niceMax(v: number) { const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10; return m * p; }

/* ── Empty / loading / error ───────────────────────────────────────────── */
export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return <div className="empty"><div className="text-[14px] font-medium">{title}</div>{body && <div className="text-[12.5px] text-ink-3 mt-1 max-w-md mx-auto">{body}</div>}{action && <div className="mt-3">{action}</div>}</div>;
}
export function Loading({ rows = 3 }: { rows?: number }) {
  return <div className="space-y-2 py-2" role="status" aria-label="Loading">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-4 rounded bg-zinc-100 animate-pulse" style={{ width: `${70 + ((i * 13) % 30)}%` }} />)}</div>;
}
export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <div role="alert" className="rounded-lg bg-crit-soft text-crit px-4 py-3 text-[13px] flex items-center gap-3">{message}{onRetry && <button className="btn btn-sm ml-auto" onClick={onRetry}>Retry</button>}</div>;
}

/* ── Modal / slide-over / confirm ──────────────────────────────────────── */
export function SlideOver({ open, title, onClose, children, wide, footer }: { open: boolean; title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode }) {
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/20 backdrop-blur-[1px]" onClick={onClose} aria-hidden="true" />
      <aside role="dialog" aria-modal="true" className={`relative h-full bg-panel border-l border-line shadow-pop flex flex-col slide-in ${wide ? "w-[720px]" : "w-[480px]"} max-w-full`}>
        <header className="flex items-center gap-3 px-6 h-14 border-b border-line shrink-0"><h2 className="text-[15px] font-semibold flex-1 truncate">{title}</h2><button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">✕</button></header>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <footer className="px-6 py-3 border-t border-line flex items-center gap-2 justify-end shrink-0">{footer}</footer>}
      </aside>
    </div>
  );
}
export function Confirm({ open, title, body, confirmLabel = "Delete", onConfirm, onCancel }: { open: boolean; title: string; body?: string; confirmLabel?: string; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center">
      <div className="absolute inset-0 bg-ink/25" onClick={onCancel} aria-hidden="true" />
      <div role="alertdialog" aria-modal="true" className="relative card w-[400px] max-w-[92vw] p-5 fade-in">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        {body && <p className="text-[13px] text-ink-2 mt-1.5">{body}</p>}
        <div className="flex justify-end gap-2 mt-5"><button className="btn" onClick={onCancel}>Cancel</button><button className="btn btn-primary !bg-crit !border-crit" onClick={onConfirm}>{confirmLabel}</button></div>
      </div>
    </div>
  );
}

/* ── Table with sorting + text filter ──────────────────────────────────── */
export interface Column<T> { key: string; label: string; render?: (row: T) => ReactNode; sort?: (row: T) => string | number | null | undefined; width?: string; align?: "left" | "right"; className?: string }
export function Table<T extends { id: string }>({ rows, columns, onRow, empty, filter, defaultSort, rowClass }: { rows: T[]; columns: Column<T>[]; onRow?: (row: T) => void; empty?: ReactNode; filter?: string; defaultSort?: { key: string; dir: "asc" | "desc" }; rowClass?: (row: T) => string }) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(defaultSort ?? null);
  const sorted = useMemo(() => {
    let list = rows;
    if (filter?.trim()) { const q = filter.toLowerCase(); list = list.filter((r) => JSON.stringify(r).toLowerCase().includes(q)); }
    if (!sort) return list;
    const col = columns.find((c) => c.key === sort.key);
    const get = col?.sort ?? ((r: T) => (r as Record<string, unknown>)[sort.key] as string | number | null | undefined);
    return [...list].sort((a, b) => { const va = get(a) ?? "", vb = get(b) ?? ""; const c = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), undefined, { numeric: true }); return sort.dir === "asc" ? c : -c; });
  }, [rows, columns, sort, filter]);
  return (
    <div className="overflow-x-auto -mx-5">
      <table className="w-full min-w-[640px] border-collapse">
        <thead><tr>{columns.map((c) => <th key={c.key} className={`th ${c.align === "right" ? "text-right" : ""} ${c.sort !== undefined || true ? "cursor-pointer hover:text-ink" : ""}`} style={{ width: c.width }} onClick={() => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === "asc" ? "desc" : "asc" } : { key: c.key, dir: "asc" }))} aria-sort={sort?.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>{c.label}{sort?.key === c.key && <span className="ml-1 text-ink-3">{sort.dir === "asc" ? "↑" : "↓"}</span>}</th>)}</tr></thead>
        <tbody>
          {sorted.map((r) => <tr key={r.id} className={`${onRow ? "cursor-pointer row-hover" : ""} ${rowClass?.(r) ?? ""}`} onClick={() => onRow?.(r)}>{columns.map((c) => <td key={c.key} className={`td ${c.align === "right" ? "text-right tnum" : ""} ${c.className ?? ""}`}>{c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? "—")}</td>)}</tr>)}
          {sorted.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-8 text-center text-ink-3 text-[13px]">{empty ?? "Nothing here yet."}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ── Segmented control ─────────────────────────────────────────────────── */
export function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[] }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg border border-line bg-panel p-0.5" role="tablist">
      {options.map((o) => <button key={o.value} role="tab" aria-selected={value === o.value} className={`h-7 px-2.5 rounded-md text-[12.5px] font-medium transition-colors ${value === o.value ? "bg-ink text-white" : "text-ink-2 hover:bg-ground"}`} onClick={() => onChange(o.value)}>{o.label}{o.count != null && <span className={`ml-1.5 tnum ${value === o.value ? "text-white/70" : "text-ink-3"}`}>{o.count}</span>}</button>)}
    </div>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return <div className="flex items-end gap-4 flex-wrap mb-5"><div className="min-w-0"><h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>{sub && <div className="text-[13px] text-ink-3 mt-0.5">{sub}</div>}</div><div className="ml-auto flex items-center gap-2 flex-wrap">{children}</div></div>;
}
