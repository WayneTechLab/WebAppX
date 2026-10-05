#!/usr/bin/env bash
# .SYSTEMX/scripts/deploy-rules.sh — Deploy Firestore + Storage security rules only
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "=== Deploying Security Rules (Firestore + Storage) ==="
TARGETS="firestore:rules,storage"

if command -v firebase >/dev/null 2>&1; then
  firebase deploy --only "$TARGETS" "$@"
elif command -v npx >/dev/null 2>&1; then
  npx --yes firebase-tools deploy --only "$TARGETS" "$@"
else
  echo "Firebase CLI not found"; exit 1
fi
echo "=== Rules deployed ==="
