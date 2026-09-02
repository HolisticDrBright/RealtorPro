/**
 * Remove every record (sample or real) but keep settings — your name,
 * brokerage, income goal and commission defaults. Use after `npm run setup`
 * to start with an empty command center:  npm run db:clear
 */
import Database from "better-sqlite3";
import { DB_FILE } from "../lib/paths";

const sqlite = new Database(DB_FILE);
const tables = ["notifications", "touchpoints", "opportunities", "activities", "notes", "appointments", "calls", "tasks", "offers", "milestones", "transactions", "listings", "properties", "sellers", "buyers", "contacts", "vault_notes"];
const counts: Record<string, number> = {};
sqlite.transaction(() => {
  for (const t of tables) counts[t] = sqlite.prepare(`DELETE FROM ${t}`).run().changes;
  if ((sqlite.prepare("SELECT COUNT(*) AS n FROM settings").get() as { n: number }).n === 0) sqlite.prepare("INSERT INTO settings (id) VALUES ('st1')").run();
})();
sqlite.close();
const total = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`✔ Removed ${total} records (${Object.entries(counts).filter(([, n]) => n).map(([t, n]) => `${t} ${n}`).join(", ") || "already empty"}). Settings kept.`);
