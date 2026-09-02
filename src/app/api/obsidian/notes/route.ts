import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { vaultNotes } from "@/db/schema.vault";
import { notesForContact, searchNotes, vaultStatus } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Vault notes: by contact, by search, or the most recent. */
export async function GET(req: NextRequest) {
  try {
    const contactId = req.nextUrl.searchParams.get("contactId");
    const q = req.nextUrl.searchParams.get("q");
    const notes = contactId ? notesForContact(contactId) : q ? searchNotes(q) : db.select().from(vaultNotes).orderBy(desc(vaultNotes.modifiedAt)).limit(25).all();
    return ok({ notes, status: vaultStatus() });
  } catch (err) { return errorResponse(err); }
}
