import { afterEach, describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { macHelperReady, macKeychain, chooseMacFolder } from "@/lib/mac-native";
import { parsePort, isOurAppReady } from "@/lib/desktop";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
describe("desktop safeguards", () => {
  it("rejects invalid ports and shell-like input", () => {
    expect(parsePort()).toBe(3000); expect(parsePort("3100")).toBe(3100);
    for (const port of ["0", "80", "65536", "-5", "3000;open", "abc", ""]) expect(() => parsePort(port)).toThrow();
  });
  it("requires authenticated healthy responses before reopening an existing app", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "healthy", mode: "private-local" }), { status: 200 }));
    expect(await isOurAppReady(3000, "synthetic-token")).toBe(true);
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({ Authorization: "Bearer synthetic-token" });
    fetcher.mockResolvedValueOnce(new Response("{}", { status: 401 })); expect(await isOurAppReady(3000, "wrong")).toBe(false);
    fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ status: "healthy" }))); expect(await isOurAppReady(3000, "wrong")).toBe(false);
  });
  it("allows the native picker only for same-origin authenticated browser actions", () => {
    vi.stubEnv("COMMAND_CENTER_TOKEN", "synthetic-token");
    const request = (headers: Record<string, string>) => new NextRequest("http://localhost:3000/api/integrations/vault-picker", { method: "POST", headers: { host: "localhost:3000", ...headers } });
    expect(middleware(request({})).status).toBe(401);
    expect(middleware(request({ authorization: "Bearer synthetic-token" })).status).toBe(403);
    expect(middleware(request({ cookie: "cc-session=synthetic-token", origin: "https://evil.example" })).status).toBe(403);
    expect(middleware(request({ cookie: "cc-session=synthetic-token", origin: "http://localhost:3000" })).status).toBe(200);
  });
  it.skipIf(process.platform === "darwin")("does not open a Mac dialog on other systems", async () => {
    expect(macHelperReady()).toBe(false);
    await expect(chooseMacFolder()).rejects.toThrow(/Browse folders/);
  });
});

describe.skipIf(process.platform !== "darwin")("real macOS Keychain (synthetic item only)", () => {
  it("compiles the helper and round-trips a unique test item, then deletes it", () => {
    execFileSync(process.execPath, ["scripts/macos/build-helper.mjs"], { stdio: "pipe", timeout: 65000 });
    expect(macHelperReady()).toBe(true);
    const account = randomUUID();
    try {
      macKeychain("set", account, "synthetic-mac-test-not-an-api-key");
      expect(macKeychain("get", account)).toBe("synthetic-mac-test-not-an-api-key");
    } finally { macKeychain("delete", account); }
    expect(() => macKeychain("get", account)).toThrow();
  }, 90000);
});
