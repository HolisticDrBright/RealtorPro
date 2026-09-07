# Install RealtorPro on a MacBook

This is a private local release candidate. The release was tested on Windows,
not on a physical Mac. The launcher, database and vault picker use cross-platform
Node APIs, but **in-app Claude key storage is Windows-only**. On macOS use the
environment-file option below; do not use **Save & test Claude** (even with a
blank key, that button attempts Windows encryption).

## First installation

1. Install **Node.js 24 LTS** using the macOS installer at
   [nodejs.org](https://nodejs.org/en/download). Reopen Terminal after installation.
2. Install Apple's Command Line Tools if needed: run `xcode-select --install`,
   complete the installation dialog, then continue. These provide Git and the
   compiler needed if a native database dependency must build from source.
3. Run this in Terminal. It creates a new checkout, not a copy of anyone's CRM data:

```bash
mkdir -p "$HOME/Applications" &&
cd "$HOME/Applications" &&
git clone --branch codex/production-readiness --single-branch https://github.com/HolisticDrBright/RealtorPro.git &&
cd RealtorPro &&
npm ci &&
npm run setup &&
npm run build &&
npm start
```

If GitHub asks you to authenticate, use an account with repository access. Private
repositories require an authorized credential, not your normal GitHub password.
If the folder already exists, do not delete it; use the update instructions below.

Open **http://127.0.0.1:3000** in Safari or Chrome. Keep Terminal running.
Press Control-C to stop the app. Do not run it with `sudo`, expose it to the
internet, or store its live database in iCloud Drive/Dropbox/a network share.

## Connect Claude on macOS

Stop the app with Control-C. From the project folder:

```bash
cp -n .env.example .env
chmod 600 .env
nano .env
```

Set the existing `ANTHROPIC_API_KEY=` line to your own Anthropic API key. Save
with Control-O, Enter, then exit with Control-X. Run `npm start` again.
Do not paste the key into a shell command, chat, or GitHub. The `.env` file is
Git-ignored but contains plaintext; the permissions limit access to your macOS
account. Enable FileVault and protect your account and backups. Anthropic API
usage is billed separately from a Claude subscription.

The environment key should appear configured in Integrations. This does not
prove that it has generation credit. A live, user-controlled generation remains
an acceptance test. Do not click **Save & test Claude** or **Disconnect Claude**
in this version on macOS: the former needs Windows encryption; the latter saves
an override that disables the environment key. To disconnect on a fresh Mac
setup, remove the key from `.env` and restart instead.

Never copy a Windows `workspace/connections.json` or `.runtime-token` onto the
Mac. Windows-encrypted credentials cannot be decrypted there.

## Connect Obsidian and personalize

Open Integrations, set your name/brokerage/goal, then choose **Browse folders**
under Obsidian. Select the vault root containing `.obsidian`, then **Use this
vault** and **Save & connect vault**. The vault must already be present on the
Mac. Allow Terminal access to its folder if macOS asks; use the narrowest needed
permission. A cloud vault's Markdown files must be downloaded locally.

Vault sharing with Claude is opt-in. Review proposed imports before approving.
First launch has no sample contacts or properties. Gmail, Google Calendar sync,
Follow Up Boss and the commercial studios are not implemented in this branch.

## Launch next time

```bash
cd "$HOME/Applications/RealtorPro" && npm start
```

## Update later

Create and verify a snapshot in Integrations and keep a separate protected
off-device backup. Stop every running app instance with Control-C first:

```bash
cd "$HOME/Applications/RealtorPro" &&
git pull --ff-only origin codex/production-readiness &&
npm ci &&
npm run setup &&
npm run build &&
npm start
```

Setup is additive, creates a pre-migration backup for an existing database,
and never seeds or clears CRM records. Stop if any step fails. If Git reports
conflicting local changes, preserve them and ask for help rather than resetting.

## Project map

```bash
open docs/graphify/graph.html
```

The network graph and tree are local HTML files with CDN-hosted visualization
libraries; internet access is needed for those libraries on first load.
