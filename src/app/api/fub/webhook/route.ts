import type { NextRequest } from "next/server";
import { db } from "@/db";
import { syncEvents } from "@/db/schema";
import { FubAdapter } from "@/services/fub/adapter";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Follow Up Boss webhook RECEIVER (development / documentation only).
 *
 * IMPORTANT: real-time webhooks require FUB to reach a public HTTPS endpoint.
 * A local development machine must NOT be exposed publicly. In production, run a
 * secure hosted relay that verifies the signature and forwards events to this
 * receiver (see docs/ARCHITECTURE.md → "Future hosted webhook relay").
 *
 * This handler verifies an HMAC signature (FUB_WEBHOOK_SECRET) and records the
 * event; it performs no writes back to FUB and never sends anything.
 */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    const signature =
      req.headers.get("x-fub-signature") ?? req.headers.get("x-signature");

    const verified = FubAdapter.verifyWebhookSignature(raw, signature);
    if (!verified) {
      throw new AppError(
        "unauthorized",
        "Invalid or missing webhook signature. Set FUB_WEBHOOK_SECRET and route through the hosted relay.",
      );
    }

    let event: { event?: string; resourceIds?: unknown[] } = {};
    try {
      event = JSON.parse(raw);
    } catch {
      throw new AppError("bad_request", "Webhook body must be JSON.");
    }

    db.insert(syncEvents)
      .values({
        provider: "fub",
        direction: "pull",
        entity: event.event ?? "webhook",
        itemCount: Array.isArray(event.resourceIds) ? event.resourceIds.length : 0,
        status: "OK",
        detail: `Webhook received: ${event.event ?? "unknown"} (verified).`,
      })
      .run();

    writeAudit({
      action: "fub.webhook.received",
      entityType: "sync_event",
      metadata: { event: event.event, verified: true },
    });

    return ok({ received: true, event: event.event ?? null });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Documentation for GET probes / relay health checks. */
export function GET() {
  return ok({
    receiver: "fub-webhook",
    note: "POST verified FUB events here via a secure hosted relay. Do not expose a local machine publicly.",
    requiredEnv: ["FUB_WEBHOOK_SECRET"],
  });
}
