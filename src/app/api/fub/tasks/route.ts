import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, syncEvents, tasks } from "@/db/schema";
import { readJson } from "@/lib/api";
import { fubTaskSchema } from "@/lib/validation";
import { getFub } from "@/services/fub/adapter";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Explicit, user-approved action: "Create FUB task".
 * The contact must be linked to a FUB record by ID — never matched by name.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, fubTaskSchema);

    const contact = db.select().from(contacts).where(eq(contacts.id, input.contactId)).get();
    if (!contact) throw new AppError("not_found", "Contact not found.");

    const fubId = input.fubId ?? contact.fubId;
    if (!fubId) {
      throw new AppError(
        "unprocessable",
        "This contact is not linked to Follow Up Boss. Link it by FUB ID before creating a task — AgentOS never matches by name.",
      );
    }

    const fub = getFub();
    const write = await fub.createTask({
      fubContactId: fubId,
      title: input.title,
      body: input.body,
      dueAt: input.dueAt,
    });

    // Record the local task, linked to the FUB id when the write returned one.
    const local = db
      .insert(tasks)
      .values({
        fubId: write.fubId,
        contactId: contact.id,
        title: input.title,
        body: input.body ?? null,
        dueAt: input.dueAt ?? null,
        origin: "local",
        syncedToFub: !write.mock,
      })
      .returning()
      .get();

    db.insert(syncEvents)
      .values({ provider: "fub", direction: "push", entity: "tasks", itemCount: 1, status: "OK", detail: `Task "${input.title}"` })
      .run();

    writeAudit({
      action: "fub.task.created",
      entityType: "task",
      entityId: local.id,
      metadata: { fubContactId: fubId, mock: write.mock, payload: write.payload },
    });

    return ok(
      {
        task: local,
        mock: write.mock,
        message: write.mock
          ? `Task created locally (mock FUB): “${input.title}”. Add FUB_API_KEY to push to the real account.`
          : `Task created in Follow Up Boss: “${input.title}”.`,
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
