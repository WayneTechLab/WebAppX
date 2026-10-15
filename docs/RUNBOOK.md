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

## Evaluate portals and review readiness

Use the [printable worksheet](PORTAL-EVALUATOR-WORKSHEET.md) with the paced
[HR](demos/HR-FIVE-MINUTE.md), [CMS](demos/CMS-FIVE-MINUTE.md),
[CRM](demos/CRM-FIVE-MINUTE.md) and [recovery](demos/RECOVERY-TEN-MINUTE.md)
scripts. Record the exact scheme, host and port; a different browser profile or
origin has independent local saved data. Review the
[recovery glossary](WORKSPACE-RECOVERY-GLOSSARY.md) before importing real files.
Use fictional data for these account-free exercises.

Run `browser:evaluators` for the automated companions. Before adopting selected
HR features, inspect [role examples](HR-ROLE-EXAMPLES.md), the
[capability gap map](GUSTO-CAPABILITY-GAPS.md) and proposed
[membership contract](TENANT-MEMBERSHIP-PROPOSAL.md). The
[operations readiness index](OPERATIONS-READINESS.md) keeps unadopted production
owners, secrets and services explicitly deferred.

For source updates, run the [documentation freshness preview](DOCUMENTATION-FRESHNESS.md)
against the exact reviewed target and deliberately record a source review
without changing earlier observation dates. Use the
[fictional import rehearsal](SYSTEMX-IMPORT-REHEARSAL.md) for preservation proof.
The [HR-disabled adoption walkthrough](examples/hr-disabled-adoption.md) tests a
separate temporary CMS/CRM-only bundle and explains its incompatible combined
backup kind and deliberately unadopted recovery controls.

## Review adopted work and upstream changes

Open the LAN **Work sources** cards to inspect reusable work records, the
computed WebAppX roadmap and one explicitly selected root/child scope. An
unavailable record is not an empty ledger; a role record is not a running worker.
Read [work status](WORK-STATUS.md) before using these observations operationally.

Use `backlog:adopt -- preview` with the selected configured app and reviewed
committed catalog before deliberate TODO intake. Inspect every dependency and
independent gate dimension; an unknown credential or authorization fact remains
unknown. The [adoption guide](BACKLOG-ADOPTION.md) covers stale/repeated-plan
refusal and recovery after generated-view refresh failures.

Compare explicit committed source revisions through `backlog:impact`; review
advisories do not reopen or accept tasks. Inspect `systemx:provenance` before
updates, then `systemx:upstream:check` for source, pin, preserved paths and
bootstrap conflicts. Follow every relevant continuation page and the complete
blocking count. The [upstream-review guide](SYSTEMX-UPSTREAM-REVIEW.md) describes
ready/blocked/invalid states and the separately requested apply boundary.

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
