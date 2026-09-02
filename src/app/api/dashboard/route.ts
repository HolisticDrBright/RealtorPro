import { loadDashboardLive } from "@/services/dashboard";
import { isClaudeConfigured } from "@/services/briefing";
import { vaultStatus } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** One-shot dashboard payload with live context (vault changes, Google calendar/inbox when connected). */
export async function GET() {
  try {
    const data = await loadDashboardLive();
    return ok({ ...data, claudeConfigured: isClaudeConfigured(), obsidianConfigured: vaultStatus().exists });
  } catch (err) {
    return errorResponse(err);
  }
}
