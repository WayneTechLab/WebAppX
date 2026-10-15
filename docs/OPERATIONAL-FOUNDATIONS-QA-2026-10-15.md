# Operational foundations and full portal browser lifecycles — 2026-10-15

This wave examines the working implementation based on WebAppX main
`f197affabfe125321c439d8a50854abe684c2355`. That is the recorded starting
source base, not an assertion that the new tests/tools exist in the unchanged
base commit. The publication commit contains this receipt and the examined
implementation. Execution host: macOS Apple Silicon, Node 25.8.1, npm 11.11.0.

## Original criteria and evidence

| Proposal | Original acceptance scope | Implementation and verification |
| --- | --- | --- |
| WX-0650 | Dated reviewed-source, local-OS, emulator and provider assumptions with evidence links rather than implied production guarantees. | [Security assumptions](SECURITY-ASSUMPTIONS.md) records eleven scoped assumptions, source/review dates, historical observation provenance, recheck triggers and adoption requirements. The October 5 security receipt is preserved apart from an additive link. Its WX-0601 prerequisite was already accepted. |
| WX-0673 | Two employee benefit elections and approved time, individual statements and a reconciled combined receipt in a browser fixture. | [Payroll journey](../tests/browser/payroll-lifecycle.mjs) exercises two employee identities, enrollment/waiver, four approved entries and one submitted simulation; rendered statements reconcile every amount/hour with the actual exported receipt. |
| WX-0677 | Repeatable named-seed save/separate review/publication, with exact frozen public projection surviving a later draft edit. | [CMS/CRM journey](../tests/browser/cms-crm-lifecycles.mjs) checks every workspace field, receipt/revision, complete public-preview text and reload against handwritten expectations. |
| WX-0678 | Repeatable named-seed lead conversion and completed follow-up, exact linked IDs/dashboard totals and conversion replay refusal. | The CRM journey checks ordinary rendered actions and exports. A separately identified browser-module probe replays conversion against a detached real download and asserts the actual guard refusal and unchanged input/application saves. It does not pretend a second rendered form exists. |
| WX-0700 | Map onboarding, payroll, CMS publishing, CRM conversion and recovery invariants to unit evidence and new browser acceptance scenarios. | [QA coverage map](QA-COVERAGE-MAP.md) names unit assertions, five scenario families, expected records, commands, observation bases and uncovered boundaries. Historical receipts retain their original provenance. |
| WX-0751 | Separate source validation, browser runtime, owned LAN session, optional provider readiness and deployed service health. | [Monitoring vocabulary](MONITORING.md) distinguishes configuration, startup observations, stored readiness, fresh limited process metadata, actual workflows and deployed health. |
| WX-0793 | Identify inspection, local mutation and separately authorized provider/production commands. | [Command effects table](COMMAND-SAFETY.md) covers installation, source/tests/build, sessions, backups, imports/mirrors, wiki/Git publication and deployment modes, including local writes during previews. Existing authorization remains applicable. |
| WX-0835 | Read-only origin, branch, direct remote revision and tracked/staged/untracked report before authorized publication. | [Repository receipt](REPOSITORY-IDENTITY.md) separates direct GitHub main from cached refs, validates fetch/push identity, reports worktree categories and uses final stability checks. No fetch, stage, commit or push is performed by the report. |
| WX-0840 | Configuration schema proposal distinguishes browser variables/private server settings and validates examples without reading secrets. | [Configuration proposal](ENVIRONMENT-CONFIGURATION.md) and [schema](environment-config.schema.json) validate tracked examples through six fixed public files, with names/categories/counts as output. No runtime configuration is activated. |

All original acceptance text and dependencies remain in the canonical catalog.
Agent 0 accepted these nine local criteria after focused execution and source
review, then regenerated the checklist, CSV and execution plan. The catalog now
has **42 done / 958 remaining**: **131 P1, 670 P2 and 157 P3** remain, with
**790 local, 128 operator and 40 provider** gates. No original acceptance text
or dependency changed. An assignment or historical attachment alone does not
accept work, and the complete 1,000-item goal remains active.

