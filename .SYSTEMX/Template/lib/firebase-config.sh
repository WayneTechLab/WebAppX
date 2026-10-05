#!/usr/bin/env bash
# =============================================================================
# WebApp Stack G One Point Zero — Firebase config capture library
# -----------------------------------------------------------------------------
# Shared, sourceable helpers that ask the operator to PASTE the Google/Firebase
# project info they received for each platform (Web, iOS, Android) and write the
# resolved keys into an answers file.
#
# Source it, then call:
#     wsg_capture_firebase /path/to/interview.answers
#
# Supported inputs per platform:
#   • Web     — paste the `firebaseConfig` block (or enter fields one by one)
#   • iOS     — point at GoogleService-Info.plist (auto-parsed) or enter fields
#   • Android — point at google-services.json   (auto-parsed) or enter fields
#
# No external deps are required; google-services.json parsing prefers python3
# and falls back to manual entry if it is unavailable.
# =============================================================================

# --- colors (only define if the caller hasn't) -------------------------------
: "${c_reset:=$'\033[0m'}"; : "${c_bold:=$'\033[1m'}"; : "${c_blue:=$'\033[34m'}"
: "${c_green:=$'\033[32m'}"; : "${c_yellow:=$'\033[33m'}"; : "${c_red:=$'\033[31m'}"

wsg__say()  { printf '%s%s%s\n' "$c_blue" "$1" "$c_reset"; }
wsg__ok()   { printf '%s✓ %s%s\n' "$c_green" "$1" "$c_reset"; }
wsg__warn() { printf '%s! %s%s\n' "$c_yellow" "$1" "$c_reset"; }

# Prompt with a default; echoes the chosen value.
wsg__ask() {
  local prompt="$1" default="${2:-}" reply
  if [ -n "$default" ]; then
    read -r -p "$prompt [$default]: " reply || true
    printf '%s' "${reply:-$default}"
  else
    read -r -p "$prompt: " reply || true
    printf '%s' "$reply"
  fi
}

# Insert-or-replace KEY=VALUE in FILE (idempotent). Matching is anchored on the
# exact key; non-matching lines are preserved verbatim.
wsg__upsert_kv() {
  local file="$1" key="$2" value="$3" tmp
  [ -f "$file" ] || : > "$file"
  if grep -qE "^${key}=" "$file" 2>/dev/null; then
    tmp="$(mktemp)"
    awk -v k="$key" -v v="$value" '
      $0 ~ "^" k "=" { print k "=" v; next }
      { print }
    ' "$file" > "$tmp" && mv "$tmp" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >> "$file"
  fi
}

# Read the current value of KEY from FILE (empty if absent).
wsg__get_kv() {
  local file="$1" key="$2"
  [ -f "$file" ] || return 0
  sed -nE "s/^${key}=(.*)$/\1/p" "$file" | head -n1
}

# Read a multi-line block from stdin until a blank line is entered.
wsg__read_block() {
  local line buf=""
  while IFS= read -r line; do
    [ -z "$line" ] && break
    buf+="$line"$'\n'
  done
  printf '%s' "$buf"
}

# Read a full Firebase SDK snippet. This supports the exact Firebase console
# copy-paste format, including imports, comments, blank lines, firebaseConfig,
# initializeApp, and getAnalytics. End with a line containing only WSG_END.
wsg__read_firebase_sdk_block() {
  local line buf=""
  while IFS= read -r line; do
    [ "$line" = "WSG_END" ] && break
    buf+="$line"$'\n'
  done
  printf '%s' "$buf"
}

# Extract a JS/JSON-style "key: value" string from a pasted block.
#   wsg__extract_field "<block>" apiKey
wsg__extract_field() {
  local block="$1" field="$2"
  printf '%s' "$block" \
    | sed -nE "s/.*[\"']?${field}[\"']?[[:space:]]*[:=][[:space:]]*[\"']([^\"']+)[\"'].*/\1/p" \
    | head -n1
}

