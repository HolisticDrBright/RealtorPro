import { desc } from "drizzle-orm";
import fs from "node:fs";
import { db } from "@/db";
import {
  approvals,
  auditLogs,
  buyerCriteriaProfiles,
  buyerMatches,
  contacts,
  drafts,
  exports as exportsTable,
  facts,
  mediaDisclosures,
  properties,
} from "@/db/schema";
import { storeFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** List past exports. */
export async function GET() {
  try {
    const rows = db.select().from(exportsTable).orderBy(desc(exportsTable.createdAt)).all();
    return ok({ exports: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Export all local data as a single JSON bundle written to the workspace.
 * Everything AgentOS stores lives locally; this is the portable backup.
 */
export async function POST() {
  try {
    const bundle = {
      exportedAt: new Date().toISOString(),
      contacts: db.select().from(contacts).all(),
      properties: db.select().from(properties).all(),
      facts: db.select().from(facts).all(),
      buyerCriteria: db.select().from(buyerCriteriaProfiles).all(),
      buyerMatches: db.select().from(buyerMatches).all(),
      drafts: db.select().from(drafts).all(),
      approvals: db.select().from(approvals).all(),
      disclosures: db.select().from(mediaDisclosures).all(),
      auditLog: db.select().from(auditLogs).all(),
    };

    const buf = Buffer.from(JSON.stringify(bundle, null, 2), "utf8");
    const stored = storeFile("exports", `agentos-backup-${Date.now()}.json`, buf);

    const record = db
      .insert(exportsTable)
      .values({
        kind: "full_backup",
        filename: stored.filename,
        storedPath: stored.storedPath,
        sha256: stored.sha256,
        byteSize: stored.byteSize,
      })
      .returning()
      .get();

    // Verify the file is on disk before reporting success.
    const exists = fs.existsSync(stored.absolutePath);

    writeAudit({
      action: "export.full_backup",
      entityType: "export",
      entityId: record.id,
      metadata: { filename: stored.filename, byteSize: stored.byteSize },
    });

    return ok(
      {
        export: record,
        verifiedOnDisk: exists,
        message: "Exported a full local backup — criteria, imports, drafts, and the disclosure log.",
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
