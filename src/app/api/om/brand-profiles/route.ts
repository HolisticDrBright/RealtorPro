import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { brandProfiles } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { brandProfileSchema } from "@/lib/validation.modules";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    return ok({ brandProfiles: db.select().from(brandProfiles).orderBy(desc(brandProfiles.createdAt)).all() });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create a brand kit from the user's own colors, logo, typography, disclaimer. */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, brandProfileSchema);
    const row = db
      .insert(brandProfiles)
      .values({ name: input.name, broker: input.broker ?? null, contact: input.contact ?? null, disclaimer: input.disclaimer ?? null, colors: input.colors, typography: input.typography, ownedByUser: true })
      .returning()
      .get();
    writeAudit({ action: "om.brand.created", entityType: "brand_profile", entityId: row.id });
    return ok({ brandProfile: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
