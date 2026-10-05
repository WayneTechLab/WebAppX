#!/usr/bin/env bash
# =============================================================================
# WSG-MENU — WebAppX — SYSTEMX Forever WebApp control panel
# -----------------------------------------------------------------------------
# One entry point to initialize the template and run the whole lifecycle:
# check/install/auth tooling, capture Firebase project info, run the guided
# setup, quality gates, version bumps, and Firebase deploys.
#
#   bash .SYSTEMX/WSG-MENU.sh
#
# Non-destructive by default: builds/deploys/commits are explicit choices and
# confirmed. Re-runnable any time.
# =============================================================================
set -uo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"   # → .SYSTEMX
REPO_ROOT="$(cd "$SELF_DIR/.." && pwd)"                     # → repo root (the app)
SCRIPTS_DIR="$SELF_DIR/scripts"
HOOKS_DIR="$SELF_DIR/hooks"
VERSION_DIR="$SELF_DIR/webapp-version"
TEMPLATE_DIR="$SELF_DIR/Template"
ANSWERS="$TEMPLATE_DIR/interview.answers"
LIB="$TEMPLATE_DIR/lib/firebase-config.sh"
cd "$REPO_ROOT"

C_RESET=$'\033[0m'; C_BOLD=$'\033[1m'; C_DIM=$'\033[2m'
C_RED=$'\033[31m'; C_GREEN=$'\033[32m'; C_YELLOW=$'\033[33m'
C_BLUE=$'\033[34m'; C_MAGENTA=$'\033[35m'; C_CYAN=$'\033[36m'; C_WHITE=$'\033[97m'

clear_screen() { clear 2>/dev/null || printf '\033c'; }
divider() { printf '%s  ────────────────────────────────────────────────────────%s\n' "$C_DIM" "$C_RESET"; }
section() { printf '%s%s  %s%s\n' "$C_CYAN" "$C_BOLD" "$*" "$C_RESET"; }
ok()   { printf '%s  ✓ %s%s\n' "$C_GREEN" "$*" "$C_RESET"; }
warn() { printf '%s  ! %s%s\n' "$C_YELLOW" "$*" "$C_RESET"; }
err()  { printf '%s  ✗ %s%s\n' "$C_RED" "$*" "$C_RESET"; }
info() { printf '%s  %s%s\n' "$C_DIM" "$*" "$C_RESET"; }
pause(){ read -r -p "$(printf '%s  Press Enter to continue…%s' "$C_DIM" "$C_RESET")" _ || true; }

confirm() { local m="${1:-Are you sure?}" a; read -r -p "$(printf '%s  %s [y/N]:%s ' "$C_YELLOW" "$m" "$C_RESET")" a || true; [[ "$a" =~ ^[Yy]$ ]]; }

have() { command -v "$1" >/dev/null 2>&1; }
ver()  { "$1" --version 2>/dev/null | head -n1; }

# Source the Firebase capture library (provides wsg_capture_firebase).
[ -f "$LIB" ] && . "$LIB" || true

run_script() { # run_script <path> [args…]
  local s="$1"; shift || true
  [[ -f "$s" ]] || { err "Script not found: $s"; pause; return 1; }
  echo; printf '%s%s  ▶ %s %s%s\n' "$C_CYAN" "$C_BOLD" "$(basename "$s")" "$*" "$C_RESET"; divider
  bash "$s" "$@" || true
  divider; pause
}

version_str() { [[ -f "$VERSION_DIR/app-version.txt" ]] && cat "$VERSION_DIR/app-version.txt" || node -e 'process.stdout.write(require("./package.json").version)' 2>/dev/null || echo "?"; }
git_branch()  { git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "N/A"; }
git_dirty()   { local n; n=$(git status --short 2>/dev/null | wc -l | tr -d ' '); [[ "$n" -eq 0 ]] && printf '%sclean%s' "$C_GREEN" "$C_RESET" || printf '%s%s change(s)%s' "$C_YELLOW" "$n" "$C_RESET"; }

print_header() {
  clear_screen
  echo
  printf '  %s%s WebAppX — SYSTEMX Forever WebApp %s %s· WSG-MENU%s\n' "$C_BOLD" "$C_CYAN" "$C_RESET" "$C_DIM" "$C_RESET"
  printf '  %sv%s%s  %s|%s  branch: %s%s%s  %s|%s  repo: %s\n' \
    "$C_CYAN" "$(version_str)" "$C_RESET" "$C_DIM" "$C_RESET" \
    "$C_MAGENTA" "$(git_branch)" "$C_RESET" "$C_DIM" "$C_RESET" "$(git_dirty)"
  divider
}

