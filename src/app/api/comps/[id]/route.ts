import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { compAdjustments, compSets, comps } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { compAdjustmentSchema } from "@/lib/validation.modules";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const set = db.select().from(compSets).where(eq(compSets.id, id)).get();
    if (!set) throw new AppError("not_found", "Comp set not found.");
    const rows = db.select().from(comps).where(eq(comps.compSetId, id)).all();
    return ok({ compSet: set, comps: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Add an agent-entered adjustment (labeled an assumption, never a fact). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await ctx.params;
    const input = await readJson(req, compAdjustmentSchema);
    const row = db
      .insert(compAdjustments)
      .values({ compId: input.compId, label: input.label, amount: input.amount ?? null, note: input.note ?? null, agentEntered: true })
      .returning()
      .get();
    writeAudit({ action: "comps.adjustment.added", entityType: "comp_adjustment", entityId: row.id });
    return ok({ adjustment: row, note: "Agent-entered assumption — not a verified fact." }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
