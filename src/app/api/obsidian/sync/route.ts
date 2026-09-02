import { indexVault, vaultStatus } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
/** Re-index the Obsidian vault (local files only). */
export async function POST() {
  try { const result = indexVault(); return ok({ result, status: vaultStatus() }); } catch (err) { return errorResponse(err); }
}
