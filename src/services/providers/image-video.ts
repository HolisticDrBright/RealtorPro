/**
 * Higgsfield-compatible image/video generation adapter.
 *
 * Typed against a generic "submit job → poll for result" REST shape so it can
 * target a Higgsfield-compatible endpoint. Used only when
 * AGENTOS_MEDIA_PROVIDER=higgsfield and remote generation is approved; otherwise
 * the mock media provider runs.
 */
import type {
  ImageVideoProvider,
  MediaGenRequest,
  MediaGenResult,
} from "./types";
import { AppError } from "@/lib/errors";

interface HiggsSubmitResponse {
  id: string;
}
interface HiggsStatusResponse {
  status: "queued" | "running" | "succeeded" | "failed";
  output_url?: string;
  error?: string;
}

export class HiggsfieldProvider implements ImageVideoProvider {
  readonly name = "higgsfield";
  readonly model = "higgsfield-default";
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = (process.env.HIGGSFIELD_BASE_URL ?? "").replace(/\/$/, "");
    this.apiKey = process.env.HIGGSFIELD_API_KEY ?? "";
  }

  private assertConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      throw new AppError(
        "provider_error",
        "Higgsfield is selected but HIGGSFIELD_BASE_URL / HIGGSFIELD_API_KEY are not set. Use the mock media provider for local development.",
      );
    }
  }

  private async submit(kind: "image" | "video", req: MediaGenRequest): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/${kind}s`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        prompt: req.prompt,
        treatment: req.treatment,
        format: req.format,
        init_images: req.sourceAssetPaths,
      }),
    });
    if (!res.ok) throw new AppError("provider_error", `Higgsfield submit returned ${res.status}.`);
    return ((await res.json()) as HiggsSubmitResponse).id;
  }

  private async poll(kind: "image" | "video", jobId: string): Promise<string> {
    for (let i = 0; i < 60; i++) {
      const res = await fetch(`${this.baseUrl}/v1/${kind}s/${jobId}`, {
        headers: { authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) throw new AppError("provider_error", `Higgsfield status returned ${res.status}.`);
      const data = (await res.json()) as HiggsStatusResponse;
      if (data.status === "succeeded" && data.output_url) return data.output_url;
      if (data.status === "failed") {
        throw new AppError("provider_error", `Higgsfield job failed: ${data.error ?? "unknown"}.`);
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new AppError("provider_error", "Higgsfield job timed out.");
  }

  private altered(req: MediaGenRequest): boolean {
    return /twilight|enhance|virtual|relight|replace/i.test(`${req.treatment ?? ""} ${req.prompt}`);
  }

  async generateImage(req: MediaGenRequest): Promise<MediaGenResult> {
    this.assertConfigured();
    const id = await this.submit("image", req);
    const url = await this.poll("image", id);
    const altered = this.altered(req);
    return {
      provider: this.name,
      model: this.model,
      kind: "image",
      outputPath: url,
      altered,
      disclosure: altered ? `${req.treatment ?? "AI enhancement"} applied (disclosed).` : undefined,
    };
  }

  async generateVideo(req: MediaGenRequest): Promise<MediaGenResult> {
    this.assertConfigured();
    const id = await this.submit("video", req);
    const url = await this.poll("video", id);
    const altered = this.altered(req);
    return {
      provider: this.name,
      model: this.model,
      kind: "video",
      outputPath: url,
      altered,
      disclosure: altered ? "Virtual twilight on exterior frame; disclosed on end card." : undefined,
    };
  }

  estimateImageCostUsd(): number {
    return 0.08;
  }
  estimateVideoCostUsd(): number {
    return 1.2;
  }
}
