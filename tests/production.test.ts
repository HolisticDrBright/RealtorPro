import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { normalizeLayout, swapLayout } from "@/lib/layout-order";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "realtorpro-test-"));
let db: typeof import("@/db").db;
let s: typeof import("@/db/schema");
let importer: typeof import("@/services/importer");
let obsidian: typeof import("@/services/obsidian");
let reviews: typeof import("@/services/reviews");
let backups: typeof import("@/services/backups");
let connections: typeof import("@/lib/connections");
let clear: typeof import("@/services/admin").clearAllData;
beforeAll(async () => {
  vi.stubEnv("WORKSPACE_DIR", path.join(fixture, "workspace"));
  vi.stubEnv("OBSIDIAN_VAULT_DIR", path.join(fixture, "vault"));
  vi.stubEnv("OBSIDIAN_ALLOW_CLAUDE", "false");
  fs.mkdirSync(path.join(fixture, "vault", ".obsidian"), { recursive: true });
  ({ db } = await import("@/db")); s = await import("@/db/schema");
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  importer = await import("@/services/importer"); obsidian = await import("@/services/obsidian");
  reviews = await import("@/services/reviews"); backups = await import("@/services/backups"); connections = await import("@/lib/connections");
  ({ clearAllData: clear } = await import("@/services/admin"));
});
beforeEach(() => { clear(); connections.saveConnections({}); });
afterAll(() => { db.$client.close(); vi.unstubAllEnvs(); fs.rmSync(fixture, { recursive: true, force: true }); });
describe("safe data lifecycle", () => {
  it("starts with an empty CRM and neutral defaults", () => {
    expect(db.select().from(s.contacts).all()).toHaveLength(0);
    expect(db.select().from(s.settings).get()?.agentName).toBe("Agent");
    expect(db.select().from(s.settings).get()?.annualGoal).toBe(0);
  });
  it("does not merge apartment 1 with apartment 10 or cities", () => {
    importer.applyImport(importer.ImportBundle.parse({ properties: [{ address: "123 Main St Apt 1", city: "Alpha" }, { address: "123 Main St Apt 10", city: "Alpha" }, { address: "123 Main St Apt 1", city: "Beta" }] }));
    expect(db.select().from(s.properties).all()).toHaveLength(3);
    expect(() => importer.findProperty("123 Main St Apt 1")).toThrow(/Multiple properties/);
  });
  it("preserves same-name people with different email identities", () => {
    importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "Alex Lee", email: "a@example.com" }, { name: "Alex Lee", email: "b@example.com" }] }));
    expect(db.select().from(s.contacts).all()).toHaveLength(2);
    expect(() => importer.findContact("Alex Lee")).toThrow(/More than one/);
  });
  it("does not erase existing arrays when AI returns unknown empty arrays", () => {
    importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "Alex Lee", tags: ["VIP"] }] }));
    importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "Alex Lee", tags: [] }] }));
    expect(db.select().from(s.contacts).get()?.tags).toEqual(["VIP"]);
  });
  it("keeps identical tasks and notes attached to different clients", () => {
    const bundle = importer.ImportBundle.parse({ contacts: [{ name: "Alice Test" }, { name: "Bob Test" }], tasks: [{ title: "Follow up", contactName: "Alice Test" }, { title: "Follow up", contactName: "Bob Test" }], notes: [{ body: "Wants a garden", contactName: "Alice Test" }, { body: "Wants a garden", contactName: "Bob Test" }] });
    importer.applyImport(bundle); importer.applyImport(bundle);
    expect(db.select().from(s.tasks).all()).toHaveLength(2); expect(db.select().from(s.notes).all()).toHaveLength(2);
  });
  it("previews the exact import without persisting any writes", () => {
    const bundle = importer.ImportBundle.parse({ contacts: [{ name: "Alice Test", buyer: { targetAreas: ["Alpha"] } }], tasks: [{ title: "Call", contactName: "Alice Test" }] });
    const preview = importer.applyImport(bundle, { dryRun: true });
    expect(db.select().from(s.contacts).all()).toHaveLength(0);
    expect(db.select().from(s.activities).all()).toHaveLength(0);
    expect(importer.applyImport(bundle)).toEqual(preview);
  });
  it("rolls the whole import back on a later conflict", () => {
    importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "Alex Lee", email: "a@example.com" }, { name: "Alex Lee", email: "b@example.com" }] }));
    expect(() => importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "Do Not Save" }], tasks: [{ title: "Ambiguous", contactName: "Alex Lee" }] }))).toThrow();
    expect(db.select().from(s.contacts).all()).toHaveLength(2);
  });
  it("relinks unchanged vault notes after importing a contact", () => {
    fs.writeFileSync(path.join(fixture, "vault", "Alice Test.md"), "# Alice Test\nDiscuss house criteria.");
    obsidian.indexVault();
    importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "Alice Test" }] }));
    obsidian.indexVaultIfChanged();
    expect(obsidian.notesForContact(db.select().from(s.contacts).get()!.id)).toHaveLength(1);
  });
  it("requires consent before returning vault text for Claude", () => {
    expect(() => obsidian.vaultNoteTexts()).toThrow(/Allow vault text/);
  });
  it("keeps private vault priorities out of the outbound briefing payload", async () => {
    fs.writeFileSync(path.join(fixture, "vault", "Private.md"), "# Private\n#today\n- [ ] PRIVATE_VAULT_MARKER");
    const writeBriefing = vi.fn().mockResolvedValue("Safe briefing");
    vi.doMock("@/services/claude", () => ({ isClaudeConfigured: () => true, writeBriefing }));
    const { POST } = await import("@/app/api/claude/briefing/route");
    const response = await POST();
    expect(response.status).toBe(200);
    expect(writeBriefing).toHaveBeenCalledOnce();
    expect(JSON.stringify(writeBriefing.mock.calls)).not.toContain("PRIVATE_VAULT_MARKER");
    expect(obsidian.vaultTasks().some((t) => t.text === "PRIVATE_VAULT_MARKER")).toBe(true);
    vi.doUnmock("@/services/claude");
  });
  it("persists a proposal, requires approval, and makes approval idempotent", async () => {
    const p = reviews.proposeImport(importer.ImportBundle.parse({ contacts: [{ name: "Review Person" }] }), "Test");
    expect(db.select().from(s.contacts).all()).toHaveLength(0);
    const first = await reviews.decideReview(p.reviewId, true);
    expect(await reviews.decideReview(p.reviewId, true)).toEqual(first);
    expect(db.select().from(s.contacts).all()).toHaveLength(1);
    expect(backups.listBackups().length).toBeGreaterThan(0);
  });
  it("rejects stale previews and discarded proposals", async () => {
    const p = reviews.proposeImport(importer.ImportBundle.parse({ contacts: [{ name: "Pending" }] }), "Test");
    importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "New Person" }] }));
    await expect(reviews.decideReview(p.reviewId, true)).rejects.toThrow(/Records changed/);
    await reviews.decideReview(p.reviewId, false);
    await expect(reviews.decideReview(p.reviewId, true)).rejects.toThrow(/closed/);
  });
  it("restores a real SQLite snapshot and preserves a safety copy", async () => {
    importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "Keep Me" }] }));
    const b = await backups.createBackup();
    importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "Later Person" }] }));
    const result = await backups.restoreBackup(b.id);
    expect(result.safetyBackup).not.toBe(b.id);
    expect(db.select().from(s.contacts).all().map((c) => c.firstName)).toEqual(["Keep"]);
  });
  it.skipIf(process.platform !== "win32")("encrypts saved API keys using the Windows account", () => {
    const key = "synthetic-test-key-never-a-real-credential";
    const encryptedKey = connections.encryptApiKey(key);
    connections.saveConnections({ claude: { enabled: true, model: "test", encryptedKey } });
    expect(fs.readFileSync(connections.connectionFile(), "utf8")).not.toContain(key);
    expect(connections.claudeKey()).toBe(key);
    expect(JSON.stringify(connections.claudeStatus())).not.toContain(key);
  });
});
describe("layout and localhost security", () => {
  it("swaps rather than inserting and repairs duplicate saved IDs", () => {
    expect(swapLayout(["a", "b", "c"], "a", "c")).toEqual(["c", "b", "a"]);
    expect(normalizeLayout(["b", "b", "bad"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
  });
  it("blocks unauthenticated, cross-site and direct agent writes", () => {
    vi.stubEnv("COMMAND_CENTER_TOKEN", "test-token");
    const req = (url: string, headers = {}, method = "GET") => new NextRequest(url, { headers: { host: "localhost:3000", ...headers }, method });
    expect(middleware(req("http://localhost:3000/api/contacts")).status).toBe(401);
    expect(middleware(req("http://localhost:3000/api/contacts", { origin: "https://evil.example" })).status).toBe(403);
    expect(middleware(req("http://localhost:3000/api/contacts", { authorization: "Bearer test-token" }, "POST")).status).toBe(403);
    expect(middleware(req("http://localhost:3000/api/import/preview", { authorization: "Bearer test-token" }, "POST")).status).toBe(200);
    expect(middleware(req("http://localhost:3000/api/obsidian/notes", { authorization: "Bearer test-token" })).status).toBe(403);
    expect(middleware(req("http://localhost:3000/api/contacts", { host: "evil.example", authorization: "Bearer test-token" })).status).toBe(403);
  });
});
