import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { encryptApiKey, decryptProtectedValue } from "./connections";
import { macKeychain } from "./mac-native";
import { AppError } from "./errors";

const file = () => path.resolve(process.env.WORKSPACE_DIR || "./workspace", "google-calendar.secret.json");
type Envelope = { platform: string; account?: string; encrypted?: string };
const envelope = (): Envelope | null => fs.existsSync(file()) ? JSON.parse(fs.readFileSync(file(), "utf8")) : null;
export function readGoogleSecret<T>(): T | null {
  const item = envelope(); if (!item) return null;
  if (item.platform !== process.platform) throw new AppError("unprocessable", "Reconnect Google Calendar on this computer; its credentials belong to a different operating system.");
  return JSON.parse(item.account ? macKeychain("get", item.account) : decryptProtectedValue(item.encrypted!));
}
export function saveGoogleSecret(value: unknown) {
  const old = envelope(); const raw = JSON.stringify(value); let item: Envelope;
  if (process.platform === "darwin") { const account = randomUUID(); macKeychain("set", account, raw); item = { platform: process.platform, account }; }
  else if (process.platform === "win32") item = { platform: process.platform, encrypted: encryptApiKey(raw) };
  else throw new AppError("unprocessable", "Google credential storage currently requires macOS or Windows.");
  const tmp = file() + "." + randomUUID() + ".tmp";
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  try { fs.writeFileSync(tmp, JSON.stringify(item), { mode: 0o600, flag: "wx" }); fs.renameSync(tmp, file()); }
  catch (e) { if (item.account) try { macKeychain("delete", item.account); } catch { /* orphan credential only */ } throw e; }
  finally { if (fs.existsSync(tmp)) fs.unlinkSync(tmp); }
  if (old?.account && old.platform === "darwin") try { macKeychain("delete", old.account); } catch { /* disconnected orphan can be removed in Keychain Access */ }
}
