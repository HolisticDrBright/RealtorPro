import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { desc, eq, inArray, like, or } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { extractOpenTasks, isDailyNoteFor, linkNote, obsidianUri, parseNote, recordTypeOf, shouldIndex, type RecordType } from "@/lib/obsidian";
import { AppError } from "@/lib/errors";
import { ymd } from "@/lib/dates";
import { applyImport, ImportBundle, type ImportBundleT, type ImportReport } from "./importer";

/**
 * Obsidian vault — local files only. Notes are read in place and indexed into
 * `vault_notes`; the app writes only into OBSIDIAN_WRITE_FOLDER (default
 * "Command Center") and never edits your notes. Notes whose frontmatter says
 * `type: contact | buyer | seller | property | listing | transaction | task |
 * opportunity` can be imported as real records.
 */

export function vaultConfig() {
  const dir = process.env.OBSIDIAN_VAULT_DIR?.trim() ? path.resolve(process.env.OBSIDIAN_VAULT_DIR.trim()) : null;
  const list = (v?: string) => (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  return { dir, exists: !!dir && fs.existsSync(dir) && fs.statSync(dir).isDirectory(), writeFolder: process.env.OBSIDIAN_WRITE_FOLDER?.trim() || "Command Center", include: list(process.env.OBSIDIAN_INCLUDE_FOLDERS), exclude: list(process.env.OBSIDIAN_EXCLUDE_FOLDERS), allowClaude: /^(1|true|yes)$/i.test(process.env.OBSIDIAN_ALLOW_CLAUDE ?? "") };
}

function walk(root: string, rel = ""): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(root, r)); else out.push(r);
  }
  return out;
}

export function vaultStatus() {
  const cfg = vaultConfig();
  const rows = cfg.exists ? db.select({ recordType: s.vaultNotes.recordType, indexedAt: s.vaultNotes.indexedAt, contactId: s.vaultNotes.contactId }).from(s.vaultNotes).all() : [];
  return { configured: !!cfg.dir, exists: cfg.exists, dir: cfg.dir, dirName: cfg.dir ? path.basename(cfg.dir) : null, writeFolder: cfg.writeFolder, noteCount: rows.length, importable: rows.filter((r) => r.recordType).length, linked: rows.filter((r) => r.contactId).length, lastIndexedAt: rows.map((r) => r.indexedAt).sort().pop() ?? null, allowClaude: cfg.allowClaude };
}

export function indexVault() {
  const cfg = vaultConfig();
  if (!cfg.dir) throw new AppError("unprocessable", "Set OBSIDIAN_VAULT_DIR in .env to your vault folder, then restart the app.");
  if (!cfg.exists) throw new AppError("not_found", `Vault folder not found: ${cfg.dir}`);
  const contactRefs = db.select().from(s.contacts).all().map((c) => ({ id: c.id, name: `${c.firstName} ${c.lastName}`.trim(), email: c.email, phone: c.phone }));
  const propertyRefs = db.select({ id: s.properties.id, address: s.properties.address }).from(s.properties).all();
  const existing = new Map(db.select().from(s.vaultNotes).all().map((n) => [n.path, n]));
  const seen = new Set<string>();
  let added = 0, updated = 0, unchanged = 0, linked = 0;
  for (const rel of walk(cfg.dir)) {
    if (!shouldIndex(rel, cfg.include, cfg.exclude)) continue;
    const abs = path.join(cfg.dir, rel);
    const text = fs.readFileSync(abs, "utf8");
    const sha = crypto.createHash("sha256").update(text).digest("hex");
    seen.add(rel);
    const prev = existing.get(rel);
    if (prev && prev.sha256 === sha) { unchanged++; continue; }
    const parsed = parseNote(text, path.basename(rel));
    const link = linkNote(parsed, contactRefs, propertyRefs);
    if (link.contactId || link.propertyId) linked++;
    const values = { title: parsed.title, tags: parsed.tags, links: parsed.links, frontmatter: parsed.frontmatter, excerpt: parsed.excerpt, wordCount: parsed.wordCount, contactId: link.contactId, propertyId: link.propertyId, linkBasis: link.basis, recordType: recordTypeOf(parsed.frontmatter), sha256: sha, modifiedAt: fs.statSync(abs).mtime.toISOString(), indexedAt: new Date().toISOString() };
    if (prev) { db.update(s.vaultNotes).set(values).where(eq(s.vaultNotes.id, prev.id)).run(); updated++; } else { db.insert(s.vaultNotes).values({ path: rel, ...values }).run(); added++; }
  }
  const gone = [...existing.keys()].filter((p) => !seen.has(p));
  if (gone.length) db.delete(s.vaultNotes).where(inArray(s.vaultNotes.path, gone)).run();
  return { added, updated, unchanged, removed: gone.length, linked, total: seen.size };
}

