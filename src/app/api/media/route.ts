import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, mediaDisclosures, properties } from "@/db/schema";
import { assertAllowedMime, storeFile } from "@/lib/storage";
import { mediaUploadMetaSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** List assets for a property. */
export async function GET(req: NextRequest) {
  try {
    const propertyId = req.nextUrl.searchParams.get("propertyId");
    if (!propertyId) throw new AppError("bad_request", "propertyId is required.");
    const rows = db.select().from(assets).where(eq(assets.propertyId, propertyId)).all();
    return ok({ assets: rows });
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Authorized media upload (multipart/form-data).
 * - Validates file type against an allow-list.
 * - Stores hash, filename, MIME, rights-confirmation, alteration status.
 * - Preserves originals permanently (never overwritten).
 * - For AI-altered media, records a disclosure linked to the original asset.
 */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new AppError("bad_request", "A file field is required (multipart/form-data).");
    }

    const meta = mediaUploadMetaSchema.parse({
      propertyId: form.get("propertyId"),
      kind: form.get("kind"),
      label: form.get("label") ?? undefined,
      rightsConfirmed: form.get("rightsConfirmed") ?? "false",
      alterationStatus: form.get("alterationStatus") ?? "original",
      originalAssetId: form.get("originalAssetId") ?? undefined,
      alterationDescription: form.get("alterationDescription") ?? undefined,
    });

    const property = db.select().from(properties).where(eq(properties.id, meta.propertyId)).get();
    if (!property) throw new AppError("not_found", "Property not found.");

    if (!meta.rightsConfirmed) {
      throw new AppError(
        "unprocessable",
        "Rights confirmation is required. Only upload media covered by the listing agreement.",
      );
    }

    assertAllowedMime(meta.kind, file.type);

    if (meta.alterationStatus === "altered") {
      if (!meta.originalAssetId) {
        throw new AppError("unprocessable", "An AI-altered asset must reference the original asset it derives from.");
      }
      const original = db.select().from(assets).where(eq(assets.id, meta.originalAssetId)).get();
      if (!original) throw new AppError("not_found", "Original asset not found for this alteration.");
      if (!meta.alterationDescription) {
        throw new AppError("unprocessable", "An alteration description is required for AI-altered media.");
      }
    }

    const buf = Buffer.from(await file.arrayBuffer());
    // Altered media goes to /generated; originals to /assets (immutable).
    const subdir = meta.alterationStatus === "altered" ? "generated" : "assets";
    const stored = storeFile(subdir, file.name || `${meta.kind}.bin`, buf);

    const asset = db
      .insert(assets)
      .values({
        propertyId: meta.propertyId,
        kind: meta.kind,
        label: meta.label ?? file.name,
        filename: stored.filename,
        mimeType: file.type,
        sha256: stored.sha256,
        byteSize: stored.byteSize,
        storedPath: stored.storedPath,
        rightsConfirmed: meta.rightsConfirmed,
        alterationStatus: meta.alterationStatus,
        originalAssetId: meta.originalAssetId ?? null,
        alterationDescription: meta.alterationDescription ?? null,
      })
      .returning()
      .get();

    let disclosureId: string | undefined;
    if (meta.alterationStatus === "altered") {
      const d = db
        .insert(mediaDisclosures)
        .values({
          assetId: asset.id,
          originalAssetId: meta.originalAssetId!,
          alteration: meta.alterationDescription!,
          disclosureText: `${meta.alterationDescription} (AI-altered; disclosed).`,
          status: "pending",
        })
        .returning()
        .get();
      disclosureId = d.id;
    }

    writeAudit({
      action: "media.upload",
      entityType: "asset",
      entityId: asset.id,
      metadata: {
        kind: meta.kind,
        sha256: stored.sha256,
        alterationStatus: meta.alterationStatus,
        disclosureId,
      },
    });

    return ok({ asset, disclosureId }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
