import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  disclosures as disclosuresTable,
  storyboardScenes,
  storyboards,
  visualizationJobs,
  visualizerProjects,
  visualizerSources,
} from "@/db/schema.modules";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { decideBoundary, type BoundaryStyle } from "@/lib/boundary";
import { buildVisualizationDisclosure, requiresDisclosure, type DisclosureMode } from "@/lib/disclosures";
import { remoteNeedsApproval } from "@/lib/gates";
import { getMediaProvider, getVideoProvider, getMapOverlayProvider } from "@/services/providers/visualizer";

export interface CreateVizJobInput {
  projectId: string;
  storyboardId?: string;
  type: "image" | "video" | "overlay";
  remote: boolean;
}

/**
 * Create a visualization job with the required guardrails enforced up front:
 *   - boundary overlays require a verified boundary source;
 *   - a required disclosure must exist before generation;
 *   - the budget cap and the remote-approval gate are honoured.
 */
export function createVizJob(input: CreateVizJobInput) {
  const project = db.select().from(visualizerProjects).where(eq(visualizerProjects.id, input.projectId)).get();
  if (!project) throw new AppError("not_found", "Visualizer project not found.");
  const sources = db.select().from(visualizerSources).where(eq(visualizerSources.projectId, input.projectId)).all();
  const storyboard = input.storyboardId
    ? db.select().from(storyboards).where(eq(storyboards.id, input.storyboardId)).get()
    : db.select().from(storyboards).where(eq(storyboards.projectId, input.projectId)).get();

  const requestedStyle = (storyboard?.boundaryStyle ?? "none") as BoundaryStyle;

  // Boundary gate (overlay jobs, or any storyboard requesting a boundary style).
  let boundaryAllowed = true;
  if (input.type === "overlay" || requestedStyle !== "none") {
    const decision = decideBoundary(sources, requestedStyle === "none" ? "subtle" : requestedStyle);
    if (!decision.allowed) {
      throw new AppError("unprocessable", decision.reason ?? "Boundary overlay is not permitted without a verified source.");
    }
    boundaryAllowed = decision.allowed;
  }

  // Disclosure requirement.
  let disclosureId: string | null = null;
  if (requiresDisclosure(project.visualizationType)) {
    const req = buildVisualizationDisclosure(project.visualizationType, (storyboard?.disclosureMode ?? "brokerage") as DisclosureMode);
    const disc = db
      .insert(disclosuresTable)
      .values({ subjectType: "visualization", subjectId: project.id, kind: req.kind, text: req.text, mode: storyboard?.disclosureMode ?? "brokerage", required: true, editable: true, status: "pending" })
      .returning()
      .get();
    disclosureId = disc.id;
  }

  // Cost estimate + budget cap.
  const media = getMediaProvider();
  const video = getVideoProvider();
  const cost =
    input.type === "video"
      ? video.estimateCostUsd({ prompt: "", visualDirection: "", format: storyboard?.format ?? "16:9", durationSec: storyboard?.durationSec ?? 15, cameraMovement: "", scenes: [] })
      : media.estimateCostUsd({ prompt: "", visualDirection: "", format: storyboard?.format ?? "16:9" });
  const cap = storyboard?.budgetCapUsd ?? 50;
  if (cost > cap) {
    throw new AppError("rate_limited", `Estimated cost $${cost.toFixed(2)} exceeds the budget cap $${cap.toFixed(2)}.`);
  }

  const isRemote = input.remote || (process.env.AGENTOS_MEDIA_PROVIDER ?? "mock") !== "mock";

  const job = db
    .insert(visualizationJobs)
    .values({
      projectId: input.projectId,
      storyboardId: storyboard?.id ?? null,
      type: input.type,
      status: "queued",
      provider: isRemote ? "higgsfield" : "mock",
      inputs: { storyboardId: storyboard?.id, visualizationType: project.visualizationType },
      costEstimateUsd: cost,
      isRemote,
      approvedForRemote: false,
      boundaryAllowed,
      disclosureId,
    })
    .returning()
    .get();

  writeAudit({ action: "viz.job.created", entityType: "visualization_job", entityId: job.id, metadata: { type: input.type, isRemote, cost, boundaryAllowed, disclosureId } });
  return { job, needsApproval: isRemote };
}

export async function runVizJob(jobId: string) {
  const job = db.select().from(visualizationJobs).where(eq(visualizationJobs.id, jobId)).get();
  if (!job) throw new AppError("not_found", "Job not found.");
  if (remoteNeedsApproval({ isRemote: job.isRemote, approvedForRemote: job.approvedForRemote })) {
    throw new AppError("approval_required", "This job runs on a remote provider and needs explicit approval before generation.", { jobId, cost: job.costEstimateUsd });
  }

  db.update(visualizationJobs).set({ status: "running", updatedAt: new Date().toISOString() }).where(eq(visualizationJobs.id, jobId)).run();

  const storyboard = job.storyboardId ? db.select().from(storyboards).where(eq(storyboards.id, job.storyboardId)).get() : null;
  const scenes = job.storyboardId ? db.select().from(storyboardScenes).where(eq(storyboardScenes.storyboardId, job.storyboardId)).all() : [];

  let outputs: Record<string, unknown> = {};
  try {
    if (job.type === "video") {
      const res = await getVideoProvider().generateVideo({
        prompt: "Concept video",
        visualDirection: storyboard?.visualDirection ?? "architectural editorial",
        format: storyboard?.format ?? "16:9",
        durationSec: storyboard?.durationSec ?? 15,
        cameraMovement: storyboard?.cameraMovement ?? "slow push-in",
        scenes: scenes.map((s) => s.beat),
      });
      outputs = { media: res };
    } else if (job.type === "overlay") {
      const res = await getMapOverlayProvider().generateBoundaryOverlay({ style: (storyboard?.boundaryStyle === "none" ? "subtle" : storyboard?.boundaryStyle ?? "subtle") as "subtle" | "glow", basis: "verified" });
      outputs = { overlay: res };
    } else {
      const res = await getMediaProvider().generateImage({ prompt: "Concept image", visualDirection: storyboard?.visualDirection ?? "architectural editorial", format: storyboard?.format ?? "16:9" });
      outputs = { media: res };
    }

    db.update(visualizationJobs).set({ status: "review", outputs, updatedAt: new Date().toISOString() }).where(eq(visualizationJobs.id, jobId)).run();
    writeAudit({ action: "viz.job.completed", entityType: "visualization_job", entityId: jobId, metadata: { type: job.type } });
    return { job: { ...job, status: "review" }, outputs, disclosureId: job.disclosureId };
  } catch (err) {
    db.update(visualizationJobs).set({ status: "failed", error: err instanceof Error ? err.message : "unknown", updatedAt: new Date().toISOString() }).where(eq(visualizationJobs.id, jobId)).run();
    throw err;
  }
}

export function approveVizRemote(jobId: string, approvedBy: string) {
  const job = db.select().from(visualizationJobs).where(eq(visualizationJobs.id, jobId)).get();
  if (!job) throw new AppError("not_found", "Job not found.");
  db.update(visualizationJobs).set({ approvedForRemote: true, updatedAt: new Date().toISOString() }).where(eq(visualizationJobs.id, jobId)).run();
  writeAudit({ action: "viz.remote.approved", actor: approvedBy, entityType: "visualization_job", entityId: jobId });
  return runVizJob(jobId);
}
