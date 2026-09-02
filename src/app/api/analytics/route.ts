import type { NextRequest } from "next/server";
import { analytics } from "@/services/analytics";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(req: NextRequest) { try { return ok(analytics(Number(req.nextUrl.searchParams.get("year") ?? new Date().getFullYear()))); } catch (err) { return errorResponse(err); } }
