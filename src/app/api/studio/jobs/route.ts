import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { generationJobs } from "@/db/schema";
import { readJson } from "@/lib/api";
import { createJobSchema } from "@/lib/validation";
import { createJob, runJob } from "@/services/generation-queue";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** List generation jobs. */
export async function GET() {
  try {
    const rows = db.select().from(generationJobs).orderBy(desc(generationJobs.createdAt)).all();
    return ok({ jobs: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Create a generation job. Local (mock) jobs run immediately and return outputs.
 * Remote jobs are queued and require explicit approval before running (a
 * preflight cost estimate is returned so the agent can approve knowingly).
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, createJobSchema);
    const { job, needsApproval } = createJob(input);

    if (needsApproval) {
      return ok(
        {
          job,
          needsApproval: true,
          costEstimateUsd: job.costEstimateUsd,
          message:
            "This job runs on a remote provider. Review the cost estimate and approve it to generate.",
        },
        { status: 202 },
      );
    }

    const result = await runJob(job.id);
    return ok({ job: result.job, outputs: result.outputs, needsApproval: false }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
