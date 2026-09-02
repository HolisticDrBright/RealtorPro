/**
 * Seed the local database with the AgentOS demo world.
 * Run with: npm run db:seed  (idempotent — clears app tables first)
 *
 * The seed mirrors `src/data/mock-data.ts` so the backend and the frontend
 * describe the same agent, contacts, listings, criteria, and matches.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import { DB_FILE, WORKSPACE_SUBDIRS } from "../lib/paths";
import * as schema from "./schema";
import * as m from "./schema.modules";
import * as d from "./schema.dashboard";
import { DATA, OM } from "../data/mock-data";
import { parseCeiling, parseMoney } from "../lib/listing-parse";

for (const dir of WORKSPACE_SUBDIRS) fs.mkdirSync(dir, { recursive: true });

const sqlite = new Database(DB_FILE);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

// Buyer → contact mapping (b1/b2/b3 correspond to c1/c2/c3).
const BUYER_TO_CONTACT: Record<string, string> = { b1: "c1", b2: "c2", b3: "c3" };
const CONTACT_FUB: Record<string, string> = {
  c1: "48213",
  c2: "47990",
  c3: "48122",
  c4: "48310",
  c5: "47501",
};

function clear() {
  // Order respects FK references (children first).
  const tables = [
    "media_disclosures",
    "generated_claims",
    "approvals",
    "shortlist_items",
    "shortlists",
    "buyer_matches",
    "buyer_criteria_profiles",
    "facts",
    "assets",
    "listing_imports",
    "drafts",
    "generation_jobs",
    "exports",
    "column_mappings",
    "source_documents",
    "tasks",
    "notes",
    "appointments",
    "deals",
    "contacts",
    "properties",
    "sync_events",
    "provider_connections",
    "brokerage_policies",
    "user_profiles",
    "audit_logs",
    // extended modules
    "verification_findings",
    "verification_runs",
    "om_sections",
    "om_drafts",
    "template_rights_confirmations",
    "template_profiles",
    "brand_profiles",
    "derived_metrics",
    "disclosures",
    "export_records",
    "visualization_jobs",
    "storyboard_scenes",
    "storyboards",
    "visualizer_sources",
    "visualizer_projects",
    "rent_roll_findings",
    "rent_roll_units",
    "rent_rolls",
    "comp_adjustments",
    "comps",
    "comp_sets",
    "signal_actions",
    "signals",
    "farm_records",
    "todos",
    "calendar_events",
    "transactions",
  ];
  for (const t of tables) {
    try {
      sqlite.prepare(`DELETE FROM ${t}`).run();
    } catch {
      /* table may not exist on older schema */
    }
  }
}

