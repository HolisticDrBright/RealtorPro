import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

/**
 * Dashboard schema: the daily game plan (todos / priority tasks / calls),
 * work-calendar events, and transactions (listings + buyer deals) used for
 * active-pipeline and year-to-date closing stats. Same conventions as the
 * other schema files; all seed data is fictional.
 */

const randomUUID = () => globalThis.crypto.randomUUID();
const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => text("created_at").notNull().$defaultFn(() => new Date().toISOString());

export const todos = sqliteTable(
  "todos",
  {
    id: id(),
    title: text("title").notNull(),
    // task | priority | call
    kind: text("kind").notNull().default("task"),
    done: integer("done", { mode: "boolean" }).notNull().default(false),
    dueDate: text("due_date"), // YYYY-MM-DD
    contactId: text("contact_id"),
    propertyId: text("property_id"),
    notes: text("notes"),
    // The daily list is "provided each day" — imported/entered text or FUB tasks.
    source: text("source").notNull().default("manual"), // manual | import | fub
    createdAt: createdAt(),
    completedAt: text("completed_at"),
  },
  (t) => ({ dueIdx: index("todos_due_idx").on(t.dueDate) }),
);

export const calendarEvents = sqliteTable(
  "calendar_events",
  {
    id: id(),
    title: text("title").notNull(),
    startsAt: text("starts_at").notNull(), // ISO
    endsAt: text("ends_at"),
    location: text("location"),
    // local | ics | gmail | outlook — gmail/outlook require an approved connector
    source: text("source").notNull().default("local"),
    externalId: text("external_id"),
    contactId: text("contact_id"),
    propertyId: text("property_id"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => ({ startIdx: index("cal_start_idx").on(t.startsAt) }),
);

export const transactions = sqliteTable(
  "transactions",
  {
    id: id(),
    // listing | buyer
    side: text("side").notNull(),
    contactId: text("contact_id"),
    propertyId: text("property_id"),
    address: text("address").notNull(),
    price: real("price"),
    // active | pending | closed | canceled
    status: text("status").notNull().default("active"),
    stage: text("stage"),
    closedAt: text("closed_at"), // YYYY-MM-DD
    commissionPct: real("commission_pct"),
    gci: real("gci"), // gross commission income for the agent, if known
    fubDealId: text("fub_deal_id"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => ({ statusIdx: index("tx_status_idx").on(t.status), closedIdx: index("tx_closed_idx").on(t.closedAt) }),
);
