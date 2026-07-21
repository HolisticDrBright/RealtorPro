import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  derivedMetrics,
  disclosures,
  omDrafts,
  omSections,
  verificationFindings,
  verificationRuns,
} from "@/db/schema.modules";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const draft = db.select().from(omDrafts).where(eq(omDrafts.id, id)).get();
    if (!draft) throw new AppError("not_found", "OM draft not found.");
    const sections = db.select().from(omSections).where(eq(omSections.omDraftId, id)).all();
    const metrics = db.select().from(derivedMetrics).where(eq(derivedMetrics.subjectId, id)).all();
    const discs = db.select().from(disclosures).where(eq(disclosures.subjectId, id)).all();
    const latestRun = db.select().from(verificationRuns).where(eq(verificationRuns.omDraftId, id)).orderBy(desc(verificationRuns.createdAt)).get();
    const findings = latestRun
      ? db.select().from(verificationFindings).where(eq(verificationFindings.verificationRunId, latestRun.id)).all()
      : [];
    return ok({ draft, sections, metrics, disclosures: discs, latestRun, findings });
  } catch (err) {
    return errorResponse(err);
  }
}
