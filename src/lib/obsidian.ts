/**
 * Obsidian vault parsing and linking — pure and unit-tested.
 *
 * Reads only what is in a note: YAML-ish frontmatter (scalars, inline lists,
 * dash lists), #tags, [[wikilinks]], the title (frontmatter > first H1 >
 * filename), and an excerpt. Linking to a contact/property is explicit
 * (frontmatter `contact` / `fubId` / `property`) or an exact title/wikilink
 * match — and the basis is recorded so the UI can say how the link was made.
 */

export interface ParsedNote {
  title: string;
  frontmatter: Record<string, unknown>;
  tags: string[];
  links: string[];
  body: string;
  excerpt: string;
  wordCount: number;
}

function parseScalar(v: string): unknown {
  const s = v.trim();
  if (/^\[.*\]$/.test(s)) return s.slice(1, -1).split(",").map((x) => x.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
  if (/^(true|false)$/i.test(s)) return s.toLowerCase() === "true";
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  return s.replace(/^["']|["']$/g, "");
}

export function parseFrontmatter(text: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { frontmatter: {}, body: text };
  const fm: Record<string, unknown> = {};
  let currentList: string | null = null;
  for (const raw of m[1].split(/\r?\n/)) {
    const listItem = raw.match(/^\s*-\s+(.*)$/);
    if (listItem && currentList) {
      (fm[currentList] as unknown[]).push(parseScalar(listItem[1]));
      continue;
    }
    const kv = raw.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, key, val] = kv;
    if (val.trim() === "") {
      fm[key] = [];
      currentList = key;
    } else {
      fm[key] = parseScalar(val);
      currentList = null;
    }
  }
  return { frontmatter: fm, body: text.slice(m[0].length) };
}

export function parseNote(text: string, filename: string): ParsedNote {
  const { frontmatter, body } = parseFrontmatter(text);
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const fmTitle = typeof frontmatter.title === "string" ? frontmatter.title : null;
  const title = fmTitle ?? h1 ?? filename.replace(/\.md$/i, "");

  const tagSet = new Set<string>();
  const fmTags = frontmatter.tags;
  (Array.isArray(fmTags) ? fmTags : typeof fmTags === "string" ? [fmTags] : []).forEach((t) => tagSet.add(String(t).replace(/^#/, "").toLowerCase()));
  for (const m of body.matchAll(/(^|\s)#([A-Za-z0-9_\-\/]+)/g)) tagSet.add(m[2].toLowerCase());

  const links = Array.from(body.matchAll(/\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g)).map((m) => m[1].trim());
  const plain = body.replace(/^#+\s+.*$/gm, "").replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a).replace(/[*_`>]/g, "").replace(/\s+/g, " ").trim();
  return { title, frontmatter, tags: [...tagSet], links: [...new Set(links)], body, excerpt: plain.slice(0, 280), wordCount: plain ? plain.split(" ").length : 0 };
}

export interface ContactRef { id: string; name: string; fubId?: string | null }
export interface PropertyRef { id: string; address: string }
export interface NoteLink { contactId: string | null; propertyId: string | null; basis: "frontmatter" | "title" | "wikilink" | null }

const norm = (s: string) => s.trim().toLowerCase();

export function linkNote(note: ParsedNote, contactsList: ContactRef[], propertiesList: PropertyRef[]): NoteLink {
  const fm = note.frontmatter;
  const byFub = (v: unknown) => (v == null ? null : contactsList.find((c) => c.fubId && String(c.fubId) === String(v).replace(/^FUB\s*#?/i, "")) ?? null);
  const byName = (v: unknown) => (typeof v === "string" ? contactsList.find((c) => norm(c.name) === norm(v)) ?? null : null);
  const byAddr = (v: unknown) => (typeof v === "string" ? propertiesList.find((p) => norm(p.address) === norm(v)) ?? null : null);

  let contact: ContactRef | null = byFub(fm.fubId) ?? byName(fm.contact) ?? byName(fm.client);
  let property: PropertyRef | null = byAddr(fm.property) ?? byAddr(fm.address);
  let basis: NoteLink["basis"] = contact || property ? "frontmatter" : null;

  if (!contact && !property) {
    contact = byName(note.title);
    property = byAddr(note.title);
    if (contact || property) basis = "title";
  }
  if (!contact && !property) {
    for (const l of note.links) {
      contact = contact ?? byName(l);
      property = property ?? byAddr(l);
    }
    if (contact || property) basis = "wikilink";
  }
  return { contactId: contact?.id ?? null, propertyId: property?.id ?? null, basis };
}

/** Include/exclude folder filters (vault-relative, case-insensitive prefixes). */
export function shouldIndex(relPath: string, include: string[] = [], exclude: string[] = []): boolean {
  const p = relPath.replace(/\\/g, "/").toLowerCase();
  if (p.startsWith(".obsidian/") || p.includes("/.trash/") || p.startsWith(".trash/")) return false;
  if (exclude.some((e) => e && p.startsWith(e.toLowerCase().replace(/\/$/, "") + "/"))) return false;
  if (include.length > 0 && !include.some((i) => i && p.startsWith(i.toLowerCase().replace(/\/$/, "") + "/"))) return false;
  return p.endsWith(".md");
}

/** Open checkbox tasks (`- [ ] …`) in a note body, in order. Completed boxes are skipped. */
export function extractOpenTasks(body: string, limit = 20): string[] {
  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:[-*+]|\d+[.)])\s+\[\s\]\s+(.+?)\s*$/);
    if (m) out.push(m[1].replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, a, b) => b ?? a));
    if (out.length >= limit) break;
  }
  return out;
}

/** Deep link that opens a note in the Obsidian app on this machine. */
export function obsidianUri(vaultName: string, relPath: string): string {
  return `obsidian://open?vault=${encodeURIComponent(vaultName)}&file=${encodeURIComponent(relPath.replace(/\.md$/i, ""))}`;
}

/** True when a note looks like today's daily note (filename contains YYYY-MM-DD). */
export function isDailyNoteFor(relPath: string, ymd: string): boolean {
  return relPath.replace(/\\/g, "/").split("/").pop()?.includes(ymd) ?? false;
}
