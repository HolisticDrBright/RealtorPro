import type { NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { vizApproveRemoteSchema } from "@/lib/validation.modules";
import { approveVizRemote } from "@/services/visualizer";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** Explicit approval before any remote generation runs. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, vizApproveRemoteSchema);
    const result = await approveVizRemote(id, input.approvedBy);
    return ok({ job: result.job, outputs: result.outputs });
  } catch (err) {
    return errorResponse(err);
  }
}
