# WebAppX execution plan — complete the 1,000-item backlog

The owner authorized completion of the full catalog on **2026-10-15**.
The active goal is to implement every remaining item and verify its original
acceptance criteria. This plan covers all 1,000 stable IDs; the canonical
[catalog](backlog/webappx-1000-todo.json) owns status and evidence. The
[checklist](backlog/WEBAPPX-1000-TODO.md) and CSV remain generated views.

Current verified progress: **24 done / 976 remaining**.
Remaining priorities: **146 P1 · 673 P2 · 157 P3**.
Remaining acceptance gates: **808 local · 40 provider · 128 operator**.

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
| Project setup and developer experience | WX-0001–WX-0050 | 7 | 43 |
| Shared portal architecture | WX-0051–WX-0100 | 7 | 43 |
| HR onboarding and directory | WX-0101–WX-0150 | 0 | 50 |
| HR payroll, benefits and time | WX-0151–WX-0200 | 0 | 50 |
| HR talent and employee operations | WX-0201–WX-0250 | 0 | 50 |
| CMS models and authoring | WX-0251–WX-0300 | 0 | 50 |
| CMS review and publication | WX-0301–WX-0350 | 0 | 50 |
| CRM leads and contacts | WX-0351–WX-0400 | 0 | 50 |
| CRM sales and service | WX-0401–WX-0450 | 0 | 50 |
| Mock persistence, backup and recovery | WX-0451–WX-0500 | 2 | 48 |
| Identity, membership and permissions | WX-0501–WX-0550 | 0 | 50 |
| Firebase data, functions and rules | WX-0551–WX-0600 | 0 | 50 |
| Security and privacy | WX-0601–WX-0650 | 0 | 50 |
| Testing, quality and accessibility | WX-0651–WX-0700 | 4 | 46 |
| Design, responsiveness and interaction | WX-0701–WX-0750 | 0 | 50 |
| Observability, support and operations | WX-0751–WX-0800 | 1 | 49 |
| CI, delivery and infrastructure | WX-0801–WX-0850 | 1 | 49 |
| SYSTEMX and agent workflows | WX-0851–WX-0900 | 1 | 49 |
| Documentation and adoption kits | WX-0901–WX-0950 | 1 | 49 |
| Optional integrations, extensibility and internationalization | WX-0951–WX-1000 | 0 | 50 |

Domain waves (the dependency graph overrides this order):

| Wave | Areas | Done | Remaining |
| --- | --- | ---: | ---: |
| Foundation | setup, systemx | 8 | 92 |
| Shared core | portal-shell, identity, security | 7 | 143 |
| Recovery | mock-recovery | 2 | 48 |
| Human resources | hr-onboarding, hr-payroll, hr-talent | 0 | 150 |
| Content | cms-authoring, cms-publishing | 0 | 100 |
| Customer relationships | crm-contacts, crm-sales | 0 | 100 |
| Quality and design | quality, design | 4 | 96 |
| Operations and delivery | operations, delivery | 2 | 98 |
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
| WX-0007 | P1 / foundation | A developer can request a fixed loopback host and port and receives an actionable occupied-port error rather than silently changing origin. |
| WX-0008 | P1 / foundation | The supervisor prints the exact scheme, host and port that own mock saves and links to the portal directory. |
| WX-0009 | P1 / foundation | The operator can inspect the owned processes and proposed replacement listeners before restarting a supervised session. |
| WX-0010 | P1 / foundation | The session summary distinguishes a usable Vite app from each emulator becoming ready, with component-specific failure messages. |
| WX-0501 | P1 / foundation | Publish a matrix that maps current synthetic HR, CMS and CRM roles to read, create, approve, publish and export actions without treating demo roles as Firebase claims. |
| WX-0601 | P1 / foundation | Document which HR drafts, CRM contacts, CMS publications and restore snapshots remain in browser storage and which transient inputs do not. |
| WX-0700 | P1 / foundation | Map onboarding, payroll, CMS publishing, CRM conversion and recovery invariants to existing unit evidence and new browser acceptance scenarios. |
| WX-0751 | P1 / foundation | Document separate states for source validation, browser runtime, owned LAN session, optional provider readiness and deployed service health. |
| WX-0793 | P1 / foundation | Document which existing commands only inspect, which mutate local state and which require separately authorized provider or production actions. |
| WX-0805 | P1 / foundation | Document supported Node and package-manager versions, npm ci behavior and separate Gusto backend dependency installation for clean checkouts. |
| WX-0835 | P1 / foundation | A read-only report records repository origin, branch, direct remote revision and tracked/staged/untracked status before an authorized publish step. |
| WX-0840 | P1 / foundation | A schema proposal identifies public browser variables versus private server settings and validates examples without reading actual secret files. |
| WX-0851 | P1 / foundation | A preview maps a bounded operator-selected proposal set to valid adopted TASK identifiers, owners and dependencies; applying requires the selected adopted app and leaves the reusable template ledger blank. |
| WX-0852 | P1 / foundation | Comparing two source revisions lists proposals whose referenced scopes changed and requests review without changing canonical task state or marking work complete. |
| WX-0854 | P1 / foundation | A review index can attach examined revision and local, browser, provider or operator evidence references to a proposal without converting historical evidence into current completion. |
| WX-0855 | P1 / foundation | Adoption previews distinguish credential readiness, operator authorization and local prerequisites per selected task and refuse to infer readiness from a TODO status. |
| WX-0856 | P1 / foundation | A host status view distinguishes blank reusable task seeds, proposed roadmap items and any explicitly adopted project work. |
| WX-0857 | P1 / foundation | Maintainers can inspect which outer files are host-owned, imported stock defaults or immutable release content before updating them. |
| WX-0858 | P1 / foundation | Import preview summarizes selected version, exact public source commit, preserved host paths and bootstrap conflicts in a bounded report. |
| WX-0859 | P1 / foundation | An import rehearsal lists preserved project records and host extension fingerprints without publishing their private content. |

## Resume commands

```bash
npm run backlog:plan
npm run backlog:ready
npm run backlog:ready -- --gate all --priority P1 --limit 30
npm run backlog:graph -- --id WX-0654 --id WX-0551
npm run backlog:plan:render
npm run backlog:plan:check
```

The graph command includes the selected dependency closure, longest chain
and unresolved provider/operator criteria. Reports only read local catalog
files. The explicit render command writes this document; no command starts
workers, applies ledger imports, changes checklist status or contacts providers.
