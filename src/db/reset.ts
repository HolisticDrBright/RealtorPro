/**
 * Delete the local SQLite database files. Run with: npm run db:reset
 * Followed by `npm run setup` to recreate + reseed. Does NOT touch uploaded
 * assets or source documents on disk.
 */
import fs from "node:fs";
import { DB_FILE } from "../lib/paths";

for (const suffix of ["", "-wal", "-shm"]) {
  const f = DB_FILE + suffix;
  if (fs.existsSync(f)) {
    fs.rmSync(f);
    console.log(`✔ Removed ${f}`);
  }
}
console.log("Run `npm run setup` to recreate and reseed.");
