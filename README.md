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

- [`docs/API.md`](./docs/API.md) — every endpoint with request/response examples.
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — the fact ledger, provider
  adapters, local storage, and the future hosted webhook relay.

---

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
