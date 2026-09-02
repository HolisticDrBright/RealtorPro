import { daysSince, daysUntil } from "./dates";

/** "Needs follow-up" buckets. Pure. */
export interface FollowContact { id: string; type: string; stage: string; lastContactAt: string | null; nextFollowUpAt: string | null; checkBackAt: string | null; archived: boolean }
export interface FollowBuyer { contactId: string; temperature: string; timeline: string | null; status: string }

export type Bucket = "overdue" | "hot_no_contact" | "7d" | "14d" | "30d" | "timeline" | "check_back";
export interface FollowUpItem { contactId: string; bucket: Bucket; reason: string; days: number | null; urgency: number }

export function buildFollowUps(contacts: FollowContact[], buyersList: FollowBuyer[], now: Date): FollowUpItem[] {
  const out: FollowUpItem[] = [];
  const buyerBy = new Map(buyersList.filter((b) => b.status === "active").map((b) => [b.contactId, b]));
  for (const c of contacts) {
    if (c.archived || ["agent", "vendor"].includes(c.type) || c.stage === "closed") continue;
    const since = daysSince(c.lastContactAt, now);
    const b = buyerBy.get(c.id);
    if (c.nextFollowUpAt && daysUntil(c.nextFollowUpAt, now) < 0) out.push({ contactId: c.id, bucket: "overdue", reason: `Follow-up was due ${-daysUntil(c.nextFollowUpAt, now)}d ago`, days: -daysUntil(c.nextFollowUpAt, now), urgency: 100 + -daysUntil(c.nextFollowUpAt, now) });
    else if (b?.temperature === "hot" && (since == null || since >= 5)) out.push({ contactId: c.id, bucket: "hot_no_contact", reason: since == null ? "Hot buyer, never contacted" : `Hot buyer, ${since}d since contact`, days: since, urgency: 90 + (since ?? 30) });
    else if (c.checkBackAt && daysUntil(c.checkBackAt, now) <= 7) out.push({ contactId: c.id, bucket: "check_back", reason: `Asked to check back around ${c.checkBackAt}`, days: daysUntil(c.checkBackAt, now), urgency: 70 });
    else if (b?.timeline && /now|30|1-3|immediate|asap|month/i.test(b.timeline) && (since == null || since >= 7)) out.push({ contactId: c.id, bucket: "timeline", reason: `Buying timeline "${b.timeline}" and ${since == null ? "no" : `${since}d since`} contact`, days: since, urgency: 60 + (since ?? 30) });
    else if (since == null || since >= 30) out.push({ contactId: c.id, bucket: "30d", reason: since == null ? "Never contacted" : `${since} days since last contact`, days: since, urgency: 40 + Math.min(60, since ?? 60) });
    else if (since >= 14) out.push({ contactId: c.id, bucket: "14d", reason: `${since} days since last contact`, days: since, urgency: 30 + since });
    else if (since >= 7) out.push({ contactId: c.id, bucket: "7d", reason: `${since} days since last contact`, days: since, urgency: 20 + since });
  }
  return out.sort((a, b) => b.urgency - a.urgency);
}
