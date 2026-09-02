# AgentOS

A **local-first workspace for individual REALTORS®** who use Follow Up Boss (FUB).
A REALTOR® uploads an authorized MLS CSV plus photos, creates campaign assets and
buyer-match reviews, and syncs approved notes/tasks with Follow Up Boss.

Follow Up Boss is always the **system of record**: AgentOS reads FUB data and
writes back **only drafts and tasks for the agent to approve** — it never sends
messages/emails, never creates leads, and never edits or deletes FUB data.

> **Guardrails.** AgentOS does not scrape or automate Zillow, Realtor.com,
> Redfin, or MLS websites; it does no browser data extraction and bypasses no
> controls; it never texts, emails, or calls autonomously. Buyer matching scores
> only on objective listing facts against agreed criteria — never on
> demographics, protected classes, or subjective "neighborhood vibe."

---

## Stack

- **Next.js (App Router) + React + TypeScript** — the existing frontend design,
  recreated faithfully from the design handoff (the "Modernist" system: flat,
  zero-radius, Archivo, ink-on-ground with a single red accent).
- **SQLite + Drizzle ORM** — local database, migrations, and seed data.
- **Zod** — input validation on every API route.
- **Vitest** — unit tests for the graded core logic.
- **Typed service/adaptor layer** — provider-neutral interfaces for the LLM,
  image/video generation (Higgsfield-compatible), local ffmpeg assembly, and
  Follow Up Boss. A **mock provider drives the full workflow with no credentials.**

---

## Setup

Requires **Node 20+** (developed on Node 22).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment (optional — mock providers need no keys)
cp .env.example .env

# 3. Create the local database, apply migrations, and seed the demo world
npm run setup            # = db:migrate + db:seed

# 4. Run the app
npm run dev              # http://localhost:3000
```

With **no keys set**, AgentOS runs entirely on built-in mock providers: the MLS
import, buyer scoring, campaign generation, and FUB sync/write flows all work
locally.

### Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` / `npm start` | Production build / serve. |
| `npm run setup` | Migrate + seed the local database. |
| `npm run db:generate` | Regenerate Drizzle migrations from the schema. |
| `npm run db:migrate` | Apply migrations. |
| `npm run db:seed` | (Re)seed the demo data (idempotent — clears app tables first). |
| `npm run db:reset` | Delete the SQLite files (keeps uploaded assets on disk). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint (next). |
| `npm test` | Run the Vitest suite. |

---

## Environment variables

See [`.env.example`](./.env.example) for the full, commented list. Highlights:

| Variable | Default | Purpose |
| --- | --- | --- |
| `AGENTOS_WORKSPACE_DIR` | `./workspace` | Root for the DB, uploads, generated output, exports. Kept **outside** `public/`. |
| `AGENTOS_LLM_PROVIDER` | `mock` | `mock` or `openai-compatible`. |
| `AGENTOS_MEDIA_PROVIDER` | `mock` | `mock` or `higgsfield`. |
| `AGENTOS_VIDEO_ASSEMBLY` | `ffmpeg-detect` | Detect a local ffmpeg binary; degrade to a mock manifest if absent. |
| `AGENTOS_LLM_BASE_URL` / `AGENTOS_LLM_API_KEY` / `AGENTOS_LLM_MODEL` | — | Remote LLM (only when selected). |
| `HIGGSFIELD_BASE_URL` / `HIGGSFIELD_API_KEY` | — | Higgsfield-compatible image/video (only when selected). |
| `FFMPEG_PATH` | — | Path to ffmpeg; falls back to PATH lookup. |
| `FUB_API_KEY` | — | Your Follow Up Boss API key. **Blank → local mock FUB.** |
| `FUB_BASE_URL` | `https://api.followupboss.com/v1` | FUB API base. |
| `FUB_WEBHOOK_SECRET` | — | HMAC secret to verify inbound FUB webhooks (via a hosted relay). |
| `AGENTOS_MAX_JOBS_PER_HOUR` / `AGENTOS_MAX_JOB_COST_USD` / `AGENTOS_DAILY_SPEND_CAP_USD` | `20` / `25` / `100` | Generation rate/cost guardrails. |

