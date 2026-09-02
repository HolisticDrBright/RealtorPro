import { z } from "zod";
import * as s from "@/db/schema";

/**
 * Entity registry: one place that maps an API name to its table, validation
 * and searchable columns. The generic CRUD routes and the client forms both
 * read from this, so adding a field means editing the schema + one Zod line.
 */

const str = z.string().trim().max(2000).nullable().optional();
const num = z.union([z.number(), z.string().trim().length(0).transform(() => null), z.string().transform((v) => Number(v.replace(/[^0-9.\-]/g, "")))]).pipe(z.number().finite().nullable()).nullable().optional();
const int = z.union([z.number(), z.string().transform((v) => Number(v))]).pipe(z.number().int().finite()).optional();
const bool = z.union([z.boolean(), z.string().transform((v) => v === "true" || v === "1")]).optional();
const list = z.union([z.array(z.string()), z.string().transform((v) => v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean))]).optional();
const en = <T extends readonly [string, ...string[]]>(vals: T) => z.enum(vals).optional();

export const schemas = {
  settings: z.object({ agentName: z.string().min(1).optional(), title: str, brokerage: str, annualGoal: num, defaultCommissionPct: num, defaultSplitPct: num }),
  contacts: z.object({
    firstName: z.string().trim().min(1, "First name is required"), lastName: z.string().trim().optional().default(""), photoUrl: str, phone: str, email: z.string().trim().email().nullable().optional().or(z.literal("")), spouse: str, birthday: str, homeAddress: str,
    type: en(s.CONTACT_TYPES), leadSource: en(s.LEAD_SOURCES), tags: list, priceMin: num, priceMax: num, preferredAreas: list, currentProperty: str,
    stage: en(s.PIPELINE_STAGES), stageOrder: int, estValue: num, estCommission: num, probability: int, nextAction: str, lastContactAt: str, nextFollowUpAt: str, checkBackAt: str, notes: str, archived: bool,
  }),
  buyers: z.object({
    contactId: z.string().min(1), temperature: en(s.BUYER_TEMPS), priority: en(s.PRIORITIES), priceMin: num, priceMax: num, targetAreas: list, minBeds: num, minBaths: num, minSqft: num, lotRequirements: str, propertyType: str,
    mustHaves: list, dealBreakers: list, financingType: str, preApprovalAmount: num, timeline: str, propertiesSent: int, propertiesToured: int, offersMade: int, status: z.enum(["active", "paused", "closed"]).optional(), notes: str,
  }),
  sellers: z.object({ contactId: z.string().min(1), propertyAddress: str, city: str, estimatedValue: num, expectedListPrice: num, timeline: str, motivation: str, listingAppointmentAt: str, probability: int, stage: en(s.SELLER_STAGES), notes: str }),
  properties: z.object({ address: z.string().trim().min(1, "Address is required"), city: z.string().trim().optional().default(""), zip: str, beds: num, baths: num, sqft: num, lotSqft: num, propertyType: str, yearBuilt: int, photoUrl: str, view: str, notes: str }),
  listings: z.object({ propertyId: z.string().min(1, "Choose a property"), sellerContactId: str, listPrice: z.coerce.number().positive("List price is required"), status: en(s.LISTING_STATUSES), listedAt: str, showings: int, offers: int, openHouses: int, commissionPct: num, nextAction: str, notes: str }),
  transactions: z.object({
    propertyId: z.string().min(1, "Choose a property"), listingId: str, contactId: str, side: z.enum(["buyer", "seller", "both"]).optional(), status: en(s.TX_STATUSES), purchasePrice: z.coerce.number().positive("Purchase price is required"),
    commissionPct: num, referralFee: num, brokerSplitPct: num, expenses: num, leadSource: str, escrowOpenedAt: str, closingDate: str, closedAt: str, notes: str,
  }),
  milestones: z.object({ transactionId: z.string().min(1), name: z.string().min(1), dueDate: str, completedAt: str, sortOrder: int, notes: str }),
  offers: z.object({ contactId: str, propertyId: str, listPrice: num, offerPrice: z.coerce.number().positive("Offer price is required"), submittedAt: str, sellerCounter: num, currentOffer: num, financing: str, downPayment: num, closingTimeline: str, contingencies: list, status: en(s.OFFER_STATUSES), notes: str }),
  tasks: z.object({ title: z.string().trim().min(1, "Title is required"), category: en(s.TASK_CATEGORIES), priority: en(s.PRIORITIES), dueDate: str, dueTime: str, contactId: str, propertyId: str, transactionId: str, recurrence: z.enum(["none", "daily", "weekly", "monthly"]).optional(), notes: str, sortOrder: int, completedAt: str }),
  calls: z.object({ contactId: z.string().min(1, "Choose a contact"), scheduledDate: str, scheduledTime: str, priority: en(s.PRIORITIES), reason: str, notes: str, status: z.enum(["scheduled", "completed", "rescheduled"]).optional(), outcome: str, completedAt: str }),
  appointments: z.object({ title: z.string().trim().min(1, "Title is required"), type: en(s.APPOINTMENT_TYPES), startsAt: z.string().min(10, "Start time is required"), endsAt: str, location: str, contactId: str, propertyId: str, transactionId: str, notes: str }),
  notes: z.object({ body: z.string().trim().min(1, "Write something first"), contactId: str, propertyId: str, transactionId: str, pinned: bool }),
  activities: z.object({ contactId: str, type: en(s.ACTIVITY_TYPES), summary: z.string().min(1), refType: str, refId: str, occurredAt: str }),
  opportunities: z.object({ address: z.string().trim().min(1, "Address is required"), area: str, kind: en(s.OPPORTUNITY_KINDS), expectedPrice: num, beds: num, baths: num, sqft: num, propertyType: str, sourceAgent: str, contactId: str, status: z.enum(["new", "watching", "pursuing", "matched", "dead"]).optional(), notes: str }),
  touchpoints: z.object({ contactId: z.string().min(1), kind: en(s.TOUCH_KINDS), dueDate: z.string().min(10), completedAt: str, notes: str }),
  notifications: z.object({ title: z.string().min(1), body: str, kind: str, href: str, readAt: str }),
};

