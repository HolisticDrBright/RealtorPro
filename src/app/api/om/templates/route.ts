import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { templateProfiles, templateRightsConfirmations } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { templateRightsSchema } from "@/lib/validation.modules";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    return ok({ templates: db.select().from(templateProfiles).orderBy(desc(templateProfiles.createdAt)).all() });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Create an ORIGINAL template with a rights confirmation. There is deliberately
 * no "remove competitor branding" feature — users build from their own assets.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, templateRightsSchema);
    const tmpl = db
      .insert(templateProfiles)
      .values({ name: input.name, family: input.family, description: input.description ?? null, isOriginal: input.ownershipBasis === "original" })
      .returning()
      .get();
    const rights = db
      .insert(templateRightsConfirmations)
      .values({ templateProfileId: tmpl.id, confirmedBy: input.confirmedBy, ownershipBasis: input.ownershipBasis, note: input.note ?? null })
      .returning()
      .get();
    writeAudit({ action: "om.template.created", entityType: "template_profile", entityId: tmpl.id, metadata: { ownershipBasis: input.ownershipBasis } });
    return ok({ template: tmpl, rights }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
