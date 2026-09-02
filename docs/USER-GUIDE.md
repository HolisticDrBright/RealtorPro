# AgentOS — a realtor's guide to every tab

AgentOS is a local-first workspace that sits next to Follow Up Boss (FUB). FUB stays your
system of record; AgentOS mirrors it onto your computer, adds Claude for writing and
ranking, reads your Obsidian vault as memory, and never sends anything to a client on
its own. This guide walks the left-hand navigation top to bottom: what each tab does, how
to use it, and where it fits in a working day.

**One rule runs through everything:** every number and claim on screen is either a fact
with a source you can see, a calculation you can trace, or `[TBD — source required]`.
Nothing is guessed. Every outbound message is a **draft** you send yourself.

---

## A day in AgentOS (suggested rhythm)

1. **Morning (10 min).** Open **Dashboard**. Paste today's to-do list, press
   *Ask Claude for today's game plan*, glance at deal risks, calls and appointments.
2. **Between appointments.** Work from **Today** — the queue of next best actions.
   Press *N* anywhere to capture a note; it becomes a FUB draft note.
3. **When MLS alerts arrive.** Paste them into **Buyer Scout** and rank them against
   the buyer's written criteria. Save the good ones to a shortlist, create a FUB task
   to show them, draft the client email.
4. **When a listing goes live.** Use **Listing Studio** to build MLS copy, a social
   plan and media from the fact ledger; approve section by section.
5. **Weekly.** **People & Deals** for pipeline hygiene, **Follow Up Boss** for a sync,
   **Signal Scout** for who to reach out to next.
6. **Commercial / investment work.** **OM Studio**, **Rent Roll Studio**, **Comp Lab**
   and **Dev Visualizer** when the deal calls for them.

---

## Dashboard

**What it does.** Your home screen: a daily briefing (game plan) written from the facts
in your database, today's to-dos with checkboxes, calls to make, the work calendar,
year-to-date closings (listings vs buyers: deals, volume, GCI), active transactions,
active buyers with their criteria, buyer ↔ off-market matches, and contact lists
(hot buyers, warm buyers, sellers, past clients).

**How to use it.**
- *Paste today's to-do list* — one item per line. Start a line with `!` for a priority
  and `call:` for a call. Tick the boxes as you go.
- *Ask Claude for today's game plan* — Claude rewrites the plan from the same facts
  (needs `ANTHROPIC_API_KEY`). Without a key the local plan is shown.
- *Save game plan to Obsidian* — writes the plan as a note into the `AgentOS/Game plans`
  folder of your vault (appears when a vault is linked).
- Import calendar events by exporting an `.ics` file from Gmail/Google Calendar or
  Outlook and pasting it in (no account connection needed).
- Off-market matches use the same facts-only scorer as Buyer Scout; each match shows
  the reasons and the source of each reason.

**How it helps.** Replaces the morning scramble across FUB, calendar and notes with one
page that says what to protect, who to call and where you stand for the year.

---

## Today

**What it does.** The classic "next best actions" list built from the same live data as
the Dashboard: deal risks first, then priorities, calls, fresh off-market matches, then
the rest of the to-dos. Beside it: today's appointments and deal-risk alerts.

**How to use it.** Work top to bottom. *Open* jumps to the right tab with the right
contact already selected. Come back after each appointment.

**How it helps.** It keeps you on the highest-impact item instead of the loudest one.

---

## Buyer Scout

**What it does.** Ranks MLS alerts against a buyer's **written, objective criteria**
(price ceiling, areas, hard constraints, must-haves, weighted preferences). Every match
shows a fit score, the reasons with the source field for each, the tradeoffs, and a
"verify before recommending" note where a fact is missing.

**How to use it.**
1. Pick a buyer in the left rail, or press *+ New* to create a search from a FUB
   contact and the criteria you agreed with them.
2. Paste an MLS alert email (or the CSV text of an export) and press *Parse & rank*.
   With Claude on, the email is extracted by Claude; otherwise a deterministic parser.
3. For each match: *Open details*, *Save to shortlist*, *Create FUB task* (a "Show
   {address}" task on the linked FUB contact), or *Draft client email* (saved as a FUB
   draft — you send it).

**Guardrails.** Criteria that describe people or neighborhoods subjectively are
rejected (Fair Housing). Scoring uses listing facts only.

**How it helps.** Turns a 40-listing alert into a ranked short list with reasons you can
say out loud to the client — and a task and draft email in one click.

---

## Listing Studio

**What it does.** Builds a listing campaign from a **fact ledger** (facts imported from
MLS CSV plus facts you enter, each with a source): MLS paragraphs, a social plan,
virtual-staging/twilight imagery and a short video, with disclosures.

**How to use it.**
1. Pick the listing and confirm its facts and authorized media (photos you have rights
   to; virtual edits are always disclosed).
2. Choose brand voice, visual treatment and video format, then *Generate*.
3. Review each output tab and **approve section by section**. Nothing publishes or
   exports until approved; remote (paid) generation asks for a cost preflight and an
   explicit approval first.

**How it helps.** A complete, compliant campaign draft in minutes, with every claim
traceable to a fact.

---

## OM Studio (Offering Memorandum quality gate)

**What it does.** Source-grounded offering memorandums for commercial and investment
listings, with a mandatory **Three-Lens Review**: numbers re-traced and recomputed,
brand/template rights checked, and editability/export verified.

