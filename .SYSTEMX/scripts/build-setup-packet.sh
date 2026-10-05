#!/usr/bin/env bash
set -euo pipefail

SYSTEMX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$SYSTEMX_DIR/.." && pwd)"
STANDARD_DIR="$SYSTEMX_DIR/Standard-MD-Files"
INTAKE_DIR="$SYSTEMX_DIR/Unified-Setup-Process/intake"
MASTER_PLAN_DIR="$SYSTEMX_DIR/Unified-Setup-Process/master-plan"
ASSET_DIR="$SYSTEMX_DIR/Unified-Setup-Process/packet-assets"
IMPORT_ROOT="$SYSTEMX_DIR/Setup-Input_MD"
HISTORY="$SYSTEMX_DIR/logs/setup-history.jsonl"

# shellcheck source=/dev/null
. "$SYSTEMX_DIR/scripts/setup-state.sh"

timestamp="$(date +%Y%m%d-%H%M%S)"
PACKET_TYPE="${1:-}"
PACKET_SHAPE="${2:-}"

prompt_choice() {
  local prompt="$1"
  local default="$2"
  shift 2
  local options=("$@")
  local choice
  echo "$prompt" >&2
  local index=1
  for opt in "${options[@]}"; do
    echo "  $index) $opt" >&2
    index=$((index + 1))
  done
  read -r -p "Choose [$default]: " choice >&2 || true
  choice="${choice:-$default}"
  printf '%s' "${options[$((choice - 1))]}"
}

stack_mode_label_to_id() {
  case "$1" in
    "Google/Firebase Stack") echo "google-firebase" ;;
    "Microsoft 365 Stack") echo "microsoft-365" ;;
    "Custom Stack") echo "custom" ;;
    *) echo "$1" ;;
  esac
}

ask_platform() {
  local existing
  existing="$(wsg_state_get OS_TARGET || true)"
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return 0
  fi

  local selected
  selected="$(prompt_choice "WSG setup packet export requires a target OS." 1 "Mac" "Windows")"
  wsg_state_set OS_TARGET "$selected"
  echo "$selected"
}

ask_stack_mode() {
  local existing
  existing="$(wsg_state_get STACK_MODE || true)"
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return 0
  fi

  local selected
  selected="$(prompt_choice "Select the stack mode for this setup run." 1 "Google/Firebase Stack" "Microsoft 365 Stack" "Custom Stack")"
  local normalized
  normalized="$(stack_mode_label_to_id "$selected")"
  wsg_state_set STACK_MODE "$normalized"
  echo "$normalized"
}

ask_custom_services() {
  local stack_mode="$1"
  local existing
  existing="$(wsg_state_get CUSTOM_STACK_SERVICES || true)"
  if [[ "$stack_mode" != "custom" ]]; then
    return 0
  fi
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return 0
  fi

  echo "Custom stack selected." >&2
  echo "Enter the services to include as a comma-separated list." >&2
  echo "Example: firebase,gcloud,react,vite,stripe,google-workspace,m365" >&2
  read -r -p "Services [firebase,gcloud,react,vite]: " existing >&2 || true
  existing="${existing:-firebase,gcloud,react,vite}"
  wsg_state_set CUSTOM_STACK_SERVICES "$existing"
  echo "$existing"
}

ask_edition() {
  local existing
  existing="$(wsg_state_get EDITION || true)"
  if [[ -n "$existing" ]]; then
    echo "$existing"
    return 0
  fi

  local selected
  selected="$(prompt_choice "Select the edition for this setup run." 1 "enterprise" "business" "consumer" "wsgt" "wsgd")"
  wsg_state_set EDITION "$selected"
  echo "$selected"
}

downloads_dir_for_os() {
  local os_target="$1"
  case "$os_target" in
    Mac) printf '%s' "${WSG_MAC_DOWNLOADS_DIR:-$HOME/Downloads}" ;;
    Windows) printf '%s' "${WSG_WINDOWS_DOWNLOADS_DIR:-${USERPROFILE:-$HOME}/Downloads}" ;;
    *) printf '%s' "${WSG_DOWNLOADS_DIR:-$HOME/Downloads}" ;;
  esac
}

