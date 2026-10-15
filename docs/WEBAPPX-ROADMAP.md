# WebAppX roadmap and 1,000 improvement items

The owner authorized completion of the full **1,000-item catalog** on
**2026-10-15**. The [execution plan](WEBAPPX-EXECUTION-PLAN.md) now sets the
full goal, complete area coverage, dependency-ready selection and acceptance
rules. Canonical `todo`/`done` status and evidence remain in the original JSON;
its proposal-origin metadata and source baseline are retained for traceability.

Implementation proceeds through dependency-aware waves across all 20 areas.
Every item must meet its original acceptance criterion before completion.
Provider/operator items are reviewed individually: local plans and disabled
contracts can be built now, while actual platform/provider observations require
the named environment. Activation and deployment remain specific operator
acceptance steps. Reusable SYSTEMX adoption seeds stay blank; the host execution
plan records this public template's work.

## Current lifecycle checkpoint — locally accepted

The [lifecycle guide](PORTAL-LIFECYCLE.md),
[implementation plan](PORTAL-LIFECYCLE-IMPLEMENTATION-PLAN.md),
[detailed HR contract](HR-LIFECYCLE-IMPLEMENTATION-PLAN.md) and
[current QA receipt](PORTAL-LIFECYCLE-QA-2026-10-15.md) cover HR employment
instances/transfers/offboarding/rehire/corrections/templates, CMS release bundles
and CRM ownership. App source is integrated at `458a045`, followed by harness-only
`fdf6012`. Run `npm run browser:portal-lifecycle` after normal setup.

The standalone native result is **20/20 checks/check groups**, with a separate
inventory of **46 new status meanings, 22 accessible-name audits, 129 control
boxes, 20 literal input-value probes and 22 Tab probes**. Targeted keyboard
**9/9** and quality **6/6** checks passed after documented harness corrections.
**Current verification is complete: all 62 CI stages and 180 browser
checks/check groups passed** on committed source
`fdf60124e49659e9c33d30db59e45ff8369a38e1`, with terminal CI exit 0. Hosting
preflight passed on the same final runtime before the harness-only commit;
deployment was skipped. Agent 0 accepted **WX-0101–WX-0110, WX-0314–WX-0316,
WX-0379–WX-0381 and audited WX-0467/WX-0487**, eighteen original local criteria.
The canonical catalog records **109 done / 891 remaining**: **70 P1, 665 P2 and
156 P3**, with **724 local, 127 operator and 40 provider** gates remaining.
Source and wiki publication require separate direct remote parity checks.

The [next recruiting plan](RECRUITING-LIFECYCLE-IMPLEMENTATION-PLAN.md) proposes
WX-0201–WX-0210; their implementation has not begun. Source, standalone execution,
integrated gates and catalog acceptance remain separate.

## Historical accepted checkpoint — portal safety and recovery

At that historical checkpoint the catalog recorded **91 done / 909 remaining**: **82 P1, 670 P2 and 157 P3**,
with **742 local, 127 operator and 40 provider** gates remaining. Agent 0
accepted fourteen original local criteria covering unsaved navigation, CMS
restored-editor comparison, opt-in import/Reset checkpoints, structured restore
differences, accessible control names, monochrome statuses, x-large text,
recovery guidance/drills, owned preview processes and populated import preservation.

Read the [implementation plan](PORTAL-SAFETY-IMPLEMENTATION-PLAN.md),
[safety QA receipt](PORTAL-SAFETY-QA-2026-10-15.md),
[state contract](PORTAL-STATE-CONTRACT.md) and
[status inventory](PORTAL-STATUS-INVENTORY.md). The receipt records integrated
publication gates separately from local criteria acceptance. All earlier totals
below retain their historical scope; query the canonical catalog for current status.

The current lifecycle section above supplies that subsequent wave's accepted
local verification boundary. The full goal remains active until all 1,000 original
criteria have accepted evidence.

## Open the list

| Format | Use |
| --- | --- |
| [Full execution plan](WEBAPPX-EXECUTION-PLAN.md) | Current goal, twenty workstreams, derived progress, dependency frontier and resume commands |
| [All 1,000 improvement items](backlog/WEBAPPX-1000-TODO.md) | Read by area, ID and priority; each item has a specific acceptance check and source pointer |
| [Canonical JSON](backlog/webappx-1000-todo.json) | Edit proposals and inspect structured dependencies, phases, acceptance gates and completion evidence |
| [CSV](backlog/webappx-1000-todo.csv) | Filter or review in a spreadsheet without changing the canonical catalog |
| [JSON schema](backlog/webappx-backlog.schema.json) | Inspect the portable data contract; the CLI also checks ordering, uniqueness, source paths and dependencies |
| [SYSTEMX host pointer](../.SYSTEMX/WEBAPPX-ROADMAP.md) | Resume planning without loading all 1,000 items into an agent's context |

