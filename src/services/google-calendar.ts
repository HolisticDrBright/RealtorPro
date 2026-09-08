import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { readGoogleSecret, saveGoogleSecret } from "@/lib/private-store";
import { AppError } from "@/lib/errors";

const SCOPES = ["https://www.googleapis.com/auth/calendar.calendarlist.readonly", "https://www.googleapis.com/auth/calendar.events"];
interface Config { clientId: string; clientSecret: string; refreshToken?: string; connectionId: string; calendarId?: string; calendarName?: string; timeZone?: string; }
const config = () => readGoogleSecret<Config>();
const pending = new Map<string, { verifier: string; origin: string; expires: number; connectionId: string }>();
let cached: { connectionId: string; value: string; expires: number } | undefined;
const fail = (message: string) => new AppError("unprocessable", message);
const originSchema = z.string().regex(/^http:\/\/(127\.0\.0\.1|localhost):\d{1,5}$/);
export const GoogleSetup = z.object({ clientId: z.string().trim().regex(/^[\w-]+\.apps\.googleusercontent\.com$/), clientSecret: z.string().trim().min(6).max(1000) }).strict();
export function configureGoogle(input: unknown) { const fields = GoogleSetup.parse(input); saveGoogleSecret({ ...fields, connectionId: randomUUID() }); cached = undefined; pending.clear(); }
export function googleStatus() {
  try { const cfg = config(); return { configured: !!cfg, connected: !!cfg?.refreshToken, calendarId: cfg?.calendarId ?? null, calendarName: cfg?.calendarName ?? null, timeZone: cfg?.timeZone ?? null, error: null }; }
  catch (e) { return { configured: false, connected: false, calendarId: null, calendarName: null, timeZone: null, error: e instanceof AppError ? e.message : "Could not unlock Google credentials. Reconnect on this computer." }; }
}
export function startGoogle(origin: string) {
  originSchema.parse(origin); const cfg = config(); if (!cfg) throw fail("Save your Google OAuth client settings first.");
  const state = randomBytes(32).toString("hex"), verifier = randomBytes(48).toString("base64url");
  for (const [key, value] of pending) if (value.expires < Date.now()) pending.delete(key);
  if (pending.size > 10) pending.clear();
  pending.set(state, { verifier, origin, connectionId: cfg.connectionId, expires: Date.now() + 600000 });
  const params = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: origin + "/google/callback", response_type: "code", scope: SCOPES.join(" "), access_type: "offline", prompt: "consent select_account", state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" });
  return { state, url: "https://accounts.google.com/o/oauth2/v2/auth?" + params };
}
async function tokenRequest(body: Record<string, string>) {
  let response: Response;
  try { response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body), signal: AbortSignal.timeout(20000), cache: "no-store", redirect: "error" }); }
  catch { throw fail("Google sign-in could not reach its server. Check your connection and try again."); }
  if (!response.ok) throw fail("Google authorization failed or expired. Check your OAuth client settings and reconnect. Testing-mode access can expire after seven days.");
  return await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
}
export async function finishGoogle(state: string, cookie: string | undefined, code: string, origin: string) {
  const flow = pending.get(state);
  if (!flow || !cookie || state !== cookie || flow.origin !== origin || flow.expires < Date.now()) throw fail("Google sign-in expired or came from another browser. Start Connect Google Calendar again.");
  pending.delete(state);
  const cfg = config(); if (!cfg || cfg.connectionId !== flow.connectionId) throw fail("Google settings changed. Start sign-in again.");
  const result = await tokenRequest({ code: z.string().min(1).max(4096).parse(code), client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: origin + "/google/callback", grant_type: "authorization_code", code_verifier: flow.verifier });
  if (!result.refresh_token || !result.access_token || (result.scope && SCOPES.some((s) => !result.scope!.split(" ").includes(s)))) throw fail("Google did not grant the requested calendar permissions. Reconnect and approve both calendar permissions.");
  if (config()?.connectionId !== cfg.connectionId) throw fail("Google settings changed during sign-in. Reconnect.");
  const connectionId = randomUUID(); // Every successful sign-in is a new account generation.
  saveGoogleSecret({ ...cfg, connectionId, refreshToken: result.refresh_token, calendarId: undefined, calendarName: undefined, timeZone: undefined });
  cached = { connectionId, value: result.access_token, expires: Date.now() + Math.min(result.expires_in || 3600, 3600) * 1000 - 60000 };
}
async function accessToken() {
  const cfg = config(); if (!cfg?.refreshToken) throw fail("Connect Google Calendar in Integrations first.");
  if (cached?.connectionId === cfg.connectionId && cached.expires > Date.now()) return cached.value;
  const result = await tokenRequest({ client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: cfg.refreshToken, grant_type: "refresh_token" });
  if (!result.access_token || config()?.connectionId !== cfg.connectionId) throw fail("Google connection changed or expired. Reconnect.");
  cached = { connectionId: cfg.connectionId, value: result.access_token, expires: Date.now() + Math.min(result.expires_in || 3600, 3600) * 1000 - 60000 };
  return cached.value;
}
async function google(path: string, method = "GET", body?: unknown, missing = false): Promise<Record<string, unknown>> {
  const token = await accessToken(); let r: Response;
  try { r = await fetch("https://www.googleapis.com/calendar/v3/" + path, { method, headers: { Authorization: `Bearer ${token}`, ...(body ? { "content-type": "application/json" } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000), cache: "no-store", redirect: "error" }); }
  catch { throw fail("Google Calendar request was interrupted. Check the event in Google before retrying; approved event IDs are reused to avoid duplicates."); }
  if (missing && r.status === 404) return {};
  if (!r.ok) { if (r.status === 401) cached = undefined; throw fail(r.status === 403 ? "Google denied calendar access. Enable the Calendar API in your Cloud project, check calendar permissions, and reconnect." : r.status === 409 ? "Google already has an event with this ID. Retry this same review to check it." : "Google Calendar could not complete the request. Refresh or reconnect in Integrations."); }
  return await r.json();
}
export async function googleCalendars() {
  const r = await google("users/me/calendarList?maxResults=100&minAccessRole=writer");
  return { items: ((r.items || []) as Record<string, unknown>[]).map((c) => ({ id: String(c.id), name: String(c.summaryOverride || c.summary || c.id), timeZone: String(c.timeZone || "UTC"), primary: c.primary === true })), incomplete: !!r.nextPageToken };
}
export async function selectGoogleCalendar(id: string) {
  const cfg = config(); if (!cfg?.refreshToken) throw fail("Connect Google first.");
  const calendar = (await googleCalendars()).items.find((c) => c.id === id); if (!calendar) throw fail("Choose a writable calendar from the displayed list.");
  if (config()?.connectionId !== cfg.connectionId) throw fail("Google connection changed. Refresh first.");
  saveGoogleSecret({ ...cfg, calendarId: id, calendarName: calendar.name, timeZone: calendar.timeZone });
}
export async function disconnectGoogle() {
  const cfg = config(); if (!cfg) return;
  saveGoogleSecret({ clientId: cfg.clientId, clientSecret: cfg.clientSecret, connectionId: randomUUID() }); cached = undefined; pending.clear();
  if (cfg.refreshToken) try { const r = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: cfg.refreshToken }), signal: AbortSignal.timeout(15000), redirect: "error" }); if (!r.ok) return "Disconnected locally. Remove RealtorPro access from your Google Account to finish revocation."; }
  catch { return "Disconnected locally. Remove RealtorPro access from your Google Account to finish revocation."; }
}
export const GoogleRange = z.object({ start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }) }).strict().refine((v) => Date.parse(v.end) > Date.parse(v.start) && Date.parse(v.end) - Date.parse(v.start) <= 90 * 86400000, "Use a date range of 90 days or less");
export async function googleEvents(raw: unknown) {
  const range = GoogleRange.parse(raw), cfg = config(); if (!cfg?.calendarId) throw fail("Choose a Google calendar in Integrations first.");
  const params = new URLSearchParams({ timeMin: range.start, timeMax: range.end, singleEvents: "true", orderBy: "startTime", maxResults: "100" });
  const r = await google(`calendars/${encodeURIComponent(cfg.calendarId)}/events?${params}`);
  return { calendarId: cfg.calendarId, calendarName: cfg.calendarName, timeZone: cfg.timeZone, incomplete: !!r.nextPageToken, items: ((r.items || []) as Record<string, unknown>[]).map((e) => ({ id: String(e.id), summary: String(e.summary || "Busy"), start: e.start, end: e.end, status: e.status, location: e.location, description: typeof e.description === "string" ? e.description.slice(0, 4000) : undefined, htmlLink: e.htmlLink, transparency: e.transparency })) };
}
export const GoogleEventInput = z.object({ summary: z.string().trim().min(1).max(200), start: z.string().datetime({ offset: true }), end: z.string().datetime({ offset: true }), description: z.string().max(8000).default(""), location: z.string().max(1000).default("") }).strict().refine((v) => Date.parse(v.end) > Date.parse(v.start) && Date.parse(v.end) - Date.parse(v.start) <= 7 * 86400000, "Event must end after its start and last at most seven days");
export const GoogleEventProposal = z.object({ action: z.literal("google_event"), connectionId: z.string().uuid(), calendarId: z.string().min(1), calendarName: z.string(), event: GoogleEventInput }).strict();
export function prepareGoogleEvent(input: unknown) {
  const cfg = config(); if (!cfg?.calendarId || !cfg.refreshToken) throw fail("Connect and choose a Google Calendar first.");
  return GoogleEventProposal.parse({ action: "google_event", connectionId: cfg.connectionId, calendarId: cfg.calendarId, calendarName: cfg.calendarName || cfg.calendarId, event: input });
}
export function validateGoogleProposal(p: z.infer<typeof GoogleEventProposal>) {
  GoogleEventProposal.parse(p); const cfg = config();
  if (!cfg?.refreshToken || cfg.connectionId !== p.connectionId || cfg.calendarId !== p.calendarId) throw fail("Google account or calendar selection changed. Generate a fresh proposal.");
  return { calendar: p.calendarName, ...p.event, invitations: "None. This creates a Google event only, not a duplicate local appointment." };
}
export async function applyGoogleEvent(p: z.infer<typeof GoogleEventProposal>, reviewId: string) {
  validateGoogleProposal(p);
  const eventId = createHash("sha256").update("realtorpro:" + reviewId).digest("hex"), url = `calendars/${encodeURIComponent(p.calendarId)}/events`;
  const previous = await google(url + "/" + eventId, "GET", undefined, true);
  if (previous.id) {
    const marker = previous.extendedProperties as { private?: { realtorproReview?: string } } | undefined;
    if (marker?.private?.realtorproReview !== reviewId || previous.status === "cancelled") throw fail("This approved event was changed or removed in Google. Check it there before creating a new proposal.");
    return { id: eventId, calendarId: p.calendarId, htmlLink: previous.htmlLink, recovered: true };
  }
  const range = await googleEvents({ start: p.event.start, end: p.event.end });
  if (range.incomplete || range.items.some((e) => e.status !== "cancelled" && e.transparency !== "transparent")) throw fail("This time overlaps a Google event or availability is incomplete. Choose another time.");
  validateGoogleProposal(p);
  const result = await google(url + "?sendUpdates=none", "POST", { id: eventId, summary: p.event.summary, description: p.event.description, location: p.event.location, start: { dateTime: p.event.start }, end: { dateTime: p.event.end }, extendedProperties: { private: { realtorproReview: reviewId } } });
  return { id: result.id, calendarId: p.calendarId, htmlLink: result.htmlLink };
}
