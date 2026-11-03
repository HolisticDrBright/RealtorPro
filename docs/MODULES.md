# AgentOS extended modules — API & workflows

Five modules build on the base app. All are **local-first, source-grounded,
editable, audit-friendly**. Endpoints run on the Node runtime, validate input
with Zod, and return the standard error envelope
(`{ error: { code, message, details? } }`). **All seed/demo figures are
fictional.** Missing values render `[TBD — source required]`.

Non-negotiables enforced in code: no scraping/automation; only authorized
uploads; never invent facts; no export/generation without explicit approval;
full audit trail; no imitation of any real brokerage's branding.

---

## A. Development Visualizer

Turns authorized aerials, site plans, surveys, maps, and agent facts into a
controlled concept-visualization workflow. Provider interfaces
(`MediaGenerationProvider`, `VideoGenerationProvider`, `MapOverlayProvider`) live
in `src/services/providers/visualizer.ts` with a **local mock** (no credentials)
and a **Higgsfield-compatible** adapter behind env vars.

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/visualizer/projects` | List / create a project (6 visualization types). |
| `GET/POST /api/visualizer/projects/:id` | Project detail / add a source (rights + boundary basis). |
| `POST /api/visualizer/storyboards` | Save visual-direction controls (format, duration, direction, camera, boundary style, disclosure mode, budget cap). |
| `POST /api/visualizer/jobs` | Create + run a job (mock runs immediately; remote returns a cost estimate + `needsApproval`). |
| `POST /api/visualizer/jobs/:id/approve-remote` | Explicit approval before remote generation. |
| `POST /api/visualizer/jobs/:id/export` | Export — **locked until the required disclosure is approved**. |
| `POST /api/disclosures/:id/approve` | Approve (and optionally edit) a required disclosure. |

**Boundary rule (enforced):** a `subtle`/`glow` boundary overlay is rejected
(422) unless a source has `boundaryVerified` with a basis of
`survey | site_plan | geojson | manual`. **Disclosure rule (enforced):** every
visualization type carries a required, user-editable disclosure; construction
sequences use the "not actual construction progress" label; export is blocked
until it is approved.

```bash
# create → add verified survey → generate → approve disclosure → export
curl -X POST localhost:3000/api/visualizer/projects -d '{"name":"Foster Rd","visualizationType":"land_teaser"}'
curl -X POST localhost:3000/api/visualizer/projects/PID -d '{"projectId":"PID","kind":"survey","rightsConfirmed":true,"boundaryVerified":true,"boundaryBasis":"survey"}'
curl -X POST localhost:3000/api/visualizer/jobs -d '{"projectId":"PID","type":"image"}'
curl -X POST localhost:3000/api/disclosures/DID/approve -d '{}'
curl -X POST localhost:3000/api/visualizer/jobs/JID/export -d '{}'
```

---

## B. OM Quality Gate (OM Studio)

Source-grounded offering memorandums with the mandatory **Three-Lens Review**.
Models: BrandProfile, TemplateProfile, TemplateRightsConfirmation, OMDraft,
OMSection, SourceDocument, Fact, DerivedMetric, GeneratedClaim, VerificationRun,
VerificationFinding, Disclosure, ExportRecord.

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/om/drafts` | List / create an OM. Create **requires a brand kit AND a rights-confirmed template**. |
| `GET /api/om/drafts/:id` | Draft + sections + derived metrics + disclosures + latest findings. |
| `POST /api/om/drafts/:id/verify` | Run the Three-Lens Review; persist findings + per-page state. |
| `POST /api/om/findings/:id/resolve` | Resolve a finding. |
| `POST /api/om/drafts/:id/approve` | Approval gate — blocks unless every critical/high finding is resolved + confirmed. |
| `POST /api/om/drafts/:id/export` | PPTX/PDF export — **locked until Approved**. |
| `GET/POST /api/om/templates` | List / create an **original** template (+ rights). No "remove competitor branding" feature. |
| `GET/POST /api/om/brand-profiles` | List / create a brand kit from the user's own assets. |

