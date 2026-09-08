import { NextRequest } from "next/server";
import { z } from "zod";
import { readJson } from "@/lib/api";
import { errorResponse, ok } from "@/lib/errors";
import { configureGoogle, disconnectGoogle, googleCalendars, googleEvents, googleStatus, selectGoogleCalendar, startGoogle } from "@/services/google-calendar";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try { const mode = req.nextUrl.searchParams.get("mode");
    if (mode === "calendars") return ok(await googleCalendars());
    if (mode === "events") return ok(await googleEvents({ start: req.nextUrl.searchParams.get("start"), end: req.nextUrl.searchParams.get("end") }));
    return ok(googleStatus());
  } catch (e) { return errorResponse(e); }
}
const Input = z.discriminatedUnion("action", [z.object({ action: z.literal("configure"), clientId: z.string(), clientSecret: z.string() }).strict(), z.object({ action: z.literal("connect") }).strict(), z.object({ action: z.literal("select"), calendarId: z.string().max(1000) }).strict(), z.object({ action: z.literal("disconnect") }).strict()]);
export async function POST(req: NextRequest) {
  try { const input = await readJson(req, Input);
    if (input.action === "configure") { configureGoogle({ clientId: input.clientId, clientSecret: input.clientSecret }); return ok({ saved: true }); }
    if (input.action === "select") { await selectGoogleCalendar(input.calendarId); return ok({ saved: true }); }
    if (input.action === "disconnect") return ok({ disconnected: true, warning: await disconnectGoogle() });
    const flow = startGoogle(req.headers.get("origin") || ""); const response = ok({ url: flow.url });
    response.cookies.set("google-oauth-state", flow.state, { httpOnly: true, sameSite: "lax", path: "/google/callback", maxAge: 600 }); return response;
  } catch (e) { return errorResponse(e); }
}
