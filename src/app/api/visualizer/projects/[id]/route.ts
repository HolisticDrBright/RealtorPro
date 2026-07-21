import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { storyboards, visualizationJobs, visualizerProjects, visualizerSources } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { addVisualizerSourceSchema } from "@/lib/validation.modules";
import { hasVerifiedBoundary } from "@/lib/boundary";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const project = db.select().from(visualizerProjects).where(eq(visualizerProjects.id, id)).get();
    if (!project) throw new AppError("not_found", "Project not found.");
    const sources = db.select().from(visualizerSources).where(eq(visualizerSources.projectId, id)).all();
    const board = db.select().from(storyboards).where(eq(storyboards.projectId, id)).get();
    const jobs = db.select().from(visualizationJobs).where(eq(visualizationJobs.projectId, id)).all();
    return ok({ project, sources, storyboard: board ?? null, jobs, boundaryAvailable: hasVerifiedBoundary(sources) });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Add a source (rights + boundary basis) to a project. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, addVisualizerSourceSchema);
    if (input.projectId !== id) throw new AppError("bad_request", "projectId mismatch.");
    if (!input.rightsConfirmed) {
      throw new AppError("unprocessable", "Only authorized, licensed, or brokerage/MLS-approved media may be added. Confirm rights first.");
    }
    // A boundary basis only counts when the user marks it verified.
    const boundaryVerified = input.boundaryVerified && input.boundaryBasis !== "none";
    const source = db
      .insert(visualizerSources)
      .values({ projectId: id, kind: input.kind, label: input.label ?? null, rightsConfirmed: true, boundaryVerified, boundaryBasis: input.boundaryBasis })
      .returning()
      .get();
    writeAudit({ action: "viz.source.added", entityType: "visualizer_source", entityId: source.id, metadata: { kind: input.kind, boundaryVerified } });
    return ok({ source, boundaryVerified }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
