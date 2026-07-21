import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { buyerMatches } from "@/db/schema";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** List ranked matches for a criteria profile, highest score first. */
export async function GET(req: NextRequest) {
  try {
    const criteriaProfileId = req.nextUrl.searchParams.get("criteriaProfileId");
    if (!criteriaProfileId) throw new AppError("bad_request", "criteriaProfileId is required.");
    const rows = db
      .select()
      .from(buyerMatches)
      .where(eq(buyerMatches.criteriaProfileId, criteriaProfileId))
      .orderBy(desc(buyerMatches.score))
      .all();
    return ok({ matches: rows });
  } catch (err) {
    return errorResponse(err);
  }
}
