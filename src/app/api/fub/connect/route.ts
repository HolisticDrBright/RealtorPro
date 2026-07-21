import type { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { providerConnections } from "@/db/schema";
import { readJson } from "@/lib/api";
import { fubConnectSchema } from "@/lib/validation";
import { getFub } from "@/services/fub/adapter";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Connection state for Follow Up Boss.
 *
 * NOTE ON KEY STORAGE: for local development a user-provided FUB API key is read
 * from the FUB_API_KEY environment variable (in `.env`, gitignored). This
 * endpoint records connection STATE and scope only — it never persists the raw
 * key to the database. Rotating the key means editing `.env` and restarting.
 */
export async function GET() {
  try {
    const conn = db.select().from(providerConnections).where(eq(providerConnections.provider, "fub")).get();
    const fub = getFub();
    return ok({ connection: conn ?? null, live: { status: fub.status(), mock: fub.mock } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, fubConnectSchema);
    const status =
      input.action === "disconnect" ? "disconnected" : input.action === "pause" ? "sync-error" : "connected";

    const now = new Date().toISOString();
    const existing = db.select().from(providerConnections).where(eq(providerConnections.provider, "fub")).get();
    if (existing) {
      db.update(providerConnections)
        .set({ status, updatedAt: now })
        .where(and(eq(providerConnections.provider, "fub")))
        .run();
    } else {
      db.insert(providerConnections)
        .values({
          provider: "fub",
          status,
          keyRef: "env:FUB_API_KEY",
          scopes: ["read:contacts", "read:deals", "write:tasks", "write:draft-notes"],
        })
        .run();
    }

    writeAudit({ action: `fub.${input.action}`, entityType: "provider_connection", metadata: { status } });

    return ok({
      status,
      note: "The API key itself is read from FUB_API_KEY in your local .env — it is never stored in the database.",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
