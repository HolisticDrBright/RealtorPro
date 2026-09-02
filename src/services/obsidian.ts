import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { desc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/db";
import { contacts, properties } from "@/db/schema";
import { vaultNotes } from "@/db/schema.vault";
import { extractOpenTasks, isDailyNoteFor, linkNote, obsidianUri, parseNote, shouldIndex } from "@/lib/obsidian";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

/**
 * Obsidian vault integration — local files only. The vault is read in place and
 * indexed into `vault_notes`; AgentOS writes back only into a dedicated folder
 * inside the vault (OBSIDIAN_WRITE_FOLDER, default "AgentOS") and never edits
 * your existing notes. Nothing from the vault is sent to Claude unless
 * OBSIDIAN_ALLOW_CLAUDE=true.
 */

export function vaultConfig() {
  const dir = process.env.OBSIDIAN_VAULT_DIR?.trim() ? path.resolve(process.env.OBSIDIAN_VAULT_DIR.trim()) : null;
  const list = (v?: string) => (v ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return {
    dir,
    exists: !!dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory(),
    writeFolder: process.env.OBSIDIAN_WRITE_FOLDER?.trim() || "AgentOS",
    include: list(process.env.OBSIDIAN_INCLUDE_FOLDERS),
    exclude: list(process.env.OBSIDIAN_EXCLUDE_FOLDERS),
    allowClaude: /^(1|true|yes)$/i.test(process.env.OBSIDIAN_ALLOW_CLAUDE ?? ""),
  };
}

function walk(root: string, rel = ""): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue; // .obsidian, .trash, dotfiles
    const r = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...walk(root, r));
    else out.push(r);
  }
  return out;
}

export function vaultStatus() {
  const cfg = vaultConfig();
  const count = cfg.exists ? db.select().from(vaultNotes).all().length : 0;
  const latest = db.select().from(vaultNotes).orderBy(desc(vaultNotes.indexedAt)).get();
  return { configured: !!cfg.dir, exists: cfg.exists, dirName: cfg.dir ? path.basename(cfg.dir) : null, writeFolder: cfg.writeFolder, noteCount: count, lastIndexedAt: latest?.indexedAt ?? null, allowClaude: cfg.allowClaude, include: cfg.include, exclude: cfg.exclude };
}

/** Index (or re-index) the vault. Returns counts. */
export function indexVault() {
  const cfg = vaultConfig();
  if (!cfg.dir) throw new AppError("unprocessable", "Set OBSIDIAN_VAULT_DIR in .env to the folder of your Obsidian vault.");
  if (!cfg.exists) throw new AppError("not_found", `Obsidian vault folder not found: ${cfg.dir}`);

  const contactRefs = db.select({ id: contacts.id, name: contacts.name, fubId: contacts.fubId }).from(contacts).all();
  const propertyRefs = db.select({ id: properties.id, address: properties.address }).from(properties).all();
  const existing = new Map(db.select().from(vaultNotes).all().map((n) => [n.path, n]));
  const seen = new Set<string>();
  let added = 0, updated = 0, unchanged = 0, linked = 0;

  for (const rel of walk(cfg.dir)) {
    if (!shouldIndex(rel, cfg.include, cfg.exclude)) continue;
    const abs = path.join(cfg.dir, rel);
    const text = fs.readFileSync(abs, "utf8");
    const sha = crypto.createHash("sha256").update(text).digest("hex");
    const stat = fs.statSync(abs);
    seen.add(rel);
    const prev = existing.get(rel);
    if (prev && prev.sha256 === sha) { unchanged++; continue; }
    const parsed = parseNote(text, path.basename(rel));
    const link = linkNote(parsed, contactRefs, propertyRefs);
    if (link.contactId || link.propertyId) linked++;
    const values = { title: parsed.title, tags: parsed.tags, links: parsed.links, frontmatter: parsed.frontmatter, excerpt: parsed.excerpt, wordCount: parsed.wordCount, contactId: link.contactId, propertyId: link.propertyId, linkBasis: link.basis, sha256: sha, modifiedAt: stat.mtime.toISOString(), indexedAt: new Date().toISOString() };
    if (prev) { db.update(vaultNotes).set(values).where(eq(vaultNotes.id, prev.id)).run(); updated++; }
    else { db.insert(vaultNotes).values({ path: rel, ...values }).run(); added++; }
  }
  const gone = [...existing.keys()].filter((p) => !seen.has(p));
  if (gone.length) db.delete(vaultNotes).where(inArray(vaultNotes.path, gone)).run();

  writeAudit({ action: "obsidian.index", metadata: { added, updated, unchanged, removed: gone.length, linked } });
  return { added, updated, unchanged, removed: gone.length, linked, total: seen.size };
}

export function notesForContact(contactId: string) {
  return db.select().from(vaultNotes).where(eq(vaultNotes.contactId, contactId)).orderBy(desc(vaultNotes.modifiedAt)).all();
}

export function recentNotes(limit = 25) {
  return db.select().from(vaultNotes).orderBy(desc(vaultNotes.modifiedAt)).limit(limit).all();
}

