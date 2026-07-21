import type { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { disclosures } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

const schema = z.object({ text: z.string().max(2000).optional(), approvedBy: z.string().default("Avery Sandoval") });

/** Approve (and optionally edit) a required disclosure. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, schema);
    const disc = db.select().from(disclosures).where(eq(disclosures.id, id)).get();
    if (!disc) throw new AppError("not_found", "Disclosure not found.");
    db.update(disclosures)
      .set({ status: "approved", ...(input.text ? { text: input.text } : {}) })
      .where(eq(disclosures.id, id))
      .run();
    writeAudit({ action: "disclosure.approved", actor: input.approvedBy, entityType: "disclosure", entityId: id, metadata: { kind: disc.kind } });
    return ok({ ok: true, id, status: "approved" });
  } catch (err) {
    return errorResponse(err);
  }
}
