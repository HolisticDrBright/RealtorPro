# AgentOS API

All endpoints live under `/api`, run on the Node.js runtime, accept/return JSON
(except media upload, which is `multipart/form-data`), and validate input with
Zod. Errors use a consistent envelope:

```json
{ "error": { "code": "validation_error", "message": "…", "details": { } } }
```

Error codes: `bad_request` (400), `unauthorized` (401), `not_found` (404),
`approval_required` (403), `conflict` (409), `validation_error` /
`unprocessable` / `fair_housing_violation` (422), `rate_limited` (429),
`provider_error` (502), `internal_error` (500).

Examples below assume the app runs at `http://localhost:3000`.

---

## Health

```bash
curl http://localhost:3000/api/health
```
```json
{ "status": "ok",
  "providers": { "llm": "mock", "media": "mock", "videoAssembly": "ffmpeg-detect" },
  "fub": { "status": "disconnected", "mock": true },
  "counts": { "contacts": 5, "properties": 8, "matches": 7, "jobs": 0 } }
```

---

## 1. MLS CSV import

### `POST /api/imports`
Detects a column mapping, stores the CSV as an **immutable source document**,
and writes one property + an **append-only fact ledger** per valid row. Missing
required facts are reported, never inferred.

```bash
curl -X POST http://localhost:3000/api/imports -H 'content-type: application/json' -d '{
  "filename": "rmls-export.csv",
  "csv": "Address,List Price,Beds,Baths,SqFt,ML#\n3117 NE Alameda St,\"$1,150,000\",4,2.5,\"2,860\",24-ALMEDA1",
  "saveMappingName": "RMLS standard export"
}'
```
```json
{ "sourceDocumentId": "…",
  "detection": { "mapping": { "address": "Address", "price": "List Price", "…": "…" },
                 "unmatched": ["lot","propertyType","features","remarks","openHouse"] },
  "status": "parsed", "rowCount": 1, "validRows": 1, "issues": [],
  "properties": [ { "id": "…", "address": "3117 NE Alameda St" } ],
  "savedMappingId": "…" }
```
A row missing a required value returns `status: "partial"` (or `"invalid"` /
HTTP 422 if no column maps to a required field) with a descriptive `issues` list.

### `GET /api/imports/mappings` · `POST /api/imports/mappings`
List / save reusable column mappings.
```bash
curl -X POST http://localhost:3000/api/imports/mappings -H 'content-type: application/json' -d '{
  "name": "RMLS standard export",
  "mapping": { "address": "Address", "price": "List Price", "mlsNumber": "ML#" }
}'
```

---

## 2. Authorized media upload

### `POST /api/media` (`multipart/form-data`)
Validates file type, stores hash/filename/MIME/rights flag/alteration status, and
records an AI-altered-media disclosure linked to the original.

```bash
curl -X POST http://localhost:3000/api/media \
  -F file=@exterior.jpg \
  -F propertyId=l1 -F kind=image -F rightsConfirmed=true \
  -F label="Exterior — front elevation"
```
For an AI-altered derivative:
```bash
curl -X POST http://localhost:3000/api/media \
  -F file=@exterior-twilight.jpg \
  -F propertyId=l1 -F kind=image -F rightsConfirmed=true \
  -F alterationStatus=altered -F originalAssetId=m1 \
  -F alterationDescription="Virtual twilight — sky and window glow replaced"
```
Returns the created `asset` and, for altered media, a `disclosureId`.
`rightsConfirmed=false`, a disallowed MIME type, or an altered asset without an
original / description are rejected (422).

### `GET /api/media?propertyId=l1`
List a property's assets.

---

## 3. Buyer Scout

### `POST /api/buyer-criteria`
Create objective criteria. **Fair Housing guardrail runs first** — protected-class
or subjective-neighborhood language is rejected (422 `fair_housing_violation`).
```bash
curl -X POST http://localhost:3000/api/buyer-criteria -H 'content-type: application/json' -d '{
  "contactId": "c1", "label": "Mehta — active search",
  "ceilingText": "$700,000 (hard)", "ceilingAmount": 700000, "ceilingHard": true,
  "hardConstraints": ["3+ beds, 2+ baths", "Off-street parking required", "Max HOA $150/mo"],
  "weightedPrefs": [ { "label": "Fenced yard (dog)", "weight": 90 }, { "label": "Updated kitchen", "weight": 70 } ],
  "areas": ["Sellwood-Moreland", "Woodstock"], "mustHaves": ["Off-street parking"]
}'
```

### `POST /api/buyer-scout/parse`
Import an MLS alert (CSV or pasted email) as a **source** and rank each listing
against a saved criteria profile using only objective facts. Returns match
reasons (with source chips), tradeoffs, missing facts, and verify questions.
```bash
curl -X POST http://localhost:3000/api/buyer-scout/parse -H 'content-type: application/json' -d '{
  "criteriaProfileId": "cp-b1", "source": "email",
  "content": "4823 SE Reedway St — $674,900, 3 bd / 2 ba, 1940 sqft MLS #24-388102. Fenced yard, detached garage, updated kitchen 2023."
}'
```
```json
{ "importId": "…", "status": "parsed", "matchCount": 1,
  "matches": [ { "score": 100, "overCeiling": false,
    "reasons": [ { "text": "List $674,900 — $25,100 under the $700,000 ceiling", "source": "CSV: price" } ],
    "tradeoffs": [], "missingFacts": [], "verifyQuestions": [] } ] }
```
Seeded criteria-profile ids: `cp-b1` (Mehta), `cp-b2` (Whitfield), `cp-b3` (Ruiz).

