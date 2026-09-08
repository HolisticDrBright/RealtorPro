# RealtorPro — Private Command Center

A local, single-user real-estate CRM for MacBooks and Windows. Contacts, buyer criteria,
seller pipeline, investor profiles, listings, transactions, tasks, local appointments, notes,
income tracking and buyer matching share a SQLite database.

This release hardens the `claude/command-center` branch. It is **not a public
multi-user SaaS**, and it does not include the commercial studios from the
older AgentOS branch. A new workspace starts empty. Existing data is preserved
by setup; no sample data is loaded automatically.

Installing on a MacBook? See [Mac setup](docs/MAC_SETUP.md) for double-click
launchers, Keychain and the native vault chooser. See [Project graph](docs/graphify/README.md)
for the generated Graphify architecture map.

See [Investors](docs/INVESTORS.md) for buying criteria, self-reported capital,
shared follow-ups, and approved imports from Claude or Obsidian.

**[Ask Jarvis](docs/JARVIS.md)** answers typed or spoken questions about app records,
permitted Obsidian notes (including unimported notes) and the selected Google
Calendar. It can propose filling editable fields, creating/updating/deleting app
records, notes, alerts and tasks, editing a vault note, or creating a Google event.
Every change requires approval. Sources and conversations are saved. Credentials,
hidden/excluded files, Gmail, invitations and automatic two-way sync are excluded.
**[Connect Google Calendar](docs/GOOGLE_CALENDAR.md)** in Integrations using your
own Google OAuth client; setup and test instructions are built into that screen.

**Off-Market** in the sidebar shows off-market and pocket-listing leads from
the existing Opportunities records—no duplicate database or new API needed.
Add/edit a lead, record its source and expected price, search by address/area/source,
and track New → Watching → Pursuing → Matched. Archived/dead leads remain
available in the status filter and can be restored. Notes and follow-up tasks
can use the linked contact. Existing approved opportunity imports appear here
when their type is `off_market` or `pocket_listing`; other types stay in All
opportunities. Buyer matches are criteria hints, not verified suitability.
This tab does not automatically discover owners, scrape websites, send outreach,
or match investor profiles. No sample leads are loaded.

## Start locally

Use Node.js 22.12+ or Node.js 24. From this project folder:

```powershell
npm ci
npm run setup
npm run build
npm start
```

