/**
 * Obsidian note parsing + linking. Pure and unit-tested.
 * Reads only what a note says: frontmatter, #tags, [[wikilinks]], title,
 * excerpt, open checkboxes. Linking to a contact/property is explicit
 * (frontmatter contact/email/phone/property), exact title, or a wikilink.
 */

export interface ParsedNote { title: string; frontmatter: Record<string, unknown>; tags: string[]; links: string[]; body: string; excerpt: string; wordCount: number }

function scalar(v: string): unknown {
  const s = v.trim();
  if (/^\[.*\]$/.test(s)) return s.slice(1, -1).split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^\$?[\d,]+(\.\d+)?[kKmM]?$/.test(s) && /[$,kKmM]/.test(s)) return parseMoney(s);
  return s.replace(/^["']|["']$/g, "");
}

/** "$2.5M", "$725,000", "725k" → number; anything else → null. */
export function parseMoney(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const m = v.trim().replace(/[$,\s]/g, "").match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2]?.toLowerCase();
  return Math.round(unit === "m" ? n * 1e6 : unit === "k" ? n * 1e3 : n);
}

export function parseFrontmatter(text: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { frontmatter: {}, body: text };
  const fm: Record<string, unknown> = {};
  let list: string | null = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const item = raw.match(/^\s*-\s+(.*)$/);
    if (item && list) { (fm[list] as unknown[]).push(scalar(item[1])); continue; }
    const kv = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, val] = kv;
    if (val.trim() === "") { fm[key] = []; list = key; } else { fm[key] = scalar(val); list = null; }
  }
  return { frontmatter: fm, body: text.slice(m[0].length) };
}

export function parseNote(text: string, filename: string): ParsedNote {
  const { frontmatter, body } = parseFrontmatter(text);
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const title = (typeof frontmatter.title === "string" ? frontmatter.title : null) ?? h1 ?? filename.replace(/\.md$/i, "");
  const tags = new Set<string>();
  const fmTags = frontmatter.tags;
  (Array.isArray(fmTags) ? fmTags : typeof fmTags === "string" ? [fmTags] : []).forEach((t) => tags.add(String(t).replace(/^#/, "").toLowerCase()));
  for (const m of body.matchAll(/(^|\s)#([A-Za-z0-9_\-\/]+)/g)) tags.add(m[2].toLowerCase());
  const links = [...new Set(Array.from(body.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)).map((m) => m[1].trim()))];
  const plain = body.replace(/^#+\s+.*$/gm, "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a).replace(/[*_`>]/g, "").replace(/\s+/g, " ").trim();
  return { title, frontmatter, tags: [...tags], links, body, excerpt: plain.slice(0, 280), wordCount: plain ? plain.split(" ").length : 0 };
}

export interface ContactRef { id: string; name: string; email?: string | null; phone?: string | null }
export interface PropertyRef { id: string; address: string }
export interface NoteLink { contactId: string | null; propertyId: string | null; basis: "frontmatter" | "title" | "wikilink" | null }
const norm = (s: string) => s.trim().toLowerCase();
const digits = (s: string) => s.replace(/\D/g, "");

export function linkNote(note: ParsedNote, contactsList: ContactRef[], propertiesList: PropertyRef[]): NoteLink {
  const fm = note.frontmatter;
  const byName = (v: unknown) => (typeof v === "string" ? contactsList.find((c) => norm(c.name) === norm(v)) ?? null : null);
  const byEmail = (v: unknown) => (typeof v === "string" && v.includes("@") ? contactsList.find((c) => c.email && norm(c.email) === norm(v)) ?? null : null);
  const byPhone = (v: unknown) => (typeof v === "string" && digits(v).length >= 7 ? contactsList.find((c) => c.phone && digits(c.phone).endsWith(digits(v).slice(-10))) ?? null : null);
  const byAddr = (v: unknown) => (typeof v === "string" ? propertiesList.find((p) => norm(p.address) === norm(v) || norm(v).startsWith(norm(p.address))) ?? null : null);
  let contact = byEmail(fm.email) ?? byPhone(fm.phone) ?? byName(fm.contact) ?? byName(fm.client) ?? byName(fm.name);
  let property = byAddr(fm.property) ?? byAddr(fm.address);
  let basis: NoteLink["basis"] = contact || property ? "frontmatter" : null;
  if (!contact && !property) { contact = byName(note.title); property = byAddr(note.title); if (contact || property) basis = "title"; }
  if (!contact && !property) { for (const l of note.links) { contact = contact ?? byName(l); property = property ?? byAddr(l); } if (contact || property) basis = "wikilink"; }
  return { contactId: contact?.id ?? null, propertyId: property?.id ?? null, basis };
}

export function shouldIndex(relPath: string, include: string[] = [], exclude: string[] = []): boolean {
  const p = relPath.replace(/\\/g, "/").toLowerCase();
  if (p.startsWith(".obsidian/") || p.includes("/.trash/") || p.startsWith(".trash/")) return false;
  if (exclude.some((e) => e && p.startsWith(e.toLowerCase().replace(/\/$/, "") + "/"))) return false;
  if (include.length > 0 && !include.some((i) => i && p.startsWith(i.toLowerCase().replace(/\/$/, "") + "/"))) return false;
  return p.endsWith(".md");
}

/** Open `- [ ]` tasks, with wikilink aliases resolved. */
export function extractOpenTasks(body: string, limit = 20): string[] {
  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[\s\]\s+(.+?)\s*$/);
    if (m) out.push(m[1].replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a).replace(/(?:\s+#[\w/-]+)+\s*$/, "").trim() || m[1]);
    if (out.length >= limit) break;
  }
  return out;
}
export const obsidianUri = (vaultName: string, relPath: string) => `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath.replace(/\.md$/i, ""))}`;
export const isDailyNoteFor = (relPath: string, ymd: string) => relPath.replace(/\\/g, "/").split("/").pop()?.includes(ymd) ?? false;

/** Importable record types recognised in frontmatter `type:`. */
export const RECORD_TYPES = ["contact", "buyer", "seller", "property", "listing", "transaction", "task", "opportunity"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];
export function recordTypeOf(fm: Record<string, unknown>): RecordType | null {
  const t = typeof fm.type === "string" ? fm.type.toLowerCase().trim() : null;
  return t && (RECORD_TYPES as readonly string[]).includes(t) ? (t as RecordType) : null;
}
