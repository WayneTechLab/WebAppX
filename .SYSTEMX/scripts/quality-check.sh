#!/usr/bin/env bash
# .SYSTEMX/scripts/quality-check.sh — Run all quality gates before a deploy/push.
# Runs: typecheck → lint → tests. Missing npm scripts are skipped (--if-present).
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PASS=0; FAIL=0
gate() { # gate "Label" npm-script
  local label="$1" script="$2"
  echo "--- $label ---"
  if npm run -s "$script" --if-present 2>&1; then
    echo "  PASS: $label"; PASS=$((PASS+1))
  else
    echo "  FAIL: $label"; FAIL=$((FAIL+1))
  fi
}

echo "=== Quality Check ==="
gate "TypeScript" typecheck
gate "ESLint" lint
gate "Tests" test
gate "Managed SYSTEMX records" systemx:validate
gate "SYSTEMX import preservation" systemx:integration:test
gate "Documentation links" docs:links
gate "Research integrity" research:validate
echo
echo "=== Results: $PASS passed, $FAIL failed ==="
[[ $FAIL -gt 0 ]] && exit 1 || exit 0
