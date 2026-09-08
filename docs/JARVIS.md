# Ask Jarvis — app, vault and Google Calendar

Open **Ask Jarvis** in the top bar or sidebar. It uses the existing Claude API
connection. Type or press Microphone; optional controls send recognized questions
automatically and read answers aloud. This is push-to-talk, not an always-listening
wake-word assistant. Anthropic API billing remains separate from a Claude subscription.

## What Jarvis can do

Jarvis can read every app record collection: contacts, buyers, sellers, investors,
properties, listings, opportunities, transactions, milestones, offers, tasks,
calls, appointments, CRM notes, activity, touchpoints, notifications and agent profile.
It can propose filling any editable field, creating linked records, updating,
completing tasks or deleting app records using the app's schemas and relationship hooks.
Generated IDs/timestamps, database internals, credentials and connection controls
are not editable fields. Unknown facts must not be invented to fill blank fields.

A review can contain up to **20 CRM changes**, including a new contact with linked
buyer/investor profiles and notes. Notifications are in-app alerts; tasks and
touchpoints provide dated reminders. This does not add email/push delivery or
automatic background signal monitoring.

Jarvis reads **unimported Markdown notes directly from the connected vault**.
Enable **Allow selected vault text** in Integrations, save the connection, and
keep external access enabled in Jarvis. There is no second vault selection.
Existing include/exclude folder rules still apply. Empty include list means all
non-hidden, non-excluded folders. Hidden files, symlinks, traversal and files outside
the vault are blocked. Jarvis cannot change its own access permissions.

Jarvis can propose creating or replacing **one vault note** per review. It must
read every chunk of an existing note first. The before/after preview is shown.
Approval rechecks the hash and vault permissions, saves a recovery copy under
`workspace/backups/vault/<review-id>.json`, and then writes the note.
Edits above 100,000 characters and original-file deletion are not supported.
Reading a note does not automatically mirror it to the CRM: ask for CRM changes,
then approve them.

**[Google Calendar setup](GOOGLE_CALENDAR.md)** is now available. After sign-in
and selection, Jarvis can read that calendar and propose **one new Google event**.
Specify Google or local calendar when scheduling. Google events are not duplicated
as local appointments. No Google edits/deletions, invitations, Gmail or automatic
two-way synchronization are implemented.

Each question produces one review: a CRM batch, vault write, Google event or legacy
local scheduling batch. Mixed-system work uses separate approvals. Full app access
does not mean arbitrary code execution, secret access, destructive workspace resets,
account-connection changes or unattended approvals.

## Try these

- “Read Clients/Alex.md and fill Alex's buyer profile with its criteria. Leave
  anything the note doesn't say blank.”
- “Create Jamie Smith as a contact and a linked buyer profile with a $900,000
  maximum budget, three bedrooms and a garage.”
- “Mark the shortlist task complete and add a contact note explaining what I sent.”
- “Create an in-app alert reminding me to verify Alex's preapproval.”
- “Read Clients/Alex.md and add a follow-up checklist, preserving everything else.”
- “What is on my selected Google Calendar tomorrow?”
- “Draft a Google Calendar event for October 6, 2030 from 2 to 2:30 PM Pacific
  called Buyer consultation.”

These are examples, not installed records. Missing connections/data never produce
a fake answer fallback.

## Review and privacy

Changes require **Approve & save**. Verify destination, people, fields, dates,
time zones and full before/after preview. Deleting contacts/properties can cascade
to linked records. Database backups precede approval; vault recovery copies are
separate. Restoring SQLite does not undo vault edits or Google events.
Changed data and previews older than 24 hours require fresh review.

The new consent checkbox must be accepted again after this access expansion.
Questions share relevant app fields, permitted vault text, selected Google event
details and recent conversation with Anthropic. Uncheck external access for
CRM-only questions. The vault's Claude-sharing flag must also be enabled.
Imported CRM copies are not governed by later vault exclusions. Retrieved text is
untrusted data, never permission to act. Credentials are excluded from tools/history.

Questions, answers, sources, proposals and token usage are saved locally at
`/jarvis/<id>`. Up to four previous answers are context; the recent list shows
40 questions. History and backups can contain sensitive client/vault text and
are not separately encrypted by the app. Protect your OS account, disk and backups.
Start fresh clears records/history, not backups, vault files or Google events.
Individual-conversation deletion is not implemented.

Browser speech recognition may send audio to its provider and may not work offline.
Read-aloud uses only voices reported as local by the browser by default. Online
browser voices require an explicit opt-in because the provider may receive the
spoken answer, including private client details. It never silently falls back
to a different voice when the user's explicit selection is unavailable.
RealtorPro stores transcripts, not audio. Use typing/macOS dictation if unsupported.
See [speech recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition).

### Hologram and speaking voice

Jarvis has an original cyan/gold particle head and shoulders. Listening, thinking
and speaking states follow the real chat/speech lifecycle. Mouth movement reacts
to speech activity and word boundaries where available; it is expressive animation,
not phoneme-accurate lip-sync. No camera, face tracking, downloaded avatar or video
generation service is used. Motion pauses offscreen/in background, respects reduced
motion, and has a saved Pause motion control. The written answer remains available.

Under **Make Jarvis sound like Jarvis**, select a voice, preview it and adjust speed.
Automatic prefers English voices with Premium/Enhanced/Natural/Neural in their name;
this is a selection heuristic, not a guarantee of voice quality. Choices and speed
are saved in this browser. Long answers are spoken in short sentence-aware chunks.
Stopping audio, starting the microphone, leaving the chat or hiding the tab cancels
speech. No extra API key or voice API charges are required for local voices.

On macOS, download a voice in **System Settings → Accessibility → Read & Speak →
System voice** (Spoken Content on older releases), then click **Refresh voices**.
Only voices exposed by the browser can be selected; available voices differ by
Mac/browser and not all Siri voices are exposed. See [Apple's voice setup guide](https://support.apple.com/guide/mac-help/change-the-voice-your-mac-uses-to-speak-text-mchlp2290/mac).
If automatic audio is blocked, click Preview voice or Read answer aloud.
ElevenLabs/premium cloud speech is not connected in this release.

## Limits and verification

Each question has six Claude requests, ten tool calls, 4,000 output tokens per
request and a two-minute Claude deadline. CRM reads scan up to 10,000 rows per
collection, returning up to 25 rows and bounded text. Vault search checks 100
notes per page and their first 20,000 characters; full reads support chunks up to
20,000 characters with a 2 MB file limit. Google returns up to 100 events in a
range of at most 90 days and flags incomplete results. Ask focused questions and
follow pagination. These are not dollar limits; check Anthropic billing.
Interrupted questions are not automatically resumed or rebilled; check history
before starting a new question. AI answers can be mistaken; verify linked sources.

Unit/integration tests use isolated databases/files and simulated Anthropic/Google
boundaries. Browser tests on the isolated port-3100 workspace use synthetic Google
setup credentials and simulated speech/model output, but real encrypted storage,
history, review and record endpoints. The app has no demo-answer mode.
Live Google sign-in, a live microphone and a paid Claude response still require
the user's account on the target Mac.

Stop the app and update from its installation folder:

```bash
git pull --ff-only origin codex/production-readiness
npm ci
npm run setup
npm run build
npm run launch
```

Setup preserves existing records and connections. This expansion adds no new
database tables beyond the original Jarvis history migration.