**Keys are never committed and never stored in the database.** `.env` is
gitignored; the FUB key is read from `FUB_API_KEY` at request time only.

---

## Data locations

Everything AgentOS persists lives under the workspace directory (default
`./workspace`, gitignored):

```
workspace/
├── agentos.db          # SQLite database (+ -wal/-shm)
├── sources/            # IMMUTABLE uploaded source docs (MLS CSVs, alert text)
├── assets/             # IMMUTABLE original media (images, floor plans, video)
├── generated/          # AI-altered media + generated output (ffmpeg renders/manifests)
└── exports/            # Full local-data backups (JSON bundles)
```

- **Source documents and original assets are immutable.** They are hashed
  (SHA-256), content-addressed on disk, and preserved permanently unless you
  explicitly delete them.
- **AI-altered media is stored separately** under `generated/` and always linked
  back to its original asset with a disclosure record.

---

## Backup & deletion behavior

- **Export:** Settings → "Export all local data" (or `POST /api/exports`) writes
  a timestamped JSON bundle to `workspace/exports/` containing contacts,
  properties, the fact ledger, buyer criteria/matches, drafts, approvals,
  disclosures, and the full audit log. The file's presence on disk is verified
  before success is reported.
- **Reset the database:** `npm run db:reset` removes the SQLite files only;
  uploaded assets and source documents on disk are left untouched.
- **Delete media:** originals are only removed on an explicit delete — no
  workflow overwrites or garbage-collects them.
- **FUB data is never modified.** Deleting local data has no effect on your
  Follow Up Boss account.

---

## Documentation

- [`docs/USER-GUIDE.md`](./docs/USER-GUIDE.md) — **for agents:** what every tab does, how to use it, and where it fits in the day.

- [`docs/API.md`](./docs/API.md) — base endpoints with request/response examples.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — the fact ledger, provider
  adapters, local storage, and the future hosted webhook relay.
- [`docs/MODULES.md`](./docs/MODULES.md) — the five extended modules (endpoints,
  workflows, guardrails, and paid-provider notes).

## Apple glass UI

The whole app ships in an **Apple-glass** interface by default: a soft mesh
wallpaper, floating frosted sidebar and header, translucent rounded controls,
SF-style type, and full dark-mode support. Settings → *Interface* switches
back to the original flat Modernist look at any time (both share the same
components; the glass theme is a CSS layer keyed on `data-ui="glass"`).

## Dashboard (home screen)

The app opens on the **Dashboard** — the daily game plan — built
from local data only:

- **Daily briefing** with a headline and ordered sections (protect the deals,
  priorities, schedule, calls, off-market matches, hot buyers, YTD). Click
  **Ask Claude for today's game plan** to have Claude write it from the same
  facts (needs `ANTHROPIC_API_KEY`; otherwise the local plan is shown).
- **Priority tasks + today's to-do** with checkboxes (`PATCH /api/todos/:id`),
  and **Paste today's to-do list** (`!` = priority, `call:` = call).
- **Calls to make today** with tap-to-call links.
- **Work calendar** — local events plus `.ics` import from Gmail/Google
  Calendar or Outlook exports (`POST /api/calendar/events` with `{ ics }`).
  Live account sync is a separately-approved connector.
- **Year-to-date closings** split Listings / Buyers / Total: deals, volume,
  GCI. GCI is the recorded value, or price × commission % when both exist —
  never estimated; unknowns are counted and shown.
- **Active transactions** (price, listing vs buyer, stage).
- **Active buyers** (hot/warm) with their written criteria.
- **Off-market matches** — buyers × owner-authorized off-market properties
  using the same explainable, facts-only scorer as Buyer Scout.
- **Contacts** — hot buyers, warm buyers, sellers, past clients.

Endpoints: `GET /api/dashboard`, `POST /api/dashboard/briefing`,
`GET/POST /api/todos`, `PATCH/DELETE /api/todos/:id`, `GET/POST /api/calendar/events`.

## Extended modules

Five modules build on the base app; all are local-first, source-grounded,
editable, and audit-friendly. See [`docs/MODULES.md`](./docs/MODULES.md) for the
full API and every guardrail. **All demo/seed figures are fictional.**

