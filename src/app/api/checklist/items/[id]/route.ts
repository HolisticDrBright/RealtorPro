import type { NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { patchItemSchema } from "@/lib/validation.checklist";
import { attachDocument, updateItem } from "@/services/checklist";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** Patch one checklist item: status (done stamps completedAt), dueOverride, notes, sourceDocumentId (links + marks done). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { sourceDocumentId, ...patch } = await readJson(req, patchItemSchema);
    let item = Object.keys(patch).length ? updateItem(id, patch) : null;
    if (sourceDocumentId) item = attachDocument(id, sourceDocumentId);
    else if (sourceDocumentId === null) item = updateItem(id, { sourceDocumentId: null });
    if (!item) item = updateItem(id, {});
    return ok({ item });
  } catch (err) {
    return errorResponse(err);
  }
}
