import type { NextRequest } from "next/server";
import { matches } from "@/services/matching";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try { const p = req.nextUrl.searchParams; return ok({ matches: matches({ buyerId: p.get("buyerId") ?? undefined, listingId: p.get("listingId") ?? undefined, opportunityId: p.get("opportunityId") ?? undefined }) }); } catch (err) { return errorResponse(err); }
}
