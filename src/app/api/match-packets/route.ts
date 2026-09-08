import { NextRequest } from "next/server";
import { readJson } from "@/lib/api";
import { errorResponse, ok } from "@/lib/errors";
import { packetQueue } from "@/services/match-drafts";
import { createMatchPacket, listMatchPackets, PacketInput } from "@/services/match-packets";
export const runtime = "nodejs";
export async function GET() {
  try { return ok({ drafts: packetQueue(), packets: listMatchPackets() }); } catch (e) { return errorResponse(e); }
}
export async function POST(req: NextRequest) {
  try { return ok({ item: await createMatchPacket(await readJson(req, PacketInput)) }); } catch (e) { return errorResponse(e); }
}
