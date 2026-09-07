import { db } from "@/db";
import { ok, errorResponse, AppError } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET() {
  try { db.$client.prepare("SELECT id FROM settings LIMIT 1").get(); db.$client.prepare("SELECT id FROM reviews LIMIT 1").get(); return ok({ status: "healthy", mode: "private-local", version: "0.2.0" }); }
  catch { return errorResponse(new AppError("unprocessable", "Database needs setup. Stop the app, run npm run setup, then restart.")); }
}
