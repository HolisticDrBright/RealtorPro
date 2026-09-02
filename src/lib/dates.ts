/** Date helpers that work on local-calendar strings (YYYY-MM-DD) and ISO timestamps. */

export const ymd = (d: Date = new Date()): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const addDays = (d: Date, n: number): Date => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const daysBetween = (a: string | Date, b: string | Date): number => {
  const da = typeof a === "string" ? new Date(a.length === 10 ? a + "T12:00:00" : a) : a;
  const dbb = typeof b === "string" ? new Date(b.length === 10 ? b + "T12:00:00" : b) : b;
  return Math.round((dbb.getTime() - da.getTime()) / 86400000);
};
/** Days from today to `date` (negative = past). */
export const daysUntil = (date: string, now: Date = new Date()): number => daysBetween(ymd(now), date.slice(0, 10));
export const daysSince = (date: string | null | undefined, now: Date = new Date()): number | null => (date ? -daysUntil(date, now) : null);

export const isToday = (iso: string, now: Date = new Date()) => iso.slice(0, 10) === ymd(now);
export const isTomorrow = (iso: string, now: Date = new Date()) => iso.slice(0, 10) === ymd(addDays(now, 1));

export const fmtDate = (s: string | null | undefined, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string => {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? s + "T12:00:00" : s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString("en-US", opts);
};
export const fmtTime = (s: string | null | undefined): string => {
  if (!s) return "";
  if (/^\d{2}:\d{2}$/.test(s)) { const [h, m] = s.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};
export const fmtDateTime = (s: string | null | undefined) => (s ? `${fmtDate(s)} · ${fmtTime(s)}` : "—");

export const relative = (iso: string | null | undefined, now: Date = new Date()): string => {
  if (!iso) return "never";
  const ms = now.getTime() - new Date(iso.length === 10 ? iso + "T12:00:00" : iso).getTime();
  const m = Math.round(ms / 60000);
  if (m < 0) { const f = -m; return f < 60 ? `in ${f}m` : f < 1440 ? `in ${Math.round(f / 60)}h` : `in ${Math.round(f / 1440)}d`; }
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
};

/** Next occurrence of a MM-DD anniversary from `now`, as YYYY-MM-DD. */
export function nextAnniversary(dateYmd: string, now: Date = new Date()): string {
  const [, m, d] = dateYmd.split("-").map(Number);
  let cand = new Date(now.getFullYear(), m - 1, d);
  if (cand < new Date(now.getFullYear(), now.getMonth(), now.getDate())) cand = new Date(now.getFullYear() + 1, m - 1, d);
  return ymd(cand);
}

export const greeting = (now: Date = new Date()) => (now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening");

/** Next due date for a recurring task. */
export function nextRecurrence(dueDate: string, recurrence: string): string | null {
  const d = new Date(dueDate + "T12:00:00");
  if (recurrence === "daily") d.setDate(d.getDate() + 1);
  else if (recurrence === "weekly") d.setDate(d.getDate() + 7);
  else if (recurrence === "monthly") d.setMonth(d.getMonth() + 1);
  else return null;
  return ymd(d);
}
