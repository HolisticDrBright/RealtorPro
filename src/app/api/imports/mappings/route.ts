import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { columnMappings } from "@/db/schema";
import { readJson } from "@/lib/api";
import { saveMappingSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** List reusable MLS column mappings. */
export async function GET() {
  try {
    const rows = db.select().from(columnMappings).orderBy(desc(columnMappings.createdAt)).all();
    return ok({ mappings: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Save a reusable column mapping. */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, saveMappingSchema);
    const row = db
      .insert(columnMappings)
      .values({ name: input.name, sourceType: input.sourceType, mapping: input.mapping })
      .returning()
      .get();
    writeAudit({ action: "import.mapping.saved", entityType: "column_mapping", entityId: row.id, metadata: { name: row.name } });
    return ok({ mapping: row }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
