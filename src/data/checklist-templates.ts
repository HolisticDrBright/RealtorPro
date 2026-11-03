/**
 * California transaction checklist templates — the single source of the
 * checklist content. Seeded into `checklist_templates` so a brokerage can
 * later clone and edit a copy; never referenced directly by UI code.
 *
 * The checklist TRACKS and REMINDS only. It never generates, fills, or signs a
 * form, and nothing here is legal advice. Form codes are C.A.R. (California
 * Association of REALTORS®) form codes; authorities are cited so an agent can
 * verify each item against the current form library and their broker's policy.
 *
 * Content mirrors docs/CA_TRANSACTION_CHECKLIST.md (the content doc). When the
 * doc changes, change this file and bump `version`.
 */

export type Side = "listing" | "buyer";
export type ItemKind = "task" | "document";
export type Owner = "LA" | "BA" | "S" | "B" | "ESC" | "TTL" | "LDR" | "HOA" | "3P";
export type Condition =
  | "always" | "pre1978" | "hoa" | "fhsz" | "pre2010_fhsz" | "tenant"
  | "financed" | "trust_or_probate" | "seller_financing" | "buyer_must_sell"
  | "local_pos" | "short_sale" | "exchange_1031";
export type Anchor = "listing_signed" | "acceptance" | "coe" | "disclosure_delivery";

export interface DueRule { anchor: Anchor; days: number; businessDays?: boolean }

export interface TemplateItem {
  code: string;            // "TDS", "BRBC", "RPA", or "T-SELL-01" for tasks
  title: string;
  kind: ItemKind;
  owner: Owner;
  condition: Condition;
  dueRule?: DueRule;       // omit = no computed date
  formCode?: string;       // C.A.R. form code when kind === "document"
  formRev?: string;        // e.g. "12/25" — fill from the current C.A.R. library
  authority?: string;      // "Civ. Code §1102", "AB 2992", "RPA ¶7"
  notes?: string;
}

export interface TemplatePhase { key: string; name: string; order: number; items: TemplateItem[] }
export interface ChecklistTemplate { key: string; side: Side; name: string; version: string; phases: TemplatePhase[] }

export const CONDITIONS: Condition[] = ["always", "pre1978", "hoa", "fhsz", "pre2010_fhsz", "tenant", "financed", "trust_or_probate", "seller_financing", "buyer_must_sell", "local_pos", "short_sale", "exchange_1031"];
export const OWNERS: Owner[] = ["LA", "BA", "S", "B", "ESC", "TTL", "LDR", "HOA", "3P"];
export const ANCHORS: Anchor[] = ["listing_signed", "acceptance", "coe", "disclosure_delivery"];

export const CONDITION_LABELS: Record<Condition, string> = {
  always: "Always",
  pre1978: "Built before 1978",
  hoa: "HOA / common-interest development",
  fhsz: "Fire hazard severity zone",
  pre2010_fhsz: "Built before 2010 in a fire hazard severity zone",
  tenant: "Tenant in possession",
  financed: "Financed purchase",
  trust_or_probate: "Trust or probate sale",
  seller_financing: "Seller financing",
  buyer_must_sell: "Buyer must sell current home",
  local_pos: "Local point-of-sale requirements",
  short_sale: "Short sale",
  exchange_1031: "1031 exchange",
};

export const OWNER_LABELS: Record<Owner, string> = {
  LA: "Listing agent", BA: "Buyer's agent", S: "Seller", B: "Buyer", ESC: "Escrow", TTL: "Title", LDR: "Lender", HOA: "HOA / management", "3P": "Third party",
};

export const ANCHOR_LABELS: Record<Anchor, string> = {
  listing_signed: "Agreement signed", acceptance: "Acceptance", coe: "Close of escrow", disclosure_delivery: "Disclosures delivered",
};

