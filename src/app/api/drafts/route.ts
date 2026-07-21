import type { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { drafts } from "@/db/schema";
import { readJson } from "@/lib/api";
import { assessText } from "@/lib/fair-housing";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

const draftSchema = z.object({
  kind: z.enum(["email", "note"]),
  contactId: z.string().optional(),
  propertyId: z.string().optional(),
  title: z.string().max(300).optional(),
  subject: z.string().max(300).optional(),
  body: z.string().min(1).max(10000),
});

/**
 * Create a LOCAL draft (client email or note). Drafts never send — they are
 * saved locally and queued to push to Follow Up Boss as a draft for the agent.
 * Fair Housing guardrail runs on the draft body.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, draftSchema);

    const fh = assessText(`${input.subject ?? ""} ${input.body}`);
    if (!fh.allowed) {
      throw new AppError(
        "fair_housing_violation",
        "This draft contains language that could steer on a protected class. Revise it before saving.",
        { violations: fh.violations },
      );
    }

    const row = db
      .insert(drafts)
      .values({
        kind: input.kind,
        contactId: input.contactId ?? null,
        propertyId: input.propertyId ?? null,
        title: input.title ?? input.subject ?? null,
        content: { subject: input.subject, body: input.body },
        status: "draft",
        provider: "local",
      })
      .returning()
      .get();

    writeAudit({
      action: "draft.created",
      entityType: "draft",
      entityId: row.id,
      metadata: { kind: input.kind, contactId: input.contactId },
    });

    return ok({ draft: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
