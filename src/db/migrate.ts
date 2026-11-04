import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { DB_FILE, WORKSPACE_SUBDIRS } from "../lib/paths";

/**
 * Apply the schema in drizzle/0000_init.sql to the local database, safely,
 * whether the database is brand new or was created by an older version of the
 * app: tables and indexes are created only if missing, and columns that were
 * added since are appended with ALTER TABLE. Nothing is dropped, so running
 * `npm run setup` on an existing install keeps every record.
 */

for (const dir of WORKSPACE_SUBDIRS) fs.mkdirSync(dir, { recursive: true });
const sqlite = new Database(DB_FILE);
sqlite.pragma("journal_mode = WAL");

const sql = fs.readFileSync(path.resolve(process.cwd(), "drizzle", "0000_init.sql"), "utf8");
const statements = sql.split(/-->\s*statement-breakpoint/).map((x) => x.trim()).filter(Boolean);
let created = 0, altered = 0;

const existingTables = new Set((sqlite.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[]).map((r) => r.name));

for (const stmt of statements) {
  const table = /^CREATE TABLE `([^`]+)`/i.exec(stmt);
  if (table) {
    const name = table[1];
    if (!existingTables.has(name)) { sqlite.exec(stmt); existingTables.add(name); created++; continue; }
    // Existing table: add any column the schema has that the database lacks.
    const have = new Set((sqlite.prepare(`PRAGMA table_info(\`${name}\`)`).all() as { name: string }[]).map((c) => c.name));
    const body = stmt.slice(stmt.indexOf("(") + 1, stmt.lastIndexOf(")"));
    for (const raw of body.split(/,\n/)) {
      const line = raw.trim();
      const col = /^`([^`]+)`\s+(.*)$/s.exec(line);
      if (!col || have.has(col[1])) continue;
      // SQLite cannot add a NOT NULL column without a default, nor a PRIMARY KEY column.
      let def = col[2].replace(/\s+PRIMARY KEY/i, "");
      if (!/DEFAULT/i.test(def)) def = def.replace(/\s+NOT NULL/i, "");
      sqlite.exec(`ALTER TABLE \`${name}\` ADD COLUMN \`${col[1]}\` ${def}`);
      altered++;
    }
    continue;
  }
  if (/^CREATE (UNIQUE )?INDEX/i.test(stmt)) { sqlite.exec(stmt.replace(/^CREATE (UNIQUE )?INDEX /i, (m) => `${m}IF NOT EXISTS `)); continue; }
  sqlite.exec(stmt);
}

// Databases seeded before the rebrand still carry the placeholder agent; move them to the current brand.
sqlite.prepare("UPDATE settings SET agent_name = 'Vanessa Bukowski', brokerage = 'SERHANT.' WHERE agent_name = 'Vanessa Smith' AND brokerage = 'Compass'").run();
console.log(`✔ Schema applied to ${DB_FILE} (${created} tables created, ${altered} columns added)`);
sqlite.close();
