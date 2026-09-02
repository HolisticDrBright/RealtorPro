# Vanessa Real Estate — Command Center

A luxury real estate operating system for one agent: CRM, tasks, call list,
buyers with criteria, seller pipeline, listings, Kanban sales pipeline, escrow
timelines, offers, opportunities, income tracking against a $200K goal,
analytics, calendar, notes, stay-in-touch and follow-up automation — in one
clean, local-first web app. Seeded with realistic (fictional) Orange County
luxury data so the dashboard is complete on first launch.

## Run it

```bash
git clone https://github.com/HolisticDrBright/RealtorPro   # skip if you already have the folder
cd RealtorPro
git fetch origin
git checkout claude/command-center
npm install
npm run setup     # creates workspace/command-center.db and seeds sample data
npm run dev       # http://localhost:3000
```

Windows PowerShell: run the same commands one per line. Node 22 or 24 is
required; no compiler is needed (SQLite ships as a prebuilt binary). To start over with
fresh data: `npm run db:reset` then `npm run setup`.

## What's inside

| Area | Where | Notes |
| --- | --- | --- |
| Dashboard | `/` | Greeting + date, 7 KPIs, goal progress, **Today's Priorities** (auto-surfaced from overdue tasks, calls due, hot buyers without recent contact, listing activity, escrow deadlines ≤72h, offers awaiting response, listing appointments, uncontacted leads, overdue follow-ups, birthdays), schedule, call list with power dialer, hot buyers, active listings, in escrow, sales chart, income goal tracker, smart alerts, recent activity, buyer matches. Priorities are drag-reorderable. |
| Tasks | `/tasks` | Today / Upcoming / Overdue / Completed / All, 8 categories, priorities, due date + time, links to client/property/transaction, recurring tasks (daily/weekly/monthly auto-create the next one), drag to reorder or move between days. |
| Calls | `/calls` | Daily call list with type, priority, reason, last contact, next follow-up; Call / Text / Email / Complete / Reschedule; counters; **Power Dialer** slide-over. Completing a call updates the contact's last-contact date and timeline. |
| Buyers | `/buyers` | Buyer cards with every criterion, HOT / WARM / NURTURE (hot rises to the top), sent/toured/offers counters, and **Buyer Match** (listings + opportunities scored against price, area, beds/baths/sqft, type, must-haves, deal breakers). |
| Sellers | `/sellers` | Seller pipeline board (8 stages, drag between) and table. |
| Listings | `/listings` | Photo cards with price, $/sqft, DOM, showings, offers, open houses, commission, next action, buyer-match count; status filter; moving a listing to **In Escrow** creates the transaction + timeline. |
| Pipeline | `/pipeline` | 12-stage Kanban of contacts, drag between stages, total / weighted volume and GCI. |
| Transactions | `/transactions` | Escrow cards with days-to-close and next deadline; detail with editable 11-step timeline (deadlines within 72h highlighted), gross/net math, mark closed (updates YTD, GCI, net, goal, listing and client automatically). |
| Contacts | `/contacts`, `/contacts/:id` | Full profile, chronological activity timeline, log-a-touch, one-click follow-up scheduling, business totals, buyer/seller profiles, tasks, appointments, notes. One contact row serves as buyer and seller. |
| Calendar | `/calendar` | Day / Week / Month; appointments + escrow deadlines + dated tasks. |
| Sales & Income | `/income` | Closed-transaction table (closing date, address, city, side, price, %, gross, referral, split, expenses, net) with totals and Year / Month / Quarter / City / Side filters; **$200K goal tracker** with remaining, monthly target, average, projection, pending, pipeline and *deals needed*. |
| Reports | `/reports` | Monthly volume / net / closings, averages, listings taken/sold, buyer vs seller, days to close, conversion rates, lead sources (leads, closings, revenue, net, conversion, share). |
| Notes | `/notes` | Quick capture, pin, attach to contact / property / transaction, search. |
| Offers | `/offers` | Offer tracker with counters, financing, contingencies and 7 statuses. |
| Opportunities | `/opportunities` | Off-market / coming soon / pocket / tear-down / investment with buyer matches. |
| Stay in Touch | `/sphere` | Birthdays, purchase anniversaries, touchpoints, clients not contacted in 60+ days. |
| Needs Follow-Up | `/followups` | Overdue, hot-no-contact, 7/14/30-day, timeline and check-back buckets with one-click scheduling. |

Global: search bar / **⌘K command palette** (contacts, addresses, phone
numbers, listings, transactions, notes, tasks, opportunities + commands),
**+ Add** for Task / Call / Buyer / Seller / Contact / Listing / Transaction /
Note, notification center, keyboard shortcuts (`n` task, `c` contact, `a` add
menu, `/` search, `g 1–9` pages, `Esc` close). Sortable/filterable tables,
slide-over forms, inline status changes, confirm-before-delete, clickable
phones and emails, empty states, responsive layout.

