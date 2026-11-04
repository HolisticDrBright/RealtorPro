import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { updateItem } from "@/services/checklist";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";

const patchSchema = z.object({
  status: z.enum(["pending", "done", "na", "waived"]).optional(),
  dueOverride: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

/** Patch one checklist item: status (done stamps completedAt), due-date override, notes. */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, patchSchema);
    return ok({ item: updateItem(id, input) });
  } catch (err) { return errorResponse(err); }
}