## Browser execution

The new suites use the unchanged named seed `webappx-portal-smoke-v1`, SHA-256
`ab8633ff7bbb705d2ca164fb950740f8573afb50a536b8348ef7c0f07d032d02`.
The common runner checks its bytes/defaults before starting owned loopback Vite
and fresh Chromium contexts. Ordinary record changes use rendered controls;
actual downloads and browser saves are compared with independently written
expected records. No application state is injected or provider account used.

### Two-employee payroll — eight checks

The fixture completes Jordan's onboarding, confirms Avery's health enrollment
and Jordan's retirement waiver, adds 1.25 and 2.5 hours respectively, submits
their drafts and approves four entries through the separate manager identity.
Seed hours are included explicitly. Preparation, calculation, review and
submission are checked independently, including disabled stage controls.

| Employee | Hours | Gross | Illustrative withholding | Benefits | Net |
| --- | ---: | ---: | ---: | ---: | ---: |
| Avery | 9.25 | $277.50 | $55.50 | $25.00 | $197.00 |
| Jordan | 8.50 | $255.00 | $51.00 | $0.00 | $204.00 |
| Combined | 17.75 | $532.50 | $106.50 | $25.00 | $401.00 |

The actual two rendered statements sum to the exported combined receipt for
hours and every amount. Exact time/rate/benefit inputs and complete saved HR
state are checked after reload. Receipt `MOCK-PAYROLL-0006` appears once, all
four entries become consumed, and a second preparation is refused without
changing history or saved records. CMS and CRM remain unchanged.

### CMS and CRM — twelve checks

CMS saves revision 2, requests a separate review, receives approval as the
reviewer, and publishes through the publisher identity. Revision 3 changes the
title, slug and body and invalidates approval while the public projection stays
at the exact revision 2 snapshot after edit and reload. The full preview text,
article count and structured fields are checked; extra draft/private text
anywhere inside the preview fails the assertion.

CRM creates `lead-0001`, qualifies it and converts it into `company-0003`,
`contact-0003` and `opportunity-0003` for $1,750.25, then creates/completes
`task-0004`. The complete graph, receipts, sequence, owners and dashboard totals
are exact, including $8,250.25 open pipeline and one remaining seed follow-up.

Native Enter inputs and removal of the conversion form establish UI prevention.
The explicit module negative probe imports the actual Vite-served
`/src/crm/model.ts` inside Chromium and calls `transitionCrm` on a detached clone
of the real converted download. It receives the exact converted-lead refusal;
the detached input and application save bytes remain unchanged. The model is
the subject of this negative test, never an expected-record generator or a
method for injecting application state. The report explicitly distinguishes
`renderedRefusalExercised: false` from `browserDomainRefusalExercised: true`.

Both root focused commands passed: `npm run browser:payroll` (eight checks) and
`npm run browser:lifecycles` (twelve checks). Their reports confirmed owned
browser/server cleanup and no unexpected requests, console errors, account
cookies or uncaught exceptions. Only the expected unset-Firebase warning was
observed. Independent source review prompted the complete-preview assertion;
its first expectation inserted nonexistent JSX text separators, then was
corrected to the actual complete text-content boundary and passed again.
Earlier payroll development failures were test selector issues, without an
established application defect. Reports, traces, screenshots and downloads
remain in local temporary artifact directories.

## Source/tool review and execution

The environment checker passes the root inventory of 20 public, eight server,
16 typed keys and two optional markers; the starter has 14 public, seven server,
ten typed keys and two markers. It reads the schema, two tracked examples, two
declaration files and the reviewed public server guide. It rejects path
redirection/symlinks, unknown or duplicate names, malformed classifications and
non-placeholder secret examples. Private-file poison and shell-value guards
test the no-secret-read boundary.

The focused environment suite passed **22 tests**. Independent review found no
material implementation defect and prompted a stronger regression boundary:
the poison fixture now declares the six permitted files independently instead
of trusting the production allowlist as its expected result. Its rerun passed.
An earlier temporary CLI fixture also prompted canonical macOS path handling.

