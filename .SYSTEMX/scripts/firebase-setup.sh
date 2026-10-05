#!/usr/bin/env bash
# .SYSTEMX/scripts/firebase-setup.sh — Generic Firebase auth + project selection.
# - Ensures the Firebase CLI is available (falls back to npx firebase-tools).
# - Logs in if needed.
# - Selects a project, resolved in this order:
#     1. --project <id>            (flag)
#     2. FIREBASE_PROJECT_ID        (env / interview.answers)
#     3. default alias in .firebaserc
#     4. interactive prompt (firebase use --add)
# No project IDs are hard-coded — this stays generic across projects.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SYSTEMX_DIR="$ROOT_DIR/.SYSTEMX"
cd "$ROOT_DIR"

PROJECT_ID="${FIREBASE_PROJECT_ID:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT_ID="${2:-}"; shift 2;;
    *) shift;;
  esac
done

# Pull FIREBASE_PROJECT_ID from the interview answers if not already set.
ANSWERS="$SYSTEMX_DIR/Template/interview.answers"
if [[ -z "$PROJECT_ID" && -f "$ANSWERS" ]]; then
  PROJECT_ID=$(sed -nE 's/^FIREBASE_PROJECT_ID=(.+)$/\1/p' "$ANSWERS" | head -1)
fi

fb() {
  if command -v firebase >/dev/null 2>&1; then firebase "$@"
  elif command -v npx >/dev/null 2>&1; then npx --yes firebase-tools "$@"
  else echo "Firebase CLI not found and npx unavailable"; return 1; fi
}

echo "=== Firebase setup ==="

# Auth
if ! fb projects:list >/dev/null 2>&1; then
  echo "→ Logging in to Firebase…"
  fb login --no-localhost || { echo "Firebase login failed"; exit 1; }
else
  echo "✓ Firebase already authenticated"
fi

# Project selection
if [[ -n "$PROJECT_ID" ]]; then
  echo "→ Using project: $PROJECT_ID"
  fb use "$PROJECT_ID" 2>/dev/null || fb use --add --alias default "$PROJECT_ID" || echo "WARN: could not select $PROJECT_ID"
elif [[ -f "$ROOT_DIR/.firebaserc" ]] && grep -q '"default"' "$ROOT_DIR/.firebaserc" 2>/dev/null \
     && ! grep -q 'YOUR_FIREBASE_PROJECT_ID' "$ROOT_DIR/.firebaserc"; then
  echo "✓ Using default project from .firebaserc"
  fb use default 2>/dev/null || true
else
  echo "→ No project configured. Launching interactive selection…"
  fb use --add || echo "WARN: project selection skipped"
fi

echo
echo "Active project:"
fb use 2>/dev/null || cat "$ROOT_DIR/.firebaserc" 2>/dev/null || echo "(none)"
echo "=== Firebase setup complete ==="
echo "Next: deploy with  bash .SYSTEMX/scripts/deploy.sh  (or via WSG-MENU)."
