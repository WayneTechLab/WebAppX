#!/usr/bin/env bash
set -euo pipefail

SYSTEMX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMPORT_ROOT="$SYSTEMX_DIR/Setup-Input_MD"
HISTORY="$SYSTEMX_DIR/logs/setup-history.jsonl"

# shellcheck source=/dev/null
. "$SYSTEMX_DIR/scripts/setup-state.sh"

zip_path="${1:-}"
os_target="$(wsg_state_get OS_TARGET || true)"
downloads_dir="$(wsg_state_get DOWNLOADS_DIR || true)"
downloads_dir="${downloads_dir:-${WSG_DOWNLOADS_DIR:-$HOME/Downloads}}"

mkdir -p "$IMPORT_ROOT" "$(dirname "$HISTORY")"

if [[ -z "$zip_path" ]]; then
  if [[ -n "$downloads_dir" ]]; then
    zip_path="$(find "$downloads_dir" -maxdepth 1 -type f -name 'WSG-Setup-Packet-*.zip' | sort | tail -n 1)"
  fi
fi

if [[ -z "$zip_path" || ! -f "$zip_path" ]]; then
  echo "No setup packet zip found."
  echo "Provide a zip path or place a packet in:"
  echo "  $downloads_dir"
  exit 1
fi

tmp_dir="$(mktemp -d)"
unzip -q "$zip_path" -d "$tmp_dir"
manifest_file="$(find "$tmp_dir" -type f -name manifest.json -print | head -n 1)"
manifest_dir=""
if [[ -n "$manifest_file" ]]; then
  manifest_dir="$(dirname "$manifest_file")"
fi

if [[ -z "$manifest_dir" || ! -d "$manifest_dir" ]]; then
  echo "Imported zip is missing manifest.json" >&2
  exit 1
fi

node "$SYSTEMX_DIR/scripts/validate-setup-packet.mjs" "$manifest_dir"

packet_name="$(basename "$manifest_dir")"
target_dir="$IMPORT_ROOT/$packet_name"
if [[ -d "$target_dir" ]]; then
  mv "$target_dir" "${target_dir}.bak-$(date +%Y%m%d-%H%M%S)"
fi
mkdir -p "$target_dir"
cp -R "$manifest_dir"/. "$target_dir/"

wsg_state_set LAST_IMPORTED_PACKET_ZIP "$zip_path"
wsg_state_set LAST_IMPORTED_PACKET_DIR "$target_dir"
printf '{"timestamp":"%s","event":"setup_packet_imported","osTarget":"%s","zipPath":"%s","targetDir":"%s","validation":"passed"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${os_target:-unknown}" "$zip_path" "$target_dir" >> "$HISTORY"

echo "WSG setup packet imported."
echo "Zip path:    $zip_path"
echo "Target dir:  $target_dir"
echo "Validator:   passed"
echo
echo "Legacy compatibility:"
find "$IMPORT_ROOT" -maxdepth 3 -type f -name '*.md' ! -name 'README.md' ! -name 'README-FIRST.md' -print | sort | sed 's/^/  /' || true
