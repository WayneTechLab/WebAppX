#!/usr/bin/env bash
set -euo pipefail

SYSTEMX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Legacy command alias: export-standard-md-packet.sh"
echo "WSG now uses zip-first setup packets."
echo

bash "$SYSTEMX_DIR/scripts/build-setup-packet.sh" "$@"
