import { sql } from "drizzle-orm";
import { db } from "@/db";
import { contacts, properties, buyerMatches, generationJobs } from "@/db/schema";
import { providerSummary } from "@/services/providers";
import { getFub } from "@/services/fub/adapter";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    const fub = getFub();
    const counts = {
      contacts: db.select({ n: sql<number>`count(*)` }).from(contacts).get()?.n ?? 0,
      properties: db.select({ n: sql<number>`count(*)` }).from(properties).get()?.n ?? 0,
      matches: db.select({ n: sql<number>`count(*)` }).from(buyerMatches).get()?.n ?? 0,
      jobs: db.select({ n: sql<number>`count(*)` }).from(generationJobs).get()?.n ?? 0,
    };
    return ok({
      status: "ok",
      providers: providerSummary(),
      fub: { status: fub.status(), mock: fub.mock },
      counts,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
