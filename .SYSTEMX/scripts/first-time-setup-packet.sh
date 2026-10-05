#!/usr/bin/env bash
set -euo pipefail

SYSTEMX_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT_DIR="$(cd "$SYSTEMX_DIR/.." && pwd)"
INTAKE_DIR="$SYSTEMX_DIR/Unified-Setup-Process/intake"
HISTORY="$SYSTEMX_DIR/logs/setup-history.jsonl"

# shellcheck source=/dev/null
. "$SYSTEMX_DIR/scripts/setup-state.sh"

mkdir -p "$(dirname "$HISTORY")"

echo "WSG First-Time Setup Packet"
echo "==========================="
echo
echo "This path is now zip-first."
echo
echo "Flow:"
echo "  1. Ask Mac or Windows."
echo "  2. Choose stack mode."
echo "  3. Choose edition."
echo "  4. Export one setup zip to Downloads."
echo "  5. Pause for external LLM/user work."
echo "  6. Import one setup zip into .SYSTEMX/Setup-Input_MD."
echo "  7. Validate the packet."
echo "  8. Continue guided setup."
echo

printf '{"timestamp":"%s","event":"first_time_setup_packet_started"}\n' \
  "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$HISTORY"

bash "$SYSTEMX_DIR/scripts/build-setup-packet.sh" core bundle

echo
echo "Project packet docs to fill or refine:"
echo "  1. $INTAKE_DIR/01-PROJECT-BRIEF.md"
echo "  2. $INTAKE_DIR/02-EDITION-MODULES.md"
echo "  3. $INTAKE_DIR/03-PAGES-ROUTES.md"
echo "  4. $INTAKE_DIR/04-DATA-AUTH-SECURITY.md"
echo "  5. $INTAKE_DIR/05-INTEGRATIONS-DEPLOY.md"
echo "  6. $INTAKE_DIR/07-MASTER-PLAN.md"
echo "  7. $INTAKE_DIR/08-INSTRUCTIONS-AND-CONSTRAINTS.md"
echo "  8. $INTAKE_DIR/09-BUSINESS-PLAN.md"
echo "  9. $INTAKE_DIR/10-FIRST-PHASE-TODO.md"
echo " 10. $INTAKE_DIR/11-PROJECT-ARCHITECTURE.md"
echo " 11. $INTAKE_DIR/12-FRONTEND-UI-UX-PLAN.md"
echo " 12. $INTAKE_DIR/13-BACKEND-DATA-INTEGRATION-PLAN.md"
echo " 13. $INTAKE_DIR/14-SECURITY-OPERATIONS-PLAN.md"
echo " 14. $INTAKE_DIR/15-LAUNCH-POST-LAUNCH-PLAN.md"
echo " 15. $INTAKE_DIR/06-AI-REINJECTION-PROMPT.md"
echo

if [[ "${1:-}" == "--pause" ]]; then
  read -r -p "Finish the external packet work, then type 'import' to import the zip or 'skip' to continue: " reply || true
  printf '{"timestamp":"%s","event":"first_time_setup_packet_response","response":"%s"}\n' \
    "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${reply:-}" >> "$HISTORY"
  if [[ "${reply:-}" == "import" ]]; then
    bash "$SYSTEMX_DIR/scripts/import-setup-packet.sh"
  fi
fi

echo
echo "Setup state:"
wsg_state_print_summary
echo
echo "History: $HISTORY"
echo "Repo:    $ROOT_DIR"
