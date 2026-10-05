#!/usr/bin/env bash
# =============================================================================
# WebApp Stack G One Point Zero — interactive setup orchestrator
# -----------------------------------------------------------------------------
# Walks prerequisites, interview, first-time intake, and steps 02..12 with verification gates.
# This script DOES NOT make destructive changes. It:
#   - verifies required CLIs are present (Step 00)
#   - interviews the operator and writes ./interview.answers (Step 01)
#   - for every step, prints the step doc and pauses at the verification gate
#     so the operator runs the (parameterized) commands and confirms before
#     advancing.
# Re-runnable: existing answers are reused unless you choose to redo the interview.
# =============================================================================
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STEPS_DIR="$HERE/steps"
TEMPLATES_DIR="$HERE/templates"
ANSWERS="$HERE/interview.answers"
LIB="$HERE/lib/firebase-config.sh"

c_reset=$'\033[0m'; c_bold=$'\033[1m'; c_blue=$'\033[34m'
c_green=$'\033[32m'; c_yellow=$'\033[33m'; c_red=$'\033[31m'

# Shared Firebase project-info capture (Web / iOS / Android).
if [ -f "$LIB" ]; then
  # shellcheck source=/dev/null
  . "$LIB"
fi

banner() { printf '\n%s%s== %s ==%s\n' "$c_bold" "$c_blue" "$1" "$c_reset"; }
ok()     { printf '%s✓ %s%s\n' "$c_green" "$1" "$c_reset"; }
warn()   { printf '%s! %s%s\n' "$c_yellow" "$1" "$c_reset"; }
err()    { printf '%s✗ %s%s\n' "$c_red" "$1" "$c_reset"; }

ask() { # ask "Prompt" "default" -> echoes the answer
  local prompt="$1" default="${2:-}" reply
  if [ -n "$default" ]; then
    read -r -p "$prompt [$default]: " reply || true
    printf '%s' "${reply:-$default}"
  else
    read -r -p "$prompt: " reply || true
    printf '%s' "$reply"
  fi
}

pause_gate() { # pause until operator confirms the step's verification gate passed
  local step="$1"
  printf '\n%sVerification gate for %s%s\n' "$c_bold" "$step" "$c_reset"
  read -r -p "Did the gate pass? Type 'y' to continue, 's' to skip, 'q' to quit: " a || true
  case "$a" in
    y|Y) ok "$step gate passed";;
    s|S) warn "$step skipped by operator";;
    q|Q) err "Aborted at $step"; exit 1;;
    *)   warn "Unrecognized input; treating as skip"; ;;
  esac
}

show_step() { # print the step doc (paged if possible)
  local file="$1"
  if [ -f "$file" ]; then
    if command -v less >/dev/null 2>&1; then less -R "$file"; else cat "$file"; fi
  else
    err "Missing step file: $file"
  fi
}

# -----------------------------------------------------------------------------
# Step 00 — prerequisites: verify required CLIs
# -----------------------------------------------------------------------------
check_prereqs() {
  banner "Step 00 — Prerequisites"
  local required=(node npm git gh gcloud)
  local optional=(stripe)
  local missing=0
  for c in "${required[@]}"; do
    if command -v "$c" >/dev/null 2>&1; then ok "$c -> $($c --version 2>/dev/null | head -n1)"
    else err "$c NOT found"; missing=1; fi
  done
  for c in "${optional[@]}"; do
    if command -v "$c" >/dev/null 2>&1; then ok "$c (optional) -> $($c --version 2>/dev/null | head -n1)"
    else warn "$c (optional) not found — needed only if BILLING=yes"; fi
  done
  if command -v firebase >/dev/null 2>&1; then
    ok "firebase -> $(firebase --version 2>/dev/null | head -n1)"
  elif command -v npx >/dev/null 2>&1; then
    ok "firebase-tools -> $(npx --yes firebase-tools --version 2>/dev/null | head -n1)"
  else
    err "firebase-tools unavailable — install Firebase CLI or Node/npm for npx"
    missing=1
  fi
  if [ "$missing" -ne 0 ]; then
    err "Install missing required CLIs (see steps/00-prerequisites.md) and re-run."
    exit 1
  fi
  ok "All required CLIs present."
}

