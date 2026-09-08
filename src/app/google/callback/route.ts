import { NextRequest, NextResponse } from "next/server";
import { finishGoogle } from "@/services/google-calendar";
import { AppError } from "@/lib/errors";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const origin = `http://${req.headers.get("host")}`;
  try {
    await finishGoogle(req.nextUrl.searchParams.get("state") || "", req.cookies.get("google-oauth-state")?.value, req.nextUrl.searchParams.get("code") || "", origin);
    // A new same-origin link click ends the cross-site redirect chain. The
    // app's Strict session cookie must not be weakened for the OAuth flow.
    const response = new NextResponse('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Google Calendar connected</title></head><body><h1>Google Calendar authorized</h1><p>Return to RealtorPro to select your calendar and test the connection.</p><p><a href="/integrations?google=connected">Return to RealtorPro Integrations</a></p></body></html>', { headers: { "content-type": "text/html; charset=utf-8" } });
    response.cookies.set("google-oauth-state", "", { httpOnly: true, sameSite: "lax", path: "/google/callback", maxAge: 0 });
    response.headers.set("Referrer-Policy", "no-referrer"); response.headers.set("Cache-Control", "no-store"); return response;
  } catch (e) {
    // Plain text: no auth codes, tokens, raw provider errors, or reflected HTML.
    return new NextResponse((e instanceof AppError ? e.message : "Google sign-in did not finish.") + " Return to Integrations and try Connect Google Calendar again.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
  }
}
