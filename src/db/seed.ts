/**
 * Seed: realistic (fictional) luxury Orange County data, dated relative to
 * today so the dashboard is always "live". Run: npm run db:seed
 * Relative imports only (runs under tsx, outside the Next bundle).
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import * as s from "./schema";
import { DB_FILE, WORKSPACE_SUBDIRS } from "../lib/paths";
import { addDays, ymd } from "../lib/dates";

for (const dir of WORKSPACE_SUBDIRS) fs.mkdirSync(dir, { recursive: true });
const sqlite = new Database(DB_FILE);
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema: s });

const now = new Date();
const Y = now.getFullYear();
const d = (n: number) => ymd(addDays(now, n));
const at = (dayOffset: number, h: number, m = 0) => { const x = addDays(now, dayOffset); x.setHours(h, m, 0, 0); return `${ymd(x)}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`; };
const iso = (n: number, h = 10) => { const x = addDays(now, n); x.setHours(h, 0, 0, 0); return x.toISOString(); };
const thisYear = (m: number, day: number) => `${Y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
/** A closing date earlier this year; if the month is in the future, wrap to last year. */
const closedOn = (m: number, day: number) => (new Date(Y, m - 1, day) <= now ? thisYear(m, day) : `${Y - 1}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`);

// Wipe in dependency order.
for (const t of [s.notifications, s.touchpoints, s.opportunities, s.activities, s.notes, s.appointments, s.calls, s.tasks, s.offers, s.milestones, s.transactions, s.listings, s.properties, s.sellers, s.buyers, s.contacts, s.settings]) db.delete(t).run();

db.insert(s.settings).values({ id: "st1", agentName: "Vanessa Smith", title: "Luxury Real Estate Advisor", brokerage: "Compass", annualGoal: 200000, defaultCommissionPct: 2.5, defaultSplitPct: 68 }).run();