/** Re-index only when a file changed (cheap mtime scan). Safe to call on every dashboard load. */
export function indexVaultIfChanged(): boolean {
  const cfg = vaultConfig();
  if (!cfg.dir || !cfg.exists) return false;
  const indexed = new Map(db.select({ path: s.vaultNotes.path, modifiedAt: s.vaultNotes.modifiedAt }).from(s.vaultNotes).all().map((n) => [n.path, n.modifiedAt]));
  let changed = false;
  for (const rel of walk(cfg.dir)) {
    if (!shouldIndex(rel, cfg.include, cfg.exclude)) continue;
    const prev = indexed.get(rel);
    if (prev === undefined || fs.statSync(path.join(cfg.dir, rel)).mtime.toISOString() !== prev) { changed = true; break; }
    indexed.delete(rel);
  }
  if (!changed && indexed.size > 0) changed = true;
  if (changed) indexVault();
  return changed;
}

export const notesForContact = (contactId: string) => db.select().from(s.vaultNotes).where(eq(s.vaultNotes.contactId, contactId)).orderBy(desc(s.vaultNotes.modifiedAt)).all().map(withUri);
export const notesForProperty = (propertyId: string) => db.select().from(s.vaultNotes).where(eq(s.vaultNotes.propertyId, propertyId)).orderBy(desc(s.vaultNotes.modifiedAt)).all().map(withUri);
export const recentNotes = (limit = 20) => db.select().from(s.vaultNotes).orderBy(desc(s.vaultNotes.modifiedAt)).limit(limit).all().map(withUri);
export const searchNotes = (q: string, limit = 25) => db.select().from(s.vaultNotes).where(or(like(s.vaultNotes.title, `%${q}%`), like(s.vaultNotes.excerpt, `%${q}%`))).orderBy(desc(s.vaultNotes.modifiedAt)).limit(limit).all().map(withUri);
function withUri<T extends { path: string }>(n: T) { const cfg = vaultConfig(); return { ...n, uri: obsidianUri(cfg.dir ? path.basename(cfg.dir) : "vault", n.path) }; }

/** Open checkbox tasks from today's daily note, notes tagged #command-center / #today, and the write folder. */
export function vaultTasks(): { text: string; note: string; uri: string }[] {
  const cfg = vaultConfig();
  if (!cfg.dir || !cfg.exists) return [];
  const today = ymd();
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const candidates = db.select().from(s.vaultNotes).orderBy(desc(s.vaultNotes.modifiedAt)).all().filter((n) => isDailyNoteFor(n.path, today) || (n.tags ?? []).some((t) => /^(command-center|today)$/.test(t)) || (n.path.toLowerCase().startsWith(cfg.writeFolder.toLowerCase() + "/") && (n.modifiedAt ?? "") >= dayAgo)).slice(0, 10);
  const out: { text: string; note: string; uri: string }[] = [];
  for (const n of candidates) {
    let body = "";
    try { body = fs.readFileSync(path.join(cfg.dir, n.path), "utf8"); } catch { continue; }
    for (const text of extractOpenTasks(body)) { out.push({ text, note: n.title, uri: obsidianUri(path.basename(cfg.dir), n.path) }); if (out.length >= 12) return out; }
  }
  return out;
}

/**
 * Full text of indexed notes for Claude to read (Integrations → "Let Claude read
 * the vault"). Skips the app's own write folder; optional folder filter;
 * newest first. Only called when OBSIDIAN_ALLOW_CLAUDE=true.
 */
