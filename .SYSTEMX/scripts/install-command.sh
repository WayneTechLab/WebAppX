#!/usr/bin/env bash
# =============================================================================
# WebApp Stack G One Point Zero — install the `WSG-MENU` terminal command
# -----------------------------------------------------------------------------
# Adds a shell function so you can just type `WSG-MENU` (or `wsg-menu`) in any
# new terminal to open the control panel for THIS repo.
#
#   bash .SYSTEMX/scripts/install-command.sh           # install into your shell rc
#   bash .SYSTEMX/scripts/install-command.sh --uninstall
#   bash .SYSTEMX/scripts/install-command.sh --print   # show the snippet only
#
# Idempotent: re-running updates the existing block in place. It edits the rc
# file for your current shell (~/.zshrc or ~/.bashrc) between clear markers.
# =============================================================================
set -uo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SYSTEMX_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"
MENU="$SYSTEMX_DIR/WSG-MENU.sh"

C_RESET=$'\033[0m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'; C_DIM=$'\033[2m'
ok()   { printf '%s✓ %s%s\n' "$C_GREEN" "$*" "$C_RESET"; }
warn() { printf '%s! %s%s\n' "$C_YELLOW" "$*" "$C_RESET"; }
info() { printf '%s%s%s\n' "$C_DIM" "$*" "$C_RESET"; }

MARK_BEGIN="# >>> WSG-MENU >>>"
MARK_END="# <<< WSG-MENU <<<"

snippet() {
  printf '%s\n' "$MARK_BEGIN" '# WebApp Stack G One Point Zero — control panel launcher'
  printf 'WSG-MENU() { bash %q "$@"; }\n' "$MENU"
  printf '%s\n' "alias wsg-menu='WSG-MENU'" "$MARK_END"
}

rc_file() {
  # Prefer the rc for the user's login shell; fall back to zsh on macOS.
  case "${SHELL:-}" in
    *zsh) printf '%s' "$HOME/.zshrc";;
    *bash) printf '%s' "$HOME/.bashrc";;
    *) [ "$(uname -s)" = "Darwin" ] && printf '%s' "$HOME/.zshrc" || printf '%s' "$HOME/.bashrc";;
  esac
}

remove_block() { # remove_block <file>
  local f="$1"; [ -f "$f" ] || return 0
  local tmp; tmp="$(mktemp)"
  awk -v b="$MARK_BEGIN" -v e="$MARK_END" '
    $0==b {skip=1} skip && $0==e {skip=0; next} !skip {print}
  ' "$f" > "$tmp" && mv "$tmp" "$f"
}

MODE="install"
case "${1:-}" in
  --uninstall) MODE="uninstall";;
  --print) snippet; exit 0;;
  --help|-h) sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0;;
esac

RC="$(rc_file)"
[ -f "$MENU" ] || { warn "Menu not found at $MENU"; exit 1; }
[ -f "$RC" ] || : > "$RC"

if [ "$MODE" = "uninstall" ]; then
  remove_block "$RC"
  ok "Removed WSG-MENU command from $RC"
  info "Open a new terminal (or 'source $RC') to apply."
  exit 0
fi

# Install / update: strip any old block, then append a fresh one.
remove_block "$RC"
{ echo; snippet; } >> "$RC"
chmod +x "$MENU" 2>/dev/null || true

ok "Installed the 'WSG-MENU' command into $RC"
info "It launches: $MENU"
echo
info "Use it now in this shell:"
printf "    source %s && WSG-MENU\n" "$RC"
info "…or just open a new terminal and type:  WSG-MENU"
