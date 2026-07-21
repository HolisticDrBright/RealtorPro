import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { signalActions, signals } from "@/db/schema.modules";
import { contacts } from "@/db/schema";
import { readJson } from "@/lib/api";
import { signalActionSchema } from "@/lib/validation.modules";
import { getFub } from "@/services/fub/adapter";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Agent decision on a signal. Every action is explicit and audited. Outreach is
 * DRAFT only — AgentOS never auto-sends email/SMS/calls or creates leads.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, signalActionSchema);
    const signal = db.select().from(signals).where(eq(signals.id, id)).get();
    if (!signal) throw new AppError("not_found", "Signal not found.");

    let message = "";
    const detail: Record<string, unknown> = { reason: input.reason };

    switch (input.action) {
      case "pursue":
        db.update(signals).set({ status: "pursued", updatedAt: new Date().toISOString() }).where(eq(signals.id, id)).run();
        message = "Marked as pursuing.";
        break;
      case "snooze": {
        const until = new Date(Date.now() + (input.snoozeDays ?? 7) * 86400_000).toISOString();
        db.update(signals).set({ status: "snoozed", snoozeUntil: until, updatedAt: new Date().toISOString() }).where(eq(signals.id, id)).run();
        message = `Snoozed for ${input.snoozeDays ?? 7} days.`;
        detail.snoozeUntil = until;
        break;
      }
      case "dismiss":
        db.update(signals).set({ status: "dismissed", dismissReason: input.reason ?? null, updatedAt: new Date().toISOString() }).where(eq(signals.id, id)).run();
        message = "Dismissed.";
        break;
      case "create_task": {
        if (!signal.contactId) throw new AppError("unprocessable", "This signal is not linked to a FUB contact; cannot create a task by name.");
        const contact = db.select().from(contacts).where(eq(contacts.id, signal.contactId)).get();
        if (!contact?.fubId) throw new AppError("unprocessable", "Linked contact has no FUB ID.");
        const write = await getFub().createTask({ fubContactId: contact.fubId, title: input.taskTitle ?? `Follow up: ${signal.relatedLabel ?? signal.type}` });
        detail.mock = write.mock;
        message = write.mock ? "Task created locally (mock FUB)." : "Task created in Follow Up Boss.";
        break;
      }
      case "add_note": {
        if (!signal.contactId) throw new AppError("unprocessable", "This signal is not linked to a FUB contact.");
        const contact = db.select().from(contacts).where(eq(contacts.id, signal.contactId)).get();
        if (!contact?.fubId) throw new AppError("unprocessable", "Linked contact has no FUB ID.");
        const write = await getFub().addNote({ fubContactId: contact.fubId, body: input.noteBody ?? signal.reason });
        detail.mock = write.mock;
        message = "Draft note added to Follow Up Boss.";
        break;
      }
      case "draft_outreach":
        detail.draft = { subject: `Regarding ${signal.relatedLabel ?? "your property"}`, body: signal.suggestedAction };
        message = "Outreach draft prepared (not sent — review and send yourself).";
        break;
    }

    const record = db.insert(signalActions).values({ signalId: id, action: input.action, detail, actor: "Avery Sandoval" }).returning().get();
    writeAudit({ action: `signal.${input.action}`, entityType: "signal", entityId: id, metadata: { actionId: record.id } });
    return ok({ action: record, message });
  } catch (err) {
    return errorResponse(err);
  }
}