shape_dir_for_bundle() {
  local packet_root="$1"
  mkdir -p "$packet_root/docs/standard" \
    "$packet_root/docs/intake" \
    "$packet_root/docs/master-plan" \
    "$packet_root/assets/schemas" \
    "$packet_root/assets/prompts" \
    "$packet_root/assets/visuals" \
    "$packet_root/assets/data" \
    "$packet_root/assets/research"
  cp "$STANDARD_DIR"/*.md "$packet_root/docs/standard/"
  cp "$INTAKE_DIR"/*.md "$packet_root/docs/intake/"
  cp "$MASTER_PLAN_DIR"/*.md "$packet_root/docs/master-plan/"
  find "$ASSET_DIR" -type f -mindepth 2 -print | while read -r asset; do
    local rel
    rel="${asset#"$ASSET_DIR"/}"
    mkdir -p "$packet_root/assets/$(dirname "$rel")"
    cp "$asset" "$packet_root/assets/$rel"
  done
}

shape_dir_for_flat() {
  local packet_root="$1"
  cp "$STANDARD_DIR"/*.md "$packet_root/"
  cp "$INTAKE_DIR"/*.md "$packet_root/"
  cp "$MASTER_PLAN_DIR"/*.md "$packet_root/"
  find "$ASSET_DIR" -type f -mindepth 2 -print | while read -r asset; do
    local rel
    rel="${asset#"$ASSET_DIR"/}"
    mkdir -p "$packet_root/$rel"
    cp "$asset" "$packet_root/$rel"
  done
}

build_manifest() {
  local packet_root="$1"
  local packet_name="$2"
  local packet_type="$3"
  local packet_shape="$4"
  local os_target="$5"
  local stack_mode="$6"
  local edition="$7"
  local import_target="$8"

  node - "$packet_root" "$packet_name" "$packet_type" "$packet_shape" "$os_target" "$stack_mode" "$edition" "$import_target" <<'NODE'
const fs = require('fs')
const path = require('path')

const [packetRoot, packetName, packetType, packetShape, osTarget, stackMode, edition, importTarget] = process.argv.slice(2)

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name === 'manifest.json') continue
    const next = path.join(dir, entry.name)
    if (entry.isDirectory()) files.push(...walk(next))
    else files.push(path.relative(dirRoot, next).replaceAll(path.sep, '/'))
  }
  return files
}

const dirRoot = packetRoot
const allFiles = walk(packetRoot).sort()
const requiredDocs = allFiles.filter((file) =>
  file.endsWith('.md') &&
  (file.includes('docs/standard/') || file.includes('docs/intake/') || file.includes('docs/master-plan/') || !file.includes('/'))
).sort()
const optionalAssets = allFiles.filter((file) => !requiredDocs.includes(file))

const manifest = {
  packetVersion: '1.0.0',
  packetType,
  packetShape,
  projectName: 'Web Stack Generation Setup Packet',
  generatedAt: new Date().toISOString(),
  stackMode,
  edition,
  osTarget,
  includedFiles: allFiles,
  requiredDocs,
  optionalAssets,
  importTargetFolderName: importTarget,
  packetName,
}

fs.writeFileSync(path.join(packetRoot, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
NODE
}

mkdir -p "$IMPORT_ROOT" "$(dirname "$HISTORY")"

if [[ -z "$PACKET_TYPE" ]]; then
  PACKET_TYPE="$(prompt_choice "Choose the setup packet tier." 1 "core" "extended")"
fi

if [[ -z "$PACKET_SHAPE" ]]; then
  PACKET_SHAPE="$(prompt_choice "Choose the packet shape." 1 "bundle" "flat")"
fi

os_target="$(ask_platform)"
stack_mode="$(ask_stack_mode)"
custom_services="$(ask_custom_services "$stack_mode" || true)"
edition="$(ask_edition)"
downloads_dir="$(downloads_dir_for_os "$os_target")"
packet_name="WSG-Setup-Packet-${edition}-${stack_mode}-${PACKET_TYPE}-${timestamp}"
export_root="$downloads_dir/$packet_name"
zip_path="$downloads_dir/$packet_name.zip"
import_target="$IMPORT_ROOT/$packet_name"

wsg_state_set PACKET_TYPE "$PACKET_TYPE"
wsg_state_set PACKET_SHAPE "$PACKET_SHAPE"
wsg_state_set DOWNLOADS_DIR "$downloads_dir"
wsg_state_set LAST_PACKET_EXPORT "$zip_path"
wsg_state_set LAST_PACKET_IMPORT_DIR "$import_target"
[[ -n "${custom_services:-}" ]] && wsg_state_set CUSTOM_STACK_SERVICES "$custom_services"

tmp_dir="$(mktemp -d)"
packet_root="$tmp_dir/$packet_name"
mkdir -p "$packet_root"

case "$PACKET_SHAPE" in
  bundle) shape_dir_for_bundle "$packet_root" ;;
  flat) shape_dir_for_flat "$packet_root" ;;
  *) echo "Unsupported packet shape: $PACKET_SHAPE" >&2; exit 1 ;;
esac

cat > "$packet_root/README.md" <<EOF
# $packet_name

This setup packet was exported from:

\`\`\`text
$ROOT_DIR
\`\`\`

Target OS: $os_target
Stack mode: $stack_mode
Edition: $edition
Packet type: $PACKET_TYPE
Packet shape: $PACKET_SHAPE

Import this zip back into:

\`\`\`text
$IMPORT_ROOT
\`\`\`

Do not store secrets in this packet.
EOF

build_manifest "$packet_root" "$packet_name" "$PACKET_TYPE" "$PACKET_SHAPE" "$os_target" "$stack_mode" "$edition" "$packet_name"

mkdir -p "$downloads_dir" "$import_target"
(cd "$tmp_dir" && zip -qr "$zip_path" "$packet_name")
printf 'Imported packet target folder:\n%s\n' "$import_target" > "$import_target/README.txt"

printf '{"timestamp":"%s","event":"setup_packet_exported","osTarget":"%s","stackMode":"%s","edition":"%s","packetType":"%s","packetShape":"%s","zipPath":"%s","importDir":"%s"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$os_target" "$stack_mode" "$edition" "$PACKET_TYPE" "$PACKET_SHAPE" "$zip_path" "$import_target" >> "$HISTORY"

echo "WSG setup packet exported."
echo "OS target:       $os_target"
echo "Stack mode:      $stack_mode"
echo "Edition:         $edition"
echo "Packet type:     $PACKET_TYPE"
echo "Packet shape:    $PACKET_SHAPE"
echo "Downloads dir:   $downloads_dir"
echo "Zip path:        $zip_path"
echo "Import folder:   $import_target"
echo
echo "Next:"
echo "  1. Use the single zip from Downloads with the user/LLM workflow."
echo "  2. Save the returned zip locally."
echo "  3. Run: bash .SYSTEMX/scripts/import-setup-packet.sh"
