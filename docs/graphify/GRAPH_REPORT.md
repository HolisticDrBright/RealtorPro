# Graph Report - .  (2026-09-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 715 nodes · 2128 edges · 35 communities (28 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Validated API and Reviews
- Matching and Business Calculations
- Obsidian Vault and MCP
- Shared UI and Reports
- Runtime Dependencies
- Claude Credentials and Extraction
- Database Entity Schema
- Client Records and Navigation
- Connection and Backup Settings
- Forms and App Shell
- Development Dependencies
- TypeScript Configuration
- Imports and Business Rules
- Dates and Calendar Views
- Initial Database Migration
- Desktop Launch and Security
- Opt-in Demo Seed
- App Layout and Linting
- Dashboard Cards and Layout
- Database Setup and Paths
- Native Mac Keychain Helper
- MCP Verification
- Browser Verification
- Review Inbox Migration
- Setup Port Safety
- Backed Up Data Clearing
- Next Build Configuration
- CSS Processing Configuration
- Design Theme Configuration

## God Nodes (most connected - your core abstractions)
1. `errorResponse()` - 62 edges
2. `ok()` - 62 edges
3. `useApi()` - 48 edges
4. `label()` - 36 edges
5. `ymd()` - 33 edges
6. `fmtDate()` - 33 edges
7. `useCrud()` - 32 edges
8. `toast()` - 32 edges
9. `fmtMoney()` - 31 edges
10. `readJson()` - 26 edges

## Surprising Connections (you probably didn't know these)
- `extractRecordsFromNotes()` --indirect_call--> `text()`  [INFERRED]
  src/services/claude.ts → scripts/mcp-server.ts
- `vaultTasks()` --indirect_call--> `text()`  [INFERRED]
  src/services/obsidian.ts → scripts/mcp-server.ts
- `main()` --calls--> `isOurAppReady()`  [EXTRACTED]
  scripts/start.ts → src/lib/desktop.ts
- `main()` --calls--> `openAppBrowser()`  [EXTRACTED]
  scripts/start.ts → src/lib/desktop.ts
- `main()` --calls--> `parsePort()`  [EXTRACTED]
  scripts/start.ts → src/lib/desktop.ts

## Import Cycles
- None detected.

## Communities (35 total, 7 thin omitted)

### Community 0 - "Validated API and Reviews"
Cohesion: 0.06
Nodes (71): POST(), GET(), GET(), POST(), GET(), POST(), GET(), Ctx (+63 more)

### Community 1 - "Matching and Business Calculations"
Cohesion: 0.11
Nodes (43): GET(), GET(), Dash, brokerSplit(), GoalStats, grossCommission(), netIncome(), pct() (+35 more)

### Community 2 - "Obsidian Vault and MCP"
Cohesion: 0.09
Nodes (43): BASE, ENTITIES, server, text(), GET(), POST(), g, ContactRef (+35 more)

