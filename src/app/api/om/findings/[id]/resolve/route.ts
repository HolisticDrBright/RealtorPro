import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { verificationFindings } from "@/db/schema.modules";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** Mark a verification finding resolved. */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const finding = db.select().from(verificationFindings).where(eq(verificationFindings.id, id)).get();
    if (!finding) throw new AppError("not_found", "Finding not found.");
    db.update(verificationFindings).set({ status: "resolved" }).where(eq(verificationFindings.id, id)).run();
    writeAudit({ action: "om.finding.resolved", entityType: "verification_finding", entityId: id, metadata: { code: finding.code } });
    return ok({ ok: true, id });
  } catch (err) {
    return errorResponse(err);
  }
}