// ── Contacts ──────────────────────────────────────────────────────────────
type C = typeof s.contacts.$inferInsert;
const contacts: C[] = [
  { id: "c1", firstName: "Sarah", lastName: "Thompson", phone: "(949) 555-1212", email: "sarah.thompson@example.com", spouse: "Mark Thompson", birthday: `${Y}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(Math.min(28, now.getDate() + 1)).padStart(2, "0")}`, homeAddress: "22 Pelican Point, Newport Coast", type: "buyer", leadSource: "referral", tags: ["relocating", "cash-capable"], priceMin: 3000000, priceMax: 5000000, preferredAreas: ["Newport Coast", "Crystal Cove"], stage: "showing_homes", stageOrder: 0, estValue: 4200000, estCommission: 105000, probability: 65, nextAction: "Send Pelican Hill new listing", lastContactAt: iso(-6), nextFollowUpAt: d(0), notes: "Relocating from San Francisco. Wants ocean view, no interior courtyard. Husband works from home — needs an office." },
  { id: "c2", firstName: "James", lastName: "Pickford", phone: "(714) 555-9876", email: "james.pickford@example.com", birthday: "1978-03-14", homeAddress: "Corona del Mar", type: "buyer", leadSource: "instagram", tags: ["investor"], priceMin: 2000000, priceMax: 3000000, preferredAreas: ["Corona del Mar", "Newport Beach"], stage: "offer_submitted", stageOrder: 0, estValue: 2650000, estCommission: 66250, probability: 55, nextAction: "Review offer with James", lastContactAt: iso(-1), nextFollowUpAt: d(0), notes: "Reviewing the offer on 8 Coral Ridge. Wants to close before school year." },
  { id: "c3", firstName: "David", lastName: "Wilson", phone: "(949) 555-6543", email: "david.wilson@example.com", spouse: "Elena Wilson", birthday: "1965-11-02", homeAddress: "18 Monarch Bay Dr, Laguna Niguel", type: "seller", leadSource: "past_client", tags: ["downsizing"], stage: "listing_appointment", stageOrder: 0, estValue: 3400000, estCommission: 85000, probability: 60, nextAction: "Listing presentation 1:00 PM", lastContactAt: iso(-2), nextFollowUpAt: d(0), notes: "Sold them their home in 2016. Downsizing to Dana Point. Considering Compass Concierge for staging." },
  { id: "c4", firstName: "Michael", lastName: "Harris", phone: "(949) 555-3333", email: "michael.harris@example.com", birthday: "1972-07-21", homeAddress: "45 Crestview Dr, Newport Beach", type: "past_client", leadSource: "sphere", tags: ["referral-source"], stage: "closed", stageOrder: 0, probability: 100, lastContactAt: iso(-40), notes: "Closed 45 Crestview last year. Sends referrals; check in quarterly. Golf at Big Canyon." },
  { id: "c5", firstName: "Ryan", lastName: "Johnson", phone: "(949) 555-2020", email: "ryan.ashley.johnson@example.com", spouse: "Ashley Johnson", birthday: "1984-09-09", homeAddress: "Laguna Beach (renting)", type: "buyer", leadSource: "open_house", tags: ["first-luxury-purchase"], priceMin: 2500000, priceMax: 4000000, preferredAreas: ["Laguna Beach", "Emerald Bay"], stage: "active_buyer", stageOrder: 1, estValue: 3300000, estCommission: 82500, probability: 45, nextAction: "Tour 112 Emerald Bay Saturday", lastContactAt: iso(-7), nextFollowUpAt: d(1), notes: "Met at 8 Coral Ridge open house. Ocean view is the non-negotiable. Pre-approved with Chase Private Client." },
  { id: "c6", firstName: "Mark", lastName: "Anderson", phone: "(714) 555-7788", email: "mark.lisa.anderson@example.com", spouse: "Lisa Anderson", birthday: "1980-01-25", homeAddress: "North Tustin", type: "buyer", leadSource: "zillow", tags: [], priceMin: 2000000, priceMax: 3500000, preferredAreas: ["North Tustin", "Lemon Heights", "Cowan Heights"], stage: "qualified", stageOrder: 2, estValue: 2800000, estCommission: 70000, probability: 35, nextAction: "Send new Cowan Heights listing", lastContactAt: iso(-9), nextFollowUpAt: d(-1), notes: "Want a flat lot for a pool and space for in-laws. Flexible on timing." },
  { id: "c7", firstName: "Jennifer", lastName: "Nguyen", phone: "(949) 555-4141", email: "jnguyen@example.com", birthday: "1988-05-30", homeAddress: "Irvine", type: "lead", leadSource: "website", tags: [], priceMin: 1800000, priceMax: 2400000, preferredAreas: ["Irvine", "Shady Canyon", "Turtle Rock"], stage: "new_lead", stageOrder: 0, estValue: 2100000, estCommission: 52500, probability: 15, nextAction: "Intro call", notes: "Website inquiry on Shady Canyon listing. Physician, relocating from Houston in the fall." },
  { id: "c8", firstName: "Robert", lastName: "Chen", phone: "(949) 555-5150", email: "robert.chen@example.com", spouse: "Amy Chen", birthday: "1969-12-12", homeAddress: "123 Emerald Bay, Laguna Beach", type: "seller", leadSource: "referral", tags: ["escrow"], stage: "in_escrow", stageOrder: 0, estValue: 4250000, estCommission: 106250, probability: 95, nextAction: "Confirm appraisal date", lastContactAt: iso(-1), nextFollowUpAt: d(2), notes: "Sellers of 123 Emerald Bay. Moving to Scottsdale. Wants a smooth close — keep them informed weekly." },
  { id: "c9", firstName: "Patricia", lastName: "Moore", phone: "(714) 555-6060", email: "pmoore@example.com", birthday: "1958-08-18", homeAddress: "7 Coral Ridge, Laguna Niguel", type: "seller", leadSource: "sphere", tags: ["escrow"], stage: "in_escrow", stageOrder: 1, estValue: 2850000, estCommission: 71250, probability: 95, lastContactAt: iso(-3), nextFollowUpAt: d(3), notes: "Widowed; daughter Karen helps with decisions. Prefers phone over text." },
  { id: "c10", firstName: "Daniel", lastName: "Kim", phone: "(949) 555-8080", email: "daniel.kim@example.com", birthday: "1990-04-04", homeAddress: "14 Shoreline, Newport Coast", type: "seller", leadSource: "agent_referral", tags: [], stage: "active_seller", stageOrder: 0, estValue: 6950000, estCommission: 173750, probability: 70, nextAction: "Weekly showing report Friday", lastContactAt: iso(-4), nextFollowUpAt: d(1), notes: "Tech founder. Wants data — send weekly showing + web-traffic report." },
  { id: "c11", firstName: "Laura", lastName: "Martinez", phone: "(949) 555-9090", email: "laura.martinez@example.com", birthday: "1975-02-02", homeAddress: "8 Coral Ridge, Laguna Niguel", type: "seller", leadSource: "past_client", tags: [], stage: "negotiating", stageOrder: 1, estValue: 3750000, estCommission: 93750, probability: 80, nextAction: "Counter on Pickford offer", lastContactAt: iso(0), notes: "Motivated — bought in Austin already. Will consider 3.6M with quick close." },
  { id: "c12", firstName: "Steven", lastName: "Brooks", phone: "(714) 555-1234", email: "steven.brooks@example.com", birthday: "1962-06-15", homeAddress: "1 Pelican Hill Cir, Newport Coast", type: "seller", leadSource: "cold_outreach", tags: ["off-market"], stage: "contacted", stageOrder: 2, estValue: 8500000, estCommission: 212500, probability: 25, nextAction: "Home value update in October", lastContactAt: iso(-20), checkBackAt: d(25), notes: "Said 'maybe list in October, quietly.' Wants an off-market approach first." },
  { id: "c13", firstName: "Emily", lastName: "Rodriguez", phone: "(949) 555-2323", email: "emily.r@example.com", birthday: "1992-10-10", homeAddress: "Costa Mesa", type: "lead", leadSource: "open_house", tags: [], priceMin: 1500000, priceMax: 2200000, preferredAreas: ["Costa Mesa", "Eastside", "Newport Heights"], stage: "contacted", stageOrder: 3, estValue: 1900000, estCommission: 47500, probability: 20, nextAction: "Set buyer consultation", lastContactAt: iso(-16), nextFollowUpAt: d(-4), notes: "Open house sign-in. Wants to buy within 6 months." },
  { id: "c14", firstName: "Thomas", lastName: "Wright", phone: "(949) 555-7070", email: "twright@example.com", birthday: "1955-03-03", homeAddress: "112 Emerald Bay, Laguna Beach", type: "seller", leadSource: "referral", tags: [], stage: "active_seller", stageOrder: 1, estValue: 8900000, estCommission: 222500, probability: 65, nextAction: "Price improvement discussion", lastContactAt: iso(-5), nextFollowUpAt: d(0), notes: "Estate property. Trust attorney copied on everything." },
  { id: "c15", firstName: "Karen", lastName: "Sullivan", phone: "(949) 555-4545", email: "karen.sullivan@example.com", birthday: "1970-09-27", homeAddress: "Irvine", type: "past_client", leadSource: "referral", tags: ["referral-source"], stage: "closed", stageOrder: 1, probability: 100, lastContactAt: iso(-75), notes: "Closed Turtle Rock purchase in February. Anniversary gift due." },
  { id: "c16", firstName: "Brian", lastName: "Foster", phone: "(714) 555-3131", email: "bfoster@example.com", homeAddress: "Huntington Harbour", type: "past_client", leadSource: "zillow", tags: [], stage: "closed", stageOrder: 2, probability: 100, lastContactAt: iso(-120), notes: "Bought Huntington Harbour waterfront. Boat owner." },
  { id: "c17", firstName: "Alexis", lastName: "Grant", phone: "(949) 555-0101", email: "alexis.grant@compassexample.com", type: "agent", leadSource: "other", tags: ["compass", "laguna"], stage: "nurture", stageOrder: 0, probability: 0, lastContactAt: iso(-2), notes: "Compass Laguna. Shares pocket listings; says seller at 9 Blue Lagoon may take $2.5M." },
  { id: "c18", firstName: "Marcus", lastName: "Bell", phone: "(949) 555-6161", email: "marcus@stagingexample.com", type: "vendor", leadSource: "other", tags: ["staging"], stage: "nurture", stageOrder: 1, probability: 0, lastContactAt: iso(-10), notes: "Staging — Coastal Luxe Staging. 3-week lead time in spring." },
  { id: "c19", firstName: "Olivia", lastName: "Park", phone: "(949) 555-7272", email: "olivia.park@example.com", birthday: "1986-12-24", homeAddress: "Newport Beach", type: "sphere", leadSource: "sphere", tags: ["pilates"], stage: "nurture", stageOrder: 2, probability: 5, lastContactAt: iso(-45), notes: "Pilates friend. Mentioned parents may sell Big Canyon home next year." },
  { id: "c20", firstName: "William", lastName: "Hayes", phone: "(714) 555-8181", email: "will.hayes@example.com", birthday: "1979-04-19", homeAddress: "Yorba Linda", type: "lead", leadSource: "agent_referral", tags: [], priceMin: 3000000, priceMax: 4500000, preferredAreas: ["Newport Coast", "Corona del Mar"], stage: "new_lead", stageOrder: 1, estValue: 3800000, estCommission: 95000, probability: 15, nextAction: "Intro call", notes: "Referred by an agent in Phoenix. Relocating in 60 days." },
  { id: "c21", firstName: "Grace", lastName: "Liu", phone: "(949) 555-9191", email: "grace.liu@example.com", birthday: "1983-08-08", homeAddress: "Shady Canyon, Irvine", type: "past_client", leadSource: "past_client", tags: [], stage: "closed", stageOrder: 3, probability: 100, lastContactAt: iso(-30), notes: "Closed Shady Canyon in April. Loves the house; wants us to sell her Irvine condo eventually." },
  { id: "c22", firstName: "Henry", lastName: "Douglas", phone: "(949) 555-2424", email: "h.douglas@example.com", homeAddress: "Dana Point", type: "past_client", leadSource: "open_house", tags: [], stage: "closed", stageOrder: 4, probability: 100, lastContactAt: iso(-200), notes: "Bought Monarch Beach condo. Retired; travels often." },
];
db.insert(s.contacts).values(contacts).run();

