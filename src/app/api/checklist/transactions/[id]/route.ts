import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { checklistDetail, instantiateChecklist } from "@/services/checklist";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
type Ctx = { params: Promise<{ id: string }> };

/** Transaction + checklist: { transaction, template, items, summary }. */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try { const { id } = await ctx.params; return ok(checklistDetail(id)); } catch (err) { return errorResponse(err); }
}

/** Start the checklist, or rebuild it with { reset: true }. 409 when one exists and reset is false. */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, z.object({ templateKey: z.string().optional(), reset: z.boolean().default(false) }));
    instantiateChecklist(id, input);
    return ok(checklistDetail(id), { status: 201 });
  } catch (err) { return errorResponse(err); }
}
