import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const state = vi.hoisted(() => ({ vault: {} }));
vi.mock("@/lib/connections", () => ({ readConnections: () => ({ vault: state.vault }) }));
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "realtorpro-vault-access-"));
const vault = path.join(fixture, "vault");
let service: typeof import("@/services/jarvis-vault");
let db: typeof import("@/db").db;
beforeAll(async () => {
  vi.stubEnv("WORKSPACE_DIR", path.join(fixture, "workspace"));
  fs.mkdirSync(path.join(vault, "Clients"), { recursive: true }); fs.mkdirSync(path.join(vault, "Private")); fs.mkdirSync(path.join(vault, ".obsidian"));
  fs.writeFileSync(path.join(vault, "Clients", "Alex.md"), "# Alex\nBudget 700000.\nPreserve unrelated content.\n"); fs.writeFileSync(path.join(vault, "Private", "Secret.md"), "Excluded.");
  service = await import("@/services/jarvis-vault"); ({ db } = await import("@/db"));
});
beforeEach(() => { state.vault = { dir: vault, include: [], exclude: ["Private"], allowClaude: true }; });
afterAll(() => { db.$client.close(); vi.unstubAllEnvs(); fs.rmSync(fixture, { recursive: true, force: true }); });
describe("direct vault access and reviewed editing", () => {
  it("searches unimported content with source links and reads exact chunks", () => {
    const found = service.searchJarvisVault({ query: "700000" }); expect(found.matches[0].path).toBe("Clients/Alex.md");
    const note = service.readJarvisVaultNote("Clients/Alex.md", 0, 6); expect(note.text).toBe("# Alex"); expect(note.nextOffset).toBe(6); expect(note.uri).toMatch(/^obsidian:\/\/open/);
  });
  it("enforces cloud consent, folder filters, hidden paths, traversal and linked files", () => {
    const outside = path.join(fixture, "outside"); fs.mkdirSync(outside, { recursive: true }); fs.writeFileSync(path.join(outside, "Private.md"), "Outside the vault.");
    fs.symlinkSync(outside, path.join(vault, "Linked"), process.platform === "win32" ? "junction" : "dir");
    expect(() => service.readJarvisVaultNote("Linked/Private.md")).toThrow(/Linked/);
    expect(service.searchJarvisVault({ query: "Outside the vault" }).matches).toEqual([]);
    for (const rel of ["Private/Secret.md", "../outside.md", "C:/Users/file.md", ".obsidian/config.md", "Clients/../Private/Secret.md", "Clients\\Alex.md", "Clients/not.md:stream"]) expect(() => service.readJarvisVaultNote(rel)).toThrow();
    state.vault = { dir: vault, include: ["Other"], exclude: [], allowClaude: true }; expect(() => service.readJarvisVaultNote("Clients/Alex.md")).toThrow();
    state.vault = { dir: vault, include: [], exclude: [], allowClaude: false }; expect(() => service.searchJarvisVault({})).toThrow(/Allow selected/);
  });
  it("does not write while preparing; saves a backup and refuses stale edits", () => {
    const note = service.readJarvisVaultNote("Clients/Alex.md"); const newText = note.text + "New approved line.\n";
    const proposal = service.prepareVaultWrite(note.path, newText, note.sha256); expect(fs.readFileSync(path.join(vault, note.path), "utf8")).toBe(note.text);
    const id = crypto.randomUUID(); service.applyVaultWrite(proposal, id); service.applyVaultWrite(proposal, id);
    expect(fs.readFileSync(path.join(vault, note.path), "utf8")).toBe(newText);
    const backup = JSON.parse(fs.readFileSync(path.join(fixture, "workspace/backups/vault", id + ".json"), "utf8")); expect(backup.before).toBe(note.text);
    expect(() => service.prepareVaultWrite(note.path, "Overwrite stale", note.sha256)).toThrow(/changed/);
  });
  it("creates only new files and rejects approval when vault permissions change", () => {
    const p = service.prepareVaultWrite("Clients/New.md", "A new note", null);
    state.vault = { dir: vault, include: ["Clients"], exclude: [], allowClaude: true }; expect(() => service.applyVaultWrite(p, crypto.randomUUID())).toThrow(/changed/);
    state.vault = { dir: vault, include: [], exclude: ["Private"], allowClaude: true }; service.applyVaultWrite(p, crypto.randomUUID());
    expect(() => service.prepareVaultWrite("Clients/New.md", "overwrite", null)).toThrow(/already exists/);
  });
});