export function vaultNoteTexts(opts: { folder?: string; limit?: number } = {}): { path: string; title: string; text: string }[] {
  const cfg = vaultConfig();
  if (!cfg.dir || !cfg.exists) throw new AppError("unprocessable", "Obsidian vault is not configured (OBSIDIAN_VAULT_DIR).");
  indexVaultIfChanged();
  const folder = opts.folder?.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").toLowerCase();
  const rows = db.select({ path: s.vaultNotes.path, title: s.vaultNotes.title }).from(s.vaultNotes).orderBy(desc(s.vaultNotes.modifiedAt)).all()
    .filter((n) => !n.path.toLowerCase().startsWith(cfg.writeFolder.toLowerCase() + "/"))
    .filter((n) => !folder || n.path.toLowerCase().startsWith(folder + "/") || n.path.toLowerCase() === folder)
    .slice(0, opts.limit ?? 200);
  const out: { path: string; title: string; text: string }[] = [];
  for (const n of rows) { try { out.push({ path: n.path, title: n.title, text: fs.readFileSync(path.join(cfg.dir, n.path), "utf8") }); } catch { /* removed since index */ } }
  return out;
}

/** Write a new note into the write folder. Never overwrites. */
export function writeVaultNote(title: string, content: string, subfolder?: string): { path: string; uri: string } {
  const cfg = vaultConfig();
  if (!cfg.dir || !cfg.exists) throw new AppError("unprocessable", "Obsidian vault is not configured (OBSIDIAN_VAULT_DIR).");
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "Note";
  const sub = (subfolder ?? "").replace(/\\/g, "/");
  if (sub.split("/").some((x) => x === "..") || path.posix.isAbsolute(sub)) throw new AppError("bad_request", "Subfolder must be relative.");
  const dirAbs = path.resolve(cfg.dir, path.posix.join(cfg.writeFolder, sub.replace(/^[/.]+/, "")));
  if (!dirAbs.startsWith(cfg.dir + path.sep) && dirAbs !== cfg.dir) throw new AppError("bad_request", "Refusing to write outside the vault.");
  fs.mkdirSync(dirAbs, { recursive: true });
  let file = path.join(dirAbs, `${safeTitle}.md`);
  let n = 2;
  while (fs.existsSync(file)) file = path.join(dirAbs, `${safeTitle} (${n++}).md`);
  fs.writeFileSync(file, `---\nsource: Command Center\ncreated: ${new Date().toISOString()}\ntags: [command-center]\n---\n\n${content.trim()}\n`, "utf8");
  const rel = path.relative(cfg.dir, file).replace(/\\/g, "/");
  return { path: rel, uri: obsidianUri(path.basename(cfg.dir), rel) };
}

// ── Import records from frontmatter ───────────────────────────────────────
const str = (v: unknown) => (v == null || v === "" ? undefined : String(v));
const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : typeof v === "string" ? v.split(/[,;]/).map((x) => x.trim()).filter(Boolean) : undefined);

