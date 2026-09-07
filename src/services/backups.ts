import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import Database from "better-sqlite3";
import { db } from "@/db";
import { WORKSPACE_DIR } from "@/lib/paths";
import { AppError } from "@/lib/errors";
const root = () => path.join(WORKSPACE_DIR, "backups");
const quoted = (s: string) => '"' + s.replace(/"/g, '""') + '"';
export function backupPath(id: string) {
  if (!/^[a-f0-9-]{36}\.sqlite$/.test(id)) throw new AppError("bad_request", "Invalid backup ID.");
  return path.join(root(), id);
}
export function listBackups() {
  if (!fs.existsSync(root())) return [];
  return fs.readdirSync(root()).filter((f) => /^[a-f0-9-]{36}\.sqlite$/.test(f)).map((id) => { const st = fs.statSync(backupPath(id)); return { id, bytes: st.size, createdAt: st.mtime.toISOString() }; }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function createBackup() {
  fs.mkdirSync(root(), { recursive: true });
  const id = `${randomUUID()}.sqlite`;
  const file = backupPath(id);
  await db.$client.backup(file);
  const check = new Database(file, { readonly: true });
  try { if (check.pragma("integrity_check", { simple: true }) !== "ok") throw new AppError("internal_error", "Backup verification failed."); }
  finally { check.close(); }
  return { id, createdAt: new Date().toISOString() };
}
export async function restoreBackup(id: string) {
  const file = backupPath(id);
  if (!fs.existsSync(file)) throw new AppError("not_found", "Backup not found.");
  const check = new Database(file, { readonly: true });
  try {
    if (check.pragma("integrity_check", { simple: true }) !== "ok" || (check.pragma("foreign_key_check") as unknown[]).length) throw new AppError("bad_request", "Backup is damaged; restore cancelled.");
    const schemaSql = "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name";
    if (JSON.stringify(check.prepare(schemaSql).all()) !== JSON.stringify(db.$client.prepare(schemaSql).all())) throw new AppError("conflict", "This backup has a different database version. Restore it using the matching app version.");
  } finally { check.close(); }
  const safety = await createBackup();
  const sqlite = db.$client;
  sqlite.prepare("ATTACH DATABASE ? AS recovery").run(file);
  try {
    const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
    sqlite.pragma("foreign_keys = OFF");
    sqlite.transaction(() => {
      for (const { name } of tables) { sqlite.exec(`DELETE FROM main.${quoted(name)}`); sqlite.exec(`INSERT INTO main.${quoted(name)} SELECT * FROM recovery.${quoted(name)}`); }
      // A restored proposal must never resurrect an old approval.
      sqlite.exec("UPDATE reviews SET status='rejected' WHERE status='pending'");
      if ((sqlite.pragma("foreign_key_check") as unknown[]).length) throw new AppError("conflict", "Restore failed relationship checks; no changes were kept.");
    })();
  } finally { sqlite.pragma("foreign_keys = ON"); sqlite.exec("DETACH DATABASE recovery"); }
  return { restored: id, safetyBackup: safety.id };
}
