import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { errorResponse, ok } from "@/lib/errors";
import { listReviews, Proposal, propose } from "@/services/reviews";
export const runtime = "nodejs";
export async function GET() { try { return ok({ items: listReviews() }); } catch (e) { return errorResponse(e); } }
export async function POST(req: NextRequest) { try { const p = await readJson(req, z.object({ payload: Proposal, source: z.string().max(80).default("Claude MCP") })); return ok(propose(p.payload, p.source)); } catch (e) { return errorResponse(e); } }