/** Translate one indexed note's frontmatter into bundle entries. */
export function noteToBundle(fm: Record<string, unknown>, type: RecordType, title: string, body: string): Partial<ImportBundleT> {
  const g = (k: string) => fm[k];
  const name = str(g("name")) ?? str(g("contact")) ?? title;
  const address = str(g("address")) ?? str(g("property")) ?? title;
  const notesText = str(g("notes")) ?? (body.trim() ? body.trim().slice(0, 1500) : undefined);
  switch (type) {
    case "contact": case "buyer": case "seller": {
      const base = { name, phone: str(g("phone")), email: str(g("email")), type: (str(g("contactType")) ?? (type === "contact" ? str(g("type_")) : type)) as never, leadSource: str(g("leadSource")) as never, spouse: str(g("spouse")), birthday: str(g("birthday")), homeAddress: str(g("homeAddress")), priceMin: g("priceMin") as never, priceMax: g("priceMax") as never, preferredAreas: arr(g("areas")) ?? arr(g("preferredAreas")), tags: arr(g("tags"))?.filter((t) => !["contact", "buyer", "seller"].includes(t)), stage: str(g("stage")) as never, nextAction: str(g("nextAction")), nextFollowUpAt: str(g("nextFollowUp")) ?? str(g("nextFollowUpAt")), notes: notesText };
      const buyer = type === "buyer" || g("buyer") ? { temperature: str(g("temperature")) as never, priceMin: g("priceMin") as never, priceMax: g("priceMax") as never, targetAreas: arr(g("areas")) ?? arr(g("targetAreas")), minBeds: g("minBeds") as never, minBaths: g("minBaths") as never, minSqft: g("minSqft") as never, propertyType: str(g("propertyType")), mustHaves: arr(g("mustHaves")), dealBreakers: arr(g("dealBreakers")), financingType: str(g("financing")) ?? str(g("financingType")), preApprovalAmount: g("preApproval") as never, timeline: str(g("timeline")), notes: undefined } : undefined;
      const seller = type === "seller" || g("seller") ? { propertyAddress: str(g("propertyAddress")) ?? str(g("address")), city: str(g("city")), estimatedValue: g("estimatedValue") as never, expectedListPrice: g("expectedListPrice") as never, timeline: str(g("timeline")), motivation: str(g("motivation")), stage: str(g("sellerStage")) as never, probability: g("probability") as never, notes: undefined } : undefined;
      return { contacts: [{ ...base, buyer, seller }] };
    }
    case "property": return { properties: [{ address, city: str(g("city")), zip: str(g("zip")), beds: g("beds") as never, baths: g("baths") as never, sqft: g("sqft") as never, lotSqft: g("lotSqft") as never, propertyType: str(g("propertyType")), yearBuilt: g("yearBuilt") as never, view: str(g("view")), notes: notesText }] };
    case "listing": return { listings: [{ address, city: str(g("city")), listPrice: (g("listPrice") ?? g("price")) as never, status: str(g("status")) as never, listedAt: str(g("listedAt")) ?? str(g("listed")), sellerName: str(g("seller")), commissionPct: g("commission") as never, showings: g("showings") as never, offers: g("offers") as never, nextAction: str(g("nextAction")), notes: notesText }], properties: [{ address, city: str(g("city")), beds: g("beds") as never, baths: g("baths") as never, sqft: g("sqft") as never, lotSqft: g("lotSqft") as never, propertyType: str(g("propertyType")), view: str(g("view")), zip: undefined, yearBuilt: undefined, notes: undefined }] };
    case "transaction": return { transactions: [{ address, city: str(g("city")), clientName: str(g("client")) ?? str(g("contact")), side: str(g("side")) as never, status: str(g("status")) as never, purchasePrice: (g("price") ?? g("purchasePrice")) as never, commissionPct: g("commission") as never, referralFee: g("referralFee") as never, brokerSplitPct: g("split") as never, expenses: g("expenses") as never, escrowOpenedAt: str(g("escrowOpened")) ?? str(g("opened")), closingDate: str(g("closingDate")) ?? str(g("closing")), closedAt: str(g("closedAt")), leadSource: str(g("leadSource")), notes: notesText }] };
    case "task": return { tasks: [{ title: str(g("title")) ?? title, priority: str(g("priority")) as never, category: str(g("category")) as never, dueDate: str(g("due")) ?? str(g("dueDate")), dueTime: str(g("time")), contactName: str(g("contact")), address: str(g("address")), notes: notesText }] };
    case "opportunity": return { opportunities: [{ address, area: str(g("area")), kind: str(g("kind")) as never, expectedPrice: (g("price") ?? g("expectedPrice")) as never, beds: g("beds") as never, baths: g("baths") as never, sqft: g("sqft") as never, sourceAgent: str(g("source")) ?? str(g("agent")), notes: notesText }] };
  }
}

/** Build one bundle from every importable note in the vault. */
export function vaultBundle(): { bundle: ImportBundleT; notes: { path: string; title: string; type: string }[] } {
  const cfg = vaultConfig();
  if (!cfg.dir || !cfg.exists) throw new AppError("unprocessable", "Obsidian vault is not configured (OBSIDIAN_VAULT_DIR).");
  indexVaultIfChanged();
  const rows = db.select().from(s.vaultNotes).all().filter((n) => n.recordType);
  const merged: Record<string, unknown[]> = {};
  const notes: { path: string; title: string; type: string }[] = [];
  for (const n of rows) {
    const body = (() => { try { return parseNote(fs.readFileSync(path.join(cfg.dir!, n.path), "utf8"), n.path).body; } catch { return ""; } })();
    const part = noteToBundle((n.frontmatter ?? {}) as Record<string, unknown>, n.recordType as RecordType, n.title, body);
    for (const [k, v] of Object.entries(part)) if (Array.isArray(v)) (merged[k] ??= []).push(...v);
    notes.push({ path: n.path, title: n.title, type: n.recordType! });
  }
  return { bundle: ImportBundle.parse(merged), notes };
}

export function importFromVault(dryRun: boolean): ImportReport & { notes: number } {
  const { bundle, notes } = vaultBundle();
  return { ...applyImport(bundle, { dryRun, source: "Obsidian" }), notes: notes.length };
}
