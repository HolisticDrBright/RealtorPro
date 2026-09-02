import { describe, expect, it } from "vitest";
import { buildAuthUrl, dayBounds, parseCalendarEvent, parseGmailMessage } from "../src/lib/google";

describe("Google auth URL", () => {
  it("requests read-only scopes with offline access and the state", () => {
    const u = new URL(buildAuthUrl({ clientId: "cid", redirectUri: "http://localhost:3000/api/google/callback", state: "abc" }));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/gmail.readonly");
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("state")).toBe("abc");
    expect(u.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/google/callback");
  });
});

describe("Calendar events", () => {
  it("maps timed and all-day events and drops cancelled ones", () => {
    const timed = parseCalendarEvent({ id: "e1", summary: "Showing — 4823 SE Reedway", location: "Meet at property", start: { dateTime: "2026-09-02T10:30:00-07:00" }, end: { dateTime: "2026-09-02T11:15:00-07:00" } });
    expect(timed?.externalId).toBe("e1");
    expect(timed?.title).toBe("Showing — 4823 SE Reedway");
    expect(timed?.allDay).toBe(false);
    expect(timed?.startsAt).toBe("2026-09-02T17:30:00.000Z");
    const allDay = parseCalendarEvent({ id: "e2", start: { date: "2026-09-03" }, end: { date: "2026-09-04" } });
    expect(allDay?.allDay).toBe(true);
    expect(allDay?.title).toBe("(no title)");
    expect(parseCalendarEvent({ id: "e3", status: "cancelled", start: { dateTime: "2026-09-02T10:00:00Z" } })).toBeNull();
    expect(parseCalendarEvent({ summary: "no id" })).toBeNull();
  });
});

describe("Gmail messages", () => {
  it("keeps only metadata: sender, subject, snippet, flags — never a body", () => {
    const item = parseGmailMessage({ id: "m1", threadId: "t1", snippet: "Appraisal   ordered Friday, confirmation to follow.", labelIds: ["UNREAD", "IMPORTANT", "INBOX"], internalDate: "1756800000000", payload: { headers: [{ name: "From", value: "\"Lender Desk\" <desk@lender.example>" }, { name: "Subject", value: "Whitfield appraisal" }] } });
    expect(item).toMatchObject({ id: "m1", threadId: "t1", from: "Lender Desk", fromEmail: "desk@lender.example", subject: "Whitfield appraisal", unread: true, important: true });
    expect(item.snippet).toBe("Appraisal ordered Friday, confirmation to follow.");
    expect(item.receivedAt).toBe(new Date(1756800000000).toISOString());
    expect(Object.keys(item)).not.toContain("body");
  });
  it("handles bare addresses and missing headers", () => {
    const item = parseGmailMessage({ id: "m2", payload: { headers: [{ name: "From", value: "someone@example.com" }] } });
    expect(item.from).toBe("someone@example.com");
    expect(item.subject).toBe("(no subject)");
    expect(item.unread).toBe(false);
  });
});

describe("dayBounds", () => {
  it("spans exactly one local day", () => {
    const { timeMin, timeMax } = dayBounds(new Date("2026-09-02T15:00:00"));
    expect(new Date(timeMax).getTime() - new Date(timeMin).getTime()).toBe(24 * 3600 * 1000);
  });
});
