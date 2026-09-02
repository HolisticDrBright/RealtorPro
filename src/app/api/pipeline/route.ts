import { db } from "@/db";
import * as s from "@/db/schema";
import { pipelineTotals } from "@/lib/calc";
import { loadContext } from "@/services/context";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Kanban: contacts by stage with totals. Moves are PATCH /api/contacts/:id { stage, stageOrder }. */
export async function GET() {
  try {
    const ctx = loadContext();
    const buyersAll = db.select().from(s.buyers).all();
    const cards = ctx.contacts.filter((c) => !c.archived).map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), type: c.type, stage: c.stage, stageOrder: c.stageOrder, estValue: c.estValue, estCommission: c.estCommission, probability: c.probability, nextAction: c.nextAction, nextFollowUpAt: c.nextFollowUpAt, lastContactAt: c.lastContactAt, phone: c.phone, temperature: buyersAll.find((b) => b.contactId === c.id)?.temperature ?? null })).sort((a, b) => a.stageOrder - b.stageOrder);
    return ok({ stages: s.PIPELINE_STAGES, cards, totals: pipelineTotals(cards) });
  } catch (err) { return errorResponse(err); }
}
