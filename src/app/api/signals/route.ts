import type { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { signals } from "@/db/schema.modules";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** Daily opportunity queue with filters (status, type). */
export async function GET(req: NextRequest) {
  try {
    const status = req.nextUrl.searchParams.get("status");
    const type = req.nextUrl.searchParams.get("type");
    const conds = [];
    if (status) conds.push(eq(signals.status, status));
    if (type) conds.push(eq(signals.type, type));
    const rows = conds.length
      ? db.select().from(signals).where(and(...conds)).orderBy(desc(signals.confidence)).all()
      : db.select().from(signals).orderBy(desc(signals.confidence)).all();
    return ok({ signals: rows });
  } catch (err) {
    return errorResponse(err);
  }
}
