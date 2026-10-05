# How Start and End of Day Work

An operating rhythm keeps small changes from becoming untraceable production
risk. Adapt this checklist to the project’s size and regulated obligations.

## Start of day

1. Read open incidents, alerts, planned releases, and the current project board.
2. Check repository status and pull the approved branch deliberately.
3. Confirm that the local environment targets the intended non-production
   project before developing or testing.
4. Run the applicable lightweight health checks:

```bash
git status
npm run sync:system:check
npm run system:audit
```

1. If agents are used, define their narrow scope, files, tools, and required
   evidence before work starts.

## End of day

1. Review the complete diff; remove debug output, test data, credentials, and
   accidental generated files.
2. Run the checks appropriate to the modified surface and record any known risk.
3. Update the issue, decision record, runbook, and release note with what
   changed, what was verified, and what remains.
4. Commit only reviewed work. Do not use an unattended deployment as a handoff.
5. If production changed, verify monitoring and preserve rollback information.

The goal is continuity: another accountable operator should be able to tell what
happened without reconstructing it from chat history or local terminal state.
