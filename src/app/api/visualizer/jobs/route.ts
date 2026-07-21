import type { NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { createVizJobSchema } from "@/lib/validation.modules";
import { createVizJob, runVizJob } from "@/services/visualizer";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Create + run a visualization job. Boundary/disclosure/budget guardrails are
 * enforced on create; local (mock) jobs run immediately, remote jobs return a
 * cost estimate and require explicit approval before generation.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, createVizJobSchema);
    const { job, needsApproval } = createVizJob(input);
    if (needsApproval) {
      return ok({ job, needsApproval: true, costEstimateUsd: job.costEstimateUsd, message: "Remote generation requires approval after reviewing the cost estimate." }, { status: 202 });
    }
    const result = await runVizJob(job.id);
    return ok({ job: result.job, outputs: result.outputs, disclosureId: result.disclosureId, needsApproval: false }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
