import { db } from "@/db";
import * as s from "@/db/schema";
import { isClaudeConfigured, MODEL } from "@/services/claude";
import { vaultStatus } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET() {
  try {
    const contacts = db.select({ id: s.contacts.id }).from(s.contacts).all().length;
    const properties = db.select({ id: s.properties.id }).from(s.properties).all().length;
    return ok({ claude: { configured: isClaudeConfigured(), model: MODEL }, obsidian: vaultStatus(), workspace: { contacts, properties, empty: contacts === 0 && properties === 0 } });
  } catch (err) { return errorResponse(err); }
}