# ── 1 · Setup & tooling ───────────────────────────────────────────────────────
capture_firebase() {
  section "Capture Firebase project info (Web / iOS / Android)"; echo
  declare -F wsg_capture_firebase >/dev/null 2>&1 || { err "Capture lib not loaded ($LIB)"; pause; return; }
  [[ -f "$ANSWERS" ]] || { [[ -f "$TEMPLATE_DIR/templates/interview.answers.template" ]] && cp "$TEMPLATE_DIR/templates/interview.answers.template" "$ANSWERS" && info "Seeded $ANSWERS"; }
  wsg_capture_firebase "$ANSWERS"
  pause
}

seed_env() {
  section "Seed .env files from captured config"; echo
  declare -F wsg_seed_env_files >/dev/null 2>&1 || { err "Seed lib not loaded ($LIB)"; pause; return; }
  [[ -f "$ANSWERS" ]] || { err "No captured config yet — run 'Capture Firebase project info' first."; pause; return; }
  local environment; read -r -p "  Runtime environment [production]: " environment || true
  wsg_seed_env_files "$ANSWERS" "$REPO_ROOT" "${environment:-production}"
  info "Files are git-ignored. .secrets.env is chmod 600."
  pause
}

menu_setup() {
  while true; do
    print_header; section "2 › SETUP & TOOLING"; echo
    printf '  1) 🚀 Start Template into Production  %s(the full guided wizard)%s\n' "$C_DIM" "$C_RESET"
    printf '  2) Full bootstrap          %s(install + auth + MCP + interactive login gates)%s\n' "$C_DIM" "$C_RESET"
    echo "  3) Doctor — check prerequisites (versions + auth)"
    echo "  4) Install / update tooling (node, gh, gcloud, firebase, stripe, chrome/MCP)"
    echo "  5) Authenticate tooling (gh, gcloud, firebase, stripe) with login gates"
    echo "  6) Capture Firebase project info (full SDK snippet / Web / iOS / Android)"
    echo "  7) Seed .env files from captured config"
    echo "  8) Run guided setup (steps 00 → 12)"
    echo "  9) Firebase setup (login + select project)"
    echo " 10) Export setup packet zip (Downloads first)"
    echo " 11) Import/validate setup packet zip"
    echo " 12) Install git hooks (pre-push / post-merge / post-checkout)"
    echo " 13) Install the 'WSG-MENU' terminal command"
    echo " 14) Provider bootstrap (Google/Firebase + M365 + GoDaddy + Stripe + MCP)"
    echo " 15) Run first-time zip setup packet flow"
    echo; echo "  0) Back"; echo
    read -r -p "$(printf '  %sChoice:%s ' "$C_CYAN" "$C_RESET")" c || break
    case "$c" in
      1) [[ -f "$SCRIPTS_DIR/start-production.sh" ]] && bash "$SCRIPTS_DIR/start-production.sh" || err "start-production.sh missing"; pause;;
      2) confirm "Run full tooling bootstrap (include Stripe + MCP + interactive login gates)?" \
           && run_script "$SCRIPTS_DIR/bootstrap.sh" --with-stripe --with-mcp --interactive-login \
           || run_script "$SCRIPTS_DIR/bootstrap.sh";;
      3) run_script "$SCRIPTS_DIR/bootstrap.sh" --check;;
      4) run_script "$SCRIPTS_DIR/bootstrap.sh" --install --with-stripe --with-mcp;;
      5) run_script "$SCRIPTS_DIR/bootstrap.sh" --auth --with-stripe --with-mcp --interactive-login;;
      6) capture_firebase;;
      7) seed_env;;
      8) [[ -f "$TEMPLATE_DIR/setup.sh" ]] && ( cd "$TEMPLATE_DIR" && bash setup.sh ) || err "Template/setup.sh missing"; pause;;
      9) run_script "$SCRIPTS_DIR/firebase-setup.sh";;
      10) run_script "$SCRIPTS_DIR/build-setup-packet.sh";;
      11) run_script "$SCRIPTS_DIR/import-setup-packet.sh";;
      12) confirm "Install git hooks?" && run_script "$HOOKS_DIR/install-hooks.sh";;
      13) confirm "Install the 'WSG-MENU' terminal command?" && run_script "$SCRIPTS_DIR/install-command.sh";;
      14) run_script "$SCRIPTS_DIR/bootstrap.sh" --with-stripe --with-mcp --with-m365 --with-godaddy --interactive-login;;
      15) run_script "$SCRIPTS_DIR/first-time-setup-packet.sh" --pause;;
      0|q|Q) break;;
      *) warn "Invalid option";;
    esac
  done
}

