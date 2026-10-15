# Project Runbook

This project inherits the WebApp Stack G1 operational standard.

Use the host [command effects table](COMMAND-SAFETY.md) for the exact effects of
each mode, the [health vocabulary](MONITORING.md) for observation scope, and
the dated [security assumptions](SECURITY-ASSUMPTIONS.md) before adopting real
records or services. Source checks, browser journeys, owned startup readiness,
provider workflows and deployed health each need their own evidence.

Before an already authorized Git publication, run `npm run repository:identity`
and inspect its [receipt fields and limits](REPOSITORY-IDENTITY.md). It reports
direct GitHub main separately from local tracking refs and preserves the index
and local work. A clean commit ahead of verified remote main is distinct from
parity. Refused/unavailable observations require investigation; the report does
not fetch, repair, publish or grant authority. Full release gates still apply.

Use `npm run environment:check` for the reviewed public-example proposal and
the [QA coverage map](QA-COVERAGE-MAP.md) to choose relevant authored browser
and unit scenarios. Keep reports/downloads/traces in local artifact storage.

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
