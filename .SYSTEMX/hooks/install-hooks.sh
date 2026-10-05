#!/usr/bin/env bash
# .SYSTEMX/hooks/install-hooks.sh — Install git hooks from .SYSTEMX/hooks/
set -euo pipefail
ROOT_DIR="$(git rev-parse --show-toplevel)"
HOOKS_SRC="$ROOT_DIR/.SYSTEMX/hooks"
HOOKS_DST="$ROOT_DIR/.git/hooks"

mkdir -p "$HOOKS_DST"
for hook in pre-push post-merge post-checkout; do
  if [[ -f "$HOOKS_SRC/$hook" ]]; then
    cp "$HOOKS_SRC/$hook" "$HOOKS_DST/$hook"
    chmod +x "$HOOKS_DST/$hook"
    echo "Installed: $hook"
  fi
done
echo "Git hooks installed from .SYSTEMX/hooks/"