### `GET /api/buyer-scout/matches?criteriaProfileId=cp-b1`
List ranked matches, highest score first.

### `POST /api/shortlists/items`
Add a match/property to a buyer's shortlist (creating one if needed).
```bash
curl -X POST http://localhost:3000/api/shortlists/items -H 'content-type: application/json' -d '{
  "criteriaProfileId": "cp-b1", "matchId": "bm-p1"
}'
```

### `POST /api/drafts`
Create a **local** client email or note draft (Fair Housing checked). Drafts
never send.
```bash
curl -X POST http://localhost:3000/api/drafts -H 'content-type: application/json' -d '{
  "kind": "email", "contactId": "c1",
  "subject": "4823 SE Reedway St — worth a look", "body": "Hi Jordan, …"
}'
```

---

## 4. Listing Studio (generation job queue)

### `POST /api/studio/jobs`
Create a provider-neutral generation job. **Local (mock) jobs run immediately**
and return outputs. **Remote jobs are queued and return a cost estimate** and
`needsApproval: true` (HTTP 202). Fair Housing runs on the creative direction.
```bash
curl -X POST http://localhost:3000/api/studio/jobs -H 'content-type: application/json' -d '{
  "propertyId": "l1", "type": "campaign",
  "settings": { "brandVoice": "Warm, concrete, no hype",
                "visualTreatment": "Virtual twilight (disclosed)",
                "videoFormat": "9:16 vertical · 0:30", "spendCapUsd": 1200 }
}'
```
```json
{ "job": { "id": "…", "status": "review", "provider": "mock-llm", "promptVersion": "campaign/v1" },
  "outputs": { "drafts": { "mls": "…", "social": "…" },
               "media": { "hero": { "altered": true, "disclosure": "…" }, "video": { … } },
               "assembled": { "assembled": false, "detail": "ffmpeg not found — wrote a mock render manifest." },
               "disclosures": ["…"] },
  "needsApproval": false }
```

### `GET /api/studio/jobs` · `GET /api/studio/jobs/:id` · `DELETE /api/studio/jobs/:id`
List all jobs / get a job + its drafts / cancel a job.

### `POST /api/studio/jobs/:id/approve-remote`
Explicit approval gate for remote generation — records who approved, then runs.
```bash
curl -X POST http://localhost:3000/api/studio/jobs/JOB_ID/approve-remote \
  -H 'content-type: application/json' -d '{ "approvedForRemote": true, "approvedBy": "Avery Sandoval" }'
```

### `POST /api/approvals`
Record a section / draft / disclosure approval (timestamped, audited). Approving
a draft flips its status; approving a disclosure marks it approved.
```bash
curl -X POST http://localhost:3000/api/approvals -H 'content-type: application/json' -d '{
  "targetType": "section", "targetId": "alameda-mls",
  "label": "MLS description", "approvedBy": "Avery Sandoval"
}'
```

---

## 5. Follow Up Boss

All FUB writes are **explicit and user-approved**, limited to tasks and draft
notes. Contacts are linked by **FUB ID, never by name**.

### `POST /api/fub/sync`
Manual sync (pull assigned records, report pushes). Records sync events + audit.
```bash
curl -X POST http://localhost:3000/api/fub/sync -H 'content-type: application/json' -d '{}'
```

### `POST /api/fub/tasks` — "Create FUB task"
```bash
curl -X POST http://localhost:3000/api/fub/tasks -H 'content-type: application/json' -d '{
  "contactId": "c1", "title": "Show 4823 SE Reedway St", "dueAt": "2026-07-22"
}'
```
A contact with no FUB link returns 422 (never matched by name).

### `POST /api/fub/notes` — "Add FUB note" (always a draft)
```bash
curl -X POST http://localhost:3000/api/fub/notes -H 'content-type: application/json' -d '{
  "contactId": "c2", "body": "Lender confirmed the appraisal was ordered Friday."
}'
```

### `GET/POST /api/fub/connect`
Read / set connection state (`connect` | `pause` | `disconnect`). The API key is
read from `FUB_API_KEY` and never stored in the database.

### `POST /api/fub/webhook`
Signature-verified receiver for FUB webhooks — **development/documentation only**.
Requires `FUB_WEBHOOK_SECRET`; real-time delivery requires a secure hosted relay
(see `docs/ARCHITECTURE.md`). Unsigned/invalid requests return 401.

---

## 6. Exports

### `GET/POST /api/exports`
List past exports / write a full local-data backup to `workspace/exports/`
(presence on disk verified before success is reported).
```bash
curl -X POST http://localhost:3000/api/exports -H 'content-type: application/json' -d '{}'
```

---

## Auditing

Every import, generated draft, approval, export, and FUB write appends an entry
to the `audit_logs` table (append-only), including provider, model, prompt
version, inputs, outputs, and approvals for generation jobs.
