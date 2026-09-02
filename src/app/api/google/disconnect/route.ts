import { disconnectGoogle } from "@/services/google";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Forget the local tokens and remove mirrored Google calendar events. */
export async function POST() {
  try { disconnectGoogle(); return ok({ disconnected: true }); } catch (err) { return errorResponse(err); }
}
