import {
  sqliteTable,
  text,
  integer,
  real,
  index,
} from "drizzle-orm/sqlite-core";

/**
 * Schema for the extended modules:
 *   - OM Quality Gate (offering memorandums + three-lens review)
 *   - Development Visualizer (concept visualization workflow)
 *   - Rent Roll Studio
 *   - Comp Lab
 *   - Signal Scout
 *
 * These build on the base schema (`schema.ts`) and reuse `sourceDocuments`,
 * `facts`, `assets`, `contacts`, `properties`, `deals`, `columnMappings`, and
 * `auditLogs` from there. The same conventions apply: text UUID ids, ISO-8601
 * timestamps, JSON text columns, append-only ledgers, and no invented facts.
 */

const randomUUID = () => globalThis.crypto.randomUUID();
const id = () => text("id").primaryKey().$defaultFn(() => randomUUID());
const createdAt = () => text("created_at").notNull().$defaultFn(() => new Date().toISOString());
const updatedAt = () => text("updated_at").notNull().$defaultFn(() => new Date().toISOString());
function json<T>(name: string) {
  return text(name, { mode: "json" }).$type<T>();
}

// ═════════════════════════════════════════════════════════════════════════════
// OM Quality Gate
// ═════════════════════════════════════════════════════════════════════════════

