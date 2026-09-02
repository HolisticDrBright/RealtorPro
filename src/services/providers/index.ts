import "server-only";
import type { ImageVideoProvider, LlmProvider, VideoAssembler } from "./types";
import { MockImageVideoProvider, MockLlmProvider } from "./mock-generation";
import { OpenAiCompatibleLlm } from "./llm";
import { HiggsfieldProvider } from "./image-video";
import { FfmpegAssembler } from "./ffmpeg";
import { AnthropicLlmProvider } from "./anthropic";

/**
 * Provider factory. Selection is driven by env; the default everywhere is the
 * credential-free mock so the full workflow runs locally. Real providers are
 * only constructed when explicitly selected.
 */

export function getLlmProvider(): LlmProvider {
  const sel = process.env.AGENTOS_LLM_PROVIDER ?? "mock";
  if (sel === "anthropic" || sel === "claude") return new AnthropicLlmProvider();
  if (sel === "openai-compatible") {
    return new OpenAiCompatibleLlm();
  }
  return new MockLlmProvider();
}

export function getImageVideoProvider(): ImageVideoProvider {
  if ((process.env.AGENTOS_MEDIA_PROVIDER ?? "mock") === "higgsfield") {
    return new HiggsfieldProvider();
  }
  return new MockImageVideoProvider();
}

export function getVideoAssembler(): VideoAssembler {
  return new FfmpegAssembler();
}

export function providerSummary() {
  return {
    llm: process.env.AGENTOS_LLM_PROVIDER ?? "mock",
    media: process.env.AGENTOS_MEDIA_PROVIDER ?? "mock",
    videoAssembly: process.env.AGENTOS_VIDEO_ASSEMBLY ?? "ffmpeg-detect",
  };
}

export * from "./types";
