import fs from "node:fs";
import { DB_FILE } from "../lib/paths";
for (const f of [DB_FILE, DB_FILE + "-wal", DB_FILE + "-shm"]) if (fs.existsSync(f)) { fs.unlinkSync(f); console.log(`✔ Removed ${f}`); }
console.log("Run `npm run setup` to recreate and reseed.");
