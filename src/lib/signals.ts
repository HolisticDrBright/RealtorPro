/**
 * Signal Scout: an EXPLAINABLE opportunity queue.
 *
 * Signals are derived only from agent-approved sources (FUB records, uploaded &
 * licensed MLS/public-record exports, sphere data, inbound leads). This is NOT a
 * "who will sell" predictor: `confidence` reflects DATA COMPLETENESS only, never
 * a likelihood of selling. No protected-class, demographic, credit, or health
 * data is ever used. Pure and unit-tested.
 */

export type SignalType =
  | "expired"
  | "withdrawn"
  | "price_reduction"
  | "stale_lead"
  | "anniversary"
  | "unanswered_inquiry"
  | "sphere"
  | "permit"
  | "manual";

export type SignalSourceKind = "fub" | "mls_upload" | "public_record" | "sphere" | "inbound";

export interface GeneratedSignal {
  type: SignalType;
  sourceKind: SignalSourceKind;
  sourceRef: string | null;
  sourceDate: string | null;
  reason: string;
  confidence: number;
  confidenceBasis: string;
  suggestedAction: string;
  relatedLabel: string | null;
}

const SUGGESTED_ACTION: Record<SignalType, string> = {
  expired: "Review the expired listing, then draft a re-list outreach for your approval.",
  withdrawn: "Confirm the listing status and draft a check-in — no auto-send.",
  price_reduction: "Note the reduction; consider a buyer match or a seller check-in.",
  stale_lead: "Re-engage: draft a follow-up or create a Follow Up Boss task.",
  anniversary: "Send an anniversary touch (draft only, your approval required).",
  unanswered_inquiry: "Respond to the inbound inquiry.",
  sphere: "Reconnect with this sphere contact.",
  permit: "Review the permit/public-record event; consider owner outreach.",
  manual: "Agent-defined opportunity.",
};

/** Confidence = fraction of expected fields that are present, as 0–100. */
export function computeConfidence(
  present: Record<string, unknown>,
  expectedFields: string[],
): { score: number; basis: string } {
  const have = expectedFields.filter((f) => {
    const v = present[f];
    return v !== undefined && v !== null && String(v).trim() !== "";
  });
  const score = expectedFields.length === 0 ? 0 : Math.round((have.length / expectedFields.length) * 100);
  const missing = expectedFields.filter((f) => !have.includes(f));
  const basis =
    missing.length === 0
      ? `All ${expectedFields.length} expected fields present.`
      : `${have.length}/${expectedFields.length} fields present; missing: ${missing.join(", ")}.`;
  return { score, basis };
}

// ── MLS export → listing-status signals ──────────────────────────────────────

const MLS_TYPE_MAP: Record<string, SignalType> = {
  expired: "expired",
  withdrawn: "withdrawn",
  canceled: "withdrawn",
  cancelled: "withdrawn",
  inactive: "withdrawn",
  "price reduced": "price_reduction",
  "price reduction": "price_reduction",
};

const MLS_EXPECTED = ["address", "status", "statusDate", "price", "owner"];

/**
 * Build signals from an uploaded MLS status export. Each row must carry a
 * status we recognise; unknown statuses are skipped (never invented).
 */
export function signalsFromMlsExport(rows: Record<string, string>[]): GeneratedSignal[] {
  const out: GeneratedSignal[] = [];
  for (const row of rows) {
    const statusRaw = (row.status ?? "").toLowerCase().trim();
    const type = MLS_TYPE_MAP[statusRaw];
    if (!type) continue;
    const { score, basis } = computeConfidence(row, MLS_EXPECTED);
    out.push({
      type,
      sourceKind: "mls_upload",
      sourceRef: row.mls ?? row.address ?? null,
      sourceDate: row.statusDate ?? null,
      reason:
        type === "price_reduction"
          ? `Price reduction on ${row.address ?? "an uploaded listing"} (${row.price ?? "amount not stated"}).`
          : `${cap(type)} listing: ${row.address ?? "address not stated"}.`,
      confidence: score,
      confidenceBasis: basis,
      suggestedAction: SUGGESTED_ACTION[type],
      relatedLabel: row.address ?? null,
    });
  }
  return out;
}

// ── FUB contact → relationship signals ───────────────────────────────────────

export interface ContactLike {
  id: string;
  name: string;
  lastTouchDaysAgo?: number | null;
  closedDate?: string | null; // ISO or MM/DD/YYYY
  hasUnansweredInquiry?: boolean;
  stage?: string | null;
  relationship?: string | null;
}

const STALE_LEAD_EXPECTED = ["name", "lastTouchDaysAgo", "stage"];

/** A stale-lead signal when a contact has not been touched in `thresholdDays`. */
export function staleLeadSignal(contact: ContactLike, thresholdDays = 30): GeneratedSignal | null {
  if (contact.lastTouchDaysAgo == null || contact.lastTouchDaysAgo < thresholdDays) return null;
  const { score, basis } = computeConfidence(contact as unknown as Record<string, unknown>, STALE_LEAD_EXPECTED);
  return {
    type: "stale_lead",
    sourceKind: "fub",
    sourceRef: contact.id,
    sourceDate: null,
    reason: `No contact with ${contact.name} in ${contact.lastTouchDaysAgo} days.`,
    confidence: score,
    confidenceBasis: basis,
    suggestedAction: SUGGESTED_ACTION.stale_lead,
    relatedLabel: contact.name,
  };
}

/** An anniversary signal when a past client's close date is ~1 year ago. */
export function anniversarySignal(contact: ContactLike, refDate: Date): GeneratedSignal | null {
  if (!contact.closedDate) return null;
  const closed = new Date(contact.closedDate);
  if (Number.isNaN(closed.getTime())) return null;
  const years = (refDate.getTime() - closed.getTime()) / (365.25 * 24 * 3600 * 1000);
  // Within ±21 days of a whole-year anniversary.
  const nearest = Math.round(years);
  if (nearest < 1) return null;
  const dayDelta = Math.abs(years - nearest) * 365.25;
  if (dayDelta > 21) return null;
  const { score, basis } = computeConfidence(contact as unknown as Record<string, unknown>, ["name", "closedDate"]);
  return {
    type: "anniversary",
    sourceKind: "fub",
    sourceRef: contact.id,
    sourceDate: contact.closedDate,
    reason: `${nearest}-year anniversary of ${contact.name}'s closing.`,
    confidence: score,
    confidenceBasis: basis,
    suggestedAction: SUGGESTED_ACTION.anniversary,
    relatedLabel: contact.name,
  };
}

/** An unanswered-inquiry signal for an inbound lead with no response. */
export function unansweredInquirySignal(contact: ContactLike): GeneratedSignal | null {
  if (!contact.hasUnansweredInquiry) return null;
  const { score, basis } = computeConfidence(contact as unknown as Record<string, unknown>, ["name", "hasUnansweredInquiry"]);
  return {
    type: "unanswered_inquiry",
    sourceKind: "inbound",
    sourceRef: contact.id,
    sourceDate: null,
    reason: `${contact.name} sent an inquiry that has no logged response.`,
    confidence: score,
    confidenceBasis: basis,
    suggestedAction: SUGGESTED_ACTION.unanswered_inquiry,
    relatedLabel: contact.name,
  };
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export { SUGGESTED_ACTION };
