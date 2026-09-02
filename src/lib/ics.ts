/**
 * Minimal iCalendar (.ics) VEVENT parser — pure and unit-tested.
 * Lets the work calendar import events exported from Gmail/Google Calendar or
 * Outlook without any OAuth connection. Only reads what is present.
 */
export interface IcsEvent {
  uid: string | null;
  title: string;
  startsAt: string; // ISO
  endsAt: string | null;
  location: string | null;
  description: string | null;
}

function unfold(text: string): string[] {
  // RFC 5545 line folding: a line starting with a space/tab continues the previous line.
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && out.length) out[out.length - 1] += raw.slice(1);
    else out.push(raw);
  }
  return out;
}

/** Convert an ICS date/time value to ISO. Handles 20260721T103000Z, 20260721T103000, 20260721. */
export function icsDateToIso(value: string): string | null {
  const v = value.trim();
  let m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (m) {
    const [, y, mo, d, h, mi, s, z] = m;
    return z ? `${y}-${mo}-${d}T${h}:${mi}:${s}Z` : new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)).toISOString();
  }
  m = v.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toISOString();
  return null;
}

export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  let cur: Partial<IcsEvent> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur && cur.title && cur.startsAt) {
        events.push({ uid: cur.uid ?? null, title: cur.title, startsAt: cur.startsAt, endsAt: cur.endsAt ?? null, location: cur.location ?? null, description: cur.description ?? null });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).split(";")[0].toUpperCase();
    const val = line.slice(idx + 1).replace(/\\,/g, ",").replace(/\\n/g, " ");
    if (key === "UID") cur.uid = val;
    else if (key === "SUMMARY") cur.title = val;
    else if (key === "LOCATION") cur.location = val;
    else if (key === "DESCRIPTION") cur.description = val;
    else if (key === "DTSTART") cur.startsAt = icsDateToIso(val) ?? undefined;
    else if (key === "DTEND") cur.endsAt = icsDateToIso(val) ?? undefined;
  }
  return events;
}
