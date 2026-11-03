# California Real Estate Transaction Checklist

Content source for the AgentOS Transaction Checklist module. The typed copy of
this content lives in `src/data/checklist-templates.ts` and is seeded into the
`checklist_templates` table; **this file is generated from that constant** so the
two never drift. Edit the constant, bump its `version`, and regenerate.

> **Scope.** The checklist tracks and reminds only. It never generates, fills, or
> signs a form, never sends anything, and is not legal advice. Form codes are
> C.A.R. (California Association of REALTORS®) form codes; verify each item,
> its current revision, and its deadlines against the current C.A.R. library,
> the executed contract, and your broker's policy. Day counts are the RPA
> defaults and are overridable per transaction in the app.

> **Provenance.** The companion content doc referenced by the Nov 3, 2026 handoff
> was not available in the repository or Drive at build time, so this content was
> authored from the handoff's structure (phases, owners, conditions, due rules)
> and general knowledge of C.A.R. forms. Treat it as a draft for broker review.

## Legend

**Owners**

| Code | Meaning |
| --- | --- |
| LA | Listing agent |
| BA | Buyer's agent |
| S | Seller |
| B | Buyer |
| ESC | Escrow |
| TTL | Title |
| LDR | Lender |
| HOA | HOA / management |
| 3P | Third party |

**Conditions (triggers).** `always` items apply to every transaction; any other
condition is switched on by the matching flag on the transaction.

| Condition | Meaning |
| --- | --- |
| `always` | Always |
| `pre1978` | Built before 1978 |
| `hoa` | HOA / common-interest development |
| `fhsz` | Fire hazard severity zone |
| `pre2010_fhsz` | Built before 2010 in a fire hazard severity zone |
| `tenant` | Tenant in possession |
| `financed` | Financed purchase |
| `trust_or_probate` | Trust or probate sale |
| `seller_financing` | Seller financing |
| `buyer_must_sell` | Buyer must sell current home |
| `local_pos` | Local point-of-sale requirements |
| `short_sale` | Short sale |
| `exchange_1031` | 1031 exchange |

**Anchors.** `listing_signed` is the listing agreement date on the seller side and
the buyer representation agreement date on the buyer side.

## Seller (listing side)

Template key `ca-seller` · side `listing` · version 2026.11

### Seller — Phase 1: Pre-listing

Phase key `prelisting`

**Tasks**

| Code | Task | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| T-SELL-01 | Listing consultation: confirm who holds title and signing authority (vesting, trust, probate) | LA | always | — |  |  |
| T-SELL-02 | Order preliminary title report / property profile | LA | always | — |  | Title company pulls vesting, liens, easements. |
| T-SELL-03 | Identify the HOA and start the document request | LA | `hoa` | — | Civ. Code §4525 |  |
| T-SELL-04 | Recommend pre-listing inspections (general, termite, sewer, roof) | LA | always | — |  |  |
| T-SELL-05 | Pricing analysis, photography, staging and marketing plan approved by seller | LA | always | — |  |  |
| T-SELL-06 | MLS input and Clear Cooperation timing confirmed with broker | LA | always | — |  | Public marketing starts the MLS clock. |
| T-SELL-07 | Confirm tenant occupancy, lease terms and notice requirements | LA | `tenant` | — |  |  |
| T-SELL-08 | Collect trust certification or probate authority documents | LA | `trust_or_probate` | — | Prob. Code §18100.5 |  |
| T-SELL-09 | Identify local point-of-sale requirements (city report, sewer lateral, retrofits) | LA | `local_pos` | — |  |  |
| T-SELL-10 | Listing agreement signed; copy delivered to seller and broker file | LA | always | Agreement signed + 0 days |  |  |

**Documents**

| Code | Document | Form | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AD | Disclosure Regarding Real Estate Agency Relationship | AD | LA | always | — | Civ. Code §2079.14 |  |
| PRBS | Possible Representation of More Than One Buyer or Seller | PRBS | LA | always | — | Civ. Code §2079.14 |  |
| RLA | Residential Listing Agreement | RLA | S | always | — | Bus. & Prof. Code §10176 |  |
| SA | Seller's Advisory | SA | S | always | — |  |  |
| FHDA | Fair Housing and Discrimination Advisory | FHDA | S | always | — | Gov. Code §12955 |  |
| CCPA | California Consumer Privacy Act Advisory | CCPA | S | always | — | Civ. Code §1798.100 |  |
| WFA | Wire Fraud and Electronic Funds Transfer Advisory | WFA | S | always | — |  |  |
| PA | Probate Advisory | PA | S | `trust_or_probate` | — | Prob. Code §10300 |  |

