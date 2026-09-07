import { chooseMacFolder } from "@/lib/mac-native";
import { errorResponse, ok } from "@/lib/errors";
export const runtime = "nodejs";
export async function POST() {
  try { return ok({ path: await chooseMacFolder() }); }
  catch (error) { return errorResponse(error); }
}
