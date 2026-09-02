import { NextResponse } from "next/server";
import { beginAuth } from "@/services/google";
import { errorResponse } from "@/lib/errors";
export const runtime = "nodejs";
/** Start the read-only Google consent flow (user-initiated from the dashboard). */
export async function GET() {
  try { return NextResponse.redirect(beginAuth()); } catch (err) { return errorResponse(err); }
}