// Shorthands keep the tables below readable.
const task = (code: string, title: string, owner: Owner, condition: Condition = "always", extra: Partial<TemplateItem> = {}): TemplateItem => ({ code, title, kind: "task", owner, condition, ...extra });
/** Document codes that are NOT C.A.R. forms (third-party, lender, escrow or title paperwork). */
const NON_CAR_CODES = new Set(["HB", "LOCAL-POS", "EXCH", "EXCH-ID", "ESCROW-INSTR", "PRELIM", "DEED", "SETTLEMENT", "PREAPPROVAL", "POF", "DEPOSIT-RCPT", "INSPECT", "APPRAISAL", "LOAN-APPROVAL", "INSURANCE", "TITLE-POLICY", "HOX", "CD", "WPA"]);
const doc = (code: string, title: string, owner: Owner, condition: Condition = "always", extra: Partial<TemplateItem> = {}): TemplateItem => ({ code, title, kind: "document", owner, condition, formCode: NON_CAR_CODES.has(code) ? undefined : code === "FHDS-HH" ? "FHDS" : code, ...extra });
const due = (anchor: Anchor, days: number, businessDays?: boolean): DueRule => (businessDays ? { anchor, days, businessDays } : { anchor, days });

// ─────────────────────────────────────────────────────────────────────────────
// Seller (listing side)
// ─────────────────────────────────────────────────────────────────────────────