### Community 3 - "Shared UI and Reports"
Cohesion: 0.09
Nodes (38): Contact, TYPES, BUCKETS, Item, Dash, Report, Row, Note (+30 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.04
Nodes (46): @anthropic-ai/sdk, better-sqlite3, drizzle-orm, @modelcontextprotocol/sdk, next, dependencies, @anthropic-ai/sdk, better-sqlite3 (+38 more)

### Community 5 - "Claude Credentials and Extraction"
Cohesion: 0.10
Nodes (34): POST(), Input, POST(), GET(), claudeKey(), claudeModel(), claudeStatus(), connectionFile() (+26 more)

### Community 6 - "Database Entity Schema"
Cohesion: 0.05
Nodes (33): activities, ACTIVITY_TYPES, APPOINTMENT_TYPES, appointments, BUYER_TEMPS, buyers, calls, CONTACT_TYPES (+25 more)

### Community 7 - "Client Records and Navigation"
Cohesion: 0.25
Nodes (32): Buyer, BuyersPage(), Match, rank, CallsPage(), ContactPage(), ContactsPage(), FollowUpsPage() (+24 more)

### Community 8 - "Connection and Backup Settings"
Cohesion: 0.10
Nodes (26): Bundle, describe(), IntegrationsPage(), Report, Status, CATS, Task, View (+18 more)

### Community 9 - "Forms and App Shell"
Cohesion: 0.11
Nodes (24): Listing, STATUSES, Ms, Tx, ENTITY_LABEL, FIELDS, P, MORE (+16 more)

### Community 10 - "Development Dependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, drizzle-kit, eslint, eslint-config-next, devDependencies, autoprefixer, drizzle-kit, eslint (+21 more)

### Community 11 - "TypeScript Configuration"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions (+19 more)

### Community 12 - "Imports and Business Rules"
Cohesion: 0.16
Nodes (26): estCommission(), nextRecurrence(), addr(), afterCreate(), afterUpdate(), defaultMilestones(), logActivity(), notify() (+18 more)

### Community 13 - "Dates and Calendar Views"
Cohesion: 0.21
Nodes (16): CalendarPage(), Ev, TONE, Buyer, Call, Activity, Contact, Tx (+8 more)

### Community 14 - "Initial Database Migration"
Cohesion: 0.25
Nodes (18): `activities`, `appointments`, `buyers`, `calls`, `contacts`, `listings`, `milestones`, `notes` (+10 more)

### Community 15 - "Desktop Launch and Security"
Cohesion: 0.24
Nodes (11): main(), useLayoutOrder(), isOurAppReady(), openAppBrowser(), parsePort(), portIsOpen(), normalizeLayout(), swapLayout() (+3 more)

### Community 16 - "Opt-in Demo Seed"
Cohesion: 0.13
Nodes (16): acts, C, closed, closedOn(), contacts, db, escrows, iso() (+8 more)

### Community 17 - "App Layout and Linting"
Cohesion: 0.14
Nodes (11): extends, ignorePatterns, node_modules/**, rules, @next/next/no-img-element, @next/next/no-page-custom-font, drizzle/**, .next/** (+3 more)

### Community 18 - "Dashboard Cards and Layout"
Cohesion: 0.17
Nodes (10): BuyerRow, CallRow, CARD_ORDER, delta(), DragState, EscrowRow, KPI_ORDER, LABELS (+2 more)

### Community 19 - "Database Setup and Paths"
Cohesion: 0.36
Nodes (3): DbType, DB_FILE, WORKSPACE_SUBDIRS

### Community 20 - "Native Mac Keychain Helper"
Cohesion: 0.33
Nodes (5): Foundation, Never, OSStatus, fail(), Security

### Community 21 - "MCP Verification"
Cohesion: 0.50
Nodes (4): call(), client, transport, workspace

## Knowledge Gaps
- **251 isolated node(s):** `next/core-web-vitals`, `drizzle/**`, `workspace/**`, `node_modules/**`, `@next/next/no-img-element` (+246 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ymd()` connect `Dates and Calendar Views` to `Matching and Business Calculations`, `Obsidian Vault and MCP`, `Shared UI and Reports`, `Client Records and Navigation`, `Connection and Backup Settings`, `Forms and App Shell`, `Imports and Business Rules`, `Opt-in Demo Seed`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `errorResponse()` connect `Validated API and Reviews` to `Matching and Business Calculations`, `Obsidian Vault and MCP`, `Claude Credentials and Extraction`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `ok()` connect `Validated API and Reviews` to `Matching and Business Calculations`, `Obsidian Vault and MCP`, `Claude Credentials and Extraction`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `drizzle/**`, `workspace/**` to the rest of the system?**
  _251 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Validated API and Reviews` be split into smaller, more focused modules?**
  _Cohesion score 0.06323232323232324 - nodes in this community are weakly interconnected._
- **Should `Matching and Business Calculations` be split into smaller, more focused modules?**
  _Cohesion score 0.1069182389937107 - nodes in this community are weakly interconnected._
- **Should `Obsidian Vault and MCP` be split into smaller, more focused modules?**
  _Cohesion score 0.08974358974358974 - nodes in this community are weakly interconnected._