```bash
npm run backlog:summary
npm run backlog -- --area mock-recovery --priority P1 --status todo --limit 10
npm run backlog -- --status done --limit 10
npm run backlog -- --id WX-0151
npm run backlog:render
npm run backlog:check
```

`backlog:render` regenerates Markdown and CSV from JSON. `backlog:check` is part
of `ci:all`; it requires exactly 1,000 sequential IDs, 20 groups of 50, unique
titles and acceptance checks, valid existing repository sources, earlier-ID
dependencies, completion metadata and synchronized generated views. Summary
output reports the total, `todo`/`done` counts, all priority counts and remaining
TODO priority counts. Queries read local files and do
not create tasks, contact providers, install tools or start workers.

## Record verified completion

The catalog keeps the original ten proposal fields. A `todo` item has no
`completion` field. Mark an item `done` only after reviewing its original
acceptance criteria and evidence, and add exactly these completion fields:

| Field | Required value |
| --- | --- |
| `verifiedOn` | An actual calendar date in `YYYY-MM-DD` form |
| `sourceBase` | The reviewed 40-character lowercase Git source base |
| `evidence` | An existing repository-relative evidence file that resolves inside this repository |
| `reviewedBy` | `agent.0` or `user` |

`backlog:check` rejects missing or extra metadata, impossible dates, unsupported
reviewers and evidence paths that escape through traversal or symbolic links.
The JSON schema describes the portable shape; the CLI also checks actual files
and calendar dates. Markdown renders completed items with `[x]`, followed by the
verification date, source base, reviewer and evidence link. CSV adds one
`completion` column containing the exact JSON metadata object for completed
items and an empty cell for proposals; the other ten columns retain their
original values. CSV remains a generated review export rather than an import API.

A completion record has the scope of its linked evidence and acceptance gate.
Local synthetic verification does not establish provider access, deployment,
operational readiness or permission to activate optional services. Recording
completion does not populate the reusable SYSTEMX ledger or start agents.

The first P1 batch is complete: **WX-0051**, the shared portal registry, and
**WX-0451**, the restore storage-budget preview. The
[QA receipt](PORTAL-REGISTRY-BUDGET-QA-2026-10-14.md) records their accepted local
scope. The next wave completes **WX-0001**, the developer prerequisite report,
**WX-0652**, the automated HR/CMS/CRM browser smoke, and its named seed-pack
dependency **WX-0651**. See the
[developer/browser receipt](DEVELOPER-BROWSER-QA-2026-10-14.md) for exact local
coverage. At that historical foundation checkpoint the catalog had **1,000 records: 24 done and 976 TODOs**, including
**146 P1, 673 P2 and 157 P3 TODOs**. Use `--status done` to inspect accepted
results and `--status todo` to choose the next bounded batch.

```bash
npm run doctor
npm run --silent doctor -- --json
npm run browser:install
npm run browser:smoke
```

The developer report performs bounded local version probes. The browser command
uses the reviewed synthetic seed, its own available loopback port and fresh
Chromium contexts, then changes one domain record per portal through the UI and
verifies complete payloads after refresh. It saves local evidence in a temporary
directory and closes owned resources. `ci:all` includes both focused guard suites
and the browser journey; install the pinned Chromium binary explicitly first.

## Keyboard P1 completion — 2026-10-15

**WX-0653** and **WX-0654** are complete for keyboard-only onboarding and
selective restore/Undo. `npm run browser:keyboard` passed nine browser checks;
`npm run browser:keyboard:test` passed 11 focused guard tests. The journeys
check visible focus, required fields, cancellation, exact Undo opener return,
retention fallback, complete saved/exported records and refresh persistence.
See the [keyboard QA receipt](KEYBOARD-PORTALS-QA-2026-10-15.md) for the accepted scope
and harness boundaries. Both commands are included in `ci:all`; the existing HR/CMS/CRM smoke remains a separate gate.

## Planning phases

| Phase | Intended outcome | Acceptance boundary |
| --- | --- | --- |
| `foundation` | Clear setup, shared portal contracts, state/recovery boundaries and dependable local development | Reproducible local commands and synthetic fixtures |
| `portal-maturity` | Deeper HR, CMS and CRM workflows with explainable transitions and consistent interfaces | End-to-end local mock journeys and preserved records |
| `production-readiness` | Optional adopted-app identity, data, operations and delivery controls | App-specific emulator/provider/operator evidence, reviewed separately |
| `extensions` | Optional adapters, richer content/customer models and locale support | Module-specific contracts, failures and documented adoption decisions |

P1 marks candidates to review first; P2 covers subsequent maturity and P3 optional
expansion. Priority is a proposed sequencing aid, not proof of a defect or a
deadline. Dependencies refer to earlier catalog IDs. Verification dates and
completion claims require reviewed evidence; the planning list supplies no
budgets, assigned staff or production credentials.

## Coverage

Each area contains 50 proposals:

