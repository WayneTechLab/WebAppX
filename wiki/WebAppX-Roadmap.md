# WebAppX roadmap — 1,000 improvement items

The public template has a structured catalog of **exactly 1,000 items** with
`todo` or `done` status, covering 20 areas with 50 items each. Existing HR, CMS, CRM,
persistence, backups and restore/Undo remain the implemented baseline. The list
describes future improvements and focused verification, not 1,000 completed
features, known defects or automatically authorized jobs. Completed catalog
items require reviewed evidence within their stated acceptance gate.

## Read and filter

- [Roadmap and sequencing](https://github.com/WayneTechLab/WebAppX/blob/main/docs/WEBAPPX-ROADMAP.md)
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
```

The JSON is canonical; Markdown and CSV are generated. The CI check verifies
the exact count, ordered IDs, 20 groups of 50, unique titles/acceptance, existing
source paths, earlier dependencies, completion records and synchronized views.
Summary counts distinguish TODO/done and show remaining priority counts.
Queries remain local.

## Completion and the first P1 batch

A `done` item requires exactly four completion fields: an actual `verifiedOn`
date (`YYYY-MM-DD`), the reviewed 40-character Git `sourceBase`, an existing
repository-relative `evidence` file and `reviewedBy` set to `agent.0` or `user`.
TODO items prohibit this metadata. The CLI checks calendar validity and file
resolution, including paths through symbolic links; unsupported reviewers and
missing or extra fields fail validation.

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

Exactly **1,000 records** remain in the catalog: **7 done and 993 TODOs,
including 160 P1, 675 P2 and 158 P3 TODOs**. Completion applies
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

The areas cover setup, portal architecture, three HR groups, two CMS groups,
two CRM groups, mock recovery, identity, Firebase, security/privacy, quality and
accessibility, design, operations, delivery, SYSTEMX, adoption documentation and
optional integrations/localization.

P1/P2/P3 prioritize review. The phases are foundation, portal maturity,
production readiness and extensions. Local checks use synthetic evidence;
provider and operator gates require separately approved optional environments.
Read source before activating a proposal. Create only a bounded set of canonical
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
