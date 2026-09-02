import type { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { todos } from "@/db/schema.dashboard";
import { readJson } from "@/lib/api";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

const patchSchema = z.object({ done: z.boolean().optional(), title: z.string().min(1).max(300).optional() });

/** Toggle / edit a todo (the checkbox on the dashboard). */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, patchSchema);
    const row = db.select().from(todos).where(eq(todos.id, id)).get();
    if (!row) throw new AppError("not_found", "Todo not found.");
    const updated = db
      .update(todos)
      .set({
        ...(input.title ? { title: input.title } : {}),
        ...(input.done !== undefined ? { done: input.done, completedAt: input.done ? new Date().toISOString() : null } : {}),
      })
      .where(eq(todos.id, id))
      .returning()
      .get();
    return ok({ todo: updated });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    db.delete(todos).where(eq(todos.id, id)).run();
    return ok({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
