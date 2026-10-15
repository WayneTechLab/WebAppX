# WebAppX execution plan — complete the 1,000-item backlog

The owner authorized completion of the full catalog on **2026-10-15**.
The active goal is to implement every remaining item and verify its original
acceptance criteria. This plan covers all 1,000 stable IDs; the canonical
[catalog](backlog/webappx-1000-todo.json) owns status and evidence. The
[checklist](backlog/WEBAPPX-1000-TODO.md) and CSV remain generated views.

The separate [review index](BACKLOG-EVIDENCE.md) attaches scoped historical
receipts with examined and observation revisions. It does not accept work
or convert an earlier browser result into a current execution.

Current verified progress: **33 done / 967 remaining**.
Remaining priorities: **137 P1 · 673 P2 · 157 P3**.
Remaining acceptance gates: **799 local · 40 provider · 128 operator**.

## Execution and acceptance

1. Select dependency-ready work, starting with P1 foundations. Read the exact
   acceptance and source before assigning disjoint implementation scopes.
2. Implement complete vertical slices across data, UI, permissions, recovery
   and documentation. Review existing implementation before adding a duplicate.
3. Run meaningful focused tests and browser journeys for changed interactions.
   Compare full records and preserved scope rather than only success messages.
4. Agent 0 reviews evidence and dependencies, then records completion metadata
   in JSON and regenerates the checklist, CSV and this execution plan.
5. Publish integrated waves after full CI, Hosting preflight, host drift and
   template/link checks. Update README/wiki and verify direct GitHub parity.
6. Repeat until every original acceptance criterion is met. An empty ready
   selection, generated plan, provider design or delegated result is not completion.

Provider/operator labels require item-specific review: many request a local
design, worksheet, disabled adapter or emulator contract that can be prepared
now. Items requiring actual platform/provider proof stay unfinished until
that evidence exists. Named environments, account access and consequential
activation decisions are resolved when the concrete prepared item reaches
its acceptance boundary. Source-only or mock evidence cannot establish them.

Keep immutable managed releases, research inventories and reusable SYSTEMX
context/plan/task/memory seeds intact. This host plan records WebAppX template
work; an adopting app receives its own reviewed active records. Runtime state,
credentials and machine paths remain outside public release files.

## Complete coverage and sequencing

The ranges below partition the canonical catalog exactly once. Each area
includes P1/P2/P3 and all stated phases; dependencies take precedence over
the area order. Shared contracts precede their consumers, and browser/error
coverage ships with each slice rather than waiting for the quality area.

| Workstream | Stable IDs | Done | Remaining |
| --- | --- | ---: | ---: |
| Project setup and developer experience | WX-0001–WX-0050 | 11 | 39 |
| Shared portal architecture | WX-0051–WX-0100 | 8 | 42 |
| HR onboarding and directory | WX-0101–WX-0150 | 0 | 50 |
| HR payroll, benefits and time | WX-0151–WX-0200 | 0 | 50 |
| HR talent and employee operations | WX-0201–WX-0250 | 0 | 50 |
| CMS models and authoring | WX-0251–WX-0300 | 0 | 50 |
| CMS review and publication | WX-0301–WX-0350 | 0 | 50 |
| CRM leads and contacts | WX-0351–WX-0400 | 0 | 50 |
| CRM sales and service | WX-0401–WX-0450 | 0 | 50 |
| Mock persistence, backup and recovery | WX-0451–WX-0500 | 2 | 48 |
| Identity, membership and permissions | WX-0501–WX-0550 | 1 | 49 |
| Firebase data, functions and rules | WX-0551–WX-0600 | 0 | 50 |
| Security and privacy | WX-0601–WX-0650 | 1 | 49 |
| Testing, quality and accessibility | WX-0651–WX-0700 | 4 | 46 |
| Design, responsiveness and interaction | WX-0701–WX-0750 | 0 | 50 |
| Observability, support and operations | WX-0751–WX-0800 | 1 | 49 |
| CI, delivery and infrastructure | WX-0801–WX-0850 | 2 | 48 |
| SYSTEMX and agent workflows | WX-0851–WX-0900 | 2 | 48 |
| Documentation and adoption kits | WX-0901–WX-0950 | 1 | 49 |
| Optional integrations, extensibility and internationalization | WX-0951–WX-1000 | 0 | 50 |

Domain waves (the dependency graph overrides this order):

| Wave | Areas | Done | Remaining |
| --- | --- | ---: | ---: |
| Foundation | setup, systemx | 13 | 87 |
| Shared core | portal-shell, identity, security | 10 | 140 |
| Recovery | mock-recovery | 2 | 48 |
| Human resources | hr-onboarding, hr-payroll, hr-talent | 0 | 150 |
| Content | cms-authoring, cms-publishing | 0 | 100 |
| Customer relationships | crm-contacts, crm-sales | 0 | 100 |
| Quality and design | quality, design | 4 | 96 |
| Operations and delivery | operations, delivery | 3 | 97 |
| Adoption | adoption | 1 | 49 |
| Connected extensions | firebase, integrations | 0 | 100 |

