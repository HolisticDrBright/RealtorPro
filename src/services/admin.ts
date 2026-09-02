import "server-only";
import { db } from "@/db";
import * as s from "@/db/schema";

/**
 * Housekeeping that touches every table. Used by the "Start fresh" button on
 * Integrations and by `npm run db:clear`. Settings (your name, brokerage,
 * income goal, commission defaults) are kept; everything else goes.
 */

const DATA_TABLES = {
  notifications: s.notifications, touchpoints: s.touchpoints, opportunities: s.opportunities, activities: s.activities, notes: s.notes,
  appointments: s.appointments, calls: s.calls, tasks: s.tasks, offers: s.offers, milestones: s.milestones, transactions: s.transactions,
  listings: s.listings, properties: s.properties, sellers: s.sellers, buyers: s.buyers, contacts: s.contacts, vaultNotes: s.vaultNotes,
} as const;

export function clearAllData(): Record<string, number> {
  const removed: Record<string, number> = {};
  db.transaction((tx) => {
    for (const [name, table] of Object.entries(DATA_TABLES)) {
      const before = tx.select().from(table).all().length;
      tx.delete(table).run();
      removed[name] = before;
    }
    if (tx.select().from(s.settings).all().length === 0) tx.insert(s.settings).values({ id: "st1" }).run();
  });
  return removed;
}

export const isEmptyWorkspace = () => db.select({ id: s.contacts.id }).from(s.contacts).limit(1).all().length === 0 && db.select({ id: s.properties.id }).from(s.properties).limit(1).all().length === 0;
