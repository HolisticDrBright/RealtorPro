import { beforeEach, afterEach, afterAll, describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const native = vi.hoisted(() => ({ ready: vi.fn(), keychain: vi.fn() }));
vi.mock("@/lib/mac-native", () => ({ macHelperReady: native.ready, macKeychain: native.keychain }));
import { claudeKey, claudeStatus, connectionFile, readConnections, saveConnections, saveClaudeConnection, disconnectClaude } from "@/lib/connections";

const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "realtorpro-mac-test-"));
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
const items = new Map<string, string>();
beforeEach(() => {
  vi.stubEnv("WORKSPACE_DIR", fixture); vi.stubEnv("ANTHROPIC_API_KEY", "");
  Object.defineProperty(process, "platform", { value: "darwin" });
  items.clear(); native.ready.mockReset().mockReturnValue(true); native.keychain.mockReset();
  native.keychain.mockImplementation((action: string, account: string, key?: string) => {
    if (action === "set") { items.set(account, key!); return ""; }
    if (action === "delete") { items.delete(account); return ""; }
    if (!items.has(account)) throw new Error("Locked or missing");
    return items.get(account);
  });
  saveConnections({ vault: { dir: "/Users/test/My Vault", include: [], exclude: [], allowClaude: false } });
});
afterEach(() => { Object.defineProperty(process, "platform", platform); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));

describe("Mac connection lifecycle with an isolated Keychain adapter", () => {
  it("stores only an opaque reference, retrieves the key, and never exposes it in status", () => {
    const secret = "synthetic-credential-not-real";
    expect(saveClaudeConnection(secret, "claude-test")).toBeNull();
    expect(readConnections().claude?.keychainAccount).toMatch(/^[0-9a-f-]{36}$/);
    expect(fs.readFileSync(connectionFile(), "utf8")).not.toContain(secret);
    expect(claudeKey()).toBe(secret);
    expect(claudeStatus()).toMatchObject({ configured: true, storage: "macOS Keychain", canSaveKey: true });
    expect(JSON.stringify(claudeStatus())).not.toContain(secret);
    expect(readConnections().vault?.dir).toBe("/Users/test/My Vault");
  });
  it("rotates the key and removes only the old referenced item", () => {
    saveClaudeConnection("first", "claude-test"); const old = readConnections().claude!.keychainAccount!;
    saveClaudeConnection("second", "claude-test");
    expect(items.has(old)).toBe(false); expect(items.size).toBe(1); expect(claudeKey()).toBe("second");
  });
  it("preserves the old connection when Keychain saving is denied", () => {
    saveClaudeConnection("first", "claude-test"); const before = readConnections();
    native.keychain.mockImplementationOnce(() => { throw new Error("denied"); });
    expect(() => saveClaudeConnection("second", "claude-test")).toThrow();
    expect(readConnections()).toEqual(before); expect(claudeKey()).toBe("first");
  });
  it("rolls back the new Keychain item if settings cannot be written", () => {
    saveClaudeConnection("first", "claude-test"); const before = readConnections();
    vi.spyOn(fs, "renameSync").mockImplementationOnce(() => { throw new Error("disk full"); });
    expect(() => saveClaudeConnection("second", "claude-test")).toThrow(/previous connection/);
    expect(readConnections()).toEqual(before); expect(items.size).toBe(1);
  });
  it("disconnects, removes the key and overrides a legacy environment credential", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "old-env-credential");
    saveClaudeConnection("new", "claude-test"); disconnectClaude("claude-test");
    expect(items.size).toBe(0); expect(claudeKey()).toBeUndefined(); expect(claudeStatus().configured).toBe(false);
    saveClaudeConnection("reconnected", "claude-test"); expect(claudeKey()).toBe("reconnected");
  });
  it("disables Claude even when Keychain deletion fails and surfaces cleanup instructions", () => {
    saveClaudeConnection("first", "claude-test");
    native.keychain.mockImplementationOnce(() => { throw new Error("locked"); });
    expect(disconnectClaude("claude-test")).toMatch(/Keychain Access/);
    expect(claudeKey()).toBeUndefined();
  });
  it("does not silently fall back to a different environment key when Keychain is locked", () => {
    saveClaudeConnection("first", "claude-test"); vi.stubEnv("ANTHROPIC_API_KEY", "wrong-account");
    native.keychain.mockImplementationOnce(() => { throw new Error("locked"); });
    expect(() => claudeKey()).toThrow(/locked/);
  });
  it("can migrate an environment-only credential into Keychain without editing .env", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "environment-test");
    expect(claudeStatus().storage).toBe("Environment");
    saveClaudeConnection(claudeKey()!, "claude-test");
    expect(claudeStatus().storage).toBe("macOS Keychain"); expect(claudeKey()).toBe("environment-test");
  });
  it("reports copied Windows connections as requiring reconnection", () => {
    saveConnections({ claude: { enabled: true, model: "claude-test", encryptedKey: "windows-only" } });
    expect(claudeStatus()).toMatchObject({ configured: false, needsReconnect: true });
    expect(() => claudeKey()).toThrow(/Windows/);
    saveClaudeConnection("mac-key", "claude-test"); expect(claudeKey()).toBe("mac-key");
  });
  it("does not claim in-app storage is ready when the native helper is missing", () => {
    native.ready.mockReturnValue(false); expect(claudeStatus().canSaveKey).toBe(false);
  });
});
