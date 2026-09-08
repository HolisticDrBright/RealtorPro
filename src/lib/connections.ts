import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { macHelperReady, macKeychain } from "./mac-native";
import { AppError } from "./errors";

export const connectionFile = () => path.resolve(process.env.WORKSPACE_DIR || "./workspace", "connections.json");
export interface Connections {
  claude?: { enabled: boolean; encryptedKey?: string; keychainAccount?: string; model: string; verifiedAt?: string };
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
  if (process.platform !== "win32") throw new AppError("unprocessable", "This key was encrypted on Windows. Paste your API key again to save it securely on this computer.");
  const prefix = "[void][Reflection.Assembly]::LoadWithPartialName('System.Security');$v=[Console]::In.ReadToEnd();";
  const script = prefix + (decrypt
    ? "[Console]::Out.Write([Text.Encoding]::UTF8.GetString([Security.Cryptography.ProtectedData]::Unprotect([Convert]::FromBase64String($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))"
    : "[Console]::Out.Write([Convert]::ToBase64String([Security.Cryptography.ProtectedData]::Protect([Text.Encoding]::UTF8.GetBytes($v),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)))");
  try { return execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { input: value, encoding: "utf8", windowsHide: true, timeout: 15000, stdio: ["pipe", "pipe", "pipe"] }).trim(); }
  catch { throw new AppError("unprocessable", "Windows could not protect or unlock the API key for this account. Make sure Windows PowerShell is available, then reconnect Claude from Integrations."); }
}
let cached: { encrypted: string; key: string } | undefined;
export const encryptApiKey = (key: string) => protect(key, false);
export const decryptProtectedValue = (value: string) => protect(value, true);
export function saveClaudeConnection(key: string, model: string): string | null {
  const previous = readConnections();
  let next: NonNullable<Connections["claude"]>;
  if (process.platform === "darwin") {
    const keychainAccount = randomUUID();
    macKeychain("set", keychainAccount, key);
    next = { enabled: true, keychainAccount, model, verifiedAt: new Date().toISOString() };
  } else if (process.platform === "win32") {
    next = { enabled: true, encryptedKey: encryptApiKey(key), model, verifiedAt: new Date().toISOString() };
  } else {
    throw new AppError("unprocessable", "In-app secure key storage supports macOS and Windows. Use ANTHROPIC_API_KEY on this operating system.");
  }
  try { saveConnections({ ...previous, claude: next }); }
  catch {
    if (next.keychainAccount) { try { macKeychain("delete", next.keychainAccount); } catch { /* New orphan can be removed in Keychain Access. */ } }
    throw new AppError("unprocessable", "Could not save connection settings. Your previous connection was kept. Check workspace permissions.");
  }
  cached = undefined;
  if (previous.claude?.keychainAccount && process.platform === "darwin") {
    try { macKeychain("delete", previous.claude.keychainAccount); }
    catch { return "New key saved, but the previous Keychain item could not be removed. Remove the unused app.realtorpro.claude item in Keychain Access."; }
  }
  return null;
}
export function disconnectClaude(model: string): string | null {
  const previous = readConnections();
  // Disable first so a locked keychain cannot leave the app using the old key.
  saveConnections({ ...previous, claude: { enabled: false, model } });
  cached = undefined;
  if (previous.claude?.keychainAccount && process.platform === "darwin") {
    try { macKeychain("delete", previous.claude.keychainAccount); }
    catch { return "Claude is disconnected, but its Keychain item could not be removed. Remove the app.realtorpro.claude item in Keychain Access."; }
  }
  return null;
}
export function claudeKey(): string | undefined {
  const cfg = readConnections().claude;
  if (cfg?.enabled === false) return undefined;
  if (cfg?.keychainAccount) {
    if (process.platform !== "darwin") throw new AppError("unprocessable", "This connection belongs to a Mac Keychain. Paste your API key again on this computer.");
    return macKeychain("get", cfg.keychainAccount);
  }
  if (!cfg?.encryptedKey) return process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  if (cached?.encrypted !== cfg.encryptedKey) cached = { encrypted: cfg.encryptedKey, key: protect(cfg.encryptedKey, true) };
  return cached.key;
}
export const claudeModel = () => readConnections().claude?.model || process.env.CLAUDE_MODEL?.trim() || "claude-sonnet-4-6";
export function claudeStatus() {
  const cfg = readConnections().claude;
  const secureStorage = process.platform === "darwin" ? "macOS Keychain" : process.platform === "win32" ? "Windows account encryption" : "Environment only";
  const incompatible = !!((cfg?.encryptedKey && process.platform !== "win32") || (cfg?.keychainAccount && process.platform !== "darwin"));
  return { configured: cfg?.enabled === false || incompatible ? false : !!(cfg?.keychainAccount || cfg?.encryptedKey || process.env.ANTHROPIC_API_KEY?.trim()), model: claudeModel(), verifiedAt: cfg?.verifiedAt ?? null,
    storage: cfg?.keychainAccount ? "macOS Keychain" : cfg?.encryptedKey ? "Windows account encryption" : "Environment",
    secureStorage, canSaveKey: process.platform === "win32" || macHelperReady(),
    needsReconnect: incompatible, platform: process.platform };
}