Open [RealtorPro](http://127.0.0.1:3000) directly in your browser.
Development only: `npm run dev` instead of build/start.
On Mac, `npm run launch` opens the browser when ready; afterward you can
double-click **Start RealtorPro.command**. Apple Command Line Tools are needed
to compile the Keychain helper during setup.
The app binds to 127.0.0.1. Do not expose it through a tunnel, proxy, LAN
interface, or public host. Mobile layout is supported, but direct phone access
over the network is intentionally not enabled in this private release.

The default database is `workspace/command-center.db`. An optional
`WORKSPACE_DIR` in `.env` changes its location. Use a local folder, not a
network share or a live cloud-synced SQLite folder. Stop all app instances
before changing versions or running setup. Setup backs up an existing
database before migration and never seeds or clears it.

## Connect from the app

Open **Integrations**:

1. Set your name, brokerage and annual goal. Check commission terms on each deal.
   Brokerage split means the percentage **paid to the broker/team**, not the
   percentage you retain. Existing transactions keep their own saved terms.
2. **Claude:** paste your Anthropic API key, check the model ID and select
   **Save & test Claude**. No restart needed. This verifies credentials and
   model access, not generation credits. API usage is billed by Anthropic
   separately from a Claude subscription.
3. **Obsidian:** on Mac, use **Choose vault on this Mac…**, or select **Browse folders**, navigate to your vault root
   (the folder containing `.obsidian`), choose **Use this vault**, and
   **Save & connect vault**. Or paste the full folder path.
4. Optionally restrict included/excluded folders. Vault text stays local
   unless you explicitly enable the Claude-sharing checkbox and save.
   CRM records you explicitly import can subsequently be used by AI features.
5. **Import typed notes** reads frontmatter locally. **Read vault with Claude**
   reads free-form notes using your API account. Both produce a review before
   saving records.

The selected model can be changed. The default `claude-sonnet-4-6` is a
documented, supported model ID; check [Anthropic's model documentation](https://platform.claude.com/docs/en/models/sonnet-4-6/overview)
for its capabilities. Availability is checked against your account.

Saved API keys use macOS login Keychain or Windows DPAPI, bound to your OS account.
Keys are not returned to the browser, stored in browser storage, or included
in database snapshots. The settings file contains a Keychain reference on Mac,
encrypted key material on Windows, and vault paths; protect your workspace.
Linux uses an environment key. Moving between operating systems requires
reconnecting. A locked Keychain produces an error, not a silent fallback.

An app-saved connection overrides its legacy `.env` setting. Disconnect
overrides an environment key/path too. Disconnecting a vault removes its
local index, not your original notes or already imported CRM records.

Vault scans skip hidden and linked directories, reject notes over 2 MB and
limit traversal to 25,000 entries / 30 nested folders. AI extraction defaults
to 20 newest notes in the chosen folder, with limits of 240,000 characters and
five provider requests. Oversized notes are rejected, never silently clipped.
Choose one client folder at a time. These limits are not a dollar-spend cap.

## Arrange the dashboard

Click **Arrange dashboard**. Drag a ⋮⋮ handle onto another tile/card to swap
them within the same group. Mouse and touch input are supported. Alternatively
focus a handle and use arrow keys, or use the visible ← / → buttons.
**Reset layout** restores the defaults. Layout is saved in that browser only;
clearing browser storage removes it. Reordering individual priorities remains
a separate control.

## Review Inbox and Claude Desktop / Code

`npm run mcp:config` prints the local MCP configuration. Add it to your
desktop agent's MCP settings and keep this app running.

The agent can read CRM records, search, and propose create/update/delete/import
operations. Writes are queued in **Review Inbox**. Agents cannot approve their
own changes or change connections, clear data, or restore backups.

Review full proposed fields before approving. Approvals:
- Require an existing stored proposal, not a fresh arbitrary bundle.
- Expire after a day and reject when CRM data changes after preview.
- Apply transactionally, with a verified database backup first.
- Return the previous result on retry instead of applying twice.

Reject and regenerate stale proposals. Only connect trusted agents: MCP read
access includes your CRM information. Obsidian privacy controls apply to
original vault text, not independent file access you give another application.

## Backups and recovery

Integrations → **Backups & recovery** creates and verifies a database snapshot.
Snapshots are also made before approved AI changes and clearing records.
Choose a snapshot and type **RESTORE** to restore it. Current data is backed
up first. Restored pending proposals are rejected to prevent old approvals.

Snapshots contain private CRM data and cached vault excerpts. They are **not
encrypted database files**, do not include API keys, and do not back up the
original Obsidian vault. Keep a separate protected off-device backup of both
the workspace and vault. Automatic snapshots are not automatically pruned;
monitor disk space.

The app only restores snapshots with the same database schema. To recover a
pre-upgrade snapshot, stop the app and use the matching previous app version
with a separate workspace copy. Keep the current workspace intact.

Unsafe `db:reset` and `db:clear` CLI operations are disabled. Use the backed-up
clear action in the app. Demo seeding requires both `ALLOW_DEMO_DATA=YES`
and a separate workspace path ending in `-demo`; never use this for real data.

## Verification

```powershell
npm test
npm run typecheck
npm run lint
npm audit
npm run build
```

Tests use temporary synthetic fixtures, not production data. The app itself
does not ship active fixture records.

`npm run test:browser` runs real Chromium/Edge UI checks against an isolated
test server at `http://127.0.0.1:3100` (override `TEST_URL`). It deliberately
refuses a connected Claude account or a non-test vault. On Windows it uses
installed Edge; other platforms need `npx playwright install chromium`.
See `scripts/verify-browser.mjs` for fixture checks. A live Anthropic generation
and the user's own vault still require a user-controlled acceptance test.

To prepare the browser test, start a second instance using
`WORKSPACE_DIR=../RealtorPro-browser-workspace` and `PORT=3100`, run setup,
then connect `tests/fixtures/realtorpro-browser-vault` from Integrations
with Claude disconnected and vault sharing off. Run `npm run test:browser`.
After that, `node scripts/verify-mcp.mjs` checks the real stdio connection.
Never point these verification scripts at your personal workspace.

## Not implemented in this branch

- Gmail and automatic two-way Google Calendar sync. Google OAuth, selected-calendar
  reads and reviewed event creation are available; local and Google views remain separate.
- Follow Up Boss integration.
- OM Studio, Rent Roll Studio, Comp Lab, Signal Scout, media/video generation.
- Direct MLS/Zillow ingestion or licensed property-photo acquisition.
- Multi-user accounts, remote access, background job durability, automatic
  off-device backup and a packaged installer.

Do not treat local empty states or disabled integrations as live connections.
Imports use conservative natural-key matching; unit addresses and city
differences are preserved, and ambiguous people require resolution. Historical
listing/transaction reconciliation still needs human review. No software
matching replaces verification of the underlying property and client records.

## Architecture and security scope

Next.js 15 / React 19 / TypeScript / Tailwind; Drizzle over SQLite in WAL mode.
Route handlers validate input; business hooks update related records locally.
Connection settings are server-only files. The launcher creates a random local
session token; browser sessions use an HttpOnly SameSite cookie. APIs reject
cross-site/unauthenticated requests and non-localhost hosts. MCP uses a local
bearer token restricted to reads and proposal creation.

This protects against ordinary cross-site requests, not malicious software
running as your OS account. SQLite, snapshots and local session files
inherit your workspace's filesystem access. Use a protected Mac/Windows account,
full-disk encryption and trusted software. Do not host this release publicly.
