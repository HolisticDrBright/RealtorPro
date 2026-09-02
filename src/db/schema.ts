import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Relational model for the command center. One `contacts` row per person —
 * buyer and seller profiles hang off it, so nobody is entered twice.
 * Transactions feed income/YTD; listings feed pipeline; everything links back
 * to contacts and properties so timelines and search stay coherent.
 */

const id = () => text("id").primaryKey().$defaultFn(() => globalThis.crypto.randomUUID());
const createdAt = () => text("created_at").notNull().default(sql`(datetime('now'))`);
const updatedAt = () => text("updated_at").notNull().default(sql`(datetime('now'))`);
const json = <T>(name: string) => text(name, { mode: "json" }).$type<T>();

export const settings = sqliteTable("settings", {
  id: id(),
  agentName: text("agent_name").notNull().default("Vanessa Smith"),
  title: text("title").default("Luxury Real Estate Advisor"),
  brokerage: text("brokerage").default("Compass"),
  annualGoal: real("annual_goal").notNull().default(200000),
  defaultCommissionPct: real("default_commission_pct").notNull().default(2.5),
  defaultSplitPct: real("default_split_pct").notNull().default(68),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const CONTACT_TYPES = ["buyer", "seller", "past_client", "lead", "agent", "vendor", "sphere"] as const;
export const LEAD_SOURCES = ["referral", "past_client", "instagram", "open_house", "cold_outreach", "agent_referral", "website", "zillow", "off_market", "sphere", "other"] as const;
export const PIPELINE_STAGES = ["new_lead", "contacted", "qualified", "active_buyer", "active_seller", "showing_homes", "listing_appointment", "offer_submitted", "negotiating", "in_escrow", "closed", "nurture"] as const;

export const contacts = sqliteTable(
  "contacts",
  {
    id: id(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    photoUrl: text("photo_url"),
    phone: text("phone"),
    email: text("email"),
    spouse: text("spouse"),
    birthday: text("birthday"), // YYYY-MM-DD
    homeAddress: text("home_address"),
    type: text("type").notNull().default("lead"),
    leadSource: text("lead_source").default("other"),
    tags: json<string[]>("tags").default([]),
    priceMin: real("price_min"),
    priceMax: real("price_max"),
    preferredAreas: json<string[]>("preferred_areas").default([]),
    currentProperty: text("current_property"),
    // Pipeline
    stage: text("stage").notNull().default("new_lead"),
    stageOrder: integer("stage_order").notNull().default(0),
    estValue: real("est_value"),
    estCommission: real("est_commission"),
    probability: integer("probability").notNull().default(20), // %
    nextAction: text("next_action"),
    // Relationship cadence
    lastContactAt: text("last_contact_at"),
    nextFollowUpAt: text("next_follow_up_at"),
    checkBackAt: text("check_back_at"), // "check back in X months"
    notes: text("notes"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ stageIdx: index("contacts_stage_idx").on(t.stage), typeIdx: index("contacts_type_idx").on(t.type) }),
);

export const BUYER_TEMPS = ["hot", "warm", "nurture"] as const;
export const buyers = sqliteTable("buyers", {
  id: id(),
  contactId: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  temperature: text("temperature").notNull().default("warm"),
  priority: text("priority").notNull().default("medium"),
  priceMin: real("price_min"),
  priceMax: real("price_max"),
  targetAreas: json<string[]>("target_areas").default([]),
  minBeds: real("min_beds"),
  minBaths: real("min_baths"),
  minSqft: real("min_sqft"),
  lotRequirements: text("lot_requirements"),
  propertyType: text("property_type"),
  mustHaves: json<string[]>("must_haves").default([]),
  dealBreakers: json<string[]>("deal_breakers").default([]),
  financingType: text("financing_type"),
  preApprovalAmount: real("pre_approval_amount"),
  timeline: text("timeline"),
  propertiesSent: integer("properties_sent").notNull().default(0),
  propertiesToured: integer("properties_toured").notNull().default(0),
  offersMade: integer("offers_made").notNull().default(0),
  status: text("status").notNull().default("active"), // active | paused | closed
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const SELLER_STAGES = ["lead", "contacted", "appointment_scheduled", "preparing_home", "agreement_signed", "coming_soon", "active", "sold"] as const;
export const sellers = sqliteTable("sellers", {
  id: id(),
  contactId: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  propertyAddress: text("property_address"),
  city: text("city"),
  estimatedValue: real("estimated_value"),
  expectedListPrice: real("expected_list_price"),
  timeline: text("timeline"),
  motivation: text("motivation"),
  listingAppointmentAt: text("listing_appointment_at"),
  probability: integer("probability").notNull().default(30),
  stage: text("stage").notNull().default("lead"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const properties = sqliteTable("properties", {
  id: id(),
  address: text("address").notNull(),
  city: text("city").notNull().default(""),
  zip: text("zip"),
  beds: real("beds"),
  baths: real("baths"),
  sqft: real("sqft"),
  lotSqft: real("lot_sqft"),
  propertyType: text("property_type").default("Single Family"),
  yearBuilt: integer("year_built"),
  photoUrl: text("photo_url"),
  view: text("view"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const LISTING_STATUSES = ["coming_soon", "off_market", "active", "price_improvement", "offer_received", "in_negotiation", "in_escrow", "closed", "withdrawn"] as const;
export const listings = sqliteTable("listings", {
  id: id(),
  propertyId: text("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  sellerContactId: text("seller_contact_id").references(() => contacts.id),
  listPrice: real("list_price").notNull(),
  status: text("status").notNull().default("active"),
  listedAt: text("listed_at"),
  showings: integer("showings").notNull().default(0),
  offers: integer("offers").notNull().default(0),
  openHouses: integer("open_houses").notNull().default(0),
  commissionPct: real("commission_pct").notNull().default(2.5),
  nextAction: text("next_action"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const TX_STATUSES = ["escrow", "closed", "cancelled"] as const;
export const transactions = sqliteTable(
  "transactions",
  {
    id: id(),
    propertyId: text("property_id").notNull().references(() => properties.id),
    listingId: text("listing_id").references(() => listings.id),
    contactId: text("contact_id").references(() => contacts.id), // the client
    side: text("side").notNull().default("buyer"), // buyer | seller | both
    status: text("status").notNull().default("escrow"),
    purchasePrice: real("purchase_price").notNull(),
    commissionPct: real("commission_pct").notNull().default(2.5),
    referralFee: real("referral_fee").notNull().default(0),
    brokerSplitPct: real("broker_split_pct").notNull().default(68),
    expenses: real("expenses").notNull().default(0),
    leadSource: text("lead_source"),
    escrowOpenedAt: text("escrow_opened_at"),
    closingDate: text("closing_date"),
    closedAt: text("closed_at"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ statusIdx: index("tx_status_idx").on(t.status) }),
);

export const MILESTONES = ["Offer Accepted", "Deposit Due", "Inspection", "Inspection Contingency", "Appraisal", "Loan Contingency", "Seller Disclosures", "Repair Requests", "Final Walkthrough", "Contingency Removal", "Closing"] as const;
export const milestones = sqliteTable("milestones", {
  id: id(),
  transactionId: text("transaction_id").notNull().references(() => transactions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dueDate: text("due_date"),
  completedAt: text("completed_at"),
  sortOrder: integer("sort_order").notNull().default(0),
  notes: text("notes"),
});

export const OFFER_STATUSES = ["preparing", "submitted", "countered", "accepted", "rejected", "backup", "withdrawn"] as const;
export const offers = sqliteTable("offers", {
  id: id(),
  contactId: text("contact_id").references(() => contacts.id), // buyer
  propertyId: text("property_id").references(() => properties.id),
  listPrice: real("list_price"),
  offerPrice: real("offer_price").notNull(),
  submittedAt: text("submitted_at"),
  sellerCounter: real("seller_counter"),
  currentOffer: real("current_offer"),
  financing: text("financing"),
  downPayment: real("down_payment"),
  closingTimeline: text("closing_timeline"),
  contingencies: json<string[]>("contingencies").default([]),
  status: text("status").notNull().default("preparing"),
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const TASK_CATEGORIES = ["client_follow_up", "prospecting", "listing", "buyer", "escrow", "marketing", "administrative", "personal"] as const;
export const PRIORITIES = ["critical", "high", "medium", "low"] as const;
export const tasks = sqliteTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    category: text("category").notNull().default("client_follow_up"),
    priority: text("priority").notNull().default("medium"),
    dueDate: text("due_date"), // YYYY-MM-DD
    dueTime: text("due_time"), // HH:MM
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    propertyId: text("property_id").references(() => properties.id, { onDelete: "set null" }),
    transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    recurrence: text("recurrence").notNull().default("none"), // none | daily | weekly | monthly
    notes: text("notes"),
    sortOrder: integer("sort_order").notNull().default(0),
    completedAt: text("completed_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ dueIdx: index("tasks_due_idx").on(t.dueDate) }),
);

export const calls = sqliteTable("calls", {
  id: id(),
  contactId: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  scheduledDate: text("scheduled_date"), // YYYY-MM-DD
  scheduledTime: text("scheduled_time"),
  priority: text("priority").notNull().default("medium"),
  reason: text("reason"),
  notes: text("notes"),
  status: text("status").notNull().default("scheduled"), // scheduled | completed | rescheduled
  outcome: text("outcome"),
  completedAt: text("completed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const APPOINTMENT_TYPES = ["showing", "listing_appointment", "buyer_consultation", "open_house", "inspection", "appraisal", "final_walkthrough", "closing", "client_follow_up", "personal"] as const;
export const appointments = sqliteTable(
  "appointments",
  {
    id: id(),
    title: text("title").notNull(),
    type: text("type").notNull().default("showing"),
    startsAt: text("starts_at").notNull(), // ISO local
    endsAt: text("ends_at"),
    location: text("location"),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    propertyId: text("property_id").references(() => properties.id, { onDelete: "set null" }),
    transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ startIdx: index("appt_start_idx").on(t.startsAt) }),
);

export const notes = sqliteTable("notes", {
  id: id(),
  body: text("body").notNull(),
  contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  propertyId: text("property_id").references(() => properties.id, { onDelete: "set null" }),
  transactionId: text("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const ACTIVITY_TYPES = ["call", "text", "email", "showing", "meeting", "offer", "transaction", "note", "task", "system"] as const;
export const activities = sqliteTable(
  "activities",
  {
    id: id(),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("system"),
    summary: text("summary").notNull(),
    refType: text("ref_type"),
    refId: text("ref_id"),
    occurredAt: text("occurred_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ contactIdx: index("activities_contact_idx").on(t.contactId) }),
);

export const OPPORTUNITY_KINDS = ["off_market", "coming_soon", "pocket_listing", "tear_down", "investment"] as const;
export const opportunities = sqliteTable("opportunities", {
  id: id(),
  address: text("address").notNull(),
  area: text("area"),
  kind: text("kind").notNull().default("off_market"),
  expectedPrice: real("expected_price"),
  beds: real("beds"),
  baths: real("baths"),
  sqft: real("sqft"),
  propertyType: text("property_type"),
  sourceAgent: text("source_agent"),
  contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
  status: text("status").notNull().default("new"), // new | watching | pursuing | matched | dead
  notes: text("notes"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const TOUCH_KINDS = ["birthday", "anniversary", "gift", "holiday", "quarterly", "home_value", "referral_request"] as const;
export const touchpoints = sqliteTable("touchpoints", {
  id: id(),
  contactId: text("contact_id").notNull().references(() => contacts.id, { onDelete: "cascade" }),
  kind: text("kind").notNull().default("quarterly"),
  dueDate: text("due_date").notNull(),
  completedAt: text("completed_at"),
  notes: text("notes"),
  createdAt: createdAt(),
});

export const notifications = sqliteTable("notifications", {
  id: id(),
  title: text("title").notNull(),
  body: text("body"),
  kind: text("kind").notNull().default("info"),
  href: text("href"),
  readAt: text("read_at"),
  createdAt: createdAt(),
});

/** Indexed Obsidian vault notes (read in place; linked to contacts/properties explicitly). */
export const vaultNotes = sqliteTable(
  "vault_notes",
  {
    id: id(),
    path: text("path").notNull().unique(),
    title: text("title").notNull(),
    tags: json<string[]>("tags").default([]),
    links: json<string[]>("links").default([]),
    frontmatter: json<Record<string, unknown>>("frontmatter").default({}),
    excerpt: text("excerpt"),
    wordCount: integer("word_count").notNull().default(0),
    contactId: text("contact_id").references(() => contacts.id, { onDelete: "set null" }),
    propertyId: text("property_id").references(() => properties.id, { onDelete: "set null" }),
    linkBasis: text("link_basis"),
    recordType: text("record_type"), // frontmatter `type:` when it names an importable record
    sha256: text("sha256").notNull(),
    modifiedAt: text("modified_at"),
    indexedAt: text("indexed_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({ contactIdx: index("vault_contact_idx").on(t.contactId), propIdx: index("vault_property_idx").on(t.propertyId) }),
);