### Seller — Phase 2: Disclosure packet

Phase key `disclosures`

**Tasks**

| Code | Task | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| T-SELL-11 | Seller completes the disclosure packet in their own words; agent reviews for completeness only | S | always | — |  | Agent never fills in answers for the seller. |
| T-SELL-12 | Order the Natural Hazard Disclosure report | LA | always | — | Civ. Code §1103 |  |
| T-SELL-13 | Agent visual inspection completed and written up | LA | always | — | Civ. Code §2079 |  |
| T-SELL-14 | Request HOA documents from the association or manager | LA | `hoa` | — | Civ. Code §4525 |  |
| T-SELL-15 | Obtain tenant estoppel certificate | LA | `tenant` | — |  |  |
| T-SELL-16 | Gather fire hardening and defensible space documentation | S | `fhsz` | — | Civ. Code §1102.19; Gov. Code §51182 |  |
| T-SELL-17 | Order local point-of-sale reports and inspections | LA | `local_pos` | — |  |  |

**Documents**

| Code | Document | Form | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TDS | Real Estate Transfer Disclosure Statement | TDS | S | always | — | Civ. Code §1102 |  |
| SPQ | Seller Property Questionnaire | SPQ | S | always | — | Civ. Code §1102 |  |
| NHD | Natural Hazard Disclosure Statement | NHD | 3P | always | — | Civ. Code §1103 |  |
| AVID | Agent Visual Inspection Disclosure | AVID | LA | always | — | Civ. Code §2079 |  |
| FLD | Lead-Based Paint and Lead-Based Paint Hazards Disclosure | FLD | S | `pre1978` | — | 42 U.S.C. §4852d; 24 C.F.R. Part 35 |  |
| WHSD | Water Heater and Smoke Detector Statement of Compliance | WHSD | S | always | — | Health & Saf. Code §§13113.8, 19211 |  |
| WCMD | Water-Conserving Plumbing Fixtures and Carbon Monoxide Detector Notice | WCMD | S | always | — | Civ. Code §1101.4; Health & Saf. Code §17926 |  |
| SBSA | Statewide Buyer and Seller Advisory | SBSA | S | always | — |  |  |
| HB | Combined Hazards Book (earthquake, environmental, lead) — receipt | — | S | always | — | Civ. Code §2079.7 | Booklet receipt; no form code. |
| ESD | Exempt Seller Disclosure | ESD | S | `trust_or_probate` | — | Civ. Code §1102.2 |  |
| HOA1 | HOA Information Request | HOA1 | HOA | `hoa` | — | Civ. Code §4525 |  |
| HOA2 | HOA documents and charges disclosure (received) | HOA2 | HOA | `hoa` | — | Civ. Code §§4528, 4530 |  |
| FHDS | Fire Hardening and Defensible Space Advisory, Disclosure and Addendum | FHDS | S | `fhsz` | — | Civ. Code §1102.19; Gov. Code §51182 |  |
| FHDS-HH | Home fire hardening disclosure (homes built before 2010) | FHDS | S | `pre2010_fhsz` | — | Civ. Code §1102.19(a) | Section of FHDS; applies to pre-2010 construction in a high or very high fire hazard severity zone. |
| TEC | Tenant Estoppel Certificate | TEC | 3P | `tenant` | — |  |  |
| LOCAL-POS | Local point-of-sale report / compliance certificate | — | 3P | `local_pos` | — |  | City or county residential property report, sewer lateral, retrofit certificates as applicable. |

### Seller — Phase 3: Active listing, offers, acceptance

Phase key `active`

**Tasks**

| Code | Task | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| T-SELL-18 | Listing live on MLS; sign, lockbox and showing instructions in place | LA | always | — |  |  |
| T-SELL-19 | Showing feedback and activity report to seller weekly | LA | always | — |  |  |
| T-SELL-20 | Present every written offer to the seller promptly | LA | always | — | Cal. Code Regs. tit. 10, §2785 |  |
| T-SELL-21 | Verify buyer pre-approval and proof of funds on each offer | LA | always | — |  |  |
| T-SELL-22 | Counter offers tracked; acceptance delivered; escrow opened with the fully executed contract | LA | always | Acceptance + 0 days |  |  |
| T-SELL-23 | Confirm buyer's initial deposit received by escrow | ESC | always | Acceptance + 3 business days | RPA ¶5A |  |

**Documents**

