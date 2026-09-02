import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { DB_FILE, WORKSPACE_SUBDIRS } from "../lib/paths";

for (const dir of WORKSPACE_SUBDIRS) fs.mkdirSync(dir, { recursive: true });
const sqlite = new Database(DB_FILE);
sqlite.pragma("journal_mode = WAL");
migrate(drizzle(sqlite), { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
// Databases seeded before the rebrand still carry the placeholder agent; move them to the current brand.
sqlite.prepare("UPDATE settings SET agent_name = 'Vanessa Bukowski', brokerage = 'SERHANT.' WHERE agent_name = 'Vanessa Smith' AND brokerage = 'Compass'").run();
console.log(`✔ Migrations applied to ${DB_FILE}`);
sqlite.close();
