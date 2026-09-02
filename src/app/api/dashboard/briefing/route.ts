import { loadDashboard } from "@/services/dashboard";
import { generateBriefing, isClaudeConfigured } from "@/services/briefing";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Generate today's game plan. Uses Claude when ANTHROPIC_API_KEY is set (facts
 * only, nothing sent to clients); otherwise the deterministic local plan.
 */
export async function POST() {
  try {
    const { planInput } = loadDashboard();
    const briefing = await generateBriefing(planInput);
    writeAudit({ action: "dashboard.briefing", metadata: { provider: briefing.provider, claudeConfigured: isClaudeConfigured() } });
    return ok({ briefing });
  } catch (err) {
    return errorResponse(err);
  }
}
