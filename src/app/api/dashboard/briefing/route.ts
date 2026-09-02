import { loadDashboardLive } from "@/services/dashboard";
import { generateBriefing, isClaudeConfigured } from "@/services/briefing";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Generate today's game plan from the live facts (local data + Google
 * calendar/inbox + Obsidian tasks when connected). Uses Claude when
 * ANTHROPIC_API_KEY is set; otherwise the deterministic local plan.
 */
export async function POST() {
  try {
    const { planInput } = await loadDashboardLive();
    const briefing = await generateBriefing(planInput);
    writeAudit({ action: "dashboard.briefing", metadata: { provider: briefing.provider, claudeConfigured: isClaudeConfigured(), inbox: planInput.inbox?.length ?? 0, vaultTasks: planInput.vaultTasks?.length ?? 0 } });
    return ok({ briefing });
  } catch (err) {
    return errorResponse(err);
  }
}