**Three lenses** (`src/lib/three-lens.ts`):
1. **Source & numbers** — re-trace every figure, recompute derived values, flag
   missing inputs / broken citations / unsupported claims / numbers shown for
   pending values.
2. **Design & brand** — logo, colors, disclaimer, page numbers, contact block,
   image credits, disclosure labels, and **unapproved external branding**
   (flagged for human review, never auto-removed). Never compares to competitor
   templates.
3. **Editability & export** — real editable PPTX text + native tables, image
   alt/source retention, successful PPTX/PDF export.

Financial values are marked **Imported / Calculated / Pending Review / TBD**.
Derived values (occupancy, NOI, cap rate, price/unit, price/SF, …) compute only
when all inputs exist and store their **formula + source fact IDs**
(`src/lib/finance.ts`, `derived_metrics`).

Exports: editable **PPTX** (PptxGenJS), **XLSX** (ExcelJS), **PDF** via a provider
abstraction with a local pdf-lib fallback (`src/services/export/*`). Every export
records brand + source/disclosure metadata and an audit entry.

---

## Rent Roll Studio

`Upload → map → validate → resolve → analyze → export`.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/rent-roll/import` | Parse CSV → detect columns → normalize (keeps source-vs-normalized) → validate. |
| `GET /api/rent-roll/:id` | Rent roll + units + findings. |
| `POST /api/rent-roll/:id/export` | Editable XLSX workbook with the six required tabs. |

Validation (`src/lib/rent-roll.ts`): duplicates, missing unit IDs, invalid lease
dates, inconsistent totals, rent-per-SF anomalies, occupancy mismatches, missing
tenant fields. Derived values are computed only when supported and store their
formula + source. Privacy: `localOnly` processing and `redactPii` on export;
AgentOS warns before sending rent-roll data to any external AI provider. Workbook
tabs: Original Import · Clean Rent Roll · Validation Findings · Lease Expiration
Schedule · Property Summary · Assumptions & Sources.

---

## Comp Lab

`Import authorized export → normalize → filter → compare → explain → export`.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/comps/import` | Normalize + transparently score comps from an authorized CSV. |
| `GET/POST /api/comps/:id` | Comp set detail / add an **agent-entered adjustment** (labeled an assumption). |
| `POST /api/comps/:id/export` | XLSX workbook or client-facing PDF (with disclaimers). |

Scoring (`src/lib/comps.ts`) is a transparent weighted blend of the objective
dimensions that have data (distance, recency, size, $/SF, asset match). It never
calls a comp "the best", invents adjustments, or produces an appraisal/valuation.
Each comp shows source, freshness, missing fields, and verification status
(`verified | needs_verification | user_entered`).

---

## Signal Scout

