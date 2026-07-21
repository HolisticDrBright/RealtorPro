import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { approvals, drafts, mediaDisclosures } from "@/db/schema";
import { readJson } from "@/lib/api";
import { approvalSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Record an approval — the gate for every campaign section, disclosure, and
 * draft. Approvals are timestamped and written to the audit/disclosure log.
 * Approving a draft flips its status; approving a disclosure marks it approved.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, approvalSchema);

    const record = db
      .insert(approvals)
      .values({
        targetType: input.targetType,
        targetId: input.targetId,
        label: input.label ?? null,
        approvedBy: input.approvedBy,
        note: input.note ?? null,
      })
      .returning()
      .get();

    if (input.targetType === "draft" || input.targetType === "section") {
      db.update(drafts)
        .set({ status: "approved", updatedAt: new Date().toISOString() })
        .where(eq(drafts.id, input.targetId))
        .run();
    } else if (input.targetType === "disclosure") {
      db.update(mediaDisclosures)
        .set({ status: "approved" })
        .where(eq(mediaDisclosures.id, input.targetId))
        .run();
    }

    writeAudit({
      action: "approval.recorded",
      actor: input.approvedBy,
      entityType: input.targetType,
      entityId: input.targetId,
      metadata: { label: input.label, approvalId: record.id },
    });

    return ok({ approval: record }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
