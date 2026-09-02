import { isClaudeConfigured, MODEL } from "@/services/claude";
import { vaultStatus } from "@/services/obsidian";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET() {
  try { return ok({ claude: { configured: isClaudeConfigured(), model: MODEL }, obsidian: vaultStatus() }); } catch (err) { return errorResponse(err); }
}
