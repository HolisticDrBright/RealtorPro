/**
 * OpenAI-compatible LLM adapter (drafting + structured extraction).
 *
 * Reads AGENTOS_LLM_BASE_URL / AGENTOS_LLM_API_KEY / AGENTOS_LLM_MODEL. This is
 * a real, typed adapter, but it is only used when AGENTOS_LLM_PROVIDER is set to
 * a remote value AND the operator has approved remote generation. With no key,
 * AgentOS uses the mock provider instead.
 */
import type {
  LlmDraftRequest,
  LlmDraftResult,
  LlmProvider,
} from "./types";
import { AppError } from "@/lib/errors";

interface OpenAiChatResponse {
  choices?: { message?: { content?: string } }[];
}

export class OpenAiCompatibleLlm implements LlmProvider {
  readonly name = "openai-compatible";
  readonly model: string;
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = (process.env.AGENTOS_LLM_BASE_URL ?? "").replace(/\/$/, "");
    this.apiKey = process.env.AGENTOS_LLM_API_KEY ?? "";
    this.model = process.env.AGENTOS_LLM_MODEL ?? "gpt-4o-mini";
  }

  private assertConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      throw new AppError(
        "provider_error",
        "The remote LLM provider is selected but AGENTOS_LLM_BASE_URL / AGENTOS_LLM_API_KEY are not set. Use the mock provider for local development.",
      );
    }
  }

  private systemPrompt(req: LlmDraftRequest): string {
    return [
      `You are a real-estate copywriter. Brand voice: "${req.brandVoice}".`,
      req.goal ? `Campaign goal: ${req.goal}.` : "",
      "STRICT RULE: use ONLY the provided listing facts. Never invent a fact.",
      "Every sentence must be supported by one or more of the given fact sources.",
      req.creativeDirection ? `Creative direction: ${req.creativeDirection}` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  async draftCampaignCopy(req: LlmDraftRequest): Promise<LlmDraftResult> {
    this.assertConfigured();
    const factLines = req.facts.map((f) => `- ${f.field}: ${f.value} [${f.source}]`).join("\n");
    const user = `Address: ${req.address}\nFacts:\n${factLines}\n\nWrite 2 short MLS paragraphs. Return JSON: {"paragraphs":[{"text":"...","sources":["..."]}],"social":[{"day","channel","hook","asset"}]}`;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: this.systemPrompt(req) },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });
    if (!res.ok) {
      throw new AppError("provider_error", `LLM provider returned ${res.status}.`);
    }
    const data = (await res.json()) as OpenAiChatResponse;
    const content = data.choices?.[0]?.message?.content ?? "{}";
    let parsed: Pick<LlmDraftResult, "paragraphs" | "social">;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new AppError("provider_error", "LLM returned malformed JSON.");
    }
    return {
      provider: this.name,
      model: this.model,
      promptVersion: req.promptVersion,
      paragraphs: parsed.paragraphs ?? [],
      social: parsed.social ?? [],
    };
  }

  async extract<T>(schemaName: string, input: string): Promise<T> {
    this.assertConfigured();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: "system", content: `Extract structured "${schemaName}" JSON from the input. Do not invent values.` },
          { role: "user", content: input },
        ],
        response_format: { type: "json_object" },
        temperature: 0,
      }),
    });
    if (!res.ok) throw new AppError("provider_error", `LLM provider returned ${res.status}.`);
    const data = (await res.json()) as OpenAiChatResponse;
    return JSON.parse(data.choices?.[0]?.message?.content ?? "{}") as T;
  }

  estimateCostUsd(req: LlmDraftRequest): number {
    // Rough token estimate for a preflight. Real usage is billed by the vendor.
    const approxTokens = 400 + req.facts.length * 40;
    return Number(((approxTokens / 1000) * 0.01).toFixed(4));
  }
}