### Development Visualizer (`Dev Visualizer` nav)
Turns authorized aerials/site plans/surveys/maps into controlled concept
visualizations (site-boundary overlay, land teaser, massing, future-use board,
construction-sequence video, aerial reel). **Workflow:** create project → source
& rights review → visual-direction controls → storyboard → generation queue →
review/export. A **glowing boundary overlay is only allowed with a verified
boundary source** (survey / site plan / approved GIS-GeoJSON / manual
confirmation); otherwise it is prohibited with a clear explanation. Every
visualization carries a required, user-editable disclosure (construction videos
use the "not actual construction progress" label), and **export is locked until
the disclosure is approved**. Providers (`MediaGenerationProvider`,
`VideoGenerationProvider`, `MapOverlayProvider`) run on a **local mock** with a
Higgsfield-compatible adapter behind env vars.

### OM Quality Gate (`OM Studio` nav)
Source-grounded offering memorandums with the mandatory **Three-Lens Review**:
(1) source & number verification (re-trace + recompute every figure), (2) design
& brand verification (against the user's own brand/template; flags unapproved
external branding for **human review**, never auto-removing it), (3) editability
& export verification (real editable PPTX text + native tables, PPTX/PDF export).
**Workflow:** wizard (property → sources → brand+template with a rights
confirmation) → builder (11 pages, source-linked facts, KPIs marked
Imported/Calculated/Pending/TBD) → **Review & compliance** (findings → resolve →
approval gate) → **export unlocks only after approval**. Editable **PPTX**
(PptxGenJS), **XLSX** (ExcelJS), and **PDF** (provider abstraction + local
pdf-lib fallback); pending values export `—`, never a fabricated number.

### Rent Roll Studio (`Rent Roll Studio` nav)
`Upload → map → validate → resolve → analyze → export` for multifamily,
commercial, and mixed-use. Detects columns, normalizes (keeping source-vs-
normalized), validates (duplicates, missing IDs, invalid dates, inconsistent
totals, rent/SF anomalies, occupancy mismatches, missing tenant fields), and
computes occupancy/NOI/cap-rate/etc. only when supported — storing the formula +
source fact IDs. Exports a six-tab Excel workbook. Privacy: local-only
processing and tenant-PII redaction; warns before any external AI send. Approved
rent rolls feed OM Studio.

### Comp Lab (`Comp Lab` nav)
`Import authorized export → normalize → filter → compare → explain → export`.
Produces a **transparent comparability score** (weighted blend of objective
dimensions that have data) — never an appraisal, "best comp", or invented
adjustment. Every comp shows source, freshness, missing fields, and verification
status. Agent adjustments are labeled assumptions, not facts. Exports XLSX +
client PDF (with disclaimers).

### Signal Scout (`Signal Scout` nav)
An **explainable** opportunity queue from agent-approved sources (FUB, uploaded
& licensed MLS/public-record, sphere, inbound) — **not** a "who will sell"
predictor. Confidence reflects **data completeness**, never likelihood of
selling. Each signal shows its exact source, freshness, why it surfaced,
confidence basis, and a suggested action. One-click actions (pursue, snooze,
dismiss, create FUB task, add FUB note, draft outreach) are all explicit and
audited; **outreach is draft-only and never auto-sent**. No scraping; no
protected-class/demographic/credit/health data.

### Quick test of each workflow
```bash
npm run setup          # migrate + seed (fictional demo data for every module)
npm run dev            # then use the nav, or:

# OM: create → verify → resolve → approve → export (export is 403 until approved)
curl -X POST localhost:3000/api/om/drafts/om1/verify -d '{}'
# Rent Roll: CSV → workbook
curl -X POST localhost:3000/api/rent-roll/import -H 'content-type: application/json' \
  -d '{"name":"t","content":"Unit,Tenant,SqFt,Lease End,Monthly Rent,Status\nA,Blue Fin,1450,03/2028,4350,Current"}'
# Comp Lab, Signal Scout, Visualizer: see docs/MODULES.md
```

---

## Live data — Follow Up Boss, Claude and your Obsidian vault

