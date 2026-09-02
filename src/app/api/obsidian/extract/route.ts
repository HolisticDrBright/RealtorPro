import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { extractRecordsFromNotes, isClaudeConfigured } from "@/services/claude";
import { vaultConfig, vaultNoteTexts } from "@/services/obsidian";
import { applyImport } from "@/services/importer";
import { AppError, errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/**
 * Claude reads your vault notes and proposes records (preview only). Off by
 * default: note text leaves your machine for the Anthropic API, so it needs
 * OBSIDIAN_ALLOW_CLAUDE=true in .env. Nothing is saved until /api/import/apply.
 */
export async function POST(req: NextRequest) {
  try {
    const { folder, limit } = await readJson(req, z.object({ folder: z.string().optional(), limit: z.number().int().min(1).max(400).default(200) }));
    if (!isClaudeConfigured()) throw new AppError("unprocessable", "Add ANTHROPIC_API_KEY to .env and restart to let Claude read the vault.");
    if (!vaultConfig().allowClaude) throw new AppError("unprocessable", "Set OBSIDIAN_ALLOW_CLAUDE=true in .env (and restart) to allow note text to be sent to Claude.");
    const notes = vaultNoteTexts({ folder, limit });
    if (notes.length === 0) throw new AppError("unprocessable", "No notes found to read. Check OBSIDIAN_VAULT_DIR and the folder filter.");
    const { bundle, model, batches } = await extractRecordsFromNotes(notes);
    return ok({ bundle, model, batches, notesRead: notes.length, notes: notes.map((n) => ({ path: n.path, title: n.title })), preview: applyImport(bundle, { dryRun: true, source: "Obsidian via Claude" }) });
  } catch (err) { return errorResponse(err); }
}