# ── 2 · Deploy ────────────────────────────────────────────────────────────────
menu_deploy() {
  while true; do
    print_header; section "3 › DEPLOY"; echo
    printf '  1) Full auto-deploy        %s(gates → build → commit → push → deploy)%s\n' "$C_DIM" "$C_RESET"
    printf '  2) Preflight only          %s(gates + build, no git/deploy)%s\n' "$C_DIM" "$C_RESET"
    echo "  3) Deploy — Hosting only"
    printf '  4) Deploy — Rules only     %s(Firestore + Storage)%s\n' "$C_DIM" "$C_RESET"
    echo "  5) Deploy — Functions only"
    echo "  6) Full deploy + ESLint --fix"
    echo "  7) Bump patch + full deploy"
    printf '  8) Skip tests + deploy     %s(⚠ use with caution)%s\n' "$C_DIM" "$C_RESET"
    echo; echo "  0) Back"; echo
    read -r -p "$(printf '  %sChoice:%s ' "$C_CYAN" "$C_RESET")" c || break
    case "$c" in
      1) confirm "Run full deploy?" && run_script "$SCRIPTS_DIR/deploy.sh";;
      2) run_script "$SCRIPTS_DIR/deploy.sh" --preflight;;
      3) confirm "Deploy hosting only?" && run_script "$SCRIPTS_DIR/deploy-hosting.sh";;
      4) confirm "Deploy rules only?" && run_script "$SCRIPTS_DIR/deploy-rules.sh";;
      5) confirm "Deploy functions only?" && run_script "$SCRIPTS_DIR/deploy-functions.sh";;
      6) confirm "Full deploy with ESLint --fix?" && run_script "$SCRIPTS_DIR/deploy.sh" --fix;;
      7) confirm "Bump patch and deploy?" && run_script "$SCRIPTS_DIR/deploy.sh" --bump patch;;
      8) confirm "⚠ Skip tests and deploy?" && run_script "$SCRIPTS_DIR/deploy.sh" --skip-tests;;
      0|q|Q) break;;
      *) warn "Invalid option";;
    esac
  done
}

# ── 3 · Quality ───────────────────────────────────────────────────────────────
menu_quality() {
  while true; do
    print_header; section "4 › QUALITY CHECKS"; echo
    printf '  1) TypeScript check   %s(npm run typecheck)%s\n' "$C_DIM" "$C_RESET"
    printf '  2) ESLint             %s(npm run lint)%s\n' "$C_DIM" "$C_RESET"
    echo "  3) ESLint --fix"
    printf '  4) Tests              %s(npm run test, if present)%s\n' "$C_DIM" "$C_RESET"
    printf '  5) Full quality gate  %s(typecheck + lint + tests)%s\n' "$C_DIM" "$C_RESET"
    printf '  6) npm audit          %s(dependency vulnerabilities)%s\n' "$C_DIM" "$C_RESET"
    printf '  7) Security check     %s(rules + config + audit)%s\n' "$C_DIM" "$C_RESET"
    echo; echo "  0) Back"; echo
    read -r -p "$(printf '  %sChoice:%s ' "$C_CYAN" "$C_RESET")" c || break
    case "$c" in
      1) echo; divider; npm run -s typecheck --if-present || true; divider; pause;;
      2) echo; divider; npm run -s lint --if-present || true; divider; pause;;
      3) confirm "Run ESLint --fix?" && { echo; divider; npm run -s lint:fix --if-present || true; divider; pause; };;
      4) echo; divider; npm run -s test --if-present || true; divider; pause;;
      5) run_script "$SCRIPTS_DIR/quality-check.sh";;
      6) echo; divider; npm audit || true; divider; pause;;
      7) echo; divider; npm run -s ci:security || true; divider; pause;;
      0|q|Q) break;;
      *) warn "Invalid option";;
    esac
  done
}

