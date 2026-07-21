import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { rentRollFindings, rentRollUnits, rentRolls } from "@/db/schema.modules";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const rr = db.select().from(rentRolls).where(eq(rentRolls.id, id)).get();
    if (!rr) throw new AppError("not_found", "Rent roll not found.");
    const units = db.select().from(rentRollUnits).where(eq(rentRollUnits.rentRollId, id)).all();
    const findings = db.select().from(rentRollFindings).where(eq(rentRollFindings.rentRollId, id)).all();
    return ok({ rentRoll: rr, units, findings });
  } catch (err) {
    return errorResponse(err);
  }
}