function num(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

clear();

// ── Identity & policy ───────────────────────────────────────────────────────
const userId = "u1";
db.insert(schema.userProfiles)
  .values({
    id: userId,
    name: "Avery Sandoval",
    email: "averys@pdxhomes.example",
    license: "OR #201415632 · PDX Homes",
    serviceAreas: ["Portland metro — inner east side", "N Portland"],
  })
  .run();

db.insert(schema.brokeragePolicies)
  .values({ id: "bp1", userProfileId: userId, name: "PDX Homes default policy" })
  .run();

// ── Contacts ────────────────────────────────────────────────────────────────
for (const c of DATA.contacts) {
  db.insert(schema.contacts)
    .values({
      id: c.id,
      fubId: CONTACT_FUB[c.id] ?? null,
      name: c.name,
      role: c.role,
      stage: c.stage,
      nextStep: c.next,
      phone: c.phone,
      syncStatus: c.sync,
      temperature: ({ c1: "hot", c2: "warm", c3: "hot", c4: "warm", c5: "cold" } as Record<string, string>)[c.id] ?? "warm",
    })
    .run();
}

// ── Appointments ────────────────────────────────────────────────────────────
for (const [i, ap] of DATA.today.appointments.entries()) {
  db.insert(schema.appointments)
    .values({
      id: `ap${i + 1}`,
      title: ap.title,
      who: ap.who,
      location: ap.where,
      type: ap.type,
      startsAt: ap.time,
    })
    .run();
}

// ── Timelines → notes / tasks ───────────────────────────────────────────────
let noteN = 0;
let taskN = 0;
for (const [contactId, entries] of Object.entries(DATA.timelines)) {
  for (const e of entries) {
    if (e.type === "task") {
      db.insert(schema.tasks)
        .values({
          id: `t${++taskN}`,
          contactId,
          title: e.title,
          body: e.body,
          origin: "fub",
          syncedToFub: true,
          status: "open",
        })
        .run();
    } else if (e.type === "note" || e.type === "alert") {
      db.insert(schema.notes)
        .values({
          id: `n${++noteN}`,
          contactId,
          body: `${e.title}: ${e.body}`,
          isDraft: false,
          origin: "fub",
          syncedToFub: true,
        })
        .run();
    }
  }
}

// ── Deals (from Today deal-risk alerts) ─────────────────────────────────────
for (const [i, r] of DATA.today.risks.entries()) {
  db.insert(schema.deals)
    .values({
      id: `d${i + 1}`,
      contactId: r.contactId,
      name: r.deal,
      stage: "active",
      riskFlag: r.severity,
      riskIssue: r.issue,
    })
    .run();
}

// ── Properties (from all buyer matches + the studio listing) ────────────────
const propRows: { id: string; addr: string }[] = [];
for (const [, matches] of Object.entries(DATA.matches)) {
  for (const m of matches) {
    db.insert(schema.properties)
      .values({
        id: m.id,
        address: m.addr,
        mlsNumber: m.mls.replace("MLS #", ""),
        price: m.price,
        beds: m.beds,
        baths: m.baths,
        sqft: m.sqft,
        propertyType: "Residential",
        status: "active",
        sourceMeta: { hood: m.hood, source: "mls_alert" },
      })
      .run();
    propRows.push({ id: m.id, addr: m.addr });
  }
}

// The Listing Studio subject property + its fact ledger + media assets.
const listing = DATA.listings[0];
db.insert(schema.properties)
  .values({
    id: listing.id,
    address: listing.addr,
    mlsNumber: "24-ALMEDA1",
    price: listing.price,
    beds: 4,
    baths: 2.5,
    sqft: "2,860",
    lot: "6,500 sqft, corner lot",
    propertyType: "Residential — English Tudor",
    status: listing.status,
    remarks: "Storybook 1926 English Tudor; systems updated.",
    openHouse: "Sat 11–1",
    sourceMeta: { yearBuilt: 1926 },
  })
  .run();

// A source document + import for the Alameda CSV, so the ledger has provenance.
db.insert(schema.sourceDocuments)
  .values({
    id: "sd1",
    kind: "mls_csv",
    filename: "alameda-export.csv",
    mimeType: "text/csv",
    sha256: "seed-placeholder-alameda",
    byteSize: 0,
    storedPath: "sources/seed/alameda-export.csv",
    meta: { seeded: true },
  })
  .run();
db.insert(schema.listingImports)
  .values({
    id: "li1",
    sourceDocumentId: "sd1",
    propertyId: listing.id,
    rowCount: 1,
    validRows: 1,
    status: "parsed",
  })
  .run();

for (const [i, f] of listing.facts.entries()) {
  db.insert(schema.facts)
    .values({
      id: `f${i + 1}`,
      propertyId: listing.id,
      listingImportId: "li1",
      sourceDocumentId: "sd1",
      field: f.field,
      value: f.value,
      source: f.source,
      confidence: "reported",
    })
    .run();
}

// Demonstrate a recorded CONFLICT in the ledger (p1 sqft: CSV vs county).
db.insert(schema.facts)
  .values([
    {
      id: "fc1",
      propertyId: "p1",
      field: "LivingArea",
      value: "1,940 sqft",
      source: "CSV: LivingArea",
      confidence: "conflicting",
      conflictsWith: "fc2",
    },
    {
      id: "fc2",
      propertyId: "p1",
      field: "LivingArea",
      value: "1,876 sqft",
      source: "County record",
      confidence: "conflicting",
      conflictsWith: "fc1",
    },
  ])
  .run();

// Media assets for the Alameda listing (originals — rights confirmed).
for (const md of listing.media) {
  db.insert(schema.assets)
    .values({
      id: md.id,
      propertyId: listing.id,
      kind: "image",
      label: md.label,
      filename: `${md.id}.jpg`,
      mimeType: "image/jpeg",
      sha256: `seed-${md.id}`,
      byteSize: 0,
      storedPath: `assets/seed/${md.id}.jpg`,
      rightsConfirmed: md.authorized,
      alterationStatus: "original",
    })
    .run();
}
// One AI-altered derivative + its disclosure record, linked to the original.
db.insert(schema.assets)
  .values({
    id: "m1-alt",
    propertyId: listing.id,
    kind: "image",
    label: "Exterior — virtual twilight",
    filename: "m1-alt.jpg",
    mimeType: "image/jpeg",
    sha256: "seed-m1-alt",
    byteSize: 0,
    storedPath: "generated/seed/m1-alt.jpg",
    rightsConfirmed: true,
    alterationStatus: "altered",
    originalAssetId: "m1",
    alterationDescription: "Virtual twilight — sky and window glow replaced",
  })
  .run();
db.insert(schema.mediaDisclosures)
  .values({
    id: "disc1",
    assetId: "m1-alt",
    originalAssetId: "m1",
    alteration: "Virtual twilight — sky and window glow replaced",
    disclosureText: "Virtual twilight applied to exterior frame (disclosed).",
    status: "pending",
  })
  .run();

// A reusable RMLS column mapping.
db.insert(schema.columnMappings)
  .values({
    id: "cm1",
    name: "RMLS standard export",
    sourceType: "mls_csv",
    mapping: {
      address: "Address",
      mlsNumber: "ML#",
      price: "List Price",
      beds: "Beds",
      baths: "Baths",
      sqft: "SqFt",
      lot: "Lot Size",
      propertyType: "Property Type",
      remarks: "Public Remarks",
      openHouse: "Open House",
    },
  })
  .run();

// ── Buyer criteria + matches ────────────────────────────────────────────────
for (const buyer of DATA.buyers) {
  const contactId = BUYER_TO_CONTACT[buyer.id];
  const profileId = `cp-${buyer.id}`;
  db.insert(schema.buyerCriteriaProfiles)
    .values({
      id: profileId,
      contactId,
      label: `${buyer.name} — active search`,
      ceilingText: buyer.ceiling,
      ceilingAmount: parseCeiling(buyer.ceiling),
      ceilingHard: /hard/i.test(buyer.ceiling),
      hardConstraints: buyer.constraints,
      weightedPrefs: buyer.prefs,
      areas: buyer.areas,
      mustHaves: buyer.mustHaves,
      agreedAt: "2026-07-15",
    })
    .run();

  const matches = DATA.matches[buyer.id] || [];
  for (const m of matches) {
    db.insert(schema.buyerMatches)
      .values({
        id: `bm-${m.id}`,
        criteriaProfileId: profileId,
        propertyId: m.id,
        listingImportId: null,
        address: m.addr,
        score: m.score,
        overCeiling: !!m.over,
        reasons: m.reasons,
        tradeoffs: m.tradeoffs,
        missingFacts: [],
        verifyQuestions: m.verify ? [m.verify] : [],
      })
      .run();
  }
  // A shortlist per buyer.
  db.insert(schema.shortlists)
    .values({ id: `sl-${buyer.id}`, criteriaProfileId: profileId, name: "Shortlist" })
    .run();
}

// ── Provider connection + sync log ──────────────────────────────────────────
db.insert(schema.providerConnections)
  .values({
    id: "pc-fub",
    provider: "fub",
    status: "connected",
    keyRef: "env:FUB_API_KEY",
    scopes: ["read:contacts", "read:deals", "write:tasks", "write:draft-notes"],
    lastSyncAt: new Date(new Date().setHours(9, 42, 0, 0)).toISOString(),
    meta: { account: "averys@pdxhomes.example" },
  })
  .run();

for (const [i, l] of DATA.fub.log.entries()) {
  db.insert(schema.syncEvents)
    .values({
      id: `se${i + 1}`,
      provider: "fub",
      direction: l.dir.toLowerCase() === "pull" ? "pull" : "push",
      entity: "mixed",
      itemCount: num(l.items) ?? 0,
      status: l.status === "OK" ? "OK" : "error",
      detail: `${l.time} · ${l.items}`,
    })
    .run();
}

db.insert(schema.auditLogs)
  .values({
    id: "al-seed",
    action: "seed.complete",
    actor: "system",
    entityType: "database",
    metadata: { contacts: DATA.contacts.length, buyers: DATA.buyers.length },
  })
  .run();

// ═══════════════════════════════════════════════════════════════════════════
// Extended modules — all figures below are FICTIONAL demo data.
// ═══════════════════════════════════════════════════════════════════════════

// Brand kits + templates (with rights confirmations).
const brandIds: string[] = [];
for (const [i, k] of OM.brandKits.entries()) {
  const bid = `brand${i + 1}`;
  brandIds.push(bid);
  db.insert(m.brandProfiles)
    .values({ id: bid, name: k.name, broker: k.broker, contact: k.contact, disclaimer: k.disclaimer, colors: ["#201e1d", "#ec3013", "#faf9f8"], ownedByUser: true })
    .run();
}
for (const t of OM.templates) {
  db.insert(m.templateProfiles)
    .values({ id: t.id, name: t.name, family: t.family, description: t.desc, isOriginal: true })
    .run();
  db.insert(m.templateRightsConfirmations)
    .values({ templateProfileId: t.id, confirmedBy: "Avery Sandoval", ownershipBasis: "original", note: "Original template built from own brand assets." })
    .run();
}

// OM drafts + sections (from OM.projects / OM.pages).
for (const [pi, proj] of OM.projects.entries()) {
  const draftId = proj.id;
  db.insert(m.omDrafts)
    .values({
      id: draftId,
      name: proj.name,
      address: proj.addr,
      market: proj.market,
      assetType: proj.type,
      price: proj.price,
      brandProfileId: brandIds[0],
      templateProfileId: "t1",
      approvalState: proj.status === "In review" ? "Needs Review" : "Draft",
      ownerName: proj.owner,
    })
    .run();
  if (pi === 0) {
    for (const [oi, page] of OM.pages.entries()) {
      db.insert(m.omSections)
        .values({
          omDraftId: draftId,
          key: page.id,
          title: page.label,
          orderIndex: oi,
          pageStyle: "editorial",
          needsReview: !!page.flag,
          contentBlocks: page.id === "highlights" ? OM.highlights : page.id === "risk" ? OM.risks.map((r) => ({ text: r })) : [],
        })
        .run();
    }
    // Derived metrics from KPIs (pending values store no number).
    for (const kpi of OM.kpis) {
      const status = kpi.status.toLowerCase().includes("import")
        ? "imported"
        : kpi.status.toLowerCase().includes("calc")
          ? "calculated"
          : "pending";
      db.insert(m.derivedMetrics)
        .values({
          subjectType: "om",
          subjectId: draftId,
          metric: kpi.label,
          displayValue: status === "pending" ? "—" : kpi.value,
          value: status === "pending" ? null : parseMoney(kpi.value),
          formula: kpi.src,
          status,
          sourceFactIds: [],
        })
        .run();
    }
    // Compliance findings → verification run + findings.
    const runId = "vr-om1";
    db.insert(m.verificationRuns).values({ id: runId, omDraftId: draftId, lens: "all", status: "complete", summary: { seeded: true } }).run();
    for (const c of OM.compliance) {
      db.insert(m.verificationFindings)
        .values({ verificationRunId: runId, omDraftId: draftId, lens: "source", severity: "high", code: c.id, message: `${c.title}: ${c.body}`, repairAction: "Resolve before export.", status: "open" })
        .run();
    }
    // OM legal disclosure.
    db.insert(m.disclosures)
      .values({ subjectType: "om", subjectId: draftId, kind: "om_legal", text: OM.brandKits[0].disclaimer, mode: "brokerage", required: true, status: "approved" })
      .run();
  }
}

// Rent roll (from OM.rentroll).
const rrId = "rr1";
db.insert(m.rentRolls).values({ id: rrId, name: "Hawthorne Exchange rent roll (demo)", status: "validated", unitCount: OM.rentroll.length, note: OM.rentrollNote, localOnly: true }).run();
for (const [i, u] of OM.rentroll.entries()) {
  db.insert(m.rentRollUnits)
    .values({
      id: `rru${i + 1}`,
      rentRollId: rrId,
      unit: u.unit,
      tenant: u.tenant,
      sf: parseMoney(u.sf),
      leaseEnd: u.exp,
      monthlyRent: parseMoney(u.mo),
      annualRent: parseMoney(u.yr),
      status: u.status,
      sourceRaw: { ...u },
      needsReview: u.status === "Vacant",
    })
    .run();
}

// Comp set (from OM.comps).
const csId = "cs1";
db.insert(m.compSets).values({ id: csId, name: "Hawthorne Exchange comps (demo)", compType: "sales", weights: { distance: 0.3, recency: 0.25, sizeSimilarity: 0.2, psfSimilarity: 0.15, assetMatch: 0.1 } }).run();
for (const [i, c] of OM.comps.entries()) {
  db.insert(m.comps)
    .values({
      id: `comp${i + 1}`,
      compSetId: csId,
      address: c.addr,
      transactionDate: c.sold,
      price: parseMoney(c.price),
      pricePerSf: parseMoney(c.psf),
      distanceMi: parseMoney(c.dist),
      source: c.source,
      sourceDate: c.sold,
      verificationStatus: c.verified ? "verified" : "needs_verification",
      missingFields: c.verified ? [] : ["independent_source"],
    })
    .run();
}

// Development Visualizer sample project (fictional).
db.insert(m.visualizerProjects).values({ id: "viz1", name: "Foster Rd land teaser (demo)", address: "9204 SE Foster Rd", visualizationType: "land_teaser", status: "draft" }).run();
db.insert(m.visualizerSources).values({ id: "vs1", projectId: "viz1", kind: "aerial", label: "Authorized aerial (demo)", rightsConfirmed: true, boundaryVerified: false, boundaryBasis: "none" }).run();

// Signal Scout sample signals (fictional).
db.insert(m.signals).values([
  { id: "sig1", type: "anniversary", contactId: "c5", sourceKind: "fub", sourceRef: "c5", reason: "1-year anniversary of Lin Chen's closing (demo).", confidence: 100, confidenceBasis: "All expected fields present.", suggestedAction: "Send an anniversary touch (draft only).", relatedLabel: "Lin Chen", status: "new" },
  { id: "sig2", type: "stale_lead", contactId: "c2", sourceKind: "fub", sourceRef: "c2", reason: "No contact with Dana Whitfield in 34 days (demo).", confidence: 66, confidenceBasis: "2/3 fields present; missing: stage.", suggestedAction: "Re-engage: draft a follow-up or create a FUB task.", relatedLabel: "Dana Whitfield", status: "new" },
  { id: "sig3", type: "expired", sourceKind: "mls_upload", sourceRef: "24-EXP-001", reason: "Expired listing: 4110 SE Belmont St (demo upload).", confidence: 80, confidenceBasis: "4/5 fields present; missing: owner.", suggestedAction: "Review the expired listing, then draft a re-list outreach for your approval.", relatedLabel: "4110 SE Belmont St", status: "new" },
]).run();

console.log("✔ Modules seeded:", { brandKits: OM.brandKits.length, omDrafts: OM.projects.length, rentRollUnits: OM.rentroll.length, comps: OM.comps.length, signals: 3 });

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard — todos, calendar, transactions, off-market. FICTIONAL demo data.
// Dated relative to "today" so the dashboard is populated on first run.
// ═══════════════════════════════════════════════════════════════════════════
const today = new Date();
const ymd = (dt: Date) => dt.toISOString().slice(0, 10);
const at = (h: number, mnt = 0) => { const x = new Date(today); x.setHours(h, mnt, 0, 0); return x.toISOString(); };
const year = today.getFullYear();
const TODAY = ymd(today);

db.insert(d.todos).values([
  { id: "td1", title: "Reply to Ruiz inspection addendum (seller countered $4,500 credit)", kind: "priority", dueDate: TODAY, contactId: "c3" },
  { id: "td2", title: "Approve Alameda MLS description before photos go live", kind: "priority", dueDate: TODAY, propertyId: "l1" },
  { id: "td3", title: "Confirm Whitfield appraisal order with lender", kind: "priority", dueDate: TODAY, contactId: "c2" },
  { id: "td4", title: "Review 5 new Mehta matches before the 10:30 showing", kind: "task", dueDate: TODAY, contactId: "c1" },
  { id: "td5", title: "Push Saturday open-house sign-ins to Follow Up Boss", kind: "task", dueDate: TODAY, propertyId: "l1" },
  { id: "td6", title: "Order sign + lockbox for Alameda", kind: "task", dueDate: TODAY, propertyId: "l1", done: true, completedAt: at(8, 5) },
  { id: "td7", title: "Pre-approval check-in", kind: "call", dueDate: TODAY, contactId: "c3", notes: "(971) 555-0187" },
  { id: "td8", title: "Lender — appraisal confirmation number", kind: "call", dueDate: TODAY, contactId: "c2", notes: "(503) 555-0119" },
  { id: "td9", title: "Anniversary check-in call", kind: "call", dueDate: TODAY, contactId: "c5", notes: "(503) 555-0175" },
  { id: "td10", title: "Listing agent — confirm Reedway sqft (CSV vs county)", kind: "call", dueDate: TODAY, propertyId: "p1" },
]).run();

db.insert(d.calendarEvents).values([
  { id: "ev1", title: "Showing — 4823 SE Reedway St", startsAt: at(10, 30), endsAt: at(11, 15), location: "Meet at property", source: "local", contactId: "c1", propertyId: "p1" },
  { id: "ev2", title: "Listing photos walkthrough", startsAt: at(13, 0), endsAt: at(14, 0), location: "3117 NE Alameda St", source: "local", contactId: "c4", propertyId: "l1" },
  { id: "ev3", title: "Pre-approval check-in call — Ruiz", startsAt: at(16, 15), endsAt: at(16, 45), location: "Phone", source: "local", contactId: "c3" },
  { id: "ev4", title: "Team pipeline review", startsAt: at(9, 0), endsAt: at(9, 30), location: "Office", source: "local" },
]).run();

// Closed YTD (fictional) + active pipeline.
db.insert(d.transactions).values([
  { id: "tx1", side: "listing", address: "2718 SE Clinton St", price: 812000, status: "closed", closedAt: `${year}-01-24`, commissionPct: 2.5, gci: 20300, contactId: "c5" },
  { id: "tx2", side: "buyer", address: "5541 NE 30th Ave", price: 649000, status: "closed", closedAt: `${year}-02-18`, commissionPct: 2.5, gci: 16225 },
  { id: "tx3", side: "listing", address: "1440 SE Ladd Ave", price: 1275000, status: "closed", closedAt: `${year}-03-29`, commissionPct: 2.25, gci: 28688 },
  { id: "tx4", side: "buyer", address: "8317 N Fenwick Ave", price: 489000, status: "closed", closedAt: `${year}-04-11`, commissionPct: 2.5, gci: 12225 },
  { id: "tx5", side: "buyer", address: "3920 SE Taylor St", price: 735000, status: "closed", closedAt: `${year}-05-30`, commissionPct: 2.5 },
  { id: "tx6", side: "listing", address: "6122 SE Yamhill St", price: 699000, status: "closed", closedAt: `${year}-06-20`, commissionPct: 2.5, gci: 17475 },
  { id: "tx7", side: "buyer", address: "7215 N Curtis Ave", price: 512000, status: "pending", stage: "Inspection period", contactId: "c3", commissionPct: 2.5 },
  { id: "tx8", side: "buyer", address: "1150 NW Quimby St #804", price: 436000, status: "pending", stage: "Appraisal", contactId: "c2", commissionPct: 2.5 },
  { id: "tx9", side: "listing", address: "3117 NE Alameda St", price: 1150000, status: "active", stage: "Coming soon — photos Thu", contactId: "c4", propertyId: "l1", commissionPct: 2.5 },
  { id: "tx10", side: "buyer", address: "Mehta — active search", price: 700000, status: "active", stage: "Touring", contactId: "c1", commissionPct: 2.5 },
]).run();

// Off-market properties (agent-entered / owner-authorized, fictional).
db.insert(schema.properties).values([
  { id: "om-p1", address: "5218 SE 41st Ave", price: "$685,000", beds: 3, baths: 2, sqft: "1,880", lot: "5,000 sqft", propertyType: "Residential", status: "off_market", features: ["fenced yard", "detached garage", "updated kitchen 2022", "office nook"], remarks: "Owner open to a quiet sale before listing. Fenced backyard, detached garage + driveway.", sourceMeta: { hood: "Woodstock", source: "owner-authorized" } },
  { id: "om-p2", address: "1420 NW Irving St #506", price: "$429,000", beds: 1, baths: 1, sqft: "790", propertyType: "Condo", status: "off_market", features: ["in-unit laundry", "deeded parking", "elevator building", "city view"], remarks: "HOA $480/mo. In-unit washer/dryer, deeded space P-12.", sourceMeta: { hood: "Pearl District", source: "sphere referral" } },
  { id: "om-p3", address: "9012 N Kellogg St", price: "$505,000", beds: 3, baths: 1.5, sqft: "1,640", lot: "4,800 sqft", propertyType: "Residential", status: "off_market", features: ["basement", "bonus room", "FHA eligible"], remarks: "St. Johns bungalow with finished basement. FHA-eligible condition per owner.", sourceMeta: { hood: "St. Johns", source: "farm mailer response" } },
]).run();

console.log("✔ Dashboard seeded:", { todos: 10, events: 4, transactions: 10, offMarket: 3 });

console.log("✔ Seed complete:", {
  contacts: DATA.contacts.length,
  properties: propRows.length + 1,
  buyers: DATA.buyers.length,
});
sqlite.close();
