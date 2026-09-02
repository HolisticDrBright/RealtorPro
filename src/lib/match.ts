/** Buyer ↔ property matching on objective criteria only. Pure and unit-tested. */

export interface BuyerCriteria {
  id: string;
  contactId: string;
  temperature: string;
  priceMin: number | null;
  priceMax: number | null;
  targetAreas: string[];
  minBeds: number | null;
  minBaths: number | null;
  minSqft: number | null;
  propertyType: string | null;
  mustHaves: string[];
  dealBreakers: string[];
}

export interface Candidate {
  id: string;
  kind: "listing" | "opportunity";
  address: string;
  area: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  propertyType: string | null;
  features: string[]; // free text: view, notes, must-have keywords
}

export interface MatchResult {
  buyerId: string;
  contactId: string;
  candidateId: string;
  kind: Candidate["kind"];
  score: number;
  reasons: string[];
  concerns: string[];
}

const norm = (s: string) => s.toLowerCase().trim();

export function scoreMatch(b: BuyerCriteria, c: Candidate): MatchResult | null {
  const reasons: string[] = [];
  const concerns: string[] = [];
  let score = 0;
  let max = 0;

  // Price (hard-ish): over max by >5% disqualifies.
  if (c.price != null) {
    max += 30;
    if (b.priceMax != null && c.price > b.priceMax * 1.05) return null;
    if (b.priceMax != null && c.price > b.priceMax) { score += 15; concerns.push(`Slightly over budget (${Math.round(((c.price - b.priceMax) / b.priceMax) * 100)}%)`); }
    else if (b.priceMin != null && c.price < b.priceMin) { score += 20; concerns.push("Below stated range"); }
    else { score += 30; reasons.push("Within price range"); }
  }
  // Area
  if (b.targetAreas.length) {
    max += 25;
    if (c.area && b.targetAreas.some((a) => norm(c.area!).includes(norm(a)) || norm(a).includes(norm(c.area!)))) { score += 25; reasons.push(`Target area: ${c.area}`); }
    else concerns.push(`Outside target areas${c.area ? ` (${c.area})` : ""}`);
  }
  // Beds / baths / sqft
  const dim = (label: string, want: number | null, have: number | null, w: number) => {
    if (want == null) return;
    max += w;
    if (have == null) { concerns.push(`${label} not stated`); return; }
    if (have >= want) { score += w; reasons.push(`${have} ${label} (needs ${want}+)`); }
    else concerns.push(`Only ${have} ${label} (needs ${want}+)`);
  };
  dim("bd", b.minBeds, c.beds, 12);
  dim("ba", b.minBaths, c.baths, 8);
  dim("sqft", b.minSqft, c.sqft, 10);
  // Type
  if (b.propertyType) {
    max += 5;
    if (c.propertyType && norm(c.propertyType) === norm(b.propertyType)) { score += 5; reasons.push(c.propertyType); }
    else if (c.propertyType) concerns.push(`${c.propertyType}, wants ${b.propertyType}`);
  }
  // Must-haves / deal breakers by keyword against features.
  const feat = c.features.map(norm).join(" | ");
  for (const m of b.mustHaves) {
    max += 6;
    if (feat.includes(norm(m))) { score += 6; reasons.push(`Has ${m}`); }
    else concerns.push(`Confirm: ${m}`);
  }
  for (const d of b.dealBreakers) if (feat.includes(norm(d))) return null;

  if (max === 0) return null;
  const pctScore = Math.round((score / max) * 100);
  if (pctScore < 45) return null;
  return { buyerId: b.id, contactId: b.contactId, candidateId: c.id, kind: c.kind, score: pctScore, reasons, concerns };
}

export function matchAll(buyersList: BuyerCriteria[], candidates: Candidate[]): MatchResult[] {
  const out: MatchResult[] = [];
  for (const b of buyersList) for (const c of candidates) { const r = scoreMatch(b, c); if (r) out.push(r); }
  return out.sort((a, b) => b.score - a.score);
}
