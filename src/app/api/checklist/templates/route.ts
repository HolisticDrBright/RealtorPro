import { listTemplates } from "@/services/checklist";
import { errorResponse, ok } from "@/lib/errors";

export const runtime = "nodejs";

/** List checklist templates (read-only for now; an editor can build on this). */
export async function GET() {
  try {
    return ok({ templates: listTemplates() });
  } catch (err) {
    return errorResponse(err);
  }
}
