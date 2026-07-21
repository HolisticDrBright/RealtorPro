import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { storyboardScenes, storyboards, visualizerSources } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { storyboardSchema } from "@/lib/validation.modules";
import { decideBoundary } from "@/lib/boundary";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok, AppError } from "@/lib/errors";

export const runtime = "nodejs";

/** Save visual-direction controls + a default scene list for a project. */
export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, storyboardSchema);

    // Enforce the boundary-source rule at save time so the UI can explain it.
    if (input.boundaryStyle !== "none") {
      const sources = db.select().from(visualizerSources).where(eq(visualizerSources.projectId, input.projectId)).all();
      const decision = decideBoundary(sources, input.boundaryStyle);
      if (!decision.allowed) {
        throw new AppError("unprocessable", decision.reason ?? "Boundary overlay not permitted without a verified source.", { field: "boundaryStyle" });
      }
    }

    const existing = db.select().from(storyboards).where(eq(storyboards.projectId, input.projectId)).get();
    const values = {
      projectId: input.projectId,
      format: input.format,
      durationSec: input.durationSec,
      visualDirection: input.visualDirection,
      cameraMovement: input.cameraMovement,
      boundaryStyle: input.boundaryStyle,
      textOverlays: input.textOverlays,
      disclosureMode: input.disclosureMode,
      budgetCapUsd: input.budgetCapUsd,
    };
    const board = existing
      ? db.update(storyboards).set({ ...values, updatedAt: new Date().toISOString() }).where(eq(storyboards.id, existing.id)).returning().get()
      : db.insert(storyboards).values(values).returning().get();

    // Seed a simple scene list matching the camera movement if none exist.
    const sceneCount = db.select().from(storyboardScenes).where(eq(storyboardScenes.storyboardId, board.id)).all().length;
    if (sceneCount === 0) {
      const beats = ["Establishing aerial", "Approach / push-in", "Site context", "Concept reveal", "End card with disclosure"];
      beats.forEach((beat, i) => db.insert(storyboardScenes).values({ storyboardId: board.id, orderIndex: i, beat, cameraMovement: input.cameraMovement, durationSec: Math.max(2, Math.round(input.durationSec / beats.length)) }).run());
    }

    writeAudit({ action: "viz.storyboard.saved", entityType: "storyboard", entityId: board.id, metadata: { boundaryStyle: input.boundaryStyle } });
    return ok({ storyboard: board }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
