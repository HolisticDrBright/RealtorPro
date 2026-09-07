import { beforeEach, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@/lib/errors";
const mocks = vi.hoisted(() => ({ retrieve: vi.fn(), save: vi.fn(), key: vi.fn(), disconnect: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error { constructor(public status: number) { super("provider detail must not leak"); } }
  class Anthropic { static APIError = APIError; models = { retrieve: mocks.retrieve }; }
  return { default: Anthropic };
});
vi.mock("@/lib/connections", () => ({ claudeKey: mocks.key, claudeModel: () => "claude-test", disconnectClaude: mocks.disconnect, saveClaudeConnection: mocks.save, readConnections: () => ({}), saveConnections: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/db/schema", () => ({ vaultNotes: {} }));
vi.mock("@/services/obsidian", () => ({ indexVault: vi.fn() }));
import { POST } from "@/app/api/integrations/connect/route";
import Anthropic from "@anthropic-ai/sdk";
const request = (body: object) => new NextRequest("http://localhost:3000/api/integrations/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); mocks.retrieve.mockResolvedValue({ id: "claude-test" }); mocks.save.mockReturnValue(null); });
it("verifies before saving and does not return the credential", async () => {
  const response = await POST(request({ kind: "claude", key: "synthetic-not-real", model: "claude-test" }));
  expect(response.status).toBe(200); expect(mocks.save).toHaveBeenCalledWith("synthetic-not-real", "claude-test");
  expect(await response.text()).not.toContain("synthetic-not-real");
});
it("returns a useful Keychain error after provider verification succeeds", async () => {
  mocks.save.mockImplementation(() => { throw new AppError("unprocessable", "Unlock your macOS Keychain and try again."); });
  const response = await POST(request({ kind: "claude", key: "synthetic-not-real" }));
  expect(response.status).toBe(422); expect((await response.json()).error.message).toContain("Keychain");
});
it("does not persist a key rejected by Anthropic", async () => {
  mocks.retrieve.mockRejectedValue(new (Anthropic.APIError as unknown as new (status: number) => Error)(401));
  const response = await POST(request({ kind: "claude", key: "synthetic-not-real" }));
  expect(response.status).toBe(422); expect((await response.json()).error.message).toContain("Anthropic rejected");
  expect(mocks.save).not.toHaveBeenCalled();
});
it("uses the existing environment/keychain key when the form is blank", async () => {
  mocks.key.mockReturnValue("existing-synthetic");
  const response = await POST(request({ kind: "claude", model: "claude-test" }));
  expect(response.status).toBe(200); expect(mocks.save).toHaveBeenCalledWith("existing-synthetic", "claude-test");
});
it("disconnects without a provider call and returns cleanup warnings", async () => {
  mocks.disconnect.mockReturnValue("Remove the orphan in Keychain Access.");
  const response = await POST(request({ kind: "claude", disconnect: true }));
  expect(response.status).toBe(200); expect((await response.json()).warning).toContain("Keychain Access");
  expect(mocks.retrieve).not.toHaveBeenCalled();
});
