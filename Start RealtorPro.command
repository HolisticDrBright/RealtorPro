#!/bin/bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
# Finder does not inherit your interactive shell's PATH. Support the official
# Node installer and both Apple Silicon and Intel Homebrew installations.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
trap 'printf "\nRealtorPro could not start. Check the message above. Press Return to close.\n"; read -r _reply' ERR
if ! command -v node >/dev/null 2>&1; then
  printf 'Install Node.js 24 LTS from https://nodejs.org/en/download, then try again.\n'
  read -r _reply
  exit 1
fi
if [ ! -d node_modules ] || [ ! -f .next/BUILD_ID ]; then
  printf 'First double-click Set Up RealtorPro.command in this folder.\n'
  read -r _reply
  exit 1
fi
npm run launch
