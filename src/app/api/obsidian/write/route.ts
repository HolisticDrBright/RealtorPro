import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { writeVaultNote } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
const schema = z.object({ title: z.string().min(1).max(200), content: z.string().min(1).max(50000), subfolder: z.string().max(100).optional() });
export async function POST(req: NextRequest) {
  try { const i = await readJson(req, schema); return ok(writeVaultNote(i.title, i.content, i.subfolder), { status: 201 }); } catch (err) { return errorResponse(err); }
}