export function searchNotes(q: string, limit = 25) {
  const pat = `%${q}%`;
  return db.select().from(vaultNotes).where(or(like(vaultNotes.title, pat), like(vaultNotes.excerpt, pat))).orderBy(desc(vaultNotes.modifiedAt)).limit(limit).all();
}

/** Write a new note into the AgentOS folder of the vault. Never overwrites user notes. */
export function writeVaultNote(title: string, content: string, subfolder?: string): { path: string } {
  const cfg = vaultConfig();
  if (!cfg.dir || !cfg.exists) throw new AppError("unprocessable", "Obsidian vault is not configured (OBSIDIAN_VAULT_DIR).");
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "AgentOS note";
  const sub = (subfolder ?? "").replace(/\\/g, "/");
  if (sub.split("/").some((seg) => seg === "..") || path.posix.isAbsolute(sub)) throw new AppError("unsafe_path", "Subfolder must be a relative path inside the AgentOS folder.");
  const folderRel = path.posix.join(cfg.writeFolder, sub.replace(/^[/.]+/, ""));
  const dirAbs = path.resolve(cfg.dir, folderRel);
  if (!dirAbs.startsWith(cfg.dir + path.sep) && dirAbs !== cfg.dir) throw new AppError("unsafe_path", "Refusing to write outside the vault.");
  fs.mkdirSync(dirAbs, { recursive: true });
  let file = path.join(dirAbs, `${safeTitle}.md`);
  let n = 2;
  while (fs.existsSync(file)) file = path.join(dirAbs, `${safeTitle} (${n++}).md`);
  const fm = `---\nsource: AgentOS\ncreated: ${new Date().toISOString()}\ntags: [agentos]\n---\n\n`;
  fs.writeFileSync(file, fm + content.trim() + "\n", "utf8");
  const rel = path.relative(cfg.dir, file).replace(/\\/g, "/");
  writeAudit({ action: "obsidian.write", metadata: { path: rel } });
  return { path: rel };
}

// ── Live view for the dashboard ────────────────────────────────────────────

/**
 * Cheap change detection: compare every note's mtime/size to what was indexed.
 * Re-indexes only when something differs, so edits made in Obsidian (by you
 * or by Claude) show up on the next dashboard load without a manual step.
 */
export function indexVaultIfChanged(): { changed: boolean; total: number } {
  const cfg = vaultConfig();
  if (!cfg.dir || !cfg.exists) return { changed: false, total: 0 };
  const indexed = new Map(db.select({ path: vaultNotes.path, modifiedAt: vaultNotes.modifiedAt }).from(vaultNotes).all().map((n) => [n.path, n.modifiedAt]));
  let changed = false;
  let total = 0;
  for (const rel of walk(cfg.dir)) {
    if (!shouldIndex(rel, cfg.include, cfg.exclude)) continue;
    total++;
    const prev = indexed.get(rel);
    if (prev === undefined) { changed = true; break; }
    const m = fs.statSync(path.join(cfg.dir, rel)).mtime.toISOString();
    if (m !== prev) { changed = true; break; }
    indexed.delete(rel);
  }
  if (!changed && indexed.size > 0) changed = true; // notes were deleted
  if (changed) indexVault();
  return { changed, total };
}

export interface VaultToday {
  configured: boolean;
  vaultName: string | null;
  recent: { path: string; title: string; excerpt: string | null; modifiedAt: string | null; tags: string[]; uri: string; contactId: string | null }[];
  tasks: { text: string; note: string; uri: string }[];
  changed: boolean;
}

/** Recently edited notes + open checkbox tasks from today's daily note and the AgentOS folder. */
export function vaultToday(ymd: string): VaultToday {
  const cfg = vaultConfig();
  if (!cfg.dir || !cfg.exists) return { configured: false, vaultName: null, recent: [], tasks: [], changed: false };
  const { changed } = indexVaultIfChanged();
  const vaultName = path.basename(cfg.dir);
  const all = db.select().from(vaultNotes).orderBy(desc(vaultNotes.modifiedAt)).all();
  const recent = all.slice(0, 6).map((n) => ({ path: n.path, title: n.title, excerpt: n.excerpt, modifiedAt: n.modifiedAt, tags: n.tags ?? [], uri: obsidianUri(vaultName, n.path), contactId: n.contactId }));
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const candidates = all.filter((n) =>
    isDailyNoteFor(n.path, ymd) ||
    (n.tags ?? []).some((t) => /^agentos(\/|$)|^today$/.test(t)) ||
    (n.path.toLowerCase().startsWith(cfg.writeFolder.toLowerCase() + "/") && (n.modifiedAt ?? "") >= dayAgo),
  ).slice(0, 10);
  const tasks: VaultToday["tasks"] = [];
  for (const n of candidates) {
    let body = "";
    try { body = fs.readFileSync(path.join(cfg.dir, n.path), "utf8"); } catch { continue; }
    for (const text of extractOpenTasks(body)) {
      tasks.push({ text, note: n.title, uri: obsidianUri(vaultName, n.path) });
      if (tasks.length >= 12) break;
    }
    if (tasks.length >= 12) break;
  }
  return { configured: true, vaultName, recent, tasks, changed };
}