| Code | Document | Form | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RPA | California Residential Purchase Agreement and Joint Escrow Instructions | RPA | B | always | — |  |  |
| SCO | Seller Counter Offer (as needed) | SCO | S | always | — |  |  |
| SMCO | Seller Multiple Counter Offer (as needed) | SMCO | S | always | — |  |  |
| TOPA | Tenant Occupied Property Addendum | TOPA | S | `tenant` | — |  |  |
| SFA | Seller Financing Addendum and Disclosure | SFA | S | `seller_financing` | — | Civ. Code §§2956–2967 |  |
| COP | Contingency for Sale of Buyer's Property | COP | B | `buyer_must_sell` | — |  |  |
| SSA | Short Sale Addendum | SSA | S | `short_sale` | — |  |  |
| SSIA | Short Sale Information and Advisory | SSIA | S | `short_sale` | — |  |  |
| PAA | Probate Agreement Purchase Addendum | PAA | S | `trust_or_probate` | — | Prob. Code §10308 |  |
| EXCH | 1031 exchange cooperation addendum | — | S | `exchange_1031` | — | 26 U.S.C. §1031 | Accommodator-provided; no C.A.R. code. |

### Seller — Phase 4: Escrow through closing

Phase key `escrow`

**Tasks**

| Code | Task | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| T-SELL-24 | Seller disclosures delivered to buyer (TDS, SPQ, NHD, AVID and conditional items) | LA | always | Acceptance + 7 days | Civ. Code §1102.3; RPA ¶7 |  |
| T-SELL-25 | Buyer TDS/NHD rescission window ends | B | always | Disclosures delivered + 5 days | Civ. Code §1102.3 | 3 days if delivered in person, 5 days if by mail or electronically — the template uses 5. |
| T-SELL-26 | Provide access for buyer inspections; investigation contingency removal (CR) due | BA | always | Acceptance + 17 days | RPA ¶7 |  |
| T-SELL-27 | Appraisal access provided; appraisal contingency removal (CR) due | BA | `financed` | Acceptance + 17 days | RPA ¶7 |  |
| T-SELL-28 | Loan contingency removal (CR) due | BA | `financed` | Acceptance + 21 days | RPA ¶7 |  |
| T-SELL-29 | Review and respond to any Request for Repair | S | always | — |  |  |
| T-SELL-30 | Seller escrow package: instructions, statement of information, FIRPTA / FTB 593 | S | always | — | 26 U.S.C. §1445; Rev. & Tax. Code §18662 |  |
| T-SELL-31 | Complete agreed repairs, retrofits and termite work; deliver receipts | S | always | — |  |  |
| T-SELL-32 | Verification of Property Condition walkthrough (buyer) | BA | always | Close of escrow − 5 days | RPA ¶15 |  |
| T-SELL-33 | Demand to Close Escrow eligible if buyer has not closed | LA | always | Close of escrow − 3 days | RPA ¶14 |  |
| T-SELL-34 | Seller signs grant deed and closing documents with notary | S | always | — |  |  |
| T-SELL-35 | Close of escrow: confirm recording, funds disbursed, keys delivered | ESC | always | Close of escrow + 0 days |  |  |
| T-SELL-36 | Post-closing: MLS status to sold, broker file complete, Follow Up Boss updated | LA | always | — |  |  |

**Documents**

| Code | Document | Form | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ESCROW-INSTR | Escrow instructions and seller statement of information | — | ESC | always | — |  |  |
| PRELIM | Preliminary title report | — | TTL | always | — |  |  |
| CR | Contingency Removal (received from buyer) | CR | B | always | — | RPA ¶7 |  |
| RR | Request for Repair (as needed) | RR | B | always | — |  |  |
| NBP | Notice to Buyer to Perform (as needed) | NBP | LA | always | — | RPA ¶14 |  |
| WPA | Wood-destroying pest report and Section 1 clearance (if contracted) | — | 3P | always | — | Bus. & Prof. Code §8519 |  |
| AS | Seller's Affidavit of Nonforeign Status and FTB Form 593 | AS | S | always | — | 26 U.S.C. §1445; Rev. & Tax. Code §18662 |  |
| VP | Verification of Property Condition | VP | B | always | — | RPA ¶15 |  |
| DCE | Demand to Close Escrow (as needed) | DCE | LA | always | — | RPA ¶14 |  |
| DEED | Grant deed (recorded) | — | TTL | always | — |  |  |
| SETTLEMENT | Final settlement statement | — | ESC | always | — |  |  |

## Buyer

Template key `ca-buyer` · side `buyer` · version 2026.11

### Buyer — Phase 1: Consultation, representation, financing

Phase key `representation`

**Tasks**

