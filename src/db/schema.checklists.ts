import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import type { TemplatePhase } from "../data/checklist-templates";

/**
 * Transaction checklist schema: a seeded, editable copy of each checklist
 * template plus the per-transaction items instantiated from it. Same
 * conventions as the other schema files (text UUID ids, ISO timestamps, JSON
 * columns). The checklist tracks and reminds only — it never generates, fills
 * or signs a form, and FUB pushes go through the draft-task approval path.
 */

const randomUUID = () => globalThis.crypto.randomUUID();
const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => text("created_at").notNull().$defaultFn(() => new Date().toISOString());
const updatedAt = () => text("updated_at").notNull().$defaultFn(() => new Date().toISOString());
function json<T>(name: string) {
  return text(name, { mode: "json" }).$type<T>();
}

export const checklistTemplates = sqliteTable("checklist_templates", {
  id: id(),
  key: text("key").notNull().unique(),
  side: text("side").notNull(), // listing | buyer
  name: text("name").notNull(),
  version: text("version").notNull(),
  // Full TemplatePhase[] as JSON — editable copy of the seed constant.
  phases: json<TemplatePhase[]>("phases").notNull(),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const checklistItems = sqliteTable(
  "checklist_items",
  {
    id: id(),
    transactionId: text("transaction_id").notNull(), // -> transactions.id
    templateId: text("template_id").notNull(),
    phaseKey: text("phase_key").notNull(),
    phaseOrder: integer("phase_order").notNull(),
    code: text("code").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull(), // task | document
    owner: text("owner").notNull(),
    formCode: text("form_code"),
    formRev: text("form_rev"),
    authority: text("authority"),
    status: text("status").notNull().default("pending"), // pending | done | na | waived
    dueDate: text("due_date"), // YYYY-MM-DD, computed
    dueOverride: text("due_override"), // wins over dueDate when set
    sourceDocumentId: text("source_document_id"), // received document
    taskId: text("task_id"), // tasks.id when pushed to FUB
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull(),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ txIdx: index("ci_tx_idx").on(t.transactionId), dueIdx: index("ci_due_idx").on(t.dueDate) }),
);

export type ChecklistItemRow = typeof checklistItems.$inferSelect;
export type ChecklistTemplateRow = typeof checklistTemplates.$inferSelect;
