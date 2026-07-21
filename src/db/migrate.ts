/**
 * Apply Drizzle migrations to the local SQLite database.
 * Run with: npm run db:migrate
 *
 * Uses relative imports (no "@/" alias / no "server-only") so it runs cleanly
 * under tsx outside the Next.js bundler.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import { DB_FILE, WORKSPACE_SUBDIRS } from "../lib/paths";

for (const dir of WORKSPACE_SUBDIRS) fs.mkdirSync(dir, { recursive: true });

const sqlite = new Database(DB_FILE);
sqlite.pragma("journal_mode = WAL");
const db = drizzle(sqlite);

const migrationsFolder = path.resolve(process.cwd(), "drizzle");
migrate(db, { migrationsFolder });

console.log(`✔ Migrations applied to ${DB_FILE}`);
sqlite.close();
