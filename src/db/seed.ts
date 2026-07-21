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
import { DATA } from "../data/mock-data";
import { parseCeiling } from "../lib/listing-parse";

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
  ];
  for (const t of tables) sqlite.prepare(`DELETE FROM ${t}`).run();
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
    lastSyncAt: "Today 9:42 AM",
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

console.log("✔ Seed complete:", {
  contacts: DATA.contacts.length,
  properties: propRows.length + 1,
  buyers: DATA.buyers.length,
});
sqlite.close();
