import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

// Only the paid provider boundary is simulated. SQLite, retrieval, validation,
// persisted history, review previews, backups and approval are the real services.
const provider = vi.hoisted(() => ({ create: vi.fn(), key: vi.fn() }));
vi.mock("@anthropic-ai/sdk", async (original) => {
  const actual = await original<typeof import("@anthropic-ai/sdk")>();
  return { ...actual, default: class { static APIError = actual.APIError; messages = { create: provider.create }; } };
});
vi.mock("@/lib/connections", () => ({ claudeKey: provider.key, claudeModel: () => "test-model" }));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "realtorpro-jarvis-"));
let db: typeof import("@/db").db;
let s: typeof import("@/db/schema");
let jarvis: typeof import("@/services/jarvis");
let scheduling: typeof import("@/services/scheduling");
let reviews: typeof import("@/services/reviews");
let clear: typeof import("@/services/admin").clearAllData;
beforeAll(async () => {
  vi.stubEnv("WORKSPACE_DIR", path.join(fixture, "workspace"));
  vi.stubEnv("OBSIDIAN_VAULT_DIR", path.join(fixture, "vault"));
  ({ db } = await import("@/db")); s = await import("@/db/schema");
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  jarvis = await import("@/services/jarvis"); scheduling = await import("@/services/scheduling");
  reviews = await import("@/services/reviews"); ({ clearAllData: clear } = await import("@/services/admin"));
});
beforeEach(() => { clear(); provider.create.mockReset(); provider.key.mockReset().mockReturnValue("synthetic-test-key"); });
afterAll(() => { db.$client.close(); vi.unstubAllEnvs(); fs.rmSync(fixture, { recursive: true, force: true }); });
const request = (extra = {}) => ({ id: randomUUID(), question: "What does Alex want?", consent: true, ...extra });
const reply = (content: unknown[], stop_reason = "end_turn") => ({ model: "test-model", content, stop_reason, usage: { input_tokens: 10, output_tokens: 5 } });
const textReply = (text = "Here are the saved details.") => reply([{ type: "text", text }]);
const toolReply = (name: string, input: unknown) => reply([{ type: "tool_use", id: randomUUID(), name, input }], "tool_use");
const contact = () => db.insert(s.contacts).values({ firstName: "Alex", lastName: "JarvisTest", notes: "Looking for a duplex. Imported CRM note, not a raw vault file." }).returning().get();
const appointment = (extra = {}) => ({ entity: "appointments" as const, fields: { title: "Jarvis test meeting", startsAt: "2030-06-04T14:00", endsAt: "2030-06-04T14:30", ...extra } });