// ── Buyers ────────────────────────────────────────────────────────────────
db.insert(s.buyers).values([
  { id: "b1", contactId: "c1", temperature: "hot", priority: "high", priceMin: 3000000, priceMax: 5000000, targetAreas: ["Newport Coast", "Crystal Cove", "Pelican Hill"], minBeds: 4, minBaths: 3, minSqft: 3000, lotRequirements: "Privacy; pool-ready", propertyType: "Single Family", mustHaves: ["ocean view", "office"], dealBreakers: ["interior courtyard", "busy street"], financingType: "Conventional (jumbo)", preApprovalAmount: 5200000, timeline: "Next 60 days", propertiesSent: 14, propertiesToured: 6, offersMade: 0, notes: "Loves Crystal Cove; husband needs home office. Not a fan of Tuscan style." },
  { id: "b2", contactId: "c2", temperature: "hot", priority: "high", priceMin: 2000000, priceMax: 3000000, targetAreas: ["Corona del Mar", "Newport Beach"], minBeds: 3, minBaths: 2.5, minSqft: 2000, propertyType: "Single Family", mustHaves: ["walkable"], dealBreakers: ["HOA over $1,000"], financingType: "Conventional", preApprovalAmount: 3000000, timeline: "ASAP", propertiesSent: 22, propertiesToured: 9, offersMade: 1, notes: "Offer in on 8 Coral Ridge. Backup: CdM flower streets." },
  { id: "b3", contactId: "c5", temperature: "hot", priority: "medium", priceMin: 2500000, priceMax: 4000000, targetAreas: ["Laguna Beach", "Emerald Bay", "Three Arch Bay"], minBeds: 3, minBaths: 2.5, minSqft: 2200, propertyType: "Single Family", mustHaves: ["ocean view"], dealBreakers: [], financingType: "Conventional (jumbo)", preApprovalAmount: 4000000, timeline: "3-6 months", propertiesSent: 8, propertiesToured: 3, offersMade: 0, notes: "Ocean view is the non-negotiable." },
  { id: "b4", contactId: "c6", temperature: "warm", priority: "medium", priceMin: 2000000, priceMax: 3500000, targetAreas: ["North Tustin", "Lemon Heights", "Cowan Heights"], minBeds: 4, minBaths: 3, minSqft: 2500, lotRequirements: "Flat 1/2 acre+ for pool", propertyType: "Single Family", mustHaves: ["flat lot", "in-law suite"], dealBreakers: ["steep driveway"], financingType: "Conventional", preApprovalAmount: 3500000, timeline: "6-12 months", propertiesSent: 5, propertiesToured: 2, offersMade: 0, notes: "" },
  { id: "b5", contactId: "c13", temperature: "nurture", priority: "low", priceMin: 1500000, priceMax: 2200000, targetAreas: ["Costa Mesa", "Newport Heights"], minBeds: 3, minBaths: 2, minSqft: 1800, propertyType: "Single Family", mustHaves: [], dealBreakers: [], financingType: "Conventional", preApprovalAmount: null, timeline: "6 months", propertiesSent: 0, propertiesToured: 0, offersMade: 0, notes: "Needs pre-approval first." },
  { id: "b6", contactId: "c20", temperature: "warm", priority: "high", priceMin: 3000000, priceMax: 4500000, targetAreas: ["Newport Coast", "Corona del Mar"], minBeds: 4, minBaths: 3.5, minSqft: 3200, propertyType: "Single Family", mustHaves: ["pool"], dealBreakers: [], financingType: "Cash", preApprovalAmount: null, timeline: "Next 60 days", propertiesSent: 0, propertiesToured: 0, offersMade: 0, notes: "Cash buyer relocating from Phoenix." },
]).run();

// ── Sellers ───────────────────────────────────────────────────────────────
db.insert(s.sellers).values([
  { id: "s1", contactId: "c3", propertyAddress: "18 Monarch Bay Dr", city: "Laguna Niguel", estimatedValue: 3300000, expectedListPrice: 3495000, timeline: "List in 6-8 weeks", motivation: "Downsizing", listingAppointmentAt: at(0, 13), probability: 60, stage: "appointment_scheduled", notes: "Bring Concierge staging proposal + 3 comps." },
  { id: "s2", contactId: "c12", propertyAddress: "1 Pelican Hill Cir", city: "Newport Coast", estimatedValue: 8200000, expectedListPrice: 8500000, timeline: "October, off-market first", motivation: "Testing the market", probability: 25, stage: "contacted", notes: "Send home-value update early October." },
  { id: "s3", contactId: "c19", propertyAddress: "Big Canyon (parents)", city: "Newport Beach", estimatedValue: 4000000, expectedListPrice: null, timeline: "Next year", motivation: "Parents relocating", probability: 15, stage: "lead", notes: "Olivia's parents. Soft touch only." },
  { id: "s4", contactId: "c10", propertyAddress: "14 Shoreline", city: "Newport Coast", estimatedValue: 6800000, expectedListPrice: 6950000, timeline: "Listed", motivation: "Upgrading", probability: 70, stage: "active", notes: "Active listing." },
  { id: "s5", contactId: "c14", propertyAddress: "112 Emerald Bay", city: "Laguna Beach", estimatedValue: 8500000, expectedListPrice: 8900000, timeline: "Listed", motivation: "Estate sale", probability: 65, stage: "active", notes: "Price improvement conversation pending." },
]).run();

