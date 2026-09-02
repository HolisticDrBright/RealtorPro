import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { buyerMatches, properties, shortlistItems } from "@/db/schema";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** List ranked matches for a criteria profile, highest score first, with the listing facts. */
export async function GET(req: NextRequest) {
  try {
    const criteriaProfileId = req.nextUrl.searchParams.get("criteriaProfileId");
    if (!criteriaProfileId) throw new AppError("bad_request", "criteriaProfileId is required.");
    const rows = db
      .select({ match: buyerMatches, property: properties })
      .from(buyerMatches)
      .leftJoin(properties, eq(properties.id, buyerMatches.propertyId))
      .where(eq(buyerMatches.criteriaProfileId, criteriaProfileId))
      .orderBy(desc(buyerMatches.score), desc(buyerMatches.createdAt))
      .all();
    const saved = new Set(db.select({ matchId: shortlistItems.matchId }).from(shortlistItems).all().map((s) => s.matchId));
    // Keep only the latest ranking per address so re-imports do not duplicate rows.
    const seen = new Set<string>();
    const matches = [];
    for (const r of rows) {
      const key = (r.match.address ?? r.match.id).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({ ...r.match, property: r.property, shortlisted: saved.has(r.match.id) });
    }
    return ok({ matches });
  } catch (err) {
    return errorResponse(err);
  }
}