# Read a string value for KEY from an Apple .plist file.
wsg__plist_get() {
  local key="$1" file="$2"
  if [ -x /usr/libexec/PlistBuddy ]; then
    /usr/libexec/PlistBuddy -c "Print :$key" "$file" 2>/dev/null && return 0
  fi
  awk -v k="$key" '
    $0 ~ "<key>" k "</key>" {
      getline
      gsub(/^[[:space:]]*<string>/, "")
      gsub(/<\/string>[[:space:]]*$/, "")
      print
      exit
    }
  ' "$file"
}

# -----------------------------------------------------------------------------
# WEB — paste the firebaseConfig block, or enter the seven values by hand.
# -----------------------------------------------------------------------------
wsg__capture_web() {
  local file="$1" mode block
  wsg__say "── Firebase WEB app config ──"
  echo "Source: Firebase console → Project settings → General → Your apps (Web) → SDK setup & config → Config"
  mode="$(wsg__ask 'Input mode: full (s)dk snippet, (p)aste config object, or (f)ields one-by-one' 's')"

  local apiKey authDomain projectId storageBucket senderId appId measurementId
  if [ "$mode" = "s" ] || [ "$mode" = "S" ]; then
    cat <<'EOF'
Paste the full Firebase Web SDK snippet exactly as Firebase provides it.
Blank lines are OK. When finished, type WSG_END on its own line.

Example shape:
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyCxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx",
  measurementId: "G-XXXXXXXXXX"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
WSG_END
EOF
    block="$(wsg__read_firebase_sdk_block)"
    apiKey="$(wsg__extract_field "$block" apiKey)"
    authDomain="$(wsg__extract_field "$block" authDomain)"
    projectId="$(wsg__extract_field "$block" projectId)"
    storageBucket="$(wsg__extract_field "$block" storageBucket)"
    senderId="$(wsg__extract_field "$block" messagingSenderId)"
    appId="$(wsg__extract_field "$block" appId)"
    measurementId="$(wsg__extract_field "$block" measurementId)"
  elif [ "$mode" = "p" ] || [ "$mode" = "P" ]; then
    echo "Paste the firebaseConfig values now. Finish with an empty line:"
    block="$(wsg__read_block)"
    apiKey="$(wsg__extract_field "$block" apiKey)"
    authDomain="$(wsg__extract_field "$block" authDomain)"
    projectId="$(wsg__extract_field "$block" projectId)"
    storageBucket="$(wsg__extract_field "$block" storageBucket)"
    senderId="$(wsg__extract_field "$block" messagingSenderId)"
    appId="$(wsg__extract_field "$block" appId)"
    measurementId="$(wsg__extract_field "$block" measurementId)"
  fi

  # Field prompts (also used to confirm/fix parsed values).
  apiKey="$(wsg__ask 'apiKey            → VITE_FIREBASE_API_KEY' "${apiKey:-$(wsg__get_kv "$file" VITE_FIREBASE_API_KEY)}")"
  authDomain="$(wsg__ask 'authDomain        → VITE_FIREBASE_AUTH_DOMAIN' "${authDomain:-$(wsg__get_kv "$file" VITE_FIREBASE_AUTH_DOMAIN)}")"
  projectId="$(wsg__ask 'projectId         → VITE_FIREBASE_PROJECT_ID' "${projectId:-$(wsg__get_kv "$file" VITE_FIREBASE_PROJECT_ID)}")"
  storageBucket="$(wsg__ask 'storageBucket     → VITE_FIREBASE_STORAGE_BUCKET' "${storageBucket:-$(wsg__get_kv "$file" VITE_FIREBASE_STORAGE_BUCKET)}")"
  senderId="$(wsg__ask 'messagingSenderId → VITE_FIREBASE_MESSAGING_SENDER_ID' "${senderId:-$(wsg__get_kv "$file" VITE_FIREBASE_MESSAGING_SENDER_ID)}")"
  appId="$(wsg__ask 'appId             → VITE_FIREBASE_APP_ID' "${appId:-$(wsg__get_kv "$file" VITE_FIREBASE_APP_ID)}")"
  measurementId="$(wsg__ask 'measurementId     → VITE_FIREBASE_MEASUREMENT_ID (optional)' "${measurementId:-$(wsg__get_kv "$file" VITE_FIREBASE_MEASUREMENT_ID)}")"

  wsg__upsert_kv "$file" VITE_FIREBASE_API_KEY "$apiKey"
  wsg__upsert_kv "$file" VITE_FIREBASE_AUTH_DOMAIN "$authDomain"
  wsg__upsert_kv "$file" VITE_FIREBASE_PROJECT_ID "$projectId"
  wsg__upsert_kv "$file" VITE_FIREBASE_STORAGE_BUCKET "$storageBucket"
  wsg__upsert_kv "$file" VITE_FIREBASE_MESSAGING_SENDER_ID "$senderId"
  wsg__upsert_kv "$file" VITE_FIREBASE_APP_ID "$appId"
  wsg__upsert_kv "$file" VITE_FIREBASE_MEASUREMENT_ID "$measurementId"

  # Shared project identity (used by all platforms / later steps).
  [ -n "$projectId" ] && wsg__upsert_kv "$file" FIREBASE_PROJECT_ID "$projectId"
  [ -n "$senderId" ] && wsg__upsert_kv "$file" FIREBASE_PROJECT_NUMBER "$senderId"
  wsg__ok "Captured Web config."
}

