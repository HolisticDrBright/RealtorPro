import { daysSince, daysUntil, nextAnniversary } from "./dates";

/**
 * "Today's Priorities" — surfaces the most important actions from every part
 * of the business, ranked. Pure: takes plain rows, returns ranked items.
 */

export type Priority = "critical" | "high" | "medium" | "low";
export interface PriorityItem {
  id: string;
  kind: "task" | "call" | "buyer" | "listing" | "milestone" | "offer" | "appointment" | "lead" | "birthday" | "followup" | "vault";
  title: string;
  subtitle: string | null;
  priority: Priority;
  dueDate: string | null;
  dueTime: string | null;
  contactId: string | null;
  propertyId: string | null;
  transactionId: string | null;
  href: string;
  taskId: string | null; // when it is a real task (checkbox completes it)
  score: number;
}

export interface PriorityInput {
  now: Date;
  tasks: { id: string; title: string; priority: string; dueDate: string | null; dueTime: string | null; contactId: string | null; propertyId: string | null; transactionId: string | null; completedAt: string | null; sortOrder: number }[];
  calls: { id: string; contactId: string; scheduledDate: string | null; scheduledTime: string | null; priority: string; reason: string | null; status: string }[];
  buyers: { id: string; contactId: string; temperature: string; lastContactAt: string | null; timeline: string | null }[];
  listings: { id: string; propertyId: string; status: string; nextAction: string | null; showings: number; listedAt: string | null }[];
  milestones: { id: string; transactionId: string; name: string; dueDate: string | null; completedAt: string | null }[];
  offers: { id: string; contactId: string | null; propertyId: string | null; status: string; submittedAt: string | null }[];
  appointments: { id: string; title: string; type: string; startsAt: string; contactId: string | null; propertyId: string | null }[];
  contacts: { id: string; type: string; stage: string; lastContactAt: string | null; nextFollowUpAt: string | null; birthday: string | null; createdAt: string }[];
  names: (contactId: string | null) => string | null;
  addresses: (propertyId: string | null) => string | null;
  /** Open checkbox tasks from the Obsidian vault (today's daily note, #command-center notes). */
  vaultTasks?: { text: string; note: string; uri: string }[];
}

const P: Record<Priority, number> = { critical: 400, high: 300, medium: 200, low: 100 };
const asP = (s: string): Priority => (["critical", "high", "medium", "low"].includes(s) ? (s as Priority) : "medium");

