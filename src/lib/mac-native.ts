import fs from "node:fs";
import path from "node:path";
import { execFile, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { AppError } from "./errors";

export function macHelperReady(): boolean {
  if (process.platform !== "darwin") return false;
  try {
    const dir = path.resolve("scripts/macos");
    const hash = createHash("sha256").update(fs.readFileSync(path.join(dir, "keychain.swift"))).digest("hex");
    fs.accessSync(path.join(dir, ".build/realtorpro-keychain"), fs.constants.X_OK);
    return fs.readFileSync(path.join(dir, ".build/source.sha256"), "utf8") === hash;
  } catch { return false; }
}

export function macKeychain(action: "get" | "set" | "delete", account: string, secret?: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(account)) throw new AppError("bad_request", "Invalid Keychain reference. Reconnect Claude.");
  if (!macHelperReady()) throw new AppError("unprocessable", "Mac Keychain support needs setup. Stop RealtorPro and run npm run setup, then start it again.");
  try {
    return execFileSync(path.resolve("scripts/macos/.build/realtorpro-keychain"), [action, account], {
      input: action === "set" ? secret : undefined, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 20000, maxBuffer: 4096,
    }).trim();
  } catch {
    throw new AppError("unprocessable", "macOS Keychain could not complete the request. Unlock your login keychain and allow RealtorPro access if prompted, then try again. If the key was removed, paste it again to reconnect.");
  }
}

let pickerOpen = false;
export async function chooseMacFolder(): Promise<string | null> {
  if (process.platform !== "darwin") throw new AppError("bad_request", "Use Browse folders on this computer.");
  if (pickerOpen) throw new AppError("conflict", "A folder chooser is already open. Select a folder or cancel it first.");
  pickerOpen = true;
  // Fixed script only. Paths returned by the chooser are data, never executable code.
  const script = 'try\nactivate\nset selectedFolder to choose folder with prompt "Choose your Obsidian vault folder"\nreturn POSIX path of selectedFolder\non error number -128\nreturn ""\nend try';
  try {
    return await new Promise<string | null>((resolve, reject) => {
      execFile("/usr/bin/osascript", ["-e", script], { encoding: "utf8", timeout: 60000, maxBuffer: 8192 }, (error, stdout) => {
        if (error) reject(new AppError("unprocessable", "The Mac folder chooser closed or timed out. Try again, or use Browse folders. Check macOS Privacy & Security if access was denied."));
        else resolve(stdout.trim() || null);
      });
    });
  } finally { pickerOpen = false; }
}
