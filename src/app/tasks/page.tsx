"use client";

import { useEffect, useMemo, useState } from "react";
import { api, label, toast, useApi, useLookups, useQueryParam } from "@/lib/client";
import { daysUntil, fmtDate, fmtTime, ymd } from "@/lib/dates";
import { Badge, Card, Empty, Loading, PageHeader, Segmented } from "@/components/ui/primitives";
import { RowMenu, useCrud } from "@/components/app/crud";

interface Task { id: string; title: string; category: string; priority: string; dueDate: string | null; dueTime: string | null; contactId: string | null; propertyId: string | null; transactionId: string | null; recurrence: string; notes: string | null; sortOrder: number; completedAt: string | null }
type View = "today" | "upcoming" | "overdue" | "completed" | "all";
const CATS = ["client_follow_up", "prospecting", "listing", "buyer", "escrow", "marketing", "administrative", "personal"];

export default function TasksPage() {
  const qv = useQueryParam("view");
  const [view, setView] = useState<View>("today");
  useEffect(() => { if (qv) setView(qv as View); }, [qv]);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [drag, setDrag] = useState<string | null>(null);
  const { data, loading } = useApi<{ items: Task[] }>("/api/tasks?limit=1000");
  const lk = useLookups();
  const crud = useCrud("tasks");
  const today = ymd();
  const all = useMemo(() => data?.items ?? [], [data]);
  const counts = {
    today: all.filter((t) => !t.completedAt && t.dueDate && t.dueDate <= today).length,
    upcoming: all.filter((t) => !t.completedAt && (!t.dueDate || t.dueDate > today)).length,
    overdue: all.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today).length,
    completed: all.filter((t) => t.completedAt).length,
    all: all.length,
  };
  const rows = useMemo(() => {
    let list = all;
    if (view === "today") list = list.filter((t) => !t.completedAt && t.dueDate && t.dueDate <= today);
    if (view === "upcoming") list = list.filter((t) => !t.completedAt && (!t.dueDate || t.dueDate > today));
    if (view === "overdue") list = list.filter((t) => !t.completedAt && t.dueDate && t.dueDate < today);
    if (view === "completed") list = list.filter((t) => t.completedAt);
    if (cat) list = list.filter((t) => t.category === cat);
    if (q.trim()) list = list.filter((t) => `${t.title} ${t.notes ?? ""} ${lk.nameOf(t.contactId) ?? ""}`.toLowerCase().includes(q.toLowerCase()));
    const P: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return [...list].sort((a, b) => (view === "completed" ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "") : (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.sortOrder - b.sortOrder || P[a.priority] - P[b.priority] || (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99")));
  }, [all, view, cat, q, today, lk]);

  async function toggle(t: Task) { const r = await api.update("tasks", t.id, { completedAt: t.completedAt ? null : new Date().toISOString() }); if (r.ok) toast(t.completedAt ? "Reopened" : t.recurrence !== "none" ? "Done — next occurrence scheduled" : "Completed"); }
  async function drop(target: Task) {
    if (!drag || drag === target.id) return;
    const ids = rows.map((t) => t.id); const from = ids.indexOf(drag), to = ids.indexOf(target.id); ids.splice(from, 1); ids.splice(to, 0, drag);
    setDrag(null);
    await Promise.all(ids.map((id, i) => api.update("tasks", id, { sortOrder: i, ...(rows.find((r) => r.id === id)?.dueDate !== target.dueDate ? { dueDate: target.dueDate } : {}) })));
  }

  return (
    <div className="fade-in">
      <PageHeader title="Tasks" sub={`${counts.today} due today · ${counts.overdue} overdue`}>
        <input className="input w-56" placeholder="Filter tasks…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter tasks" />
        <select className="input w-44" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category"><option value="">All categories</option>{CATS.map((c) => <option key={c} value={c}>{label(c)}</option>)}</select>
        <button className="btn btn-primary" onClick={() => crud.openNew({ dueDate: today })}>+ Task</button>
      </PageHeader>
      <div className="mb-4"><Segmented value={view} onChange={setView} options={[{ value: "today", label: "Today", count: counts.today }, { value: "upcoming", label: "Upcoming", count: counts.upcoming }, { value: "overdue", label: "Overdue", count: counts.overdue }, { value: "completed", label: "Completed", count: counts.completed }, { value: "all", label: "All Tasks", count: counts.all }]} /></div>
      <Card>
        {loading && <Loading />}
        {!loading && rows.length === 0 && <Empty title={view === "overdue" ? "Nothing overdue" : "No tasks here"} body="Drag tasks to reorder; drop onto another day’s task to move it there." action={<button className="btn btn-sm" onClick={() => crud.openNew({ dueDate: today })}>+ Task</button>} />}
        <ul className="divide-y divide-line-2">
          {rows.map((t) => {
            const overdue = !t.completedAt && t.dueDate && daysUntil(t.dueDate) < 0;
            return (
              <li key={t.id} draggable onDragStart={() => setDrag(t.id)} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(t)} className={`flex items-center gap-3 py-2.5 ${drag === t.id ? "dragging" : ""}`}>
                <button className={`check ${t.completedAt ? "on" : ""}`} onClick={() => toggle(t)} aria-pressed={!!t.completedAt} aria-label={`Complete ${t.title}`}>{t.completedAt ? "✓" : ""}</button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => crud.openEdit(t as unknown as Record<string, unknown>)}>
                  <div className={`text-[13.5px] font-medium truncate ${t.completedAt ? "line-through text-ink-3" : ""}`}>{t.title}</div>
                  <div className="text-[12px] text-ink-3 truncate">{[lk.nameOf(t.contactId), lk.addressOf(t.propertyId), label(t.category), t.recurrence !== "none" ? `repeats ${t.recurrence}` : null, t.notes].filter(Boolean).join(" · ")}</div>
                </div>
                <Badge tone={t.priority}>{t.priority}</Badge>
                <span className={`text-[12.5px] w-28 text-right tnum ${overdue ? "text-crit font-medium" : "text-ink-2"}`}>{t.dueDate ? fmtDate(t.dueDate) : "No date"}{t.dueTime ? ` · ${fmtTime(t.dueTime)}` : ""}</span>
                <RowMenu onEdit={() => crud.openEdit(t as unknown as Record<string, unknown>)} onDelete={() => crud.remove(t.id, t.title)} />
                <span className="text-ink-3 cursor-grab select-none" aria-hidden="true">⋮⋮</span>
              </li>
            );
          })}
        </ul>
      </Card>
      {crud.panel}
    </div>
  );
}
