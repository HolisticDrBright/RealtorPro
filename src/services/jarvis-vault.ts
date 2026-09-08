import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { vaultConfig } from "./obsidian";
import { shouldIndex, obsidianUri } from "@/lib/obsidian";
import { AppError } from "@/lib/errors";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const fail = (text: string) => new AppError("unprocessable", text);
function permitted() {
  const cfg = vaultConfig();
  if (!cfg.dir || !cfg.exists) throw fail("Connect your Obsidian vault in Integrations first.");
  if (!cfg.allowClaude) throw fail("Enable Allow selected vault text in Integrations before Jarvis can use your vault.");
  return { ...cfg, dir: fs.realpathSync(cfg.dir), vaultId: hash(JSON.stringify([fs.realpathSync(cfg.dir), cfg.include, cfg.exclude])) };
}
export function jarvisVaultPath(rel: string) {
  const cfg = permitted();
  if (!rel || rel.includes("\\") || rel.includes(":") || rel.includes("\0") || rel.startsWith("/") || rel.split("/").some((s) => !s || s.startsWith(".") || s === ".." || /[<>|?*]/.test(s)) || !shouldIndex(rel, cfg.include, cfg.exclude)) throw fail("Choose an allowed Markdown note using a vault-relative path. Hidden, excluded and linked files are not accessible.");
  let abs = cfg.dir;
  for (const segment of rel.split("/")) { abs = path.join(abs, segment); if (fs.existsSync(abs) && fs.lstatSync(abs).isSymbolicLink()) throw fail("Linked files and folders are not accessible."); }
  if (!abs.startsWith(cfg.dir + path.sep)) throw fail("The note must stay inside the connected vault.");
  return { ...cfg, abs, rel };
}
export function readJarvisVaultNote(rel: string, offset = 0, limit = 16000) {
  z.number().int().min(0).max(2000000).parse(offset); z.number().int().min(1).max(20000).parse(limit);
  const cfg = jarvisVaultPath(rel);
  if (!fs.existsSync(cfg.abs) || !fs.statSync(cfg.abs).isFile()) throw fail("That vault note does not exist.");
  if (fs.statSync(cfg.abs).size > 2_000_000) throw fail("Split this note into files smaller than 2 MB before reading it with Jarvis.");
  const text = fs.readFileSync(cfg.abs, "utf8");
  return { path: rel, text: text.slice(offset, offset + limit), sha256: hash(text), totalCharacters: text.length, nextOffset: offset + limit < text.length ? offset + limit : null, uri: obsidianUri(path.basename(cfg.dir), rel), vaultId: cfg.vaultId };
}
export function searchJarvisVault(raw: unknown) {
  const input = z.object({ query: z.string().max(200).default(""), offset: z.number().int().min(0).max(25000).default(0) }).strict().parse(raw);
  const cfg = permitted(), files: string[] = []; let entries = 0;
  function walk(rel = "", depth = 0) {
    if (depth > 30) throw fail("Vault folders are nested too deeply. Select a smaller vault.");
    for (const e of fs.readdirSync(path.join(cfg.dir, rel), { withFileTypes: true })) {
      if (++entries > 25000) throw fail("Vault contains more than 25,000 entries. Select a smaller vault.");
      if (e.name.startsWith(".") || e.isSymbolicLink()) continue;
      const next = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) walk(next, depth + 1); else if (shouldIndex(next, cfg.include, cfg.exclude)) files.push(next);
    }
  }
  walk(); files.sort(); const words = input.query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = []; let next = input.offset, scanned = 0;
  while (next < files.length && scanned++ < 100 && matches.length < 10) {
    const rel = files[next++];
    const note = readJarvisVaultNote(rel, 0, 20000);
    if (words.every((word) => (rel + " " + note.text).toLowerCase().includes(word))) matches.push({ path: rel, excerpt: note.text.slice(0, 600), sha256: note.sha256, uri: note.uri, contentTruncated: note.nextOffset !== null });
  }
  return { matches, nextOffset: next < files.length ? next : null, totalFiles: files.length, warning: "Search checks at most 100 notes per page and the first 20,000 characters per note. Follow nextOffset and read matching notes in full before updating." };
}
export const VaultWriteProposal = z.object({ action: z.literal("vault_write"), path: z.string().min(1).max(1000), content: z.string().max(100000), expectedHash: z.string().regex(/^[a-f0-9]{64}$/).nullable(), vaultId: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export function prepareVaultWrite(rel: string, content: string, expectedHash: string | null) {
  const cfg = jarvisVaultPath(rel);
  const p = VaultWriteProposal.parse({ action: "vault_write", path: rel, content, expectedHash, vaultId: cfg.vaultId });
  validateVaultWrite(p); return p;
}
export function validateVaultWrite(p: z.infer<typeof VaultWriteProposal>, retry = false) {
  VaultWriteProposal.parse(p); const cfg = jarvisVaultPath(p.path);
  if (cfg.vaultId !== p.vaultId) throw fail("The vault or folder privacy rules changed. Generate a fresh proposal.");
  let before: string | null = null;
  if (fs.existsSync(cfg.abs)) { if (!fs.statSync(cfg.abs).isFile() || fs.statSync(cfg.abs).size > 400000) throw fail("This note is too large to edit safely. Use a smaller note."); before = fs.readFileSync(cfg.abs, "utf8"); if (before.length > 100000) throw fail("This note is too large to edit safely. Use a smaller note."); }
  if (retry && before === p.content) return { path: p.path, before, after: p.content, unchanged: true };
  if ((before === null ? null : hash(before)) !== p.expectedHash) throw fail("The vault note changed since Jarvis read it, or already exists. Read it again and make a fresh proposal.");
  return { path: p.path, before, after: p.content, unchanged: false };
}
export function applyVaultWrite(p: z.infer<typeof VaultWriteProposal>, reviewId: string) {
  z.string().uuid().parse(reviewId);
  const preview = validateVaultWrite(p, true); if (preview.unchanged) return { path: p.path, recovered: true };
  const cfg = jarvisVaultPath(p.path);
  const backupDir = path.resolve(process.env.WORKSPACE_DIR || "./workspace", "backups", "vault"); fs.mkdirSync(backupDir, { recursive: true });
  const backupFile = path.join(backupDir, reviewId + ".json");
  if (!fs.existsSync(backupFile)) fs.writeFileSync(backupFile, JSON.stringify({ path: p.path, vaultId: p.vaultId, before: preview.before }), { flag: "wx", mode: 0o600 });
  fs.mkdirSync(path.dirname(cfg.abs), { recursive: true });
  const tmp = cfg.abs + "." + randomUUID() + ".tmp";
  try { fs.writeFileSync(tmp, p.content, { flag: "wx", mode: 0o600 }); validateVaultWrite(p); fs.renameSync(tmp, cfg.abs); }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  return { path: p.path, backup: "backups/vault/" + reviewId + ".json", uri: obsidianUri(path.basename(cfg.dir), p.path) };
}
