import type { NextRequest } from "next/server";
import { incomeReport } from "@/services/analytics";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    const n = (k: string) => (p.get(k) ? Number(p.get(k)) : undefined);
    return ok(incomeReport({ year: n("year"), month: n("month"), quarter: n("quarter"), city: p.get("city") ?? undefined, side: p.get("side") ?? undefined }));
  } catch (err) { return errorResponse(err); }
}