export function buildPriorities(input: PriorityInput, limit = 14): PriorityItem[] {
  const { now, names, addresses } = input;
  const out: PriorityItem[] = [];
  const contactById = new Map(input.contacts.map((c) => [c.id, c]));

  // Tasks: overdue and due today.
  for (const t of input.tasks) {
    if (t.completedAt || !t.dueDate) continue;
    const d = daysUntil(t.dueDate, now);
    if (d > 0) continue;
    const pr = d < 0 && t.priority !== "critical" ? "high" : asP(t.priority);
    out.push({ id: `task-${t.id}`, kind: "task", title: t.title, subtitle: [names(t.contactId), addresses(t.propertyId)].filter(Boolean).join(" · ") || (d < 0 ? `Overdue ${-d}d` : null), priority: d < 0 ? (pr === "high" ? "critical" : pr) : pr, dueDate: t.dueDate, dueTime: t.dueTime, contactId: t.contactId, propertyId: t.propertyId, transactionId: t.transactionId, href: "/tasks", taskId: t.id, score: P[d < 0 ? "critical" : pr] + (d < 0 ? 50 - d : 0) - t.sortOrder });
  }

  // Milestones within 72 hours / overdue.
  for (const m of input.milestones) {
    if (m.completedAt || !m.dueDate) continue;
    const d = daysUntil(m.dueDate, now);
    if (d > 3) continue;
    out.push({ id: `ms-${m.id}`, kind: "milestone", title: `${m.name} ${d < 0 ? "overdue" : d === 0 ? "due today" : `due in ${d}d`}`, subtitle: null, priority: d <= 1 ? "critical" : "high", dueDate: m.dueDate, dueTime: null, contactId: null, propertyId: null, transactionId: m.transactionId, href: "/transactions", taskId: null, score: 480 - d * 10 });
  }

  // Calls scheduled today.
  for (const c of input.calls) {
    if (c.status !== "scheduled" || !c.scheduledDate) continue;
    const d = daysUntil(c.scheduledDate, now);
    if (d > 0) continue;
    out.push({ id: `call-${c.id}`, kind: "call", title: `Call ${names(c.contactId) ?? "contact"}${c.reason ? ` — ${c.reason}` : ""}`, subtitle: d < 0 ? `Missed ${-d}d ago` : null, priority: d < 0 ? "high" : asP(c.priority), dueDate: c.scheduledDate, dueTime: c.scheduledTime, contactId: c.contactId, propertyId: null, transactionId: null, href: "/calls", taskId: null, score: P[asP(c.priority)] - 20 + (d < 0 ? 40 : 0) });
  }

  // Hot buyers not contacted in 5+ days.
  for (const b of input.buyers) {
    if (b.temperature !== "hot") continue;
    const since = daysSince(b.lastContactAt, now);
    if (since != null && since < 5) continue;
    out.push({ id: `buyer-${b.id}`, kind: "buyer", title: `Touch base with ${names(b.contactId) ?? "hot buyer"}`, subtitle: since == null ? "Hot buyer · never contacted" : `Hot buyer · ${since} days since last contact`, priority: since == null || since >= 10 ? "critical" : "high", dueDate: null, dueTime: null, contactId: b.contactId, propertyId: null, transactionId: null, href: "/buyers", taskId: null, score: 320 + Math.min(80, since ?? 80) });
  }

  // Offers awaiting a response.
  for (const o of input.offers) {
    if (!["submitted", "countered"].includes(o.status)) continue;
    const since = daysSince(o.submittedAt, now) ?? 0;
    out.push({ id: `offer-${o.id}`, kind: "offer", title: `${o.status === "countered" ? "Respond to counter" : "Follow up on offer"} — ${addresses(o.propertyId) ?? "property"}`, subtitle: names(o.contactId), priority: o.status === "countered" ? "critical" : since >= 2 ? "high" : "medium", dueDate: null, dueTime: null, contactId: o.contactId, propertyId: o.propertyId, transactionId: null, href: "/offers", taskId: null, score: o.status === "countered" ? 420 : 280 + since * 5 });
  }

  // Listings needing attention.
  for (const l of input.listings) {
    if (!["active", "price_improvement", "offer_received", "in_negotiation", "coming_soon"].includes(l.status)) continue;
    const dom = l.listedAt ? daysSince(l.listedAt, now) ?? 0 : 0;
    const stale = l.status === "active" && dom >= 21 && l.showings < 3;
    if (l.status === "offer_received" || l.status === "in_negotiation") out.push({ id: `listing-${l.id}`, kind: "listing", title: `${l.status === "offer_received" ? "Review offer on" : "Negotiation in progress —"} ${addresses(l.propertyId)}`, subtitle: l.nextAction, priority: "high", dueDate: null, dueTime: null, contactId: null, propertyId: l.propertyId, transactionId: null, href: "/listings", taskId: null, score: 310 });
    else if (stale) out.push({ id: `listing-${l.id}`, kind: "listing", title: `Price/marketing review — ${addresses(l.propertyId)}`, subtitle: `${dom} days on market · ${l.showings} showings`, priority: "medium", dueDate: null, dueTime: null, contactId: null, propertyId: l.propertyId, transactionId: null, href: "/listings", taskId: null, score: 210 + dom });
  }

  // Today's listing appointments (prep).
  for (const a of input.appointments) {
    if (a.type !== "listing_appointment" || daysUntil(a.startsAt, now) !== 0) continue;
    out.push({ id: `appt-${a.id}`, kind: "appointment", title: `Prep: ${a.title}`, subtitle: [names(a.contactId), addresses(a.propertyId)].filter(Boolean).join(" · ") || null, priority: "high", dueDate: a.startsAt.slice(0, 10), dueTime: a.startsAt.slice(11, 16), contactId: a.contactId, propertyId: a.propertyId, transactionId: null, href: "/calendar", taskId: null, score: 305 });
  }

  // Uncontacted leads + overdue follow-ups + birthdays.
  for (const c of input.contacts) {
    if (c.type === "lead" && !c.lastContactAt) {
      const age = daysSince(c.createdAt, now) ?? 0;
      out.push({ id: `lead-${c.id}`, kind: "lead", title: `New lead not yet contacted — ${names(c.id)}`, subtitle: `Added ${age}d ago`, priority: age >= 2 ? "high" : "medium", dueDate: null, dueTime: null, contactId: c.id, propertyId: null, transactionId: null, href: `/contacts/${c.id}`, taskId: null, score: 260 + age * 10 });
    } else if (c.nextFollowUpAt && daysUntil(c.nextFollowUpAt, now) < 0 && !input.calls.some((k) => k.contactId === c.id && k.status === "scheduled")) {
      const od = -daysUntil(c.nextFollowUpAt, now);
      out.push({ id: `fu-${c.id}`, kind: "followup", title: `Follow-up overdue — ${names(c.id)}`, subtitle: `${od}d past due`, priority: od >= 7 ? "high" : "medium", dueDate: c.nextFollowUpAt, dueTime: null, contactId: c.id, propertyId: null, transactionId: null, href: `/contacts/${c.id}`, taskId: null, score: 230 + od * 3 });
    }
    if (c.birthday) {
      const d = daysUntil(nextAnniversary(c.birthday, now), now);
      if (d <= 1) out.push({ id: `bday-${c.id}`, kind: "birthday", title: `${names(c.id)}'s birthday ${d === 0 ? "is today" : "is tomorrow"}`, subtitle: "Send a note or a small gift", priority: "medium", dueDate: nextAnniversary(c.birthday, now), dueTime: null, contactId: c.id, propertyId: null, transactionId: null, href: `/contacts/${c.id}`, taskId: null, score: 240 });
    }
  }
  for (const [i, v] of (input.vaultTasks ?? []).entries()) {
    out.push({ id: `vault-${i}-${v.text.slice(0, 24)}`, kind: "vault", title: v.text, subtitle: `Obsidian · ${v.note}`, priority: "medium", dueDate: null, dueTime: null, contactId: null, propertyId: null, transactionId: null, href: v.uri, taskId: null, score: 405 - i });
  }
  void contactById;
  return out.sort((a, b) => b.score - a.score || (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99")).slice(0, limit);
}
