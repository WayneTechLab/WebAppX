# Project Runbook

This project inherits the WebApp Stack G1 operational standard.

- Operator runbook: [`.SYSTEMX/docs/RUNBOOK.md`](../.SYSTEMX/docs/RUNBOOK.md)
- Deploy plan: [`.SYSTEMX/deploy/canary-plan.md`](../.SYSTEMX/deploy/canary-plan.md)
- Status board: [`.SYSTEMX/status/TODO.md`](../.SYSTEMX/status/TODO.md)

Before production deploys, run:

```bash
npm run sync:system:check
bash .SYSTEMX/scripts/quality-check.sh
npm run ci:security
```

Deploy controls:

```bash
bash .SYSTEMX/scripts/deploy.sh --preflight
bash .SYSTEMX/scripts/deploy.sh hosting --dry-run
bash .SYSTEMX/scripts/deploy.sh --check
bash .SYSTEMX/scripts/deploy.sh --rollback-info
```
