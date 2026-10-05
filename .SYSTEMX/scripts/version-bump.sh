#!/usr/bin/env bash
# .SYSTEMX/scripts/version-bump.sh — Bump semver and sync .SYSTEMX/webapp-version files.
# Usage: version-bump.sh patch|minor|major
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SYSTEMX_DIR="$ROOT_DIR/.SYSTEMX"
cd "$ROOT_DIR"

KIND="${1:-}"
if [[ -z "$KIND" || ! "$KIND" =~ ^(patch|minor|major)$ ]]; then
  echo "Usage: $0 <patch|minor|major>"; exit 1
fi

VERSION_JSON="$SYSTEMX_DIR/webapp-version/version.json"
VERSION_FILE="$SYSTEMX_DIR/webapp-version/app-version.txt"

OLD_VERSION=$(node -e 'console.log(require("./package.json").version)')
npm version "$KIND" --no-git-tag-version >/dev/null
NEW_VERSION=$(node -e 'console.log(require("./package.json").version)')

mkdir -p "$(dirname "$VERSION_FILE")"
printf '%s\n' "$NEW_VERSION" > "$VERSION_FILE"

if [[ -f "$VERSION_JSON" ]]; then
  node - "$VERSION_JSON" "$OLD_VERSION" "$NEW_VERSION" <<'NODE'
    const fs=require('fs');
    const [file, previousVersion, version] = process.argv.slice(2);
    const v=JSON.parse(fs.readFileSync(file,'utf8'));
    v.app=v.app||{};
    v.app.previousVersion=previousVersion;
    v.app.version=version;
    v.app.lastUpdated=new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(v,null,2)+'\n');
NODE
fi

echo "Bumped $OLD_VERSION → $NEW_VERSION ($KIND)"
