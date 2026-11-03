import type { NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { instantiateSchema } from "@/lib/validation.checklist";
import { instantiateChecklist, summaryFor } from "@/services/checklist";
import { db } from "@/db";
import { transactions } from "@/db/schema.dashboard";
import { eq } from "drizzle-orm";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** Instantiate (or, with reset: true, rebuild) the checklist for a transaction. 409 when one exists and reset is false. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, instantiateSchema);
    const { template, items } = instantiateChecklist(id, input);
    const tx = db.select().from(transactions).where(eq(transactions.id, id)).get()!;
    return ok({ template: { id: template.id, key: template.key, name: template.name, version: template.version }, items, summary: summaryFor(tx, items) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
