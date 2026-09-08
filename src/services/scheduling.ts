import "server-only";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { schemas } from "@/lib/registry";
import { AppError } from "@/lib/errors";

export const ScheduleItems = z.array(z.object({ entity: z.enum(["tasks", "calls", "appointments"]), fields: z.record(z.unknown()) }).strict()).min(1).max(3);
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => {
  const d = new Date(v + "T12:00:00Z"); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === v;
}, "Use a real calendar date");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour time (HH:mm)");
const localDateTime = z.string().refine((v) => {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) || !day.safeParse(v.slice(0, 10)).success || !time.safeParse(v.slice(11)).success) return false;
  const d = new Date(v);
  return d.getFullYear() === Number(v.slice(0, 4)) && d.getMonth() + 1 === Number(v.slice(5, 7)) && d.getDate() === Number(v.slice(8, 10)) && d.getHours() === Number(v.slice(11, 13)) && d.getMinutes() === Number(v.slice(14));
}, "Use a valid local date/time YYYY-MM-DDTHH:mm (not a DST-skipped time)");
const allowed = {
  tasks: ["title", "priority", "category", "dueDate", "dueTime", "contactId", "propertyId", "notes"],
  calls: ["contactId", "scheduledDate", "scheduledTime", "priority", "reason", "notes"],
  appointments: ["title", "type", "startsAt", "endsAt", "location", "contactId", "propertyId", "notes"],
};

/** Checked during drafting AND approval, so late calendar conflicts cannot slip through. */
export function validateSchedule(input: unknown) {
  const items = ScheduleItems.parse(input);
  const appointments = db.select().from(s.appointments).all();
  return items.map(({ entity, fields }) => {
    if (Object.keys(fields).some((k) => !allowed[entity].includes(k))) throw new AppError("validation_error", "Jarvis can only draft new tasks, call reminders and local appointments—not complete, delete or edit existing records.");
    const clean = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== null && v !== undefined && v !== ""));
    const parsed = schemas[entity].parse(clean) as Record<string, unknown>;
    for (const [key, table] of [["contactId", s.contacts], ["propertyId", s.properties]] as const) {
      if (parsed[key] && !db.select({ id: table.id }).from(table).where(eq(table.id, String(parsed[key]))).get()) throw new AppError("validation_error", `The selected ${key === "contactId" ? "contact" : "property"} no longer exists. Look it up again.`);
    }
    if (entity === "tasks") { if (parsed.dueDate) day.parse(parsed.dueDate); if (parsed.dueTime) { time.parse(parsed.dueTime); day.parse(parsed.dueDate); } }
    if (entity === "calls") { day.parse(parsed.scheduledDate); time.parse(parsed.scheduledTime); }
    if (entity === "appointments") {
      const start = localDateTime.parse(parsed.startsAt), end = localDateTime.parse(parsed.endsAt);
      if (end <= start) throw new AppError("validation_error", "The appointment must end after it starts.");
      const startMs = new Date(start).getTime(), endMs = new Date(end).getTime();
      if (appointments.some((a) => new Date(a.startsAt).getTime() < endMs && (a.endsAt ? new Date(a.endsAt).getTime() : new Date(a.startsAt).getTime() + 30 * 60000) > startMs)) throw new AppError("conflict", "This time overlaps an existing or proposed local appointment. Choose another time.");
      appointments.push({ startsAt: start, endsAt: end } as typeof s.appointments.$inferSelect);
    }
    return { entity, fields: parsed };
  });
}
