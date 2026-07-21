import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { disclosures, exportRecords, visualizationJobs, visualizerProjects } from "@/db/schema.modules";
import { enforceDisclosure } from "@/lib/disclosures";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Export a completed visualization. LOCKED until the required disclosure is
 * present and approved — no public/provider export happens without it.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const job = db.select().from(visualizationJobs).where(eq(visualizationJobs.id, id)).get();
    if (!job) throw new AppError("not_found", "Job not found.");
    if (job.status !== "review" && job.status !== "approved") {
      throw new AppError("unprocessable", "The job must complete generation and be in review before export.");
    }
    const project = db.select().from(visualizerProjects).where(eq(visualizerProjects.id, job.projectId!)).get();

    const disc = job.disclosureId ? db.select().from(disclosures).where(eq(disclosures.id, job.disclosureId)).get() : null;
    const block = enforceDisclosure({ visualizationType: project?.visualizationType ?? "land_teaser", disclosureText: disc?.text, approved: disc?.status === "approved" });
    if (block) throw new AppError("approval_required", block);

    const outputs = (job.outputs ?? {}) as { media?: { outputPath?: string }; overlay?: { outputPath?: string } };
    const record = db
      .insert(exportRecords)
      .values({ subjectType: "visualization", subjectId: id, format: "pdf", storedPath: outputs.media?.outputPath ?? outputs.overlay?.outputPath ?? "generated/manifest.json", metadata: { visualizationType: project?.visualizationType, disclosureId: job.disclosureId } })
      .returning()
      .get();

    db.update(visualizationJobs).set({ status: "approved", updatedAt: new Date().toISOString() }).where(eq(visualizationJobs.id, id)).run();
    writeAudit({ action: "viz.export", entityType: "export_record", entityId: record.id, metadata: { jobId: id } });
    return ok({ export: record, message: "Visualization exported with its required disclosure." }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
