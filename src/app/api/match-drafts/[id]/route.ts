import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { DraftEdit } from "@/lib/match-drafts";
import { errorResponse, ok } from "@/lib/errors";
import { editMatchDraft, setInPacket } from "@/services/match-drafts";
export const runtime = "nodejs";
const Input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), revision: z.number().int().nonnegative(), fields: DraftEdit }).strict(),
  z.object({ action: z.literal("select"), inPacket: z.boolean() }).strict(),
]);
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params, input = await readJson(req, Input);
    return ok({ item: input.action === "edit" ? editMatchDraft(id, input.revision, input.fields) : setInPacket(id, input.inPacket) });
  } catch (e) { return errorResponse(e); }
}
