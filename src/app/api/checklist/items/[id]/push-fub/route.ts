import type { NextRequest } from "next/server";
import { pushToFub } from "@/services/checklist";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Create a LOCAL draft task for the item (origin "local", syncedToFub false).
 * Nothing is sent to Follow Up Boss here — the agent approves the push on the
 * Follow Up Boss screen.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const result = pushToFub(id);
    return ok({ ...result, message: result.created ? `Draft task queued: “${result.task.title}”. Approve it on the Follow Up Boss screen to push.` : "This item already has a draft task." }, { status: result.created ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
