#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
for check in development:check development:test dev:mock:test systemx:session:test ci:plan:test backlog:plan:check backlog:plan:test backlog:evidence:check backlog:evidence:test doctor doctor:test browser:smoke:test browser:keyboard:test backlog:check backlog:test template:check systemx:status systemx:validate sync:system:check \
  research:validate systemx:tools:test systemx:integration:test security:controls:test ci:lint \
  ci:typecheck ci:test hr:test portals:test browser:smoke browser:keyboard browser:foundation browser:state-contract hr:backend:audit docs:links ci:security ci:ai ci:audit build; do
  printf '\nChecking %s\n' "$check"
  npm run "$check"
done
