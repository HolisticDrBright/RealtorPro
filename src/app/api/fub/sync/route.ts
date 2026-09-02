import { syncFromFub } from "@/services/fub/sync";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Manual, user-initiated sync with Follow Up Boss: pulls people, tasks, notes,
 * deals, and appointments into the local database (upserted by FUB id). With no
 * FUB_API_KEY the call is a no-op that reports mock mode.
 */
export async function POST() {
  try {
    return ok(await syncFromFub());
  } catch (err) {
    return errorResponse(err);
  }
}
