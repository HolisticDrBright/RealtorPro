import { checklistList } from "@/services/checklist";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Escrow transactions with checklist progress. */
export async function GET() {
  try { return ok({ items: checklistList() }); } catch (err) { return errorResponse(err); }
}
