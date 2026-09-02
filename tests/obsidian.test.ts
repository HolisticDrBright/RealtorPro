import { describe, expect, it } from "vitest";
import { extractOpenTasks, linkNote, parseFrontmatter, parseMoney, parseNote, recordTypeOf, shouldIndex } from "../src/lib/obsidian";

const NOTE = `---
type: buyer
name: Mark & Lisa Anderson
phone: (714) 555-7788
priceMin: $2M
priceMax: 3,500,000
areas: [North Tustin, Lemon Heights]
mustHaves:
  - flat lot
  - in-law suite
temperature: warm
---
# Coral Ridge open house
Met at [[8 Coral Ridge]]. #buyer
- [ ] Send Cowan Heights listing
- [x] Add to CRM
`;

describe("Obsidian parsing", () => {
  it("parses frontmatter scalars, money, inline and dash lists", () => {
    const { frontmatter } = parseFrontmatter(NOTE);
    expect(frontmatter.name).toBe("Mark & Lisa Anderson");
    expect(frontmatter.priceMin).toBe(2000000);
    expect(frontmatter.priceMax).toBe(3500000);
    expect(frontmatter.areas).toEqual(["North Tustin", "Lemon Heights"]);
    expect(frontmatter.mustHaves).toEqual(["flat lot", "in-law suite"]);
    expect(recordTypeOf(frontmatter)).toBe("buyer");
    expect(recordTypeOf({ type: "grocery" })).toBeNull();
  });
  it("parses money in every common form", () => {
    expect(parseMoney("$2.5M")).toBe(2500000);
    expect(parseMoney("725k")).toBe(725000);
    expect(parseMoney("$3,100,000")).toBe(3100000);
    expect(parseMoney("$4.1M")).toBe(4100000);
    expect(parseMoney("soon")).toBeNull();
  });
  it("finds title, tags, links, excerpt and open tasks", () => {
    const n = parseNote(NOTE, "anderson.md");
    expect(n.title).toBe("Coral Ridge open house");
    expect(n.tags).toContain("buyer");
    expect(n.links).toEqual(["8 Coral Ridge"]);
    expect(extractOpenTasks(n.body)).toEqual(["Send Cowan Heights listing"]);
    expect(extractOpenTasks("- [ ] Call the Andersons #command-center\n- [ ] Sign for [[31 Shady Canyon]] #a")).toEqual(["Call the Andersons", "Sign for 31 Shady Canyon"]);
  });
});

describe("Obsidian linking", () => {
  const contacts = [{ id: "c1", name: "Mark Anderson", phone: "(714) 555-7788", email: "mark@example.com" }, { id: "c2", name: "Sarah Thompson", phone: null, email: "sarah@example.com" }];
  const props = [{ id: "p1", address: "8 Coral Ridge" }];
  it("links by phone/email in frontmatter, then title, then wikilink — never fuzzy names", () => {
    expect(linkNote(parseNote(NOTE, "a.md"), contacts, props)).toEqual({ contactId: "c1", propertyId: null, basis: "frontmatter" });
    expect(linkNote(parseNote("---\nemail: sarah@example.com\n---\nhi", "a.md"), contacts, props).contactId).toBe("c2");
    expect(linkNote(parseNote("# Sarah Thompson\nnotes", "a.md"), contacts, props).basis).toBe("title");
    expect(linkNote(parseNote("Toured [[8 Coral Ridge]] today", "a.md"), contacts, props)).toEqual({ contactId: null, propertyId: "p1", basis: "wikilink" });
    expect(linkNote(parseNote("---\ncontact: Sarah\n---\n", "a.md"), contacts, props).contactId).toBeNull();
  });
  it("indexes only markdown outside hidden folders, honouring include/exclude", () => {
    expect(shouldIndex("Clients/a.md")).toBe(true);
    expect(shouldIndex(".obsidian/x.md")).toBe(false);
    expect(shouldIndex("Personal/j.md", [], ["Personal"])).toBe(false);
    expect(shouldIndex("Recipes/p.md", ["Clients"])).toBe(false);
  });
});
