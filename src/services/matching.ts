import "server-only";
import { eq, ne } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { matchAll, type BuyerCriteria, type Candidate } from "@/lib/match";
import { loadContext } from "./context";

/** Buyer ↔ listing/opportunity matches, optionally narrowed to one buyer or one candidate. */
export function matches(opts: { buyerId?: string; listingId?: string; opportunityId?: string }) {
  const ctx = loadContext();
  const buyersAll = db.select().from(s.buyers).where(eq(s.buyers.status, "active")).all().filter((b) => !opts.buyerId || b.id === opts.buyerId);
  const listingsAll = db.select().from(s.listings).all().filter((l) => ["active", "coming_soon", "price_improvement", "offer_received", "in_negotiation", "off_market"].includes(l.status) && (!opts.listingId || l.id === opts.listingId));
  const opps = db.select().from(s.opportunities).where(ne(s.opportunities.status, "dead")).all().filter((o) => !opts.opportunityId || o.id === opts.opportunityId);
  const criteria: BuyerCriteria[] = buyersAll.map((b) => ({ id: b.id, contactId: b.contactId, temperature: b.temperature, priceMin: b.priceMin, priceMax: b.priceMax, targetAreas: b.targetAreas ?? [], minBeds: b.minBeds, minBaths: b.minBaths, minSqft: b.minSqft, propertyType: b.propertyType, mustHaves: b.mustHaves ?? [], dealBreakers: b.dealBreakers ?? [] }));
  const candidates: Candidate[] = [
    ...(opts.opportunityId ? [] : listingsAll.map((l) => { const p = ctx.property(l.propertyId)!; return { id: l.id, kind: "listing" as const, address: p.address, area: p.city, price: l.listPrice, beds: p.beds, baths: p.baths, sqft: p.sqft, propertyType: p.propertyType, features: [p.view ?? "", p.notes ?? "", l.notes ?? ""] }; })),
    ...(opts.listingId ? [] : opps.map((o) => ({ id: o.id, kind: "opportunity" as const, address: o.address, area: o.area, price: o.expectedPrice, beds: o.beds, baths: o.baths, sqft: o.sqft, propertyType: o.propertyType, features: [o.notes ?? ""] }))),
  ];
  return matchAll(criteria, candidates).map((m) => { const c = candidates.find((x) => x.id === m.candidateId)!; const b = buyersAll.find((x) => x.id === m.buyerId)!; return { ...m, buyerName: ctx.names(m.contactId), temperature: b.temperature, address: c.address, area: c.area, price: c.price, beds: c.beds, baths: c.baths, sqft: c.sqft }; });
}