An explainable opportunity queue — **not** a "who will sell" predictor.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/signals` | Daily queue with filters (status, type). |
| `POST /api/signals/generate` | Build signals from an uploaded MLS status export and/or FUB contacts. |
| `POST /api/signals/:id/action` | pursue · snooze · dismiss · create_task · add_note · draft_outreach. |

Allowed sources only (FUB, uploaded/licensed MLS & public-record, sphere, inbound).
No scraping; no protected-class/demographic/credit/health data. **Confidence
reflects data completeness, never likelihood of selling** (`src/lib/signals.ts`).
Outreach is **draft-only** — never auto-sent; FUB writes use the base adapter
(tasks + draft notes only, linked by FUB ID, never by name). Every score, action,
and FUB write is audited.

---

## Transaction Checklist

A California seller/buyer transaction checklist — tasks **and** required
documents, per phase, with computed due dates — attached to each row of the
`transactions` table. Content comes from one typed constant
(`src/data/checklist-templates.ts`, mirrored in
`docs/CA_TRANSACTION_CHECKLIST.md`) seeded into `checklist_templates` so a
brokerage can later clone and edit a copy.

| Endpoint | Purpose |
| --- | --- |
| `GET/POST /api/transactions` | List active transactions with progress / create one (auto-instantiates the default checklist for its side). |
| `GET/PATCH /api/transactions/:id` | Detail `{ items, summary }` / edit dates, flags, stage. Dates → `recomputeDueDates`; flags → `updateFlags`. |
| `POST /api/transactions/:id/checklist` | Instantiate or `reset: true` rebuild (409 guard). |
| `POST /api/transactions/:id/export` | PDF or XLSX of the checklist — records an approval + export record. |
| `PATCH /api/checklist/items/:id` | status · dueOverride · notes · sourceDocumentId. |
| `POST /api/checklist/items/:id/attach` | Upload a received document → immutable `source_documents` row (`kind: disclosure`), item marked done. |
| `POST /api/checklist/items/:id/push-fub` | Create a **local draft task** (`origin: local`, `syncedToFub: false`). |
| `GET /api/checklist/templates` · `GET /api/checklist/due` | Templates (read-only) · items due in a date range (Today screen). |

**Phases.** Seller: pre-listing → disclosure packet → active/offers/acceptance
→ escrow through closing. Buyer: representation → search/offer/acceptance →
escrow/due diligence/contingency removal → closing. Conditional items switch on
by transaction flags (`pre1978` → FLD, `hoa` → HOA1/HOA2, `fhsz`,
`pre2010_fhsz`, `tenant`, `financed`, `trust_or_probate`, `seller_financing`,
`buyer_must_sell`, `local_pos`, `short_sale`, `exchange_1031`).

**Dates** (`src/lib/checklist.ts`, pure, unit-tested): anchors are listing /
representation agreement signed, acceptance, COE and disclosure delivery. Rules
are the RPA defaults (deposit acceptance + 3 business days, disclosures
acceptance + 7, investigation/appraisal CR + 17, loan CR + 21, VP COE − 5,
Closing Disclosure COE − 3 business days, BRBC expiry + 90 …). Every date is
overridable per item; recompute never touches an override or a done item.
Business days skip weekends only — there is no holiday calendar.

**Guardrails.** The checklist tracks and reminds only: it never generates,
fills or signs a legal form and never auto-sends anything. FUB pushes go
through the existing draft-task approval path (the FUB adapter is never called
from this module). Item titles carry no property or client descriptions. Every
mutation writes an audit row (`checklist.instantiated`, `checklist.item_updated`,
`checklist.pushed_to_fub`, `checklist.document_attached`, `checklist.exported`).

**UI.** *Transactions* screen (list → detail with key-date inputs, condition
toggles, phase tabs, task/document rows with status, override, notes, Attach and
Push to FUB, export + reset). Dashboard "Active transactions" cards show
done/total + next due and deep-link into the screen; *Today* shows a
"Transaction deadlines" block for the next 7 days.

---

## Integration

Rent Roll Studio, Comp Lab, and Signal Scout records link to Property, Contact,
Deal, SourceDocument, Fact, AuditLog, and Follow Up Boss IDs. An approved rent
roll or comp set can feed OM Studio as a source-linked section. Signal Scout
actions open the linked FUB contact/property. Existing approval gates, source
tracing, privacy protections, Fair Housing guardrails, and local-first storage
are preserved throughout.

## Paid-provider integration still requiring credentials

Everything above runs on **local mocks** with no keys. To use real providers,
set the matching env vars (see `.env.example`) **and** approve remote generation
in-app:

- **LLM drafting/extraction** — `AGENTOS_LLM_PROVIDER=openai-compatible` +
  `AGENTOS_LLM_BASE_URL` / `AGENTOS_LLM_API_KEY` / `AGENTOS_LLM_MODEL`.
- **Image/Video generation (Higgsfield-compatible)** —
  `AGENTOS_MEDIA_PROVIDER=higgsfield` + `HIGGSFIELD_BASE_URL` / `HIGGSFIELD_API_KEY`.
- **ffmpeg** (local video assembly) — optional `FFMPEG_PATH`; degrades to a
  manifest if absent.
- **Follow Up Boss** — `FUB_API_KEY` (read + task/draft-note write only).
- **PDF** uses the local pdf-lib fallback; no paid PDF service is required.
