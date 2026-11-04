import type { NextRequest } from "next/server";
import { dueBetween } from "@/services/checklist";
import { addDays as addDaysYmd } from "@/lib/checklist";
import { ymd } from "@/lib/dates";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";

/** Open checklist items due between ?from and ?to (defaults: today → today + 7). */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    const from = q.get("from") ?? ymd();
    const to = q.get("to") ?? addDaysYmd(from, 7) ?? from;
    return ok({ from, to, items: dueBetween(from, to) });
  } catch (err) { return errorResponse(err); }
}
