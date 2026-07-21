import type { NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { approveJobRemoteSchema } from "@/lib/validation";
import { approveRemote } from "@/services/generation-queue";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Explicit approval gate for remote generation. Records who approved, then runs
 * the job. Without this call a remote job never contacts an external provider.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, approveJobRemoteSchema);
    const result = await approveRemote(id, input.approvedBy);
    return ok({ job: result.job, outputs: result.outputs });
  } catch (err) {
    return errorResponse(err);
  }
}