export const CA_SELLER_TEMPLATE: ChecklistTemplate = {
  key: "ca-seller",
  side: "listing",
  name: "California seller (listing side)",
  version: "2026.11",
  phases: [
    {
      key: "prelisting",
      name: "Pre-listing",
      order: 1,
      items: [
        task("T-SELL-01", "Listing consultation: confirm who holds title and signing authority (vesting, trust, probate)", "LA"),
        task("T-SELL-02", "Order preliminary title report / property profile", "LA", "always", { notes: "Title company pulls vesting, liens, easements." }),
        task("T-SELL-03", "Identify the HOA and start the document request", "LA", "hoa", { authority: "Civ. Code §4525" }),
        task("T-SELL-04", "Recommend pre-listing inspections (general, termite, sewer, roof)", "LA"),
        task("T-SELL-05", "Pricing analysis, photography, staging and marketing plan approved by seller", "LA"),
        task("T-SELL-06", "MLS input and Clear Cooperation timing confirmed with broker", "LA", "always", { notes: "Public marketing starts the MLS clock." }),
        task("T-SELL-07", "Confirm tenant occupancy, lease terms and notice requirements", "LA", "tenant"),
        task("T-SELL-08", "Collect trust certification or probate authority documents", "LA", "trust_or_probate", { authority: "Prob. Code §18100.5" }),
        task("T-SELL-09", "Identify local point-of-sale requirements (city report, sewer lateral, retrofits)", "LA", "local_pos"),
        task("T-SELL-10", "Listing agreement signed; copy delivered to seller and broker file", "LA", "always", { dueRule: due("listing_signed", 0) }),
        doc("AD", "Disclosure Regarding Real Estate Agency Relationship", "LA", "always", { authority: "Civ. Code §2079.14" }),
        doc("PRBS", "Possible Representation of More Than One Buyer or Seller", "LA", "always", { authority: "Civ. Code §2079.14" }),
        doc("RLA", "Residential Listing Agreement", "S", "always", { authority: "Bus. & Prof. Code §10176" }),
        doc("SA", "Seller's Advisory", "S"),
        doc("FHDA", "Fair Housing and Discrimination Advisory", "S", "always", { authority: "Gov. Code §12955" }),
        doc("CCPA", "California Consumer Privacy Act Advisory", "S", "always", { authority: "Civ. Code §1798.100" }),
        doc("WFA", "Wire Fraud and Electronic Funds Transfer Advisory", "S"),
        doc("PA", "Probate Advisory", "S", "trust_or_probate", { authority: "Prob. Code §10300" }),
      ],
    },
    {
      key: "disclosures",
      name: "Disclosure packet",
      order: 2,
      items: [
        task("T-SELL-11", "Seller completes the disclosure packet in their own words; agent reviews for completeness only", "S", "always", { notes: "Agent never fills in answers for the seller." }),
        task("T-SELL-12", "Order the Natural Hazard Disclosure report", "LA", "always", { authority: "Civ. Code §1103" }),
        task("T-SELL-13", "Agent visual inspection completed and written up", "LA", "always", { authority: "Civ. Code §2079" }),
        task("T-SELL-14", "Request HOA documents from the association or manager", "LA", "hoa", { authority: "Civ. Code §4525" }),
        task("T-SELL-15", "Obtain tenant estoppel certificate", "LA", "tenant"),
        task("T-SELL-16", "Gather fire hardening and defensible space documentation", "S", "fhsz", { authority: "Civ. Code §1102.19; Gov. Code §51182" }),
        task("T-SELL-17", "Order local point-of-sale reports and inspections", "LA", "local_pos"),
        doc("TDS", "Real Estate Transfer Disclosure Statement", "S", "always", { authority: "Civ. Code §1102" }),
        doc("SPQ", "Seller Property Questionnaire", "S", "always", { authority: "Civ. Code §1102" }),
        doc("NHD", "Natural Hazard Disclosure Statement", "3P", "always", { authority: "Civ. Code §1103" }),
        doc("AVID", "Agent Visual Inspection Disclosure", "LA", "always", { authority: "Civ. Code §2079" }),
        doc("FLD", "Lead-Based Paint and Lead-Based Paint Hazards Disclosure", "S", "pre1978", { authority: "42 U.S.C. §4852d; 24 C.F.R. Part 35" }),
        doc("WHSD", "Water Heater and Smoke Detector Statement of Compliance", "S", "always", { authority: "Health & Saf. Code §§13113.8, 19211" }),
        doc("WCMD", "Water-Conserving Plumbing Fixtures and Carbon Monoxide Detector Notice", "S", "always", { authority: "Civ. Code §1101.4; Health & Saf. Code §17926" }),
        doc("SBSA", "Statewide Buyer and Seller Advisory", "S"),
        doc("HB", "Combined Hazards Book (earthquake, environmental, lead) — receipt", "S", "always", { authority: "Civ. Code §2079.7", notes: "Booklet receipt; no form code." }),
        doc("ESD", "Exempt Seller Disclosure", "S", "trust_or_probate", { authority: "Civ. Code §1102.2" }),
        doc("HOA1", "HOA Information Request", "HOA", "hoa", { authority: "Civ. Code §4525" }),
        doc("HOA2", "HOA documents and charges disclosure (received)", "HOA", "hoa", { authority: "Civ. Code §§4528, 4530" }),
        doc("FHDS", "Fire Hardening and Defensible Space Advisory, Disclosure and Addendum", "S", "fhsz", { authority: "Civ. Code §1102.19; Gov. Code §51182" }),
        doc("FHDS-HH", "Home fire hardening disclosure (homes built before 2010)", "S", "pre2010_fhsz", { authority: "Civ. Code §1102.19(a)", notes: "Section of FHDS; applies to pre-2010 construction in a high or very high fire hazard severity zone." }),
        doc("TEC", "Tenant Estoppel Certificate", "3P", "tenant"),
        doc("LOCAL-POS", "Local point-of-sale report / compliance certificate", "3P", "local_pos", { notes: "City or county residential property report, sewer lateral, retrofit certificates as applicable." }),
      ],
    },
    {
      key: "active",
      name: "Active listing, offers, acceptance",
      order: 3,
      items: [
        task("T-SELL-18", "Listing live on MLS; sign, lockbox and showing instructions in place", "LA"),
        task("T-SELL-19", "Showing feedback and activity report to seller weekly", "LA"),
        task("T-SELL-20", "Present every written offer to the seller promptly", "LA", "always", { authority: "Cal. Code Regs. tit. 10, §2785" }),
        task("T-SELL-21", "Verify buyer pre-approval and proof of funds on each offer", "LA"),
        task("T-SELL-22", "Counter offers tracked; acceptance delivered; escrow opened with the fully executed contract", "LA", "always", { dueRule: due("acceptance", 0) }),
        task("T-SELL-23", "Confirm buyer's initial deposit received by escrow", "ESC", "always", { dueRule: due("acceptance", 3, true), authority: "RPA ¶5A" }),
        doc("RPA", "California Residential Purchase Agreement and Joint Escrow Instructions", "B"),
        doc("SCO", "Seller Counter Offer (as needed)", "S"),
        doc("SMCO", "Seller Multiple Counter Offer (as needed)", "S"),
        doc("TOPA", "Tenant Occupied Property Addendum", "S", "tenant"),
        doc("SFA", "Seller Financing Addendum and Disclosure", "S", "seller_financing", { authority: "Civ. Code §§2956–2967" }),
        doc("COP", "Contingency for Sale of Buyer's Property", "B", "buyer_must_sell"),
        doc("SSA", "Short Sale Addendum", "S", "short_sale"),
        doc("SSIA", "Short Sale Information and Advisory", "S", "short_sale"),
        doc("PAA", "Probate Agreement Purchase Addendum", "S", "trust_or_probate", { authority: "Prob. Code §10308" }),
        doc("EXCH", "1031 exchange cooperation addendum", "S", "exchange_1031", { authority: "26 U.S.C. §1031", notes: "Accommodator-provided; no C.A.R. code." }),
      ],
    },
    {
      key: "escrow",
      name: "Escrow through closing",
      order: 4,
      items: [
        task("T-SELL-24", "Seller disclosures delivered to buyer (TDS, SPQ, NHD, AVID and conditional items)", "LA", "always", { dueRule: due("acceptance", 7), authority: "Civ. Code §1102.3; RPA ¶7" }),
        task("T-SELL-25", "Buyer TDS/NHD rescission window ends", "B", "always", { dueRule: due("disclosure_delivery", 5), authority: "Civ. Code §1102.3", notes: "3 days if delivered in person, 5 days if by mail or electronically — the template uses 5." }),
        task("T-SELL-26", "Provide access for buyer inspections; investigation contingency removal (CR) due", "BA", "always", { dueRule: due("acceptance", 17), authority: "RPA ¶7" }),
        task("T-SELL-27", "Appraisal access provided; appraisal contingency removal (CR) due", "BA", "financed", { dueRule: due("acceptance", 17), authority: "RPA ¶7" }),
        task("T-SELL-28", "Loan contingency removal (CR) due", "BA", "financed", { dueRule: due("acceptance", 21), authority: "RPA ¶7" }),
        task("T-SELL-29", "Review and respond to any Request for Repair", "S"),
        task("T-SELL-30", "Seller escrow package: instructions, statement of information, FIRPTA / FTB 593", "S", "always", { authority: "26 U.S.C. §1445; Rev. & Tax. Code §18662" }),
        task("T-SELL-31", "Complete agreed repairs, retrofits and termite work; deliver receipts", "S"),
        task("T-SELL-32", "Verification of Property Condition walkthrough (buyer)", "BA", "always", { dueRule: due("coe", -5), authority: "RPA ¶15" }),
        task("T-SELL-33", "Demand to Close Escrow eligible if buyer has not closed", "LA", "always", { dueRule: due("coe", -3), authority: "RPA ¶14" }),
        task("T-SELL-34", "Seller signs grant deed and closing documents with notary", "S"),
        task("T-SELL-35", "Close of escrow: confirm recording, funds disbursed, keys delivered", "ESC", "always", { dueRule: due("coe", 0) }),
        task("T-SELL-36", "Post-closing: MLS status to sold, broker file complete, Follow Up Boss updated", "LA"),
        doc("ESCROW-INSTR", "Escrow instructions and seller statement of information", "ESC"),
        doc("PRELIM", "Preliminary title report", "TTL"),
        doc("CR", "Contingency Removal (received from buyer)", "B", "always", { authority: "RPA ¶7" }),
        doc("RR", "Request for Repair (as needed)", "B"),
        doc("NBP", "Notice to Buyer to Perform (as needed)", "LA", "always", { authority: "RPA ¶14" }),
        doc("WPA", "Wood-destroying pest report and Section 1 clearance (if contracted)", "3P", "always", { authority: "Bus. & Prof. Code §8519" }),
        doc("AS", "Seller's Affidavit of Nonforeign Status and FTB Form 593", "S", "always", { authority: "26 U.S.C. §1445; Rev. & Tax. Code §18662" }),
        doc("VP", "Verification of Property Condition", "B", "always", { authority: "RPA ¶15" }),
        doc("DCE", "Demand to Close Escrow (as needed)", "LA", "always", { authority: "RPA ¶14" }),
        doc("DEED", "Grant deed (recorded)", "TTL"),
        doc("SETTLEMENT", "Final settlement statement", "ESC"),
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Buyer side
// ─────────────────────────────────────────────────────────────────────────────

export const CA_BUYER_TEMPLATE: ChecklistTemplate = {
  key: "ca-buyer",
  side: "buyer",
  name: "California buyer",
  version: "2026.11",
  phases: [
    {
      key: "representation",
      name: "Consultation, representation, financing",
      order: 1,
      items: [
        task("T-BUY-01", "Buyer consultation: needs, written criteria, agency and compensation explained", "BA"),
        task("T-BUY-02", "Buyer representation agreement signed before touring", "BA", "always", { dueRule: due("listing_signed", 0), authority: "Civ. Code §1670.50" }),
        task("T-BUY-03", "Buyer representation agreement expires — renew in writing to continue", "BA", "always", { dueRule: due("listing_signed", 90), authority: "Civ. Code §1670.50 (AB 2992)", notes: "Maximum three months; no automatic renewal." }),
        task("T-BUY-04", "Lender pre-approval obtained and reviewed", "LDR", "financed"),
        task("T-BUY-05", "Proof of funds for down payment or cash purchase collected", "B"),
        task("T-BUY-06", "Search criteria and tour plan set; wire-fraud safeguards explained", "BA"),
        task("T-BUY-07", "Timing of the buyer's current-home sale assessed", "BA", "buyer_must_sell"),
        task("T-BUY-08", "Qualified intermediary engaged before the relinquished property closes", "B", "exchange_1031", { authority: "26 U.S.C. §1031" }),
        doc("AD", "Disclosure Regarding Real Estate Agency Relationship", "BA", "always", { authority: "Civ. Code §2079.14" }),
        doc("PRBS", "Possible Representation of More Than One Buyer or Seller", "BA", "always", { authority: "Civ. Code §2079.14" }),
        doc("BRBC", "Buyer Representation and Broker Compensation Agreement", "B", "always", { authority: "Civ. Code §1670.50 (AB 2992)" }),
        doc("BIA", "Buyer's Investigation Advisory", "B"),
        doc("FHDA", "Fair Housing and Discrimination Advisory", "B", "always", { authority: "Gov. Code §12955" }),
        doc("CCPA", "California Consumer Privacy Act Advisory", "B", "always", { authority: "Civ. Code §1798.100" }),
        doc("WFA", "Wire Fraud and Electronic Funds Transfer Advisory", "B"),
        doc("MCA", "Market Conditions Advisory", "B"),
        doc("PREAPPROVAL", "Lender pre-approval letter", "LDR", "financed"),
        doc("POF", "Proof of funds", "B"),
      ],
    },
    {
      key: "offer",
      name: "Search, offer, acceptance",
      order: 2,
      items: [
        task("T-BUY-09", "Review disclosures available before offering; draft the offer with the buyer", "BA"),
        task("T-BUY-10", "Submit offer with pre-approval and proof of funds; confirm receipt", "BA"),
        task("T-BUY-11", "Counters negotiated; acceptance confirmed; escrow and title confirmed", "BA", "always", { dueRule: due("acceptance", 0) }),
        task("T-BUY-12", "Initial deposit to escrow", "B", "always", { dueRule: due("acceptance", 3, true), authority: "RPA ¶5A" }),
        task("T-BUY-13", "Loan application submitted", "B", "financed", { dueRule: due("acceptance", 3), authority: "RPA ¶6" }),
        task("T-BUY-14", "Inspections ordered (general, termite, sewer, roof, others elected)", "BA"),
        task("T-BUY-15", "All contingency and performance dates calendared and sent to the buyer in writing", "BA"),
        doc("RPA", "California Residential Purchase Agreement and Joint Escrow Instructions", "B"),
        doc("BCO", "Buyer Counter Offer (as needed)", "B"),
        doc("SBSA", "Statewide Buyer and Seller Advisory", "B"),
        doc("BIE", "Buyer's Investigation Elections", "B"),
        doc("FVAC", "FHA/VA Amendatory Clause (FHA or VA loans)", "B", "financed", { notes: "Only for FHA or VA financing." }),
        doc("COP", "Contingency for Sale of Buyer's Property", "B", "buyer_must_sell"),
        doc("SFA", "Seller Financing Addendum and Disclosure", "B", "seller_financing", { authority: "Civ. Code §§2956–2967" }),
        doc("SSA", "Short Sale Addendum", "B", "short_sale"),
        doc("SSIA", "Short Sale Information and Advisory", "B", "short_sale"),
        doc("TOPA", "Tenant Occupied Property Addendum", "B", "tenant"),
        doc("PAA", "Probate Agreement Purchase Addendum", "B", "trust_or_probate", { authority: "Prob. Code §10308" }),
        doc("EXCH", "1031 exchange cooperation addendum", "B", "exchange_1031", { authority: "26 U.S.C. §1031", notes: "Accommodator-provided; no C.A.R. code." }),
        doc("DEPOSIT-RCPT", "Escrow receipt for initial deposit", "ESC"),
      ],
    },
    {
      key: "escrow",
      name: "Escrow, due diligence, contingency removal",
      order: 3,
      items: [
        task("T-BUY-16", "Seller disclosures received", "S", "always", { dueRule: due("acceptance", 7), authority: "Civ. Code §1102.3; RPA ¶7" }),
        task("T-BUY-17", "TDS/NHD reviewed with buyer; rescission window ends", "B", "always", { dueRule: due("disclosure_delivery", 5), authority: "Civ. Code §1102.3" }),
        task("T-BUY-18", "Inspections completed; reports reviewed; any Request for Repair sent", "BA"),
        task("T-BUY-19", "Preliminary title report and HOA documents reviewed", "B", "always", { dueRule: due("acceptance", 17), authority: "RPA ¶7", notes: "HOA documents apply only when the property is in a common-interest development." }),
        task("T-BUY-20", "Appraisal ordered and completed", "LDR", "financed"),
        task("T-BUY-21", "Investigation contingency removal (CR)", "B", "always", { dueRule: due("acceptance", 17), authority: "RPA ¶7" }),
        task("T-BUY-22", "Appraisal contingency removal (CR)", "B", "financed", { dueRule: due("acceptance", 17), authority: "RPA ¶7" }),
        task("T-BUY-23", "Loan contingency removal (CR)", "B", "financed", { dueRule: due("acceptance", 21), authority: "RPA ¶7" }),
        task("T-BUY-24", "Homeowner's insurance bound; evidence delivered to lender", "B", "financed", { notes: "Check availability early in fire hazard zones." }),
        task("T-BUY-25", "Lead-based paint inspection opportunity (10 days) offered and documented", "BA", "pre1978", { authority: "42 U.S.C. §4852d" }),
        task("T-BUY-26", "Sale-of-buyer's-property contingency removed", "B", "buyer_must_sell"),
        doc("TDS", "Real Estate Transfer Disclosure Statement (received)", "S", "always", { authority: "Civ. Code §1102" }),
        doc("SPQ", "Seller Property Questionnaire (received)", "S", "always", { authority: "Civ. Code §1102" }),
        doc("NHD", "Natural Hazard Disclosure Statement (received)", "3P", "always", { authority: "Civ. Code §1103" }),
        doc("AVID", "Agent Visual Inspection Disclosure (received; buyer's agent also completes)", "BA", "always", { authority: "Civ. Code §2079" }),
        doc("WHSD", "Water Heater and Smoke Detector Statement of Compliance (received)", "S", "always", { authority: "Health & Saf. Code §§13113.8, 19211" }),
        doc("FLD", "Lead-Based Paint and Lead-Based Paint Hazards Disclosure", "B", "pre1978", { authority: "42 U.S.C. §4852d; 24 C.F.R. Part 35" }),
        doc("HOA1", "HOA Information Request", "HOA", "hoa", { authority: "Civ. Code §4525" }),
        doc("HOA2", "HOA documents and charges disclosure (received)", "HOA", "hoa", { authority: "Civ. Code §§4528, 4530" }),
        doc("FHDS", "Fire Hardening and Defensible Space Advisory, Disclosure and Addendum", "B", "fhsz", { authority: "Civ. Code §1102.19; Gov. Code §51182" }),
        doc("FHDS-HH", "Home fire hardening disclosure (homes built before 2010)", "B", "pre2010_fhsz", { authority: "Civ. Code §1102.19(a)" }),
        doc("TEC", "Tenant Estoppel Certificate", "3P", "tenant"),
        doc("ESD", "Exempt Seller Disclosure", "S", "trust_or_probate", { authority: "Civ. Code §1102.2" }),
        doc("LOCAL-POS", "Local point-of-sale report / compliance certificate", "3P", "local_pos"),
        doc("PRELIM", "Preliminary title report", "TTL"),
        doc("INSPECT", "Inspection reports (general, termite, others elected)", "3P"),
        doc("APPRAISAL", "Appraisal report", "LDR", "financed"),
        doc("LOAN-APPROVAL", "Loan approval / commitment", "LDR", "financed"),
        doc("INSURANCE", "Homeowner's insurance binder", "3P", "financed"),
        doc("CR", "Contingency Removal", "B", "always", { authority: "RPA ¶7" }),
        doc("RR", "Request for Repair (as needed)", "B"),
        doc("NSP", "Notice to Seller to Perform (as needed)", "BA", "always", { authority: "RPA ¶14" }),
        doc("AEA", "Amendment of Existing Agreement (as needed)", "B"),
      ],
    },
    {
      key: "closing",
      name: "Closing and post-closing",
      order: 4,
      items: [
        task("T-BUY-27", "Closing Disclosure received and reviewed with lender", "LDR", "financed", { dueRule: due("coe", -3, true), authority: "12 C.F.R. §1026.19(f)" }),
        task("T-BUY-28", "Verification of Property Condition walkthrough", "B", "always", { dueRule: due("coe", -5), authority: "RPA ¶15" }),
        task("T-BUY-29", "Demand to Close Escrow eligible if seller has not performed", "BA", "always", { dueRule: due("coe", -3), authority: "RPA ¶14" }),
        task("T-BUY-30", "Loan documents signed with notary; closing funds wired after verbal verification of wire instructions", "B"),
        task("T-BUY-31", "Close of escrow: recording confirmed, keys delivered", "ESC", "always", { dueRule: due("coe", 0) }),
        task("T-BUY-32", "Post-closing: Follow Up Boss updated, homeowner's exemption and utilities reminders sent", "BA"),
        task("T-BUY-33", "1031 identification (45 days) and exchange (180 days) deadlines calendared with the intermediary", "B", "exchange_1031", { authority: "26 U.S.C. §1031(a)(3)" }),
        doc("CD", "Closing Disclosure", "LDR", "financed", { authority: "12 C.F.R. §1026.19(f)" }),
        doc("VP", "Verification of Property Condition", "B", "always", { authority: "RPA ¶15" }),
        doc("DCE", "Demand to Close Escrow (as needed)", "BA", "always", { authority: "RPA ¶14" }),
        doc("SETTLEMENT", "Final settlement statement", "ESC"),
        doc("DEED", "Grant deed (recorded)", "TTL"),
        doc("TITLE-POLICY", "Owner's title insurance policy", "TTL"),
        doc("HOX", "Homeowners' exemption claim (BOE-266)", "B", "always", { authority: "Rev. & Tax. Code §218" }),
        doc("EXCH-ID", "1031 identification notice to intermediary", "B", "exchange_1031", { authority: "26 U.S.C. §1031(a)(3)" }),
      ],
    },
  ],
};

export const TEMPLATES: ChecklistTemplate[] = [CA_SELLER_TEMPLATE, CA_BUYER_TEMPLATE];

export const templateForSide = (side: Side): ChecklistTemplate => TEMPLATES.find((t) => t.side === side) ?? CA_SELLER_TEMPLATE;
