import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import * as schema from "./schema";
import { DB_FILE, WORKSPACE_SUBDIRS } from "@/lib/paths";

function createDb() {
  for (const dir of WORKSPACE_SUBDIRS) fs.mkdirSync(dir, { recursive: true });
  const sqlite = new Database(DB_FILE);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}
type DbType = ReturnType<typeof createDb>;
const g = globalThis as unknown as { __ccDb?: DbType };
export const db: DbType = g.__ccDb ?? createDb();
if (process.env.NODE_ENV !== "production") g.__ccDb = db;
export { schema };
