import { NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { GenerateMatch } from "@/lib/match-drafts";
import { errorResponse, ok } from "@/lib/errors";
import { generateMatchDraft, getMatchDraft, listMatchDrafts } from "@/services/match-drafts";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams, id = p.get("id");
    return ok(id ? { item: getMatchDraft(id) } : { items: listMatchDrafts({ buyerId: p.get("buyerId"), candidateId: p.get("candidateId"), kind: p.get("kind") }) });
  } catch (e) { return errorResponse(e); }
}
export async function POST(req: NextRequest) {
  try { return ok({ item: await generateMatchDraft(await readJson(req, GenerateMatch)) }); } catch (e) { return errorResponse(e); }
}
