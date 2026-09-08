import type { NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { errorResponse, ok } from "@/lib/errors";
import { askJarvis, JarvisRequest, listJarvisTurns } from "@/services/jarvis";
export const runtime = "nodejs";
export async function GET() { try { return ok({ items: listJarvisTurns() }); } catch (err) { return errorResponse(err); } }
export async function POST(req: NextRequest) { try { return ok({ item: await askJarvis(await readJson(req, JarvisRequest)) }); } catch (err) { return errorResponse(err); } }
