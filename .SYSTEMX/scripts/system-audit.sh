#!/usr/bin/env bash
set -euo pipefail

SYSTEMX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$SYSTEMX_DIR/.." && pwd)"

failures=0
warnings=0

ok() { printf 'PASS: %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL: %s\n' "$*"; failures=$((failures + 1)); }

require_file() {
  [[ -f "$ROOT_DIR/$1" ]] && ok "$1 exists" || fail "$1 missing"
}

require_dir() {
  [[ -d "$ROOT_DIR/$1" ]] && ok "$1 exists" || fail "$1 missing"
}

compare_stock_standard() {
  local standard="$SYSTEMX_DIR/Standard-MD-Files"
  local stock="$SYSTEMX_DIR/Stock-Setup-Files"
  local mismatches=0

  while IFS= read -r file; do
    local base
    base="$(basename "$file")"
    [[ "$base" == "README.md" ]] && continue
    if [[ ! -f "$stock/$base" ]]; then
      fail "Stock setup file missing: $base"
      mismatches=$((mismatches + 1))
      continue
    fi
    if ! cmp -s "$file" "$stock/$base"; then
      fail "Stock setup file differs from standard: $base"
      mismatches=$((mismatches + 1))
    fi
  done < <(find "$standard" -maxdepth 1 -type f -name '*.md' | sort)

  [[ -f "$stock/README-FIRST.md" ]] && ok "Stock README-FIRST.md exists" || fail "Stock README-FIRST.md missing"
  [[ "$mismatches" -eq 0 ]] && ok "Stock setup files match Standard-MD-Files"
}

check_generated_clutter() {
  local setup_generated log_generated
  setup_generated="$(find "$SYSTEMX_DIR/Setup-Input_MD" -mindepth 1 -maxdepth 1 \
    ! -name README.md ! -name .gitkeep -print | sort)"
  log_generated="$(find "$SYSTEMX_DIR/logs" -mindepth 1 -maxdepth 1 \
    ! -name .gitkeep -print | sort)"

  if [[ -n "$setup_generated" ]]; then
    warn "Generated Setup-Input_MD packet folders/files are present:"
    printf '%s\n' "$setup_generated" | sed 's/^/  /'
  else
    ok "Setup-Input_MD has only tracked anchors"
  fi

  if [[ -n "$log_generated" ]]; then
    warn "Generated .SYSTEMX logs are present:"
    printf '%s\n' "$log_generated" | sed 's/^/  /'
  else
    ok ".SYSTEMX/logs has only tracked anchors"
  fi
}

echo "WSG .SYSTEMX Audit"
echo "=================="
echo

require_dir ".SYSTEMX"
require_dir ".SYSTEMX/Standard-MD-Files"
require_dir ".SYSTEMX/Stock-Setup-Files"
require_dir ".SYSTEMX/Setup-Input_MD"
require_dir ".SYSTEMX/Unified-Setup-Process"
require_dir ".SYSTEMX/Unified-Setup-Process/stacks"
require_dir ".SYSTEMX/Unified-Setup-Process/master-plan"
require_dir ".SYSTEMX/Unified-Setup-Process/packet-assets"
require_dir ".SYSTEMX/Template"
require_file ".SYSTEMX/WSG-MENU.sh"
require_file ".SYSTEMX/wsg-agi.sh"
require_file ".SYSTEMX/scripts/export-standard-md-packet.sh"
require_file ".SYSTEMX/scripts/ingest-setup-md.sh"
require_file ".SYSTEMX/scripts/build-setup-packet.sh"
require_file ".SYSTEMX/scripts/import-setup-packet.sh"
require_file ".SYSTEMX/scripts/validate-setup-packet.mjs"
require_file ".SYSTEMX/scripts/setup-state.sh"
require_file ".SYSTEMX/scripts/verify-template-structure.mjs"
require_file ".SYSTEMX/scripts/security-check.mjs"
require_file ".SYSTEMX/scripts/account-level-check.mjs"
require_file ".SYSTEMX/USER-INGEST-AND-PRODUCTION-SETUP.md"

echo
compare_stock_standard

echo
check_generated_clutter

echo
bash -n "$SYSTEMX_DIR/WSG-MENU.sh" && ok "WSG-MENU syntax valid" || fail "WSG-MENU syntax invalid"
node "$SYSTEMX_DIR/scripts/verify-template-structure.mjs" && ok "Structure verifier passed" || fail "Structure verifier failed"

echo
printf 'Audit complete: %s failure(s), %s warning(s)\n' "$failures" "$warnings"
[[ "$failures" -eq 0 ]] || exit 1
