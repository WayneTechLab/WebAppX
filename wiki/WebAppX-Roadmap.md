# WebAppX roadmap — 1,000 improvement items

The public template has a structured catalog of **exactly 1,000 items** with
`todo` or `done` status, covering 20 areas with 50 items each. Existing HR, CMS, CRM,
persistence, backups and restore/Undo remain the implemented baseline. The owner
has authorized completing the full catalog. The active goal covers each original
acceptance criterion, and completed items require reviewed evidence within their
stated acceptance gate and accepted dependencies.

The [execution plan](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WEBAPPX-EXECUTION-PLAN.md)
partitions all stable IDs into workstreams and waves, with current counts,
dependency-ready candidates and remaining local/provider/operator criteria.
The goal remains active until every item is accepted. Host planning records this
intent while reusable SYSTEMX context, plan, task and memory seeds stay blank.

## Operational foundations checkpoint — 2026-10-15

Agent 0 accepted **WX-0650, WX-0673, WX-0677, WX-0678, WX-0700, WX-0751,
WX-0793, WX-0835 and WX-0840** against their original criteria. The catalog now
holds **42 done / 958 remaining — 131 P1, 670 P2 and 157 P3**. Remaining gates
are **790 local, 128 operator and 40 provider**. The prior session/contracts
checkpoint held 33 done / 967 remaining and passed its then-current 38 CI stages;
that historical receipt retains its examined revision and scope.