The current graph has **173 edges**. Longest explicit chains:

- WX-0314 → WX-0315 → WX-0316 → WX-0317
- WX-0401 → WX-0404 → WX-0405 → WX-0444
- WX-0401 → WX-0407 → WX-0408 → WX-0409
- WX-0406 → WX-0407 → WX-0408 → WX-0409
- WX-0420 → WX-0423 → WX-0426 → WX-0427
- WX-0752 → WX-0753 → WX-0780 → WX-0781
- WX-0802 → WX-0813 → WX-0828 → WX-0829

Implementation stages:

- **Foundations:** runtime/environment contracts, isolated mock startup, shared
  portal navigation and save/error boundaries, recovery, test/report tooling.
- **Portal maturity:** HR onboarding/payroll/benefits/time/talent; CMS models,
  editing/review/publication; CRM contacts/leads/deals/service; shared recovery.
- **Adoption readiness:** trusted identity, Firebase contracts/emulator evidence,
  privacy/security, observability, CI/release controls and SYSTEMX adoption.
- **Extensions:** optional provider adapters, locales, integrations and platform
  rehearsals, each with its own exact acceptance and activation boundary.

## Next dependency-ready local candidates

This is computed from current canonical statuses. It does not dispatch agents
or grant access, and current write ownership must be checked before selection.

| ID | Priority / phase | Acceptance |
| --- | --- | --- |
| WX-0650 | P1 / foundation | List current reviewed-source, local-OS, emulator and provider assumptions with review dates and links to evidence rather than implied production guarantees. |
| WX-0700 | P1 / foundation | Map onboarding, payroll, CMS publishing, CRM conversion and recovery invariants to existing unit evidence and new browser acceptance scenarios. |
| WX-0751 | P1 / foundation | Document separate states for source validation, browser runtime, owned LAN session, optional provider readiness and deployed service health. |
| WX-0793 | P1 / foundation | Document which existing commands only inspect, which mutate local state and which require separately authorized provider or production actions. |
| WX-0835 | P1 / foundation | A read-only report records repository origin, branch, direct remote revision and tracked/staged/untracked status before an authorized publish step. |
| WX-0840 | P1 / foundation | A schema proposal identifies public browser variables versus private server settings and validates examples without reading actual secret files. |
| WX-0851 | P1 / foundation | A preview maps a bounded operator-selected proposal set to valid adopted TASK identifiers, owners and dependencies; applying requires the selected adopted app and leaves the reusable template ledger blank. |
| WX-0852 | P1 / foundation | Comparing two source revisions lists proposals whose referenced scopes changed and requests review without changing canonical task state or marking work complete. |
| WX-0855 | P1 / foundation | Adoption previews distinguish credential readiness, operator authorization and local prerequisites per selected task and refuse to infer readiness from a TODO status. |
| WX-0856 | P1 / foundation | A host status view distinguishes blank reusable task seeds, proposed roadmap items and any explicitly adopted project work. |
| WX-0857 | P1 / foundation | Maintainers can inspect which outer files are host-owned, imported stock defaults or immutable release content before updating them. |
| WX-0858 | P1 / foundation | Import preview summarizes selected version, exact public source commit, preserved host paths and bootstrap conflicts in a bounded report. |
| WX-0859 | P1 / foundation | An import rehearsal lists preserved project records and host extension fingerprints without publishing their private content. |
| WX-0901 | P1 / foundation | A maintainer can identify guides whose examined evidence predates relevant source changes, record a review decision and preserve the original dated receipts. |
| WX-0902 | P1 / foundation | A one-page worksheet guides an evaluator through the three fictional portal journeys and recovery exercise with spaces for observed outcomes and exact browser origin. |
| WX-0903 | P1 / foundation | The glossary distinguishes save, export, import, restore point, Undo, Reset, history clear and origin using current behavior. |
| WX-0904 | P1 / foundation | A fictional scenario walks through onboarding, benefit election, approved time and mock payroll with expected visible totals. |
| WX-0905 | P1 / foundation | A fictional scenario demonstrates separate review and publication responsibilities and verifies the frozen published projection. |
| WX-0906 | P1 / foundation | A fictional scenario creates a lead, converts it and moves an opportunity while showing the expected linked records. |
| WX-0907 | P1 / foundation | The walkthrough backs up all portals, restores one selected module and reverses it while checking untouched modules. |

## Resume commands

```bash
npm run backlog:plan
npm run backlog:ready
npm run backlog:ready -- --gate all --priority P1 --limit 30
npm run backlog:graph -- --id WX-0654 --id WX-0551
npm run backlog:plan:render
npm run backlog:plan:check
npm run backlog:evidence -- --id WX-0717
npm run backlog:evidence:check
```

The graph command includes the selected dependency closure, longest chain
and unresolved provider/operator criteria. Reports only read local catalog
files. The explicit render command writes this document; no command starts
workers, applies ledger imports, changes checklist status or contacts providers.
