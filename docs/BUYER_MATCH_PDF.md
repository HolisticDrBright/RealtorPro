# Buyer Match to a PDF handoff

1. Buyers → Buyer Match → **Match** beside a buyer/property.
2. Choose tone and optional writing preferences. Approve sending the listed
   data to your connected Claude API, then generate the email and SMS.
3. Review/edit recipient, subject and messages. **Save edits for PDF** before
   leaving. Repeat for other properties/buyers.
4. **Review PDF packet** shows the latest 200 completed drafts. Select up to
   50 matches, one version per buyer/property, review and approve the selection.
5. **Save PDF to Obsidian vault** creates one private PDF under your configured
   export folder (normally Command Center/Buyer Matches). A local copy remains
   in Saved packets; downloading works without a vault connection.
6. Give that PDF to Claude in your Gmail browser and ask it to create drafts,
   not send messages. The cover includes a handoff prompt.

No Gmail API setup, new Google permissions, browser automation or automatic
SMS is included. Existing Google Calendar connection is unchanged. Claude's
browser abilities depend on your own browser setup; RealtorPro does not execute
the handoff. Neither generating nor exporting increments properties sent.

## Data and review

Claude receives only the buyer's first name and structured search criteria,
property facts, computed fit reasons/concerns, agent signature and your writing
instructions. Internal CRM notes, phone/email, seller motivation, preapproval
and vault text are excluded. Keyword feature matches become unverified
confirmations, not guaranteed features. Prices and availability are saved
records, not independently verified live MLS data. Review AI text for accuracy,
confidentiality, property sharing permission and non-discriminatory language.

The PDF includes recipient addresses and multiple buyers' information. It is an
agent-only handoff, not an attachment to forward to buyers. Missing recipients
are explicitly flagged. PDF export is local and does not require Claude vault
text-sharing permission. Original notes are not edited.

Draft IDs, results, model, usage and source snapshots persist in SQLite. Cost
is unknown (null) rather than an invented estimate. Failed/truncated generations
are retained; retries with the same ID do not bill again. A new generation
creates a new version and selects it in place of the older version.

Exports are immutable PDFs; later edits require a new export. Exported drafts
are unchecked, not deleted. Files are saved with unique IDs and never overwrite
different content. A missing/unwritable vault does not discard the local PDF.
SQLite snapshots do not include the PDF files under
workspace/exports/buyer-matches; back up that folder and your vault separately.
Start fresh clears draft/packet database records but leaves exported PDFs and
vault files in place, like other exported artifacts.

English/Latin-script PDFs use embedded Noto Sans. Unsupported glyphs (including
some emojis and non-Latin scripts) cause an explicit export error instead of
silently producing unreadable boxes. Remove unsupported characters before
exporting. Long messages wrap across numbered pages.

## Verification

Tests cover real SQLite persistence, consent, stale edits, source minimization,
PDF generation, missing recipients, duplicate selections, queue reset, vault
path/symlink protections and no-overwrite recovery. The browser test runs only
on the isolated port-3100 fixture: paid model output is simulated, while draft
edits, PDF rendering/download and vault writes use actual app routes.
Live Claude quality and the external Gmail browser handoff still need testing
with your own accounts.
