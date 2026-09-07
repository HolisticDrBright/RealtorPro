# Graph Report - .  (2026-09-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 680 nodes · 2041 edges · 31 communities (26 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 16 edges (avg confidence: 0.73)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- API Responses and Recovery
- Obsidian Claude and MCP
- Matching and Business Calculations
- Shared UI and Reports
- Validated Imports and Rules
- Runtime Dependencies
- Client Records and Navigation
- Database Entity Schema
- Development Dependencies
- Database Setup and Demo Seed
- TypeScript Configuration
- Forms and CRUD State
- Dashboard Layout and Shell
- Initial Database Migration
- Connection and Backup Settings
- App Layout and Linting
- Listings and Transaction Views
- Layout and Security Tests
- Followup and Pipeline Views
- Private Local Startup
- MCP Verification
- Browser Verification
- Review Inbox Migration
- Next Build Configuration
- CSS Processing Configuration
- Design Theme Configuration

## God Nodes (most connected - your core abstractions)
1. `errorResponse()` - 60 edges
2. `ok()` - 60 edges
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
- `GET()` --indirect_call--> `d()`  [INFERRED]
  src/app/api/sphere/route.ts → src/db/seed.ts
- `CalendarPage()` --indirect_call--> `d()`  [INFERRED]
  src/app/calendar/page.tsx → src/db/seed.ts
- `ContactPage()` --indirect_call--> `d()`  [INFERRED]
  src/app/contacts/[id]/page.tsx → src/db/seed.ts

## Import Cycles
- None detected.

## Communities (31 total, 5 thin omitted)

### Community 0 - "API Responses and Recovery"
Cohesion: 0.08
Nodes (53): POST(), GET(), GET(), POST(), GET(), POST(), POST(), GET() (+45 more)

### Community 1 - "Obsidian Claude and MCP"
Cohesion: 0.06
Nodes (67): BASE, ENTITIES, server, text(), Input, POST(), GET(), GET() (+59 more)

### Community 2 - "Matching and Business Calculations"
Cohesion: 0.11
Nodes (43): GET(), Dash, brokerSplit(), estCommission(), GoalStats, grossCommission(), netIncome(), pct() (+35 more)

### Community 3 - "Shared UI and Reports"
Cohesion: 0.09
Nodes (38): Contact, TYPES, Dash, Report, Row, Note, Offer, STATUSES (+30 more)

### Community 4 - "Validated Imports and Rules"
Cohesion: 0.09
Nodes (42): nextRecurrence(), bool, defaultSort, ENTITY_NAMES, EntityName, int, list, num (+34 more)

### Community 5 - "Runtime Dependencies"
Cohesion: 0.04
Nodes (45): @anthropic-ai/sdk, better-sqlite3, drizzle-orm, @modelcontextprotocol/sdk, next, dependencies, @anthropic-ai/sdk, better-sqlite3 (+37 more)

### Community 6 - "Client Records and Navigation"
Cohesion: 0.21
Nodes (39): Buyer, BuyersPage(), Match, rank, CalendarPage(), Buyer, Call, CallsPage() (+31 more)

### Community 7 - "Database Entity Schema"
Cohesion: 0.05
Nodes (33): activities, ACTIVITY_TYPES, APPOINTMENT_TYPES, appointments, BUYER_TEMPS, buyers, calls, CONTACT_TYPES (+25 more)

### Community 8 - "Development Dependencies"
Cohesion: 0.07
Nodes (29): autoprefixer, drizzle-kit, eslint, eslint-config-next, devDependencies, autoprefixer, drizzle-kit, eslint (+21 more)

### Community 9 - "Database Setup and Demo Seed"
Cohesion: 0.10
Nodes (23): acts, at(), C, closed, closedOn(), contacts, d(), db (+15 more)

### Community 10 - "TypeScript Configuration"
Cohesion: 0.07
Nodes (27): dom, dom.iterable, esnext, next-env.d.ts, .next/types/**/*.ts, **/*.ts, **/*.tsx, compilerOptions (+19 more)

### Community 11 - "Forms and CRUD State"
Cohesion: 0.11
Nodes (21): Ev, TONE, ENTITY_LABEL, FIELDS, P, Field, FieldType, FormPanel() (+13 more)

### Community 12 - "Dashboard Layout and Shell"
Cohesion: 0.10
Nodes (18): BuyerRow, CallRow, CARD_ORDER, delta(), DragState, EscrowRow, KPI_ORDER, LABELS (+10 more)

### Community 13 - "Initial Database Migration"
Cohesion: 0.25
Nodes (18): `activities`, `appointments`, `buyers`, `calls`, `contacts`, `listings`, `milestones`, `notes` (+10 more)

### Community 14 - "Connection and Backup Settings"
Cohesion: 0.19
Nodes (14): Bundle, describe(), IntegrationsPage(), Report, Status, BackupSettings(), ClaudeSettings(), FolderListing (+6 more)

### Community 15 - "App Layout and Linting"
Cohesion: 0.14
Nodes (11): extends, ignorePatterns, node_modules/**, rules, @next/next/no-img-element, @next/next/no-page-custom-font, drizzle/**, .next/** (+3 more)

### Community 16 - "Listings and Transaction Views"
Cohesion: 0.25
Nodes (6): Listing, STATUSES, Ms, Tx, PropertyPhoto(), isToday()

### Community 17 - "Layout and Security Tests"
Cohesion: 0.33
Nodes (6): useLayoutOrder(), normalizeLayout(), swapLayout(), config, middleware(), fixture

### Community 18 - "Followup and Pipeline Views"
Cohesion: 0.29
Nodes (5): BUCKETS, Item, Cardd, Pipe, Avatar()

### Community 19 - "Private Local Startup"
Cohesion: 0.40
Nodes (4): child, token, tokenFile, workspace

### Community 20 - "MCP Verification"
Cohesion: 0.50
Nodes (4): call(), client, transport, workspace

## Knowledge Gaps
- **245 isolated node(s):** `next/core-web-vitals`, `drizzle/**`, `workspace/**`, `node_modules/**`, `@next/next/no-img-element` (+240 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ymd()` connect `Client Records and Navigation` to `Obsidian Claude and MCP`, `Matching and Business Calculations`, `Shared UI and Reports`, `Validated Imports and Rules`, `Database Setup and Demo Seed`, `Forms and CRUD State`, `Listings and Transaction Views`, `Followup and Pipeline Views`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `errorResponse()` connect `API Responses and Recovery` to `Obsidian Claude and MCP`, `Matching and Business Calculations`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `ok()` connect `API Responses and Recovery` to `Obsidian Claude and MCP`, `Matching and Business Calculations`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **What connects `next/core-web-vitals`, `drizzle/**`, `workspace/**` to the rest of the system?**
  _245 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `API Responses and Recovery` be split into smaller, more focused modules?**
  _Cohesion score 0.07703081232492998 - nodes in this community are weakly interconnected._
- **Should `Obsidian Claude and MCP` be split into smaller, more focused modules?**
  _Cohesion score 0.060694579681921455 - nodes in this community are weakly interconnected._
- **Should `Matching and Business Calculations` be split into smaller, more focused modules?**
  _Cohesion score 0.10885341074020319 - nodes in this community are weakly interconnected._