# -----------------------------------------------------------------------------
# Step 01 — interview: collect answers, write ./interview.answers
# -----------------------------------------------------------------------------
run_interview() {
  banner "Step 01 — Project Interview"
  if [ -f "$ANSWERS" ]; then
    local redo; redo="$(ask "interview.answers exists. Redo interview? (y/N)" "N")"
    case "$redo" in y|Y) : ;; *) ok "Keeping existing answers"; return 0;; esac
  fi

  local DISPLAY_NAME SLUG DESCRIPTION PRIMARY_DOMAIN PROJECT_TYPE GCP_REGION
  local FIREBASE_MODE EXISTING_PROJECT_ID AUTH_PROVIDERS BILLING EMAIL EMAIL_PROVIDER
  local MONITORING MCP GITHUB_REPO ENVIRONMENTS

  DISPLAY_NAME="$(ask 'Display name (e.g. Acme Portal)')"
  SLUG="$(ask 'Slug (kebab-case, DNS-safe)')"
  DESCRIPTION="$(ask 'One-line description')"
  PRIMARY_DOMAIN="$(ask 'Primary domain (blank = <slug>.web.app)' '')"
  PROJECT_TYPE="$(ask 'Project type (brochure|saas|ecommerce|membership|admin|docs)' 'saas')"
  GCP_REGION="$(ask 'GCP region' 'us-west1')"
  FIREBASE_MODE="$(ask 'Firebase project (create|existing)' 'create')"
  EXISTING_PROJECT_ID=""
  if [ "$FIREBASE_MODE" = "existing" ]; then
    EXISTING_PROJECT_ID="$(ask 'Existing Firebase project ID')"
  fi
  AUTH_PROVIDERS="$(ask 'Auth providers (comma list)' 'email,google')"
  local PLATFORMS
  PLATFORMS="$(ask 'Firebase platforms to configure (comma list: web,ios,android)' 'web')"
  BILLING="$(ask 'Billing / Stripe module? (yes|no)' 'no')"
  EMAIL="$(ask 'Transactional email module? (yes|no)' 'no')"
  EMAIL_PROVIDER=""
  if [ "$EMAIL" = "yes" ]; then EMAIL_PROVIDER="$(ask 'Email provider (smtp|<api>)' 'smtp')"; fi
  MONITORING="$(ask 'Monitoring (Sentry)? (yes|no)' 'yes')"
  MCP="$(ask 'MCP automation? Chrome/Firebase/GCloud/Stripe placeholders (yes|no)' 'no')"
  GITHUB_REPO="$(ask 'GitHub repo (owner/name)')"
  ENVIRONMENTS="$(ask 'Environments (comma list)' 'development,production')"

  cat > "$ANSWERS" <<EOF
