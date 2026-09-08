import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { errorResponse, ok } from "@/lib/errors";
import { matchPacketFile, saveMatchPacketToVault } from "@/services/match-packets";
export const runtime = "nodejs";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { packet, file } = matchPacketFile((await ctx.params).id);
    return new NextResponse(new Uint8Array(fs.readFileSync(file)), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${packet.filename}"`, "Cache-Control": "no-store" } });
  } catch (e) { return errorResponse(e); }
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try { await readJson(req, z.object({ saveToVault: z.literal(true) }).strict()); return ok(saveMatchPacketToVault((await ctx.params).id)); } catch (e) { return errorResponse(e); }
}
