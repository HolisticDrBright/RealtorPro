import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
const store = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("@/lib/private-store", () => ({ readGoogleSecret: () => structuredClone(store.value), saveGoogleSecret: (value: unknown) => { store.value = structuredClone(value); } }));
import * as google from "@/services/google-calendar";
const origin = "http://127.0.0.1:3100";
const fetchMock = vi.fn();
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
beforeEach(() => { store.value = null; fetchMock.mockReset(); vi.stubGlobal("fetch", fetchMock); google.configureGoogle({ clientId: "123-test.apps.googleusercontent.com", clientSecret: "synthetic-client-secret" }); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });
async function connect() {
  const flow = google.startGoogle(origin);
  fetchMock.mockResolvedValueOnce(json({ access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_in: 3600 }));
  await google.finishGoogle(flow.state, flow.state, "synthetic-code", origin);
  fetchMock.mockResolvedValueOnce(json({ items: [{ id: "test@example.com", summary: "Test calendar", timeZone: "America/Los_Angeles", accessRole: "owner" }] }));
  await google.selectGoogleCalendar("test@example.com");
}
const event = { summary: "Review investment criteria", start: "2030-06-04T14:00:00-07:00", end: "2030-06-04T14:30:00-07:00" };
describe("Google Calendar OAuth and approval delivery", () => {
  it("exposes status without credentials; binds authorization to loopback, state and PKCE", () => {
    expect(JSON.stringify(google.googleStatus())).not.toMatch(/synthetic|clientSecret|refreshToken/);
    const flow = google.startGoogle(origin), url = new URL(flow.url);
    expect(url.origin).toBe("https://accounts.google.com"); expect(url.searchParams.get("redirect_uri")).toBe(origin + "/google/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256"); expect(url.searchParams.get("code_challenge")?.length).toBe(43);
    expect(url.searchParams.get("state")).toBe(flow.state); expect(url.searchParams.get("access_type")).toBe("offline");
    expect(() => google.startGoogle("https://evil.example")).toThrow();
  });
  it("rejects missing/wrong cookie, wrong origin, expired flow and replay without token calls", async () => {
    const flow = google.startGoogle(origin);
    await expect(google.finishGoogle(flow.state, undefined, "code", origin)).rejects.toThrow();
    await expect(google.finishGoogle(flow.state, "wrong", "code", origin)).rejects.toThrow();
    await expect(google.finishGoogle(flow.state, flow.state, "code", "http://localhost:3100")).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValueOnce(json({ access_token: "a", refresh_token: "r" }));
    await google.finishGoogle(flow.state, flow.state, "code", origin);
    await expect(google.finishGoogle(flow.state, flow.state, "code", origin)).rejects.toThrow();
    const next = google.startGoogle(origin); vi.useFakeTimers(); vi.setSystemTime(Date.now() + 601000);
    await expect(google.finishGoogle(next.state, next.state, "code", origin)).rejects.toThrow(); expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("exchanges codes server-side with the verifier; selects only returned writable calendars", async () => {
    await connect();
    const body = fetchMock.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("code_verifier")?.length).toBeGreaterThanOrEqual(43); expect(body.get("grant_type")).toBe("authorization_code");
    expect(google.googleStatus()).toMatchObject({ connected: true, calendarId: "test@example.com", calendarName: "Test calendar" });
    fetchMock.mockResolvedValueOnce(json({ items: [] })); await expect(google.selectGoogleCalendar("other@example.com")).rejects.toThrow(/Choose/);
  });
  it("keeps partial grants disconnected and sanitizes Google errors", async () => {
    const flow = google.startGoogle(origin);
    fetchMock.mockResolvedValueOnce(json({ access_token: "secret", refresh_token: "secret", scope: "openid" }));
    await expect(google.finishGoogle(flow.state, flow.state, "code", origin)).rejects.toThrow(/permissions/);
    expect(google.googleStatus().connected).toBe(false);
    const next = google.startGoogle(origin); fetchMock.mockResolvedValueOnce(json({ error: "sensitive-provider-message" }, 400));
    await expect(google.finishGoogle(next.state, next.state, "code", origin)).rejects.toThrow(/authorization failed/);
  });
  it("reads bounded events with an explicit range and reports incomplete pages", async () => {
    await connect(); fetchMock.mockResolvedValueOnce(json({ items: [{ id: "one", summary: "Client call", start: { dateTime: event.start }, end: { dateTime: event.end }, description: "x".repeat(5000) }], nextPageToken: "more" }));
    const found = await google.googleEvents({ start: event.start, end: event.end });
    expect(found.incomplete).toBe(true); expect(found.items[0].description?.length).toBe(4000);
    const [url, request] = fetchMock.mock.calls.at(-1)!;
    expect(url).toContain("test%40example.com/events?"); expect(request.headers.Authorization).toBe("Bearer synthetic-access");
    await expect(google.googleEvents({ start: "2030-01-01T00:00:00Z", end: "2031-01-01T00:00:00Z" })).rejects.toThrow();
  });
  it("prepares without writing and sends one event with a deterministic ID and no invitations", async () => {
    await connect(); const previous = fetchMock.mock.calls.length;
    const proposal = google.prepareGoogleEvent(event); expect(fetchMock).toHaveBeenCalledTimes(previous);
    const reviewId = crypto.randomUUID(); let saved: Record<string, unknown> = {};
    fetchMock.mockImplementation(async (url: string, options: { method: string; body?: string }) => {
      if (options.method === "POST") { saved = JSON.parse(options.body!); return json({ ...saved, htmlLink: "https://calendar.google.com/" }); }
      if (url.includes("/events?")) return json({ items: [] });
      return Object.keys(saved).length ? json(saved) : json({}, 404);
    });
    const first = await google.applyGoogleEvent(proposal, reviewId);
    const second = await google.applyGoogleEvent(proposal, reviewId);
    expect(first.id).toBe(second.id); expect(second.recovered).toBe(true);
    const writes = fetchMock.mock.calls.filter(([, opts]) => opts.method === "POST"); expect(writes).toHaveLength(2); // initial token exchange + event
    expect(writes.at(-1)![0]).toContain("sendUpdates=none"); expect(saved.attendees).toBeUndefined();
    expect(saved.extendedProperties).toEqual({ private: { realtorproReview: reviewId } });
  });
  it("blocks overlap, incomplete availability, malformed dates and invitations", async () => {
    await connect(); const p = google.prepareGoogleEvent(event);
    fetchMock.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({ items: [{ id: "busy", summary: "Busy" }] }));
    await expect(google.applyGoogleEvent(p, crypto.randomUUID())).rejects.toThrow(/overlaps/);
    fetchMock.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({ items: [], nextPageToken: "more" }));
    await expect(google.applyGoogleEvent(p, crypto.randomUUID())).rejects.toThrow(/incomplete/);
    expect(() => google.prepareGoogleEvent({ ...event, end: event.start })).toThrow();
    expect(() => google.prepareGoogleEvent({ ...event, attendees: ["someone@example.com"] })).toThrow();
  });
  it("rejects account/selection changes after preview and disconnects locally even if revocation fails", async () => {
    await connect(); const p = google.prepareGoogleEvent(event);
    fetchMock.mockResolvedValueOnce(json({}, 500)); expect(await google.disconnectGoogle()).toMatch(/Disconnected locally/);
    expect(google.googleStatus()).toMatchObject({ configured: true, connected: false, calendarId: null });
    await expect(google.applyGoogleEvent(p, crypto.randomUUID())).rejects.toThrow(/changed/);
    expect(JSON.stringify(store.value)).not.toContain("synthetic-refresh");
  });
  it("refreshes an expired access token without revealing it to the status endpoint", async () => {
    await connect(); vi.useFakeTimers(); vi.setSystemTime(Date.now() + 3600000);
    fetchMock.mockResolvedValueOnce(json({ access_token: "replacement", expires_in: 3600 })).mockResolvedValueOnce(json({ items: [] }));
    await google.googleCalendars();
    const tokenCall = fetchMock.mock.calls.at(-2)!;
    expect((tokenCall[1].body as URLSearchParams).get("grant_type")).toBe("refresh_token");
    expect(JSON.stringify(google.googleStatus())).not.toContain("replacement");
  });
  it("invalidates pending events even when reconnecting to the same shared calendar", async () => {
    await connect(); const old = google.prepareGoogleEvent(event);
    await connect();
    expect(() => google.validateGoogleProposal(old)).toThrow(/changed/);
  });
  it("allows only a top-level OAuth callback exception, preserving all other cross-site protections", () => {
    vi.stubEnv("COMMAND_CENTER_TOKEN", "test-session");
    const req = (pathname: string, extra = {}) => new NextRequest(origin + pathname, { headers: { host: "127.0.0.1:3100", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate", "sec-fetch-dest": "document", ...extra } });
    expect(middleware(req("/google/callback?state=x")).status).toBe(200);
    expect(middleware(req("/google/callback?state=x")).cookies.get("cc-session")).toBeUndefined();
    expect(middleware(req("/integrations")).status).toBe(403);
    expect(middleware(req("/api/google")).status).toBe(403);
    expect(middleware(req("/google/callback", { "sec-fetch-mode": "cors" })).status).toBe(403);
  });
  it("finishes through the actual callback route without weakening the app cookie or reflecting secrets", async () => {
    const flow = google.startGoogle(origin);
    fetchMock.mockResolvedValueOnce(json({ access_token: "test-access-token", refresh_token: "test-refresh-token" }));
    const { GET } = await import("@/app/google/callback/route");
    const req = new NextRequest(origin + "/google/callback?state=" + flow.state + "&code=code-value", { headers: { host: "127.0.0.1:3100", cookie: "google-oauth-state=" + flow.state } });
    const response = await GET(req), html = await response.text();
    expect(response.status).toBe(200); expect(html).toContain("Return to RealtorPro Integrations");
    expect(html).not.toMatch(/test-access-token|test-refresh-token|code-value/);
    expect(response.cookies.get("cc-session")).toBeUndefined();
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});
