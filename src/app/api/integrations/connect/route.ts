import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { AppError, errorResponse, ok } from "@/lib/errors";
import { claudeKey, claudeModel, encryptApiKey, readConnections, saveConnections } from "@/lib/connections";
import { db } from "@/db";
import { vaultNotes } from "@/db/schema";
import { indexVault } from "@/services/obsidian";
export const runtime = "nodejs";
const Input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("claude"), key: z.string().trim().max(1000).optional(), model: z.string().trim().regex(/^claude-[a-z0-9.-]+$/).optional(), disconnect: z.boolean().optional() }),
  z.object({ kind: z.literal("vault"), dir: z.string().trim().max(2000).optional(), include: z.array(z.string().max(200)).max(50).default([]), exclude: z.array(z.string().max(200)).max(50).default([]), allowClaude: z.boolean().default(false), disconnect: z.boolean().optional() }),
]);
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, Input);
    const cfg = readConnections();
    if (input.kind === "claude") {
      const model = input.model || claudeModel();
      if (input.disconnect) { saveConnections({ ...cfg, claude: { enabled: false, model } }); return ok({ connected: false }); }
      const key = input.key || claudeKey();
      if (!key) throw new AppError("bad_request", "Enter your Anthropic API key.");
      try { await new Anthropic({ apiKey: key, timeout: 20000, maxRetries: 0 }).models.retrieve(model); }
      catch (err) {
        const status = err instanceof Anthropic.APIError ? err.status : undefined;
        throw new AppError("unprocessable", status === 401 ? "Anthropic rejected this API key. Check the key and try again." : status === 404 ? "That model is not available to this API key. Check the model ID." : status === 429 ? "Anthropic is rate-limiting requests. Try again shortly." : "Could not verify Claude. Check your connection, key and model access. Existing settings were kept.");
      }
      saveConnections({ ...cfg, claude: { enabled: true, model, encryptedKey: encryptApiKey(key), verifiedAt: new Date().toISOString() } });
      return ok({ connected: true, model });
    }
    if (input.disconnect) {
      saveConnections({ ...cfg, vault: { dir: null, include: [], exclude: [], allowClaude: false } });
      db.delete(vaultNotes).run();
      return ok({ connected: false });
    }
    if (!input.dir || !path.isAbsolute(input.dir)) throw new AppError("bad_request", "Choose the full path to your Obsidian vault folder.");
    let dir: string;
    try { dir = fs.realpathSync(input.dir); if (!fs.statSync(dir).isDirectory()) throw new Error(); fs.accessSync(dir, fs.constants.R_OK); }
    catch { throw new AppError("bad_request", "This folder does not exist or is not readable by the app."); }
    if (!fs.existsSync(path.join(dir, ".obsidian"))) throw new AppError("bad_request", "Choose the vault root: it should contain the hidden .obsidian folder.");
    const next = { ...cfg, vault: { dir, include: input.include, exclude: input.exclude, allowClaude: input.allowClaude } };
    saveConnections(next);
    try { const result = db.transaction(() => { db.delete(vaultNotes).run(); return indexVault(); }); return ok({ connected: true, result }); }
    catch { saveConnections(cfg); throw new AppError("unprocessable", "The vault could not be indexed. Existing connection settings were restored. Check folder permissions and note sizes."); }
  } catch (err) { return errorResponse(err); }
}