// ── Properties ────────────────────────────────────────────────────────────
const props: (typeof s.properties.$inferInsert)[] = [
  { id: "p1", address: "14 Shoreline Drive", city: "Newport Coast", zip: "92657", beds: 5, baths: 5.5, sqft: 4800, lotSqft: 9800, propertyType: "Single Family", yearBuilt: 2015, view: "Ocean view, Catalina, city lights", notes: "Contemporary; office; pool; 3-car garage" },
  { id: "p2", address: "8 Coral Ridge", city: "Laguna Niguel", zip: "92677", beds: 4, baths: 3.5, sqft: 3100, lotSqft: 7200, propertyType: "Single Family", yearBuilt: 2004, view: "Canyon and peek ocean view", notes: "Walkable to Salt Creek trail; updated kitchen" },
  { id: "p3", address: "112 Emerald Bay", city: "Laguna Beach", zip: "92651", beds: 6, baths: 6.5, sqft: 6200, lotSqft: 12000, propertyType: "Single Family", yearBuilt: 1998, view: "Panoramic ocean view", notes: "Guard-gated; private beach; pool; office; wine room" },
  { id: "p4", address: "123 Emerald Bay", city: "Laguna Beach", zip: "92651", beds: 4, baths: 4, sqft: 3900, lotSqft: 8000, propertyType: "Single Family", yearBuilt: 2008, view: "Ocean view", notes: "In escrow" },
  { id: "p5", address: "45 Crestview Drive", city: "Newport Beach", zip: "92660", beds: 4, baths: 3.5, sqft: 3400, lotSqft: 7800, propertyType: "Single Family", yearBuilt: 2001, view: "Back bay", notes: "In escrow" },
  { id: "p6", address: "7 Coral Ridge", city: "Laguna Niguel", zip: "92677", beds: 4, baths: 3, sqft: 2900, lotSqft: 6900, propertyType: "Single Family", yearBuilt: 2002, view: "Hills", notes: "In escrow" },
  { id: "p7", address: "31 Shady Canyon Dr", city: "Irvine", zip: "92603", beds: 5, baths: 5.5, sqft: 5200, lotSqft: 14000, propertyType: "Single Family", yearBuilt: 2006, view: "Golf course", notes: "Coming soon; Tuscan; pool" },
  { id: "p8", address: "1929 Port Bristol Cir", city: "Newport Beach", zip: "92660", beds: 4, baths: 3, sqft: 2600, lotSqft: 6500, propertyType: "Single Family", yearBuilt: 1972, view: "None", notes: "Closed — Port Streets; walkable" },
  { id: "p9", address: "24 Sea Terrace", city: "Dana Point", zip: "92629", beds: 3, baths: 3, sqft: 2400, lotSqft: 0, propertyType: "Condo", yearBuilt: 2010, view: "Ocean view", notes: "Closed — Monarch Beach" },
  { id: "p10", address: "5 Turtle Rock Ln", city: "Irvine", zip: "92603", beds: 4, baths: 3, sqft: 2900, lotSqft: 7000, propertyType: "Single Family", yearBuilt: 1990, view: "Hills" },
  { id: "p11", address: "16702 Baruna Ln", city: "Huntington Beach", zip: "92649", beds: 4, baths: 4, sqft: 3600, lotSqft: 6000, propertyType: "Single Family", yearBuilt: 1995, view: "Harbor; boat dock" },
  { id: "p12", address: "2 Rue Fontaine", city: "Newport Beach", zip: "92660", beds: 5, baths: 4.5, sqft: 4100, lotSqft: 9000, propertyType: "Single Family", yearBuilt: 1999, view: "Big Canyon golf" },
  { id: "p13", address: "27 Marbella", city: "San Clemente", zip: "92673", beds: 4, baths: 3.5, sqft: 3300, lotSqft: 8500, propertyType: "Single Family", yearBuilt: 2003, view: "Ocean view" },
  { id: "p14", address: "3 Vista Luci", city: "Newport Coast", zip: "92657", beds: 4, baths: 4.5, sqft: 3700, lotSqft: 8200, propertyType: "Single Family", yearBuilt: 2003, view: "Ocean and canyon" },
  { id: "p15", address: "1010 Dolphin Terrace", city: "Corona del Mar", zip: "92625", beds: 3, baths: 3, sqft: 2300, lotSqft: 5000, propertyType: "Single Family", yearBuilt: 1965, view: "Harbor view" },
  { id: "p16", address: "19 Lemon Heights Dr", city: "North Tustin", zip: "92705", beds: 5, baths: 4, sqft: 3900, lotSqft: 24000, propertyType: "Single Family", yearBuilt: 1988, view: "City lights", notes: "Flat lot; pool; in-law suite" },
  { id: "p17", address: "6 Cameo Highlands Dr", city: "Corona del Mar", zip: "92625", beds: 4, baths: 3.5, sqft: 2800, lotSqft: 6200, propertyType: "Single Family", yearBuilt: 1980, view: "Ocean view" },
  { id: "p18", address: "11 Pelican Crest Dr", city: "Newport Coast", zip: "92657", beds: 6, baths: 7, sqft: 7800, lotSqft: 20000, propertyType: "Single Family", yearBuilt: 2004, view: "Ocean view", notes: "Closed — Pelican Crest" },
];
db.insert(s.properties).values(props).run();

// ── Listings ──────────────────────────────────────────────────────────────
db.insert(s.listings).values([
  { id: "l1", propertyId: "p1", sellerContactId: "c10", listPrice: 6950000, status: "active", listedAt: d(-12), showings: 9, offers: 0, openHouses: 1, commissionPct: 2.5, nextAction: "Broker preview Thursday; weekly report Friday", notes: "Contemporary with office, pool, ocean view" },
  { id: "l2", propertyId: "p2", sellerContactId: "c11", listPrice: 3750000, status: "in_negotiation", listedAt: d(-8), showings: 14, offers: 1, openHouses: 2, commissionPct: 2.5, nextAction: "Counter Pickford offer at $3.65M", notes: "Walkable; canyon view" },
  { id: "l3", propertyId: "p3", sellerContactId: "c14", listPrice: 8900000, status: "price_improvement", listedAt: d(-25), showings: 6, offers: 0, openHouses: 1, commissionPct: 2.5, nextAction: "Discuss $8.5M price improvement", notes: "Ocean view; pool; office; guard-gated" },
  { id: "l4", propertyId: "p7", sellerContactId: null, listPrice: 5495000, status: "coming_soon", listedAt: d(4), showings: 0, offers: 0, openHouses: 0, commissionPct: 2.5, nextAction: "Photos Wednesday; launch Friday", notes: "Golf course; pool" },
  { id: "l5", propertyId: "p14", sellerContactId: null, listPrice: 4650000, status: "off_market", listedAt: null, showings: 2, offers: 0, openHouses: 0, commissionPct: 2.5, nextAction: "Quiet showings only", notes: "Ocean and canyon view; office; pool" },
  { id: "l6", propertyId: "p4", sellerContactId: "c8", listPrice: 4250000, status: "in_escrow", listedAt: d(-60), showings: 18, offers: 3, openHouses: 3, commissionPct: 2.5, nextAction: "Appraisal", notes: "" },
  { id: "l7", propertyId: "p6", sellerContactId: "c9", listPrice: 2850000, status: "in_escrow", listedAt: d(-45), showings: 11, offers: 2, openHouses: 2, commissionPct: 2.5, nextAction: "Repair request response", notes: "" },
  { id: "l8", propertyId: "p8", sellerContactId: null, listPrice: 2950000, status: "closed", listedAt: closedOn(2, 1), showings: 20, offers: 4, openHouses: 3, commissionPct: 2.5, nextAction: null, notes: "" },
  { id: "l9", propertyId: "p18", sellerContactId: null, listPrice: 12500000, status: "withdrawn", listedAt: `${Y - 1}-06-01`, showings: 3, offers: 0, openHouses: 0, commissionPct: 2.5, nextAction: null, notes: "Withdrawn last year; owner may re-list." },
]).run();

