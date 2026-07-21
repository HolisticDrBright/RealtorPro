import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { omDrafts, omSections } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { createOmSchema } from "@/lib/validation.modules";
import { assertTemplateRights } from "@/services/om";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

const DEFAULT_PAGES: { key: string; title: string }[] = [
  { key: "cover", title: "Cover" },
  { key: "exec", title: "Executive Summary" },
  { key: "highlights", title: "Investment Highlights" },
  { key: "overview", title: "Property Overview" },
  { key: "location", title: "Location & Connectivity" },
  { key: "market", title: "Market Overview" },
  { key: "financial", title: "Financial Summary" },
  { key: "rentroll", title: "Rent Roll / Tenant Summary" },
  { key: "comps", title: "Comparable Sales" },
  { key: "risk", title: "Risk Factors & Disclosures" },
  { key: "contact", title: "Contact / Call to Action" },
];

export async function GET() {
  try {
    return ok({ drafts: db.select().from(omDrafts).orderBy(desc(omDrafts.updatedAt)).all() });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Create an OM draft. Requires a brand kit AND a rights-confirmed template. */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, createOmSchema);
    assertTemplateRights(input.templateProfileId);

    const draft = db
      .insert(omDrafts)
      .values({
        propertyId: input.propertyId ?? null,
        name: input.name,
        address: input.address ?? null,
        market: input.market ?? null,
        assetType: input.assetType ?? null,
        price: input.price ?? null,
        brandProfileId: input.brandProfileId,
        templateProfileId: input.templateProfileId,
        approvalState: "Draft",
      })
      .returning()
      .get();

    for (const [i, p] of DEFAULT_PAGES.entries()) {
      db.insert(omSections)
        .values({ omDraftId: draft.id, key: p.key, title: p.title, orderIndex: i, needsReview: p.key !== "cover" && p.key !== "contact" })
        .run();
    }

    writeAudit({ action: "om.draft.created", entityType: "om_draft", entityId: draft.id, metadata: { brandProfileId: input.brandProfileId, templateProfileId: input.templateProfileId } });
    return ok({ draft }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
