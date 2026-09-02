import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LlmDraftRequest, LlmDraftResult, LlmProvider } from "./types";
import { AppError } from "@/lib/errors";

/**
 * Claude (Anthropic SDK) as the app's LLM provider — drafting from the fact
 * ledger and structured extraction from pasted text. Selected with
 * AGENTOS_LLM_PROVIDER=anthropic and ANTHROPIC_API_KEY. Every prompt restricts
 * Claude to the supplied facts and requires "[TBD — source required]" for gaps.
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = "anthropic";
  readonly model = process.env.AGENTOS_CLAUDE_MODEL ?? "claude-opus-5";
  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      throw new AppError("provider_error", "Claude is selected but ANTHROPIC_API_KEY is not set. Add it to .env or switch AGENTOS_LLM_PROVIDER back to mock.");
    }
    return (this.client ??= new Anthropic());
  }

  private async json<T>(system: string, user: string): Promise<T> {
    const res = await this.getClient().messages.create({
      model: this.model,
      max_tokens: 8000,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    if (res.stop_reason === "refusal") throw new AppError("provider_error", "Claude declined this request.");
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n");
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      throw new AppError("provider_error", "Claude returned a response that was not valid JSON.");
    }
  }

  async draftCampaignCopy(req: LlmDraftRequest): Promise<LlmDraftResult> {
    const system = [
      `You write real-estate marketing copy in the brand voice "${req.brandVoice}".`,
      req.goal ? `Campaign goal: ${req.goal}.` : "",
      "STRICT: use ONLY the listing facts provided. Never invent a fact, number, or feature. Where information is missing write \"[TBD — source required]\".",
      "No steering or protected-class language (Fair Housing). No valuations or guarantees.",
      'Respond with JSON only: {"paragraphs":[{"text":"...","sources":["<source of each fact used>"]}],"social":[{"day":"Wed","channel":"...","hook":"...","asset":"..."}]}',
      req.creativeDirection ? `Creative direction from the agent: ${req.creativeDirection}` : "",
    ].filter(Boolean).join(" ");
    const facts = req.facts.map((f) => `- ${f.field}: ${f.value} [source: ${f.source}]`).join("\n");
    const out = await this.json<Pick<LlmDraftResult, "paragraphs" | "social">>(system, `Address: ${req.address}\nFacts:\n${facts}\n\nWrite two short MLS paragraphs and a 4-post social plan.`);
    return { provider: this.name, model: this.model, promptVersion: req.promptVersion, paragraphs: out.paragraphs ?? [], social: out.social ?? [] };
  }

  async extract<T>(schemaName: string, input: string): Promise<T> {
    const schemas: Record<string, string> = {
      listings:
        'JSON only: {"listings":[{"address":"","price":"","beds":"","baths":"","sqft":"","mlsNumber":"","remarks":""}]} — one entry per property found. Leave a field "" when it is not stated; never guess.',
    };
    const system = `Extract structured data from the user's pasted text. Do not invent values. ${schemas[schemaName] ?? `Respond with JSON matching the "${schemaName}" schema.`}`;
    return this.json<T>(system, input);
  }

  estimateCostUsd(req: LlmDraftRequest): number {
    const approxTokens = 600 + req.facts.length * 40;
    return Number(((approxTokens / 1e6) * 5 + (1200 / 1e6) * 25).toFixed(4));
  }
}