export type EntityName = keyof typeof schemas;
export const ENTITY_NAMES = Object.keys(schemas) as EntityName[];

export const tables = {
  settings: s.settings, contacts: s.contacts, buyers: s.buyers, sellers: s.sellers, properties: s.properties, listings: s.listings, transactions: s.transactions, milestones: s.milestones,
  offers: s.offers, tasks: s.tasks, calls: s.calls, appointments: s.appointments, notes: s.notes, activities: s.activities, opportunities: s.opportunities, touchpoints: s.touchpoints, notifications: s.notifications,
} as const;

/** Columns searched by `?q=` on list endpoints. */
export const searchable: Record<EntityName, string[]> = {
  settings: [], contacts: ["firstName", "lastName", "phone", "email", "notes", "homeAddress", "spouse"], buyers: ["notes", "timeline"], sellers: ["propertyAddress", "city", "notes", "motivation"], properties: ["address", "city", "zip", "notes"],
  listings: ["nextAction", "notes"], transactions: ["notes"], milestones: ["name"], offers: ["notes", "financing"], tasks: ["title", "notes"], calls: ["reason", "notes", "outcome"], appointments: ["title", "location", "notes"], notes: ["body"],
  activities: ["summary"], opportunities: ["address", "area", "sourceAgent", "notes"], touchpoints: ["notes"], notifications: ["title", "body"],
};

export const defaultSort: Record<EntityName, { column: string; dir: "asc" | "desc" }> = {
  settings: { column: "createdAt", dir: "asc" }, contacts: { column: "lastName", dir: "asc" }, buyers: { column: "createdAt", dir: "desc" }, sellers: { column: "createdAt", dir: "desc" }, properties: { column: "address", dir: "asc" },
  listings: { column: "createdAt", dir: "desc" }, transactions: { column: "closingDate", dir: "desc" }, milestones: { column: "sortOrder", dir: "asc" }, offers: { column: "createdAt", dir: "desc" }, tasks: { column: "dueDate", dir: "asc" },
  calls: { column: "scheduledTime", dir: "asc" }, appointments: { column: "startsAt", dir: "asc" }, notes: { column: "createdAt", dir: "desc" }, activities: { column: "occurredAt", dir: "desc" }, opportunities: { column: "createdAt", dir: "desc" },
  touchpoints: { column: "dueDate", dir: "asc" }, notifications: { column: "createdAt", dir: "desc" },
};
