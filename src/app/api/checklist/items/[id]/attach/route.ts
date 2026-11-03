import type { NextRequest } from "next/server";
import { db } from "@/db";
import { sourceDocuments } from "@/db/schema";
import { assertAllowedMime, storeFile } from "@/lib/storage";
import { attachDocument, getItem } from "@/services/checklist";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/**
 * Attach a received document to a checklist item (`multipart/form-data`, field
 * `file`). The upload becomes an immutable `source_documents` row with
 * `kind: "disclosure"` (same hashed, write-once storage as every other source)
 * and the item is marked done. Nothing is generated or filled in.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const item = getItem(id);
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File) || file.size === 0) throw new AppError("bad_request", "Attach a file in the `file` field.");
    const mime = file.type || "application/octet-stream";
    assertAllowedMime("disclosure", mime);
    const buf = Buffer.from(await file.arrayBuffer());
    const stored = storeFile("sources", file.name || `${item.code}.pdf`, buf);
    const doc = db
      .insert(sourceDocuments)
      .values({ kind: "disclosure", filename: stored.filename, mimeType: mime, sha256: stored.sha256, byteSize: stored.byteSize, storedPath: stored.storedPath, meta: { checklistItemId: id, transactionId: item.transactionId, code: item.code, originalName: file.name } })
      .returning()
      .get();
    writeAudit({ action: "source_document.uploaded", entityType: "source_document", entityId: doc.id, metadata: { kind: "disclosure", checklistItemId: id, sha256: doc.sha256 } });
    const updated = attachDocument(id, doc.id);
    return ok({ item: updated, document: { id: doc.id, filename: doc.filename, kind: doc.kind, createdAt: doc.createdAt }, message: `Attached ${file.name} to ${item.code}.` }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