**How to use it.** Wizard (property → sources → your brand and template, with a rights
confirmation) → builder (11 pages, KPIs marked Imported / Calculated / Pending / TBD)
→ *Review & compliance* (resolve each finding) → approve → export **PPTX / XLSX / PDF**
with real editable text and tables. Pending values export as `—`, never an invented
number.

**How it helps.** Investor-grade packages without the risk of a wrong number or someone
else's branding slipping through.

---

## Dev Visualizer

**What it does.** Turns authorized aerials, site plans, surveys and maps into concept
visualizations: site-boundary overlay, land teaser, massing, future-use board,
construction-sequence video, aerial reel.

**How to use it.** Create a project → source & rights review → visual direction →
storyboard → generation queue → review and export. A glowing boundary overlay is only
allowed when a verified boundary source exists. Every visual carries a required,
editable disclosure; export unlocks after you approve it.

**How it helps.** Sell the vision of a site honestly — clearly labeled concepts, never
passed off as reality.

---

## Rent Roll Studio

**What it does.** Upload → map columns → validate → resolve issues → analyze → export for
multifamily, commercial and mixed-use rent rolls. Flags duplicates, missing IDs, bad
dates, inconsistent totals, rent-per-square-foot anomalies and occupancy mismatches;
computes occupancy, NOI and cap rate only when the data supports it, storing the formula
and source for each figure.

**How to use it.** Paste or upload the rent roll, confirm the column mapping, clear the
validation list, review the analysis, export the six-tab Excel workbook. Tenant PII is
redacted; you are warned before anything could leave the machine.

**How it helps.** Clean, defensible numbers that feed straight into OM Studio.

---

## Comp Lab

**What it does.** Import an authorized comp export, normalize, filter, compare and
explain. Produces a transparent comparability score from objective dimensions that have
data — never an appraisal, a "best comp" or an invented adjustment. Each comp shows its
source, freshness, missing fields and verification status.

**How to use it.** Import → set filters → review the comparability table → add your own
adjustments (labeled as assumptions) → export XLSX and a client PDF with disclaimers.

**How it helps.** Pricing conversations grounded in comps a client can inspect.

---

## Signal Scout

**What it does.** An explainable opportunity queue from sources you approved (FUB
activity, uploaded and licensed MLS/public-record data, your sphere, inbound). It is not
a "who will sell" predictor; confidence reflects how complete the data is. Each signal
shows source, freshness, why it surfaced and a suggested action.

**How to use it.** Work the queue: *Pursue*, *Snooze*, *Dismiss*, *Create FUB task*,
*Add FUB note*, or *Draft outreach* (draft only — you send it).

**How it helps.** A prioritized, honest list of who to call this week.

---

## People & Deals

**What it does.** Every contact in your local database (mirrored from Follow Up Boss on
sync, plus local-only records) with search and hot / warm / sellers / past-client
filters, and a unified timeline per contact: FUB notes, tasks, appointments and deals,
plus any **Obsidian notes** linked to that person.

**How to use it.** Search or filter, click a contact, read the timeline. *Open in Follow
Up Boss* jumps to the FUB record. Obsidian notes link when a note's frontmatter names
the contact (`contact:` or `fubId:`), when the note title is the contact's name, or when
the note contains a `[[wikilink]]` to them.

**How it helps.** One page with the whole relationship — CRM history and your own notes
side by side — before you pick up the phone.

---

## Follow Up Boss

**What it does.** Connection status, a manual **Sync now** that pulls people, deals,
tasks, notes and appointments into your local database, the sync log, and a plain
statement of what AgentOS may do in your account (read; create tasks; add draft notes;
never send email/SMS, create leads, edit or delete).

**How to use it.** Add your FUB API key to `.env` (`FUB_API_KEY`), restart the app, press
*Sync now*. Until a key is set the app shows fictional demo data and says so.

**How it helps.** Keeps FUB as the single source of truth while giving you a fast local
copy that Claude and the matching engine can work from.

---

## Settings

**What it does.** Your profile (name on drafts, license, service areas), the three data
connections with live status (Follow Up Boss, Claude, Obsidian vault) and their actions
(*Sync now*, *Try the briefing*, *Re-index vault*), defaults (brand voice, quiet hours,
nurture cadence), local-data export, and appearance (light/dark, Apple glass or flat).

**How to use it.** Check this tab first when something looks like demo data: each
connection tells you exactly which `.env` line to set.

---

## Connecting your real data

| Connection | What to set in `.env` | What it enables |
| --- | --- | --- |
| Follow Up Boss | `FUB_API_KEY` | People & Deals, Today, Dashboard and Buyer Scout show your real contacts, deals, tasks, notes and appointments after *Sync now*. |
| Claude | `ANTHROPIC_API_KEY` (+ `AGENTOS_LLM_PROVIDER=anthropic`) | Daily game plan; alert-email extraction in Buyer Scout; Listing Studio drafting. |
| Obsidian | `OBSIDIAN_VAULT_DIR` (optional `OBSIDIAN_WRITE_FOLDER`, `OBSIDIAN_ALLOW_CLAUDE`) | Vault notes on contact timelines; *Save game plan to Obsidian*; optional vault excerpts in the briefing. |

Keys stay on your machine. AgentOS never scrapes listing sites, never automates
outreach, and never sends your vault to Claude unless you opt in.
