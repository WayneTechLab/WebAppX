#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
for check in development:check development:test environment:check environment:test repository:identity:test dev:mock:test systemx:session:test ci:plan:test backlog:plan:check backlog:plan:test backlog:evidence:check backlog:evidence:test backlog:impact:test docs:freshness:test systemx:work-status:test doctor doctor:test browser:smoke:test browser:keyboard:test backlog:check backlog:test template:check systemx:status systemx:validate sync:system:check \
  research:validate systemx:tools:test systemx:integration:test security:controls:test ci:lint \
  ci:typecheck ci:test hr:test hr:roles:check hr:roles:test gusto:capabilities:check gusto:capabilities:test portals:test maturity:test safety:test adoption:hr-disabled:test adoption:hr-disabled browser:smoke browser:keyboard browser:foundation browser:state-contract browser:lifecycles browser:payroll browser:evaluators browser:maturity browser:safety browser:quality browser:sdk-quality browser:recovery-drill browser:work-status hr:backend:audit docs:links ci:security ci:ai ci:audit build; do
  printf '\nChecking %s\n' "$check"
  npm run "$check"
done