# -----------------------------------------------------------------------------
# iOS — import GoogleService-Info.plist (auto-parse) or enter fields by hand.
# -----------------------------------------------------------------------------
wsg__capture_ios() {
  local file="$1" plist
  wsg__say "── Firebase iOS app config ──"
  echo "Source: Firebase console → iOS app → GoogleService-Info.plist"
  plist="$(wsg__ask 'Path to GoogleService-Info.plist (blank = enter fields manually)' '')"

  local bundle appId apiKey clientId reversed storageBucket projectId senderId
  if [ -n "$plist" ] && [ -f "$plist" ]; then
    bundle="$(wsg__plist_get BUNDLE_ID "$plist")"
    appId="$(wsg__plist_get GOOGLE_APP_ID "$plist")"
    apiKey="$(wsg__plist_get API_KEY "$plist")"
    clientId="$(wsg__plist_get CLIENT_ID "$plist")"
    reversed="$(wsg__plist_get REVERSED_CLIENT_ID "$plist")"
    storageBucket="$(wsg__plist_get STORAGE_BUCKET "$plist")"
    projectId="$(wsg__plist_get PROJECT_ID "$plist")"
    senderId="$(wsg__plist_get GCM_SENDER_ID "$plist")"
    wsg__ok "Parsed $plist"
  elif [ -n "$plist" ]; then
    wsg__warn "File not found: $plist — falling back to manual entry."
  fi

  bundle="$(wsg__ask 'iOS bundle id            → IOS_BUNDLE_ID' "${bundle:-$(wsg__get_kv "$file" IOS_BUNDLE_ID)}")"
  appId="$(wsg__ask 'GOOGLE_APP_ID            → IOS_APP_ID' "${appId:-$(wsg__get_kv "$file" IOS_APP_ID)}")"
  apiKey="$(wsg__ask 'API_KEY                  → IOS_API_KEY' "${apiKey:-$(wsg__get_kv "$file" IOS_API_KEY)}")"
  clientId="$(wsg__ask 'CLIENT_ID                → IOS_CLIENT_ID (optional)' "${clientId:-$(wsg__get_kv "$file" IOS_CLIENT_ID)}")"
  reversed="$(wsg__ask 'REVERSED_CLIENT_ID       → IOS_REVERSED_CLIENT_ID (optional)' "${reversed:-$(wsg__get_kv "$file" IOS_REVERSED_CLIENT_ID)}")"
  storageBucket="$(wsg__ask 'STORAGE_BUCKET           → IOS_STORAGE_BUCKET' "${storageBucket:-$(wsg__get_kv "$file" IOS_STORAGE_BUCKET)}")"

  wsg__upsert_kv "$file" IOS_BUNDLE_ID "$bundle"
  wsg__upsert_kv "$file" IOS_APP_ID "$appId"
  wsg__upsert_kv "$file" IOS_API_KEY "$apiKey"
  wsg__upsert_kv "$file" IOS_CLIENT_ID "$clientId"
  wsg__upsert_kv "$file" IOS_REVERSED_CLIENT_ID "$reversed"
  wsg__upsert_kv "$file" IOS_STORAGE_BUCKET "$storageBucket"
  [ -n "${projectId:-}" ] && wsg__upsert_kv "$file" FIREBASE_PROJECT_ID "$projectId"
  [ -n "${senderId:-}" ] && wsg__upsert_kv "$file" FIREBASE_PROJECT_NUMBER "$senderId"
  wsg__ok "Captured iOS config."
}