// ── Transactions: 11 closed YTD + 5 in escrow ─────────────────────────────
type T = typeof s.transactions.$inferInsert;
const closed: T[] = [
  { id: "t1", propertyId: "p8", listingId: "l8", contactId: "c4", side: "seller", status: "closed", purchasePrice: 1650000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 1800, leadSource: "sphere", escrowOpenedAt: closedOn(1, 5), closingDate: closedOn(2, 6), closedAt: closedOn(2, 6) },
  { id: "t2", propertyId: "p10", contactId: "c15", side: "buyer", status: "closed", purchasePrice: 1200000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 600, leadSource: "referral", escrowOpenedAt: closedOn(1, 18), closingDate: closedOn(2, 20), closedAt: closedOn(2, 20) },
  { id: "t3", propertyId: "p9", contactId: "c22", side: "buyer", status: "closed", purchasePrice: 1100000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 400, leadSource: "open_house", escrowOpenedAt: closedOn(2, 1), closingDate: closedOn(3, 4), closedAt: closedOn(3, 4) },
  { id: "t4", propertyId: "p11", contactId: "c16", side: "buyer", status: "closed", purchasePrice: 2100000, commissionPct: 2.5, referralFee: 20000, brokerSplitPct: 68, expenses: 900, leadSource: "zillow", escrowOpenedAt: closedOn(2, 14), closingDate: closedOn(3, 18), closedAt: closedOn(3, 18) },
  { id: "t5", propertyId: "p12", contactId: null, side: "seller", status: "closed", purchasePrice: 1950000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 2400, leadSource: "past_client", escrowOpenedAt: closedOn(3, 1), closingDate: closedOn(3, 29), closedAt: closedOn(3, 29) },
  { id: "t6", propertyId: "p7", contactId: "c21", side: "buyer", status: "closed", purchasePrice: 2400000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 1200, leadSource: "past_client", escrowOpenedAt: closedOn(3, 10), closingDate: closedOn(4, 12), closedAt: closedOn(4, 12) },
  { id: "t7", propertyId: "p13", contactId: null, side: "seller", status: "closed", purchasePrice: 1350000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 1500, leadSource: "instagram", escrowOpenedAt: closedOn(3, 22), closingDate: closedOn(4, 25), closedAt: closedOn(4, 25) },
  { id: "t8", propertyId: "p15", contactId: null, side: "both", status: "closed", purchasePrice: 1500000, commissionPct: 4.5, referralFee: 0, brokerSplitPct: 68, expenses: 2000, leadSource: "referral", escrowOpenedAt: closedOn(4, 3), closingDate: closedOn(5, 2), closedAt: closedOn(5, 2) },
  { id: "t9", propertyId: "p16", contactId: null, side: "buyer", status: "closed", purchasePrice: 1300000, commissionPct: 2.5, referralFee: 15300, brokerSplitPct: 68, expenses: 500, leadSource: "agent_referral", escrowOpenedAt: closedOn(4, 15), closingDate: closedOn(5, 20), closedAt: closedOn(5, 20) },
  { id: "t10", propertyId: "p17", contactId: null, side: "seller", status: "closed", purchasePrice: 1850000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 2100, leadSource: "sphere", escrowOpenedAt: closedOn(5, 1), closingDate: closedOn(6, 3), closedAt: closedOn(6, 3) },
  { id: "t11", propertyId: "p18", contactId: null, side: "buyer", status: "closed", purchasePrice: 2050000, commissionPct: 2, referralFee: 0, brokerSplitPct: 68, expenses: 3200, leadSource: "website", escrowOpenedAt: closedOn(5, 12), closingDate: closedOn(6, 24), closedAt: closedOn(6, 24) },
];
const escrows: T[] = [
  { id: "e1", propertyId: "p4", listingId: "l6", contactId: "c8", side: "seller", status: "escrow", purchasePrice: 4250000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 1800, leadSource: "referral", escrowOpenedAt: d(-16), closingDate: d(14), notes: "Buyer financing with First Republic; appraisal this week." },
  { id: "e2", propertyId: "p5", contactId: "c4", side: "buyer", status: "escrow", purchasePrice: 3100000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 800, leadSource: "past_client", escrowOpenedAt: d(-8), closingDate: d(22), notes: "Michael's investment purchase." },
  { id: "e3", propertyId: "p6", listingId: "l7", contactId: "c9", side: "seller", status: "escrow", purchasePrice: 2850000, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 1400, leadSource: "sphere", escrowOpenedAt: d(-1), closingDate: d(29), notes: "" },
];
const lastYear: T[] = [1450000, 1250000, 1900000, 1100000, 2200000, 1650000, 1300000, 1750000, 1400000].map((price, i) => ({ id: `ly${i + 1}`, propertyId: ["p8", "p9", "p10", "p11", "p12", "p13", "p15", "p16", "p17"][i], contactId: null, side: i % 3 === 0 ? "seller" : "buyer", status: "closed", purchasePrice: price, commissionPct: 2.5, referralFee: 0, brokerSplitPct: 68, expenses: 1200, leadSource: ["referral", "sphere", "zillow"][i % 3], escrowOpenedAt: `${Y - 1}-${String(i + 1).padStart(2, "0")}-05`, closingDate: `${Y - 1}-${String(i + 1).padStart(2, "0")}-28`, closedAt: `${Y - 1}-${String(i + 1).padStart(2, "0")}-28` }));
db.insert(s.transactions).values([...closed, ...escrows, ...lastYear]).run();

// Milestones for escrows with realistic due dates (some within 72h).
const ms = (tx: string, plan: [string, number, boolean][]) => plan.forEach(([name, off, done], i) => db.insert(s.milestones).values({ transactionId: tx, name, dueDate: d(off), completedAt: done ? iso(off) : null, sortOrder: i }).run());
ms("e1", [["Offer Accepted", -16, true], ["Deposit Due", -13, true], ["Seller Disclosures", -10, true], ["Inspection", -6, true], ["Repair Requests", -2, true], ["Inspection Contingency", 1, false], ["Appraisal", 2, false], ["Loan Contingency", 5, false], ["Contingency Removal", 6, false], ["Final Walkthrough", 12, false], ["Closing", 14, false]]);
ms("e2", [["Offer Accepted", -8, true], ["Deposit Due", -5, true], ["Seller Disclosures", -3, true], ["Inspection", 0, false], ["Appraisal", 4, false], ["Repair Requests", 5, false], ["Inspection Contingency", 9, false], ["Loan Contingency", 13, false], ["Contingency Removal", 14, false], ["Final Walkthrough", 20, false], ["Closing", 22, false]]);
ms("e3", [["Offer Accepted", -1, true], ["Deposit Due", 2, false], ["Seller Disclosures", 5, false], ["Inspection", 7, false], ["Appraisal", 10, false], ["Repair Requests", 12, false], ["Inspection Contingency", 16, false], ["Loan Contingency", 20, false], ["Contingency Removal", 21, false], ["Final Walkthrough", 27, false], ["Closing", 29, false]]);

