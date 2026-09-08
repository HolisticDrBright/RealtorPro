# Ask Jarvis

Use **Ask Jarvis** in the top bar or sidebar. It uses the Claude API connection
already saved in Integrations. No new paid service, API key or browser extension
is required by this implementation. Anthropic API usage is still billed separately
from a Claude subscription.

## First conversation

1. Import the records you want to ask about into RealtorPro. Merely indexing
   Obsidian notes does not turn them into CRM records. Review and approve an
   Obsidian import first if needed.
2. Open Ask Jarvis and allow the stated CRM-sharing consent for this browser
   session. Type a question, or expand **Voice & privacy**, enable speech
   recognition, and press **Microphone**. Allow browser microphone access if asked.
3. Check the recognized words, then press **Ask Jarvis**. Optional controls send
   recognized questions automatically and read answers aloud. Recognition is
   push-to-talk, not an always-listening wake-word assistant.
4. Open **Records Jarvis consulted** to inspect the records behind a response.
   Answers can be wrong or incomplete; verify important facts.
5. Scheduling shows a review with names, dates and the app computer's time zone.
   Press **Approve & save** to create the displayed items, or **Discard drafts**.

Questions are saved locally and each has a reopenable `/jarvis/<id>` page. Follow-up
questions include up to four previous answers as context, with fresh record lookups
instructed for current facts. The sidebar shows the latest 40 questions.

## Useful questions

- “What are Alex Chen's buying criteria, and what information is missing?”
- “Which investors have a multifamily strategy? Show the saved budgets and areas.”
- “Summarize the off-market lead at 123 Main Street and my notes about it.”
- “Find Maria Lopez and draft a call reminder for October 6, 2030 at 10 AM.”
- “Draft a 30-minute local appointment with Maria Lopez on October 6, 2030 at 2 PM.”
- “Create a task to prepare Maria's property shortlist, due October 5, 2030.”

These names, addresses and dates are illustrative, not installed sample records.

## What it can and cannot do

Jarvis can search saved contacts, buyers, sellers, investors, properties, listings,
opportunities (including off-market leads), transactions, offers, milestones,
tasks, calls, appointments, CRM notes and activity. It can draft up to three new
tasks, call reminders or appointments per question, in one atomic approval batch.
It cannot edit/delete existing records, mark tasks complete, send messages,
place calls, send invitations, or book anything without approval.

**Appointments are local RealtorPro calendar entries, not Google/Apple calendar
events. Calls are reminders in Calls, not phone calls.** Existing local appointment
overlaps are rejected; this is not an availability check against Gmail, Google
Calendar, Apple Calendar, other people's calendars or call reminders. Date/time
interpretation uses the app computer's zone; review carefully around DST changes.
Missing meeting duration/end time or call date/time must be supplied.

Jarvis does not read raw Obsidian files or the vault index, Gmail, websites, MLS
or third-party property feeds. It cannot automatically discover information that
has not been saved in the CRM. It is not an investment, valuation or legal adviser.

## Privacy, voice and cost

CRM lookup happens locally, but the question, retrieved CRM fields (including
notes) and recent conversation context go to the connected Anthropic API.
Original vault-folder privacy controls govern vault extraction, not copies of
records already imported into the CRM. API keys and connection settings are
excluded from Jarvis tools. Retrieved text is treated as untrusted data.

Browser speech recognition is optional, has limited browser compatibility, and
may send audio to a browser provider; it is not guaranteed offline. Read-aloud
prefers a local English voice but can use the browser's default voice service.
RealtorPro stores text transcripts and answers, not audio. If speech is unavailable
or denied, type or use macOS dictation in the question field. See the browser
documentation for [speech recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
and [speech synthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis).

Each question allows at most 6 Claude requests, 10 tool calls, 2,200 output tokens
per request, 25 records per lookup, 10,000 scanned records per collection, and a
two-minute provider deadline. Long fields/results and context are bounded. These
are workload limits, **not a dollar spending cap**. Ask narrower questions if
results are incomplete. Only one question runs at a time in the local app process.
The answer records model ID, aggregate token counts and request count; exact dollar
cost is not guessed for custom models. Check your Anthropic usage for actual billing.
The implementation uses [Anthropic client tool use](https://platform.claude.com/docs/en/agents-and-tools/tool-use/handle-tool-calls).

History is part of the local SQLite workspace and database backups. It can contain
sensitive client details and is not separately encrypted by the app. Protect your
computer account and backups. There is no individual-conversation deletion UI in
this release; the existing destructive **Start fresh** action clears Jarvis history
along with the rest of CRM data, but does not remove historical backups.

## Approval and failure handling

Drafts do not write CRM/calendar rows. Approval rechecks validation, database
changes and appointment overlaps, creates a database backup, and saves the batch
atomically. Previews expire after 24 hours; changed data requires a fresh preview.
Repeated approval or retry of the same question ID does not duplicate records
or repeat a Claude call. Starting a new question is a new billable request.

If a request is interrupted, use its saved-question link/history before retrying.
An app shutdown can leave a question marked pending; it is not automatically
resumed or rebilled. Start a new conversation if it remains pending past two
minutes. Provider failures are stored with sanitized, actionable error text.

## Verification

`npm test` includes isolated Jarvis integration tests with only the paid Claude
provider boundary simulated. They exercise real SQLite retrieval, persisted
history, consent, idempotency, bounded tools, date validation, overlap checks,
draft previews, discard, backups and atomic approval.

`npm run test:jarvis-browser` requires the isolated browser fixture on port 3100
described in the existing browser scripts. It refuses a connected Claude key or
personal vault. Only speech and model output are simulated by the test harness;
the app has no demo-answer fallback. Missing-key errors, saved-history reads,
review approval, created tasks and mobile/desktop rendering use the real backend.
Live microphone recognition, spoken-audio quality and a paid Claude response
must still be checked on the target Mac/browser with the user's own account.

## Updating a Mac installation

Stop the app with Control-C, then run from its installation folder:

```bash
git pull --ff-only origin codex/production-readiness
npm ci
npm run setup
npm run build
npm run launch
```

Setup backs up existing data and adds the Jarvis history table. It does not seed
sample data, clear existing records, or require reconnecting Claude/Obsidian.
