import type { NextRequest } from "next/server";
import { and, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { loadContext } from "@/services/context";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Calendar feed for a date range: appointments + escrow milestones + touchpoints + dated tasks. */
export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from") ?? "0000";
    const to = req.nextUrl.searchParams.get("to") ?? "9999";
    const ctx = loadContext();
    const appts = db.select().from(s.appointments).where(and(gte(s.appointments.startsAt, from), lte(s.appointments.startsAt, to + "T23:59:59"))).all().map((a) => ({ id: a.id, source: "appointment" as const, type: a.type, title: a.title, startsAt: a.startsAt, endsAt: a.endsAt, location: a.location, contactName: ctx.names(a.contactId), address: ctx.addresses(a.propertyId), refId: a.id }));
    const tx = db.select().from(s.transactions).all();
    const ms = db.select().from(s.milestones).where(and(gte(s.milestones.dueDate, from), lte(s.milestones.dueDate, to))).all().map((m) => { const t = tx.find((x) => x.id === m.transactionId); return { id: `ms-${m.id}`, source: "milestone" as const, type: m.name.toLowerCase().includes("closing") ? "closing" : m.name.toLowerCase().includes("inspection") ? "inspection" : m.name.toLowerCase().includes("appraisal") ? "appraisal" : m.name.toLowerCase().includes("walkthrough") ? "final_walkthrough" : "deadline", title: `${m.name} — ${ctx.addresses(t?.propertyId) ?? ""}`, startsAt: m.dueDate!, endsAt: null, location: null, contactName: ctx.names(t?.contactId), address: ctx.addresses(t?.propertyId), refId: m.transactionId, done: !!m.completedAt }; });
    const tasks = db.select().from(s.tasks).where(and(gte(s.tasks.dueDate, from), lte(s.tasks.dueDate, to))).all().filter((t) => !t.completedAt).map((t) => ({ id: `task-${t.id}`, source: "task" as const, type: "client_follow_up", title: t.title, startsAt: t.dueDate! + (t.dueTime ? `T${t.dueTime}:00` : ""), endsAt: null, location: null, contactName: ctx.names(t.contactId), address: ctx.addresses(t.propertyId), refId: t.id }));
    return ok({ events: [...appts, ...ms, ...tasks].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) });
  } catch (err) { return errorResponse(err); }
}