New focused commands are `environment:check` / `environment:test`,
`repository:identity` / `repository:identity:test`, `browser:payroll` and
`browser:lifecycles`. Focused verification passed 22 environment and 26 repository
tests, eight payroll browser checks and twelve CMS/CRM browser checks.
All **43 CI stages, 56 browser checks and Hosting preflight passed**, with
owned browser/server cleanup.
Use the [operational QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/OPERATIONAL-FOUNDATIONS-QA-2026-10-15.md)
for the final gate results and [Testing & QA](Testing-and-QA.md#operational-foundations-and-complete-portal-lifecycles)
for command behavior and evidence limits.

The payroll fixture reconciles two employees at 17.75 hours, $532.50 gross and
$401 net; CMS checks a complete frozen public preview after later draft edits;
CRM distinguishes rendered conversion prevention from its explicit browser-module
replay probe against a detached actual download. Public environment example
validation supplies no runtime enforcement, and the read-only repository receipt
accepts `clean-ahead` as an observation without granting publication authority.
The [QA coverage map](https://github.com/WayneTechLab/WebAppX/blob/main/docs/QA-COVERAGE-MAP.md),
[security assumptions](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SECURITY-ASSUMPTIONS.md),
[command effects](https://github.com/WayneTechLab/WebAppX/blob/main/docs/COMMAND-SAFETY.md)
and [health vocabulary](https://github.com/WayneTechLab/WebAppX/blob/main/docs/MONITORING.md)
retain the source, local, provider and deployment boundaries. Existing human
authorization remains applicable; every unfinished criterion keeps its original
acceptance requirements.

## Read and filter

- [Roadmap and sequencing](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WEBAPPX-ROADMAP.md)
- [Full execution plan](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WEBAPPX-EXECUTION-PLAN.md)
- [Complete 1,000-item list](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/WEBAPPX-1000-TODO.md)
- [Canonical JSON](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/webappx-1000-todo.json)
- [Spreadsheet CSV](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/webappx-1000-todo.csv)
- [SYSTEMX host planning pointer](https://github.com/WayneTechLab/WebAppX/blob/main/.SYSTEMX/WEBAPPX-ROADMAP.md)

Every item has a stable `WX-0001`–`WX-1000` ID, priority, phase, specific
acceptance check, existing source pointer, acceptance gate and dependencies.

```bash
npm run backlog:summary
npm run backlog -- --area mock-recovery --priority P1 --status todo --limit 10
npm run backlog -- --status done --limit 10
npm run backlog -- --id WX-0151
npm run backlog:render
npm run backlog:check
npm run backlog:plan
npm run backlog:ready
npm run backlog:ready -- --gate all --priority P1 --limit 30
npm run backlog:graph -- --id WX-0654 --id WX-0551
npm run backlog:plan:render
npm run backlog:plan:check
npm run backlog:evidence
npm run backlog:evidence -- --id WX-0717 --category browser --limit 20
npm run backlog:evidence:check
```

The JSON is canonical; Markdown and CSV are generated. The CI check verifies
the exact count, ordered IDs, 20 groups of 50, unique titles/acceptance, existing
source paths, earlier dependencies, completion records and synchronized views.
Summary counts distinguish TODO/done and show remaining priority counts.
Queries remain local.

Plan and ready reports return JSON. Graph output includes a selected dependency
closure, longest chains and unresolved nonlocal acceptance criteria. These reports
only read the local catalog; they start no workers and change no task statuses.
The explicit plan-render command writes the generated execution document.

## Scoped evidence for pending and completed items

The [evidence index guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/BACKLOG-EVIDENCE.md)
explains review attachments in
[`webappx-evidence-index.json`](https://github.com/WayneTechLab/WebAppX/blob/main/docs/backlog/webappx-evidence-index.json).
A review retains the examined source revision, while each reference retains
its original date, revision, evidence method and limitations. Local/browser
observations do not become provider or operator acceptance when reused.

`backlog:evidence` defaults to a JSON summary. Query filters for `--id` and
`--category` combine; `--limit` ranges from 1 through 100, with a default of 20.
A known item with no attachments returns zero matches. `--markdown` emits the
complete index to stdout without writing a file. Validation checks references,
dates, revisions and known catalog IDs while preserving all completion state.

**WX-0717** demonstrates why evidence and completion remain separate: earlier
keyboard observations can support an existing-behavior review while its
prerequisite remains pending. Reading or attaching that evidence does not accept
WX-0717 or bypass its dependency. Canonical catalog completion still requires
the original criterion, accepted dependencies and Agent 0/user review.
The [session/contracts QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SESSION-CONTRACTS-QA-2026-10-15.md)
records the evidence-index and related session/portal contract checks.

## Completion and the first P1 batch

A `done` item requires exactly four completion fields: an actual `verifiedOn`
date (`YYYY-MM-DD`), the reviewed 40-character Git `sourceBase`, an existing
repository-relative `evidence` file and `reviewedBy` set to `agent.0` or `user`.
TODO items prohibit this metadata. The CLI checks calendar validity and file
resolution, including paths through symbolic links; unsupported reviewers and
missing or extra fields fail validation.
Every dependency of a completed item must itself be completed. Recording a source
base and evidence file without meeting the original criterion does not accept work.

Generated Markdown uses a checked box for a completed item and links its
evidence beside the verification date, source base and reviewer. CSV preserves
the original ten columns and adds `completion`, containing JSON for completed
items or an empty cell for TODOs. The JSON remains canonical.

The first implementation batch completed **WX-0051**, the shared portal
registry, and **WX-0451**, the restore storage-budget preview. Read the
[P1 QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-REGISTRY-BUDGET-QA-2026-10-14.md)
for that wave's accepted results.

The developer/browser wave completes **WX-0001**, the read-only prerequisite
report, **WX-0652**, the automated HR/CMS/CRM smoke journey, and dependency
**WX-0651**, its named synthetic seed pack. The
[developer/browser QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/DEVELOPER-BROWSER-QA-2026-10-14.md)
records the local version checks, exact seed hash and dashboard totals, real UI
mutations and full saved-payload comparisons after refresh. Run `npm run doctor`,
explicitly install Chromium with `npm run browser:install`, then run
`npm run browser:smoke`. The runner uses an owned loopback server and clean
contexts; it preserves existing previews and saved workspaces.

Exactly **1,000 records** remain in the catalog. Read `npm run backlog:summary`
or the generated execution plan for current completion, priority and gate counts.
Completion applies
only to the evidence's scope; it supplies no provider credentials, deployment
acceptance or permission to activate optional services. The remaining proposals
keep their individual status, and all reusable SYSTEMX task/context/plan/memory
seeds stay blank.

## Keyboard P1 completion — 2026-10-15

**WX-0653** and **WX-0654** are complete for keyboard-only onboarding and
selective restore/Undo. `npm run browser:keyboard` passed nine browser checks;
`npm run browser:keyboard:test` passed 11 focused guard tests. The journeys
check visible focus, required fields, cancellation, exact Undo opener return,
retention fallback, complete saved/exported records and refresh persistence.
See the [keyboard QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/KEYBOARD-PORTALS-QA-2026-10-15.md) for the accepted scope
and harness boundaries. Both commands are included in `ci:all`; the existing HR/CMS/CRM smoke remains a separate gate.

## Scope and activation

### Execution foundations — 2026-10-15

The current foundation wave adds runtime/environment contract checks, isolated
mock startup, shared portal routes/cards/breadcrumbs/save summaries, read-only
CI planning and dependency-aware execution reports. Read the
[foundation QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/EXECUTION-FOUNDATION-QA-2026-10-15.md)
for the accepted item IDs and their exact verification.

Agent 0 accepted **WX-0002–WX-0006, WX-0042, WX-0052–WX-0055, WX-0057–WX-0058,
WX-0452, WX-0783, WX-0801, WX-0853 and WX-0932**. Focused checks passed 15
development-contract, 14 mock-launcher, eight planner, 14 catalog, 13 CI-plan and
121 portal model tests. The actual CI report listed its then-current 34 stages without unknown
classifications. Nine foundation and nine existing keyboard browser checks
passed with successful owned cleanup. Read the receipt for final publication
gates; completing every remaining item is still the active goal.

The areas cover setup, portal architecture, three HR groups, two CMS groups,
two CRM groups, mock recovery, identity, Firebase, security/privacy, quality and
accessibility, design, operations, delivery, SYSTEMX, adoption documentation and
optional integrations/localization.

P1/P2/P3 prioritize review. The phases are foundation, portal maturity,
production readiness and extensions. Local checks use synthetic evidence;
provider and operator criteria require their own concrete environment and proof.
Many describe local designs or disabled contracts that can be prepared now.
Actual provider/platform proof remains required where the original criterion
calls for it. Read source before activating a proposal. Create only a bounded set of canonical
tasks in an adopted app, with actual acceptance and assignment. The public
template's SYSTEMX context, plan, task and memory seeds remain blank.

## SYSTEMX refresh

The selected release remains the latest **1.9.0-alpha.6**. Reviewed public main
`3fb59429c878268f1081ca255a1f32fafc5dcfba` changed only upstream README/wiki
content outside `.SYSTEMX`; its complete source tree matches the original import
commit. The host importer now recognizes that case while preserving original
receipt bytes and rejecting changed same-version trees. No import application
was needed. See [Managed SYSTEMX](SYSTEMX-Standalone-Integration.md) and the
[refresh/roadmap QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/SYSTEMX-ROADMAP-QA-2026-10-14.md).
