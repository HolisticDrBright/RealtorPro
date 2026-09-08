import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { investorProfileSchema } from "@/lib/investors";
import { recordTypeOf } from "@/lib/obsidian";

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "realtorpro-investors-"));
let db: typeof import("@/db").db;
let s: typeof import("@/db/schema");
let importer: typeof import("@/services/importer");
let reviews: typeof import("@/services/reviews");
let backups: typeof import("@/services/backups");
let collection: typeof import("@/app/api/[entity]/route");
let record: typeof import("@/app/api/[entity]/[id]/route");
let clear: typeof import("@/services/admin").clearAllData;
beforeAll(async () => {
  vi.stubEnv("WORKSPACE_DIR", path.join(fixture, "workspace"));
  vi.stubEnv("OBSIDIAN_VAULT_DIR", path.join(fixture, "vault"));
  ({ db } = await import("@/db")); s = await import("@/db/schema");
  migrate(db, { migrationsFolder: path.resolve("drizzle") });
  importer = await import("@/services/importer"); reviews = await import("@/services/reviews"); backups = await import("@/services/backups");
  collection = await import("@/app/api/[entity]/route"); record = await import("@/app/api/[entity]/[id]/route");
  ({ clearAllData: clear } = await import("@/services/admin"));
});
beforeEach(() => clear());
afterAll(() => { db.$client.close(); vi.unstubAllEnvs(); fs.rmSync(fixture, { recursive: true, force: true }); });
const request = (method: string, body?: unknown) => new NextRequest("http://localhost:3000/api/investors", { method, headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const ctx = (id: string, entity = "investors") => ({ params: Promise.resolve({ entity, id }) });
const create = (body: unknown) => collection.POST(request("POST", body), { params: Promise.resolve({ entity: "investors" }) });
const bundle = (investor: Record<string, unknown> = {}) => importer.ImportBundle.parse({ contacts: [{ name: "Investor Test", email: "investor-test@example.com", investor: { strategy: "buy_and_hold", targetAreas: ["Test Market"], budgetMin: 200000, budgetMax: 800000, ...investor } }] });

describe("investor profiles", () => {
  it("starts empty and validates currency without inventing unknown amounts", () => {
    expect(db.select().from(s.investors).all()).toHaveLength(0);
    expect(investorProfileSchema.parse({ budgetMax: "$1.5M", availableCapital: "" })).toMatchObject({ budgetMax: 1500000, availableCapital: null });
    for (const value of [-5, "-5k", "nonsense", Infinity]) expect(investorProfileSchema.safeParse({ availableCapital: value }).success).toBe(false);
    expect(investorProfileSchema.safeParse({ targetCapRate: 101 }).success).toBe(false);
    expect(investorProfileSchema.parse({}).availableCapital).toBeUndefined();
  });
  it("creates, lists, edits, reloads and deletes through the real API handlers", async () => {
    const contact = db.insert(s.contacts).values({ firstName: "Investor", lastName: "Test" }).returning().get();
    const response = await create({ contactId: contact.id, strategy: "fix_and_flip", budgetMin: 100000, budgetMax: 500000 });
    expect(response.status).toBe(201);
    const { item } = await response.json();
    expect(db.select().from(s.contacts).get()?.type).toBe("investor");
    expect((await (await record.GET(request("GET"), ctx(item.id))).json()).item.availableCapital).toBeNull();
    expect((await collection.GET(request("GET"), { params: Promise.resolve({ entity: "investors" }) })).status).toBe(200);
    expect((await record.PATCH(request("PATCH", { status: "paused", availableCapital: 90000 }), ctx(item.id))).status).toBe(200);
    expect(db.select().from(s.investors).get()?.availableCapital).toBe(90000);
    expect((await record.DELETE(request("DELETE"), ctx(item.id))).status).toBe(200);
    expect(db.select().from(s.contacts).all()).toHaveLength(1);
  });
  it("rejects duplicate profiles with an actionable conflict", async () => {
    importer.applyImport(bundle());
    const response = await create({ contactId: db.select().from(s.contacts).get()!.id });
    expect(response.status).toBe(409);
    expect((await response.json()).error.message).toMatch(/already has an investor profile/);
    expect(db.select().from(s.investors).all()).toHaveLength(1);
  });
  it("rolls back invalid full budgets on create and partial update", async () => {
    const contact = db.insert(s.contacts).values({ firstName: "Budget" }).returning().get();
    expect((await create({ contactId: contact.id, budgetMin: 500, budgetMax: 100 })).status).toBe(422);
    expect(db.select().from(s.investors).all()).toHaveLength(0);
    const { item } = await (await create({ contactId: contact.id, budgetMin: 100, budgetMax: 500 })).json();
    expect((await record.PATCH(request("PATCH", { budgetMax: 50 }), ctx(item.id))).status).toBe(422);
    expect(db.select().from(s.investors).get()?.budgetMax).toBe(500);
    expect((await record.PATCH(request("PATCH", { budgetMin: null }), ctx(item.id))).status).toBe(200);
    expect(db.select().from(s.investors).get()?.budgetMin).toBeNull();
  });
  it("preserves buyer relationships and cascades with contact deletion", async () => {
    const c = db.insert(s.contacts).values({ firstName: "Multi", type: "buyer" }).returning().get();
    await create({ contactId: c.id });
    expect(db.select().from(s.contacts).get()?.type).toBe("buyer");
    expect((await record.DELETE(request("DELETE"), ctx(c.id, "contacts"))).status).toBe(200);
    expect(db.select().from(s.investors).all()).toHaveLength(0);
  });
  it("previews without writes; approval and repeat imports keep one profile", async () => {
    const proposed = reviews.proposeImport(bundle({ availableCapital: 150000 }), "Investor test");
    expect(db.select().from(s.investors).all()).toHaveLength(0);
    expect(db.select().from(s.contacts).all()).toHaveLength(0);
    await reviews.decideReview(proposed.reviewId, true);
    importer.applyImport(bundle({ availableCapital: null, targetAreas: [], status: "nurture" }));
    const rows = db.select().from(s.investors).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ availableCapital: 150000, targetAreas: ["Test Market"], status: "nurture" });
  });
  it("validates imported partial budgets against the existing profile", () => {
    importer.applyImport(bundle());
    expect(() => importer.applyImport(importer.ImportBundle.parse({ contacts: [{ name: "Investor Test", email: "investor-test@example.com", investor: { budgetMax: 100 } }] }))).toThrow(/Maximum budget/);
    expect(db.select().from(s.investors).get()?.budgetMax).toBe(800000);
  });
  it("invalidates pending reviews when an investor profile changes", async () => {
    importer.applyImport(bundle());
    const proposed = reviews.proposeImport(bundle({ status: "paused" }), "Investor test");
    const investor = db.select().from(s.investors).get()!;
    db.update(s.investors).set({ notes: "Changed after review" }).where(eq(s.investors.id, investor.id)).run();
    await expect(reviews.decideReview(proposed.reviewId, true)).rejects.toThrow(/changed/i);
  });
  it("maps investor vault frontmatter and keeps follow-ups on the contact", async () => {
    const { noteToBundle } = await import("@/services/obsidian");
    expect(recordTypeOf({ type: "investor" })).toBe("investor");
    const b = importer.ImportBundle.parse(noteToBundle({ strategy: "commercial", budgetMax: "$2M", propertyTypes: ["Retail"], nextFollowUp: "2026-10-01" }, "investor", "Vault Investor", "Needs a property manager."));
    importer.applyImport(b);
    expect(db.select().from(s.investors).get()).toMatchObject({ strategy: "commercial", budgetMax: 2000000, propertyTypes: ["Retail"] });
    expect(db.select().from(s.contacts).get()?.nextFollowUpAt).toBe("2026-10-01");
    expect(db.select().from(s.buyers).all()).toHaveLength(0);
  });
  it("backs up and restores investor profiles with the rest of the workspace", async () => {
    importer.applyImport(bundle());
    const backup = await backups.createBackup();
    db.delete(s.investors).run();
    await backups.restoreBackup(backup.id);
    expect(db.select().from(s.investors).all()).toHaveLength(1);
  });
});
