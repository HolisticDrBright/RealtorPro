import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const deny = (message: string, status = 403) => NextResponse.json({ error: { message } }, { status });
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host)) return deny("This private app only accepts localhost requests.");
  const origin = req.headers.get("origin");
  if (origin && origin !== `http://${host}` && origin !== `https://${host}`) return deny("Cross-site requests are not allowed.");
  if (req.headers.get("sec-fetch-site") === "cross-site") return deny("Open the app directly on localhost.");
  const token = process.env.COMMAND_CENTER_TOKEN;
  if (!token) return deny("Start the app using npm run dev or npm start.", 503);
  const bearer = req.headers.get("authorization") === `Bearer ${token}`;
  const session = req.cookies.get("cc-session")?.value === token;
  if (req.nextUrl.pathname.startsWith("/api/")) {
    if (!session && !bearer) return deny("Open the app in your browser first.", 401);
    if (bearer && (req.nextUrl.pathname.startsWith("/api/obsidian/") || req.nextUrl.pathname === "/api/integrations/folders")) return deny("MCP access does not include original vault files or folder browsing.");
    if (bearer && !["GET", "HEAD"].includes(req.method) && !["/api/import/preview", "/api/reviews"].includes(req.nextUrl.pathname)) return deny("Agent changes must be proposed for human review.");
    if (!bearer && !["GET", "HEAD"].includes(req.method) && !origin) return deny("A same-origin browser request is required.");
  }
  const res = NextResponse.next();
  if (!session && !bearer && req.headers.get("sec-fetch-mode") === "navigate" && req.headers.get("sec-fetch-dest") === "document") {
    res.cookies.set("cc-session", token, { httpOnly: true, sameSite: "strict", path: "/" });
  }
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "no-referrer");
  res.headers.set("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  if (req.nextUrl.pathname.startsWith("/api/")) res.headers.set("Cache-Control", "no-store");
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
