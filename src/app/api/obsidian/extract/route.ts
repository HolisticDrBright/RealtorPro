import type { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { extractRecordsFromNotes, isClaudeConfigured } from "@/services/claude";
import { vaultConfig, vaultNoteTexts } from "@/services/obsidian";
import { proposeImport } from "@/services/reviews";
import { AppError, errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/**
 * Claude reads your vault notes and proposes records (preview only). Off by
 * default: note text leaves your machine for the Anthropic API, so it needs
 * OBSIDIAN_ALLOW_CLAUDE=true in .env. Nothing is saved until /api/import/apply.
 */
export async function POST(req: NextRequest) {
  try {
    const { folder, limit } = await readJson(req, z.object({ folder: z.string().optional(), limit: z.number().int().min(1).max(50).default(20) }));
    if (!isClaudeConfigured()) throw new AppError("unprocessable", "Connect Claude on the Integrations page first.");
    if (!vaultConfig().allowClaude) throw new AppError("unprocessable", "Enable vault-to-Claude permission in Integrations, then save the vault connection.");
    const notes = vaultNoteTexts({ folder, limit });
    if (notes.length === 0) throw new AppError("unprocessable", "No notes found to read. Check OBSIDIAN_VAULT_DIR and the folder filter.");
    const { bundle, model, batches } = await extractRecordsFromNotes(notes);
    return ok({ bundle, model, batches, notesRead: notes.length, notes: notes.map((n) => ({ path: n.path, title: n.title })), ...proposeImport(bundle, "Obsidian via Claude") });
  } catch (err) { return errorResponse(err); }
}
