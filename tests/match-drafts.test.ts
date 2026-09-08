import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
const provider = vi.hoisted(() => ({ create: vi.fn(), key: vi.fn()}));
vi.mock("@anthropic-ai/sdk", async (original) => {
  const actual = await original<typeof import("@anthropic-ai/sdk")>();
  return { ...actual, default: class { static APIError = actual.APIError; messages = { create: provider.create }; } };
});
vi.mock("@/lib/connections", () => ({ claudeKey: provider.key, claudeModel: () => "test-model", readConnections: () => ({}) }));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "realtorpro-match-"));
let db: typeof import("@/db").db;
let s: typeof import("@/db/schema");
let service: typeof import("@/services/match-drafts");
let packets: typeof import("@/services/match-packets");
let clear: typeof import("@/services/admin").clearAllData;
beforeAll(async () => {
  vi.stubEnv("WORKSPACE_DIR", fixture); vi.stubEnv("OBSIDIAN_VAULT_DIR", path.join(fixture, "vault")); fs.mkdirSync(path.join(fixture, "vault"));
  ({ db } = await import("@/db")); s = await import("@/db/schema");
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  packets = await import("@/services/match-packets"); service = await import("@/services/match-drafts"); ({ clearAllData: clear } = await import("@/services/admin"));
});
const text = { subject: "A home worth a look", email: "Hi Alex,\nThis home has 3 bedrooms. Would you like to discuss a showing?", sms: "Alex, 10 Test Way has 3 bedrooms. Want to take a look?" };
const response = (content = JSON.stringify(text), stop_reason = "end_turn") => ({ model: "test-model", content: [{ type: "text", text: content }], stop_reason, usage: { input_tokens: 10, output_tokens: 20 } });
beforeEach(() => {
  clear(); provider.create.mockReset().mockResolvedValue(response()); provider.key.mockReset().mockReturnValue("synthetic");
});
afterAll(() => { db.$client.close(); vi.unstubAllEnvs(); fs.rmSync(fixture, { recursive: true, force: true }); });
function seed(kind = "listing") {
  const c = db.insert(s.contacts).values({ firstName: "Alex", email: "alex@example.com", phone: "5551234567", notes: "PRIVATE CONTACT STRATEGY" }).returning().get();
  const b = db.insert(s.buyers).values({ contactId: c.id, priceMax: 700000, minBeds: 3, mustHaves: ["pool"], preApprovalAmount: 800000, notes: "PRIVATE BUYER NOTES" }).returning().get();
  const p = db.insert(s.properties).values({ address: "10 Test Way", beds: 3, notes: "no pool; PRIVATE PROPERTY NOTES" }).returning().get();
  const l = db.insert(s.listings).values({ propertyId: p.id, listPrice: 650000, status: "active", notes: "PRIVATE LISTING NOTES" }).returning().get();
  const o = db.insert(s.opportunities).values({ address: "20 Pocket Way", expectedPrice: 600000, beds: 3, notes: "PRIVATE SELLER MOTIVATION" }).returning().get();
  return { c, b, p, l, input: { id: randomUUID(), buyerId: b.id, candidateId: kind === "listing" ? l.id : o.id, kind, consent: true, options: {} } };
}
describe("Buyer Match message generation and PDF vault handoff", () => {
  it("requires consent, a real match and a Claude key before spending", async () => {
    const { input } = seed();
    await expect(service.generateMatchDraft({ ...input, consent: false })).rejects.toThrow();
    provider.key.mockReturnValue(null); await expect(service.generateMatchDraft(input)).rejects.toThrow(/Connect Claude/);
    provider.key.mockReturnValue("synthetic"); await expect(service.generateMatchDraft({ ...input, candidateId: "missing" })).rejects.toThrow(/no longer/);
    expect(provider.create).not.toHaveBeenCalled(); expect(db.select().from(s.matchDrafts).all()).toHaveLength(0);
  });
  it("saves both drafts, source snapshot and usage, without counting or sending; retries don't rebill", async () => {
    const { input, b } = seed(), draft = await service.generateMatchDraft(input);
    expect(draft).toMatchObject({ ...text, status: "complete", inPacket: true, recipient: "alex@example.com", stale: false });
    expect(draft.usage).toEqual({ inputTokens: 10, outputTokens: 20 }); expect(draft.estimatedCostUsd).toBeNull();
    expect(service.getMatchDraft(input.id).email).toBe(text.email);
    await service.generateMatchDraft(input); expect(provider.create).toHaveBeenCalledTimes(1);
    await expect(service.generateMatchDraft({ ...input, options: { tone: "concise" } })).rejects.toThrow(/another request/);
    expect(db.select().from(s.buyers).where(eq(s.buyers.id, b.id)).get()?.propertiesSent).toBe(0);
    expect(db.select().from(s.activities).all()).toHaveLength(0);
  });
  it("excludes private notes, phone, email and preapproval, treating keyword hits as unverified", async () => {
    const { input } = seed(); await service.generateMatchDraft(input);
    const data = JSON.parse(provider.create.mock.calls[0][0].messages[0].content);
    expect(JSON.stringify(data)).not.toMatch(/PRIVATE|5551234567|alex@example.com|800000/);
    expect(data.facts.reasons).not.toContain("Has pool"); expect(data.facts.concerns).toContain("Confirm feature from source: pool");
    expect(provider.create.mock.calls[0][0].system).toContain("untrusted");
  });
  it("handles off-market matches and flags changed source facts", async () => {
    const { input, b } = seed("opportunity"), draft = await service.generateMatchDraft(input);
    expect(JSON.parse(draft.context).property.address).toBe("20 Pocket Way");
    db.update(s.buyers).set({ status: "paused" }).where(eq(s.buyers.id, b.id)).run();
    expect(service.getMatchDraft(draft.id).stale).toBe(true);
    expect(service.listMatchDrafts({ buyerId: input.buyerId, candidateId: input.candidateId, kind: input.kind })).toHaveLength(1);
  });
  it("persists invalid/truncated provider output with usage, but never exports it", async () => {
    for (const reply of [response("not JSON"), response(JSON.stringify(text), "max_tokens"), response(JSON.stringify({ subject: "only" }))]) {
      const { input } = seed(); provider.create.mockResolvedValueOnce(reply);
      const draft = await service.generateMatchDraft(input);
      expect(draft.status).toBe("error"); expect(draft.usage?.outputTokens).toBe(20);
      expect(db.select().from(s.matchDrafts).where(eq(s.matchDrafts.id, draft.id)).get()?.rawResult).toBeTruthy();
      await expect(packets.createMatchPacket({ id: randomUUID(), title: "Test", drafts: [{ id: draft.id, revision: 0 }], approved: true })).rejects.toThrow(/changed/);
    }
  });
  it("preserves edited messages and rejects stale revisions or injected headers", async () => {
    const { input } = seed(), draft = await service.generateMatchDraft(input);
    const updated = service.editMatchDraft(draft.id, 0, { ...text, recipient: "reviewed@example.com", email: "Edited email" });
    expect(updated.revision).toBe(1); expect(updated.email).toBe("Edited email");
    expect(() => service.editMatchDraft(draft.id, 0, { ...text, recipient: "" })).toThrow(/another window/);
    expect(() => service.editMatchDraft(draft.id, 1, { ...text, subject: "Hello\r\nBcc: evil@example.com", recipient: "" })).toThrow();

  });
  it("creates a real PDF, clears the queue, preserves drafts, and saves safely to the vault", async () => {
    const { input, b } = seed(), draft = await service.generateMatchDraft(input);
    const packetInput = { id: randomUUID(), title: "Buyer match handoff", drafts: [{ id: draft.id, revision: 0 }], approved: true };
    const packet = await packets.createMatchPacket(packetInput);
    expect(fs.readFileSync(packets.matchPacketFile(packet.id).file).subarray(0, 5).toString()).toBe("%PDF-");
    expect(service.getMatchDraft(draft.id).inPacket).toBe(false); expect(service.getMatchDraft(draft.id).email).toBe(text.email);
    const saved = packets.saveMatchPacketToVault(packet.id);
    expect(saved.path).toBe("Command Center/Buyer Matches/" + packet.id + ".pdf");
    expect(fs.existsSync(path.join(fixture, "vault", saved.path))).toBe(true);
    expect(packets.saveMatchPacketToVault(packet.id)).toEqual(saved);
    expect((await packets.createMatchPacket(packetInput)).id).toBe(packet.id);
    expect(packets.listMatchPackets()).toHaveLength(1);
    expect(db.select().from(s.buyers).where(eq(s.buyers.id, b.id)).get()?.propertiesSent).toBe(0);
  });
  it("requires approval, rejects changed revisions, duplicate selections and versions", async () => {
    const { input } = seed(), a = await service.generateMatchDraft(input);
    const params = { id: randomUUID(), title: "Review", drafts: [{ id: a.id, revision: 0 }], approved: true };
    await expect(packets.createMatchPacket({ ...params, approved: false })).rejects.toThrow();
    await expect(packets.createMatchPacket({ ...params, drafts: [...params.drafts, ...params.drafts] })).rejects.toThrow();
    const b = await service.generateMatchDraft({ ...input, id: randomUUID() });
    await expect(packets.createMatchPacket({ ...params, drafts: [...params.drafts, { id: b.id, revision: 0 }] })).rejects.toThrow(/one draft version/);
    service.editMatchDraft(a.id, 0, { ...text, recipient: "edited@example.com" });
    await expect(packets.createMatchPacket(params)).rejects.toThrow(/changed/);
  });
  it("never overwrites an existing vault file and blocks a linked export folder", async () => {
    const { input } = seed(), draft = await service.generateMatchDraft(input);
    const packet = await packets.createMatchPacket({ id: randomUUID(), title: "Safe export", drafts: [{ id: draft.id, revision: 0 }], approved: true });
    const saved = packets.saveMatchPacketToVault(packet.id), target = path.join(fixture, "vault", saved.path);
    fs.writeFileSync(target, "EXISTING FILE");
    expect(() => packets.saveMatchPacketToVault(packet.id)).toThrow(/not overwritten/);
    expect(fs.readFileSync(target, "utf8")).toBe("EXISTING FILE");
    const root = path.join(fixture, "linked-vault"), elsewhere = path.join(fixture, "elsewhere");
    fs.mkdirSync(root); fs.mkdirSync(elsewhere); fs.symlinkSync(elsewhere, path.join(root, "Command Center"), process.platform === "win32" ? "junction" : "dir");
    vi.stubEnv("OBSIDIAN_VAULT_DIR", root);
    expect(() => packets.saveMatchPacketToVault(packet.id)).toThrow(/linked/);
    expect(fs.readdirSync(elsewhere)).toEqual([]);
    vi.stubEnv("OBSIDIAN_VAULT_DIR", path.join(fixture, "vault"));
  });
  it("supports queue selection, missing recipients, and rejects unsupported PDF glyphs explicitly", async () => {
    const { input } = seed(), draft = await service.generateMatchDraft(input);
    service.setInPacket(draft.id, false); expect(service.packetQueue()[0].inPacket).toBe(false);
    service.setInPacket(draft.id, true); expect(service.packetQueue()[0].inPacket).toBe(true);
    service.editMatchDraft(draft.id, 0, { ...text, recipient: "", email: "Missing address is flagged in the PDF." });
    const p = await packets.createMatchPacket({ id: randomUUID(), title: "Missing recipient", drafts: [{ id: draft.id, revision: 1 }], approved: true });
    expect(p.filename).toMatch(/Buyer matches/);
    await expect(packets.renderMatchPacket("Unsupported 🏠", [], new Date().toISOString())).rejects.toThrow(/unsupported characters/);
  });
});
