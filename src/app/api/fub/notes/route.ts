import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, notes, syncEvents } from "@/db/schema";
import { readJson } from "@/lib/api";
import { fubNoteSchema } from "@/lib/validation";
import { assessText } from "@/lib/fair-housing";
import { getFub } from "@/services/fub/adapter";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Explicit, user-approved action: "Add FUB note".
 * The note is created in FUB as a DRAFT — never sent. The contact must be linked
 * by FUB ID (never by name), and the body passes the Fair Housing guardrail.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, fubNoteSchema);

    const fh = assessText(input.body);
    if (!fh.allowed) {
      throw new AppError(
        "fair_housing_violation",
        "This note contains language that could steer on a protected class. Revise it before adding.",
        { violations: fh.violations },
      );
    }

    const contact = db.select().from(contacts).where(eq(contacts.id, input.contactId)).get();
    if (!contact) throw new AppError("not_found", "Contact not found.");

    const fubId = input.fubId ?? contact.fubId;
    if (!fubId) {
      throw new AppError(
        "unprocessable",
        "This contact is not linked to Follow Up Boss. Link it by FUB ID before adding a note.",
      );
    }

    const fub = getFub();
    const write = await fub.addNote({ fubContactId: fubId, body: input.body });

    const local = db
      .insert(notes)
      .values({
        fubId: write.fubId,
        contactId: contact.id,
        body: input.body,
        isDraft: true,
        origin: "local",
        syncedToFub: !write.mock,
      })
      .returning()
      .get();

    db.insert(syncEvents)
      .values({ provider: "fub", direction: "push", entity: "notes", itemCount: 1, status: "OK", detail: "Draft note" })
      .run();

    writeAudit({
      action: "fub.note.created",
      entityType: "note",
      entityId: local.id,
      metadata: { fubContactId: fubId, mock: write.mock, isDraft: true },
    });

    return ok(
      {
        note: local,
        mock: write.mock,
        message: write.mock
          ? "Draft note saved locally (mock FUB). Add FUB_API_KEY to push it as a draft to the real account."
          : "Draft note added to Follow Up Boss — review and send it from there.",
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