describe("Jarvis grounded lookup and approval-only scheduling", () => {
  it("requires consent and a configured connection before storing or billing", async () => {
    await expect(jarvis.askJarvis(request({ consent: false }))).rejects.toThrow();
    provider.key.mockReturnValue(null);
    await expect(jarvis.askJarvis(request())).rejects.toThrow(/Connect Claude/);
    expect(provider.create).not.toHaveBeenCalled();
    expect(jarvis.listJarvisTurns()).toEqual([]);
  });
  it("allows CRM lookups but not settings, vault files, arbitrary tables or unknown fields", () => {
    const c = contact();
    expect(jarvis.findJarvisRecords({ entity: "contacts", query: "Alex JarvisTest" }).sources[0].href).toBe(`/contacts/${c.id}`);
    for (const entity of ["settings", "vaultNotes", "jarvisTurns", "__proto__", "contacts; DROP TABLE contacts"]) expect(() => jarvis.findJarvisRecords({ entity })).toThrow();
    expect(() => jarvis.findJarvisRecords({ entity: "contacts", path: "/private" })).toThrow();
    expect(jarvis.findJarvisRecords({ entity: "contacts", query: "nobody" }).records).toEqual([]);
  });
  it("retrieves real investor data, persists sources/usage and replays an ID without another bill", async () => {
    const c = contact();
    db.insert(s.investors).values({ contactId: c.id, budgetMax: 700000, strategy: "buy_and_hold" }).run();
    provider.create.mockResolvedValueOnce(toolReply("find_records", { entity: "contacts", query: "Alex" }))
      .mockResolvedValueOnce(toolReply("find_records", { entity: "investors", contactId: c.id }))
      .mockResolvedValueOnce(textReply("Alex's saved maximum budget is $700,000."));
    const input = request(); const turn = await jarvis.askJarvis(input);
    expect(turn).toMatchObject({ status: "complete", reviewId: null, usage: { inputTokens: 30, outputTokens: 15, requests: 3 }, estimatedCostUsd: null });
    expect(turn.sources.map((r) => r.entity)).toEqual(["contacts", "investors"]);
    expect(JSON.stringify(provider.create.mock.calls[2][0].messages)).toContain("700000");
    expect(JSON.stringify(provider.create.mock.calls[2][0])).not.toContain("synthetic-test-key");
    expect(jarvis.getJarvisTurn(input.id).answer).toBe(turn.answer);
    await jarvis.askJarvis(input); expect(provider.create).toHaveBeenCalledTimes(3);
    await expect(jarvis.askJarvis({ ...input, question: "Different" })).rejects.toThrow(/already used/);
  });
  it("keeps a task, call and appointment as one review; approval saves once and atomically", async () => {
    const c = contact();
    const items = [{ entity: "tasks", fields: { title: "Prepare duplex shortlist", contactId: c.id, dueDate: "2030-06-04" } }, { entity: "calls", fields: { contactId: c.id, scheduledDate: "2030-06-04", scheduledTime: "13:00", reason: "Discuss shortlist" } }, appointment({ contactId: c.id })];
    provider.create.mockResolvedValueOnce(toolReply("find_records", { entity: "contacts", id: c.id }))
      .mockResolvedValueOnce(toolReply("prepare_schedule", { items })).mockResolvedValueOnce(textReply("Three drafts are ready for your approval."));
    const turn = await jarvis.askJarvis(request({ question: "Draft these three scheduling items", allowScheduling: true }));
    expect(turn.status).toBe("complete"); expect(turn.drafts).toHaveLength(3); expect(turn.reviewStatus).toBe("pending");
    for (const table of [s.tasks, s.calls, s.appointments]) expect(db.select().from(table).all()).toHaveLength(0);
    await reviews.decideReview(turn.reviewId!, true);
    await reviews.decideReview(turn.reviewId!, true);
    for (const table of [s.tasks, s.calls, s.appointments]) expect(db.select().from(table).all()).toHaveLength(1);
    expect(jarvis.getJarvisTurn(turn.id).reviewStatus).toBe("applied");
  });
  it("refuses scheduling tools when disabled and requires IDs from current lookups", async () => {
    const c = contact();
    for (const allowScheduling of [false, true]) {
      provider.create.mockResolvedValueOnce(toolReply("prepare_schedule", { items: [{ entity: "tasks", fields: { title: "Call Alex", contactId: c.id } }] })).mockResolvedValueOnce(textReply("I need to look up that contact first."));
      const turn = await jarvis.askJarvis(request({ allowScheduling }));
      expect(turn.drafts).toEqual([]); expect(turn.reviewId).toBeNull();
    }
    expect(db.select().from(s.tasks).all()).toHaveLength(0);
  });
  it("rejects missing/invalid dates, invented IDs and edits disguised as creation", () => {
    const c = contact();
    const bad = [
      { entity: "calls", fields: { contactId: c.id, scheduledDate: "2030-06-04" } },
      { entity: "tasks", fields: { title: "Invalid day", dueDate: "2030-02-30" } },
      { entity: "tasks", fields: { title: "Missing day", dueTime: "14:00" } },
      { entity: "tasks", fields: { title: "Unknown", contactId: "not-real" } },
      { entity: "tasks", fields: { title: "Sneaky edit", completedAt: "2030-06-04" } },
      appointment({ endsAt: "2030-06-04T13:00" }), appointment({ endsAt: null }), appointment({ startsAt: "2030-06-04T14:00Z" }),
    ];
    for (const item of bad) expect(() => scheduling.validateSchedule([item])).toThrow();
  });
  it("checks overlaps both within a batch and against existing local appointments", () => {
    expect(() => scheduling.validateSchedule([appointment(), appointment({ startsAt: "2030-06-04T14:15" })])).toThrow(/overlaps/);
    db.insert(s.appointments).values(appointment().fields).run();
    expect(() => scheduling.validateSchedule([appointment()])).toThrow(/overlaps/);
    expect(scheduling.validateSchedule([appointment({ startsAt: "2030-06-04T14:30", endsAt: "2030-06-04T15:00" })])).toHaveLength(1);
  });
  it("rejects stale approval after a new appointment and does not save any batch item", async () => {
    const proposed = reviews.propose({ action: "schedule", items: [{ entity: "tasks", fields: { title: "Should remain unsaved" } }, appointment()] });
    db.insert(s.appointments).values(appointment().fields).run();
    await expect(reviews.decideReview(proposed.reviewId, true)).rejects.toThrow(/changed/i);
    expect(db.select().from(s.tasks).all()).toHaveLength(0);
    expect(db.select().from(s.appointments).all()).toHaveLength(1);
  });
  it("discarding a review leaves CRM records untouched", async () => {
    const proposed = reviews.propose({ action: "schedule", items: [appointment()] });
    await reviews.decideReview(proposed.reviewId, false);
    expect(db.select().from(s.appointments).all()).toHaveLength(0);
    await expect(reviews.decideReview(proposed.reviewId, true)).rejects.toThrow(/closed/);
  });
  it("saves sanitized provider failures and never leaves scheduling proposals on failed answers", async () => {
    provider.create.mockResolvedValueOnce(toolReply("prepare_schedule", { items: [appointment()] })).mockRejectedValueOnce(new Error("synthetic-test-key private vendor failure"));
    const turn = await jarvis.askJarvis(request({ allowScheduling: true }));
    expect(turn.status).toBe("error"); expect(turn.error).not.toContain("synthetic-test-key");
    expect(turn.reviewId).toBeNull(); expect(db.select().from(s.reviews).all()).toHaveLength(0);
    expect(db.select().from(s.appointments).all()).toHaveLength(0);
    expect(turn.usage?.requests).toBe(1);
  });
  it("bounds tool loops and preserves a retrievable error instead of continuing billing", async () => {
    provider.create.mockImplementation(async () => toolReply("find_records", { entity: "contacts" }));
    const turn = await jarvis.askJarvis(request());
    expect(provider.create).toHaveBeenCalledTimes(6); expect(turn.status).toBe("error");
    expect(turn.error).toMatch(/limit/); expect(jarvis.listJarvisTurns()[0].id).toBe(turn.id);
  });
  it("carries saved follow-up context without invalidating a pending scheduling review", async () => {
    provider.create.mockResolvedValueOnce(toolReply("prepare_schedule", { items: [appointment()] })).mockResolvedValueOnce(textReply("Draft ready; not booked."));
    const first = await jarvis.askJarvis(request({ allowScheduling: true }));
    provider.create.mockResolvedValueOnce(textReply("The draft still needs your approval."));
    const next = await jarvis.askJarvis(request({ parentId: first.id, question: "Is it booked?" }));
    expect(next.parentId).toBe(first.id);
    expect(JSON.stringify(provider.create.mock.calls[2][0].messages)).toContain("Draft ready; not booked.");
    await reviews.decideReview(first.reviewId!, true);
    expect(db.select().from(s.appointments).all()).toHaveLength(1);
  });
});
