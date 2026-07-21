import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { exportRecords, omDrafts } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { omExportSchema } from "@/lib/validation.modules";
import { exportOm } from "@/services/om";
import { storeFile } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** Export PPTX/PDF — LOCKED until the draft is approved via the compliance gate. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const input = await readJson(req, omExportSchema);
    const draft = db.select().from(omDrafts).where(eq(omDrafts.id, id)).get();
    if (!draft) throw new AppError("not_found", "OM draft not found.");

    if (draft.approvalState !== "Approved" && draft.approvalState !== "Exported") {
      throw new AppError("approval_required", "Export locked — resolve the compliance checklist and approve for export first.");
    }

    const { buffer, filename, editableText } = await exportOm(id, input.format);
    const stored = storeFile("exports", filename, buffer);

    const record = db
      .insert(exportRecords)
      .values({
        subjectType: "om",
        subjectId: id,
        format: input.format,
        storedPath: stored.storedPath,
        sha256: stored.sha256,
        byteSize: stored.byteSize,
        brandProfileId: draft.brandProfileId,
        editableText,
        metadata: { name: draft.name, approvedBy: input.approvedBy },
      })
      .returning()
      .get();

    db.update(omDrafts).set({ approvalState: "Exported", updatedAt: new Date().toISOString() }).where(eq(omDrafts.id, id)).run();
    writeAudit({ action: "om.export", actor: input.approvedBy, entityType: "export_record", entityId: record.id, metadata: { format: input.format, byteSize: stored.byteSize, editableText } });

    return ok({ export: record, editableText, message: `Exported ${filename} (${input.format.toUpperCase()}).` }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
