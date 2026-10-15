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

## Exercise portal maturity workflows

Use [the maturity how-to](PORTAL-MATURITY.md) and
[current QA receipt](PORTAL-MATURITY-QA-2026-10-15.md) for the sixteen implemented
criteria, exact starting scenarios and recorded focused results. The current
wave has 79 new model cases and 13 new browser check groups; integrated CI and
publishing gates passed as recorded in that receipt.

```bash
npm run maturity:test
npm run browser:maturity
```

The first runs independent model/codec/path fixtures with in-memory storage.
The second owns its loopback app and four fresh Chromium contexts, uses actual
controls and file transfers, and retains local evidence. It does not reuse or
clear a user's browser profile. For a manual exercise, use `npm run dev:mock`
and keep the exact printed origin and chosen evaluation profile.

1. **Set up payroll explicitly.** Under **Management → Payroll workspace**,
   choose **Sample period start/end** and configure fictional hourly rates for
   every otherwise-eligible employee/work date. Existing fixture compensation
   has no inferred hourly cadence. Inspect each eligibility reason before
   preparation. Changed inputs or a changed selected period require intentional
   **Reprepare sample payroll** before the next stage. Submitted receipts and
   employee statements retain their frozen period/rates.
2. **Save history without recovering.** Enter a **Restore point name**, select
   the portals to capture, inspect the history budget and choose **Create named
   restore point**. This writes history only. **Point label → Save point label**
   changes only the label, preserving the point's capture, scope and creation
   time. Neither operation rewrites workspace saves or clears temporary forms.
3. **Inspect before replacement.** **Inspect captured records**, combined
   restore differences and Undo differences display counts and bounded IDs.
   They do not write saves, history or activity. Hidden field changes can affect
   the changed-record count without displaying those values.
4. **Apply the intended recovery scope.** Confirming selective restore or Undo
   replaces entire selected module states and their browser saves, after an
   automatic pre-action point is saved. Those modules' temporary forms/timers
   are cleared; unselected portals remain open. Undo refuses a source point
   changed or removed after its preview, requiring refresh and review.

The guide also covers time return/correction/deletion, CMS complete validation
and keep/discard decisions, CRM import refusal and session return navigation.
Keep these local checks separate from real payroll, provider authorization and
the required full release gates.

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
