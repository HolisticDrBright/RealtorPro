import type { NextRequest } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { omDrafts, verificationFindings, verificationRuns } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { omApproveSchema } from "@/lib/validation.modules";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Broker/agent approval gate. Blocks unless every critical/high finding in the
 * latest verification run is resolved and the approver confirms. On approval the
 * draft becomes Approved and exports unlock.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, omApproveSchema);

    const draft = db.select().from(omDrafts).where(eq(omDrafts.id, id)).get();
    if (!draft) throw new AppError("not_found", "OM draft not found.");

    const latestRun = db.select().from(verificationRuns).where(eq(verificationRuns.omDraftId, id)).orderBy(desc(verificationRuns.createdAt)).get();
    if (!latestRun) {
      throw new AppError("approval_required", "Run the Three-Lens Review before approving.");
    }
    const openBlocking = db
      .select()
      .from(verificationFindings)
      .where(and(eq(verificationFindings.verificationRunId, latestRun.id), eq(verificationFindings.status, "open"), inArray(verificationFindings.severity, ["critical", "high"])))
      .all();
    if (openBlocking.length > 0) {
      throw new AppError("approval_required", `Resolve ${openBlocking.length} blocking finding(s) before approving for export.`, { open: openBlocking.map((f) => f.code) });
    }

    db.update(omDrafts).set({ approvalState: "Approved", updatedAt: new Date().toISOString() }).where(eq(omDrafts.id, id)).run();
    writeAudit({ action: "om.approved", actor: input.approvedBy, entityType: "om_draft", entityId: id, metadata: { runId: latestRun.id } });
    return ok({ approvalState: "Approved", message: "Approved for export — logged with a timestamp." });
  } catch (err) {
    return errorResponse(err);
  }
}
