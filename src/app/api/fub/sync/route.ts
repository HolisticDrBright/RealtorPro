import { db } from "@/db";
import { providerConnections, syncEvents } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getFub } from "@/services/fub/adapter";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Manual sync with Follow Up Boss (pull assigned records, report pushes). Sync
 * is always user-initiated — AgentOS never auto-syncs or auto-sends. Each
 * pull/push is recorded as a sync event and in the audit log.
 */
export async function POST() {
  try {
    const fub = getFub();
    const result = await fub.sync();

    const now = new Date().toISOString();
    for (const p of result.pulled) {
      db.insert(syncEvents)
        .values({ provider: "fub", direction: "pull", entity: p.entity, itemCount: p.count, status: result.status, detail: result.detail })
        .run();
    }
    for (const p of result.pushed) {
      db.insert(syncEvents)
        .values({ provider: "fub", direction: "push", entity: p.entity, itemCount: p.count, status: result.status, detail: result.detail })
        .run();
    }

    db.update(providerConnections)
      .set({ lastSyncAt: now, status: fub.mock ? "disconnected" : "connected", updatedAt: now })
      .where(and(eq(providerConnections.provider, "fub")))
      .run();

    writeAudit({
      action: "fub.sync",
      entityType: "provider_connection",
      metadata: { pulled: result.pulled, pushed: result.pushed, mock: fub.mock },
    });

    return ok({ ...result, mock: fub.mock, lastSyncAt: now });
  } catch (err) {
    return errorResponse(err);
  }
}
