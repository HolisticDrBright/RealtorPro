import { sql } from "drizzle-orm";
import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";

// Use the global Web Crypto UUID (Node 18+/browser) rather than importing from
// "node:crypto", which keeps this schema module free of Node-only imports so it
// loads cleanly under drizzle-kit's TS loader.
const randomUUID = () => globalThis.crypto.randomUUID();

/**
 * AgentOS database schema (SQLite via Drizzle ORM).
 *
 * Design notes
 * ------------
 * - IDs are text UUIDs, defaulted in the app layer.
 * - Timestamps are ISO-8601 strings (human readable, sorts lexicographically).
 * - Flexible lists/objects are stored as JSON text columns (`json()` helper).
 * - The Fact table is an APPEND-ONLY ledger: rows are never mutated. A corrected
 *   fact is a new row that supersedes an earlier one; conflicts are recorded,
 *   never silently resolved. AgentOS never infers a missing listing fact.
 * - Source documents and original assets are immutable: preserved permanently
 *   unless the user explicitly deletes them.
 */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

const createdAt = () =>
  text("created_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

const updatedAt = () =>
  text("updated_at")
    .notNull()
    .$defaultFn(() => new Date().toISOString());

/** Typed JSON column helper. */
function json<T>(name: string) {
  return text(name, { mode: "json" }).$type<T>();
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity & policy
// ─────────────────────────────────────────────────────────────────────────────

export const userProfiles = sqliteTable("user_profiles", {
  id: id(),
  name: text("name").notNull(),
  email: text("email"),
  license: text("license"),
  serviceAreas: json<string[]>("service_areas").default([]),
  defaultBrandVoice: text("default_brand_voice").default("Warm, concrete, no hype"),
  quietHours: text("quiet_hours").default("9:00 PM – 7:00 AM"),
  nurtureCadence: text("nurture_cadence").default("Quarterly + anniversaries"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const brokeragePolicies = sqliteTable("brokerage_policies", {
  id: id(),
  userProfileId: text("user_profile_id").references(() => userProfiles.id),
  name: text("name").notNull(),
  // Guardrails, stored as flags so services can enforce them uniformly.
  fairHousingEnforced: integer("fair_housing_enforced", { mode: "boolean" }).notNull().default(true),
  allowRemoteGeneration: integer("allow_remote_generation", { mode: "boolean" }).notNull().default(false),
  requireDisclosureForAlteredMedia: integer("require_disclosure_for_altered_media", { mode: "boolean" }).notNull().default(true),
  maxJobsPerHour: integer("max_jobs_per_hour").notNull().default(20),
  maxJobCostUsd: real("max_job_cost_usd").notNull().default(25),
  dailySpendCapUsd: real("daily_spend_cap_usd").notNull().default(100),
  createdAt: createdAt(),
});

// ─────────────────────────────────────────────────────────────────────────────
// CRM entities (mirror of Follow Up Boss — FUB stays the system of record)
// ─────────────────────────────────────────────────────────────────────────────

export const contacts = sqliteTable(
  "contacts",
  {
    id: id(),
    // Link to the FUB record. Contacts are NEVER matched by name alone.
    fubId: text("fub_id"),
    name: text("name").notNull(),
    role: text("role"), // Buyer | Seller | Past client | ...
    stage: text("stage"),
    nextStep: text("next_step"),
    phone: text("phone"),
    email: text("email"),
    syncStatus: text("sync_status").default("Synced"),
    // hot | warm | cold — agent-set relationship temperature for the dashboard.
    temperature: text("temperature").default("warm"),
    // Mirrored from Follow Up Boss on sync.
    tags: json<string[]>("tags").default([]),
    source: text("source"),
    assignedTo: text("assigned_to"),
    lastActivityAt: text("last_activity_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ fubIdx: index("contacts_fub_idx").on(t.fubId) }),
);

export const deals = sqliteTable("deals", {
  id: id(),
  fubId: text("fub_id"),
  contactId: text("contact_id").references(() => contacts.id),
  propertyId: text("property_id"),
  name: text("name").notNull(),
  stage: text("stage"),
  price: text("price"),
  riskFlag: text("risk_flag"), // high | med | null
  riskIssue: text("risk_issue"),
  // Mirrored from FUB deals.
  dealStatus: text("deal_status"), // Active | Won | Lost | ...
  pipeline: text("pipeline"),
  closeDate: text("close_date"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const tasks = sqliteTable("tasks", {
  id: id(),
  fubId: text("fub_id"),
  contactId: text("contact_id").references(() => contacts.id),
  dealId: text("deal_id").references(() => deals.id),
  title: text("title").notNull(),
  body: text("body"),
  dueAt: text("due_at"),
  status: text("status").notNull().default("open"), // open | done
  // Where the task lives: local until explicitly pushed to FUB.
  origin: text("origin").notNull().default("local"), // local | fub
  syncedToFub: integer("synced_to_fub", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const notes = sqliteTable("notes", {
  id: id(),
  fubId: text("fub_id"),
  contactId: text("contact_id").references(() => contacts.id),
  subject: text("subject"),
  body: text("body").notNull(),
  // Notes AgentOS writes back are ALWAYS drafts until the agent sends in FUB.
  isDraft: integer("is_draft", { mode: "boolean" }).notNull().default(true),
  origin: text("origin").notNull().default("local"),
  syncedToFub: integer("synced_to_fub", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const appointments = sqliteTable("appointments", {
  id: id(),
  fubId: text("fub_id"),
  contactId: text("contact_id").references(() => contacts.id),
  title: text("title").notNull(),
  who: text("who"),
  location: text("location"),
  type: text("type"),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  description: text("description"),
  createdAt: createdAt(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Listings, imports, source documents, assets
// ─────────────────────────────────────────────────────────────────────────────

export const properties = sqliteTable("properties", {
  id: id(),
  address: text("address").notNull(),
  mlsNumber: text("mls_number"),
  price: text("price"),
  beds: real("beds"),
  baths: real("baths"),
  sqft: text("sqft"),
  lot: text("lot"),
  propertyType: text("property_type"),
  features: json<string[]>("features").default([]),
  remarks: text("remarks"),
  openHouse: text("open_house"),
  status: text("status"),
  sourceMeta: json<Record<string, unknown>>("source_meta").default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * Immutable record of an uploaded source file (MLS CSV, PDF flyer, pasted
 * alert-email text, seller disclosure). Content is hashed and preserved on disk.
 */
export const sourceDocuments = sqliteTable("source_documents", {
  id: id(),
  kind: text("kind").notNull(), // mls_csv | pdf | email_text | disclosure
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sha256: text("sha256").notNull(),
  byteSize: integer("byte_size").notNull(),
  storedPath: text("stored_path").notNull(),
  meta: json<Record<string, unknown>>("meta").default({}),
  createdAt: createdAt(),
});

/** Reusable, detectable CSV column mappings. */
export const columnMappings = sqliteTable("column_mappings", {
  id: id(),
  name: text("name").notNull(),
  sourceType: text("source_type").notNull().default("mls_csv"),
  // Map of canonical field -> source header.
  mapping: json<Record<string, string>>("mapping").notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const listingImports = sqliteTable("listing_imports", {
  id: id(),
  sourceDocumentId: text("source_document_id").references(() => sourceDocuments.id),
  columnMappingId: text("column_mapping_id").references(() => columnMappings.id),
  propertyId: text("property_id").references(() => properties.id),
  rowCount: integer("row_count").notNull().default(0),
  validRows: integer("valid_rows").notNull().default(0),
  status: text("status").notNull().default("parsed"), // parsed | invalid | partial
  issues: json<string[]>("issues").default([]),
  createdAt: createdAt(),
});

/**
 * Original media (image / floor plan / video). Preserved permanently unless the
 * user explicitly deletes it. Alterations are NEW assets linked to the original.
 */
export const assets = sqliteTable("assets", {
  id: id(),
  propertyId: text("property_id").references(() => properties.id),
  kind: text("kind").notNull(), // image | floorplan | video
  label: text("label"),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sha256: text("sha256").notNull(),
  byteSize: integer("byte_size").notNull(),
  storedPath: text("stored_path").notNull(),
  rightsConfirmed: integer("rights_confirmed", { mode: "boolean" }).notNull().default(false),
  // "original" | "altered". Altered assets reference the original they derive from.
  alterationStatus: text("alteration_status").notNull().default("original"),
  originalAssetId: text("original_asset_id"),
  alterationDescription: text("alteration_description"),
  createdAt: createdAt(),
});

/** AI-altered-media disclosure record, linked to the original asset. */
export const mediaDisclosures = sqliteTable("media_disclosures", {
  id: id(),
  assetId: text("asset_id").references(() => assets.id),
  originalAssetId: text("original_asset_id").references(() => assets.id),
  alteration: text("alteration").notNull(),
  disclosureText: text("disclosure_text").notNull(),
  status: text("status").notNull().default("pending"), // pending | approved
  createdAt: createdAt(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Fact ledger, generated claims, drafts, approvals, exports
// ─────────────────────────────────────────────────────────────────────────────

/**
 * APPEND-ONLY fact ledger. Every listing fact ever asserted, with its source.
 * Never updated in place. `conflictsWith` records a disagreement with an earlier
 * fact rather than overwriting it. `supersedesId` marks an explicit correction.
 */
export const facts = sqliteTable(
  "facts",
  {
    id: id(),
    propertyId: text("property_id").references(() => properties.id),
    listingImportId: text("listing_import_id").references(() => listingImports.id),
    sourceDocumentId: text("source_document_id").references(() => sourceDocuments.id),
    field: text("field").notNull(),
    value: text("value"),
    source: text("source").notNull(), // human-readable provenance, e.g. "CSV: ListPrice"
    confidence: text("confidence").notNull().default("reported"), // reported | verified | conflicting | missing
    conflictsWith: text("conflicts_with"),
    supersedesId: text("supersedes_id"),
    createdAt: createdAt(),
  },
  (t) => ({ propIdx: index("facts_prop_idx").on(t.propertyId) }),
);

export const drafts = sqliteTable("drafts", {
  id: id(),
  kind: text("kind").notNull(), // mls_description | social_plan | flyer | video | email | note
  propertyId: text("property_id").references(() => properties.id),
  contactId: text("contact_id").references(() => contacts.id),
  jobId: text("job_id"),
  title: text("title"),
  content: json<unknown>("content"),
  status: text("status").notNull().default("draft"), // draft | approved
  provider: text("provider"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** A single generated claim/sentence, each traceable to the facts it cites. */
export const generatedClaims = sqliteTable("generated_claims", {
  id: id(),
  draftId: text("draft_id").references(() => drafts.id),
  text: text("text").notNull(),
  sources: json<string[]>("sources").default([]),
  factIds: json<string[]>("fact_ids").default([]),
  createdAt: createdAt(),
});

/** Approval-gate record: nothing is "approved" without one of these. */
export const approvals = sqliteTable("approvals", {
  id: id(),
  targetType: text("target_type").notNull(), // draft | section | disclosure | remote_generation | shortlist
  targetId: text("target_id").notNull(),
  label: text("label"),
  approvedBy: text("approved_by").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

export const exports = sqliteTable("exports", {
  id: id(),
  kind: text("kind").notNull(), // full_backup | listing | disclosure_log
  filename: text("filename").notNull(),
  storedPath: text("stored_path").notNull(),
  sha256: text("sha256"),
  byteSize: integer("byte_size"),
  createdAt: createdAt(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Buyer Scout
// ─────────────────────────────────────────────────────────────────────────────

export interface WeightedPreference {
  label: string;
  weight: number;
  /** Optional canonical fact field this preference maps to, for scoring. */
  field?: string;
}

export const buyerCriteriaProfiles = sqliteTable("buyer_criteria_profiles", {
  id: id(),
  contactId: text("contact_id").references(() => contacts.id),
  label: text("label"),
  ceilingText: text("ceiling_text"),
  ceilingAmount: integer("ceiling_amount"),
  ceilingHard: integer("ceiling_hard", { mode: "boolean" }).notNull().default(true),
  hardConstraints: json<string[]>("hard_constraints").default([]),
  weightedPrefs: json<WeightedPreference[]>("weighted_prefs").default([]),
  areas: json<string[]>("areas").default([]),
  mustHaves: json<string[]>("must_haves").default([]),
  agreedAt: text("agreed_at"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const buyerMatches = sqliteTable("buyer_matches", {
  id: id(),
  criteriaProfileId: text("criteria_profile_id").references(() => buyerCriteriaProfiles.id),
  propertyId: text("property_id").references(() => properties.id),
  listingImportId: text("listing_import_id").references(() => listingImports.id),
  address: text("address"),
  score: integer("score").notNull().default(0),
  overCeiling: integer("over_ceiling", { mode: "boolean" }).notNull().default(false),
  reasons: json<{ text: string; source: string }[]>("reasons").default([]),
  tradeoffs: json<string[]>("tradeoffs").default([]),
  missingFacts: json<string[]>("missing_facts").default([]),
  verifyQuestions: json<string[]>("verify_questions").default([]),
  createdAt: createdAt(),
});

export const shortlists = sqliteTable("shortlists", {
  id: id(),
  criteriaProfileId: text("criteria_profile_id").references(() => buyerCriteriaProfiles.id),
  name: text("name").notNull().default("Shortlist"),
  createdAt: createdAt(),
});

export const shortlistItems = sqliteTable("shortlist_items", {
  id: id(),
  shortlistId: text("shortlist_id").references(() => shortlists.id),
  matchId: text("match_id").references(() => buyerMatches.id),
  propertyId: text("property_id").references(() => properties.id),
  createdAt: createdAt(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Generation job queue (provider-neutral)
// ─────────────────────────────────────────────────────────────────────────────

export const generationJobs = sqliteTable("generation_jobs", {
  id: id(),
  propertyId: text("property_id").references(() => properties.id),
  type: text("type").notNull(), // campaign | mls_description | image | video
  status: text("status").notNull().default("draft"), // draft|queued|running|review|approved|failed|canceled
  provider: text("provider").notNull().default("mock"),
  model: text("model"),
  promptVersion: text("prompt_version"),
  inputs: json<Record<string, unknown>>("inputs").default({}),
  outputs: json<Record<string, unknown>>("outputs").default({}),
  costEstimateUsd: real("cost_estimate_usd").default(0),
  isRemote: integer("is_remote", { mode: "boolean" }).notNull().default(false),
  approvedForRemote: integer("approved_for_remote", { mode: "boolean" }).notNull().default(false),
  error: text("error"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Providers, sync, audit
// ─────────────────────────────────────────────────────────────────────────────

export const providerConnections = sqliteTable("provider_connections", {
  id: id(),
  provider: text("provider").notNull(), // fub | llm | media
  status: text("status").notNull().default("disconnected"), // connected | sync-error | disconnected
  // We store a reference/hint, NEVER the raw key (keys live in env/local secrets).
  keyRef: text("key_ref"),
  scopes: json<string[]>("scopes").default([]),
  lastSyncAt: text("last_sync_at"),
  meta: json<Record<string, unknown>>("meta").default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const syncEvents = sqliteTable("sync_events", {
  id: id(),
  provider: text("provider").notNull().default("fub"),
  direction: text("direction").notNull(), // pull | push
  entity: text("entity"), // contacts | tasks | notes | deals | appointments
  itemCount: integer("item_count").notNull().default(0),
  status: text("status").notNull().default("OK"), // OK | error
  detail: text("detail"),
  createdAt: createdAt(),
});

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: id(),
    action: text("action").notNull(),
    actor: text("actor").notNull().default("agent"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    metadata: json<Record<string, unknown>>("metadata").default({}),
    createdAt: createdAt(),
  },
  (t) => ({ actionIdx: index("audit_action_idx").on(t.action) }),
);

// Convenience: current-timestamp SQL for any raw queries that need it.
export const now = sql`(datetime('now'))`;
