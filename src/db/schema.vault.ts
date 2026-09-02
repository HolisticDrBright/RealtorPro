import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Obsidian vault index. Each row mirrors one Markdown note in the user's vault
 * (a local folder). Notes are read in place — the vault stays the source of
 * truth — and linked to contacts/properties via frontmatter or title match.
 */
const randomUUID = () => globalThis.crypto.randomUUID();
const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => text("created_at").notNull().$defaultFn(() => new Date().toISOString());
function json<T>(name: string) { return text(name, { mode: "json" }).$type<T>(); }

export const vaultNotes = sqliteTable(
  "vault_notes",
  {
    id: id(),
    path: text("path").notNull(), // vault-relative
    title: text("title").notNull(),
    tags: json<string[]>("tags").default([]),
    links: json<string[]>("links").default([]),
    frontmatter: json<Record<string, unknown>>("frontmatter").default({}),
    excerpt: text("excerpt"),
    wordCount: integer("word_count").default(0),
    contactId: text("contact_id"),
    propertyId: text("property_id"),
    linkBasis: text("link_basis"), // frontmatter | title | wikilink | null
    sha256: text("sha256").notNull(),
    modifiedAt: text("modified_at"),
    indexedAt: createdAt(),
  },
  (t) => ({ pathIdx: index("vault_path_idx").on(t.path), contactIdx: index("vault_contact_idx").on(t.contactId) }),
);
