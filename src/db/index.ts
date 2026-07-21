import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import * as schema from "./schema";
import { DB_FILE, WORKSPACE_SUBDIRS } from "@/lib/paths";

/**
 * Single shared SQLite connection for the app (server-only).
 *
 * The connection is memoised on `globalThis` so Next.js hot-reload in dev does
 * not open a new handle on every request.
 */

function ensureWorkspace() {
  for (const dir of WORKSPACE_SUBDIRS) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createDb() {
  ensureWorkspace();
  const sqlite = new Database(DB_FILE);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

type DbType = ReturnType<typeof createDb>;

const globalForDb = globalThis as unknown as { __agentosDb?: DbType };

export const db: DbType = globalForDb.__agentosDb ?? createDb();
if (process.env.NODE_ENV !== "production") globalForDb.__agentosDb = db;

export { schema };
