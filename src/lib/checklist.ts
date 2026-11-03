import type { Anchor, ChecklistTemplate, Condition, DueRule, TemplateItem } from "@/data/checklist-templates";

/**
 * Pure transaction-checklist logic (no DB imports): which template items apply
 * to a transaction, when they are due, and a summary for the dashboard card.
 * Day math is calendar-day arithmetic on YYYY-MM-DD strings; `businessDays`
 * skips Saturday and Sunday only — there is NO holiday calendar, so a deadline
 * that lands on a court holiday still needs a human check against the contract.
 */

export type Flags = Partial<Record<Condition, boolean>>;
export type AnchorDates = Partial<Record<Anchor, string | null | undefined>>;
export type ItemStatus = "pending" | "done" | "na" | "waived";

export const ITEM_STATUSES: ItemStatus[] = ["pending", "done", "na", "waived"];

/** The shape `buildItems` produces: a checklist_items row minus ids and timestamps. */
export interface BuiltItem {
  phaseKey: string;
  phaseOrder: number;
  code: string;
  title: string;
  kind: "task" | "document";
  owner: string;
  formCode: string | null;
  formRev: string | null;
  authority: string | null;
  status: ItemStatus;
  dueDate: string | null;
  dueOverride: string | null;
  sourceDocumentId: string | null;
  taskId: string | null;
  notes: string | null;
  sortOrder: number;
  completedAt: string | null;
}

/** Minimal item view used by `effectiveDue` and `summarize`. */
export interface DueLike { dueDate?: string | null; dueOverride?: string | null }
export interface SummaryItem extends DueLike { phaseKey: string; phaseOrder: number; status: string; kind?: string }

/** `always` is always on; any other condition requires its flag. */
export function applies(item: Pick<TemplateItem, "condition">, flags: Flags): boolean {
  return item.condition === "always" || flags[item.condition] === true;
}

const DAY = 86_400_000;
const parseYmd = (s: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return Number.isNaN(d.getTime()) ? null : d;
};
const toYmd = (d: Date): string => d.toISOString().slice(0, 10);

/** Add calendar days (negative allowed) to a YYYY-MM-DD string. */
export function addDays(ymd: string, days: number): string | null {
  const d = parseYmd(ymd);
  return d ? toYmd(new Date(d.getTime() + days * DAY)) : null;
}

/** Add business days (Mon–Fri), stepping over Saturday and Sunday. Negative counts step backwards. */
export function addBusinessDays(ymd: string, days: number): string | null {
  const d = parseYmd(ymd);
  if (!d) return null;
  const step = days < 0 ? -1 : 1;
  let remaining = Math.abs(days);
  let t = d.getTime();
  while (remaining > 0) {
    t += step * DAY;
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) remaining -= 1;
  }
  return toYmd(new Date(t));
}

/** YYYY-MM-DD due date for a rule, or null when the anchor date is missing. */
export function computeDueDate(rule: DueRule, dates: AnchorDates): string | null {
  const base = dates[rule.anchor];
  if (!base) return null;
  return rule.businessDays ? addBusinessDays(base, rule.days) : addDays(base, rule.days);
}

/**
 * Flatten a template into rows for one transaction: filter by flags, compute
 * dates, assign sort order. `sortOrder` is the item's position in the FULL
 * template (not the filtered list) so rows added later by a flag change slot
 * into the same order as the original rows.
 */
export function buildItems(template: ChecklistTemplate, flags: Flags, dates: AnchorDates): BuiltItem[] {
  const out: BuiltItem[] = [];
  let sort = 0;
  for (const phase of [...template.phases].sort((a, b) => a.order - b.order)) {
    for (const item of phase.items) {
      const sortOrder = sort++;
      if (!applies(item, flags)) continue;
      out.push({
        phaseKey: phase.key,
        phaseOrder: phase.order,
        code: item.code,
        title: item.title,
        kind: item.kind,
        owner: item.owner,
        formCode: item.formCode ?? null,
        formRev: item.formRev ?? null,
        authority: item.authority ?? null,
        status: "pending",
        dueDate: item.dueRule ? computeDueDate(item.dueRule, dates) : null,
        dueOverride: null,
        sourceDocumentId: null,
        taskId: null,
        notes: item.notes ?? null,
        sortOrder,
        completedAt: null,
      });
    }
  }
  return out;
}

/** The date the item is actually due: an override wins over the computed date. */
export const effectiveDue = (item: DueLike): string | null => item.dueOverride ?? item.dueDate ?? null;

/** Find a template item by phase + code (used when recomputing dates for existing rows). */
export function findTemplateItem(template: ChecklistTemplate, phaseKey: string, code: string): TemplateItem | null {
  return template.phases.find((p) => p.key === phaseKey)?.items.find((i) => i.code === code) ?? null;
}

export interface PhaseSummary { phaseKey: string; name: string; total: number; done: number; nextDue: string | null }
export interface ChecklistSummary { total: number; done: number; overdue: number; dueSoon: number; nextDue: string | null; byPhase: PhaseSummary[] }

const isOpen = (s: string) => s === "pending";

/** Counts for the dashboard card. `today` is YYYY-MM-DD; dueSoon = open items due within the next 7 days (today inclusive). */
export function summarize(items: SummaryItem[], today: string, phaseNames: Record<string, string> = {}): ChecklistSummary {
  const soonEnd = addDays(today, 7) ?? today;
  const tracked = items.filter((i) => i.status !== "na");
  let overdue = 0;
  let dueSoon = 0;
  let nextDue: string | null = null;
  const phases = new Map<string, PhaseSummary & { order: number }>();
  for (const i of tracked) {
    const due = effectiveDue(i);
    const ph = phases.get(i.phaseKey) ?? { phaseKey: i.phaseKey, name: phaseNames[i.phaseKey] ?? i.phaseKey, total: 0, done: 0, nextDue: null, order: i.phaseOrder };
    ph.total += 1;
    if (i.status === "done" || i.status === "waived") ph.done += 1;
    if (isOpen(i.status) && due) {
      if (due < today) overdue += 1;
      else if (due <= soonEnd) dueSoon += 1;
      if (!nextDue || due < nextDue) nextDue = due;
      if (!ph.nextDue || due < ph.nextDue) ph.nextDue = due;
    }
    phases.set(i.phaseKey, ph);
  }
  return {
    total: tracked.length,
    done: tracked.filter((i) => i.status === "done" || i.status === "waived").length,
    overdue,
    dueSoon,
    nextDue,
    byPhase: [...phases.values()].sort((a, b) => a.order - b.order).map(({ order: _o, ...p }) => p),
  };
}
