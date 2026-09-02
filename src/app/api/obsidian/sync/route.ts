import { indexVault, vaultStatus } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST() { try { return ok({ result: indexVault(), status: vaultStatus() }); } catch (err) { return errorResponse(err); } }