# -----------------------------------------------------------------------------
# Android — import google-services.json (auto-parse) or enter fields by hand.
# -----------------------------------------------------------------------------
wsg__capture_android() {
  local file="$1" json
  wsg__say "── Firebase Android app config ──"
  echo "Source: Firebase console → Android app → google-services.json"
  json="$(wsg__ask 'Path to google-services.json (blank = enter fields manually)' '')"

  local pkg appId apiKey storageBucket projectId projectNumber parsed=""
  if [ -n "$json" ] && [ -f "$json" ] && command -v python3 >/dev/null 2>&1; then
    parsed="$(python3 - "$json" <<'PY'
import json, sys
try:
    d = json.load(open(sys.argv[1]))
except Exception:
    sys.exit(0)
pi = d.get("project_info", {})
clients = d.get("client") or [{}]
c = clients[0]
ci = c.get("client_info", {})
keys = c.get("api_key") or []
print("PROJECT_ID=" + pi.get("project_id", ""))
print("PROJECT_NUMBER=" + pi.get("project_number", ""))
print("STORAGE_BUCKET=" + pi.get("storage_bucket", ""))
print("APP_ID=" + ci.get("mobilesdk_app_id", ""))
print("PACKAGE_NAME=" + ci.get("android_client_info", {}).get("package_name", ""))
print("API_KEY=" + (keys[0].get("current_key", "") if keys else ""))
PY
)"
    if [ -n "$parsed" ]; then
      projectId="$(printf '%s\n' "$parsed" | sed -nE 's/^PROJECT_ID=(.*)$/\1/p')"
      projectNumber="$(printf '%s\n' "$parsed" | sed -nE 's/^PROJECT_NUMBER=(.*)$/\1/p')"
      storageBucket="$(printf '%s\n' "$parsed" | sed -nE 's/^STORAGE_BUCKET=(.*)$/\1/p')"
      appId="$(printf '%s\n' "$parsed" | sed -nE 's/^APP_ID=(.*)$/\1/p')"
      pkg="$(printf '%s\n' "$parsed" | sed -nE 's/^PACKAGE_NAME=(.*)$/\1/p')"
      apiKey="$(printf '%s\n' "$parsed" | sed -nE 's/^API_KEY=(.*)$/\1/p')"
      wsg__ok "Parsed $json"
    fi
  elif [ -n "$json" ] && [ ! -f "$json" ]; then
    wsg__warn "File not found: $json — falling back to manual entry."
  elif [ -n "$json" ]; then
    wsg__warn "python3 not available — falling back to manual entry."
  fi

  pkg="$(wsg__ask 'package_name        → ANDROID_PACKAGE_NAME' "${pkg:-$(wsg__get_kv "$file" ANDROID_PACKAGE_NAME)}")"
  appId="$(wsg__ask 'mobilesdk_app_id    → ANDROID_APP_ID' "${appId:-$(wsg__get_kv "$file" ANDROID_APP_ID)}")"
  apiKey="$(wsg__ask 'current_key         → ANDROID_API_KEY' "${apiKey:-$(wsg__get_kv "$file" ANDROID_API_KEY)}")"
  storageBucket="$(wsg__ask 'storage_bucket      → ANDROID_STORAGE_BUCKET' "${storageBucket:-$(wsg__get_kv "$file" ANDROID_STORAGE_BUCKET)}")"

  wsg__upsert_kv "$file" ANDROID_PACKAGE_NAME "$pkg"
  wsg__upsert_kv "$file" ANDROID_APP_ID "$appId"
  wsg__upsert_kv "$file" ANDROID_API_KEY "$apiKey"
  wsg__upsert_kv "$file" ANDROID_STORAGE_BUCKET "$storageBucket"
  [ -n "${projectId:-}" ] && wsg__upsert_kv "$file" FIREBASE_PROJECT_ID "$projectId"
  [ -n "${projectNumber:-}" ] && wsg__upsert_kv "$file" FIREBASE_PROJECT_NUMBER "$projectNumber"
  wsg__ok "Captured Android config."
}