# Generated by setup.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
DISPLAY_NAME=$DISPLAY_NAME
SLUG=$SLUG
DESCRIPTION=$DESCRIPTION
PRIMARY_DOMAIN=$PRIMARY_DOMAIN
PROJECT_TYPE=$PROJECT_TYPE
GCP_REGION=$GCP_REGION
FIREBASE_MODE=$FIREBASE_MODE
EXISTING_PROJECT_ID=$EXISTING_PROJECT_ID
FIREBASE_PROJECT_ID=
FIREBASE_PROJECT_NUMBER=
PLATFORMS=$PLATFORMS
AUTH_PROVIDERS=$AUTH_PROVIDERS
BILLING=$BILLING
EMAIL=$EMAIL
EMAIL_PROVIDER=$EMAIL_PROVIDER
MONITORING=$MONITORING
MCP=$MCP
GITHUB_REPO=$GITHUB_REPO
CICD=github-actions
ENVIRONMENTS=$ENVIRONMENTS
# --- Firebase WEB app config (paste from Firebase console → Web app) ---
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
# --- Firebase iOS app config (from GoogleService-Info.plist) ---
IOS_BUNDLE_ID=
IOS_APP_ID=
IOS_API_KEY=
IOS_CLIENT_ID=
IOS_REVERSED_CLIENT_ID=
IOS_STORAGE_BUCKET=
# --- Firebase Android app config (from google-services.json) ---
ANDROID_PACKAGE_NAME=
ANDROID_APP_ID=
ANDROID_API_KEY=
ANDROID_STORAGE_BUCKET=
EOF
  ok "Wrote $ANSWERS"
  # Required-key sanity check:
  local required_keys=(DISPLAY_NAME SLUG PROJECT_TYPE GCP_REGION FIREBASE_MODE AUTH_PROVIDERS GITHUB_REPO)
  for k in "${required_keys[@]}"; do
    if ! grep -qE "^$k=.+" "$ANSWERS"; then err "Required answer '$k' is empty"; fi
  done

  # Offer to paste the Google/Firebase project info now (Web / iOS / Android).
  if declare -F wsg_capture_firebase >/dev/null 2>&1; then
    local cap; cap="$(ask 'Paste your Firebase project info now (Web/iOS/Android)? (Y/n)' 'Y')"
    case "$cap" in n|N) warn 'Skipped — you can paste it later via WSG-MENU option 4 or before Step 04.';; *) wsg_capture_firebase "$ANSWERS";; esac
  else
    warn "Firebase capture lib not loaded ($LIB); paste config manually before Step 04."
  fi
}

# -----------------------------------------------------------------------------
# Walk steps 02..12 — show doc, pause at gate
# -----------------------------------------------------------------------------
walk_steps() {
  # ordered list of (file, title); module steps are noted as optional in the doc
  local steps=(
    "02-scaffold.md|Step 02 — Scaffold"
    "03-firebase-provision.md|Step 03 — Firebase Provision"
    "04-env-and-secrets.md|Step 04 — Env & Secrets"
    "05-stripe.md|Step 05 — Stripe (optional)"
    "06-cloud-functions.md|Step 06 — Cloud Functions"
    "07-security-rules.md|Step 07 — Security Rules"
    "08-mcp-servers.md|Step 08 — MCP Servers (optional)"
    "09-ci-cd.md|Step 09 — CI/CD"
    "10-testing-qa.md|Step 10 — Testing & QA"
    "11-build-deploy.md|Step 11 — Build & Deploy"
    "12-post-launch.md|Step 12 — Post-Launch"
  )
  for entry in "${steps[@]}"; do
    local file="${entry%%|*}" title="${entry##*|}"
    banner "$title"
    local go; go="$(ask "Open the doc for '$title'? (Y/n/skip)" "Y")"
    case "$go" in
      n|N) ok "Acknowledged $title (doc not shown)";;
      s|S|skip) warn "Skipping $title"; continue;;
      *) show_step "$STEPS_DIR/$file";;
    esac
    pause_gate "$title"
  done
}

main() {
  banner "WebApp Stack G One Point Zero — setup orchestrator"
  echo "Reference: $HERE/WEBAPP-STACK-G1.0.md"
  echo "Steps:     $STEPS_DIR"
  echo
  check_prereqs
  run_interview
  if [ -f "$HERE/../scripts/first-time-setup-packet.sh" ]; then
    banner "First-Time Setup Intake Packet"
    bash "$HERE/../scripts/first-time-setup-packet.sh" --pause
  fi
  walk_steps
  banner "Done"
  ok "All steps walked. Re-run anytime: bash $0"
  echo "Definition of done: unified intake complete and legacy gates green (see WEBAPP-STACK-G1.0.md §10)."
}

main "$@"