On the `claude/agentos-live-data` branch every screen reads from the local
database instead of the ported demo data, and three connections populate it.
With nothing configured the app still runs on the seeded fictional database and
labels it **Demo data** in the header, Settings and the Follow Up Boss tab.

| Connection | `.env` | What happens |
| --- | --- | --- |
| **Follow Up Boss** | `FUB_API_KEY` | **Follow Up Boss → Sync now** pulls people, tasks, notes, deals and appointments (paginated) and upserts them **by FUB id** into `contacts`, `tasks`, `notes`, `appointments`, `deals` and mirrors deals into `transactions` for the dashboard. Writes back are limited to tasks and draft notes, one per button press. |
| **Claude** | `ANTHROPIC_API_KEY`, `AGENTOS_LLM_PROVIDER=anthropic` | Daily game plan on the Dashboard; structured extraction of pasted MLS alert emails in Buyer Scout; fact-restricted drafting in Listing Studio through the `LlmProvider` interface (`src/services/providers/anthropic.ts`). |
| **Obsidian** | `OBSIDIAN_VAULT_DIR` (+ `OBSIDIAN_WRITE_FOLDER`, `OBSIDIAN_INCLUDE_FOLDERS`, `OBSIDIAN_EXCLUDE_FOLDERS`, `OBSIDIAN_ALLOW_CLAUDE`) | **Settings → Re-index vault** indexes every `.md` (frontmatter, tags, wikilinks, excerpt, hash) into `vault_notes` and links notes to contacts/properties by frontmatter `contact:` / `fubId:` / `property:`, exact title, or `[[wikilink]]` — never fuzzy. Linked notes appear on the contact timeline in People & Deals. **Save game plan to Obsidian** writes a new note under `AgentOS/Game plans/`; AgentOS never edits or deletes existing notes. Vault excerpts reach Claude only when `OBSIDIAN_ALLOW_CLAUDE=true`. |

Steps (Mac Terminal or Windows PowerShell — one line at a time):

```bash
git clone https://github.com/HolisticDrBright/RealtorPro
cd RealtorPro
git checkout claude/agentos-live-data
npm install
copy .env.example .env      # Windows   (macOS: cp .env.example .env)
# edit .env: FUB_API_KEY, ANTHROPIC_API_KEY, AGENTOS_LLM_PROVIDER=anthropic, OBSIDIAN_VAULT_DIR
npm run setup
npm run dev
```

Then open http://localhost:3000 → **Follow Up Boss → Sync now**, **Settings → Re-index
vault**, **Dashboard → Ask Claude for today's game plan**. Run `npm run db:reset`
to wipe the local mirror; it never touches FUB or the vault.

Endpoints added on this branch: `GET /api/integrations/status`, `GET /api/contacts`,
`GET /api/contacts/:id/timeline`, `POST /api/obsidian/sync`, `GET /api/obsidian/notes`,
`POST /api/obsidian/write` (see [`docs/API.md`](./docs/API.md)).

## Known limitations

- **Single-agent, single-window app.** The six screens (Today, Buyer Scout,
  Listing Studio, People & Deals, Follow Up Boss, Settings) are rendered by one
  client shell that switches the active screen from global state — mirroring the
  design prototype. Per-screen deep-link routes are a natural future addition.
- **Screen content is seeded from the ported demo data** so the UI matches the
  handoff pixel-for-pixel; the interactive workflows (parse & rank, generate,
  sync, create task/note, approve, export) additionally call the real backend
  API and fall back to the prototype's simulated behavior if the API is
  unavailable, so a screen never breaks.
- **Real-time FUB webhooks require a secure hosted relay.** A local machine must
  not be exposed publicly; the local `/api/fub/webhook` receiver verifies
  signatures and is for development/documentation only (see the architecture doc).
- **Remote generation is opt-in and gated.** Every remote job needs an explicit
  in-app approval after a preflight cost estimate. Without keys, all generation
  runs on the local mock provider.
- **ffmpeg is optional.** If no binary is found, the video-assembly step writes a
  descriptive manifest instead of a rendered file.
- **The LLM/Higgsfield adapters are typed against their APIs** but are exercised
  only with real credentials, which this local-first setup does not ship.