| Code | Task | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| T-BUY-01 | Buyer consultation: needs, written criteria, agency and compensation explained | BA | always | — |  |  |
| T-BUY-02 | Buyer representation agreement signed before touring | BA | always | Agreement signed + 0 days | Civ. Code §1670.50 |  |
| T-BUY-03 | Buyer representation agreement expires — renew in writing to continue | BA | always | Agreement signed + 90 days | Civ. Code §1670.50 (AB 2992) | Maximum three months; no automatic renewal. |
| T-BUY-04 | Lender pre-approval obtained and reviewed | LDR | `financed` | — |  |  |
| T-BUY-05 | Proof of funds for down payment or cash purchase collected | B | always | — |  |  |
| T-BUY-06 | Search criteria and tour plan set; wire-fraud safeguards explained | BA | always | — |  |  |
| T-BUY-07 | Timing of the buyer's current-home sale assessed | BA | `buyer_must_sell` | — |  |  |
| T-BUY-08 | Qualified intermediary engaged before the relinquished property closes | B | `exchange_1031` | — | 26 U.S.C. §1031 |  |

**Documents**

| Code | Document | Form | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| AD | Disclosure Regarding Real Estate Agency Relationship | AD | BA | always | — | Civ. Code §2079.14 |  |
| PRBS | Possible Representation of More Than One Buyer or Seller | PRBS | BA | always | — | Civ. Code §2079.14 |  |
| BRBC | Buyer Representation and Broker Compensation Agreement | BRBC | B | always | — | Civ. Code §1670.50 (AB 2992) |  |
| BIA | Buyer's Investigation Advisory | BIA | B | always | — |  |  |
| FHDA | Fair Housing and Discrimination Advisory | FHDA | B | always | — | Gov. Code §12955 |  |
| CCPA | California Consumer Privacy Act Advisory | CCPA | B | always | — | Civ. Code §1798.100 |  |
| WFA | Wire Fraud and Electronic Funds Transfer Advisory | WFA | B | always | — |  |  |
| MCA | Market Conditions Advisory | MCA | B | always | — |  |  |
| PREAPPROVAL | Lender pre-approval letter | — | LDR | `financed` | — |  |  |
| POF | Proof of funds | — | B | always | — |  |  |

### Buyer — Phase 2: Search, offer, acceptance

Phase key `offer`

**Tasks**

| Code | Task | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| T-BUY-09 | Review disclosures available before offering; draft the offer with the buyer | BA | always | — |  |  |
| T-BUY-10 | Submit offer with pre-approval and proof of funds; confirm receipt | BA | always | — |  |  |
| T-BUY-11 | Counters negotiated; acceptance confirmed; escrow and title confirmed | BA | always | Acceptance + 0 days |  |  |
| T-BUY-12 | Initial deposit to escrow | B | always | Acceptance + 3 business days | RPA ¶5A |  |
| T-BUY-13 | Loan application submitted | B | `financed` | Acceptance + 3 days | RPA ¶6 |  |
| T-BUY-14 | Inspections ordered (general, termite, sewer, roof, others elected) | BA | always | — |  |  |
| T-BUY-15 | All contingency and performance dates calendared and sent to the buyer in writing | BA | always | — |  |  |

**Documents**

| Code | Document | Form | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RPA | California Residential Purchase Agreement and Joint Escrow Instructions | RPA | B | always | — |  |  |
| BCO | Buyer Counter Offer (as needed) | BCO | B | always | — |  |  |
| SBSA | Statewide Buyer and Seller Advisory | SBSA | B | always | — |  |  |
| BIE | Buyer's Investigation Elections | BIE | B | always | — |  |  |
| FVAC | FHA/VA Amendatory Clause (FHA or VA loans) | FVAC | B | `financed` | — |  | Only for FHA or VA financing. |
| COP | Contingency for Sale of Buyer's Property | COP | B | `buyer_must_sell` | — |  |  |
| SFA | Seller Financing Addendum and Disclosure | SFA | B | `seller_financing` | — | Civ. Code §§2956–2967 |  |
| SSA | Short Sale Addendum | SSA | B | `short_sale` | — |  |  |
| SSIA | Short Sale Information and Advisory | SSIA | B | `short_sale` | — |  |  |
| TOPA | Tenant Occupied Property Addendum | TOPA | B | `tenant` | — |  |  |
| PAA | Probate Agreement Purchase Addendum | PAA | B | `trust_or_probate` | — | Prob. Code §10308 |  |
| EXCH | 1031 exchange cooperation addendum | — | B | `exchange_1031` | — | 26 U.S.C. §1031 | Accommodator-provided; no C.A.R. code. |
| DEPOSIT-RCPT | Escrow receipt for initial deposit | — | ESC | always | — |  |  |

