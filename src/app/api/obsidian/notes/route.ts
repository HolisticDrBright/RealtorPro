import type { NextRequest } from "next/server";
import { indexVaultIfChanged, notesForContact, notesForProperty, recentNotes, searchNotes, vaultStatus } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const p = req.nextUrl.searchParams;
    indexVaultIfChanged();
    const notes = p.get("contactId") ? notesForContact(p.get("contactId")!) : p.get("propertyId") ? notesForProperty(p.get("propertyId")!) : p.get("q") ? searchNotes(p.get("q")!) : recentNotes();
    return ok({ notes, status: vaultStatus() });
  } catch (err) { return errorResponse(err); }
}