export const brandProfiles = sqliteTable("brand_profiles", {
  id: id(),
  name: text("name").notNull(),
  broker: text("broker"),
  contact: text("contact"),
  disclaimer: text("disclaimer"),
  colors: json<string[]>("colors").default([]),
  typography: text("typography").default("Archivo"),
  logoAssetId: text("logo_asset_id"),
  ownedByUser: integer("owned_by_user", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const templateProfiles = sqliteTable("template_profiles", {
  id: id(),
  name: text("name").notNull(),
  family: text("family"), // institutional | luxury | multifamily | retail_office | development
  description: text("description"),
  // Original templates a user builds from their own assets, or ones they own/license.
  isOriginal: integer("is_original", { mode: "boolean" }).notNull().default(true),
  config: json<Record<string, unknown>>("config").default({}),
  createdAt: createdAt(),
});

export const templateRightsConfirmations = sqliteTable("template_rights_confirmations", {
  id: id(),
  templateProfileId: text("template_profile_id").references(() => templateProfiles.id),
  confirmedBy: text("confirmed_by").notNull(),
  // How the user is entitled to use the template.
  ownershipBasis: text("ownership_basis").notNull(), // owned | licensed | original
  note: text("note"),
  confirmedAt: createdAt(),
});

export const omDrafts = sqliteTable(
  "om_drafts",
  {
    id: id(),
    propertyId: text("property_id"),
    name: text("name").notNull(),
    address: text("address"),
    market: text("market"),
    assetType: text("asset_type"),
    price: text("price"),
    brandProfileId: text("brand_profile_id").references(() => brandProfiles.id),
    templateProfileId: text("template_profile_id").references(() => templateProfiles.id),
    // Draft | Needs Review | Ready for Broker Review | Approved | Exported
    approvalState: text("approval_state").notNull().default("Draft"),
    ownerName: text("owner_name").default("Avery Sandoval"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ propIdx: index("om_drafts_prop_idx").on(t.propertyId) }),
);

export const omSections = sqliteTable("om_sections", {
  id: id(),
  omDraftId: text("om_draft_id").references(() => omDrafts.id),
  key: text("key").notNull(), // cover | exec | highlights | ... | contact
  title: text("title").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  pageStyle: text("page_style").notNull().default("editorial"), // editorial | compact | photo
  // Editable content blocks (paragraphs, tables, KPI grids) as structured JSON.
  contentBlocks: json<unknown>("content_blocks").default([]),
  needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/**
 * A derived (calculated) value. Stores the FORMULA and the source fact ids it
 * was computed from. `status` distinguishes Imported / Calculated / Pending
 * review / TBD; a pending/TBD metric renders no number (never a fake value).
 */
export const derivedMetrics = sqliteTable("derived_metrics", {
  id: id(),
  subjectType: text("subject_type").notNull(), // om | rent_roll | comp_set | property
  subjectId: text("subject_id").notNull(),
  metric: text("metric").notNull(), // occupancy | noi | cap_rate | price_per_unit | price_per_sf | ...
  value: real("value"),
  displayValue: text("display_value"),
  unit: text("unit"),
  formula: text("formula"),
  sourceFactIds: json<string[]>("source_fact_ids").default([]),
  status: text("status").notNull().default("pending"), // imported | calculated | pending | tbd
  createdAt: createdAt(),
});

export const verificationRuns = sqliteTable("verification_runs", {
  id: id(),
  omDraftId: text("om_draft_id").references(() => omDrafts.id),
  lens: text("lens").notNull().default("all"), // source | design | export | all
  status: text("status").notNull().default("complete"), // running | complete
  summary: json<Record<string, unknown>>("summary").default({}),
  createdAt: createdAt(),
});

export const verificationFindings = sqliteTable(
  "verification_findings",
  {
    id: id(),
    verificationRunId: text("verification_run_id").references(() => verificationRuns.id),
    omDraftId: text("om_draft_id").references(() => omDrafts.id),
    lens: text("lens").notNull(), // source | design | export
    severity: text("severity").notNull(), // critical | high | medium | low | info
    pageKey: text("page_key"),
    code: text("code").notNull(),
    message: text("message").notNull(),
    repairAction: text("repair_action"),
    autoFixable: integer("auto_fixable", { mode: "boolean" }).notNull().default(false),
    status: text("status").notNull().default("open"), // open | resolved
    createdAt: createdAt(),
  },
  (t) => ({ runIdx: index("findings_run_idx").on(t.verificationRunId) }),
);

export const disclosures = sqliteTable("disclosures", {
  id: id(),
  subjectType: text("subject_type").notNull(), // om | visualization | rent_roll | comp_set
  subjectId: text("subject_id").notNull(),
  kind: text("kind").notNull(), // visualization | construction | boundary | om_legal | market_attribution
  text: text("text").notNull(),
  mode: text("mode").notNull().default("brokerage"), // brokerage | enhanced | custom
  editable: integer("editable", { mode: "boolean" }).notNull().default(true),
  required: integer("required", { mode: "boolean" }).notNull().default(true),
  status: text("status").notNull().default("pending"), // pending | approved
  createdAt: createdAt(),
});

export const exportRecords = sqliteTable("export_records", {
  id: id(),
  subjectType: text("subject_type").notNull(), // om | rent_roll | comp_set | visualization
  subjectId: text("subject_id").notNull(),
  format: text("format").notNull(), // pptx | xlsx | pdf
  storedPath: text("stored_path").notNull(),
  sha256: text("sha256"),
  byteSize: integer("byte_size"),
  brandProfileId: text("brand_profile_id"),
  editableText: integer("editable_text", { mode: "boolean" }).default(true),
  metadata: json<Record<string, unknown>>("metadata").default({}),
  createdAt: createdAt(),
});

// ═════════════════════════════════════════════════════════════════════════════
// Development Visualizer
// ═════════════════════════════════════════════════════════════════════════════

export const visualizerProjects = sqliteTable("visualizer_projects", {
  id: id(),
  propertyId: text("property_id"),
  name: text("name").notNull(),
  address: text("address"),
  // site_boundary | land_teaser | massing | future_use | construction_sequence | aerial_reel
  visualizationType: text("visualization_type").notNull().default("land_teaser"),
  status: text("status").notNull().default("draft"), // draft | sources | direction | storyboard | queued | review | approved
  ownerName: text("owner_name").default("Avery Sandoval"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const visualizerSources = sqliteTable("visualizer_sources", {
  id: id(),
  projectId: text("project_id").references(() => visualizerProjects.id),
  sourceDocumentId: text("source_document_id"),
  assetId: text("asset_id"),
  kind: text("kind").notNull(), // aerial | site_plan | survey | map | geojson | photo
  label: text("label"),
  rightsConfirmed: integer("rights_confirmed", { mode: "boolean" }).notNull().default(false),
  // A verified boundary source unlocks the glowing boundary overlay.
  boundaryVerified: integer("boundary_verified", { mode: "boolean" }).notNull().default(false),
  boundaryBasis: text("boundary_basis").default("none"), // survey | site_plan | geojson | manual | none
  createdAt: createdAt(),
});

export const storyboards = sqliteTable("storyboards", {
  id: id(),
  projectId: text("project_id").references(() => visualizerProjects.id),
  format: text("format").notNull().default("16:9"), // 9:16 | 16:9 | square
  durationSec: integer("duration_sec").notNull().default(15), // 10 | 15 | 30 | 45
  visualDirection: text("visual_direction").default("architectural editorial"),
  cameraMovement: text("camera_movement").default("slow push-in"),
  boundaryStyle: text("boundary_style").notNull().default("none"), // none | subtle | glow
  textOverlays: json<Record<string, string>>("text_overlays").default({}),
  disclosureMode: text("disclosure_mode").notNull().default("brokerage"), // brokerage | enhanced | custom
  budgetCapUsd: real("budget_cap_usd").notNull().default(50),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const storyboardScenes = sqliteTable("storyboard_scenes", {
  id: id(),
  storyboardId: text("storyboard_id").references(() => storyboards.id),
  orderIndex: integer("order_index").notNull().default(0),
  beat: text("beat").notNull(),
  cameraMovement: text("camera_movement"),
  durationSec: integer("duration_sec").default(3),
  note: text("note"),
  createdAt: createdAt(),
});

export const visualizationJobs = sqliteTable("visualization_jobs", {
  id: id(),
  projectId: text("project_id").references(() => visualizerProjects.id),
  storyboardId: text("storyboard_id").references(() => storyboards.id),
  type: text("type").notNull(), // image | video | overlay
  status: text("status").notNull().default("draft"), // draft|queued|running|review|approved|failed|canceled
  provider: text("provider").notNull().default("mock"),
  model: text("model"),
  inputs: json<Record<string, unknown>>("inputs").default({}),
  outputs: json<Record<string, unknown>>("outputs").default({}),
  costEstimateUsd: real("cost_estimate_usd").default(0),
  isRemote: integer("is_remote", { mode: "boolean" }).notNull().default(false),
  approvedForRemote: integer("approved_for_remote", { mode: "boolean" }).notNull().default(false),
  boundaryAllowed: integer("boundary_allowed", { mode: "boolean" }).notNull().default(false),
  disclosureId: text("disclosure_id"),
  error: text("error"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ═════════════════════════════════════════════════════════════════════════════
// Rent Roll Studio
// ═════════════════════════════════════════════════════════════════════════════

export const rentRolls = sqliteTable("rent_rolls", {
  id: id(),
  propertyId: text("property_id"),
  sourceDocumentId: text("source_document_id"),
  mappingProfileId: text("mapping_profile_id"),
  name: text("name").notNull(),
  status: text("status").notNull().default("uploaded"), // uploaded | mapped | validated | analyzed | approved
  unitCount: integer("unit_count").default(0),
  note: text("note"),
  localOnly: integer("local_only", { mode: "boolean" }).notNull().default(true),
  redactPii: integer("redact_pii", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const rentRollUnits = sqliteTable("rent_roll_units", {
  id: id(),
  rentRollId: text("rent_roll_id").references(() => rentRolls.id),
  unit: text("unit"),
  tenant: text("tenant"),
  sf: real("sf"),
  leaseStart: text("lease_start"),
  leaseEnd: text("lease_end"),
  monthlyRent: real("monthly_rent"),
  annualRent: real("annual_rent"),
  deposit: real("deposit"),
  concessions: real("concessions"),
  arrears: real("arrears"),
  status: text("status"), // Current | Vacant | MTM | ...
  notes: text("notes"),
  sourceRaw: json<Record<string, string>>("source_raw").default({}),
  needsReview: integer("needs_review", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const rentRollFindings = sqliteTable("rent_roll_findings", {
  id: id(),
  rentRollId: text("rent_roll_id").references(() => rentRolls.id),
  unitRef: text("unit_ref"),
  code: text("code").notNull(),
  severity: text("severity").notNull().default("medium"),
  message: text("message").notNull(),
  sourceValue: text("source_value"),
  normalizedValue: text("normalized_value"),
  resolved: integer("resolved", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

// ═════════════════════════════════════════════════════════════════════════════
// Comp Lab
// ═════════════════════════════════════════════════════════════════════════════

export const compSets = sqliteTable("comp_sets", {
  id: id(),
  propertyId: text("property_id"),
  sourceDocumentId: text("source_document_id"),
  name: text("name").notNull(),
  compType: text("comp_type").notNull().default("sales"), // sales | lease | active | pending | user
  weights: json<Record<string, number>>("weights").default({}),
  filters: json<Record<string, unknown>>("filters").default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const comps = sqliteTable("comps", {
  id: id(),
  compSetId: text("comp_set_id").references(() => compSets.id),
  address: text("address"),
  assetType: text("asset_type"),
  transactionDate: text("transaction_date"),
  price: real("price"),
  size: real("size"),
  pricePerSf: real("price_per_sf"),
  pricePerUnit: real("price_per_unit"),
  capRate: real("cap_rate"),
  daysOnMarket: integer("days_on_market"),
  distanceMi: real("distance_mi"),
  source: text("source"),
  sourceDate: text("source_date"),
  lat: real("lat"),
  lng: real("lng"),
  verificationStatus: text("verification_status").notNull().default("needs_verification"), // verified | needs_verification | user_entered
  missingFields: json<string[]>("missing_fields").default([]),
  score: real("score"),
  createdAt: createdAt(),
});

export const compAdjustments = sqliteTable("comp_adjustments", {
  id: id(),
  compId: text("comp_id").references(() => comps.id),
  label: text("label").notNull(),
  amount: real("amount"),
  note: text("note"),
  // Always agent-entered assumptions, never presented as facts.
  agentEntered: integer("agent_entered", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

// ═════════════════════════════════════════════════════════════════════════════
// Signal Scout
// ═════════════════════════════════════════════════════════════════════════════

export const signals = sqliteTable(
  "signals",
  {
    id: id(),
    // expired | withdrawn | price_reduction | stale_lead | anniversary |
    // unanswered_inquiry | sphere | permit | manual
    type: text("type").notNull(),
    contactId: text("contact_id"),
    propertyId: text("property_id"),
    dealId: text("deal_id"),
    sourceKind: text("source_kind").notNull(), // fub | mls_upload | public_record | sphere | inbound
    sourceRef: text("source_ref"),
    sourceDate: text("source_date"),
    reason: text("reason").notNull(),
    // Confidence reflects DATA COMPLETENESS, never likelihood of selling.
    confidence: integer("confidence").notNull().default(0),
    confidenceBasis: text("confidence_basis"),
    suggestedAction: text("suggested_action"),
    relatedLabel: text("related_label"),
    assignedAgent: text("assigned_agent").default("Avery Sandoval"),
    status: text("status").notNull().default("new"), // new | pursued | snoozed | dismissed
    snoozeUntil: text("snooze_until"),
    dismissReason: text("dismiss_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => ({ typeIdx: index("signals_type_idx").on(t.type), statusIdx: index("signals_status_idx").on(t.status) }),
);

export const signalActions = sqliteTable("signal_actions", {
  id: id(),
  signalId: text("signal_id").references(() => signals.id),
  action: text("action").notNull(), // pursue | snooze | dismiss | create_task | add_note | draft_outreach
  detail: json<Record<string, unknown>>("detail").default({}),
  actor: text("actor").default("Avery Sandoval"),
  createdAt: createdAt(),
});

export const farmRecords = sqliteTable("farm_records", {
  id: id(),
  ownerName: text("owner_name"),
  address: text("address"),
  area: text("area"),
  relationship: text("relationship"), // sphere | farm | past_client | vendor
  contactId: text("contact_id"),
  notes: text("notes"),
  createdAt: createdAt(),
});