### Buyer — Phase 3: Escrow, due diligence, contingency removal

Phase key `escrow`

**Tasks**

| Code | Task | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| T-BUY-16 | Seller disclosures received | S | always | Acceptance + 7 days | Civ. Code §1102.3; RPA ¶7 |  |
| T-BUY-17 | TDS/NHD reviewed with buyer; rescission window ends | B | always | Disclosures delivered + 5 days | Civ. Code §1102.3 |  |
| T-BUY-18 | Inspections completed; reports reviewed; any Request for Repair sent | BA | always | — |  |  |
| T-BUY-19 | Preliminary title report and HOA documents reviewed | B | always | Acceptance + 17 days | RPA ¶7 | HOA documents apply only when the property is in a common-interest development. |
| T-BUY-20 | Appraisal ordered and completed | LDR | `financed` | — |  |  |
| T-BUY-21 | Investigation contingency removal (CR) | B | always | Acceptance + 17 days | RPA ¶7 |  |
| T-BUY-22 | Appraisal contingency removal (CR) | B | `financed` | Acceptance + 17 days | RPA ¶7 |  |
| T-BUY-23 | Loan contingency removal (CR) | B | `financed` | Acceptance + 21 days | RPA ¶7 |  |
| T-BUY-24 | Homeowner's insurance bound; evidence delivered to lender | B | `financed` | — |  | Check availability early in fire hazard zones. |
| T-BUY-25 | Lead-based paint inspection opportunity (10 days) offered and documented | BA | `pre1978` | — | 42 U.S.C. §4852d |  |
| T-BUY-26 | Sale-of-buyer's-property contingency removed | B | `buyer_must_sell` | — |  |  |

**Documents**

