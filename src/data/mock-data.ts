/**
 * AgentOS mock data — a typed port of the design handoff's `agentos-data.js`.
 *
 * This drives the frontend's initial display exactly as the prototype did, and
 * is also the basis for the database seed (`src/db/seed.ts`) so the seeded
 * backend and the UI describe the same world. No API calls; edited freely.
 */

export type Priority = "high" | "med" | "low";
export type Severity = "high" | "med";

export interface TodayStat {
  label: string;
  value: string;
  sub: string;
}
export interface Appointment {
  time: string;
  title: string;
  who: string;
  where: string;
  type: string;
}
export interface NextAction {
  id: string;
  title: string;
  detail: string;
  due: string;
  entity: string;
  screen: string;
  contactId?: string;
  priority: Priority;
}
export interface DealRisk {
  deal: string;
  issue: string;
  age: string;
  severity: Severity;
  screen: string;
  contactId: string;
}

export interface WeightedPref {
  label: string;
  weight: number;
}
export interface Buyer {
  id: string;
  name: string;
  fubId: string;
  phone: string;
  email: string;
  lastTouch: string;
  stage: string;
  ceiling: string;
  constraints: string[];
  prefs: WeightedPref[];
  areas: string[];
  mustHaves: string[];
}

export interface MatchReason {
  text: string;
  source: string;
}
export interface Match {
  id: string;
  addr: string;
  hood: string;
  price: string;
  beds: number;
  baths: number;
  sqft: string;
  mls: string;
  score: number;
  over?: boolean;
  reasons: MatchReason[];
  tradeoffs: string[];
  verify: string | null;
}

export interface ListingFact {
  field: string;
  value: string;
  source: string;
}
export interface ListingMedia {
  id: string;
  label: string;
  authorized: boolean;
}
export interface Listing {
  id: string;
  addr: string;
  status: string;
  price: string;
  facts: ListingFact[];
  media: ListingMedia[];
}

export interface Contact {
  id: string;
  name: string;
  role: string;
  stage: string;
  next: string;
  sync: string;
  phone: string;
}
export type TimelineType =
  | "alert"
  | "note"
  | "task"
  | "showing"
  | "stage"
  | "property";
export interface TimelineEntry {
  t: string;
  type: TimelineType;
  title: string;
  body: string;
}

export interface FubPermission {
  scope: string;
  why: string;
}
export interface SyncLogEntry {
  time: string;
  dir: string;
  items: string;
  status: string;
}

