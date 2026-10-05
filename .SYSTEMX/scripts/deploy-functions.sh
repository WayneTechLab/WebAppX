#!/usr/bin/env bash
# .SYSTEMX/scripts/deploy-functions.sh — Compile + deploy Cloud Functions only
# No-op (with a clear message) if the project has no functions/ yet.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "functions/package.json" ]]; then
  echo "No functions/ directory found — skipping (add it in Step 06)."
  exit 0
fi

echo "=== Deploying Cloud Functions ==="
npm --prefix functions install --no-audit --no-fund || echo "WARN: functions install issues"
if [[ -f "functions/tsconfig.json" ]]; then
  (cd functions && npx tsc --noEmitOnError false) || echo "WARN: functions compile had type errors; JS emitted anyway"
fi

if command -v firebase >/dev/null 2>&1; then
  firebase deploy --only functions "$@"
elif command -v npx >/dev/null 2>&1; then
  npx --yes firebase-tools deploy --only functions "$@"
else
  echo "Firebase CLI not found"; exit 1
fi
echo "=== Functions deployed ==="
