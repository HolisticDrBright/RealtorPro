import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { drafts, generationJobs } from "@/db/schema";
import { cancelJob } from "@/services/generation-queue";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** Get a job's status and its produced drafts. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const job = db.select().from(generationJobs).where(eq(generationJobs.id, id)).get();
    if (!job) throw new AppError("not_found", "Job not found.");
    const jobDrafts = db.select().from(drafts).where(eq(drafts.jobId, id)).all();
    return ok({ job, drafts: jobDrafts });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Cancel a job. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return ok(cancelJob(id));
  } catch (err) {
    return errorResponse(err);
  }
}
