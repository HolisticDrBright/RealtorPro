import fs from "node:fs";
import path from "node:path";
import { sql, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contacts, providerConnections, syncEvents, userProfiles } from "@/db/schema";
import { getFub } from "@/services/fub/adapter";
import { isClaudeConfigured } from "@/services/briefing";
import { vaultStatus } from "@/services/obsidian";
import { googleStatus } from "@/services/google";
import { WORKSPACE_DIR } from "@/lib/paths";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";

function dirBytes(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirBytes(p);
    else if (entry.isFile()) total += fs.statSync(p).size;
  }
  return total;
}

/** Live status of the three data connections the app can use, plus the agent profile. */
export async function GET() {
  try {
    const fub = getFub();
    const conn = db.select().from(providerConnections).where(eq(providerConnections.provider, "fub")).get();
    const contactCount = db.select({ n: sql<number>`count(*)` }).from(contacts).get()?.n ?? 0;
    const fubContacts = db.select({ n: sql<number>`count(*)` }).from(contacts).where(sql`${contacts.fubId} is not null`).get()?.n ?? 0;
    const log = db.select().from(syncEvents).orderBy(desc(syncEvents.createdAt)).limit(10).all();
    const agent = db.select().from(userProfiles).get() ?? null;
    return ok({
      agent,
      fub: { configured: !fub.mock, mock: fub.mock, status: fub.status(), lastSyncAt: conn?.lastSyncAt ?? null, contactCount, fubLinkedContacts: fubContacts, log },
      claude: { configured: isClaudeConfigured(), model: process.env.AGENTOS_CLAUDE_MODEL ?? "claude-opus-5", llmProvider: process.env.AGENTOS_LLM_PROVIDER ?? "mock" },
      obsidian: vaultStatus(),
      google: googleStatus(),
      dataMode: !fub.mock ? "live" : "demo",
      workspaceBytes: dirBytes(WORKSPACE_DIR),
    });
  } catch (err) { return errorResponse(err); }
}
