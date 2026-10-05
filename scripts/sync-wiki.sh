#!/usr/bin/env bash
# Preview or publish this checkout's wiki pages; preserve wiki-only pages/history.
set -euo pipefail
WTL_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WTL_MODE="${1:---dry-run}"
case "$WTL_MODE" in --dry-run|--apply) ;; *) echo 'Usage: sync-wiki.sh [--dry-run|--apply]' >&2; exit 2;; esac
WTL_ORIGIN="$(git -C "$WTL_ROOT" remote get-url origin)"
case "$WTL_ORIGIN" in https://github.com/*|git@github.com:*) ;; *) echo 'Expected a GitHub origin; inspect the wiki destination before continuing.' >&2; exit 2;; esac
WTL_WIKI_URL="${WTL_ORIGIN%.git}.wiki.git"
WTL_WIKI_DIR="$(mktemp -d "${TMPDIR:-/tmp}/wtl-wiki.XXXXXX")"
trap 'rm -rf "$WTL_WIKI_DIR"' EXIT
printf 'Wiki destination: %s\n' "$WTL_WIKI_URL"
git clone -q "$WTL_WIKI_URL" "$WTL_WIKI_DIR"
[[ ! -L "$WTL_ROOT/wiki" ]] || { echo 'Wiki source directory must not be a symbolic link.' >&2; exit 1; }
for WTL_PAGE in "$WTL_ROOT"/wiki/*.md; do
  WTL_DESTINATION="$WTL_WIKI_DIR/$(basename "$WTL_PAGE")"
  if [[ -L "$WTL_PAGE" || ! -f "$WTL_PAGE" || -L "$WTL_DESTINATION" || -d "$WTL_DESTINATION" ]]; then
    echo 'Wiki sync refused a linked or nonregular page; review the source and destination entries.' >&2
    exit 1
  fi
done
cp "$WTL_ROOT"/wiki/*.md "$WTL_WIKI_DIR/"
git -C "$WTL_WIKI_DIR" add '*.md'
git -C "$WTL_WIKI_DIR" diff --cached --check
git -C "$WTL_WIKI_DIR" diff --cached --stat
if git -C "$WTL_WIKI_DIR" diff --cached --quiet; then
  echo 'Wiki is already synchronized.'
elif [[ "$WTL_MODE" == --apply ]]; then
  git -C "$WTL_WIKI_DIR" commit -m "docs: sync unified template wiki from $(git -C "$WTL_ROOT" rev-parse --short HEAD)"
  git -C "$WTL_WIKI_DIR" push
  printf 'Published wiki commit: '
  git -C "$WTL_WIKI_DIR" rev-parse HEAD
else
  echo 'Preview only. Use --apply to commit and publish these pages.'
fi
