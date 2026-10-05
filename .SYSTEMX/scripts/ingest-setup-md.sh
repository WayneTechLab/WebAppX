#!/usr/bin/env bash
set -euo pipefail

SYSTEMX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INGEST_DIR="$SYSTEMX_DIR/Setup-Input_MD"
HISTORY="$SYSTEMX_DIR/logs/setup-history.jsonl"

mkdir -p "$INGEST_DIR" "$(dirname "$HISTORY")"

echo "Legacy command alias: ingest-setup-md.sh"
echo "WSG now uses zip-first setup packet import."
echo

bash "$SYSTEMX_DIR/scripts/import-setup-packet.sh" "${1:-}"

echo
echo "Legacy markdown compatibility scan:"
find "$INGEST_DIR" -mindepth 1 -maxdepth 3 -type f -name '*.md' ! -name README.md -print | sort | sed 's/^/  /' || true
