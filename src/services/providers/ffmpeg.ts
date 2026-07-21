import "server-only";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { AssembleRequest, AssembleResult, VideoAssembler } from "./types";
import { GENERATED_DIR } from "@/lib/paths";
import { safeJoin } from "@/lib/storage";

/**
 * Local ffmpeg video assembler.
 *
 * If an ffmpeg binary is available (FFMPEG_PATH or on PATH), it assembles the
 * storyboard beats into a real file. If not, it DEGRADES GRACEFULLY: it writes a
 * JSON manifest describing the intended render so the workflow still completes
 * locally without ffmpeg installed.
 */
export class FfmpegAssembler implements VideoAssembler {
  readonly name = "ffmpeg-local";

  private binary(): string {
    return process.env.FFMPEG_PATH?.trim() || "ffmpeg";
  }

  isAvailable(): boolean {
    try {
      const res = spawnSync(this.binary(), ["-version"], { stdio: "ignore" });
      return res.status === 0;
    } catch {
      return false;
    }
  }

  async assemble(req: AssembleRequest): Promise<AssembleResult> {
    fs.mkdirSync(GENERATED_DIR, { recursive: true });
    const stamp = Date.now().toString(36);

    if (this.isAvailable() && req.inputPaths.length > 0) {
      const outPath = safeJoin("generated", `listing-video-${stamp}.mp4`);
      // A minimal slideshow: concatenate input images at ~2s each. Real projects
      // would build a filtergraph from the beats; this keeps the local path real.
      const listFile = safeJoin("generated", `concat-${stamp}.txt`);
      const lines = req.inputPaths
        .map((p) => `file '${p.replace(/'/g, "")}'\nduration 2`)
        .join("\n");
      fs.writeFileSync(listFile, lines);
      const res = spawnSync(
        this.binary(),
        ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-vf", "scale=1080:-2", outPath],
        { stdio: "ignore" },
      );
      fs.rmSync(listFile, { force: true });
      if (res.status === 0) {
        return {
          assembler: this.name,
          assembled: true,
          outputPath: path.relative(path.dirname(GENERATED_DIR), outPath),
          detail: `Rendered ${req.inputPaths.length} clips at ${req.format}.`,
        };
      }
    }

    // Fallback: write a manifest describing the intended assembly.
    const manifestPath = safeJoin("generated", `video-manifest-${stamp}.json`);
    const manifest = {
      note: "ffmpeg not available — mock manifest. Install ffmpeg or set FFMPEG_PATH to render.",
      format: req.format,
      beats: req.beats,
      inputPaths: req.inputPaths,
      disclosure: req.disclosure,
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    return {
      assembler: this.name,
      assembled: false,
      outputPath: path.relative(path.dirname(GENERATED_DIR), manifestPath),
      detail: "ffmpeg not found — wrote a mock render manifest.",
    };
  }
}