# ── 4b · System governance ───────────────────────────────────────────────────
menu_system() {
  while true; do
    print_header; section "10 › SYSTEM GOVERNANCE"; echo
    echo "  1) Sync system surfaces (WSG-AGI)"
    echo "  2) Check system drift (WSG-AGI --check)"
    echo "  3) Verify template structure"
    echo "  4) Security check"
    echo "  5) WSG-AGI help"
    echo "  6) Unified Setup overview"
    echo "  7) List setup editions"
    echo "  8) Repo manifest scrape (dry run)"
    echo "  9) Write repo manifest"
    echo " 10) @@CODER.SatoshiUNO standard"
    echo " 11) WSG Account Levels standard"
    echo " 12) Unified Login standard"
    echo " 13) Account-level standard check"
    echo " 14) Firebase sender/auth/MFA standard"
    echo " 15) Auth/MFA readiness check"
    echo " 16) Full .SYSTEMX audit"
    echo " 17) Export setup packet zip"
    echo " 18) Import/validate setup packet zip"
    echo " 19) Validate imported packet folder"
    echo " 20) Show Setup-Input_MD ingest folder"
    echo; echo "  0) Back"; echo
    read -r -p "$(printf '  %sChoice:%s ' "$C_CYAN" "$C_RESET")" c || break
    case "$c" in
      1) run_script "$SELF_DIR/wsg-agi.sh";;
      2) run_script "$SELF_DIR/wsg-agi.sh" --check;;
      3) echo; divider; node "$SCRIPTS_DIR/verify-template-structure.mjs" || true; divider; pause;;
      4) echo; divider; npm run -s ci:security || true; divider; pause;;
      5) echo; divider; bash "$SELF_DIR/wsg-agi.sh" --help || true; divider; pause;;
      6) echo; divider; sed -n '1,220p' "$SELF_DIR/Unified-Setup-Process/README.md" || true; divider; pause;;
      7) echo; divider; for f in "$SELF_DIR"/Unified-Setup-Process/editions/*.json; do echo "--- $(basename "$f")"; node -e "const f=process.argv[1],j=require(f); console.log(j.name + ': ' + j.description + ' pageCap=' + (j.pageCap ?? 'none'))" "$f"; done; divider; pause;;
      8) echo; divider; npm run -s setup:unified:scrape:dry-run || true; divider; pause;;
      9) confirm "Write repo manifest from accessible GitHub repos?" && { echo; divider; npm run -s setup:unified:scrape || true; divider; pause; };;
      10) echo; divider; sed -n '1,220p' "$SELF_DIR/Unified-Setup-Process/standards/@@CODER.SatoshiUNO.md" || true; divider; pause;;
      11) echo; divider; sed -n '1,260p' "$SELF_DIR/Unified-Setup-Process/standards/WSG-Account-Levels.md" || true; divider; pause;;
      12) echo; divider; sed -n '1,260p' "$SELF_DIR/Unified-Setup-Process/standards/Unified-Login.md" || true; divider; pause;;
      13) echo; divider; node "$SCRIPTS_DIR/account-level-check.mjs" || true; divider; pause;;
      14) echo; divider; sed -n '1,280p' "$SELF_DIR/Unified-Setup-Process/standards/Firebase-Sender-Auth-MFA.md" || true; divider; pause;;
      15) echo; divider; npm run -s auth:mfa:check || true; divider; pause;;
      16) run_script "$SCRIPTS_DIR/system-audit.sh";;
      17) run_script "$SCRIPTS_DIR/build-setup-packet.sh";;
      18) run_script "$SCRIPTS_DIR/import-setup-packet.sh";;
      19) echo; divider; last_packet_dir="$(grep '^LAST_IMPORTED_PACKET_DIR=' "$SELF_DIR/status/setup-state.env" 2>/dev/null | tail -n 1 | cut -d= -f2-)"; if [[ -n "$last_packet_dir" ]]; then node "$SCRIPTS_DIR/validate-setup-packet.mjs" "$last_packet_dir" || true; else echo "No imported packet recorded in setup-state.env"; fi; divider; pause;;
      20) echo; divider; echo "$SELF_DIR/Setup-Input_MD"; echo; find "$SELF_DIR/Setup-Input_MD" -maxdepth 4 -type f \( -name '*.md' -o -name 'manifest.json' -o -name '*.json' -o -name '*.mmd' \) -print | sort || true; divider; pause;;
      0|q|Q) break;;
      *) warn "Invalid option";;
    esac
  done
}

# ── 4 · Version ───────────────────────────────────────────────────────────────
menu_version() {
  while true; do
    print_header; section "5 › VERSION MANAGEMENT"; echo
    printf '  %sCurrent:%s %sv%s%s\n\n' "$C_DIM" "$C_RESET" "$C_CYAN$C_BOLD" "$(version_str)" "$C_RESET"
    printf '  1) Bump patch  %s(x.x.+1)%s\n' "$C_DIM" "$C_RESET"
    printf '  2) Bump minor  %s(x.+1.0)%s\n' "$C_DIM" "$C_RESET"
    printf '  3) Bump major  %s(+1.0.0)%s\n' "$C_DIM" "$C_RESET"
    echo "  4) View version files"
    echo "  5) View CHANGELOG"
    echo; echo "  0) Back"; echo
    read -r -p "$(printf '  %sChoice:%s ' "$C_CYAN" "$C_RESET")" c || break
    case "$c" in
      1) confirm "Bump PATCH?" && run_script "$SCRIPTS_DIR/version-bump.sh" patch;;
      2) confirm "Bump MINOR?" && run_script "$SCRIPTS_DIR/version-bump.sh" minor;;
      3) confirm "Bump MAJOR?" && run_script "$SCRIPTS_DIR/version-bump.sh" major;;
      4) echo; divider; echo "app-version.txt:"; cat "$VERSION_DIR/app-version.txt" 2>/dev/null || echo "(none)"; echo; echo "version.json:"; cat "$VERSION_DIR/version.json" 2>/dev/null || echo "(none)"; divider; pause;;
      5) echo; divider; head -60 "$VERSION_DIR/CHANGELOG.md" 2>/dev/null || warn "CHANGELOG.md not found"; divider; pause;;
      0|q|Q) break;;
      *) warn "Invalid option";;
    esac
  done
}

# ── 5 · Firebase ──────────────────────────────────────────────────────────────
fb() { if have firebase; then firebase "$@"; elif have npx; then npx --yes firebase-tools "$@"; else err "Firebase CLI not found"; return 1; fi; }
menu_firebase() {
  while true; do
    print_header; section "6 › FIREBASE"; echo
    echo "  1) Login status / whoami"
    echo "  2) List projects"
    echo "  3) Show active project (.firebaserc)"
    echo "  4) Start emulator suite"
    echo "  5) Deploy Firestore indexes"
    echo "  6) Firebase setup (login + select project)"
    echo; echo "  0) Back"; echo
    read -r -p "$(printf '  %sChoice:%s ' "$C_CYAN" "$C_RESET")" c || break
    case "$c" in
      1) echo; divider; fb login:list 2>/dev/null || fb login || true; divider; pause;;
      2) echo; divider; fb projects:list || true; divider; pause;;
      3) echo; divider; cat "$REPO_ROOT/.firebaserc" 2>/dev/null || warn ".firebaserc not found"; divider; pause;;
      4) warn "Starting emulator — Ctrl+C to stop."; fb emulators:start || true; pause;;
      5) confirm "Deploy Firestore indexes?" && { echo; divider; fb deploy --only firestore:indexes || true; divider; pause; };;
      6) run_script "$SCRIPTS_DIR/firebase-setup.sh";;
      0|q|Q) break;;
      *) warn "Invalid option";;
    esac
  done
}

# ── 6 · Git ───────────────────────────────────────────────────────────────────
menu_git() {
  while true; do
    print_header; section "7 › GIT"; echo
    echo "  1) Status"
    echo "  2) Pull (fast-forward)"
    echo "  3) Log (last 15, graph)"
    echo "  4) Diff --stat"
    printf '  5) Add all + commit  %s(prompts for message)%s\n' "$C_DIM" "$C_RESET"
    echo "  6) Push current branch"
    echo; echo "  0) Back"; echo
    read -r -p "$(printf '  %sChoice:%s ' "$C_CYAN" "$C_RESET")" c || break
    case "$c" in
      1) echo; divider; git status; divider; pause;;
      2) confirm "git pull?" && { echo; divider; git pull --ff-only || git pull; divider; pause; };;
      3) echo; divider; git --no-pager log --oneline --decorate --graph -15; divider; pause;;
      4) echo; divider; git --no-pager diff --stat; divider; pause;;
      5) read -r -p "$(printf '  %sCommit message:%s ' "$C_CYAN" "$C_RESET")" m; [[ -z "$m" ]] && { warn "Empty — aborted."; pause; continue; }; echo; divider; git add -A && git commit -m "$m"; divider; pause;;
      6) confirm "Push $(git_branch)?" && { echo; divider; git push origin "$(git_branch)"; divider; pause; };;
      0|q|Q) break;;
      *) warn "Invalid option";;
    esac
  done
}

# ── 7 · Dev & app ─────────────────────────────────────────────────────────────
menu_dev() {
  while true; do
    print_header; section "8 › DEV & APP"; echo
    echo "  1) Install dependencies (npm install)"
    echo "  2) Start dev server (npm run dev)"
    echo "  3) Build for production (npm run build)"
    echo "  4) Preview production build (npm run preview)"
    echo "  5) Start SYSTEMX LAN + Vite session (auto ports)"
    echo "  6) Show SYSTEMX session status"
    echo "  7) End SYSTEMX session (owned processes only)"
    echo; echo "  0) Back"; echo
    read -r -p "$(printf '  %sChoice:%s ' "$C_CYAN" "$C_RESET")" c || break
    case "$c" in
      1) echo; divider; npm install; divider; pause;;
      2) info "Ctrl+C to stop the dev server."; echo; divider; npm run dev || true; divider; pause;;
      3) echo; divider; npm run build || true; divider; pause;;
      4) info "Ctrl+C to stop the preview server."; echo; divider; npm run preview || true; divider; pause;;
      5) info "Ctrl+C ends this foreground session; ports are auto-selected."; echo; divider; npm run dev:systemx || true; divider; pause;;
      6) echo; divider; npm run -s systemx:session:status || true; divider; pause;;
      7) confirm "Stop only the recorded SYSTEMX session processes?" && { echo; divider; npm run -s systemx:session:stop || true; divider; pause; };;
      0|q|Q) break;;
      *) warn "Invalid option";;
    esac
  done
}

# ── 7b · Update ───────────────────────────────────────────────────────────────
update_main_branch() {
  echo; divider
  git fetch origin main
  if [[ "$(git_branch)" != "main" ]]; then
    warn "Current branch is $(git_branch). Pulling origin/main is safest from main."
  fi
  git pull --ff-only origin main
  divider
}

update_menu_system() {
  echo; divider
  npm run -s sync:system || true
  npm run -s system:audit
  node "$SCRIPTS_DIR/verify-template-structure.mjs"
  bash -n "$SELF_DIR/WSG-MENU.sh"
  divider
}

update_code_deps() {
  echo; divider
  npm install
  if [[ -f "$SELF_DIR/Template/starter/package.json" ]]; then
    (cd "$SELF_DIR/Template/starter" && npm install)
  fi
  divider
}

run_update_gates() {
  echo; divider
  npm run -s ci:lint
  npm run -s ci:typecheck
  npm run -s ci:test
  npm run -s ci:security
  npm run -s ci:build
  divider
}

menu_update() {
  while true; do
    print_header; section "11 › UPDATE"; echo
    echo "  1) Update main from GitHub"
    echo "  2) Update menu / .SYSTEMX system surfaces"
    echo "  3) Update code dependencies (root + starter npm install)"
    echo "  4) Run update checks (lint + typecheck + test + security + build)"
    echo "  5) Run deploy preflight update"
    echo "  6) Update all safe (main + system + code + checks + preflight)"
    printf '  7) Update all + deploy  %s(confirmation required)%s\n' "$C_DIM" "$C_RESET"
    echo "  8) Preview standalone .SYSTEMX import (public main)"
    echo "  9) Import standalone .SYSTEMX and pin selected version"
    echo " 10) Show selected standalone defaults and integrity"
    echo; echo "  0) Back"; echo
    read -r -p "$(printf '  %sChoice:%s ' "$C_CYAN" "$C_RESET")" c || break
    case "$c" in
      8) python3 -B "$REPO_ROOT/scripts/sync-systemx.py"; pause;;
      9) confirm "Import reviewed standalone defaults from public main?" && { python3 -B "$REPO_ROOT/scripts/sync-systemx.py" --apply; pause; };;
      10) python3 -B "$SELF_DIR/manager.py" status --target "$REPO_ROOT"; pause;;
      1) confirm "Fetch and fast-forward main from GitHub?" && { update_main_branch || true; pause; };;
      2) update_menu_system || true; pause;;
      3) confirm "Run npm install in root and starter?" && { update_code_deps || true; pause; };;
      4) run_update_gates || true; pause;;
      5) run_script "$SCRIPTS_DIR/deploy.sh" --preflight;;
      6) confirm "Run safe update-all flow?" && { update_main_branch && update_menu_system && update_code_deps && run_update_gates && bash "$SCRIPTS_DIR/deploy.sh" --preflight; pause; };;
      7) confirm "Run update-all and deploy to Firebase?" && { update_main_branch && update_menu_system && update_code_deps && run_update_gates && bash "$SCRIPTS_DIR/deploy.sh"; pause; };;
      0|q|Q) break;;
      *) warn "Invalid option";;
    esac
  done
}

# ── 8 · Info ──────────────────────────────────────────────────────────────────
menu_info() {
  print_header; section "9 › PROJECT INFO"; echo
  echo "  Repo:    $(git remote get-url origin 2>/dev/null || echo 'N/A')"
  echo "  Branch:  $(git_branch)"
  echo "  Version: v$(version_str)"
  echo "  Node:    $(node --version 2>/dev/null || echo N/A)   npm: $(npm --version 2>/dev/null || echo N/A)"
  echo "  Firebase:$(firebase --version 2>/dev/null || echo ' not installed (npx fallback)')"
  echo "  Root:    $REPO_ROOT"
  echo; divider; info "Last 5 commits:"; git --no-pager log --oneline --decorate -5 2>/dev/null || echo "  (none)"; divider
  pause
}

# ── Main ──────────────────────────────────────────────────────────────────────
main_menu() {
  while true; do
    print_header
    printf '  %s%sMain Menu%s\n\n' "$C_BOLD" "$C_WHITE" "$C_RESET"
    printf '  %s%s1)%s %s🚀 Start Template into Production%s  %sguided one-time setup → live%s\n' "$C_GREEN" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    divider
    printf '  %s%s2)%s %sSetup & Tooling%s   %sbootstrap · auth · capture Firebase · guided setup%s\n' "$C_YELLOW" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    printf '  %s%s3)%s %sDeploy%s            %sFull · hosting · rules · functions · preflight%s\n' "$C_BLUE" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    printf '  %s%s4)%s %sQuality Checks%s    %sTypeScript · ESLint · tests · audit%s\n' "$C_GREEN" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    printf '  %s%s5)%s %sVersion%s           %sBump patch/minor/major · changelog%s\n' "$C_MAGENTA" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    printf '  %s%s6)%s %sFirebase%s          %sLogin · projects · emulator · indexes%s\n' "$C_RED" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    printf '  %s%s7)%s %sGit%s               %sStatus · pull · commit · push%s\n' "$C_CYAN" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    printf '  %s8)%s %sDev & App%s         %sInstall · dev · build · preview%s\n' "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    printf '  %s%s9)%s %sProject Info%s      %sVersions · repo · recent commits%s\n' "$C_DIM" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    printf '  %s%s10)%s %sSystem%s          %sWSG-AGI · structure · security%s\n' "$C_DIM" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    printf '  %s%s11)%s %sUpdate%s          %smain · menu · code · deploy update-all%s\n' "$C_YELLOW" "$C_BOLD" "$C_RESET" "$C_BOLD" "$C_RESET" "$C_DIM" "$C_RESET"
    echo " 12) Standalone SYSTEMX — tasks, context, projects, checks, managed defaults"
    echo; divider; printf '  %s0)%s Exit\n' "$C_BOLD" "$C_RESET"; echo
    read -r -p "$(printf '  %s%s▸ Choose:%s ' "$C_CYAN" "$C_BOLD" "$C_RESET")" c || exit 0
    case "$c" in
      1) [[ -f "$SCRIPTS_DIR/start-production.sh" ]] && bash "$SCRIPTS_DIR/start-production.sh" || err "start-production.sh missing"; pause;;
      2) menu_setup;;
      3) menu_deploy;;
      4) menu_quality;;
      5) menu_version;;
      6) menu_firebase;;
      7) menu_git;;
      8) menu_dev;;
      9) menu_info;;
      10) menu_system;;
      11) menu_update;;
      12) bash "$SELF_DIR/SYSTEMX.sh" menu;;
      0|q|Q|exit|quit) clear_screen; printf '  %sWebApp Stack G1 — see you next time.%s\n\n' "$C_CYAN" "$C_RESET"; exit 0;;
      *) warn "Invalid option — pick 1-12 or 0.";;
    esac
  done
}

main_menu "$@"
