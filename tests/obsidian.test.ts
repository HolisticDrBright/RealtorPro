import { describe, expect, it } from "vitest";
import { linkNote, parseFrontmatter, parseNote, shouldIndex } from "../src/lib/obsidian";

const NOTE = `---
title: Coffee with Priya
contact: Priya Mehta
tags: [buyer, followup]
areas:
  - Sellwood
  - Woodstock
budget: 725000
hard: true
---
# Coffee with Priya

Talked about the [[4823 SE Reedway St]] showing and her #timeline. She liked the yard.
Follow up with [[Marcus Whitfield|Marcus]] about the lender letter.
`;

describe("Obsidian parsing", () => {
  it("parses scalar, inline-list and dash-list frontmatter", () => {
    const { frontmatter, body } = parseFrontmatter(NOTE);
    expect(frontmatter.title).toBe("Coffee with Priya");
    expect(frontmatter.tags).toEqual(["buyer", "followup"]);
    expect(frontmatter.areas).toEqual(["Sellwood", "Woodstock"]);
    expect(frontmatter.budget).toBe(725000);
    expect(frontmatter.hard).toBe(true);
    expect(body.startsWith("# Coffee with Priya")).toBe(true);
  });

  it("returns an empty frontmatter when the note has none", () => {
    expect(parseFrontmatter("Just text").frontmatter).toEqual({});
  });

  it("extracts title, tags, wikilinks, excerpt and word count", () => {
    const n = parseNote(NOTE, "2026-09-01 coffee.md");
    expect(n.title).toBe("Coffee with Priya");
    expect(n.tags).toEqual(expect.arrayContaining(["buyer", "followup", "timeline"]));
    expect(n.links).toEqual(["4823 SE Reedway St", "Marcus Whitfield"]);
    expect(n.excerpt).toContain("Talked about the 4823 SE Reedway St showing");
    expect(n.excerpt).toContain("Marcus about the lender letter");
    expect(n.wordCount).toBeGreaterThan(10);
  });

  it("falls back to H1 then filename for the title", () => {
    expect(parseNote("# Heading\nbody", "x.md").title).toBe("Heading");
    expect(parseNote("plain", "My Note.md").title).toBe("My Note");
  });
});

describe("Obsidian linking", () => {
  const contacts = [
    { id: "c1", name: "Priya Mehta", fubId: "1001" },
    { id: "c2", name: "Marcus Whitfield", fubId: "1002" },
  ];
  const properties = [{ id: "p1", address: "4823 SE Reedway St" }];

  it("links by frontmatter contact name first", () => {
    const link = linkNote(parseNote(NOTE, "n.md"), contacts, properties);
    expect(link).toEqual({ contactId: "c1", propertyId: null, basis: "frontmatter" });
  });

  it("links by FUB id in frontmatter, never by a fuzzy name", () => {
    const n = parseNote("---\nfubId: FUB #1002\n---\nhello", "n.md");
    expect(linkNote(n, contacts, properties).contactId).toBe("c2");
    const fuzzy = parseNote("---\ncontact: Priya\n---\nhello", "n.md");
    expect(linkNote(fuzzy, contacts, properties).contactId).toBeNull();
  });

  it("links by exact title match, then by wikilink", () => {
    const byTitle = linkNote(parseNote("# 4823 SE Reedway St\nnotes", "n.md"), contacts, properties);
    expect(byTitle).toEqual({ contactId: null, propertyId: "p1", basis: "title" });
    const byLink = linkNote(parseNote("Met [[Marcus Whitfield]] at [[4823 SE Reedway St]]", "n.md"), contacts, properties);
    expect(byLink).toEqual({ contactId: "c2", propertyId: "p1", basis: "wikilink" });
  });

  it("returns no link when nothing matches", () => {
    expect(linkNote(parseNote("random", "Groceries.md"), contacts, properties)).toEqual({ contactId: null, propertyId: null, basis: null });
  });
});

describe("shouldIndex", () => {
  it("indexes only markdown outside .obsidian/.trash and honours include/exclude", () => {
    expect(shouldIndex("Clients/Priya.md")).toBe(true);
    expect(shouldIndex("Clients/photo.png")).toBe(false);
    expect(shouldIndex(".obsidian/workspace.md")).toBe(false);
    expect(shouldIndex(".trash/old.md")).toBe(false);
    expect(shouldIndex("Personal/journal.md", [], ["Personal"])).toBe(false);
    expect(shouldIndex("Clients/Priya.md", ["Clients"], [])).toBe(true);
    expect(shouldIndex("Recipes/pie.md", ["Clients"], [])).toBe(false);
  });
});

describe("Vault tasks and links", () => {
  it("extracts open checkbox tasks only, resolving wikilink aliases", async () => {
    const { extractOpenTasks, obsidianUri, isDailyNoteFor } = await import("../src/lib/obsidian");
    const body = "# 2026-09-02\n- [ ] Call [[Jordan & Priya Mehta|Priya]] about Reedway\n- [x] Order lockbox\n* [ ] Send Ruiz addendum\n1. [ ] Pull comps\n- not a task";
    expect(extractOpenTasks(body)).toEqual(["Call Priya about Reedway", "Send Ruiz addendum", "Pull comps"]);
    expect(obsidianUri("My Vault", "Daily/2026-09-02.md")).toBe("obsidian://open?vault=My%20Vault&file=Daily%2F2026-09-02");
    expect(isDailyNoteFor("Daily/2026-09-02.md", "2026-09-02")).toBe(true);
    expect(isDailyNoteFor("Daily/2026-09-01.md", "2026-09-02")).toBe(false);
  });
});
