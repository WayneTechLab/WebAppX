# Adoption, work-status and import-review foundations — 2026-10-15

Examined implementation starts at WebAppX main
`f8494b750447af7d4e39695f4a6fceeff29f48bb`. That base identifies the prior
published source; this receipt and the new implementation ship in the next
publication commit. Local execution: macOS Apple Silicon, Node 25.8.1,
npm 11.11.0, Python 3.14.5 and Git 2.54.0.

## Original criteria and accepted evidence

| Proposal | Original acceptance scope | Implemented evidence |
| --- | --- | --- |
| WX-0851 | Bounded operator selection maps to valid adopted TASK identifiers, owners and dependencies; apply selects an adopted app and leaves reusable seeds blank. | [Adoption tool](../scripts/backlog-adoption.py), temporary real root/child fixtures and spawned CLI preview/apply/repeat-refusal coverage. |
| WX-0852 | Comparing two source revisions identifies changed proposal scopes and requests review without changing canonical task state. | [Impact report](BACKLOG-REBASELINE.md), committed-catalog/tree fixtures and exact advisory assertions for renames, deleted/type/mode paths and metadata/definition changes. |
| WX-0855 | Adoption previews distinguish credential readiness, operator authorization and local prerequisites per selected task; TODO never establishes readiness. | [Gate contract and workflow](BACKLOG-ADOPTION.md), criterion-bound independent requirements/observations, unknown defaults and target dependency-state fixtures. |
| WX-0856 | Host view separates blank reusable work seeds, proposed roadmap and explicitly selected adopted work. | [Work-status contract](WORK-STATUS.md), strict read-model fixtures and actual isolated LAN browser selection, unavailable states and stale-response test. |
| WX-0857 | Maintainers inspect host-owned outer paths, retained stock matches and immutable content before updating. | [Provenance inventory](SYSTEMX-PROVENANCE.md), independent ownership/content relationships, all-retained verification and temporary boundary/preservation fixtures. |
| WX-0858 | Bounded import preview reports selected version, exact public source commit, preserved host paths and bootstrap conflicts. | [Upstream review](SYSTEMX-UPSTREAM-REVIEW.md), complete-set blocking under pagination, host-only preservation, receipt/tree proof and invalid/unverified source fixtures. |

Agent 0 reviewed these six original local criteria and their focused evidence.
The catalog now records **48 done / 952 remaining**: **125 P1, 670 P2 and
157 P3** remain, with **784 local, 128 operator and 40 provider** gates.
Original acceptance text and dependencies are preserved. The complete 1,000-item
goal remains active; no source completion transfers to adopted task acceptance.

## Focused execution and review fixes

- Host SYSTEMX integration: **95 tests passed**. This includes the existing
  integration suite plus 23 adoption, 23 provenance and 13 upstream-review cases.
- Revision impact: **19 tests passed** in disposable committed Git repositories.
- Work status: **37 tests passed**, with malformed/missing/duplicate/unsafe record
  cases, explicit scope selection and independent unavailable states.
- Actual LAN browser fixture: **six checks passed**. It checks three source
  cards, explicit root/child selection, malformed child/roadmap state, and an
  older held root response released after a newer child response. Source task,
  focus and role seed bytes are preserved; the browser and LAN fixture are owned.
- CI-plan regression: **13 tests passed**; the current source-derived gate list
  has **46 stages** and no unknown command classifications.

Review found and fixed concrete issues before acceptance:

1. Adoption fingerprints silently skipped unreadable nested record directories.
   Traversal now refuses them. An actual permission-restricted fixture proves
   preview and stale-plan apply refusal without ledger changes; it ran without
   a skip on this account.
2. Concurrent status refreshes could render an older scope response beneath a
   newer selector. Generation checks reject stale successes and failures, and
   scope changes first clear stale facts. The delayed actual-response browser
   fixture verifies the repaired behavior.
3. Import archiving initially bypassed the sanitized Git environment used for
   observations. The shared environment now also binds archive extraction to
   the observed repository without inherited Git overrides. A poisoned-GIT_DIR
   fixture covers the actual archive call.
4. Local Git errors initially leaked machine paths through stderr despite
   redacted preview JSON. Local/archive/extraction stderr is suppressed; an
   actual invalid-source CLI fixture requires empty stderr and no path in JSON.
