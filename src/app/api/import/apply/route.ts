import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { decideReview } from "@/services/reviews";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Write a previously previewed bundle into the database. */
export async function POST(req: NextRequest) {
  try {
    const { reviewId, approve } = await readJson(req, z.object({ reviewId: z.string().uuid(), approve: z.boolean(), confirm: z.literal(true) }));
    return ok(await decideReview(reviewId, approve));
  } catch (err) { return errorResponse(err); }
}