// ── Offers ────────────────────────────────────────────────────────────────
db.insert(s.offers).values([
  { id: "o1", contactId: "c2", propertyId: "p2", listPrice: 3750000, offerPrice: 3550000, submittedAt: d(-2), sellerCounter: 3650000, currentOffer: 3550000, financing: "Conventional, 30% down", downPayment: 1065000, closingTimeline: "30 days", contingencies: ["Inspection 10d", "Appraisal", "Loan 17d"], status: "countered", notes: "Seller countered at $3.65M. James wants to hold at $3.6M." },
  { id: "o2", contactId: "c5", propertyId: "p3", listPrice: 8900000, offerPrice: 8200000, submittedAt: d(-30), sellerCounter: null, currentOffer: 8200000, financing: "Conventional", downPayment: 2460000, closingTimeline: "45 days", contingencies: ["Inspection", "Appraisal", "Loan"], status: "rejected", notes: "Too far below list; seller not ready to move." },
  { id: "o3", contactId: "c1", propertyId: "p14", listPrice: 4650000, offerPrice: 4500000, submittedAt: null, sellerCounter: null, currentOffer: 4500000, financing: "Conventional (jumbo)", downPayment: 1350000, closingTimeline: "30 days", contingencies: ["Inspection 7d", "Loan 21d"], status: "preparing", notes: "Drafting after Saturday's second showing." },
  { id: "o4", contactId: "c4", propertyId: "p5", listPrice: 3195000, offerPrice: 3050000, submittedAt: d(-12), sellerCounter: 3100000, currentOffer: 3100000, financing: "Cash", downPayment: 3100000, closingTimeline: "21 days", contingencies: ["Inspection 7d"], status: "accepted", notes: "Accepted at $3.1M." },
]).run();

// ── Tasks ─────────────────────────────────────────────────────────────────
db.insert(s.tasks).values([
  { id: "k1", title: "Follow up with James and review offer strategy", category: "buyer", priority: "critical", dueDate: d(0), dueTime: "09:00", contactId: "c2", propertyId: "p2", recurrence: "none", sortOrder: 0, notes: "Seller counter at $3.65M — decide on $3.6M or hold." },
  { id: "k2", title: "Inspection contingency due — 123 Emerald Bay", category: "escrow", priority: "critical", dueDate: d(1), dueTime: "17:00", contactId: "c8", propertyId: "p4", transactionId: "e1", recurrence: "none", sortOrder: 1 },
  { id: "k3", title: "Call Sarah Thompson (hot buyer) — Pelican Hill listing", category: "client_follow_up", priority: "high", dueDate: d(0), dueTime: "11:00", contactId: "c1", recurrence: "none", sortOrder: 2 },
  { id: "k4", title: "Listing appointment prep — Wilson, 18 Monarch Bay", category: "listing", priority: "high", dueDate: d(0), dueTime: "12:00", contactId: "c3", recurrence: "none", sortOrder: 3, notes: "CMA, Concierge proposal, marketing plan." },
  { id: "k5", title: "Follow up on 2 new leads (Nguyen, Hayes)", category: "prospecting", priority: "medium", dueDate: d(0), dueTime: "14:00", recurrence: "none", sortOrder: 4 },
  { id: "k6", title: "Review and sign seller disclosures — 7 Coral Ridge", category: "escrow", priority: "low", dueDate: d(0), dueTime: "15:30", contactId: "c9", transactionId: "e3", recurrence: "none", sortOrder: 5 },
  { id: "k7", title: "Send weekly showing report to Daniel Kim", category: "listing", priority: "medium", dueDate: d(2), dueTime: "10:00", contactId: "c10", propertyId: "p1", recurrence: "weekly", sortOrder: 6 },
  { id: "k8", title: "Order photography — 31 Shady Canyon", category: "marketing", priority: "high", dueDate: d(-2), dueTime: "09:00", propertyId: "p7", recurrence: "none", sortOrder: 7, notes: "Overdue — confirm with photographer." },
  { id: "k9", title: "Quarterly check-in call list (past clients)", category: "client_follow_up", priority: "medium", dueDate: d(3), recurrence: "monthly", sortOrder: 8 },
  { id: "k10", title: "Post 14 Shoreline reel", category: "marketing", priority: "low", dueDate: d(1), recurrence: "none", propertyId: "p1", sortOrder: 9 },
  { id: "k11", title: "Renew E&O insurance", category: "administrative", priority: "low", dueDate: d(10), recurrence: "none", sortOrder: 10 },
  { id: "k12", title: "Broker preview — 14 Shoreline", category: "listing", priority: "medium", dueDate: d(2), dueTime: "11:00", propertyId: "p1", recurrence: "none", sortOrder: 11 },
  { id: "k13", title: "Send CdM flower-street options to James", category: "buyer", priority: "medium", dueDate: d(-1), contactId: "c2", recurrence: "none", sortOrder: 12 },
  { id: "k14", title: "Prep buyer consultation — Hayes", category: "buyer", priority: "medium", dueDate: d(1), dueTime: "09:00", contactId: "c20", recurrence: "none", sortOrder: 13 },
  { id: "k15", title: "Update CRM notes from open house", category: "administrative", priority: "low", dueDate: d(-3), recurrence: "none", sortOrder: 14, completedAt: iso(-3, 18) },
  { id: "k16", title: "Gym", category: "personal", priority: "low", dueDate: d(0), dueTime: "06:30", recurrence: "daily", sortOrder: 15, completedAt: iso(0, 7) },
]).run();

