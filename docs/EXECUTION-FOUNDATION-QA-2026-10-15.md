# Full backlog goal and foundation execution — 2026-10-15

The owner expanded the goal from individual P1 batches to completion of every
original acceptance criterion in the 1,000-item WebAppX catalog. This wave starts
from clean `main` at `0469e11bcb17ec67b118099a73958e039c759979`, verified against
direct GitHub main. The active goal remains open until all items are accepted.

## Goal and plan

The [execution plan](WEBAPPX-EXECUTION-PLAN.md) derives progress from the canonical
JSON and partitions every ID exactly once across twenty workstreams and ten
execution waves. It retains original IDs, acceptance text, source baseline and
gate fields. No copied status ledger is maintained in the blank SYSTEMX seeds.

```bash
npm run backlog:plan
npm run backlog:ready -- --limit 20
npm run backlog:ready -- --gate all --priority P1 --limit 30
npm run backlog:graph -- --id WX-0317 --id WX-0551
npm run backlog:plan:render
npm run backlog:plan:check
```

Read-only reports compute ready candidates from completed dependencies and show
the selected dependency closure, edges, exact longest-chain counts and unresolved
nonlocal acceptance criteria. Examples are capped at ten while exact counts use
integer arithmetic, including graphs with more paths than a JavaScript safe
integer can represent. Reports never dispatch workers, accept proposals, read
credentials or contact providers. The explicit render command writes the plan.
Catalog validation now rejects a done entry with an unfinished prerequisite.

The original graph has 173 edges. Provider/operator labels remain unchanged and
are interpreted against each full criterion. Many request locally deliverable
plans, contracts or disabled adapters; those can proceed. Actual provider or
Windows observations require the corresponding environment, and remain
unfinished until that evidence exists. The full goal does not make an empty
queue, worker result or local fake equivalent to acceptance.

## Foundation implementation

| Items | Implemented acceptance |
| --- | --- |
| WX-0002 | Root/starter `.nvmrc` and `.node-version` select Node 24.22.0; both declare Node >=24.0.0 and npm@11.11.0. Setup instructions describe selecting the pin and supported minimum. |
| WX-0003 | Public metadata maintenance detects root/starter engine/package-manager drift, lock root engine drift, inconsistent pins and divergence from the prerequisite doctor's minimum. |
| WX-0004 | A read-only checker compares documented/source client environment names, TypeScript declarations and public examples/explicit optional markers. It never loads local environment or secret files. |
| WX-0005 | The app shows an unset-Firebase notice explaining account-free HR/CMS/CRM availability, the optional `.env.local` sign-in setup and portal/setup links. |
| WX-0006 | The native mock launcher uses Node builtins plus already-installed app dependencies, child-only integration scrubbing, no dotenv/project Vite proxy/provider middleware, its own loopback listener/cache and owned shutdown. |
| WX-0052 | Portal cards and navigation render the same registry identities, descriptions, workflows, roles and destinations. Existing registry derivation was verified rather than duplicated. |
| WX-0053 | Path matching normalizes supported trailing-slash/deep links while preserving the requested query/hash location. |
| WX-0054 | Unsupported HR/CMS/CRM descendants show the correct workspace-specific recovery and directory links without changing domain saves. |
| WX-0055 | Shared breadcrumbs link directory, HR workspace and role roots; deep employee breadcrumbs are keyboard reachable with visible focus. |
| WX-0057 | Native portals display one shared fictional/account-free notice and data-handling explanation. In-app navigation preserves mounted transient state and focuses/scrolls its destination. |
| WX-0058 | Directory cards derive Ready/Saved/Recovered/Unavailable summaries and messages from each actual persistence provider. |
| WX-0801 | `ci:plan` reads the real runner/package declarations and prints all stages, root/Gusto/SYSTEMX dependencies, implicit hooks and reviewed mutation behavior without executing gates. |
| WX-0853 | The selected dependency view renders Mermaid edges, longest tied chains and unresolved external criteria without assigning work. |

[Runtime contracts](DEVELOPMENT-CONTRACTS.md) identify the official Node release
source checked for the pin. This wave verifies declarations and tests on the
existing macOS Apple Silicon host; it does not claim executing Node 24.22.0 or
Windows solely because those pins exist.

The [existing-foundation review](EXISTING-FOUNDATION-ACCEPTANCE-2026-10-15.md)
separately accepts **WX-0042, WX-0452, WX-0783 and WX-0932** for their original
first-run, retention-preview, origin-transfer and keyless-mock documentation
criteria. It records a fresh 12-case retention test and accurately scoped prior
keyboard evidence. **WX-0717 stays TODO** because its broader prerequisite
WX-0708 remains unfinished.

## Focused verification

- Native mock launcher: **14 tests passed**, including actual cold main-module
  startup, disabled inherited integrations, occupied-listener preservation,
  failed/signal exits and shared import-drain/server/cache cleanup.
- Development contracts: **15 tests passed**, including negative metadata/pin/
  environment fixtures and proof that ignored environment files are not read.
