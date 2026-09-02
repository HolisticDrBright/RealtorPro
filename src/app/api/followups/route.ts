import { db } from "@/db";
import * as s from "@/db/schema";
import { buildFollowUps } from "@/lib/followups";
import { loadContext } from "@/services/context";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET() {
  try {
    const ctx = loadContext();
    const items = buildFollowUps(ctx.contacts, db.select().from(s.buyers).all(), new Date()).map((f) => { const c = ctx.contact(f.contactId)!; return { ...f, name: `${c.firstName} ${c.lastName}`.trim(), type: c.type, phone: c.phone, email: c.email, lastContactAt: c.lastContactAt, nextFollowUpAt: c.nextFollowUpAt, photoUrl: c.photoUrl }; });
    return ok({ items });
  } catch (err) { return errorResponse(err); }
}
