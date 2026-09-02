import "server-only";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { calendarEvents } from "@/db/schema.dashboard";
import { WORKSPACE_DIR } from "@/lib/paths";
import { buildAuthUrl, dayBounds, INBOX_QUERY, parseCalendarEvent, parseGmailMessage, type GoogleCalendarItem, type GmailMessage, type InboxItem } from "@/lib/google";
import { AppError } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

/**
 * Google Calendar + Gmail, READ-ONLY, for the daily briefing.
 *
 * - You create your own OAuth client in Google Cloud (Desktop/Web app) and put
 *   its id/secret in .env. Tokens are stored in workspace/google-tokens.json
 *   (gitignored) on this machine only.
 * - Scopes are calendar.readonly + gmail.readonly. There is no code path that
 *   sends mail, creates events, or modifies anything in your Google account.
 * - Calendar events are mirrored into calendar_events (source "google").
 *   Inbox items are held in memory for a couple of minutes and never written
 *   to the database.
 */

const TOKEN_FILE = path.join(WORKSPACE_DIR, "google-tokens.json");
const STATE_FILE = path.join(WORKSPACE_DIR, "google-oauth-state.json");

interface Tokens { access_token: string; refresh_token?: string; expires_at: number; scope?: string; email?: string }

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || "http://localhost:3000/api/google/callback";
  return { clientId, clientSecret, redirectUri, configured: !!clientId && !!clientSecret };
}

function readTokens(): Tokens | null {
  try { return JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8")) as Tokens; } catch { return null; }
}
function writeTokens(t: Tokens | null) {
  if (!t) { try { fs.unlinkSync(TOKEN_FILE); } catch { /* none */ } return; }
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(t, null, 2), { mode: 0o600 });
}

export function isGoogleConnected(): boolean {
  const t = readTokens();
  return !!t && (!!t.refresh_token || t.expires_at > Date.now());
}

export function googleStatus() {
  const cfg = googleConfig();
  const t = readTokens();
  return { configured: cfg.configured, connected: isGoogleConnected(), email: t?.email ?? null, redirectUri: cfg.redirectUri, lastCalendarSyncAt: calendarCache.at ? new Date(calendarCache.at).toISOString() : null };
}

/** Build the consent URL and remember a one-time state value. */
export function beginAuth(): string {
  const cfg = googleConfig();
  if (!cfg.configured) throw new AppError("unprocessable", "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env to connect Google Calendar and Gmail.");
  const state = crypto.randomBytes(16).toString("hex");
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ state, at: Date.now() }));
  return buildAuthUrl({ clientId: cfg.clientId, redirectUri: cfg.redirectUri, state });
}

async function tokenRequest(params: Record<string, string>): Promise<Tokens> {
  const cfg = googleConfig();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: cfg.clientId, client_secret: cfg.clientSecret, ...params }).toString(),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string; error?: string };
  if (!res.ok || !j.access_token) throw new AppError("provider_error", `Google token request failed: ${j.error_description ?? j.error ?? res.status}`);
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + ((j.expires_in ?? 3600) - 60) * 1000, scope: j.scope };
}

/** Exchange the OAuth code, store tokens locally, and look up the account email. */
export async function completeAuth(code: string, state: string): Promise<{ email: string | null }> {
  const cfg = googleConfig();
  let expected: { state: string; at: number } | null = null;
  try { expected = JSON.parse(fs.readFileSync(STATE_FILE, "utf8")); } catch { /* none */ }
  if (!expected || expected.state !== state || Date.now() - expected.at > 10 * 60 * 1000) throw new AppError("unauthorized", "OAuth state did not match. Start the connection again from the dashboard.");
  try { fs.unlinkSync(STATE_FILE); } catch { /* ignore */ }
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: cfg.redirectUri });
  const prev = readTokens();
  if (!t.refresh_token && prev?.refresh_token) t.refresh_token = prev.refresh_token;
  // Account email via the Gmail profile endpoint (read-only scope already granted).
  let email: string | null = null;
  try {
    const p = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { authorization: `Bearer ${t.access_token}` } });
    email = ((await p.json()) as { emailAddress?: string }).emailAddress ?? null;
  } catch { /* optional */ }
  writeTokens({ ...t, email: email ?? undefined });
  calendarCache.at = 0; inboxCache.at = 0;
  writeAudit({ action: "google.connected", metadata: { email, scopes: t.scope } });
  return { email };
}

export function disconnectGoogle() {
  writeTokens(null);
  db.delete(calendarEvents).where(eq(calendarEvents.source, "google")).run();
  calendarCache.at = 0; inboxCache.at = 0; inboxCache.items = [];
  writeAudit({ action: "google.disconnected" });
}

