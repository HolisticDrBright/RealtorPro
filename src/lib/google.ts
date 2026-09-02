/**
 * Pure helpers for the read-only Google connection (Calendar + Gmail).
 * No network here — unit-tested shapes and URL building only.
 */

export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

export function buildAuthUrl(opts: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.searchParams.set("client_id", opts.clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  u.searchParams.set("access_type", "offline"); // refresh token for local use
  u.searchParams.set("prompt", "consent");
  u.searchParams.set("include_granted_scopes", "true");
  u.searchParams.set("state", opts.state);
  return u.toString();
}

export interface GoogleCalendarItem {
  id?: string;
  status?: string;
  summary?: string;
  location?: string | null;
  description?: string | null;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  hangoutLink?: string | null;
}

export interface CalendarEventInput {
  externalId: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  notes: string | null;
  allDay: boolean;
}

/** Google Calendar event → local calendar row. Cancelled events return null. */
export function parseCalendarEvent(item: GoogleCalendarItem): CalendarEventInput | null {
  if (!item.id || item.status === "cancelled") return null;
  const start = item.start?.dateTime ?? (item.start?.date ? `${item.start.date}T09:00:00` : null);
  if (!start) return null;
  const end = item.end?.dateTime ?? (item.end?.date ? `${item.end.date}T09:00:00` : null);
  return {
    externalId: item.id,
    title: item.summary?.trim() || "(no title)",
    startsAt: new Date(start).toISOString(),
    endsAt: end ? new Date(end).toISOString() : null,
    location: item.location?.trim() || item.hangoutLink || null,
    notes: item.description?.trim().slice(0, 500) || null,
    allDay: !item.start?.dateTime,
  };
}

export interface GmailHeader { name: string; value: string }
export interface GmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  labelIds?: string[];
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
}
export interface InboxItem {
  id: string;
  threadId: string | null;
  from: string;
  fromEmail: string | null;
  subject: string;
  receivedAt: string | null;
  snippet: string;
  unread: boolean;
  important: boolean;
}

export const headerOf = (headers: GmailHeader[] | undefined, name: string): string =>
  headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

/** Gmail message (metadata format) → a compact inbox item. Body is never fetched. */
export function parseGmailMessage(m: GmailMessage): InboxItem {
  const fromRaw = headerOf(m.payload?.headers, "From");
  const email = fromRaw.match(/<([^>]+)>/)?.[1] ?? (fromRaw.includes("@") ? fromRaw.trim() : null);
  const name = fromRaw.replace(/<[^>]+>/, "").trim().replace(/^"(.*)"$/, "$1").trim() || email || "Unknown sender";
  const labels = m.labelIds ?? [];
  return {
    id: m.id,
    threadId: m.threadId ?? null,
    from: name,
    fromEmail: email,
    subject: headerOf(m.payload?.headers, "Subject") || "(no subject)",
    receivedAt: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : null,
    snippet: (m.snippet ?? "").replace(/\s+/g, " ").trim().slice(0, 200),
    unread: labels.includes("UNREAD"),
    important: labels.includes("IMPORTANT") || labels.includes("STARRED"),
  };
}

/** Start/end of a local calendar day as ISO strings. */
export function dayBounds(date: Date = new Date()): { timeMin: string; timeMax: string } {
  const start = new Date(date); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

/** Gmail search for "today's mail worth a glance": last 24h, no promotions/social/forums. */
export const INBOX_QUERY = "newer_than:1d in:inbox -category:promotions -category:social -category:forums";
