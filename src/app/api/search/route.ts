import type { NextRequest } from "next/server";
import { search } from "@/services/search";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(req: NextRequest) { try { return ok({ hits: search(req.nextUrl.searchParams.get("q") ?? "") }); } catch (err) { return errorResponse(err); } }
