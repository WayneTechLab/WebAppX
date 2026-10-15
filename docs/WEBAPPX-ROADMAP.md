# WebAppX roadmap and 1,000 improvement items

This is a planning catalog for improving the public WebAppX template from source
baseline `8359285c99069349d6218fe871868baab76868e5`. It contains exactly **1,000
catalog items across 20 areas**, with 50 items in each area. Their `todo` or
`done` status distinguishes remaining proposals from reviewed completion. It does not
claim that every proposal is a required feature, an existing defect, or accepted
implementation scope. Recheck its source pointers and current implementation
before selecting work; some proposals may become unnecessary after another
change. Optional product modules are selected by an adopting app's owner.

## Open the list

| Format | Use |
| --- | --- |
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
scope. Exactly **1,000 catalog records** remain, with **2 done and 998 TODOs,
including 164 P1 TODOs**. Use `--status done` to inspect accepted results and
`--status todo` to choose the next bounded batch.

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
| WX-0001 | Read-only developer prerequisite report |
| WX-0051 | Completed: typed shared portal registry; see the P1 QA receipt |
| WX-0451 | Completed: storage-budget preview; see the P1 QA receipt |
| WX-0652 | Repeatable automated cross-portal browser smoke journey |
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
