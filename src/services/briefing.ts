import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { buildGamePlan, type GamePlan, type GamePlanInput } from "@/lib/dashboard";

/**
 * Daily briefing generator.
 *
 * With ANTHROPIC_API_KEY set, Claude writes the game plan FROM the verified
 * facts only (todos, calendar, buyers, transactions, YTD stats); without a key
 * the deterministic local plan is returned. Either way nothing is sent
 * anywhere automatically — the briefing is text for the agent to read.
 */

const MODEL = process.env.AGENTOS_CLAUDE_MODEL ?? "claude-opus-5";

const SYSTEM = [
  "You are the daily game-plan assistant inside AgentOS, a local-first workspace for a real-estate agent.",
  "Write a concise, motivating morning briefing for the agent using ONLY the facts in the supplied JSON.",
  "Rules: never invent contacts, prices, dates, or outcomes; if something is missing say so or use \"[TBD — source required]\".",
  "Never make a valuation, legal conclusion, investment guarantee, or claim of future performance.",
  "Do not draft outbound messages; suggest actions the agent takes themselves.",
  "Structure: a one-line headline, then short sections with bullet items (Protect the deals, Priorities, Schedule, Calls, Buyer touches, Off-market matches, Year to date). Plain text, no markdown headers.",
].join(" ");

export function isClaudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim();
}

export async function generateBriefing(input: GamePlanInput): Promise<GamePlan & { text: string }> {
  const local = buildGamePlan(input);
  const localText = [local.headline, ...local.sections.map((s) => `${s.title}\n${s.items.map((i) => `• ${i}`).join("\n")}`)].join("\n\n");

  if (!isClaudeConfigured()) return { ...local, text: localText };

  const client = new Anthropic();
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: `Verified facts (JSON):\n${JSON.stringify(input, null, 2)}\n\nThe deterministic plan built from the same facts, for reference:\n${localText}`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return { ...local, text: localText };
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { ...local, provider: MODEL, text: text || localText };
  } catch (err) {
    // Any API failure falls back to the local plan so the dashboard never breaks.
    console.error("[agentos] briefing: Claude call failed, using local plan:", err instanceof Error ? err.message : err);
    return { ...local, text: localText };
  }
}
