import { db } from "@/db";
import * as s from "@/db/schema";
import { claudeStatus } from "@/lib/connections";
import { vaultStatus } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET() {
  try {
    const contacts = db.select({ id: s.contacts.id }).from(s.contacts).all().length;
    const properties = db.select({ id: s.properties.id }).from(s.properties).all().length;
    return ok({ claude: claudeStatus(), obsidian: vaultStatus(), workspace: { contacts, properties, empty: contacts === 0 && properties === 0 } });
  } catch (err) { return errorResponse(err); }
}
