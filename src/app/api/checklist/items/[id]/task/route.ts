import type { NextRequest } from "next/server";
import { addTask } from "@/services/checklist";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";

/** Add the item to the to-do list as a task (idempotent). */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const r = addTask(id);
    return ok({ ...r, message: r.created ? `Added to your tasks: “${r.task.title}”` : "This item is already on your task list." }, { status: r.created ? 201 : 200 });
  } catch (err) { return errorResponse(err); }
}
