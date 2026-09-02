import { loadDashboard } from "@/services/dashboard";
import { isClaudeConfigured } from "@/services/briefing";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** One-shot dashboard payload: game plan, todos, calls, calendar, buyers, pipeline, YTD, off-market matches, contacts. */
export async function GET() {
  try {
    const data = loadDashboard();
    return ok({ ...data, claudeConfigured: isClaudeConfigured() });
  } catch (err) {
    return errorResponse(err);
  }
}
