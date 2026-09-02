import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, contacts, deals, notes, tasks } from "@/db/schema";
import { notesForContact } from "@/services/obsidian";
import { errorResponse, ok, AppError } from "@/lib/errors";
export const runtime = "nodejs";
/** Unified timeline for a contact: FUB notes/tasks/appointments/deals + linked Obsidian notes. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const contact = db.select().from(contacts).where(eq(contacts.id, id)).get();
    if (!contact) throw new AppError("not_found", "Contact not found.");
    const entries = [
      ...db.select().from(notes).where(eq(notes.contactId, id)).all().map((n) => ({ t: n.createdAt, type: "note" as const, title: n.subject ?? (n.isDraft ? "Draft note" : "Note"), body: n.body, source: n.origin === "fub" ? "Follow Up Boss" : "AgentOS" })),
      ...db.select().from(tasks).where(eq(tasks.contactId, id)).all().map((x) => ({ t: x.dueAt ?? x.createdAt, type: "task" as const, title: x.title, body: [x.body, x.status === "done" ? "Completed" : "Open"].filter(Boolean).join(" · "), source: x.origin === "fub" ? "Follow Up Boss" : "AgentOS" })),
      ...db.select().from(appointments).where(eq(appointments.contactId, id)).all().map((a) => ({ t: a.startsAt ?? a.createdAt, type: "showing" as const, title: a.title, body: [a.location, a.description].filter(Boolean).join(" · "), source: a.fubId ? "Follow Up Boss" : "AgentOS" })),
      ...db.select().from(deals).where(eq(deals.contactId, id)).all().map((d) => ({ t: d.updatedAt, type: d.riskFlag ? ("alert" as const) : ("stage" as const), title: d.riskFlag ? `Deal risk — ${d.name}` : d.name, body: d.riskIssue ?? [d.pipeline, d.stage, d.price ? `$${Number(d.price).toLocaleString()}` : null].filter(Boolean).join(" · "), source: d.fubId ? "Follow Up Boss" : "AgentOS" })),
      ...notesForContact(id).map((v) => ({ t: v.modifiedAt ?? v.indexedAt, type: "vault" as const, title: v.title, body: v.excerpt ?? "", source: `Obsidian · ${v.path}${v.linkBasis ? ` (linked by ${v.linkBasis})` : ""}` })),
    ].sort((a, b) => (b.t ?? "").localeCompare(a.t ?? ""));
    return ok({ contact, timeline: entries });
  } catch (err) { return errorResponse(err); }
}