// ── Calls (today) ─────────────────────────────────────────────────────────
db.insert(s.calls).values([
  { id: "ca1", contactId: "c1", scheduledDate: d(0), scheduledTime: "09:00", priority: "high", reason: "New Pelican Hill listing; schedule showing", status: "scheduled" },
  { id: "ca2", contactId: "c2", scheduledDate: d(0), scheduledTime: "09:30", priority: "high", reason: "Offer strategy on 8 Coral Ridge", status: "scheduled" },
  { id: "ca3", contactId: "c3", scheduledDate: d(0), scheduledTime: "13:30", priority: "medium", reason: "Confirm listing appointment", status: "scheduled" },
  { id: "ca4", contactId: "c4", scheduledDate: d(0), scheduledTime: "17:00", priority: "medium", reason: "Escrow update on Crestview", status: "scheduled" },
  { id: "ca5", contactId: "c5", scheduledDate: d(0), scheduledTime: "10:15", priority: "high", reason: "Saturday tour plan", status: "scheduled" },
  { id: "ca6", contactId: "c7", scheduledDate: d(0), scheduledTime: "14:00", priority: "medium", reason: "Intro call — website lead", status: "scheduled" },
  { id: "ca7", contactId: "c20", scheduledDate: d(0), scheduledTime: "14:30", priority: "medium", reason: "Intro call — agent referral", status: "scheduled" },
  { id: "ca8", contactId: "c8", scheduledDate: d(0), scheduledTime: "08:30", priority: "high", reason: "Appraisal scheduling", status: "completed", completedAt: iso(0, 8), outcome: "Appraisal set for Thursday" },
  { id: "ca9", contactId: "c10", scheduledDate: d(0), scheduledTime: "08:45", priority: "medium", reason: "Broker preview logistics", status: "completed", completedAt: iso(0, 8), outcome: "Confirmed Thursday 11am" },
  { id: "ca10", contactId: "c11", scheduledDate: d(0), scheduledTime: "09:15", priority: "high", reason: "Counter strategy", status: "completed", completedAt: iso(0, 9), outcome: "Will accept 3.6M with 21-day close" },
  { id: "ca11", contactId: "c17", scheduledDate: d(0), scheduledTime: "10:00", priority: "low", reason: "Pocket listing on Blue Lagoon", status: "completed", completedAt: iso(0, 10), outcome: "Seller may take 2.5M" },
  { id: "ca12", contactId: "c9", scheduledDate: d(0), scheduledTime: "10:30", priority: "medium", reason: "Disclosures walkthrough", status: "completed", completedAt: iso(0, 10), outcome: "Signing tonight" },
  { id: "ca13", contactId: "c18", scheduledDate: d(0), scheduledTime: "11:30", priority: "low", reason: "Staging quote for Monarch Bay", status: "completed", completedAt: iso(0, 11), outcome: "Quote by Friday" },
  { id: "ca14", contactId: "c15", scheduledDate: d(0), scheduledTime: "12:00", priority: "low", reason: "Anniversary check-in", status: "completed", completedAt: iso(0, 12), outcome: "Loves the house; may refer a colleague" },
  { id: "ca15", contactId: "c6", scheduledDate: d(1), scheduledTime: "10:00", priority: "medium", reason: "New Cowan Heights listing", status: "scheduled" },
]).run();

// ── Appointments ──────────────────────────────────────────────────────────
db.insert(s.appointments).values([
  { id: "a1", title: "Buyer Consultation — Hayes", type: "buyer_consultation", startsAt: at(0, 10), endsAt: at(0, 11), location: "The Park, Newport Beach", contactId: "c20" },
  { id: "a2", title: "Property Showing — 14 Shoreline Drive", type: "showing", startsAt: at(0, 12, 30), endsAt: at(0, 13, 15), location: "14 Shoreline Drive, Newport Coast", contactId: "c1", propertyId: "p1" },
  { id: "a3", title: "Listing Appointment — Wilson", type: "listing_appointment", startsAt: at(0, 15), endsAt: at(0, 16, 30), location: "18 Monarch Bay Dr, Laguna Niguel", contactId: "c3" },
  { id: "a4", title: "Follow-Up Call — Michael Harris", type: "client_follow_up", startsAt: at(0, 17), endsAt: at(0, 17, 30), location: "Phone", contactId: "c4" },
  { id: "a5", title: "Inspection — 45 Crestview Drive", type: "inspection", startsAt: at(1, 9), endsAt: at(1, 12), location: "45 Crestview Drive, Newport Beach", contactId: "c4", propertyId: "p5", transactionId: "e2" },
  { id: "a6", title: "Appraisal — 123 Emerald Bay", type: "appraisal", startsAt: at(2, 10), endsAt: at(2, 11), location: "123 Emerald Bay", contactId: "c8", propertyId: "p4", transactionId: "e1" },
  { id: "a7", title: "Broker Preview — 14 Shoreline", type: "open_house", startsAt: at(2, 11), endsAt: at(2, 13), location: "14 Shoreline Drive", propertyId: "p1" },
  { id: "a8", title: "Tour — Johnsons (Emerald Bay + Three Arch)", type: "showing", startsAt: at(4, 10), endsAt: at(4, 13), location: "Laguna Beach", contactId: "c5", propertyId: "p3" },
  { id: "a9", title: "Open House — 8 Coral Ridge", type: "open_house", startsAt: at(5, 13), endsAt: at(5, 16), location: "8 Coral Ridge, Laguna Niguel", propertyId: "p2" },
  { id: "a10", title: "Final Walkthrough — 123 Emerald Bay", type: "final_walkthrough", startsAt: at(12, 16), endsAt: at(12, 17), location: "123 Emerald Bay", contactId: "c8", propertyId: "p4", transactionId: "e1" },
  { id: "a11", title: "Closing — 123 Emerald Bay", type: "closing", startsAt: at(14, 10), endsAt: at(14, 11), location: "Escrow office", contactId: "c8", propertyId: "p4", transactionId: "e1" },
  { id: "a12", title: "Pilates", type: "personal", startsAt: at(1, 7), endsAt: at(1, 8), location: "Studio" },
  { id: "a13", title: "Team meeting", type: "personal", startsAt: at(-1, 9), endsAt: at(-1, 10), location: "Compass office" },
  { id: "a14", title: "Showing — 3 Vista Luci (2nd look)", type: "showing", startsAt: at(-1, 14), endsAt: at(-1, 15), location: "3 Vista Luci", contactId: "c1", propertyId: "p14" },
]).run();

// ── Notes ─────────────────────────────────────────────────────────────────
db.insert(s.notes).values([
  { id: "n1", body: "Seller at 1 Pelican Hill may list in October. Wants off-market first — prepare a private-exclusive plan.", contactId: "c12", pinned: true, createdAt: iso(-20) },
  { id: "n2", body: "Sarah loves ocean views but doesn't want an interior courtyard. Husband needs a real office, not a nook.", contactId: "c1", pinned: true, createdAt: iso(-6) },
  { id: "n3", body: "Alexis says the seller at 9 Blue Lagoon may take $2.5M if quiet. Possible fit for the Johnsons.", contactId: "c17", createdAt: iso(0, 10) },
  { id: "n4", body: "Laura will accept $3.6M with a 21-day close. Do not go lower.", contactId: "c11", propertyId: "p2", createdAt: iso(0, 9) },
  { id: "n5", body: "Appraiser: Thursday 10am. Buyer's lender is First Republic — expect a 5-day turnaround.", contactId: "c8", transactionId: "e1", createdAt: iso(0, 8) },
  { id: "n6", body: "Olivia mentioned her parents' Big Canyon house (2 Rue-style, 5 bd) may sell next spring. Soft touch at the holidays.", contactId: "c19", createdAt: iso(-45) },
  { id: "n7", body: "Michael wants Crestview as a rental. Ask about property management referral at closing.", contactId: "c4", transactionId: "e2", createdAt: iso(-8) },
  { id: "n8", body: "Daniel wants weekly data: showings, web views, saves. Friday morning cadence.", contactId: "c10", propertyId: "p1", createdAt: iso(-12) },
  { id: "n9", body: "Thomas is open to $8.5M if we present it as a 'market-aligned reposition' with fresh photography.", contactId: "c14", propertyId: "p3", createdAt: iso(-5) },
  { id: "n10", body: "Emerald Bay guard gate: register showings 24h ahead.", propertyId: "p3", createdAt: iso(-30) },
]).run();

