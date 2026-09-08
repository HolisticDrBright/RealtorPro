import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, ok } from "@/lib/errors";
import { getJarvisTurn } from "@/services/jarvis";
export const runtime = "nodejs";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { return ok({ item: getJarvisTurn(z.string().uuid().parse((await ctx.params).id)) }); } catch (err) { return errorResponse(err); }
}
