import { beforeEach, afterEach, it, expect, vi } from "vitest";
const native = vi.hoisted(() => ({ execFile: vi.fn() }));
vi.mock("node:child_process", () => ({ execFile: native.execFile, execFileSync: vi.fn() }));
import { chooseMacFolder } from "@/lib/mac-native";
const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
beforeEach(() => { native.execFile.mockReset(); Object.defineProperty(process, "platform", { value: "darwin" }); });
afterEach(() => Object.defineProperty(process, "platform", platform));
it("returns the selected path as data with spaces and punctuation intact", async () => {
  native.execFile.mockImplementation((_file, _args, _opts, callback) => callback(null, "/Users/Test/My Vault's Notes/\n"));
  expect(await chooseMacFolder()).toBe("/Users/Test/My Vault's Notes/");
  expect(native.execFile.mock.calls[0][0]).toBe("/usr/bin/osascript");
  expect(native.execFile.mock.calls[0][1].join(" ")).not.toContain("/Users/Test");
});
it("returns null on cancellation without changing any connection", async () => {
  native.execFile.mockImplementation((_file, _args, _opts, callback) => callback(null, "\n"));
  expect(await chooseMacFolder()).toBeNull();
});
it("shows actionable errors and permits retry after timeout", async () => {
  native.execFile.mockImplementationOnce((_file, _args, _opts, callback) => callback(new Error("timed out"), ""));
  await expect(chooseMacFolder()).rejects.toThrow(/Browse folders/);
  native.execFile.mockImplementationOnce((_file, _args, _opts, callback) => callback(null, "/tmp/vault"));
  expect(await chooseMacFolder()).toBe("/tmp/vault");
});
it("allows only one native dialog at a time", async () => {
  let finish!: (err: null, value: string) => void;
  native.execFile.mockImplementation((_file, _args, _opts, callback) => { finish = callback; });
  const first = chooseMacFolder();
  await expect(chooseMacFolder()).rejects.toThrow(/already open/);
  finish(null, ""); await first;
});
