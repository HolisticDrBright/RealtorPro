import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { buyerMatches, shortlistItems, shortlists } from "@/db/schema";
import { readJson } from "@/lib/api";
import { shortlistItemSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** Add a match/property to the buyer's shortlist (creating one if needed). */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, shortlistItemSchema);

    let shortlistId = input.shortlistId;
    if (!shortlistId) {
      const existing = db
        .select()
        .from(shortlists)
        .where(eq(shortlists.criteriaProfileId, input.criteriaProfileId))
        .get();
      shortlistId =
        existing?.id ??
        db
          .insert(shortlists)
          .values({ criteriaProfileId: input.criteriaProfileId, name: "Shortlist" })
          .returning()
          .get().id;
    }

    let propertyId = input.propertyId;
    if (!propertyId && input.matchId) {
      const m = db.select().from(buyerMatches).where(eq(buyerMatches.id, input.matchId)).get();
      if (!m) throw new AppError("not_found", "Match not found.");
      propertyId = m.propertyId ?? undefined;
    }

    const item = db
      .insert(shortlistItems)
      .values({ shortlistId, matchId: input.matchId ?? null, propertyId: propertyId ?? null })
      .returning()
      .get();

    writeAudit({
      action: "shortlist.add",
      entityType: "shortlist_item",
      entityId: item.id,
      metadata: { shortlistId, matchId: input.matchId },
    });

    return ok({ item }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Remove a shortlist item. */
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) throw new AppError("bad_request", "id is required.");
    db.delete(shortlistItems).where(and(eq(shortlistItems.id, id))).run();
    writeAudit({ action: "shortlist.remove", entityType: "shortlist_item", entityId: id });
    return ok({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
