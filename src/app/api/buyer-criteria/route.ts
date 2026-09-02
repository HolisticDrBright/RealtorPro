import type { NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { buyerCriteriaProfiles, contacts } from "@/db/schema";
import { readJson } from "@/lib/api";
import { buyerCriteriaSchema } from "@/lib/validation";
import { assessCriteria } from "@/lib/fair-housing";
import { parseCeiling } from "@/lib/listing-parse";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** List buyer criteria profiles (optionally by contact), with the linked contact. */
export async function GET(req: NextRequest) {
  try {
    const contactId = req.nextUrl.searchParams.get("contactId");
    const q = db
      .select({ profile: buyerCriteriaProfiles, contact: { id: contacts.id, name: contacts.name, fubId: contacts.fubId, phone: contacts.phone, email: contacts.email, stage: contacts.stage, temperature: contacts.temperature, lastActivityAt: contacts.lastActivityAt } })
      .from(buyerCriteriaProfiles)
      .leftJoin(contacts, eq(contacts.id, buyerCriteriaProfiles.contactId));
    const rows = contactId
      ? q.where(eq(buyerCriteriaProfiles.contactId, contactId)).all()
      : q.orderBy(desc(buyerCriteriaProfiles.createdAt)).all();
    return ok({ profiles: rows.map((r) => ({ ...r.profile, contact: r.contact?.id ? r.contact : null })) });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Create/update objective criteria. Fair Housing guardrail runs first: any
 * protected-class or subjective-neighborhood language is rejected.
 */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, buyerCriteriaSchema);

    const fh = assessCriteria({
      ceilingText: input.ceilingText,
      hardConstraints: input.hardConstraints,
      weightedPrefs: input.weightedPrefs,
      areas: input.areas,
      mustHaves: input.mustHaves,
    });
    if (!fh.allowed) {
      throw new AppError(
        "fair_housing_violation",
        "These criteria include protected-class or subjective-neighborhood language, which AgentOS does not allow. Use objective listing facts only.",
        { violations: fh.violations },
      );
    }

    const row = db
      .insert(buyerCriteriaProfiles)
      .values({
        contactId: input.contactId ?? null,
        label: input.label ?? null,
        ceilingText: input.ceilingText ?? null,
        ceilingAmount: input.ceilingAmount ?? parseCeiling(input.ceilingText),
        ceilingHard: input.ceilingHard,
        hardConstraints: input.hardConstraints,
        weightedPrefs: input.weightedPrefs,
        areas: input.areas,
        mustHaves: input.mustHaves,
        agreedAt: input.agreedAt ?? null,
      })
      .returning()
      .get();

    writeAudit({
      action: "buyer_criteria.saved",
      entityType: "buyer_criteria_profile",
      entityId: row.id,
      metadata: { contactId: input.contactId, prefs: input.weightedPrefs.length },
    });

    return ok({ profile: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
