import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, tasks } from "@/db/schema";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Contacts (FUB mirror + local) with open-task counts. */
export async function GET() {
  try {
    const rows = db.select().from(contacts).orderBy(asc(contacts.name)).all();
    const open = db.select({ contactId: tasks.contactId, n: sql<number>`count(*)` }).from(tasks).where(eq(tasks.status, "open")).groupBy(tasks.contactId).all();
    const openBy = new Map(open.map((o) => [o.contactId, o.n]));
    return ok({ contacts: rows.map((c) => ({ ...c, openTasks: openBy.get(c.id) ?? 0 })) });
  } catch (err) { return errorResponse(err); }
}