# -----------------------------------------------------------------------------
# Top-level: ask which platforms and capture each.
#   wsg_capture_firebase /path/to/interview.answers
# -----------------------------------------------------------------------------
wsg_capture_firebase() {
  local file="${1:?usage: wsg_capture_firebase <answers-file>}" platforms
  [ -f "$file" ] || : > "$file"

  printf '\n%s%s== Firebase project config (paste what you got from Firebase) ==%s\n' \
    "$c_bold" "$c_blue" "$c_reset"
  echo "You'll paste the project info Firebase gave you per platform."
  echo "Tip: the projectId / project number is the SAME across Web, iOS, and Android."

  platforms="$(wsg__ask 'Platforms to configure (comma list: web,ios,android)' \
    "$(wsg__get_kv "$file" PLATFORMS)")"
  [ -z "$platforms" ] && platforms="web"
  wsg__upsert_kv "$file" PLATFORMS "$platforms"

  case ",$platforms," in *,web,*)     wsg__capture_web "$file";;     esac
  case ",$platforms," in *,ios,*)     wsg__capture_ios "$file";;     esac
  case ",$platforms," in *,android,*) wsg__capture_android "$file";; esac

  printf '\n'
  wsg__ok "Firebase config written to: $file"
  echo "Shared: FIREBASE_PROJECT_ID=$(wsg__get_kv "$file" FIREBASE_PROJECT_ID)  PROJECT_NUMBER=$(wsg__get_kv "$file" FIREBASE_PROJECT_NUMBER)"
}

# -----------------------------------------------------------------------------
# Capture approved public client KEY=VALUE values — processed ONCE into the
# answers file. Only VITE_* client values and documented Firebase project
# identifiers are accepted. Server secrets, tokens, passwords, private keys,
# and webhook values are rejected and must use provider-managed secret storage.
# -----------------------------------------------------------------------------
wsg_capture_env_paste() {
  local file="${1:?usage: wsg_capture_env_paste <answers-file>}" line key val count=0
  [ -f "$file" ] || : > "$file"
  printf '\n%s%s== Capture public client values (processed once) ==%s\n' "$c_bold" "$c_blue" "$c_reset"
  echo "Paste approved VITE_* / Firebase project values only. Finish with an empty line:"
  while IFS= read -r line; do
    [ -z "$line" ] && break
    case "$line" in \#*) continue;; esac
    [[ "$line" == *"="* ]] || continue
    key="${line%%=*}"; val="${line#*=}"
    key="$(printf '%s' "$key" | tr -d '[:space:]')"
    # strip surrounding quotes from value
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    [ -n "$key" ] || continue
    case "$key" in
      VITE_*) ;;
      FIREBASE_PROJECT_ID|FIREBASE_PROJECT_NUMBER|FIREBASE_APP_ID|FIREBASE_AUTH_DOMAIN|FIREBASE_STORAGE_BUCKET|FIREBASE_MESSAGING_SENDER_ID|FIREBASE_MEASUREMENT_ID) ;;
      *) wsg__warn "Rejected non-public configuration key: $key"; continue ;;
    esac
    case "$key" in
      *SECRET*|*TOKEN*|*PASSWORD*|*PRIVATE*|*WEBHOOK*) wsg__warn "Rejected secret-shaped key: $key"; continue ;;
    esac
    wsg__upsert_kv "$file" "$key" "$val"
    count=$((count+1))
  done
  wsg__ok "Captured $count key(s) into $file"
}

