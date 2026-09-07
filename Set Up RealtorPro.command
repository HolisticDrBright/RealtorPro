#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
trap 'printf "\nSetup stopped. Your existing data was not cleared. Check the message above. Press Return to close.\n"; read -r _reply' ERR
printf 'RealtorPro setup: quit every running RealtorPro window with Control-C first.\n'
printf 'This installs dependencies, prepares Mac Keychain, migrates safely and builds the app.\n'
read -r -p 'Continue? Type YES: ' _realtorpro_confirm
if [ "$_realtorpro_confirm" != YES ]; then exit 0; fi
if ! command -v node >/dev/null 2>&1; then
  printf 'Install Node.js 24 LTS from https://nodejs.org/en/download first.\n'
  read -r _reply
  exit 1
fi
node -e 'const v=process.versions.node.split(".").map(Number); if(!((v[0]===22 && v[1]>=12)||v[0]===24)) { console.error("Use Node.js 24 LTS (or Node 22.12+)."); process.exit(1); }'
/usr/bin/xcrun --find swiftc >/dev/null
node scripts/check-stopped.mjs
npm ci
npm run setup
npm run build
npm run launch
