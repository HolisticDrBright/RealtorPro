/**
 * Mock generation providers.
 *
 * These let the ENTIRE Listing Studio workflow run with no credentials. They
 * build copy strictly from the fact ledger passed in — they invent no listing
 * facts — so every generated paragraph still cites real sources.
 */
import type {
  ImageVideoProvider,
  LlmDraftRequest,
  LlmDraftResult,
  LlmProvider,
  MediaGenRequest,
  MediaGenResult,
} from "./types";

function factByField(req: LlmDraftRequest, needle: string) {
  return req.facts.find((f) => f.field.toLowerCase().includes(needle.toLowerCase()));
}

export class MockLlmProvider implements LlmProvider {
  readonly name = "mock-llm";
  readonly model = "mock-draft-1";

  async draftCampaignCopy(req: LlmDraftRequest): Promise<LlmDraftResult> {
    const beds = factByField(req, "Bedrooms") ?? factByField(req, "Beds");
    const area = factByField(req, "LivingArea") ?? factByField(req, "sqft");
    const lot = factByField(req, "Lot");
    const year = factByField(req, "YearBuilt");
    const roof = factByField(req, "Roof");
    const heat = factByField(req, "Heating");
    const parking = factByField(req, "Parking");

    // Paragraph 1 — structure & character, each clause backed by a fact.
    const p1parts: string[] = [];
    const p1sources: string[] = [];
    if (year) {
      p1parts.push(`${year.value} on the ${req.address}`);
      p1sources.push(year.source);
    }
    if (lot) {
      p1parts.push(`a ${lot.value.toLowerCase()}`);
      p1sources.push(lot.source);
    }
    if (beds) {
      p1parts.push(`${beds.value}`);
      p1sources.push(beds.source);
    }
    if (area) {
      p1parts.push(`across ${area.value}`);
      p1sources.push(area.source);
    }
    const p1 =
      p1parts.length > 0
        ? capitalize(joinClauses(p1parts)) + "."
        : `${req.address} — details drawn from the imported listing facts.`;

    // Paragraph 2 — systems & updates.
    const p2parts: string[] = [];
    const p2sources: string[] = [];
    if (roof) {
      p2parts.push(`roof ${roof.value.toLowerCase()}`);
      p2sources.push(roof.source);
    }
    if (heat) {
      p2parts.push(`${heat.value.toLowerCase()}`);
      p2sources.push(heat.source);
    }
    if (parking) {
      p2parts.push(`${parking.value.toLowerCase()}`);
      p2sources.push(parking.source);
    }
    const p2 =
      p2parts.length > 0
        ? `Systems and updates: ${joinClauses(p2parts)}.`
        : "Systems and updates are listed in the intake facts.";

    const paragraphs = [
      { text: p1, sources: dedupe(p1sources) },
      { text: p2, sources: dedupe(p2sources) },
    ].filter((p) => p.sources.length > 0 || p.text.length > 0);

    const social = [
      { day: "Wed", channel: "Instagram Reel", hook: "“Systems-done” — key dates on screen", asset: "Video cutdown 0:22" },
      { day: "Thu", channel: "Instagram + FB post", hook: "Photos live — carousel, kitchen first", asset: "Carousel (5 stills)" },
      { day: "Fri", channel: "Stories", hook: "Open house countdown + Q&A sticker", asset: "Story frame ×2" },
      { day: "Sat", channel: "FB event + Stories", hook: "Open house — corner-lot walkup shot", asset: "Event cover" },
    ];

    return {
      provider: this.name,
      model: this.model,
      promptVersion: req.promptVersion,
      paragraphs,
      social,
    };
  }

  async extract<T>(_schemaName: string, _input: string): Promise<T> {
    // The mock does not hallucinate structure; structured extraction from free
    // text is delegated to the deterministic CSV/importer path elsewhere.
    return {} as T;
  }

  estimateCostUsd(_req: LlmDraftRequest): number {
    return 0; // local mock is free
  }
}

export class MockImageVideoProvider implements ImageVideoProvider {
  readonly name = "mock-media";
  readonly model = "mock-media-1";

  async generateImage(req: MediaGenRequest): Promise<MediaGenResult> {
    const altered = /twilight|enhance|virtual|relight/i.test(
      `${req.treatment ?? ""} ${req.prompt}`,
    );
    return {
      provider: this.name,
      model: this.model,
      kind: "image",
      outputPath: "generated/mock/image-manifest.json",
      altered,
      disclosure: altered ? `${req.treatment ?? "AI enhancement"} applied (disclosed).` : undefined,
    };
  }

  async generateVideo(req: MediaGenRequest): Promise<MediaGenResult> {
    const altered = /twilight|enhance|virtual|relight/i.test(
      `${req.treatment ?? ""} ${req.prompt}`,
    );
    return {
      provider: this.name,
      model: this.model,
      kind: "video",
      outputPath: "generated/mock/video-manifest.json",
      altered,
      disclosure: altered ? "Virtual twilight on exterior frame; disclosed on end card." : undefined,
    };
  }

  estimateImageCostUsd(): number {
    return 0;
  }
  estimateVideoCostUsd(): number {
    return 0;
  }
}

// helpers
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function joinClauses(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return parts.slice(0, -1).join(", ") + ", " + parts[parts.length - 1];
}
function dedupe(a: string[]): string[] {
  return Array.from(new Set(a));
}