5. Impact review identified array ID coercion, worktree-specific config includes
   and unchecked Git metadata links. Each is refused and covered by a targeted
   fixture. Committed data is read without worktree substitution or transport.
6. The first integrated run stopped in the session suite: its deliberately
   minimal copied LAN fixture omitted the new server read-model dependency.
   Adding that module to the fixture restored all 42 session tests; the required
   full CI run is restarted with the repaired fixture. No application runtime
   defect was established by this missing-fixture failure.

Independent follow-up review found no unresolved issue in the repaired scopes.
The provenance review also strengthened schema-1 binary equivalence and structural
limits without changing immutable releases. An exact stock-byte match remains
separate from manifest equivalence and host ownership.

## Live read-only observations

A read-only inventory verified all three registered retained releases and
reported host records as preserved even when their bytes matched retained seeds.
The native impact CLI compared the starting HEAD with itself, bound the exact
committed 1,000-item catalog digest and reported zero impact. These commands
performed no fetch, adoption or import application.

The actual upstream preview observed canonical public dotSYSTEMX main at
`3fb59429c878268f1081ca255a1f32fafc5dcfba`, with incoming/current/pinned version
1.9.0-alpha.6 and manifest fingerprint
`009e6b6c2f1359fa4c88e3961164d28cc89f65cea2a6682200fb2953caf326e3`.
The original receipt commit remains
`7f0d82b7ba8531ac04d897209d8c1ed263ee29cb`; complete source-tree equality was
verified and the preview was ready with zero blocking observations. The first
five displayed host paths represented a complete total of 736 at the final
expected-commit-bound observation;
this is a paged path count, not a claim that five paths are the entire scope.
No import was applied. Public-main equality is a dated network observation.

## Integrated publication gates

The restarted `npm run ci:all` passed all **46 stages** against the repaired
fixture. It includes 235 managed tests with five existing skips, 95 host
integration tests, 42 session tests, 37 work-status tests, 19 impact tests,
116 HR tests and 121 portal tests. Lint, typecheck, backend boundaries, research
inventories, template integrity, source/security/AI/dependency audits and the
production build passed.

Seven actual browser suites passed **62 checks**: smoke 7, keyboard 9,
foundation 9, state contract 11, CMS/CRM lifecycles 12, payroll 8 and LAN work
status 6. The six portal reports each confirmed owned browser/server closure.
The bounded LAN fixture completed its teardown and recorded unchanged source
work-record bytes with no page JavaScript errors.

`npm run deploy -- hosting --preflight` passed its local checks/build and
explicitly skipped version/changelog/Git mutations, push and deployment. The
app remains 3.4.0 / deploy count 0. Catalog/checklist/CSV and the complete
execution plan validate; the source-derived CI report has zero unknown commands.
Host drift and reusable-template checks passed. The standard link gate examined
733 Markdown files, and a separate recursive host-doc scan checked 54 files and
1,579 local file targets without broken references. Current public candidate
paths have no case-insensitive file/directory collision. Whitespace checks passed.

Publication follows final direct-main/worktree identity review and native-wiki
preview; a post-push receipt verifies the final source commit and wiki parity.
No immutable snapshot, import receipt, installation selection, research package
or reusable context/plan/task/focus/memory record changed.

The next prepared work is WX-0503 proposed membership documentation, WX-0800
operations readiness, WX-0859 import-preservation rehearsal and WX-0901–WX-0910
freshness, evaluator guides, generated roles, connected-gap mapping and HR-disabled
adoption. These remain TODO; original receipt dates and acceptance gates stay
attached. The full-catalog execution goal remains active.

## Evidence boundaries

Adoption applies only to disposable fixtures in this wave. Its authorization
flag records a deliberate local TODO intake action; gate observations remain
reported facts and grant no provider, worker or production authority. Cooperating
locks, fingerprint rechecks and full candidate validation preserve the selected
ledger; generated-view refresh recovery remains documented separately.

Work-status exact comparison covers task, focus and role files in the selected
snapshot. It does not establish pristine context/memory, project identity,
complete installed-release integrity, running workers or operational readiness.
The full template/integrity gates independently validate this checkout.

This is local macOS source/tool/browser evidence. No real adopted application,
provider connection, employee/payroll action, deployment, native Windows runtime
or whole-site accessibility acceptance was exercised. App version 3.4.0 / deploy
count 0, managed fingerprints, research packages and blank reusable records remain
preserved. Provider/operator criteria retain their original acceptance gates.
