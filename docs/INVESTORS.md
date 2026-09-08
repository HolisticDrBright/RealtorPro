# Investors

Open **Investors** in the sidebar. This is a real, empty-by-default CRM section,
not a demo dashboard. No additional API or subscription is needed for manual use.

## Add or update an investor

- **New investor contact** saves the person's contact details, then opens their
  investor profile. If you close the second form, the saved contact remains;
  use **Existing contact profile** to finish later.
- **Existing contact profile** attaches investment criteria to an existing person.
  A buyer or seller can also be an investor without duplicating their contact.
- Record primary strategy, markets, property types, purchase-budget range,
  financing, timeline, must-haves, deal breakers, and notes. Use notes for
  additional strategies. Status can be active, nurture, or paused.
- Available capital is **self-reported**, not verified funds. Leave unknowns
  blank. Cap-rate and cash-on-cash fields are the investor's **stated targets**,
  not calculated performance or a recommendation.
- **Task**, **Call**, and **Follow-up** use the same contact and history as the
  rest of the app. Set the next follow-up date on the linked contact. Pausing
  an investor profile does not cancel existing tasks or scheduled calls.
- Delete removes only the investor profile, not the contact. Deleting the
  contact also removes its investor profile.

Search by name, market, strategy, property type, or notes; filter by status.
Global search also finds investor criteria. This local release displays up to
1,000 profiles and contact lookups; counts and client-side filters use loaded rows.

## Import from your connected vault or Claude

Connecting a vault indexes notes; connecting Claude enables extraction. Neither
alone creates CRM records. In **Integrations**, use **Read vault with Claude**
(with your existing vault and explicit sharing enabled), inspect the proposed
fields, then approve. **Review Inbox** also stores proposals for later approval.
Claude can now propose an `investor` profile inside each contact. Its actual
extraction quality depends on the source notes and your configured model.

For local import without an API call, a note can use this frontmatter shape
(example only; this is not installed as sample data):

```yaml
---
type: investor
name: Example Investor
email: investor@example.com
strategy: buy_and_hold
status: active
targetAreas: [Example City]
propertyTypes: [Duplex, Multifamily]
budgetMin: 400000
budgetMax: 900000
availableCapital: 200000
financingType: Conventional
timeline: Next six months
targetCapRate: 6
mustHaves: [Property manager available]
dealBreakers: [Major structural repairs]
nextFollowUp: 2026-10-01
---
```

Choose **Import typed notes**, review, then approve. Recognized strategies:
`buy_and_hold`, `fix_and_flip`, `brrrr`, `short_term_rental`, `development`,
`commercial`, `other`. Free-form notes do not need this format when using Claude.

Repeated imports match the contact using the existing email/phone/name rules
and update its single investor profile. Unknown/null values and empty arrays
do not erase existing criteria; use Edit to intentionally clear fields.
Imports that conflict with an existing budget range fail without saving a
partial import. Approvals create a database backup and reject stale previews.
Claude Desktop's MCP tools also support investor proposals; restart the MCP
connection after updating the app.

## Included boundaries

This section does **not** yet calculate deal returns, parse rent rolls, produce
offering memorandums, automatically match investor deals, verify proof of
funds, scrape MLS/Zillow, or connect to Follow Up Boss. The Opportunities link
opens the existing locally entered/imported opportunities. No external deal
feed or extra API is activated by this release. Claude extraction uses your
existing Anthropic API connection and incurs normal provider usage charges.

## Update safely

Stop RealtorPro before updating. Run `npm ci`, `npm run setup`, and
`npm run build`, then launch. Setup backs up the existing database and adds
the investors table without clearing contacts, connections, or vault notes.
Older backups have the older database schema and are not directly restorable
into a newer schema by the app's strict restore check; keep the matching app
version if you need a full rollback.
