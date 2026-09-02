import { loadDashboard } from "@/services/dashboard";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET() { try { return ok(loadDashboard()); } catch (err) { return errorResponse(err); } }