| Code | Document | Form | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TDS | Real Estate Transfer Disclosure Statement (received) | TDS | S | always | — | Civ. Code §1102 |  |
| SPQ | Seller Property Questionnaire (received) | SPQ | S | always | — | Civ. Code §1102 |  |
| NHD | Natural Hazard Disclosure Statement (received) | NHD | 3P | always | — | Civ. Code §1103 |  |
| AVID | Agent Visual Inspection Disclosure (received; buyer's agent also completes) | AVID | BA | always | — | Civ. Code §2079 |  |
| WHSD | Water Heater and Smoke Detector Statement of Compliance (received) | WHSD | S | always | — | Health & Saf. Code §§13113.8, 19211 |  |
| FLD | Lead-Based Paint and Lead-Based Paint Hazards Disclosure | FLD | B | `pre1978` | — | 42 U.S.C. §4852d; 24 C.F.R. Part 35 |  |
| HOA1 | HOA Information Request | HOA1 | HOA | `hoa` | — | Civ. Code §4525 |  |
| HOA2 | HOA documents and charges disclosure (received) | HOA2 | HOA | `hoa` | — | Civ. Code §§4528, 4530 |  |
| FHDS | Fire Hardening and Defensible Space Advisory, Disclosure and Addendum | FHDS | B | `fhsz` | — | Civ. Code §1102.19; Gov. Code §51182 |  |
| FHDS-HH | Home fire hardening disclosure (homes built before 2010) | FHDS | B | `pre2010_fhsz` | — | Civ. Code §1102.19(a) |  |
| TEC | Tenant Estoppel Certificate | TEC | 3P | `tenant` | — |  |  |
| ESD | Exempt Seller Disclosure | ESD | S | `trust_or_probate` | — | Civ. Code §1102.2 |  |
| LOCAL-POS | Local point-of-sale report / compliance certificate | — | 3P | `local_pos` | — |  |  |
| PRELIM | Preliminary title report | — | TTL | always | — |  |  |
| INSPECT | Inspection reports (general, termite, others elected) | — | 3P | always | — |  |  |
| APPRAISAL | Appraisal report | — | LDR | `financed` | — |  |  |
| LOAN-APPROVAL | Loan approval / commitment | — | LDR | `financed` | — |  |  |
| INSURANCE | Homeowner's insurance binder | — | 3P | `financed` | — |  |  |
| CR | Contingency Removal | CR | B | always | — | RPA ¶7 |  |
| RR | Request for Repair (as needed) | RR | B | always | — |  |  |
| NSP | Notice to Seller to Perform (as needed) | NSP | BA | always | — | RPA ¶14 |  |
| AEA | Amendment of Existing Agreement (as needed) | AEA | B | always | — |  |  |

### Buyer — Phase 4: Closing and post-closing

Phase key `closing`

**Tasks**

| Code | Task | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| T-BUY-27 | Closing Disclosure received and reviewed with lender | LDR | `financed` | Close of escrow − 3 business days | 12 C.F.R. §1026.19(f) |  |
| T-BUY-28 | Verification of Property Condition walkthrough | B | always | Close of escrow − 5 days | RPA ¶15 |  |
| T-BUY-29 | Demand to Close Escrow eligible if seller has not performed | BA | always | Close of escrow − 3 days | RPA ¶14 |  |
| T-BUY-30 | Loan documents signed with notary; closing funds wired after verbal verification of wire instructions | B | always | — |  |  |
| T-BUY-31 | Close of escrow: recording confirmed, keys delivered | ESC | always | Close of escrow + 0 days |  |  |
| T-BUY-32 | Post-closing: Follow Up Boss updated, homeowner's exemption and utilities reminders sent | BA | always | — |  |  |
| T-BUY-33 | 1031 identification (45 days) and exchange (180 days) deadlines calendared with the intermediary | B | `exchange_1031` | — | 26 U.S.C. §1031(a)(3) |  |

**Documents**

| Code | Document | Form | Owner | Condition | Due | Authority | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CD | Closing Disclosure | — | LDR | `financed` | — | 12 C.F.R. §1026.19(f) |  |
| VP | Verification of Property Condition | VP | B | always | — | RPA ¶15 |  |
| DCE | Demand to Close Escrow (as needed) | DCE | BA | always | — | RPA ¶14 |  |
| SETTLEMENT | Final settlement statement | — | ESC | always | — |  |  |
| DEED | Grant deed (recorded) | — | TTL | always | — |  |  |
| TITLE-POLICY | Owner's title insurance policy | — | TTL | always | — |  |  |
| HOX | Homeowners' exemption claim (BOE-266) | — | B | always | — | Rev. & Tax. Code §218 |  |
| EXCH-ID | 1031 identification notice to intermediary | — | B | `exchange_1031` | — | 26 U.S.C. §1031(a)(3) |  |

## Master document index

Every document across both templates, with its form code, owner, trigger and authority.

| Code | Document | C.A.R. form | Owner | Trigger | Authority | Appears in |
| --- | --- | --- | --- | --- | --- | --- |
| AD | Disclosure Regarding Real Estate Agency Relationship | AD | LA | always | Civ. Code §2079.14 | listing/prelisting, buyer/representation |
| AEA | Amendment of Existing Agreement | AEA | B | always |  | buyer/escrow |
| APPRAISAL | Appraisal report | — | LDR | `financed` |  | buyer/escrow |
| AS | Seller's Affidavit of Nonforeign Status and FTB Form 593 | AS | S | always | 26 U.S.C. §1445; Rev. & Tax. Code §18662 | listing/escrow |
| AVID | Agent Visual Inspection Disclosure | AVID | LA | always | Civ. Code §2079 | listing/disclosures, buyer/escrow |
| BCO | Buyer Counter Offer | BCO | B | always |  | buyer/offer |
| BIA | Buyer's Investigation Advisory | BIA | B | always |  | buyer/representation |
| BIE | Buyer's Investigation Elections | BIE | B | always |  | buyer/offer |
| BRBC | Buyer Representation and Broker Compensation Agreement | BRBC | B | always | Civ. Code §1670.50 (AB 2992) | buyer/representation |
| CCPA | California Consumer Privacy Act Advisory | CCPA | S | always | Civ. Code §1798.100 | listing/prelisting, buyer/representation |
| CD | Closing Disclosure | — | LDR | `financed` | 12 C.F.R. §1026.19(f) | buyer/closing |
| COP | Contingency for Sale of Buyer's Property | COP | B | `buyer_must_sell` |  | listing/active, buyer/offer |
| CR | Contingency Removal | CR | B | always | RPA ¶7 | listing/escrow, buyer/escrow |
| DCE | Demand to Close Escrow | DCE | LA | always | RPA ¶14 | listing/escrow, buyer/closing |
| DEED | Grant deed (recorded) | — | TTL | always |  | listing/escrow, buyer/closing |
| DEPOSIT-RCPT | Escrow receipt for initial deposit | — | ESC | always |  | buyer/offer |
| ESCROW-INSTR | Escrow instructions and seller statement of information | — | ESC | always |  | listing/escrow |
| ESD | Exempt Seller Disclosure | ESD | S | `trust_or_probate` | Civ. Code §1102.2 | listing/disclosures, buyer/escrow |
| EXCH | 1031 exchange cooperation addendum | — | S | `exchange_1031` | 26 U.S.C. §1031 | listing/active, buyer/offer |
| EXCH-ID | 1031 identification notice to intermediary | — | B | `exchange_1031` | 26 U.S.C. §1031(a)(3) | buyer/closing |
| FHDA | Fair Housing and Discrimination Advisory | FHDA | S | always | Gov. Code §12955 | listing/prelisting, buyer/representation |
| FHDS | Fire Hardening and Defensible Space Advisory, Disclosure and Addendum | FHDS | S | `fhsz` | Civ. Code §1102.19; Gov. Code §51182 | listing/disclosures, buyer/escrow |
| FHDS-HH | Home fire hardening disclosure (homes built before 2010) | FHDS | S | `pre2010_fhsz` | Civ. Code §1102.19(a) | listing/disclosures, buyer/escrow |
| FLD | Lead-Based Paint and Lead-Based Paint Hazards Disclosure | FLD | S | `pre1978` | 42 U.S.C. §4852d; 24 C.F.R. Part 35 | listing/disclosures, buyer/escrow |
| FVAC | FHA/VA Amendatory Clause (FHA or VA loans) | FVAC | B | `financed` |  | buyer/offer |
| HB | Combined Hazards Book (earthquake, environmental, lead) — receipt | — | S | always | Civ. Code §2079.7 | listing/disclosures |
| HOA1 | HOA Information Request | HOA1 | HOA | `hoa` | Civ. Code §4525 | listing/disclosures, buyer/escrow |
| HOA2 | HOA documents and charges disclosure | HOA2 | HOA | `hoa` | Civ. Code §§4528, 4530 | listing/disclosures, buyer/escrow |
| HOX | Homeowners' exemption claim (BOE-266) | — | B | always | Rev. & Tax. Code §218 | buyer/closing |
| INSPECT | Inspection reports (general, termite, others elected) | — | 3P | always |  | buyer/escrow |
| INSURANCE | Homeowner's insurance binder | — | 3P | `financed` |  | buyer/escrow |
| LOAN-APPROVAL | Loan approval / commitment | — | LDR | `financed` |  | buyer/escrow |
| LOCAL-POS | Local point-of-sale report / compliance certificate | — | 3P | `local_pos` |  | listing/disclosures, buyer/escrow |
| MCA | Market Conditions Advisory | MCA | B | always |  | buyer/representation |
| NBP | Notice to Buyer to Perform | NBP | LA | always | RPA ¶14 | listing/escrow |
| NHD | Natural Hazard Disclosure Statement | NHD | 3P | always | Civ. Code §1103 | listing/disclosures, buyer/escrow |
| NSP | Notice to Seller to Perform | NSP | BA | always | RPA ¶14 | buyer/escrow |
| PA | Probate Advisory | PA | S | `trust_or_probate` | Prob. Code §10300 | listing/prelisting |
| PAA | Probate Agreement Purchase Addendum | PAA | S | `trust_or_probate` | Prob. Code §10308 | listing/active, buyer/offer |
| POF | Proof of funds | — | B | always |  | buyer/representation |
| PRBS | Possible Representation of More Than One Buyer or Seller | PRBS | LA | always | Civ. Code §2079.14 | listing/prelisting, buyer/representation |
| PREAPPROVAL | Lender pre-approval letter | — | LDR | `financed` |  | buyer/representation |
| PRELIM | Preliminary title report | — | TTL | always |  | listing/escrow, buyer/escrow |
| RLA | Residential Listing Agreement | RLA | S | always | Bus. & Prof. Code §10176 | listing/prelisting |
| RPA | California Residential Purchase Agreement and Joint Escrow Instructions | RPA | B | always |  | listing/active, buyer/offer |
| RR | Request for Repair | RR | B | always |  | listing/escrow, buyer/escrow |
| SA | Seller's Advisory | SA | S | always |  | listing/prelisting |
| SBSA | Statewide Buyer and Seller Advisory | SBSA | S | always |  | listing/disclosures, buyer/offer |
| SCO | Seller Counter Offer | SCO | S | always |  | listing/active |
| SETTLEMENT | Final settlement statement | — | ESC | always |  | listing/escrow, buyer/closing |
| SFA | Seller Financing Addendum and Disclosure | SFA | S | `seller_financing` | Civ. Code §§2956–2967 | listing/active, buyer/offer |
| SMCO | Seller Multiple Counter Offer | SMCO | S | always |  | listing/active |
| SPQ | Seller Property Questionnaire | SPQ | S | always | Civ. Code §1102 | listing/disclosures, buyer/escrow |
| SSA | Short Sale Addendum | SSA | S | `short_sale` |  | listing/active, buyer/offer |
| SSIA | Short Sale Information and Advisory | SSIA | S | `short_sale` |  | listing/active, buyer/offer |
| TDS | Real Estate Transfer Disclosure Statement | TDS | S | always | Civ. Code §1102 | listing/disclosures, buyer/escrow |
| TEC | Tenant Estoppel Certificate | TEC | 3P | `tenant` |  | listing/disclosures, buyer/escrow |
| TITLE-POLICY | Owner's title insurance policy | — | TTL | always |  | buyer/closing |
| TOPA | Tenant Occupied Property Addendum | TOPA | S | `tenant` |  | listing/active, buyer/offer |
| VP | Verification of Property Condition | VP | B | always | RPA ¶15 | listing/escrow, buyer/closing |
| WCMD | Water-Conserving Plumbing Fixtures and Carbon Monoxide Detector Notice | WCMD | S | always | Civ. Code §1101.4; Health & Saf. Code §17926 | listing/disclosures |
| WFA | Wire Fraud and Electronic Funds Transfer Advisory | WFA | S | always |  | listing/prelisting, buyer/representation |
| WHSD | Water Heater and Smoke Detector Statement of Compliance | WHSD | S | always | Health & Saf. Code §§13113.8, 19211 | listing/disclosures, buyer/escrow |
| WPA | Wood-destroying pest report and Section 1 clearance (if contracted) | — | 3P | always | Bus. & Prof. Code §8519 | listing/escrow |

## Key timelines

Dated items and the rule the app uses to compute them. Every offset can be
overridden per transaction (`dueOverride`). Business days skip Saturday and
Sunday only; there is no holiday calendar.

| Item | Rule |
| --- | --- |
| Listing agreement signed; copy delivered to seller and broker file (T-SELL-10) | Agreement signed + 0 days |
| Counter offers tracked; acceptance delivered; escrow opened with the fully executed contract (T-SELL-22) | Acceptance + 0 days |
| Confirm buyer's initial deposit received by escrow (T-SELL-23) | Acceptance + 3 business days |
| Seller disclosures delivered to buyer (TDS, SPQ, NHD, AVID and conditional items) (T-SELL-24) | Acceptance + 7 days |
| Buyer TDS/NHD rescission window ends (T-SELL-25) | Disclosures delivered + 5 days |
| Provide access for buyer inspections; investigation contingency removal (CR) due (T-SELL-26) | Acceptance + 17 days |
| Appraisal access provided; appraisal contingency removal (CR) due (T-SELL-27) | Acceptance + 17 days |
| Loan contingency removal (CR) due (T-SELL-28) | Acceptance + 21 days |
| Verification of Property Condition walkthrough (buyer) (T-SELL-32) | Close of escrow − 5 days |
| Demand to Close Escrow eligible if buyer has not closed (T-SELL-33) | Close of escrow − 3 days |
| Close of escrow: confirm recording, funds disbursed, keys delivered (T-SELL-35) | Close of escrow + 0 days |
| Buyer representation agreement signed before touring (T-BUY-02) | Agreement signed + 0 days |
| Buyer representation agreement expires — renew in writing to continue (T-BUY-03) | Agreement signed + 90 days |
| Counters negotiated; acceptance confirmed; escrow and title confirmed (T-BUY-11) | Acceptance + 0 days |
| Initial deposit to escrow (T-BUY-12) | Acceptance + 3 business days |
| Loan application submitted (T-BUY-13) | Acceptance + 3 days |
| Seller disclosures received (T-BUY-16) | Acceptance + 7 days |
| TDS/NHD reviewed with buyer; rescission window ends (T-BUY-17) | Disclosures delivered + 5 days |
| Preliminary title report and HOA documents reviewed (T-BUY-19) | Acceptance + 17 days |
| Investigation contingency removal (CR) (T-BUY-21) | Acceptance + 17 days |
| Appraisal contingency removal (CR) (T-BUY-22) | Acceptance + 17 days |
| Loan contingency removal (CR) (T-BUY-23) | Acceptance + 21 days |
| Closing Disclosure received and reviewed with lender (T-BUY-27) | Close of escrow − 3 business days |
| Verification of Property Condition walkthrough (T-BUY-28) | Close of escrow − 5 days |
| Demand to Close Escrow eligible if seller has not performed (T-BUY-29) | Close of escrow − 3 days |
| Close of escrow: recording confirmed, keys delivered (T-BUY-31) | Close of escrow + 0 days |

