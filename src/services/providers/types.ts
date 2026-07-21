/**
 * Provider-neutral interfaces for the external capabilities AgentOS uses.
 *
 * The UI and the generation queue depend only on these interfaces, never on a
 * specific vendor. A mock implementation drives the entire workflow with no
 * credentials; real adapters (OpenAI-compatible LLM, Higgsfield-compatible
 * image/video, local ffmpeg) implement the same shapes.
 */

export interface FactRef {
  field: string;
  value: string;
  source: string;
}

// ── LLM drafting / structured extraction ────────────────────────────────────

export interface LlmDraftRequest {
  promptVersion: string;
  brandVoice: string;
  goal?: string;
  creativeDirection?: string;
  /** The ONLY substrate for copy — the fact ledger. No outside knowledge. */
  facts: FactRef[];
  address: string;
}

export interface GeneratedParagraph {
  text: string;
  /** Source chips (fact provenance) backing every sentence. */
  sources: string[];
}

export interface LlmDraftResult {
  provider: string;
  model: string;
  promptVersion: string;
  paragraphs: GeneratedParagraph[];
  social: { day: string; channel: string; hook: string; asset: string }[];
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  draftCampaignCopy(req: LlmDraftRequest): Promise<LlmDraftResult>;
  /** Structured extraction from unstructured text (e.g. an alert email). */
  extract<T>(schemaName: string, input: string): Promise<T>;
  estimateCostUsd(req: LlmDraftRequest): number;
}

// ── Image / video generation (Higgsfield-compatible) ────────────────────────

export interface MediaGenRequest {
  promptVersion: string;
  prompt: string;
  /** Original asset paths that may be enhanced (e.g. virtual twilight). */
  sourceAssetPaths?: string[];
  treatment?: string; // e.g. "virtual twilight"
  format?: string; // e.g. "9:16 vertical · 0:30"
}

export interface MediaGenResult {
  provider: string;
  model: string;
  kind: "image" | "video";
  /** Workspace-relative path or manifest describing the generated asset. */
  outputPath: string;
  altered: boolean;
  disclosure?: string;
}

export interface ImageVideoProvider {
  readonly name: string;
  readonly model: string;
  generateImage(req: MediaGenRequest): Promise<MediaGenResult>;
  generateVideo(req: MediaGenRequest): Promise<MediaGenResult>;
  estimateImageCostUsd(): number;
  estimateVideoCostUsd(): number;
}

// ── Local video assembly (ffmpeg) ───────────────────────────────────────────

export interface AssembleRequest {
  format: string;
  beats: string[];
  inputPaths: string[];
  disclosure?: string;
}

export interface AssembleResult {
  assembler: string;
  /** True when a real ffmpeg render ran; false when a mock manifest was written. */
  assembled: boolean;
  outputPath: string;
  detail: string;
}

export interface VideoAssembler {
  readonly name: string;
  isAvailable(): boolean | Promise<boolean>;
  assemble(req: AssembleRequest): Promise<AssembleResult>;
}
