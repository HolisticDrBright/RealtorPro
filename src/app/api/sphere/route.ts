import { db } from "@/db";
import * as s from "@/db/schema";
import { daysSince, daysUntil, nextAnniversary } from "@/lib/dates";
import { loadContext } from "@/services/context";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Stay-in-touch: upcoming birthdays, purchase anniversaries, scheduled touchpoints, and neglected clients. */
export async function GET() {
  try {
    const ctx = loadContext();
    const now = new Date();
    const people = ctx.contacts.filter((c) => !c.archived && !["agent", "vendor"].includes(c.type));
    const birthdays = people.filter((c) => c.birthday).map((c) => ({ contactId: c.id, name: ctx.names(c.id), date: nextAnniversary(c.birthday!, now), days: daysUntil(nextAnniversary(c.birthday!, now), now) })).filter((b) => b.days <= 45).sort((a, b) => a.days - b.days);
    const closed = db.select().from(s.transactions).all().filter((t) => t.status === "closed" && t.contactId && (t.closedAt ?? t.closingDate));
    const anniversaries = closed.map((t) => { const d = (t.closedAt ?? t.closingDate)!; const next = nextAnniversary(d, now); return { contactId: t.contactId!, name: ctx.names(t.contactId), address: ctx.addresses(t.propertyId), date: next, days: daysUntil(next, now), years: now.getFullYear() - Number(d.slice(0, 4)) + (next.startsWith(String(now.getFullYear())) ? 0 : 1) }; }).filter((a) => a.days <= 45).sort((a, b) => a.days - b.days);
    const touchpoints = db.select().from(s.touchpoints).all().filter((t) => !t.completedAt).map((t) => ({ ...t, name: ctx.names(t.contactId), days: daysUntil(t.dueDate, now) })).sort((a, b) => a.days - b.days);
    const neglected = people.filter((c) => ["past_client", "sphere"].includes(c.type)).map((c) => ({ contactId: c.id, name: ctx.names(c.id), type: c.type, phone: c.phone, days: daysSince(c.lastContactAt, now) })).filter((c) => c.days == null || c.days >= 60).sort((a, b) => (b.days ?? 9999) - (a.days ?? 9999));
    return ok({ birthdays, anniversaries, touchpoints, neglected });
  } catch (err) { return errorResponse(err); }
}
