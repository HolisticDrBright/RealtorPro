import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DB_FILE, WORKSPACE_SUBDIRS } from "../lib/paths";

async function main() {
for (const dir of WORKSPACE_SUBDIRS) fs.mkdirSync(dir, { recursive: true });
const sqlite = new Database(DB_FILE);
sqlite.pragma("journal_mode = WAL");
if (sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='contacts'").get()) {
  const backupDir = path.join(path.dirname(DB_FILE), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  await sqlite.backup(path.join(backupDir, `${randomUUID()}.sqlite`));
  console.log("Pre-migration database backup saved.");
}
migrate(drizzle(sqlite), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
// Setup is additive and never seeds samples or changes an existing profile.
sqlite.prepare("INSERT INTO settings (id, agent_name, brokerage, annual_goal) SELECT 'st1', 'Agent', '', 0 WHERE NOT EXISTS (SELECT 1 FROM settings)").run();
console.log(`✔ Migrations applied to ${DB_FILE}`);
sqlite.close();
}
main().catch(() => { console.error("Database setup failed. Existing snapshots are in workspace/backups. Stop all app instances and check folder permissions before retrying."); process.exitCode = 1; });
