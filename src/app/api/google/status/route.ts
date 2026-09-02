import { googleStatus } from "@/services/google";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET() {
  try { return ok(googleStatus()); } catch (err) { return errorResponse(err); }
}
