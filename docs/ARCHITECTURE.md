# AgentOS Architecture

AgentOS is a **local-first** Next.js (App Router) application. The browser renders
the six-screen Modernist UI; all persistence, provider calls, and guardrails run
in server code (API route handlers + a typed service layer) against a local
SQLite database and a local workspace directory.

```
┌──────────────────────────────────────────────────────────────────┐
│  Browser (client)                                                  │
│  AppShell → 6 screens + 3 dialogs, global state (components/*)      │
│  reads seeded/mock demo data for display; POSTs the real workflows │
└───────────────┬────────────────────────────────────────────────────┘
                │  fetch(/api/*)  — JSON / multipart
┌───────────────▼────────────────────────────────────────────────────┐
│  Server (Next route handlers, Node runtime)                          │
│  Zod validation ─ Fair Housing guard ─ rate/cost limits ─ audit log  │
│                                                                      │
│  lib/            services/                                           │
│   csv-mapping     providers/  (LLM · image/video · ffmpeg · factory) │
│   match-scoring   fub/        (adapter · payload builders)           │
│   fair-housing    generation-queue                                   │
│   gates, storage, rate-limit, audit, errors, validation             │
└───────────────┬───────────────────────────┬────────────────────────┘
                │ Drizzle ORM               │ fs (safe paths)
        ┌───────▼────────┐          ┌───────▼─────────────────────────┐
        │ SQLite         │          │ workspace/ (outside public/)     │
        │ agentos.db     │          │ sources/ assets/ generated/ …    │
        └────────────────┘          └──────────────────────────────────┘
                                     (external: FUB API · LLM · Higgsfield —
                                      only when keys set + approved)
```

---

## 1. The fact ledger

The domain problem: a listing "fact" (price, sqft, HOA, parking…) can come from
different sources that disagree, and a REALTOR® must never publish or rank on a
value AgentOS invented. AgentOS solves this with an **append-only fact ledger**
(`facts` table).

- **Provenance on every fact.** Each row records `field`, `value`, and a
  human-readable `source` (e.g. `CSV: ListPrice`, `Seller disclosure §4`), plus
  the `sourceDocumentId` and `listingImportId` it came from.
- **Immutable / append-only.** Facts are never updated in place. A correction is
  a *new* row (`supersedesId`), and a disagreement is recorded as a **conflict**
  (`confidence: "conflicting"`, `conflictsWith`) rather than silently resolved.
- **No inference.** The importer (`lib/csv-mapping.ts`) and alert extractor
  (`lib/scout.ts`) only capture values that are explicitly present. A missing
  value is reported as an issue / missing fact — never guessed.
- **Downstream traceability.** Generated campaign copy is stored as
  `generated_claims`, each carrying the `sources` (and, where applicable,
  `factIds`) that back it, so every sentence in a draft is auditable back to a
  fact. Buyer-match reasons likewise cite the source field they used.

This ledger is what lets the UI show a "source chip" on every match reason and
MLS sentence, and what lets the Listing Studio refuse to write a claim that no
fact supports.

### Buyer scoring

`lib/match-scoring.ts` is a **pure, explainable scorer**. Given a criteria
profile (hard ceiling, hard constraints, weighted preferences, must-haves) and a
listing's facts, it returns a 0–100 score plus `reasons`, `tradeoffs`,
`missingFacts`, and `verifyQuestions`. Over-hard-ceiling and failed numeric
constraints set an `excluded`/`overCeiling` flag (the score is preserved so the
UI can still show it). Absent facts lower confidence via `missingFacts`/verify
questions — they are never assumed. `lib/fair-housing.ts` keeps
protected-class/subjective inputs out of the criteria in the first place.

---

## 2. External-provider adapters

Everything external is behind a **provider-neutral interface** so no vendor
workflow is hardcoded into the UI or the queue.

- **`services/providers/types.ts`** defines `LlmProvider`,
  `ImageVideoProvider`, and `VideoAssembler`.
- **Mocks** (`mock-generation.ts`, and the ffmpeg fallback) implement those
  interfaces with **no credentials**, so the entire Listing Studio flow works
  locally. The mock LLM builds copy strictly from the fact ledger passed in — it
  invents no facts.
- **Real adapters** implement the same interfaces:
  - `llm.ts` — an OpenAI-compatible chat/JSON adapter (drafting + structured
    extraction).
  - `image-video.ts` — a **Higgsfield-compatible** submit→poll image/video
    adapter.
  - `ffmpeg.ts` — local **ffmpeg** assembly that detects the binary and
    **degrades to a JSON manifest** when ffmpeg is absent.
- **`services/providers/index.ts`** is the factory: it selects mock vs. real
  purely from environment variables.