## Architecture

- **Next.js 15 App Router + React 19 + TypeScript + Tailwind.** One page per
  section under `src/app/*`, shared shell in `src/components/app/shell.tsx`.
- **SQLite + Drizzle.** Schema in `src/db/schema.ts`; migrations in
  `drizzle/`; seed in `src/db/seed.ts` (dated relative to today).
- **Generic CRUD API.** `GET/POST /api/<entity>` and
  `GET/PATCH/DELETE /api/<entity>/:id` for every table, driven by
  `src/lib/registry.ts` (Zod validation, searchable columns, default sort).
  List filters: `?field=value`, `?q=text`, `?sort=&dir=&limit=`.
- **Business rules in one place.** `src/services/hooks.ts` runs after
  create/update: call completed → last contact; listing → in escrow → open
  transaction + milestones; transaction closed → listing, client, income;
  recurring task → next occurrence; offer accepted → notification, etc.
- **Computed endpoints.** `/api/dashboard`, `/api/pipeline`, `/api/income`,
  `/api/analytics`, `/api/search`, `/api/match`, `/api/followups`,
  `/api/sphere`, `/api/calendar`.
- **Pure, tested logic** in `src/lib`: commission/net/goal math, priority
  ranking, buyer matching, follow-up buckets, date helpers (`npm test`).

### Data model

`contacts` (one person; type buyer/seller/past client/lead/agent/vendor/sphere;
pipeline stage) ← `buyers`, `sellers` (profiles) · `properties` ← `listings`,
`transactions` (← `milestones`), `offers`, `opportunities` · `tasks`, `calls`,
`appointments`, `notes`, `activities`, `touchpoints`, `notifications`,
`settings` (agent, goal, default commission/split). Income is derived from
transactions: gross = price × %, net = gross − referral − split − expenses.

### Claude and Obsidian (connected)

Open **Integrations** in the sidebar. Both are optional and off until you add a
line to `.env` and restart.

**Claude** — `ANTHROPIC_API_KEY=` (from console.anthropic.com).
- Dashboard → *✦ Ask Claude for a game plan* writes the morning briefing from
  the facts on the page (escrow deadlines, calls, hot buyers, goal).
- Integrations → *Extract records with Claude*: paste an email thread, meeting
  notes, a lead sheet or a spreadsheet dump. Claude returns contacts, buyers,
  sellers, properties, listings, escrows, tasks and notes; you review the list
  and press Import. Records are upserted by email / phone / name / address, so
  re-importing never duplicates a person.

**Obsidian** — `OBSIDIAN_VAULT_DIR=` (path to your vault folder).
- Notes are read in place and indexed automatically whenever a file changes.
  Any note whose frontmatter, title or `[[wikilink]]` names a contact or
  address appears on that contact's profile and in Notes; `- [ ]` checkboxes in
  today's daily note or in notes tagged `#command-center` show in Today's
  Priorities.
- Notes with `type: contact | buyer | seller | property | listing | transaction
  | task | opportunity` in their frontmatter are importable: Integrations →
  *Import records from vault* → review → Import. Field reference is on that
  page.
- The app only ever writes into the `Command Center/` folder of your vault.

**Claude Cowork / Claude Desktop / Claude Code writing to the dashboard.**
The app ships an MCP server (`scripts/mcp-server.ts`) that exposes
`get_dashboard`, `search`, `list_records`, `get_record`, `create_record`,
`update_record`, `delete_record`, `import_records`, `add_tasks` and
`log_activity`. With the app running, `npm run mcp:config` prints the config
block; paste it into Claude Desktop / Cowork → Settings → Developer → Edit
Config (or use `claude mcp add`). Then a Claude agent that has searched your
MLS or read your inbox can call `import_records` / `add_tasks` and the
dashboard updates on its next refresh. Writes go through the same validation
and business rules as the UI. The app never scrapes listing sites itself; the
agent brings the data it is authorized to use.

### Integration points (not yet connected)

- **Google Calendar / Gmail** → sync into `appointments` / activity timeline
  via `POST /api/appointments` and `/api/activities` (add `src/services/google.ts`),
  or let a Claude agent with your Gmail connector call `add_tasks` over MCP.
- **MLS / real-estate APIs** → `POST /api/import/apply` with `listings` +
  `properties` (same bundle the MCP `import_records` tool uses).
- **Contact sync** → the same bundle's `contacts` (matched on email/phone/name).
- **SMS / calling** → log `calls`/`activities`; the UI already links `tel:`/`sms:`.
- **Commission accounting / documents** → `transactions.notes` today; add a
  `documents` table alongside `milestones`.

All business rules stay in `src/services/hooks.ts`, so a new integration just
writes rows through the same API and the dashboard, pipeline and income update
automatically.

Sample data is fictional. The database lives in `workspace/` and is gitignored.
