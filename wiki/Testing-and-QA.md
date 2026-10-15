# Testing & QA

The baseline ships Node suites for SYSTEMX LAN and Gusto/HR contracts, an
automated Playwright HR/CMS/CRM smoke, plus TypeScript, ESLint, build, audit and
security gates. Vitest/Testing Library and broader end-to-end/a11y coverage remain
playbook additions that adopted applications enable for their needs.

> Detailed source:
> [Step 10 — Testing & QA](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/Template/steps/10-testing-qa.md).

## What ships in the baseline vs. the playbook

- **Baseline (repo root):** LAN characterization, selected standalone-tool tests,
  import/mirror regressions, developer prerequisite regressions, deterministic
  named portal seeds, Playwright browser smoke, synthetic HR/SDK/backend contract tests, TypeScript,
  ESLint, strict dependency audit, research
  validation, documentation links, immutable integrity and build isolation.
- **Playbook (Step 10):** adds Vitest, wider Playwright scenarios and a11y/security audits.

## Reusable-template release checks

```bash
npm run browser:install # explicit browser setup after npm ci; no auto-download in smoke
npm run ci:all
npm run sync:system:check
npm run deploy -- hosting --preflight
```

`ci:all` runs the selected standalone distribution's tests, host import/mirror
regressions, app/LAN gates, research inventories and public template integrity.
It requires blank adoption seeds. `template:check` rejects populated tasks,
context or project records by design. Use these to maintain the reusable release.

## Portal safety wave — verified

Starting base: `532cc4ad63d18a4fe911b0a9b18e258b85ef3416`. The
[guide](Portal-Safety-and-Recovery.md) explains registered HR/CMS/CRM form groups,
retained navigation drafts, CMS replacement comparison, required import/Reset
checkpoints and bounded structured differences. Read the
[current QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-SAFETY-QA-2026-10-15.md)
for the actual accepted execution evidence; current work remains unaccepted.

```bash
npm run safety:test
npm run browser:safety
npm run browser:quality
npm run browser:recovery-drill
```

| Check | Scope and boundary |
| --- | --- |
| `safety:test` | Pure/model regressions for dirty decisions and navigation, CMS recovery tokens/permissions, structured metadata, checkpoint preferences/replacement/epochs, capture kinds, HR form baselines and quality-auditor negative fixtures. It does not establish rendered browser behavior. |
| `browser:safety` | Actual local navigation, form/recovery choices and checkpoint/difference journeys through the product UI in fresh owned contexts; complete exports and unaffected save bytes are compared. |
| `browser:quality` | Visible accessible-name ambiguity checks, complete implemented workflow-status rendering with monochrome captures, and real Extra large preference at narrow width. Labeled rare-state render fixtures remain distinct from performed user transitions. |
| `browser:recovery-drill` | Isolated fictional invalid imports, unavailable storage, partial selected-write/uncertain rollback and damaged history; rescue download and explicit recovery ordering. The storage faults belong only to the runner's isolated profiles. |

The [state contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-STATE-CONTRACT.md),
[failure drill](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-RECOVERY-FAILURE-DRILL.md) and
[status inventory](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-STATUS-INVENTORY.md) specify preservation
and evidence limits. Browser runners use owned preview child processes and
fresh Chromium contexts. The QA receipt records cleanup observations; commands
alone do not establish a pass. Manual screen-reader, native Windows, provider
and production acceptance remain separate.

The separate genuine SDK preview has its own `npm run browser:sdk-quality`
companion with a canonical same-origin local API gate. It covers selected session,
onboarding, pending payroll, fictional receipt and Reset meanings. Native workspace
saves remain separate. The SDK receipt uses explicit fictional labels and removes
the default provider-partnership wording. Actual results belong in the linked QA
receipt; unmounted SDK exports retain their own scope.

Agent 0 accepted **14 original local criteria**. The catalog now records **91 done / 909 remaining**: **82 P1, 670 P2 and 157 P3**, with **742 local, 127 operator and 40 provider** acceptance gates remaining. The full 1,000-item goal remains active.

**Integrated verification passed: all 61 CI stages, 160 browser checks/check groups and Hosting preflight.** The current safety QA receipt records the source, retained reports, fixture corrections and local evidence limits. Production deployment was not performed.

## Historical portal maturity wave — verified

That wave started from published base
`950f9ba0c4e48faaa65056f504f105201838e3ec`. The
[maturity guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-MATURITY.md)
and [QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-MATURITY-QA-2026-10-15.md)
cover the implemented controls, exact source observations and remaining gates.

```bash
npm run browser:install # explicit browser setup after npm ci
npm run maturity:test
npm run hr:test
npm run browser:maturity
```

| Original criteria | Focused verification boundary |
| --- | --- |
| WX-0151–WX-0155 | Explicit 1–366-day periods and employee hourly-rate timelines; rates selected by work date; active/approved/unpaid eligibility reasons; stale preparations block calculate/review/submit until intentional reprepare. Literal receipt expectations reconcile **10.75 hours / $298.75 gross / $239 net**, and a future rate preserves the complete submitted receipt and statements. |
| WX-0156–WX-0158 | Scoped manager return with a visible reason, returned-draft payroll exclusion, own unpaid draft edit/cancel, and confirmed delete/keep. Submitted/approved/consumed entries remain protected after reload. |
| WX-0280 / WX-0282 | Both CMS forms report all independent field errors and focus the first invalid field. Successful saves establish a clean baseline; keep/discard entry switching preserves the appropriate buffer and complete saved records. |
| WX-0397 | Nine actual negative CRM uploads reject string-enum type/value failures, unsupported/oversized notes, missing references and cross-company relationships before replacement. Full current exports and every raw save byte remain unchanged. |
| WX-0056 | Real directory/card/nav links return to the last supported HR subsection during the mounted session. The explicitly labeled History API unsupported-route probe tests route recovery only; it does not inject domain state or replace the remembered supported destination. |
| WX-0453 / WX-0454 | A history-only label edit preserves ID, timestamp, kind, scope, payload and order. A named manual selected-portal capture preserves every workspace-save byte, open workspace state and temporary forms. |
| WX-0457 / WX-0458 | Complete captured collection counts include zero and nested/metadata rows; identifiers are bounded with exact omission counts and free-text values stay hidden. Directional current-to-target differences cover combined restore and Undo. Model tests bind confirmation to the reviewed point and reject changed capture/scope/label or missing history before any write. |

Focused results are **79 new model tests**, the complete **139-test HR suite**,
and **13 browser check groups covering all 16 criteria**, all passed. Actual
browser mutations use rendered controls, real uploads/downloads, handwritten
expectations and complete state comparisons. The runner owns a temporary
loopback Vite server and fresh Chromium contexts; its report confirms browser
and server cleanup. It preserves user browsers and unrelated listeners.

Fresh seeds and legacy saves begin with **unconfigured fictional hourly rates**.
Choose **Sample period start/end**, configure each **Rate employee**, **Fictional
hourly rate (dollars)** and **Rate effective date**, then **Add sample rate** before
preparing payroll. No rate is inferred from historical `payCents`. The maturity
scenario's $239 net result and the earlier evaluator's $401 result have different
explicit inputs; neither is a general payroll policy or provider result.

Agent 0 accepted all **16 original criteria locally**. At that checkpoint the catalog
recorded **77 done / 923 remaining**: **96 P1, 670 P2 and 157 P3**, with
**756 local, 127 operator and 40 provider** gates remaining. The full 1,000-item
goal remains active; use `npm run backlog:summary` for current counts.

**Integrated verification passed: all 56 CI stages, 111 browser checks/check groups and Hosting preflight.** The source-derived `ci:plan` report itself executes no gate. These are local fictional-workspace observations; provider, deployed-service, native Windows and production acceptance retain their separate evidence requirements.

## Historical evaluator and adoption checkpoint — verified