The **generation queue** (`services/generation-queue.ts`) orchestrates a job:

1. Build the request from the fact ledger + creative settings.
2. Fair Housing check on the creative direction.
3. **Preflight cost estimate** and remote/local determination.
4. **Approval gate** (`lib/gates.ts`): a local mock job runs immediately; a
   remote (paid) job is queued and requires an explicit
   `approve-remote` call before it contacts any provider.
5. **Rate/cost limits** (`lib/rate-limit.ts`): per-job cost cap, jobs/hour, and a
   daily spend cap, enforced against the DB.
6. Persist drafts + generated claims + disclosures; move the job to `review`.
7. **Audit** the run with provider, model, prompt version, inputs, outputs, and
   approvals.

Job statuses: `draft → queued → running → review → approved`, plus `failed` /
`canceled`.

### Follow Up Boss adapter

`services/fub/` splits **pure payload builders** (`payloads.ts`, unit-tested)
from the **I/O adapter** (`adapter.ts`). Two invariants are encoded structurally:

- **No name-based matching.** `requireFubPersonId` refuses any write to a contact
  that is not linked to FUB by a numeric id.
- **Limited write surface.** The module exports only `buildTaskPayload` and
  `buildNotePayload` (notes are always `isDraft: true`). There is deliberately no
  builder for sending a text/email, creating a lead, calling, or deleting —
  `FORBIDDEN_FUB_ACTIONS` documents and tests that boundary.

The adapter uses the user's `FUB_API_KEY` (HTTP Basic) and runs in **mock mode**
when no key is set, so the sync/write flows are exercisable locally.

---

## 3. Local storage

`lib/paths.ts` centralises the workspace layout; `lib/storage.ts` enforces
safety:

- The workspace lives **outside `public/`**, so no uploaded or generated asset is
  ever served as a static file.
- **Path safety:** every write resolves under the workspace root and is verified
  to stay inside it (`safeJoin`), defeating `../` traversal and absolute-path
  escapes. Filenames are sanitised.
- **Content addressing:** files are hashed (SHA-256) and stored as
  `<hash-prefix>-<clean-name>`, giving deduplication and integrity.
- **Immutability:** `sources/` (uploaded CSV/PDF/email) and `assets/` (original
  media) are write-once; AI-altered derivatives go to `generated/` and link back
  to their original. Nothing overwrites or garbage-collects originals — deletion
  is explicit.
- **MIME allow-list:** uploads are validated against an allow-list per media
  kind before they touch disk.

The SQLite database itself (`workspace/agentos.db`) is opened once per process
(memoised on `globalThis` for dev hot-reload) with WAL mode and foreign keys on.

---

## 4. Future hosted webhook relay

Follow Up Boss delivers real-time updates via **webhooks**, which require FUB to
reach a **public HTTPS endpoint**. A REALTOR®'s local machine must **not** be
exposed to the internet, so AgentOS does **not** open a public port.

The local `/api/fub/webhook` receiver exists for development and documentation
only: it verifies an HMAC-SHA256 signature (`FUB_WEBHOOK_SECRET`) and records the
event — it performs no writes back to FUB.

**Production topology (future):**

```
Follow Up Boss ──HTTPS webhook──▶  Hosted relay (small always-on service)
                                    · terminates TLS on a stable public URL
                                    · verifies the FUB signature
                                    · authenticates the target workspace
                                    · forwards the event over an authenticated,
                                      outbound-initiated channel to the local app
                                             │
                                             ▼
                                   AgentOS  /api/fub/webhook  (same verified handler)
```

The relay owns the public surface; the local app only ever makes **outbound**
connections and re-verifies every event. This keeps the "local machine is never
publicly exposed" guarantee while still enabling near-real-time sync. Until such
a relay is deployed, AgentOS relies on **manual, user-initiated sync**
(`POST /api/fub/sync`), which is the default and safe mode.

---

## Data model summary

The Drizzle schema (`src/db/schema.ts`) implements every required domain model:

| Area | Tables |
| --- | --- |
| Identity & policy | `user_profiles`, `brokerage_policies` |
| CRM (mirror of FUB) | `contacts`, `deals`, `tasks`, `notes`, `appointments` |
| Listings & assets | `properties`, `listing_imports`, `source_documents`, `assets`, `media_disclosures`, `column_mappings` |
| Fact ledger & output | `facts`, `generated_claims`, `drafts`, `approvals`, `exports` |
| Buyer Scout | `buyer_criteria_profiles`, `buyer_matches`, `shortlists`, `shortlist_items` |
| Generation | `generation_jobs` |
| Providers & audit | `provider_connections`, `sync_events`, `audit_logs` |

Migrations live in `drizzle/`; `src/db/seed.ts` loads the demo world that the UI
also renders.
