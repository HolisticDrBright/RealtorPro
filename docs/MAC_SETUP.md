# RealtorPro for MacBooks

RealtorPro runs privately on your Mac and opens in Safari or Chrome. It supports
in-app Claude connection through macOS Keychain, a native vault-folder chooser,
and double-click setup/start launchers. It remains a local browser app, not a
signed/notarized standalone .app or an App Store installer.

## First-time installation

Install Node.js 24 LTS from [nodejs.org](https://nodejs.org/en/download).
Run `xcode-select --install` in Terminal and finish Apple's Command Line Tools
installation. This supplies Git, Swift for the Keychain helper, and a compiler
if SQLite needs one. No full Xcode installation is required. If already installed,
macOS will tell you. Reopen Terminal, then paste:

```bash
mkdir -p "$HOME/Applications" &&
cd "$HOME/Applications" &&
git clone --branch codex/production-readiness --single-branch https://github.com/HolisticDrBright/RealtorPro.git &&
cd RealtorPro &&
npm ci &&
npm run setup &&
npm run build &&
npm run launch
```

GitHub may require an account with repository access. A fresh install starts
empty, without someone else's client records. Keep the project outside iCloud
Drive, Dropbox and network shares; its live SQLite database belongs on local disk.
Use the native Node installer for your Apple Silicon or Intel Mac. Never copy
Windows node_modules or credentials onto the Mac.

## Everyday use — no commands to remember

In Finder, open your home folder → Applications → RealtorPro. Double-click
**Start RealtorPro.command**. Make a Desktop alias if convenient; do not move the
actual launcher out of its project folder. The browser opens once the database
is ready. If the same app is already running, the launcher reopens it without
starting a duplicate. An unrelated process using the port is never killed.

Keep the original Terminal window open. Control-C quits RealtorPro; closing
the browser alone does not stop the server. This is not a hidden login service.
If the browser does not open, use http://127.0.0.1:3000. Search with Command-K.
Trackpad dragging and arrow buttons work under Arrange dashboard.

The launcher finds the standard Node installer plus Apple Silicon and Intel
Homebrew locations. If you use a version manager, launch from a Terminal where
node is available or install Node in a standard location. If macOS blocks a
downloaded launcher, review it and use Apple's per-file Open/Privacy & Security
approval if available. Do not disable Gatekeeper. The Terminal fallback is:

```bash
cd "$HOME/Applications/RealtorPro" && npm run launch
```

## Connect Claude from the app

Open Integrations → Claude, paste your Anthropic API key and select
**Save & test Claude**. Unlock your login keychain / approve the RealtorPro helper
if macOS asks. Your Mac login password belongs only in the macOS dialog, never
the app. No .env editing or restart is needed. API use is billed separately from
a Claude subscription. Testing checks key/model access, not generation credits.

The key is stored in the local login Keychain under service `app.realtorpro.claude`.
Only a random reference and model settings are saved in the workspace. Keys are
never returned to the browser or included in database snapshots. Disconnect
disables Claude and removes the referenced Keychain item. If deletion is denied,
the app stays disconnected and shows cleanup instructions. Never remove other
applications' Keychain items.

If a key is already in .env, leave the key box blank and select Save & test Claude
to migrate it into Keychain. After success, you can remove the old .env entry;
the app does not edit it. App settings override .env, including a saved disconnect.
Paste the key again to reconnect after disconnecting.

After a helper update, macOS may ask for renewed access. If Keychain needs setup,
quit the app and double-click **Set Up RealtorPro.command** or run `npm run setup`.
Credentials copied from another operating system require reconnecting. Never copy
the .runtime-token file between machines.

## Connect Obsidian and populate the app

Choose **Choose vault on this Mac…**, select the vault root containing .obsidian,
then **Save & connect vault**. Selection alone does not index/import; Cancel
leaves the existing choice unchanged. Browse folders and full-path entry remain
available. Grant only the macOS folder permissions needed. Download iCloud notes
locally before indexing. Set include/exclude folders and keep Claude sharing off
unless you want selected note text sent to Anthropic.

Connecting Claude does not populate the app by itself:

1. Paste client/meeting/property notes under Claude and choose **Extract records
   with Claude**, or enable vault sharing and choose **Read vault with Claude**.
2. Review the proposed records. Only information in the supplied text should be
   used; check names, dates, money and links yourself.
3. Choose **Import into the command center** to approve. Nothing is imported
   before approval. Larger vaults should be processed one client folder at a time.

Supported extraction includes contacts, buyer/seller profiles, properties,
listings, transactions, tasks, opportunities and notes. Matching, pipeline,
follow-ups and income summaries are calculated from saved data. Calendar
appointments, call logs and detailed offers are not part of that extraction
bundle; enter those in their pages or use a trusted agent's reviewed proposals.
Claude does not automatically read Gmail, browse MLS or search for missing facts.

Set your name/brokerage/goal in Integrations. Protect your account, enable FileVault
and keep off-device backups. SQLite and snapshots are not encrypted by RealtorPro;
Keychain protects only saved API keys. Selecting/indexing/importing does not edit
original vault notes.

## Update

Make a verified snapshot and keep a protected off-device copy. Stop every app
instance using this workspace with Control-C first:

```bash
cd "$HOME/Applications/RealtorPro" &&
git pull --ff-only origin codex/production-readiness &&
npm ci &&
npm run setup &&
npm run build &&
npm run launch
```

Or after pulling, double-click Set Up RealtorPro.command and type YES. It checks
the port, installs dependencies, prepares Keychain, migrates with a backup,
builds and launches. It never seeds or clears data. A port check cannot detect
an instance using another port/computer, so stop all instances first. Preserve
local Git changes rather than resetting. If the folder exists, update; don't
delete it to clone again.

## Verification and remaining limits

Tests include simulated Mac connection lifecycle cases on all platforms and a
real Keychain test on Mac (one random synthetic item, deleted afterward). Desktop
checks CI runs tests/builds on Mac and Windows; check its actual run result.
Still verify on the real MacBook: Finder launch, folder selection/cancellation,
privacy and Keychain dialogs, Safari, sleep/wake and an optional paid Claude
generation. Automated CI cannot verify personal permissions or provider credit.

Google Calendar now has [OAuth setup, event reads and reviewed creation](GOOGLE_CALENDAR.md).
Gmail, automatic two-way calendar sync, Follow Up Boss and the commercial studios
are not implemented here. Never expose this local app to the LAN/internet. Graphify is
in docs/graphify/graph.html; its CDN libraries need internet on first load.