async function accessToken(): Promise<string> {
  const t = readTokens();
  if (!t) throw new AppError("unauthorized", "Google is not connected.");
  if (t.expires_at > Date.now()) return t.access_token;
  if (!t.refresh_token) throw new AppError("unauthorized", "Google session expired — connect again.");
  const fresh = await tokenRequest({ refresh_token: t.refresh_token, grant_type: "refresh_token" });
  writeTokens({ ...t, ...fresh, refresh_token: t.refresh_token });
  return fresh.access_token;
}

async function gget<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${await accessToken()}` } });
  if (res.status === 401) throw new AppError("unauthorized", "Google rejected the token — connect again.");
  if (res.status === 429) throw new AppError("rate_limited", "Google rate-limited the request; try again in a minute.");
  if (!res.ok) throw new AppError("provider_error", `Google returned ${res.status}.`);
  return (await res.json()) as T;
}

// ── Calendar ────────────────────────────────────────────────────────────────
const calendarCache = { at: 0 };
const CALENDAR_TTL_MS = 2 * 60 * 1000;

/** Mirror the next two weeks of the primary calendar into calendar_events (source "google"). */
export async function syncCalendar(force = false): Promise<{ upserted: number; removed: number; skipped: boolean }> {
  if (!isGoogleConnected()) return { upserted: 0, removed: 0, skipped: true };
  if (!force && Date.now() - calendarCache.at < CALENDAR_TTL_MS) return { upserted: 0, removed: 0, skipped: true };
  const { timeMin } = dayBounds(new Date(Date.now() - 24 * 3600 * 1000));
  const timeMax = new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString();
  const url = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
  url.searchParams.set("timeMin", timeMin); url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true"); url.searchParams.set("orderBy", "startTime"); url.searchParams.set("maxResults", "250");
  const page = await gget<{ items?: GoogleCalendarItem[] }>(url.toString());
  const seen = new Set<string>();
  let upserted = 0;
  for (const item of page.items ?? []) {
    const ev = parseCalendarEvent(item);
    if (!ev) continue;
    seen.add(ev.externalId);
    const existing = db.select().from(calendarEvents).where(eq(calendarEvents.externalId, ev.externalId)).get();
    const values = { title: ev.title, startsAt: ev.startsAt, endsAt: ev.endsAt, location: ev.location, notes: ev.notes, source: "google" };
    if (existing) db.update(calendarEvents).set(values).where(eq(calendarEvents.id, existing.id)).run();
    else db.insert(calendarEvents).values({ externalId: ev.externalId, ...values }).run();
    upserted++;
  }
  // Drop Google events in the window that no longer exist upstream.
  const mine = db.select().from(calendarEvents).where(eq(calendarEvents.source, "google")).all();
  let removed = 0;
  for (const e of mine) {
    if (e.startsAt >= timeMin && e.startsAt <= timeMax && e.externalId && !seen.has(e.externalId)) { db.delete(calendarEvents).where(eq(calendarEvents.id, e.id)).run(); removed++; }
  }
  calendarCache.at = Date.now();
  return { upserted, removed, skipped: false };
}

// ── Gmail ───────────────────────────────────────────────────────────────────
const inboxCache: { at: number; items: InboxItem[] } = { at: 0, items: [] };
const INBOX_TTL_MS = 2 * 60 * 1000;

/** Today's inbox (metadata + snippet only, never bodies), cached briefly in memory. */
export async function inbox(force = false, max = 15): Promise<InboxItem[]> {
  if (!isGoogleConnected()) return [];
  if (!force && Date.now() - inboxCache.at < INBOX_TTL_MS) return inboxCache.items;
  const list = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  list.searchParams.set("q", INBOX_QUERY); list.searchParams.set("maxResults", String(max));
  const ids = (await gget<{ messages?: { id: string }[] }>(list.toString())).messages ?? [];
  const items: InboxItem[] = [];
  for (const { id } of ids) {
    const u = new URL(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}`);
    u.searchParams.set("format", "metadata");
    for (const h of ["From", "Subject", "Date"]) u.searchParams.append("metadataHeaders", h);
    items.push(parseGmailMessage(await gget<GmailMessage>(u.toString())));
  }
  items.sort((a, b) => Number(b.important) - Number(a.important) || (b.receivedAt ?? "").localeCompare(a.receivedAt ?? ""));
  inboxCache.at = Date.now(); inboxCache.items = items;
  return items;
}

/** Best-effort refresh used by the dashboard: never throws, returns what it could get. */
export async function googleForDashboard(): Promise<{ inbox: InboxItem[]; error: string | null }> {
  if (!isGoogleConnected()) return { inbox: [], error: null };
  try {
    await syncCalendar();
    return { inbox: await inbox(), error: null };
  } catch (err) {
    return { inbox: inboxCache.items, error: err instanceof Error ? err.message : "Google request failed." };
  }
}
