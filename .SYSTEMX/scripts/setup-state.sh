#!/usr/bin/env bash
set -euo pipefail

SYSTEMX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WSG_SETUP_STATE_FILE="${WSG_SETUP_STATE_FILE:-$SYSTEMX_DIR/status/setup-state.env}"

wsg_state_ensure() {
  mkdir -p "$(dirname "$WSG_SETUP_STATE_FILE")"
  [[ -f "$WSG_SETUP_STATE_FILE" ]] || : > "$WSG_SETUP_STATE_FILE"
}

wsg_state_get() {
  local key="$1"
  wsg_state_ensure
  awk -F= -v key="$key" '$1 == key { sub(/^[^=]*=/, "", $0); print; exit }' "$WSG_SETUP_STATE_FILE"
}

wsg_state_set() {
  local key="$1"
  local value="$2"
  local tmp
  wsg_state_ensure
  tmp="$(mktemp)"
  awk -F= -v key="$key" '$1 != key { print }' "$WSG_SETUP_STATE_FILE" > "$tmp"
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  mv "$tmp" "$WSG_SETUP_STATE_FILE"
}

wsg_state_has() {
  [[ -n "$(wsg_state_get "$1")" ]]
}

wsg_state_print_summary() {
  wsg_state_ensure
  if [[ ! -s "$WSG_SETUP_STATE_FILE" ]]; then
    echo "(empty)"
    return 0
  fi

  sed 's/^/  /' "$WSG_SETUP_STATE_FILE"
}
