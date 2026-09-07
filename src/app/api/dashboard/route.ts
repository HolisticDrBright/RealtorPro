import { loadDashboard } from "@/services/dashboard";
import type { NextRequest } from "next/server";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const data = loadDashboard();
    // MCP may read CRM facts, but connecting it is not consent to disclose
    // original vault checkboxes to an external desktop agent.
    if (req.headers.has("authorization")) data.priorities = data.priorities.filter((p) => p.kind !== "vault");
    return ok(data);
  } catch (err) { return errorResponse(err); }
}