export const DATA = {
  today: {
    date: "Tuesday, July 21, 2026",
    stats: [
      { label: "Appointments today", value: "3", sub: "Next at 10:30 AM" },
      { label: "Follow-ups due", value: "7", sub: "2 overdue from Monday" },
      { label: "New buyer matches", value: "5", sub: "Mehta search · imported 7:02 AM" },
      { label: "Active listings", value: "2", sub: "1 campaign in review" },
      { label: "Deal-risk alerts", value: "2", sub: "1 needs action today" },
    ] as TodayStat[],
    appointments: [
      { time: "10:30 AM", title: "Showing — 4823 SE Reedway St", who: "Jordan & Priya Mehta", where: "Meet at property", type: "Showing" },
      { time: "1:00 PM", title: "Listing photos walkthrough", who: "Alameda sellers (Tran)", where: "3117 NE Alameda St", type: "Listing" },
      { time: "4:15 PM", title: "Pre-approval check-in call", who: "Marcus & Elena Ruiz", where: "Phone", type: "Call" },
    ] as Appointment[],
    actions: [
      { id: "a1", title: "Reply to inspection addendum", detail: "Ruiz — seller countered credit at $4,500. Response due by 5 PM.", due: "Due today 5:00 PM", entity: "Marcus & Elena Ruiz", screen: "people", contactId: "c3", priority: "high" },
      { id: "a2", title: "Review 5 new matches before showing", detail: "Mehta alert import ranked 5 listings; 1 needs verification before you recommend it.", due: "Before 10:30 AM", entity: "Jordan & Priya Mehta", screen: "scout", priority: "high" },
      { id: "a3", title: "Approve Alameda MLS description", detail: "Campaign draft is ready for review — 2 of 5 assets approved.", due: "Photos go live Thursday", entity: "3117 NE Alameda St", screen: "studio", priority: "med" },
      { id: "a4", title: "Follow up: appraisal ordered?", detail: "Whitfield lender said appraisal would be ordered Friday. No confirmation in file.", due: "Overdue — Mon", entity: "Dana Whitfield", screen: "people", contactId: "c2", priority: "high" },
      { id: "a5", title: "Send Saturday open-house recap", detail: "14 sign-ins from Alameda open house not yet pushed to Follow Up Boss.", due: "Due today", entity: "3117 NE Alameda St", screen: "studio", priority: "med" },
      { id: "a6", title: "Quarterly check-in — past client", detail: "Chen closed July 2025. Anniversary touch scheduled by your nurture cadence.", due: "This week", entity: "Lin Chen", screen: "people", contactId: "c5", priority: "low" },
    ] as NextAction[],
    risks: [
      { deal: "Ruiz — 7215 N Curtis Ave", issue: "Inspection contingency expires in 2 days; addendum unanswered.", age: "Flagged 9:05 AM", severity: "high", screen: "people", contactId: "c3" },
      { deal: "Whitfield — 1150 NW Quimby #804", issue: "No appraisal confirmation 4 days after order date promised by lender.", age: "Flagged Mon", severity: "med", screen: "people", contactId: "c2" },
    ] as DealRisk[],
  },
  buyers: [
    {
      id: "b1", name: "Jordan & Priya Mehta", fubId: "FUB #48213", phone: "(503) 555-0164", email: "jordan.mehta@example.com",
      lastTouch: "Texted yesterday 6:12 PM", stage: "Active search",
      ceiling: "$700,000 (hard — pre-approval letter on file)",
      constraints: ["3+ beds, 2+ baths", "Off-street parking required", "No shared walls", "Max HOA $150/mo"],
      prefs: [
        { label: "Fenced yard (dog)", weight: 90 },
        { label: "Updated kitchen", weight: 70 },
        { label: "Garage or shop space", weight: 60 },
        { label: "Single-level living", weight: 40 },
      ],
      areas: ["Sellwood-Moreland", "Woodstock", "Mt. Tabor"],
      mustHaves: ["Dedicated office or convertible 4th room", "Off-street parking"],
    },
    {
      id: "b2", name: "Dana Whitfield", fubId: "FUB #47990", phone: "(503) 555-0119", email: "d.whitfield@example.com",
      lastTouch: "Call Monday 2:40 PM", stage: "Under contract (backup search paused)",
      ceiling: "$450,000 (hard)",
      constraints: ["Condo, 1+ bed", "In-unit laundry", "Elevator building", "Max HOA $520/mo"],
      prefs: [
        { label: "River or city view", weight: 80 },
        { label: "Deeded parking", weight: 65 },
        { label: "Gym in building", weight: 30 },
      ],
      areas: ["Pearl District", "Downtown", "South Waterfront"],
      mustHaves: ["In-unit laundry"],
    },
    {
      id: "b3", name: "Marcus & Elena Ruiz", fubId: "FUB #48122", phone: "(971) 555-0187", email: "ruiz.family@example.com",
      lastTouch: "Met Sunday — offer accepted", stage: "Pending — inspection period",
      ceiling: "$520,000 (hard)",
      constraints: ["3+ beds", "FHA-eligible condition", "Lot 4,000+ sqft"],
      prefs: [
        { label: "Near St. Johns or Kenton", weight: 85 },
        { label: "Basement or bonus space", weight: 55 },
      ],
      areas: ["St. Johns", "Kenton", "Portsmouth"],
      mustHaves: ["FHA-eligible condition"],
    },
  ] as Buyer[],
  matches: {
    b1: [
      {
        id: "p1", addr: "4823 SE Reedway St", hood: "Woodstock", price: "$674,900", beds: 3, baths: 2, sqft: "1,940", mls: "MLS #24-388102", score: 92,
        reasons: [
          { text: "List $674,900 — $25,100 under the $700k ceiling", source: "CSV: ListPrice" },
          { text: "Detached garage + driveway satisfies off-street parking", source: "CSV: ParkingFeatures" },
          { text: "Kitchen remodel 2023 with permits noted", source: "CSV: PublicRemarks" },
          { text: "Fully fenced backyard, cedar, 2021", source: "CSV: LotFeatures" },
        ],
        tradeoffs: ["4th room is a converted attic — ceiling height not stated", "Garage is detached; no interior access"],
        verify: "Square footage differs between the alert CSV (1,940) and county record (1,876). Confirm with listing agent before recommending.",
      },
      {
        id: "p2", addr: "6205 SE 21st Ave", hood: "Sellwood-Moreland", price: "$689,000", beds: 3, baths: 2.5, sqft: "2,105", mls: "MLS #24-391577", score: 88,
        reasons: [
          { text: "In Sellwood-Moreland — top drawn area", source: "CSV: Subdivision" },
          { text: "3 bed + den on main works as the required office", source: "CSV: RoomsTotal" },
          { text: "Attached garage, EV-ready panel", source: "CSV: ParkingFeatures" },
        ],
        tradeoffs: ["$11k under ceiling — little negotiation room", "Yard is partially fenced (front open)"],
        verify: null,
      },
      {
        id: "p3", addr: "2334 SE 60th Ave", hood: "Mt. Tabor", price: "$659,500", beds: 4, baths: 2, sqft: "2,290", mls: "MLS #24-385940", score: 81,
        reasons: [
          { text: "4th bedroom covers the office must-have outright", source: "CSV: BedroomsTotal" },
          { text: "Driveway + carport meets off-street parking", source: "CSV: ParkingFeatures" },
        ],
        tradeoffs: ["Kitchen original to 1978 — remodel weight (70) unmet", "Single bath on main; second bath in basement"],
        verify: null,
      },
      {
        id: "p4", addr: "7414 SE Woodstock Blvd", hood: "Woodstock", price: "$639,000", beds: 3, baths: 2, sqft: "1,760", mls: "MLS #24-390215", score: 74,
        reasons: [
          { text: "Lowest price in the set — $61k under ceiling", source: "CSV: ListPrice" },
          { text: "Fenced yard with alley-load garage", source: "CSV: LotFeatures" },
        ],
        tradeoffs: ["On Woodstock Blvd — arterial frontage", "No den/office; 3rd bedroom would have to serve"],
        verify: "Remarks mention “bonus room not in listed sqft” — ask what is and isn’t permitted.",
      },
      {
        id: "p5", addr: "815 SE Lambert St", hood: "Sellwood-Moreland", price: "$724,900", beds: 4, baths: 3, sqft: "2,410", mls: "MLS #24-392830", score: 66, over: true,
        reasons: [
          { text: "Meets every preference incl. shop + office", source: "CSV: PublicRemarks" },
        ],
        tradeoffs: ["$24,900 over the hard ceiling — excluded from recommendations unless the ceiling changes"],
        verify: null,
      },
    ],
    b2: [
      {
        id: "p6", addr: "1255 NW 9th Ave #1012", hood: "Pearl District", price: "$439,000", beds: 1, baths: 1, sqft: "842", mls: "MLS #24-389944", score: 90,
        reasons: [
          { text: "In-unit laundry (stacked, 2022 units)", source: "CSV: LaundryFeatures" },
          { text: "Deeded parking space #47 included", source: "CSV: ParkingFeatures" },
          { text: "HOA $498/mo — under the $520 max", source: "CSV: AssociationFee" },
        ],
        tradeoffs: ["10th floor, north-facing — city view, no river"],
        verify: null,
      },
      {
        id: "p7", addr: "3570 SW River Pkwy #802", hood: "South Waterfront", price: "$448,500", beds: 1, baths: 1, sqft: "815", mls: "MLS #24-390881", score: 77,
        reasons: [
          { text: "Direct river view, west-facing", source: "CSV: ViewFeatures" },
          { text: "Building gym + concierge", source: "CSV: AssociationAmenities" },
        ],
        tradeoffs: ["HOA $545/mo exceeds the $520 max — hard constraint conflict", "Parking is rented, not deeded"],
        verify: "HOA amount in the alert email ($545) conflicts with the CSV ($519). Confirm current fee with the association.",
      },
    ],
    b3: [] as Match[],
  } as Record<string, Match[]>,
  listings: [
    {
      id: "l1", addr: "3117 NE Alameda St", status: "Coming soon — photos Thursday", price: "$1,150,000",
      facts: [
        { field: "ListPrice", value: "$1,150,000", source: "MLS CSV · row 1" },
        { field: "BedroomsTotal / BathroomsTotal", value: "4 bd / 2.5 ba", source: "MLS CSV · row 1" },
        { field: "LivingArea", value: "2,860 sqft", source: "MLS CSV · row 1" },
        { field: "YearBuilt", value: "1926 (English Tudor)", source: "MLS CSV · row 1" },
        { field: "LotSizeSquareFeet", value: "6,500 sqft, corner lot", source: "MLS CSV · row 1" },
        { field: "Roof", value: "Composition, replaced 2019", source: "Seller disclosure §4" },
        { field: "HeatingCooling", value: "Gas furnace 2021 + central AC", source: "Seller disclosure §6" },
        { field: "ParkingFeatures", value: "Detached single garage + driveway", source: "MLS CSV · row 1" },
      ],
      media: [
        { id: "m1", label: "Exterior — front elevation", authorized: true },
        { id: "m2", label: "Living room — original fir floors", authorized: true },
        { id: "m3", label: "Kitchen — 2018 remodel", authorized: true },
        { id: "m4", label: "Primary suite", authorized: true },
      ],
    },
  ] as Listing[],
  campaign: {
    mls: {
      status: "Draft — needs your review",
      paras: [
        { text: "Storybook 1926 English Tudor on a 6,500 sqft corner lot in Alameda. Four bedrooms and two and a half baths across 2,860 square feet, with original fir floors, arched doorways, and a wood-burning fireplace anchoring the living room.", sources: ["CSV: BedroomsTotal", "CSV: LivingArea", "CSV: LotSizeSquareFeet", "Photo set: living room"] },
        { text: 'The 2018 kitchen remodel pairs quartz counters with a 36" range; systems are done — roof replaced 2019, gas furnace and central AC added 2021. Detached garage plus driveway parking, one block to Alameda Ridge.', sources: ["CSV: PublicRemarks", "Seller disclosure §4", "Seller disclosure §6", "CSV: ParkingFeatures"] },
      ],
    },
    social: [
      { day: "Wed", channel: "Instagram Reel", hook: "“Systems-done Tudor” — roof, furnace, AC dates on screen", asset: "Video cutdown 0:22" },
      { day: "Thu", channel: "Instagram + FB post", hook: "Photos live — 5-frame carousel, kitchen first", asset: "Carousel (5 stills)" },
      { day: "Fri", channel: "Stories", hook: "Open house countdown + Q&A sticker", asset: "Story frame ×2" },
      { day: "Sat", channel: "FB event + Stories", hook: "Open house 11–1 — corner-lot walkup shot", asset: "Event cover" },
    ],
    video: {
      format: "9:16 vertical · 0:30 · Reels + Shorts",
      beats: [
        "0:00 Corner-lot exterior push-in (stabilized walk-up)",
        "0:06 Arched entry → living room, fireplace focal",
        "0:13 Kitchen pan — hold on range + quartz",
        "0:21 Primary suite, then garden slider out",
        "0:26 End card: photos Thursday, open Sat 11–1",
      ],
      disclosure: "End card includes “Virtual twilight applied to exterior frame.”",
    },
    disclosures: [
      { asset: "Exterior hero (still)", alteration: "Virtual twilight — sky and window glow replaced", status: "Pending your approval" },
      { asset: "Living room (still)", alteration: "None — color correction only", status: "Approved" },
      { asset: "Listing video", alteration: "Virtual twilight on exterior frame; disclosed on end card", status: "Pending your approval" },
      { asset: "Flyer", alteration: "Uses approved stills only", status: "Approved" },
    ],
  },
  contacts: [
    { id: "c1", name: "Jordan & Priya Mehta", role: "Buyer", stage: "Active search", next: "Showing today 10:30 AM", sync: "Synced 9:42 AM", phone: "(503) 555-0164" },
    { id: "c2", name: "Dana Whitfield", role: "Buyer", stage: "Under contract", next: "Confirm appraisal order", sync: "Pending push (1 note)", phone: "(503) 555-0119" },
    { id: "c3", name: "Marcus & Elena Ruiz", role: "Buyer", stage: "Pending — inspection", next: "Addendum response 5 PM", sync: "Synced 9:42 AM", phone: "(971) 555-0187" },
    { id: "c4", name: "Minh & Claire Tran", role: "Seller", stage: "Listing prep", next: "Photos Thu · sign campaign", sync: "Synced 9:42 AM", phone: "(503) 555-0142" },
    { id: "c5", name: "Lin Chen", role: "Past client", stage: "Nurture", next: "Anniversary check-in", sync: "Synced 9:42 AM", phone: "(503) 555-0175" },
  ] as Contact[],
  timelines: {
    c3: [
      { t: "Today 9:05 AM", type: "alert", title: "Deal risk flagged", body: "Inspection contingency expires Thursday. Seller’s addendum (credit $4,500 vs. requested $7,200) is unanswered." },
      { t: "Yesterday 4:48 PM", type: "note", title: "Call with listing agent", body: "Seller firm on price, flexible on credit. Will consider $5,500 if we respond before Wednesday." },
      { t: "Sunday 2:15 PM", type: "showing", title: "Re-walk — 7215 N Curtis Ave", body: "Second visit with inspector’s summary in hand. Clients comfortable with furnace age if credited." },
      { t: "Sat 11:30 AM", type: "task", title: "Inspection report received", body: "Furnace at end of life, minor drainage grading, GFCI x3. Full report attached in FUB." },
      { t: "Jul 14", type: "stage", title: "Stage → Pending", body: "Offer accepted at $512,000. FHA, 21-day close, inspection 10 days." },
      { t: "Jul 12", type: "property", title: "Linked property — 7215 N Curtis Ave", body: "MLS #24-381207 · $515,000 list · St. Johns." },
    ],
    c1: [
      { t: "Today 7:02 AM", type: "alert", title: "5 new matches ranked", body: "Alert import from MLS email. Top score 92 — 4823 SE Reedway St. One needs verification." },
      { t: "Yesterday 6:12 PM", type: "note", title: "Text from Jordan", body: "“Priya’s parents visiting in Sept — a guest-usable office is now a real must.”" },
      { t: "Jul 18", type: "showing", title: "Toured 3 — Sellwood loop", body: "Passed on all three: two for parking, one for shared driveway." },
      { t: "Jul 15", type: "task", title: "Criteria updated", body: "Raised yard weight to 90 after dog adoption. Ceiling unchanged at $700k." },
    ],
    c2: [
      { t: "Mon 2:40 PM", type: "note", title: "Lender call", body: "Appraisal “ordered Friday” per lender. No confirmation number given — following up." },
      { t: "Jul 11", type: "stage", title: "Stage → Under contract", body: "1150 NW Quimby #804 at $436,000. Backup condo search paused, alerts still on." },
    ],
    c4: [
      { t: "Today 8:15 AM", type: "task", title: "Campaign draft ready", body: "Listing Studio generated the Alameda campaign — MLS copy and 2 media items await approval." },
      { t: "Jul 17", type: "note", title: "Pre-list walkthrough", body: "Agreed: paint touch-up front door, no staging needed, photos Thursday 1 PM." },
    ],
    c5: [
      { t: "Jul 8", type: "note", title: "Nurture cadence", body: "Quarterly touch due this week. Closed 7/25/25 — one-year anniversary card queued." },
    ],
  } as Record<string, TimelineEntry[]>,
  fub: {
    permissions: [
      { scope: "Read contacts, deals, tasks, notes", why: "Builds your timelines and Today queue locally." },
      { scope: "Create tasks and draft notes/emails", why: "Everything AgentOS writes back is created as a draft or task — never sent." },
      { scope: "No sending, no deleting", why: "AgentOS cannot send messages or remove anything in Follow Up Boss." },
    ] as FubPermission[],
    log: [
      { time: "9:42 AM", dir: "Pull", items: "3 contacts updated, 1 new task", status: "OK" },
      { time: "9:42 AM", dir: "Push", items: "2 draft notes, 1 task (Mehta showing)", status: "OK" },
      { time: "7:00 AM", dir: "Pull", items: "Nightly full refresh — 214 contacts", status: "OK" },
      { time: "Yesterday 6:20 PM", dir: "Push", items: "1 draft email (Whitfield)", status: "OK" },
    ] as SyncLogEntry[],
  },
};

export function draftEmail(buyer: Buyer, prop: Match) {
  return {
    subject: `${prop.addr} — worth a look before it moves`,
    body: `Hi ${buyer.name.split(" ")[0]},\n\nA new listing hit your search this morning and it scores well against what we outlined:\n\n• ${prop.addr} (${prop.hood}) — ${prop.price}, ${prop.beds} bd / ${prop.baths} ba, ${prop.sqft} sqft\n• ${prop.reasons[0].text}\n${prop.reasons[1] ? "• " + prop.reasons[1].text : ""}\n\nTradeoff to know: ${prop.tradeoffs[0]}.\n\nWant me to set up a showing this week? Thursday after 4 or Saturday morning both work on my end.\n\n— Avery`,
  };
}