Agent 0 accepted **13 original criteria — WX-0503, WX-0800, WX-0859 and
WX-0901–WX-0910** — from published source
`aae465ae033f3191a69ed7d40056b0c6e2159e17`. **Integrated verification passed: all 54 CI stages, 95 browser checks/check groups and Hosting preflight.** Use the
[evaluator/adoption QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/EVALUATOR-ADOPTION-QA-2026-10-15.md)
for the final record; the earlier 48-done/46-stage/62-browser checkpoint below
retains its historical scope.

| Scope | Current focused evidence and review boundary |
| --- | --- |
| Timed evaluator scripts | **25 browser checks passed** in owned Vite/Chromium resources. The [worksheet](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-EVALUATOR-WORKSHEET.md) links exact HR/CMS/CRM/recovery actors, controls and expected observations. Human pacing is designed, not stopwatch verified. |
| HR role examples | **34 focused tests passed** for the [reviewed examples](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-ROLE-EXAMPLES.md), including literal outcomes against actual transitions and complete export boundaries. A preview role is not authenticated authority. |
| Capability and membership decisions | **22 capability-matrix tests passed**. The [per-capability matrix](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-CAPABILITY-GAPS.md) separates native/SDK/backend/provider work; the [membership proposal](https://github.com/WayneTechLab/WebAppX/blob/main/docs/TENANT-MEMBERSHIP-PROPOSAL.md) names future revision behavior without claiming current enforcement. Integrated wave verification passed; the receipt retains the exact scope. |
| Operations and maintenance | **24 freshness tests and 22 import-rehearsal tests passed**; the host integration suite passed **117 tests**. [Readiness](https://github.com/WayneTechLab/WebAppX/blob/main/docs/OPERATIONS-READINESS.md), [import preservation rehearsal](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-IMPORT-REHEARSAL.md) and [documentation freshness](https://github.com/WayneTechLab/WebAppX/blob/main/docs/DOCUMENTATION-FRESHNESS.md) retain environment, original receipt and exact source boundaries. Integrated wave verification passed; the receipt retains the exact scope. |
| App without HR | The [temporary CMS/CRM adoption](https://github.com/WayneTechLab/WebAppX/blob/main/docs/examples/hr-disabled-adoption.md) deliberately removes HR imports/routes and defines a separate bundle contract, preserving the default three-portal template. Six adopted-app tests and eight actual browser check groups passed, including interruption cleanup. |

Focused commands are available after the normal pinned dependency and explicit
Chromium setup:

```bash
npm run browser:evaluators
npm run hr:roles:check
npm run hr:roles:test
npm run gusto:capabilities:check
npm run gusto:capabilities:test
npm run docs:freshness -- --to REVIEWED_LOCAL_REVISION --json
npm run docs:freshness:test
npm run systemx:import:rehearse
npm run adoption:hr-disabled
npm run adoption:hr-disabled:test
```

Replace the freshness revision placeholder with an explicitly reviewed locally
available commit. Preview reads mapped local documents and committed comparisons;
recording a decision is a separate explicit action bound to report/history
digests. It never refreshes an old browser date or converts a historical starting
source base into an exact observed final build.

At that checkpoint all **54 configured CI stages passed**, along with Hosting
preflight. The source-derived `ci:plan` report itself executes no stage. The catalog then recorded
**61 done / 939 remaining**: **112 P1, 670 P2 and 157 P3**, with **772 local,
127 operator and 40 provider** gates remaining. The full goal remains active.

The evaluator checks two employees' frozen payroll at **17.75 hours, $532.50
gross, $106.50 illustrative withholding, $25 benefit deduction and $401 net**;
CMS revision **2** remains public after revision **3** is saved; CRM moves
`opportunity-0003` from discovery through proposal to negotiation with linked
company/contact/follow-up records and **$8,250.25** open pipeline; recovery restores
**CMS alone**, compares complete exports and untouched HR/CRM raw save bytes, then
reverses it with Undo. All domain mutations use rendered controls. Existing
HR/CMS lifecycle proof is reused alongside new movement/recovery checks.

The import rehearsal's fixture Git commits and injected public-main observation
are temporary synthetic inputs, not a current public-main check or permission
to import a real app. The two-module rehearsal builds a temporary app and checks
its emitted dependency graph and backup compatibility. Read the
[recovery glossary](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WORKSPACE-RECOVERY-GLOSSARY.md)
before interpreting save, Reset, history clear, import or Undo evidence.

## Adoption, recorded work and import-review foundations

This section retains the historical 48-done adoption checkpoint.

Agent 0 accepted **WX-0851, WX-0852, WX-0855, WX-0856, WX-0857 and WX-0858**
against their original local criteria. At that checkpoint the catalog held **48 done / 952
remaining**: **125 P1, 670 P2 and 157 P3**, with **784 local, 128 operator and
40 provider** acceptance gates remaining. The complete 1,000-item goal stays
active. The [adoption QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-ADOPTION-QA-2026-10-15.md)
records the examined source, review fixes, live read-only observations and limits.

Use the current package aliases for focused verification:

```bash
npm run backlog:adopt:test
npm run backlog:impact:test
npm run systemx:provenance:test
npm run systemx:work-status:test
npm run browser:work-status
npm run systemx:integration:test
npm run ci:plan
npm run ci:plan:test
```

The integration suite already includes adoption, provenance and upstream-review
fixtures; the individual aliases support focused changes. `ci:plan` describes
the configured gates without executing them.

| Focused evidence — 2026-10-15 | Recorded result |
| --- | --- |
| Host integration | 95 passed: 23 adoption, 23 provenance, 13 upstream-review and 36 prior integration tests |
| Revision impact | 19 passed in disposable real Git repositories |
| Work status | 37 passed for explicit selection, validated records and independent unavailable facts |
| Actual LAN browser | Six passed in an owned temporary fixture, including stale-response protection and unchanged reusable source seed bytes |
| CI plan | 13 passed; that checkpoint's source-derived plan listed 46 stages with no unknown command classifications |

**At that historical checkpoint, all 46 CI stages, 62 browser checks and Hosting preflight passed.**
**Generated catalog/plan, link and preservation checks passed.** GitHub
publication uses final repository-identity and native-wiki parity checks. That checkpoint's final integrated run passed all 46 stages.
The earlier 42-done / 43-stage / 56-browser-check checkpoint below is historical.

### Adopted TODO intake and independent action gates

The [adoption tool](https://github.com/WayneTechLab/WebAppX/blob/main/docs/BACKLOG-ADOPTION.md)
requires an explicit adopted app identity, root or exact registered child, reviewed
local catalog revision, bounded selection and registered owners. Preview creates
no files or tasks. Apply rechecks the complete reviewed plan under the selected
scope's coordination lock and records TODO tasks with empty acceptance evidence.
Source WX dependencies must map to selected or explicitly reviewed existing target
tasks even when the source proposal is done. Existing adopted records and blank
reusable seeds retain their respective scope.

Credential readiness, operator authorization and local prerequisites have
independent requirements and observations per selected action/target. Omitted or
unreviewed dimensions remain `unknown`; blocked gates can coexist with reviewed
TODO intake. `--authorize-intake` records the deliberate intake action and grants
no worker execution or provider access. Reported readiness and TODO status do not
establish execution authority, verified credentials or operational acceptance.

The [revision-impact guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/BACKLOG-REBASELINE.md)
documents `npm run backlog:impact -- --from FROM_REVISION --to TO_REVISION --json`.
Replace both operands with reviewed locally available commits. The report compares
the resolved endpoint trees and the selected committed catalog, requests review
for changed source scopes, and distinguishes catalog metadata from definition
changes. It does not fetch, reopen proposals or change canonical task state.

### Recorded status, ownership and import review

The [work-status contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WORK-STATUS.md)
adds records-only summaries to `/api/status` and the Vite development bridge.
The LAN builder's **AGI / Agent 0** panel and local React status card display
reusable work seeds, the proposal roadmap and explicitly selected root/child
work. The default is `not-selected`; an unavailable selected source stays
`unavailable`, with diagnostics and any independently readable facts. A valid
empty ledger means no work recorded. The view does not coerce unavailable data
to zero, infer a project from the last chat or observe running workers.

Stock comparison covers only the selected release's task, focus and role bytes.
Exact equality does not establish ownership, pristine context/memory, adopted
identity, project completion or installed integrity. The owned browser journey
uses actual rendered controls for default/root/child selection, malformed child
and unavailable roadmap states. Holding an older root response until after a
new child selection checks that stale responses cannot misattribute work. It
retains local evidence, verifies source seed bytes and closes its owned resources.

```bash
npm run systemx:provenance -- --format text --limit 40
npm run systemx:provenance -- --path GLOBAL/CONTEXT.md
npm run systemx:upstream:check -- --source /path/to/dotSYSTEMX \
  --expected-commit FULL_REVIEWED_COMMIT --limit 25
```

The source path and commit above are placeholders for the reviewed standalone
checkout. The [provenance inventory](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-PROVENANCE.md)
verifies every registered retained release and reports ownership independently
from exact or manifest-equivalent content. Host-owned blank seeds remain host
owned; byte equality grants no overwrite authority. Runtime/secret boundaries
are excluded without reading payloads, and invalid integrity prevents a verified
partial report. It starts no workflows or updates.

The [bounded upstream review](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-UPSTREAM-REVIEW.md)
binds the clean standalone source's exact HEAD to an independent canonical public
main observation, the manifest and historical receipt proof. It reports selected
versions, all preserved host paths and bootstrap conflicts. Pagination leaves
complete-set blocking intact. Unknown source facts remain unverified; a ready
preview applies no import and cannot waive the later apply checks.

Focused fixtures use temporary root/child records, intact synthetic releases and
injected public-main responses. Actual read-only source observations are dated
in the receipt. This wave exercises no real adopted app intake, provider action,
deployment, native Windows runtime or whole-site accessibility acceptance.

## Operational foundations and complete portal lifecycles

This historical checkpoint retains the earlier 42 accepted proposals, 43 CI
stages and 56 browser checks. The later historical adoption checkpoint and the
current maturity wave's passed gates are recorded above.

```bash
npm run environment:check
npm run environment:check -- --json
npm run environment:test
npm run repository:identity:test
npm run browser:payroll
npm run browser:lifecycles
```

The [environment proposal](https://github.com/WayneTechLab/WebAppX/blob/main/docs/ENVIRONMENT-CONFIGURATION.md)
and schema validate six fixed tracked public files: schema, root/starter examples,
browser declarations and the reviewed server guide. The checker reports names,
classifications and counts without reading private environment files or shell
values. It validates examples; production configuration enforcement and provider
acceptance require their own implementation and evidence.

For an already authorized publication review, inspect the checkout with:

```bash
npm run repository:identity -- --json
# Adopted repositories must supply their intended identity:
npm run repository:identity -- --expected-repository Example/adopted-app --json
```

The [repository receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/REPOSITORY-IDENTITY.md)
distinguishes origin/push identity, current branch/HEAD, cached upstream refs,
direct GitHub main and tracked/staged/untracked changes. It performs no fetch,
stage, commit or push. Both `clean-parity` and `clean-ahead` exit 0 for complete
clean observations; local commits ahead of the verified direct remote ancestor
still need publication review. A receipt supplies observations within existing
authorization. It grants no additional authority and runs no release gates.

Both new browser commands use the unchanged named seed, owned loopback Vite,
fresh Chromium contexts, ordinary rendered actions and actual downloads compared
with handwritten expected records. The payroll journey covers two employees'
onboarding/benefits/time approval, preparation, calculation, review, submission,
individual statements and consumed-time refusal. **17.75 hours / $532.50 gross /
$106.50 illustrative withholding / $25 benefits / $401 net** reconcile exactly
between statements and the combined export after reload.

The CMS journey saves revision 2, requests separate review, approves and publishes,
then saves revision 3 and checks the complete frozen revision-2 public preview
and saved records after reload. CRM creates, qualifies and converts a lead into
linked company/contact/opportunity records, completes a linked follow-up, and
checks exact dashboards and exports. Removing the conversion form establishes UI
prevention. A separately reported browser-module negative probe calls the actual
CRM transition on a detached converted download, checks replay refusal and
preserves both its input and application save bytes. The probe neither injects
application state nor constructs expected records.

**Historical focused verification — 2026-10-15:** **26 repository-identity tests, 22
environment tests, eight payroll browser checks and twelve CMS/CRM browser
checks passed**. Browser reports confirmed owned cleanup and no unexpected
traffic/errors; only the expected unset-Firebase warning appeared. Agent 0
then accepted nine original criteria, taking the catalog to **42 done / 958 remaining**.
At that checkpoint, all **43 CI stages, 56 browser checks and Hosting preflight
passed**; each browser report confirmed its owned browser and server closed.
Read the [operational QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/OPERATIONAL-FOUNDATIONS-QA-2026-10-15.md)
for the final integrated result and the [coverage map](https://github.com/WayneTechLab/WebAppX/blob/main/docs/QA-COVERAGE-MAP.md)
for each invariant's model/browser evidence and uncovered boundaries.

The [security assumptions](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SECURITY-ASSUMPTIONS.md),
[command effects](https://github.com/WayneTechLab/WebAppX/blob/main/docs/COMMAND-SAFETY.md)
and [monitoring contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/MONITORING.md)
keep source validation, browser runtime, stored startup readiness, current process
ownership, optional providers and deployed health independently reportable.
Local fixtures establish no real payroll, live provider, production deployment,
Windows runtime or whole-site accessibility acceptance. Existing human
authorization persists for the work it covers.

## Session, portal state and evidence contracts

```bash
npm run systemx:session:test
npm run browser:state-contract
npm run backlog:evidence:check
npm run backlog:evidence:test
```

The supervisor tests use isolated process/port/probe fixtures for fixed origin
selection, busy-listener preservation, strict Vite binding and independent
Vite/LAN/Auth/Firestore/Storage readiness. Startup observations distinguish
`starting`, `ready` and `failed`; Storage readiness is a reachable TCP listener,
not a tested storage workflow. A usable app can coexist with failed emulators.
These focused fixtures do not establish a complete live emulator session on
every target platform.

Restart-preview tests exercise ownership and replacement-listener classification,
including a real temporary fixture whose process, listener and runtime file
bytes stay intact. `npm run systemx:session:restart:preview` is a read-only OS
snapshot: it sends no signals, creates no listeners and writes no session/token/
configuration files. A reviewable result neither reserves ports nor performs
a restart. Read [Quick Start](Quick-Start.md#open-the-integrated-local-builder)
for operator commands and origin troubleshooting.

The [state contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-STATE-CONTRACT.md)
separates accepted workspace records from temporary form/timer state and
documents each portal's navigation, Reset, import and Undo lifecycle. The browser
journey changes ordinary records through rendered controls and reads storage
and downloads for evidence. An isolated denied-storage fixture checks export
of accepted records still held in memory. Temporary reports, downloads,
screenshots and traces stay outside tracked reusable files. The
[capability matrix](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-CAPABILITIES.md)
explains synthetic role projections and complete, role-agnostic backup contents.

The [evidence index](https://github.com/WayneTechLab/WebAppX/blob/main/docs/BACKLOG-EVIDENCE.md)
keeps review scope separate from original evidence metadata. Its validation
tests cover known proposal IDs, dates/revisions, path containment, references,
filtering and preservation of catalog state. An attachment to a TODO item can
reuse earlier browser evidence while its dependencies remain pending. Validation
or querying never accepts that item. The
[session/contracts QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SESSION-CONTRACTS-QA-2026-10-15.md)
records actual integrated outcomes, source base and remaining boundaries.

**Historical accepted session/contracts checkpoint — 2026-10-15:** all **38 CI stages**
and Hosting preflight passed. Focused/integrated verification includes **42
session tests**, **15 evidence-index tests**, **eight planner tests** and
**13 CI-plan tests**. The four browser suites passed **7 smoke, 9 keyboard,
9 foundation and 11 state-contract checks**, with both owned resources closed
in every report. The 235-case managed suite retains five existing filesystem
skips. Final drift, template, checklist/plan, link and whitespace checks passed.
The catalog reached **33 done / 967 remaining** after nine new local acceptances;
this checkpoint does not establish Windows runtime, real emulator/provider
workflows, production deployment or whole-site accessibility acceptance.

## Execution-foundation contracts and reports

```bash
npm run development:check
npm run development:test
npm run dev:mock:test
npm run backlog:plan:check
npm run backlog:plan:test
npm run ci:plan
npm run ci:plan:test
npm run browser:foundation
```

The root and starter pin Node **24.22.0**, retain the doctor-aligned minimum
**>=24.0.0** and declare **npm 11.11.0**. Development checks compare package/lock
and runtime-pin parity, public client-variable coverage and ignored local
environment rules without reading private `.env` values. The mock launcher
tests cover arguments, sanitized child configuration, explicit busy-port failure,
owned server/cache cleanup and honest failure status after forced termination.

The execution planner checks complete 1,000-ID coverage, dependency-ready order,
selected graph closure, exact longest-chain counts, bounded examples and generated
plan parity. Catalog validation requires all declared dependencies to be completed
before accepting a dependent item. Read-only plan/ready/graph commands neither
dispatch workers nor update completion state.

The CI plan derives actual stage order from the maintained runner and expands
reviewed npm commands, including dependent Gusto/managed-SYSTEMX scopes and
mutation categories. Unknown syntax/commands remain explicitly unreviewed. The
report runs no gates; reading a plan does not establish success. Audits/builds and
test fixtures retain their documented network/output/process behavior when run.

The foundation browser journey covers registered card content, unset-Firebase
guidance, normalized deep links, keyboard breadcrumbs, unsupported-page recovery,
in-app handling links and Ready/Saved/Recovered/Unavailable save summaries.
Normal domain changes use real controls; malformed/denied-storage cases use
isolated synthetic platform fault injection. This differs from the keyboard
journeys' strict no-state-injection boundary. The
[foundation QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/EXECUTION-FOUNDATION-QA-2026-10-15.md)
records actual test/browser results, accepted IDs and final publication gates.

### Historical foundation results — 2026-10-15

| Focused gate | Verified result |
| --- | --- |
| Development contracts | 15 tests passed, including runtime/example drift and ignored-file privacy fixtures |
| Native mock launcher | 14 tests passed, including actual cold-module startup, occupied-listener preservation, signal failure reporting and shared server/cache cleanup |
| Execution planner | Eight tests passed, including dependency order, exact large tied-path counts, bounded output and preserved source/seeds |
| Catalog | 14 tests passed, including rejection of unfinished dependencies on a completed item |
| CI plan | 13 tests passed; actual report listed its then-current 34 required stages with zero unknown classifications |
| Shared portal models | 120 tests passed, including registry, route and save-summary coverage |
| Foundation browser | Nine checks passed across Firebase notice, registry fields, deep links, keyboard breadcrumbs, unsupported recovery, unsaved CMS/document preservation, save/refresh and isolated storage faults |
| Existing keyboard browser | Nine checks passed after the shared-shell changes, preserving exact onboarding/recovery records and focus |

Browser runs reported no unexpected backend/provider traffic, failed requests or
uncaught errors; only the expected unset-Firebase warning appeared. Owned browser
and server cleanup succeeded. Review corrections include honest signal failure,
exact tied-path reporting, in-app handling navigation and cold Vite request-drain
cleanup. The receipt retains their original evidence and final integrated CI,
preflight/drift/publication results.

Agent 0 accepted 17 additional items at this checkpoint. The catalog then held
**1,000 records: 24 done, 976 remaining — 146 P1, 673 P2 and 157 P3**. Remaining
acceptance gates then were **808 local, 128 operator and 40 provider**. Use
`npm run backlog:summary` for current counts. The goal to complete every
original criterion remains active; generated reports and passing local checks
retain their individual acceptance scope.

## Automated developer and portal smoke checks

```bash
npm run doctor
npm run --silent doctor -- --json
npm run browser:install
npm run browser:smoke
# Optional visible browser / chosen artifact parent:
npm run browser:smoke -- --headed
npm run browser:smoke -- --output /path/to/local/artifacts
```

The doctor runs without installed project dependencies and only reads tool
versions. Node.js must be >=24.0.0 and Python >=3.12.0; npm and Git must be
present with parseable versions but have no specified minimum. It does not
install/update tools, write configuration, start services or prove platform
runtime behavior.
The quiet npm form emits the JSON report without npm headers. To diagnose
missing npm, use `node scripts/developer-prerequisites.mjs` directly; no installed
project dependencies are required.

`npm ci` installs exact pinned **Playwright 1.64.1**. The separate
`browser:install` command downloads its Chromium browser explicitly; the smoke
fails with that instruction if the browser is missing and never downloads one
automatically. The smoke launches its own Vite server at `127.0.0.1` on an
available port and a fresh Chromium context. Existing user listeners and browser
profiles are separate. No provider accounts, credentials or Firebase emulators
are required.
The dependency optimizer cache stays inside that run's temporary artifact
directory, separate from an existing development server's cache.
The OS allocator selects a positive port before Vite binds strictly; if another
listener wins that race, the run fails instead of reusing or stopping it. Requests
to external/provider/backend services and unrelated WebSockets are blocked;
the runner's dedicated local HMR connection remains allowed.

The deterministic named seed pack provides an identified baseline, hash and
expected dashboard totals. The smoke checks that baseline, makes one domain
record change through each HR/CMS/CRM interface, reloads and compares complete
exported states. It produces a temporary report, screenshots and trace with
paths printed in the command output. Cleanup closes only its own browser and
Vite server. Browser artifacts contain synthetic records; they are test evidence,
not new application saves or provider receipts.

`ci:all` includes doctor regressions, named-seed validation and the browser smoke.
Keep Chromium installed in the environment that runs the full gate. For the
checked revision, exact observations and command outcomes, read the
[developer/browser QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/DEVELOPER-BROWSER-QA-2026-10-14.md).
The browser smoke checks local account-free native portal behavior; it does not
cover every workflow, the separate Gusto SDK UI, live Firebase/Gusto connections,
deployment, Windows runtime or whole-site accessibility.

### Observed developer/browser results — 2026-10-14

The actual Mac prerequisite report passed with **Node 25.8.1, npm 11.11.0,
Git 2.54.0 and Python 3.14.5**. All **18 doctor regressions** and **16 named-seed/
runner regressions** passed. The final authored browser run passed all seven
checks:

| Browser gate | Observed result |
| --- | --- |
| Fresh baseline | Complete exported payload matched the reviewed named seed |
| HR | Created Avery's fictional goal, reloaded and matched the full expected payload/dashboard; CMS/CRM stayed intact |
| CMS | Saved the fictional article as revision 2, reloaded and matched the full expected payload; HR/CRM stayed intact |
| CRM | Created a fictional `.invalid` lead, reloaded and matched the expected payload/dashboard; HR/CMS stayed intact |
| Exact saves and identity | All three browser-save envelopes matched expected synthetic data; no account cookies |
| Second clean context | Exported the unchanged seed with no inherited workspace saves |
| Requests and errors | No external/provider/backend requests, failed HTTP requests, console errors or uncaught exceptions |

Full **`ci:all`, Hosting preflight and SYSTEMX drift checks passed**, including
the integrated browser journey with its isolated optimizer cache. The receipt
records all suite counts, five filesystem-specific skips and release boundaries.
No production deployment ran.

Owned **browser cleanup and Vite server cleanup both passed**. Only the expected
unconfigured-Firebase warning appeared. Independent source review left no
unresolved findings. These are focused local results; consult the canonical
receipt for full CI, Hosting preflight and SYSTEMX drift outcomes.

At that developer/browser checkpoint, the catalog retained exactly **1,000
records**, with **five completed and 995 remaining: 162 P1, 675 P2 and 158 P3**.
That wave completed **WX-0001** and
**WX-0652**, including **WX-0651**'s named-seed dependency; earlier **WX-0051**
and **WX-0451** remain complete. Blank reusable SYSTEMX records stay unchanged.

## Keyboard onboarding and selective recovery

```bash
npm run browser:keyboard:test
npm run browser:keyboard
```

These commands add **WX-0653**'s native onboarding and **WX-0654**'s selective
restore/Undo coverage alongside the existing `browser:smoke`. The keyboard
journeys reuse its owned loopback Vite server, isolated optimizer cache, fresh
Chromium context, request/error guards, explicit browser installation and
temporary reports/screenshots/trace. Existing user listeners and browser data
remain separate.

The shared driver reaches controls by sending real **Tab** input and asserts
the active element's computed focus-visible outline/ring. User actions use
keyboard press/type input. The app itself advances or returns focus as actions
disable controls or previews open/close; `assertFocus` verifies those transitions.
Initial navigation/reload and setting files in a keyboard-opened native chooser
are explicit harness boundaries. The operating system chooser's key sequence is
not automated. Previews are page regions, not modal focus traps.

The authored onboarding journey covers required-field rejection without a save,
fictional profile editing, profile/job/checklist review, summary/confirmation,
completion focus and a mock receipt. Recovery coverage traverses scope and budget
controls, explicit Cancel/Confirm and Undo, checking returned focus and domain
preservation. Read the
[manual keyboard guide](Template-Portals.md#keyboard-onboarding-and-recovery) and
[keyboard QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/KEYBOARD-PORTALS-QA-2026-10-15.md)
for actual checked scope, outcomes and gates. Visible-focus assertions do not
establish screen-reader, contrast, every-workflow, cross-browser or whole-site
WCAG acceptance. Earlier results below retain their original wave and revision.

### Accepted keyboard results — 2026-10-15

All **nine authored browser checks** passed: three onboarding and six recovery,
recording **110 onboarding and 266 selective restore/Undo focus observations**.
All **11 keyboard driver guards** and **16 existing seed/runner guards** passed.

| Accepted coverage | Observed result |
| --- | --- |
| Required profile field | Blank email retained focus and created no domain save; fictional keyboard entry saved |
| Onboarding stages | Enter/Space completed profile, job, checklist, summary and confirmation; focus reached each next step and the completion status |
| Onboarding persistence | Exact `MOCK-ONBOARDING-0001` state/save/export survived refresh; CMS/CRM and original accessibility preference stayed intact |
| Selective cancel | Keyboard-opened chooser, Space and forward/reverse Tab traversed scopes; Cancel returned to Import and preserved raw saves/history/export |
| Selected restore | HR+CMS matched changed input and captured only selected pre-restore states; unchecked CRM stayed intact |
| Undo cancel | Preview heading received focus; Cancel returned to the exact opener without changing raw bytes or exports |
| Confirm Undo | Complete HR+CMS recovery, preserved CRM and reversible selected-only point; focus returned to the exact opener |
| Removed opener | Retention removed the oldest HR+CMS point; Undo focused the visible history heading |
| Recovery persistence | Reload preserved exact saved workspace/history bytes, five retained points and the complete expected export |

Both owned browser and server cleanup checks passed. Only expected missing
Firebase configuration warned; no browser/request/provider/backend errors were
observed. Independent source review had no unresolved findings. Clear-history
focus is implemented but was not part of these nine browser checks. Consult the
keyboard receipt for final CI, Hosting preflight and SYSTEMX drift outcomes.

**WX-0653/WX-0654 are complete.** At that keyboard checkpoint the catalog retained
exactly **1,000 records: seven completed, 993 remaining — 160 P1, 675 P2 and 158 P3**. Earlier completions
and their original evidence remain intact; blank reusable SYSTEMX seeds stay blank.

Final local publication gates passed `npm run ci:all` and Hosting preflight,
including the seven-check smoke and nine-check keyboard journeys. The
[keyboard receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/KEYBOARD-PORTALS-QA-2026-10-15.md)
records suite counts, five filesystem-specific skips and the local acceptance
boundary. Preflight skipped deployment and preserved version 3.4.0/deploy count 0.

## Adopted-project checks

Use `systemx:validate` for active project records and select your application's
checks in `.SYSTEMX/project.json`. Adapt the template-maintenance tests after
adoption; they are not evidence that an application's work ledger must stay blank.
The app/LAN checks remain separately runnable:

```bash
npm run systemx:validate
npm run ci:lint
npm run ci:typecheck
npm test
npm run hr:test
npm run ci:audit
npm run build
```

Consult the [HR portal QA record](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL-QA-2026-10-14.md)
for the earlier portal wave's source, test and browser evidence boundaries. The
earlier [2026-10-14 browser QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-BROWSER-QA-2026-10-14.md)
retains the native HR fixes and historical 41-test checkpoint. The original
[3.4.0 release receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.4.0.md)
retains its October 13 revision and historical 39-test HR result. The historical
[3.2.0 release receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.2.0.md)
records 230 standalone tests (successful with 5 case-sensitive filesystem cases
skipped on the validation Mac), 27 host integration tests, 8 operational controls
and 11 app/LAN tests. The
[3.1.0 receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/VALIDATION-3.1.0.md)
retains its historical scope. Recheck the current revision rather than treating
a release receipt as a new run.

For an Agent Y task, run the configured app checks against the returned worktree
and record their original output and checked revision before Agent 0 acceptance.
The controller's successful exit and an Agent Z score do not run those checks or
accept the task. Follow [Agent Y New App Setup](Agent-Y-New-App-Setup.md).

## Gusto and HR checks

```bash
npm run hr:test
npm run hr:backend:audit
```

`hr:test` exercises synthetic native HR state, route/resource guards, the SDK
directory/onboarding/payroll mock's request/response contracts, and backend membership, projection
and webhook foundation boundaries. It uses local fixtures and app/backend code;
it does not contact Gusto or establish Firebase deployment acceptance.
`hr:backend:audit` audits the isolated optional functions package's dependencies.

### P1 shared registry and restore storage-budget checks

The [P1 QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-REGISTRY-BUDGET-QA-2026-10-14.md)
records the checked revision, actual browser observations and repository gates
for **WX-0051** and **WX-0451**. Earlier receipts below retain their own scope and
historical counts; they are not a new test run for these changes.

To repeat this wave's browser checks:

1. Open `/portals`. Follow HR, CMS and CRM cards and shared navigation, including
   cross-links. Verify each reaches its registered route and shows the expected
   portal label while preserving the independent workspace records.
2. Import a valid combined backup. With no portal selected, verify the budget
   asks for a selection and confirmation is disabled. Select HR, CMS+CRM and all
   three in turn. Verify workspace rows/total, recovery-point size and projected
   history follow the selection; preview and cancellation must not add history.
3. Confirm a selected restore, refresh and compare full exported domain states.
   Verify selected records match the backup and unselected records remain intact.
4. Open **Undo…**. Verify its budget describes the point's fixed portal scope,
   including the new point needed to reverse Undo. Cancel first, then confirm
   and compare exports with the expected recovery snapshots.
5. Exercise retention with enough points to require pruning. Compare projected
   retained/pruned counts with the confirmed history after refresh.

Automated tests must cover exact serialized counts, selection/scope validation,
read-only previews, rejected/corrupt or unreadable history, oversized newest
points, five-point/character-budget retention and actual write failure after a
valid preview. Browser quota is unknown; passing an app budget must not bypass
fresh confirmation-time validation, successful recovery-point save or rollback.
Do not equate storage-fake fault coverage with browser fault injection. The
[portal guide](Template-Portals.md#restore-storage-budget-preview) explains the
limits and user recovery flow.

**Observed local browser results — 2026-10-14:**

| Check | Observed result |
| --- | --- |
| Registry paths | Directory and HR/CMS/CRM cross-links passed; nested HR payroll opened and `/hr/demo-other` showed 404 |
| Preview and cancellation | Complete exported workspace payloads remained equal |
| HR-only restore and Undo | CMS/CRM stayed intact; Undo recovered the original complete payloads after refresh |
| CMS+CRM and all-three restore | CMS+CRM preserved HR; all-three replacement matched the imported states |
| Projected history | Confirmed sizes matched 4,748 → 9,525 → 12,486 → 15,048 → 22,602 → 24,994 characters; sixth restore pruned one and retained five |
| Near-limit current state | A valid 1,994,127-character CMS save imported successfully |
| Recovery budget refusal | Incoming all-three saves totaled 7,073 characters, but the new point required 2,000,440 and projected history 2,000,471; Restore was disabled and cancellation preserved complete payloads |
| Browser diagnostics | No errors observed; expected missing Firebase configuration warning only |

Full **`ci:all` passed**, including **114 portal cases, 116 HR cases and 13
backlog cases**, plus 235 shared SYSTEMX cases (five filesystem-specific skips),
36 host integration cases, eight security operations cases and 11 app/LAN cases.
Lint, TypeScript, dependency audits, documentation links and the production build
passed. **Hosting preflight and SYSTEMX drift checks passed**; no deployment ran.
The receipt records exact scope and the separate provider/browser-quota limits.

At that first P1 checkpoint, the stable catalog contained exactly **1,000
records**, with **WX-0051 and WX-0451 completed** and **998 remaining, including
164 P1**. Completed entries link their evidence. See the
[roadmap](WebAppX-Roadmap.md) for current totals; blank reusable SYSTEMX
task/context/plan/memory records remain unchanged.

### SYSTEMX refresh and roadmap checks

The [refresh/roadmap receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-ROADMAP-QA-2026-10-14.md)
records the provenance check and 1,000-item planning catalog. The current host
SYSTEMX integration suite passes 36 cases, including 19 importer cases. The
documentation-only source-advance case preserves the first receipt; changed
same-version trees, malformed identity, missing history and expected-commit drift
remain rejected.

`npm run backlog:check` validates 1,000 ordered proposals in 20 groups of 50,
unique title/acceptance, existing source paths, earlier dependencies and exact
Markdown/CSV generation. Six `backlog:test` cases cover malformed metadata/date,
counts/IDs/areas, duplicate content, unsafe sources/dependencies and CLI queries.
The catalog remains proposed work, separate from blank reusable SYSTEMX records.
See [WebAppX Roadmap](WebAppX-Roadmap.md). Existing browser receipts below retain
their checked revision and scope; this tooling update claims no new browser run.

Full `npm run ci:all` and Hosting preflight passed for this update, including
six catalog regressions, 235 shared SYSTEMX cases (five filesystem-specific skips),
36 host integration cases, 116 HR cases and 96 portal cases, plus the security,
type, build, seed/research integrity and documentation gates. Final SYSTEMX drift
reported no changes. Version remains 3.4.0/deploy count 0.

### Restore-point and Undo checks

The [restore-point QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/RESTORE-POINTS-QA-2026-10-14.md)
records this update’s actual browser observations and repository gates. Earlier
receipts below describe their own checked revisions; they do not establish the
new history behavior.

To repeat the browser checks on `/portals`:

1. Save identifiable HR, CMS and CRM changes and export a combined baseline.
   Import a different valid bundle and restore HR alone. Confirm a point records
   only HR, then refresh and verify history and restored HR persist.
2. Choose **Undo…**, inspect HR’s time/counts/scope, and cancel. Re-export to confirm
   no workspace changed. Confirm Undo and compare HR with its baseline, with
   CMS/CRM unchanged. Refresh and compare again.
3. Make a later saved edit in a captured portal before confirming Undo. Verify
   the preview explains whole-portal replacement, then use the newly created
   pre-undo point to recover that later edit.
4. Repeat with CMS+CRM and all three portals. Confirm restored modules clear
   transient forms/timers while unchecked CMS/CRM roots preserve mounted UI.
   Leaving an HR subpage for the directory can already have cleared its route-local UI.
5. Create enough points to exercise bounded retention. Explicitly **Clear restore
   points** and confirm history disappears through refresh while all three
   workspace exports retain their current records.
6. Confirm existing individual imports, Reset and combined export formats remain
   compatible. Exported JSON does not include restore-point history.

Automated storage fakes must cover history schema/graph validation, five-point and
2,000,000-character pruning, oversized newest-point refusal, blocked reads/writes,
failed history save before workspace overwrite, and existing selected-key rollback
failures. Browser checks and automated fault injection are separate evidence. Use
fictional data only; plain-text local points include private drafts and mock
receipts. Read [Template Portals](Template-Portals.md#automatic-restore-points-and-undo)
for recovery and privacy boundaries.

Observed browser results passed for HR-only, CMS/CRM and all-three recovery,
Undo after refresh, Undo of Undo, later saved-edit recovery, unselected unsaved
CMS fields, five-point retention, cancellation and history-only clearing. Full
downloaded workspace payloads matched the expected snapshots. The portal suite
passes 96 tests, including 17 new restore-point cases. Storage quota, corruption
and rollback failures are covered with automated storage doubles.

Full `npm run ci:all` passed with **116 HR + 96 portal/storage/backup tests
(212 total)**, lint, TypeScript, template integrity, security checks and production
build/LAN isolation. Hosting preflight passed with version 3.4.0/deploy count 0.

### Combined backup and selective restore checks

Full `npm run ci:all` passed, including **116 HR + 79 portal/storage/backup
tests (195 total)**, production build and LAN isolation.

Use `/portals` for **Export all workspaces** and **Import combined backup**.
This feature downloads one complete HR/CMS/CRM file and restores only the full
portals selected in the validated preview. Initial selection is empty; at least
one portal must be selected to enable **Restore selected workspaces**.
The [combined QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/COMBINED-BACKUP-QA-2026-10-14.md)
records this feature’s actual browser results and automated gates separately
from the earlier individual-file receipts below.

**Browser checkpoint — 2026-10-14:** actual combined download, preview,
Cancel, HR-only restore, CMS+CRM restore, all-three restore, refresh and re-export
passed between independent `127.0.0.1` and `localhost` origins in the same in-app
browser. Initially unchecked boxes kept Restore disabled. Cancel preserved all
destination domain payloads exactly. Each selective restore matched selected
source payloads and unselected destination payloads exactly; unselected CMS
unsaved text stayed intact, selected CMS text cleared, and the changed destination
HR role survived the CMS+CRM restore. All-three restore followed by refresh and
re-export matched the entire source `workspaces` payload exactly.

Source markers included HR’s submitted `MOCK-PAYROLL-0002` at $240 gross/$48
illustrative withholding/$25 benefit/$167 net; CMS `Portable CMS sample backup`
revision 3; and CRM’s three companies/leads/opportunities with $1,500 won.
Corrupt CRM graph, version 999, malformed JSON, a singular portal file and a
24,008,193-byte file were rejected before restore controls appeared. Re-export
confirmed unchanged states after rejection. Individual CMS export, CMS-only
Reset and individual import/refresh also passed, ending with all three combined
payloads equal to source.

**79 portal/storage/backup tests passed:** the earlier 54 plus 12 combined-codec
and 13 selective-restore cases. Rollback failures are covered by those automated
storage tests; no browser permission changes were made. These UI checks do not
certify other browser engines or production/provider operations. Follow the
[current QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/COMBINED-BACKUP-QA-2026-10-14.md)
for the complete verification and repository gates.

For a release check, use fictional records and verify:

1. Export a combined file after saving identifiable HR, CMS and CRM changes.
   Confirm complete module records are present and an untouched portal still
   exports its initial sample. Export itself must not create saved fixture keys.
2. Import at an independent browser/origin. Check the file/export time/three
   record summaries, unchecked boxes and disabled Restore button. Cancel must
   preserve all destination records and saved bytes.
3. Select one, then two, then all three portals in separate checks. Confirm full
   replacement of selected modules and refresh restoration. Unselected current
   records and saved bytes must remain unchanged. Unchecked CMS/CRM roots retain
   mounted interface state; consult the state contract for HR route-local resets.
4. Verify selected unsaved forms/timers reset only after successful replacement,
   and the separate SDK session remains outside the bundle.
5. Reject malformed JSON, unsupported format/version, missing/invalid nested
   modules and oversize files. A damaged unselected module must reject the entire
   file before selection. Individual files belong in their portal’s import
   controls; combined files belong in the directory’s controls.
6. Exercise save failures and rollback in automated storage-adapter tests. Old
   memory must remain active; prior selected-key bytes should restore. A second
   failure during rollback must warn explicitly that browser storage may be
   partial, without claiming an atomic multi-key transaction.
7. Re-export restored selected states and compare full domain payloads with the
   original bundle. Preview roles do not filter private drafts/answers/receipts;
   unsaved fields, active timers, auth data and SDK state are excluded.

After a rollback warning, export current in-memory workspaces before refreshing,
allow browser storage/capacity, and retry the restore or Reset affected modules.
The flow does not merge records, synchronize browsers, upload files, authenticate
memberships or execute provider actions. See
[Template Portals](Template-Portals.md#combined-backup-and-selective-restore)
for user-facing steps, limits and recovery behavior.

### Earlier per-portal export/import checks

Automated verification: **116 HR tests + 54 portal/storage/backup tests passed**
(**170 total**, including 18 new backup/import cases). Full `npm run ci:all`
passed with production build and LAN isolation.

HR, CMS and CRM each export/import a separate JSON file without an account or
upload. The [backup QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-BACKUP-QA-2026-10-14.md)
records the earlier per-portal browser evidence, automated totals and gate results.
Earlier persistence and talent results below retain their original checkpoints.

**Browser checkpoint — 2026-10-14:** all three native portals passed actual
Export workspace downloads and file-picker imports from numeric loopback into
`localhost`, followed by preview, explicit replacement, refresh and re-export.
Every final `data` payload matched its source file exactly. These are two
independent storage areas in the same in-app browser, not a certification of
Safari, Firefox, Windows or another browser engine.

| Area | Observed result |
| --- | --- |
| HR | Confirmed Avery health plan, approved eight hours and submitted `MOCK-PAYROLL-0002` retained $240 gross/$48 illustrative withholding/$25 benefit/$167 net after import and refresh. |
| CMS | `Portable CMS sample backup` revision 3 restored with two content records, one publication and two actions. Cancel preserved target revision 1, and confirmed replacement cleared an unsaved target field. |
| CRM | Three companies, contacts, leads and opportunities plus six actions restored with $1,500 won/$6,500 open. Reimport removed a target-only lead and retained the source records. |
| Rejected files | CMS rejected an HR file, malformed JSON, version 999 and an 8,002,049-byte file without changing revision 3. HR rejected a broken time-entry employee reference; its submitted payroll receipt survived refresh. |

Storage-denial/write-failure preservation is covered by automated tests; browser
permissions were not changed for these checks. Read the receipt for final gate
results and the separate automated scope.

Use fictional data and verify each module independently:

1. Save identifiable domain changes, export the workspace and retain the file.
   Verify saved workflow stages/linked receipts are included and unsaved edits,
   running timers and the independent SDK session are excluded.
2. Change or Reset that module, import its file, inspect the preview and cancel.
   Verify cancellation preserved the destination. Import again and explicitly
   confirm the named replacement; refresh and verify the backed-up records return.
3. Repeat at another browser/origin to verify file portability, independent
   destination saving and absence of account/server requests.
4. Give one portal another module’s file, malformed JSON, unsupported envelope
   versions, invalid nested records and an oversized file. Each rejection must
   preserve current records and display the failure.
5. Verify a replacement save failure preserves the prior in-memory workspace
   and browser snapshot. Successful import must not change the other two portals.
6. Inspect plain-text exports with the expectation that the complete fictional
   workspace includes private drafts/answers/receipts, independent of the current
   role projection. Schema acceptance does not prove provider execution.

Import performs full replacement, not merging. Export the destination first if
its records must be retained. See [Template Portals](Template-Portals.md#back-up-restore-or-move-a-workspace)
for the user-facing steps and portability limits.

### Earlier native HR, CMS and CRM persistence checks

Automated verification: **116 HR tests and 36 portal/storage tests passed**
(152 total).

Read the [persistence QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-PERSISTENCE-QA-2026-10-14.md)
for this update’s browser and automated results. The older talent, connected-HR
and four-flow receipts below preserve their own checkpoints.

**Selected browser results — 2026-10-14:** all three native portals passed
same-origin refresh and isolated Reset checks.

| Area | Observed result |
| --- | --- |
| HR hire/onboarding/payroll | Refresh restored Casey as the fourth person, then completed onboarding `MOCK-ONBOARDING-0001`. Submitted eight hours and prepared payroll restored at their checkpoints; submitted `MOCK-PAYROLL-0003` restored $240 gross/$48 illustrative withholding/$0 benefits/$192 net. |
| HR benefits/performance/survey | Refresh restored Avery’s health enrollment `MOCK-BENEFIT-0004`, goal progress 40% and saved self-review draft. A saved survey rating 4/text restored; submitted `MOCK-SURVEY-0003` remained locked after refresh. |
| CMS | Saved revision 2 restored, then separate review/approval/publication `MOCK-CMS-0004` restored. Saved draft revision 3 restored while the published projection stayed at revision 2. |
| CRM | Created lead restored; qualification/conversion and the $1,500 won deal restored with $6,500 open pipeline, three companies, three contacts and six successful actions. |
| Navigation and reset isolation | HR restored after SDK preview and About/back. All three module Reset→refresh checks restored only the chosen fixtures and preserved the other modules’ saved records. |

These observed UI paths do not replace the separate malformed-save,
storage-failure and direct domain tests. Follow the current receipt for the
final gate totals and scope.

Verify each native module at the same browser origin:

1. Complete saved domain actions, record their IDs/counts, refresh, and confirm
   the corresponding records and workflow stage return. Unsaved form fields and
   active timers are outside the restoration guarantee.
2. Leave for an ordinary page and return; for HR also visit `/hr/demo/sdk` and
   return. Native data should restore independently of SDK sample state.
3. Reset one module, refresh, and verify only that module returns to fixtures;
   the other two retain their saved domain changes.
4. Verify visible fallback/recovery notices for blocked/unavailable storage and
   malformed or unsupported snapshot versions. A failed write must not make a
   claim that changes were saved across refresh.
5. Verify that changing role projections does not grant real authentication or
   provider access. All local saved data remains inspectable by the browser user.

Storage is versioned and separate per module. Private browsing, site-data
clearing and a different scheme/hostname/port can remove or hide saved samples.
Multiple tabs do not merge updates live; the last successful write wins. Test
with fictional data only. No local persistence result establishes production
server storage, membership enforcement, managed backup/retention or provider execution.

### Talent wave verification

The recruiting, performance and survey modules have their own test and
browser evidence. Review sequential candidate stages and atomic hire-to-native
onboarding, self/direct-manager review authorship, private draft projections,
identified submitted-only survey results, duplicate/final-state guards and
role-scoped dashboard counts. Use fictional `.invalid` candidate emails and
feedback. Do not infer this wave's test total or browser acceptance from the
historical 70-test checkpoint below. The earlier talent
[talent/CMS/CRM QA record](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-TALENT-QA-2026-10-14.md)
records the separate results.

The earlier talent checkpoint passed **129 model tests**:

| Suite | Tests |
| --- | ---: |
| HR, including talent and hire integration | 109 |
| CMS | 10 |
| CRM | 10 |

The HR total includes the earlier 70 checks plus four talent insight cases,
eight recruiting, six hire-to-HR integration, ten performance and 11 survey
cases. Browser results remain separately scoped in the QA receipt.

That earlier talent browser checkpoint included:

- Casey's mock hire connected to native directory/onboarding.
- Private self/manager review drafts stayed behind their projection gates before
  publication and employee acknowledgment.
- Identified survey ratings 5 and 3 produced 2/2 submissions and mean 4; private
  drafts contributed zero results and closure produced `MOCK-SURVEY-0007`.
- CMS returned revision 2 for feedback, approved/published revision 3
  (`MOCK-CMS-0007`), preserved that publication while revision 4 changed, required
  new review before replacement publication, and removed the retired article.
  Viewer mutation controls were absent and duplicate slugs were refused.
- CRM qualified/converted a lead once, advanced $1,500 through discovery,
  proposal and negotiation to won, and completed follow-ups. Riley's dashboard
  showed $2,500 open/$1,500 won/0 follow-ups. Owner conversion reused a compatible
  company; representatives could not see foreign-owner records and auditor
  mutation controls were absent.
- Shared navigation preserved a CMS draft, HR's four people and CRM's $1,500 won
  value. Reset CMS removed only its draft, leaving HR and CRM intact.
- Casey completed native onboarding and the eight-hour October 15 payroll
  journey: `MOCK-PAYROLL-0003` and own statement matched $240 gross, $48
  illustrative withholding, $0 benefit and $192 net.

These observations do not establish real staff review, anonymous feedback,
external publication, provider execution or production acceptance.

Run the independent CMS/CRM model suites with:

```bash
npm run portals:test
```

These cover exact CMS revision/approval/publication and CRM owner/relationship
scope, conversion, opportunity stages and task transitions. Browser acceptance
must also verify cross-portal record preservation, isolated Reset and full
reload behavior. Read [Template Portals](Template-Portals.md) for the workflows.

### Earlier portal automated checks

At that checkpoint, `npm run hr:test` passed **70 tests**:

| Group | Tests |
| --- | ---: |
| Native model/workflow | 17 |
| People operations and PTO | 9 |
| Scoped insights and pay statements | 7 |
| Linked policy/training assignments | 7 |
| HR service desk | 5 |
| SDK-client mock contracts | 11 |
| Optional backend boundaries | 14 |

These checks cover the added leave/assignment/asset flows, scoped activity,
dashboard/report projections, employee pay statements, per-employee payroll caps
and request lifecycle. Native and SDK datasets remain separate. Browser
acceptance is recorded independently in the
[portal QA record](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL-QA-2026-10-14.md);
an automated pass is not evidence of provider execution or deployment.

### Earlier portal browser verification — 2026-10-14

The earlier [portal QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL-QA-2026-10-14.md)
records the native combined run after a full reload, using fictional data with
Firebase initialization disabled:

- Policy/training links updated their explicit assigned tasks without completing
  unrelated onboarding. Non-tax document acknowledgment and scoped asset return
  worked; employees could not confirm the return themselves.
- October 19–20 displayed/submitted 16 leave hours. Reservations, overlap refusal,
  rejection, approval and cancellation reconciled the final vacation balance to
  40 hours.
- The employee/manager service lifecycle preserved seven actions through reopen
  and a second resolution; another employee saw no request.
- `MOCK-PAYROLL-0003` and Avery's own pay statement matched $240 gross, $48
  illustrative withholding, $25 benefit and $167 net. The owner report reconciled
  consumed time, payroll and leave decisions; Jordan saw no statement, and
  auditor reports/history exposed no amounts or payroll controls.

This verifies the selected native host paths. The SDK UI was not rerun, and no
provider request, deployment, legal form, insurance or real payroll acceptance
was established. The earlier 41- and 39-test receipts remain historical.

### Earlier native browser verification — 2026-10-14

The dated receipt records **41 passing HR tests**: 16 native model/workflow,
11 SDK-client mock and 14 optional backend boundary tests. On macOS Apple
Silicon, the native browser check verified:

- Jordan's approved eight hours remain excluded until onboarding is completed
  and the directory reads Active. A changed work email invalidates pending
  profile/summary review.
- Unconfirmed retirement elections are ignored. Confirming after preparation
  preserves the frozen $192 net; preparing again captures the confirmed plan,
  producing $240 gross, $48 illustrative withholding, $25 benefit deduction and
  $167 net in `MOCK-PAYROLL-0004`.
- Avery's confirmed waiver and approved eight hours produce $192 net in
  `MOCK-PAYROLL-0007`, excluding Jordan's receipted hours and enrollment.
- Timers bind their employee, role and original date. Identity/role changes and
  Reset cancel them; a normal stop retains the original work date.

Model regression checks also cover unchanged profile saves and contact edits
after completed hiring, preserving accepted history in both cases.
These are linked native mock results with Firebase initialization disabled.
The SDK sample retains separate state; its onboarding/payroll UI was not
retested in this session. The historical October 13 39-test receipt remains
unchanged. Neither receipt establishes real provider, tax, benefits or production
acceptance, and this update retains version **3.4.0**.

For a browser check, run Vite development and open `/hr/demo` and `/hr/demo/sdk`.
The SDK 0.56.6 preview uses genuine directory, administrative onboarding and
payroll execution components with development-only mock reads and writes.
The mock API is absent from Hosting and `npm run preview`.
Saved native HR actions restore from the versioned browser-local snapshot
after same-origin refresh; the SDK sample state remains independent. Other SDK
workflows, authorized Demo integration, protected connected portals and live
payroll require their own evidence. The optional Firebase adapter is disabled by
default. See [Gusto HR and Employee Management](Gusto-HR-and-Employee-Management.md)
and [Gusto setup](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md).

## Unit / component tests (Vitest + Testing Library)

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: { environment: 'jsdom', setupFiles: ['./vitest.setup.ts'], globals: true },
})
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
```

Run them:

```bash
npm test              # retain the LAN suite
npx vitest run        # after installing the optional Vitest stack
```

## End-to-end tests (Playwright)

```bash
npm install -D @playwright/test
npx playwright install chromium
npx playwright codegen http://127.0.0.1:5173    # use the printed port if it moves
```

SYSTEMX also exposes package shortcuts:

```bash
npm run browser:install
npm run browser:codegen
npm run mcp:chrome
npm run ai:standard:check
```

Use Playwright for repeatable local browser flows and Chrome DevTools MCP for
live browser inspection, console/network evidence, screenshots, and popup
diagnostics. Keep the target on localhost, emulators, or staging by default.

`playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  use: { baseURL: 'http://localhost:5173', trace: 'on-first-retry' },
})
```

Example smoke test (`tests/smoke.spec.ts`):

```ts
import { test, expect } from '@playwright/test'
test('home renders + no console errors', async ({ page }) => {
  const errors: string[] = []
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto('/')
  await expect(page).toHaveTitle(/.+/)
  expect(errors, errors.join('\n')).toHaveLength(0)
})
```

## Accessibility & security gates

```bash
npm install -D @axe-core/playwright    # a11y assertions inside e2e
npm audit                              # dependency vulnerabilities
```

## Wiring into local verification

Run the test stages locally before deploy:

```bash
npm run ci:test             # runs the checked-in LAN characterization suite
npm run browser:install
npx playwright test         # after adding a project Playwright suite
npm run ci:security
npm run build
```

## Verification gate

```bash
npm test                 # SYSTEMX LAN characterization green
npx vitest run           # optional component suite
npx playwright test      # optional project e2e suite
```

## Testing rules of thumb

- Use **test-mode** credentials and the **emulator suite** for e2e — never prod
  data.
- Keep a **rules unit test** (`@firebase/rules-unit-testing`) in the suite to
  catch data-exposure regressions.
- Run `npm audit` + secret scanning on every PR.
- Treat e2e fixtures/tokens as secrets — inject through local secret files or
  your chosen deployment platform, not the repo.
- Identify your **critical-path** journeys (auth, core CRUD, checkout) and ensure
  each has e2e coverage.
- If a popup, account prompt, or tool apply dialog blocks automation, record the
  blocker in the SYSTEMX recovery format instead of silently clicking through.


## Full-goal foundation publishing gates — 2026-10-15

The corrected foundation source passed full `npm run ci:all`, including its then-current 34
stages and 7 smoke / 9 keyboard / 9 foundation browser checks. Each browser
report confirmed owned resources closed. Hosting preflight and final drift,
checklist, generated-plan, template, whitespace and link checks passed.
The [foundation QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/EXECUTION-FOUNDATION-QA-2026-10-15.md)
retains the discovered failures, fixes, suite counts and five filesystem skips.
At that checkpoint the catalog held 24 completed / 976 remaining. The full goal
remains active; use `npm run backlog:summary` for current counts.
Preflight left app version 3.4.0 and deployment count 0.
