#!/usr/bin/env bash
# .SYSTEMX/scripts/deploy-hosting.sh — Build + deploy Firebase Hosting only
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "=== Deploying Firebase Hosting ==="
npm run -s build || { echo "Build failed"; exit 1; }

if command -v firebase >/dev/null 2>&1; then
  firebase deploy --only hosting "$@"
elif command -v npx >/dev/null 2>&1; then
  npx --yes firebase-tools deploy --only hosting "$@"
else
  echo "Firebase CLI not found"; exit 1
fi
echo "=== Hosting deployed ==="
