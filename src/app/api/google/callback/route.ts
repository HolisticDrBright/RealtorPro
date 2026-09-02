import { NextResponse, type NextRequest } from "next/server";
import { completeAuth } from "@/services/google";
export const runtime = "nodejs";
/** OAuth redirect target (loopback). Stores tokens locally and returns to the dashboard. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state") ?? "";
  const home = new URL("/", req.nextUrl.origin);
  if (!code) { home.searchParams.set("google", "denied"); return NextResponse.redirect(home); }
  try {
    await completeAuth(code, state);
    home.searchParams.set("google", "connected");
  } catch (err) {
    home.searchParams.set("google", "error");
    home.searchParams.set("message", err instanceof Error ? err.message : "Connection failed");
  }
  return NextResponse.redirect(home);
}