# -----------------------------------------------------------------------------
# Seed the real .env files from the answers file — ONE-TIME, secure.
#   wsg_seed_env_files <answers-file> <repo-root> [environment]
# Writes:
#   <repo-root>/.env.local    — client VITE_* (public, git-ignored anyway)
#   <repo-root>/.secrets.env  — server secrets, chmod 600 (only if any present)
# Existing files are backed up to *.bak before being overwritten.
# -----------------------------------------------------------------------------
wsg_seed_env_files() {
  local file="${1:?usage: wsg_seed_env_files <answers-file> <repo-root> [env]}"
  local root="${2:?repo root required}" environment="${3:-production}"
  local envfile="$root/.env.local" secfile="$root/.secrets.env"
  [ -f "$file" ] || { wsg__warn "No answers file at $file"; return 1; }

  local client_keys=(
    VITE_FIREBASE_API_KEY VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID
    VITE_FIREBASE_STORAGE_BUCKET VITE_FIREBASE_MESSAGING_SENDER_ID
    VITE_FIREBASE_APP_ID VITE_FIREBASE_MEASUREMENT_ID
    VITE_FUNCTIONS_BASE_URL VITE_SENTRY_DSN VITE_STRIPE_PUBLISHABLE_KEY
  )
  local server_keys=(
    STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET EMAIL_API_KEY
    SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD EMAIL_FROM_ADDRESS
    ADMIN_BOOTSTRAP_TOKEN
  )

  # --- client .env.local ---
  [ -f "$envfile" ] && cp "$envfile" "$envfile.bak" && wsg__warn "Backed up existing .env.local → .env.local.bak"
  {
    echo "# Generated by WSG production setup on $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "# CLIENT config (VITE_*) — public by design. Do NOT put server secrets here."
    local k v
    for k in "${client_keys[@]}"; do
      v="$(wsg__get_kv "$file" "$k")"
      echo "$k=$v"
    done
    echo "VITE_ENVIRONMENT=$environment"
  } > "$envfile"
  wsg__ok "Wrote $envfile"

  # --- server .secrets.env (only if any secret value exists) ---
  local has_secret=0 k v
  for k in "${server_keys[@]}"; do
    v="$(wsg__get_kv "$file" "$k")"; [ -n "$v" ] && has_secret=1 && break
  done
  if [ "$has_secret" -eq 1 ]; then
    [ -f "$secfile" ] && cp "$secfile" "$secfile.bak" && wsg__warn "Backed up existing .secrets.env → .secrets.env.bak"
    {
      echo "# Generated by WSG production setup on $(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo "# SERVER secrets — NEVER commit. NEVER expose as VITE_*."
      for k in "${server_keys[@]}"; do
        v="$(wsg__get_kv "$file" "$k")"
        # A quoted literal is compatible with the data-only deployment reader.
        local quote_escape="'\\''"
        v="${v//\'/$quote_escape}"
        printf "%s='%s'\n" "$k" "$v"
      done
    } > "$secfile"
    chmod 600 "$secfile" 2>/dev/null || true
    wsg__ok "Wrote $secfile (chmod 600)"
  else
    wsg__warn "No server secrets captured — skipped .secrets.env (add later for billing/email)."
  fi
}