- Execution planner: **8 tests passed**, covering dependency order, original
  external criteria, exact cycle paths, tied and 2^60 branching paths with
  bounded output, CLI rejection, complete ID coverage and byte-preserved source
  and blank adoption records after actual report invocations.
- Catalog validation: **14 tests passed**, including the new unfinished-
  prerequisite rejection and existing completion/evidence-path checks.
- CI plan: **13 tests passed**; current report enumerated all **34 required
  stages**, with **no unknown command classifications**. A changed/unreviewed
  command becomes unknown. Registry audits and build/temp writes are reported
  honestly, including the nested security-stage npm audit.
- Shared portal model coverage: **121 tests passed**, including thirteen registry,
  route and save-summary cases.
- Foundation browser: **9 checks passed**, covering the Firebase notice, all
  registry fields/links, preserved trailing-slash/query/hash destinations,
  keyboard breadcrumbs, unknown-route recovery, unsaved CMS state/document
  preservation, save/refresh summaries and isolated corrupted/denied-storage
  faults. Normal edits use rendered controls; storage fault injection is
  explicitly separate from ordinary workflow assertions.
- Existing keyboard browser: **9 checks passed** after the shared-shell change,
  preserving exact onboarding/restore/Undo records and focus behavior.
- The browser runs reported no unexpected backend/provider traffic, failed
  requests or uncaught errors; only the expected unset-Firebase warning appeared.
  Owned browser/server cleanup succeeded. The directory screenshot was visually
  inspected for the setup notice, registry cards, summaries and backup/history.

## Review findings and corrections

Review found and corrected forced-signal shutdown being reported as success,
missing tied longest paths, and full-document navigation from the shared help
link. Regression fixtures now exercise the signal failure and large tied graph,
and a real browser round trip preserves the document time origin, unsaved CMS
input and raw saves. Independent source review found no remaining material issue
in those corrected paths.

An integration run subsequently exposed an intermittent cold-start shutdown
problem in the installed Vite request/optimizer lifecycle. Vite was canceling its static-import crawl before optimizer waiters resolved.
The fix drains each initialized environment through its public idle boundary
before closing; concurrent callers share one cleanup promise. Failed startup
skips the drain, while server/cache cleanup remains in finally. The original
ten-second deadline stays unchanged. A fresh root run passed all fourteen tests,
and the worker regression now requests the cold main module explicitly.
A separate concurrent launcher/foundation run also passed with cleanup confirmed.

Full CI subsequently caught a route scroll that explicitly requested smooth
motion despite the browser's reduced-motion preference. A newly focused
onboarding control could leave the viewport while that scroll was in progress.
Navigation now respects both system and saved reduced-motion settings and uses
an immediate scroll in that case. The new model regression checks both reduced
settings, the normal smooth path and unchanged query/hash/event behavior. The
focused keyboard rerun passed all nine checks after the product fix. Full CI is
rerun for the corrected source; its earlier failed run is not treated as acceptance.

## Completion checkpoint and publishing gates

Agent 0 accepted seventeen additional items: **WX-0002–WX-0006, WX-0042,
WX-0052–WX-0055, WX-0057–WX-0058, WX-0452, WX-0783, WX-0801, WX-0853 and
WX-0932**. Completion metadata links this receipt or the more specific existing-
foundation review with source base `0469e11bcb17ec67b118099a73958e039c759979`.
The generated catalog and plan now show **24 done and 976 remaining**, including
**146 P1, 673 P2 and 157 P3 TODOs**. Remaining gates are **808 local, 128
operator and 40 provider**. These counts describe progress, not full completion.
The full goal stays active and dependency-ready selection continues from JSON.

The corrected source passed **`npm run ci:all`**, all 34 stages, with exit 0.
Its component suites recorded 15 contract, 14 launcher, 13 CI-plan, eight planner,
18 prerequisite, 16 seed/runner, 11 keyboard guard, 14 catalog, 235 shared SYSTEMX
(five filesystem-specific skips), 36 host integration, eight security operations,
11 app/LAN, 116 HR and 121 portal cases. All seven smoke, nine keyboard and nine
foundation browser gates passed; their reports each confirmed owned browser and
server cleanup. Root and Gusto Functions audits reported zero vulnerabilities.
Lint, types, managed/template/research integrity, security/account/MFA/AI checks,
production build and LAN isolation passed.

The repository Markdown gate passed 733 README/SYSTEMX/wiki files. A separate
host-docs check examined all 37 Markdown files under `docs/` and 1,227 local file
links, with zero missing targets. After staging, template and whitespace checks
also passed. **Hosting preflight passed** with exit 0, skipping version/changelog/Git/push
and deployment actions. **Final host drift, catalog, execution-plan and Markdown
checks passed** after the documentation edits. Native wiki publication is
verified in the final Git handoff with the preserved-history sync command. The remaining backlog stays active. App version remains 3.4.0, deployment count 0, and selected
SYSTEMX 1.9.0-alpha.6 remains immutable. Both research inventories and reusable
context/plan/task/memory seeds remain intact.
