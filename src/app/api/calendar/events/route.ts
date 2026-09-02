import type { NextRequest } from "next/server";
import { z } from "zod";
import { and, asc, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema.dashboard";
import { readJson } from "@/lib/api";
import { parseIcs } from "@/lib/ics";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

const createSchema = z.object({
  title: z.string().min(1).max(300),
  startsAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  endsAt: z.string().optional(),
  location: z.string().max(300).optional(),
  contactId: z.string().optional(),
  propertyId: z.string().optional(),
  notes: z.string().max(2000).optional(),
});
const icsSchema = z.object({ ics: z.string().min(10).max(500_000), source: z.enum(["ics", "gmail", "outlook"]).default("ics") });

/**
 * Work calendar. Events are local by default. Google/Outlook exports can be
 * imported as .ics without any account connection; live OAuth sync is a
 * separate, explicitly-approved connector (not enabled here).
 */
export async function GET(req: NextRequest) {
  try {
    const from = req.nextUrl.searchParams.get("from") ?? new Date().toISOString().slice(0, 10);
    const days = Number(req.nextUrl.searchParams.get("days") ?? 7);
    const to = new Date(new Date(from).getTime() + days * 86400_000).toISOString();
    const rows = db.select().from(calendarEvents).where(and(gte(calendarEvents.startsAt, from), lt(calendarEvents.startsAt, to))).orderBy(asc(calendarEvents.startsAt)).all();
    return ok({ events: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const raw = (await req.clone().json().catch(() => ({}))) as { ics?: string };
    if (typeof raw.ics === "string") {
      const input = icsSchema.parse(raw);
      const parsed = parseIcs(input.ics);
      const rows = parsed.map((e) =>
        db.insert(calendarEvents).values({ title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, location: e.location, notes: e.description, source: input.source, externalId: e.uid }).returning().get(),
      );
      writeAudit({ action: "calendar.ics_imported", metadata: { count: rows.length, source: input.source } });
      return ok({ imported: rows.length, events: rows }, { status: 201 });
    }
    const input = await readJson(req, createSchema);
    const row = db.insert(calendarEvents).values({ ...input, source: "local" }).returning().get();
    return ok({ event: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
