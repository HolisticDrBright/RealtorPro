import type { NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { visualizerProjects } from "@/db/schema.modules";
import { readJson } from "@/lib/api";
import { createVisualizerProjectSchema } from "@/lib/validation.modules";
import { writeAudit } from "@/lib/audit";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  try {
    return ok({ projects: db.select().from(visualizerProjects).orderBy(desc(visualizerProjects.updatedAt)).all() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const input = await readJson(req, createVisualizerProjectSchema);
    const project = db
      .insert(visualizerProjects)
      .values({ propertyId: input.propertyId ?? null, name: input.name, address: input.address ?? null, visualizationType: input.visualizationType, status: "sources" })
      .returning()
      .get();
    writeAudit({ action: "viz.project.created", entityType: "visualizer_project", entityId: project.id, metadata: { type: input.visualizationType } });
    return ok({ project }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