// ── Activities ────────────────────────────────────────────────────────────
const acts: (typeof s.activities.$inferInsert)[] = [
  { contactId: "c7", type: "system", summary: "New lead added — website inquiry (Shady Canyon)", occurredAt: iso(0, 9) },
  { contactId: "c1", type: "note", summary: "Note added: ocean views, no interior courtyard", occurredAt: iso(-6, 15) },
  { contactId: "c2", type: "email", summary: "Sent offer summary and counter analysis", occurredAt: iso(0, 8) },
  { contactId: "c6", type: "task", summary: "Completed: Follow up with Mark (Cowan Heights)", occurredAt: iso(-9, 11) },
  { contactId: "c10", type: "system", summary: "14 Shoreline Drive price updated", occurredAt: iso(0, 7) },
  { contactId: "c8", type: "call", summary: "Call — appraisal scheduling: set for Thursday", occurredAt: iso(0, 8) },
  { contactId: "c11", type: "call", summary: "Call — counter strategy: will accept 3.6M with 21-day close", occurredAt: iso(0, 9) },
  { contactId: "c1", type: "showing", summary: "Showed 3 Vista Luci (second look)", occurredAt: iso(-1, 14) },
  { contactId: "c2", type: "offer", summary: "Offer submitted on 8 Coral Ridge at $3,550,000", occurredAt: iso(-2, 16) },
  { contactId: "c2", type: "offer", summary: "Seller countered at $3,650,000", occurredAt: iso(-1, 10) },
  { contactId: "c9", type: "transaction", summary: "Opened escrow on 7 Coral Ridge", occurredAt: iso(-1, 12) },
  { contactId: "c4", type: "transaction", summary: "Opened escrow on 45 Crestview Drive", occurredAt: iso(-8, 12) },
  { contactId: "c5", type: "text", summary: "Texted Saturday tour plan", occurredAt: iso(-7, 9) },
  { contactId: "c15", type: "call", summary: "Anniversary check-in call", occurredAt: iso(0, 12) },
  { contactId: "c21", type: "transaction", summary: "Closed 31 Shady Canyon Dr at $4,100,000", occurredAt: `${closedOn(4, 12)}T17:00:00.000Z` },
  { contactId: "c16", type: "transaction", summary: "Closed 16702 Baruna Ln at $3,200,000", occurredAt: `${closedOn(3, 18)}T17:00:00.000Z` },
  { contactId: "c3", type: "meeting", summary: "Coffee — discussed downsizing timeline", occurredAt: iso(-2, 10) },
  { contactId: "c14", type: "email", summary: "Sent price-improvement analysis", occurredAt: iso(-5, 16) },
];
db.insert(s.activities).values(acts).run();

// ── Opportunities ─────────────────────────────────────────────────────────
db.insert(s.opportunities).values([
  { id: "op1", address: "9 Blue Lagoon", area: "Laguna Beach", kind: "pocket_listing", expectedPrice: 2500000, beds: 3, baths: 3, sqft: 2300, propertyType: "Single Family", sourceAgent: "Alexis Grant (Compass)", contactId: "c17", status: "watching", notes: "Ocean view; seller may take 2.5M quietly." },
  { id: "op2", address: "1 Pelican Hill Cir", area: "Newport Coast", kind: "off_market", expectedPrice: 8500000, beds: 5, baths: 6, sqft: 6400, propertyType: "Single Family", sourceAgent: "Direct (owner)", contactId: "c12", status: "pursuing", notes: "Ocean view; office; pool. Owner may list in October." },
  { id: "op3", address: "2 Rue Grand Vallee", area: "Newport Beach", kind: "coming_soon", expectedPrice: 4200000, beds: 5, baths: 4.5, sqft: 4100, propertyType: "Single Family", sourceAgent: "Olivia Park (parents)", contactId: "c19", status: "watching", notes: "Big Canyon golf; next spring." },
  { id: "op4", address: "1701 Bayside Dr", area: "Corona del Mar", kind: "tear_down", expectedPrice: 3900000, beds: 3, baths: 2, sqft: 1900, propertyType: "Single Family", sourceAgent: "Public record", contactId: null, status: "new", notes: "Harbor-facing lot; walkable; builder interest." },
  { id: "op5", address: "22 Ritz Cove Dr", area: "Dana Point", kind: "investment", expectedPrice: 5800000, beds: 4, baths: 4.5, sqft: 4400, propertyType: "Single Family", sourceAgent: "Cold outreach", contactId: null, status: "new", notes: "Ocean view; guard-gated; rental history." },
]).run();

// ── Touchpoints ───────────────────────────────────────────────────────────
db.insert(s.touchpoints).values([
  { contactId: "c15", kind: "anniversary", dueDate: d(6), notes: "1-year anniversary gift — Turtle Rock" },
  { contactId: "c4", kind: "quarterly", dueDate: d(3), notes: "Golf + referral ask" },
  { contactId: "c16", kind: "home_value", dueDate: d(9), notes: "Harbour values up ~6%" },
  { contactId: "c22", kind: "holiday", dueDate: d(40), notes: "Holiday card" },
  { contactId: "c21", kind: "gift", dueDate: d(-2), notes: "Housewarming — overdue" },
  { contactId: "c19", kind: "referral_request", dueDate: d(12), notes: "Ask about parents' timeline" },
]).run();

db.insert(s.notifications).values([
  { title: "New lead: Jennifer Nguyen", body: "Website inquiry on 31 Shady Canyon. Intro call is on today's list.", kind: "info", href: "/contacts/c7", createdAt: iso(0, 9) },
  { title: "Seller countered — 8 Coral Ridge", body: "Laura Martinez countered James Pickford at $3,650,000.", kind: "warn", href: "/offers", createdAt: iso(-1, 10) },
  { title: "Inspection contingency due tomorrow", body: "123 Emerald Bay — remove or extend by 5 PM.", kind: "critical", href: "/transactions", createdAt: iso(0, 7) },
  { title: "14 Shoreline matches 2 active buyers", body: "Sarah Thompson and William Hayes match on price, area and view.", kind: "success", href: "/buyers", createdAt: iso(0, 7), readAt: iso(0, 8) },
]).run();

console.log("✔ Seeded", { contacts: contacts.length, properties: props.length, closed: closed.length, escrows: escrows.length });
sqlite.close();