The repository report uses bounded argument arrays, normalized credential-free
identities, no optional index locks, isolated canonical HTTPS, disabled
replacement/graft ancestry and final ref/status rechecks. Executable filter
configuration and indexed submodules are refused before status could execute
their filters. Temporary fixtures preserve Git index/worktree, blank seeds and
immutable fixture bytes. Clean local commits ahead of a verified direct remote
ancestor are distinguished from parity and remain reviewable.

The final focused repository suite passed **26 tests**. Independent review prompted refusal
of configured executable content filters and indexed submodules before status,
disabled replacement/graft ancestry, captured revision operands and final
snapshot rechecks. The final review had no unresolved finding. The browser
review's complete-preview assertion gap was also corrected and re-reviewed.
An actual temporary symlink invocation subsequently exposed a CLI entry-point
bug: canonical module and noncanonical argument paths differed, so no report
ran. Canonicalizing both paths fixes it. The added spawned `--help` regression
proves visible usage without Git/network probes, and the complete focused
26-test rerun passed after this fix. The CI repository stage had already run
its initial 25 cases; the final focused rerun supplies this later boundary.
The source-derived CI plan passed **13 tests**, reports **43 actual stages**
and has zero unknown command classifications.

A live root invocation during this working wave returned complete observations,
verified origin/push identity and direct main at the starting base, and correctly
reported `needs-review` for local changes. It did not fetch or modify source,
index, tracking refs or publication state. Clean pre-push and post-push receipts
are checked at publication after the implementation is committed.

## Integrated gates and acceptance

`npm run ci:all` passed all **43 stages**. Its six isolated Chromium suites
passed **56 checks**: smoke 7, keyboard 9, foundation 9, state contract 11,
CMS/CRM lifecycles 12 and payroll 8. Each final report recorded both owned
browser and owned server closed. Managed SYSTEMX ran 235 tests with five
existing skips; host import integration ran 36 tests, operational controls eight,
HR models 116 and portal models 121. Lint, typecheck, backend boundary audit,
research validation, source security/AI/dependency audits and production build
also passed. The final repository entry-point rerun is identified above.

`npm run deploy -- hosting --preflight` passed typecheck, lint, local tests,
audits and production build, explicitly skipping version/changelog/Git
mutations, push and deployment. App version remains 3.4.0 / deploy count 0.
Final checks passed for catalog/Markdown/CSV consistency, complete generated
execution-plan coverage, development contracts, host SYSTEMX drift and template
preservation. The standard link checker examined 733 Markdown files; a separate
recursive host-doc scan checked 48 files and 1,526 local file targets without
broken references. Whitespace checks passed. The native-wiki preview rendered
all 58 pages and showed the five intended changed pages. Direct GitHub main,
local HEAD and the tracking ref still matched the starting base before commit.
No immutable snapshot or reusable project record changed.

The next prepared foundation work is WX-0851/0855 adoption exports and separate
gate constraints, WX-0852 revision-impact reporting, WX-0856 recorded/adopted
work status, WX-0857 per-path provenance and WX-0858 structured upstream review.
These proposals remain TODO. Implementation must preserve the selected release
APIs and blank template ledger, use temporary adopted fixtures, and retain
unknown or unavailable states where evidence is absent. The active execution
plan continues to cover all remaining IDs and their original acceptance gates.

## Evidence boundaries

This supplies local source/documentation, synthetic command fixtures and isolated
Chromium observations. It establishes no provider connection, real payroll or
tax execution, money movement, deployed service health, native Windows runtime,
whole-site accessibility or production configuration enforcement. Provider and
operator criteria keep their original acceptance requirements.

The app remains 3.4.0 / deploy count 0. Selected SYSTEMX 1.9.0-alpha.6 snapshots,
research inventories and blank reusable records remain intact. Changes to the
host's tool/documentation pointers do not create a new upstream distribution.
The goal still covers all 1,000 original catalog items.
