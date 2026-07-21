import type { NextRequest } from "next/server";
import { db } from "@/db";
import { omDrafts } from "@/db/schema.modules";
import { eq } from "drizzle-orm";
import { runVerification } from "@/services/om";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** Run the mandatory Three-Lens Review and persist findings. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { run, result } = runVerification(id);
    db.update(omDrafts)
      .set({ approvalState: result.ready ? "Ready for Broker Review" : "Needs Review", updatedAt: new Date().toISOString() })
      .where(eq(omDrafts.id, id))
      .run();
    writeAudit({ action: "om.verify", entityType: "om_draft", entityId: id, metadata: { runId: run.id, ready: result.ready, counts: result.countsBySeverity } });
    return ok({ runId: run.id, ready: result.ready, findings: result.findings, pageStates: result.pageStates, countsBySeverity: result.countsBySeverity, externalBranding: result.externalBranding });
  } catch (err) {
    return errorResponse(err);
  }
}
