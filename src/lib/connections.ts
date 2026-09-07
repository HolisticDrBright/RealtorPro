import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

export const connectionFile = () => path.resolve(process.env.WORKSPACE_DIR || "./workspace", "connections.json");
export interface Connections {
  claude?: { enabled: boolean; encryptedKey?: string; model: string; verifiedAt?: string };
  vault?: { dir: string | null; include: string[]; exclude: string[]; allowClaude: boolean };
}
export function readConnections(): Connections {
  const file = connectionFile();
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
export function saveConnections(next: Connections) {
  const file = connectionFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600, flag: "wx" });
    fs.renameSync(tmp, file);
  } finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
}
// DPAPI binds the encrypted key to this Windows account. The key goes through
// stdin, never process arguments, browser storage, logs or database backups.
function protect(value: string, decrypt: boolean): string {
  if (process.platform !== "win32") throw new Error("In-app key storage currently requires Windows. Use ANTHROPIC_API_KEY on other platforms.");
  const prefix = "[void][Reflection.Assembly]::LoadWithPartialName('System.Security');$v=[Console]::In.ReadToEnd();";
  const script = prefix + (decrypt
    ? "[Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))"
    : "[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))");
  try { return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { input: value, encoding: "utf8", windowsHide: true, timeout: 15000, stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch { throw new Error("Windows could not unlock the saved API key. Reconnect Claude from Integrations."); }
}
let cached: { encrypted: string; key: string } | undefined;
export const encryptApiKey = (key: string) => protect(key, false);
export function claudeKey(): string | undefined {
  const cfg = readConnections().claude;
  if (cfg?.enabled === false) return undefined;
  if (!cfg?.encryptedKey) return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  if (cached?.encrypted !== cfg.encryptedKey) cached = { encrypted: cfg.encryptedKey, key: protect(cfg.encryptedKey, true) };
  return cached.key;
}
export const claudeModel = () => readConnections().claude?.model || process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-4-6";
export function claudeStatus() {
  const cfg = readConnections().claude;
  return { configured: cfg?.enabled === false ? false : !!(cfg?.encryptedKey || process.env.ANTHROPIC_API_KEY?.trim()), model: claudeModel(), verifiedAt: cfg?.verifiedAt ?? null, storage: cfg?.encryptedKey ? "Windows account encryption" : "Environment" };
}
