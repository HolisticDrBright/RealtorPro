import "server-only";
import fs from "node:fs";
import { GENERATED_DIR } from "@/lib/paths";
import { safeJoin } from "@/lib/storage";
import { AppError } from "@/lib/errors";
import type { BoundaryStyle } from "@/lib/boundary";

/**
 * Provider-neutral interfaces for the Development Visualizer.
 *
 *   MediaGenerationProvider — still images from authorized inputs
 *   VideoGenerationProvider — concept videos / reels
 *   MapOverlayProvider      — boundary overlays (only from verified sources)
 *
 * A local MOCK implements all three so the whole workflow demos with no
 * credentials. A Higgsfield-compatible adapter is provided behind env vars but
 * the app never depends on it.
 */

export interface MediaGenRequest {
  prompt: string;
  visualDirection: string;
  format: string;
  sourceAssetPaths?: string[];
  altered?: boolean;
}
export interface VideoGenRequest extends MediaGenRequest {
  durationSec: number;
  cameraMovement: string;
  scenes: string[];
}
export interface OverlayRequest {
  style: Exclude<BoundaryStyle, "none">;
  basis: string;
  baseImagePath?: string;
}

export interface GenResult {
  provider: string;
  model: string;
  kind: "image" | "video";
  outputPath: string;
  altered: boolean;
  detail: string;
}
export interface OverlayResult {
  provider: string;
  outputPath: string;
  style: BoundaryStyle;
  basis: string;
}

export interface MediaGenerationProvider {
  readonly name: string;
  readonly model: string;
  generateImage(req: MediaGenRequest): Promise<GenResult>;
  estimateCostUsd(req: MediaGenRequest): number;
}
export interface VideoGenerationProvider {
  readonly name: string;
  readonly model: string;
  generateVideo(req: VideoGenRequest): Promise<GenResult>;
  estimateCostUsd(req: VideoGenRequest): number;
}
export interface MapOverlayProvider {
  readonly name: string;
  generateBoundaryOverlay(req: OverlayRequest): Promise<OverlayResult>;
}

function writeManifest(prefix: string, data: unknown): string {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const rel = `generated/${prefix}-${cheapId()}.json`;
  const abs = safeJoin(rel.replace(/^generated\//, "generated/"));
  fs.writeFileSync(abs, JSON.stringify(data, null, 2));
  return rel;
}
let counter = 0;
function cheapId() {
  counter += 1;
  return `${counter.toString(36)}${(counter * 2654435761 % 1000000).toString(36)}`;
}

// ── Mock providers ───────────────────────────────────────────────────────────

export class MockMediaProvider implements MediaGenerationProvider {
  readonly name = "mock-media";
  readonly model = "mock-image-1";
  async generateImage(req: MediaGenRequest): Promise<GenResult> {
    return {
      provider: this.name,
      model: this.model,
      kind: "image",
      outputPath: writeManifest("viz-image", { req, note: "Mock concept image manifest — no external generation." }),
      altered: req.altered ?? true,
      detail: `Mock concept image (${req.format}, ${req.visualDirection}).`,
    };
  }
  estimateCostUsd(): number {
    return 0;
  }
}

export class MockVideoProvider implements VideoGenerationProvider {
  readonly name = "mock-video";
  readonly model = "mock-video-1";
  async generateVideo(req: VideoGenRequest): Promise<GenResult> {
    return {
      provider: this.name,
      model: this.model,
      kind: "video",
      outputPath: writeManifest("viz-video", { req, note: "Mock concept video manifest — no external generation." }),
      altered: true,
      detail: `Mock concept video (${req.format}, ${req.durationSec}s, ${req.scenes.length} scenes).`,
    };
  }
  estimateCostUsd(req: VideoGenRequest): number {
    return 0 * req.durationSec;
  }
}

export class MockMapOverlayProvider implements MapOverlayProvider {
  readonly name = "mock-overlay";
  async generateBoundaryOverlay(req: OverlayRequest): Promise<OverlayResult> {
    return {
      provider: this.name,
      outputPath: writeManifest("viz-overlay", { req, note: "Mock boundary overlay manifest — derived from a verified source." }),
      style: req.style,
      basis: req.basis,
    };
  }
}

// ── Higgsfield-compatible adapters (behind env; never required) ──────────────

class HiggsfieldBase {
  protected baseUrl = (process.env.HIGGSFIELD_BASE_URL ?? "").replace(/\/$/, "");
  protected apiKey = process.env.HIGGSFIELD_API_KEY ?? "";
  protected assertConfigured() {
    if (!this.baseUrl || !this.apiKey) {
      throw new AppError(
        "provider_error",
        "Higgsfield is selected but HIGGSFIELD_BASE_URL / HIGGSFIELD_API_KEY are not set. Use the mock provider for local development.",
      );
    }
  }
}

export class HiggsfieldMediaProvider extends HiggsfieldBase implements MediaGenerationProvider {
  readonly name = "higgsfield-media";
  readonly model = "higgsfield-image";
  async generateImage(req: MediaGenRequest): Promise<GenResult> {
    this.assertConfigured();
    const res = await fetch(`${this.baseUrl}/v1/images`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new AppError("provider_error", `Higgsfield returned ${res.status}.`);
    const data = (await res.json()) as { output_url?: string };
    return { provider: this.name, model: this.model, kind: "image", outputPath: data.output_url ?? "", altered: true, detail: "Higgsfield image." };
  }
  estimateCostUsd(): number {
    return 0.08;
  }
}

export class HiggsfieldVideoProvider extends HiggsfieldBase implements VideoGenerationProvider {
  readonly name = "higgsfield-video";
  readonly model = "higgsfield-video";
  async generateVideo(req: VideoGenRequest): Promise<GenResult> {
    this.assertConfigured();
    const res = await fetch(`${this.baseUrl}/v1/videos`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(req),
    });
    if (!res.ok) throw new AppError("provider_error", `Higgsfield returned ${res.status}.`);
    const data = (await res.json()) as { output_url?: string };
    return { provider: this.name, model: this.model, kind: "video", outputPath: data.output_url ?? "", altered: true, detail: "Higgsfield video." };
  }
  estimateCostUsd(req: VideoGenRequest): number {
    return 0.05 * req.durationSec;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────────

const isHiggsfieldSelected = () => (process.env.AGENTOS_MEDIA_PROVIDER ?? "mock") === "higgsfield";

export function getMediaProvider(): MediaGenerationProvider {
  return isHiggsfieldSelected() ? new HiggsfieldMediaProvider() : new MockMediaProvider();
}
export function getVideoProvider(): VideoGenerationProvider {
  return isHiggsfieldSelected() ? new HiggsfieldVideoProvider() : new MockVideoProvider();
}
export function getMapOverlayProvider(): MapOverlayProvider {
  return new MockMapOverlayProvider();
}
