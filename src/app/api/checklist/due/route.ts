import type { NextRequest } from "next/server";
import { z } from "zod";
import { dueBetween, todayYmd } from "@/services/checklist";
import { addDays } from "@/lib/checklist";
import { ymdSchema } from "@/lib/validation.checklist";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

const querySchema = z.object({ from: ymdSchema.optional(), to: ymdSchema.optional() });

/** Open checklist items with an effective due date in [from, to] across active transactions. Defaults: today → today + 7. */
export async function GET(req: NextRequest) {
  try {
    const q = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const from = q.from ?? todayYmd();
    const to = q.to ?? addDays(from, 7) ?? from;
    return ok({ from, to, items: dueBetween(from, to) });
  } catch (err) {
    return errorResponse(err);
  }
}