| Area | IDs |
| --- | --- |
| Project setup and developer experience | WX-0001–WX-0050 |
| Shared portal architecture | WX-0051–WX-0100 |
| HR onboarding and directory | WX-0101–WX-0150 |
| HR payroll, benefits and time | WX-0151–WX-0200 |
| HR talent and employee operations | WX-0201–WX-0250 |
| CMS models and authoring | WX-0251–WX-0300 |
| CMS review and publication | WX-0301–WX-0350 |
| CRM leads and contacts | WX-0351–WX-0400 |
| CRM sales and service | WX-0401–WX-0450 |
| Mock persistence, backup and recovery | WX-0451–WX-0500 |
| Identity, membership and permissions | WX-0501–WX-0550 |
| Firebase data, functions and rules | WX-0551–WX-0600 |
| Security and privacy | WX-0601–WX-0650 |
| Testing, quality and accessibility | WX-0651–WX-0700 |
| Design, responsiveness and interaction | WX-0701–WX-0750 |
| Observability, support and operations | WX-0751–WX-0800 |
| CI, delivery and infrastructure | WX-0801–WX-0850 |
| SYSTEMX and agent workflows | WX-0851–WX-0900 |
| Documentation and adoption kits | WX-0901–WX-0950 |
| Optional integrations, extensibility and internationalization | WX-0951–WX-1000 |

Existing account-free HR onboarding/payroll/benefits/time, talent workflows,
CMS review/frozen publication, CRM conversion, browser persistence, individual and
combined backups, selective restore and automatic restore points/Undo are the
implemented baseline. These proposals extend or verify that baseline; listing
future work is not a retraction of the earlier scoped QA receipts.

## First candidates to review

Start with a small local batch, then reassess the dependent portal work:

| Proposal | Review outcome |
| --- | --- |
| WX-0001 | Completed: read-only developer prerequisite report; see the developer/browser receipt |
| WX-0051 | Completed: typed shared portal registry; see the P1 QA receipt |
| WX-0451 | Completed: storage-budget preview; see the P1 QA receipt |
| WX-0652 | Completed with WX-0651: automated cross-portal browser smoke; see the developer/browser receipt |
| WX-0151 | Selectable fictional payroll periods |
| WX-0280 | CMS draft field validation summaries |
| WX-0371 | Atomic fictional CRM contact merges |
| WX-0852 | Source-change impact reports for rebaselining proposals |

This shortlist is a review order. Inspect each proposal's prerequisites and
source before accepting a task; no work starts from this table automatically.

## Select bounded work with SYSTEMX

1. Query one area and inspect the source and acceptance criteria for a small
   group of proposals. Check whether they are still needed at the current revision.
2. Review dependencies, write scope, module applicability and the acceptance
   gate with the adopting project's owner. Keep provider, infrastructure and
   operational activation explicit; a backlog item is not authorization.
3. In an adopted app, create only the selected canonical tasks in its outer
   `.SYSTEMX/WORK/TASKS.json` using the selected release's task commands. Link
   the `WX-` proposal IDs in task descriptions or evidence instead of copying
   every proposal into agent memory.
4. Give Agent Y one reviewed assignment, installed provider, exact source base,
   allowed paths and branch/PR policy. Agent 0 integrates; record actual evidence
   and review acceptance before marking canonical tasks complete.
5. Reassess remaining proposals after a feature lands. Neither a checked
   document nor a successful CLI process proves deployment/provider acceptance.

The reusable template's context, master plan, task ledger, project memory and
agent memory remain blank adoption seeds. The catalog uses `todo` for proposed
work and `done` for evidenced completion; it is not an active SYSTEMX ledger and does not register agents,
start a scheduler or enqueue 1,000 jobs.

## SYSTEMX refresh in this update

The installed **1.9.0-alpha.6** distribution remains the latest public release.
Public `main` `3fb59429c878268f1081ca255a1f32fafc5dcfba` changed only README/wiki
content outside `.SYSTEMX` after the original import. Its complete `.SYSTEMX`
tree matches the original receipt commit, so no import application is needed.
The updater now recognizes that case while preserving the original receipt.
See [managed integration](SYSTEMX-INTEGRATION.md) and the
[refresh/roadmap verification receipt](SYSTEMX-ROADMAP-QA-2026-10-14.md).

## Full-goal foundation checkpoint — 2026-10-15

The [foundation QA receipt](EXECUTION-FOUNDATION-QA-2026-10-15.md) records the
seventeen newly accepted IDs, runtime/environment contracts, isolated mock
startup, portal shell behavior, source-derived CI report and dependency graph.
The [existing-feature acceptance review](EXISTING-FOUNDATION-ACCEPTANCE-2026-10-15.md)
closes four exact baseline criteria and leaves WX-0717 pending its prerequisite.
The execution plan and checklist derive their current twenty-area counts and
next dependency-ready candidates from the same JSON. The full goal remains
active; a published wave does not finish the other 976 criteria.
