import type { ChecklistTemplate } from "@/data/checklist-templates";
import { applies, buildItems, computeDueDate, findTemplateItem, type AnchorDates, type BuiltItem, type Flags } from "./checklist";

/**
 * Pure planners behind the checklist service's "recompute due dates" and
 * "update flags" operations. They decide WHAT changes; the service applies it.
 * Both honour the two invariants: a `dueOverride` is never touched, and a
 * `done` item is never changed.
 */

export interface ExistingItem {
  id: string;
  phaseKey: string;
  code: string;
  status: string;
  dueDate?: string | null;
  dueOverride?: string | null;
}

/** New computed due dates after anchor dates change. Done items are skipped; overrides are left alone. */
export function planRecompute(template: ChecklistTemplate, rows: ExistingItem[], dates: AnchorDates): { id: string; dueDate: string | null }[] {
  const out: { id: string; dueDate: string | null }[] = [];
  for (const r of rows) {
    if (r.status === "done") continue;
    const t = findTemplateItem(template, r.phaseKey, r.code);
    if (!t?.dueRule) continue;
    const next = computeDueDate(t.dueRule, dates);
    if ((r.dueDate ?? null) !== next) out.push({ id: r.id, dueDate: next });
  }
  return out;
}

export interface FlagChangePlan {
  /** Items that now apply and have no row yet. */
  add: BuiltItem[];
  /** Pending rows whose condition was switched off → mark `na`. */
  markNa: string[];
  /** `na` rows whose condition was switched back on → back to `pending`. */
  revive: string[];
}

export function planFlagChange(template: ChecklistTemplate, rows: ExistingItem[], flags: Flags, dates: AnchorDates): FlagChangePlan {
  const key = (phaseKey: string, code: string) => `${phaseKey}::${code}`;
  const existing = new Map(rows.map((r) => [key(r.phaseKey, r.code), r]));
  const add = buildItems(template, flags, dates).filter((b) => !existing.has(key(b.phaseKey, b.code)));
  const markNa: string[] = [];
  const revive: string[] = [];
  for (const r of rows) {
    const t = findTemplateItem(template, r.phaseKey, r.code);
    if (!t) continue; // row from an older template version — leave it
    const on = applies(t, flags);
    if (!on && r.status === "pending") markNa.push(r.id);
    if (on && r.status === "na") revive.push(r.id);
  }
  return { add, markNa, revive };
}
