# WebAppX execution plan — complete the 1,000-item backlog

The owner authorized completion of the full catalog on **2026-10-15**.
The active goal is to implement every remaining item and verify its original
acceptance criteria. This plan covers all 1,000 stable IDs; the canonical
[catalog](backlog/webappx-1000-todo.json) owns status and evidence. The
[checklist](backlog/WEBAPPX-1000-TODO.md) and CSV remain generated views.

The separate [review index](BACKLOG-EVIDENCE.md) attaches scoped historical
receipts with examined and observation revisions. It does not accept work
or convert an earlier browser result into a current execution.

Current verified progress: **61 done / 939 remaining**.
Remaining priorities: **112 P1 · 670 P2 · 157 P3**.
Remaining acceptance gates: **772 local · 40 provider · 127 operator**.

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
| Identity, membership and permissions | WX-0501–WX-0550 | 2 | 48 |
| Firebase data, functions and rules | WX-0551–WX-0600 | 0 | 50 |
| Security and privacy | WX-0601–WX-0650 | 2 | 48 |
| Testing, quality and accessibility | WX-0651–WX-0700 | 8 | 42 |
| Design, responsiveness and interaction | WX-0701–WX-0750 | 0 | 50 |
| Observability, support and operations | WX-0751–WX-0800 | 4 | 46 |
| CI, delivery and infrastructure | WX-0801–WX-0850 | 4 | 46 |
| SYSTEMX and agent workflows | WX-0851–WX-0900 | 9 | 41 |
| Documentation and adoption kits | WX-0901–WX-0950 | 11 | 39 |
| Optional integrations, extensibility and internationalization | WX-0951–WX-1000 | 0 | 50 |

Domain waves (the dependency graph overrides this order):

| Wave | Areas | Done | Remaining |
| --- | --- | ---: | ---: |
| Foundation | setup, systemx | 20 | 80 |
| Shared core | portal-shell, identity, security | 12 | 138 |
| Recovery | mock-recovery | 2 | 48 |
| Human resources | hr-onboarding, hr-payroll, hr-talent | 0 | 150 |
| Content | cms-authoring, cms-publishing | 0 | 100 |
| Customer relationships | crm-contacts, crm-sales | 0 | 100 |
| Quality and design | quality, design | 8 | 92 |
| Operations and delivery | operations, delivery | 8 | 92 |
| Adoption | adoption | 11 | 39 |
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
| WX-0860 | P1 / foundation | A temporary adopted app with populated fictional records demonstrates that reviewed upstream imports preserve project-specific ledgers and configuration. |
| WX-0056 | P1 / portal-maturity | Opening the directory from a portal and returning restores the last supported portal subsection in that session. |
| WX-0059 | P1 / portal-maturity | Leaving a portal with an unsaved form offers keep editing or discard choices without intercepting a completed saved action. |
| WX-0101 | P1 / portal-maturity | A fictional rehire creates a new employment instance while prior onboarding receipts remain attached to the original instance. |
| WX-0102 | P1 / portal-maturity | A transfer preview shows previous and proposed department, manager and effective date before confirmation. |
| WX-0103 | P1 / portal-maturity | Each proposed leave, return or termination transition requires a sample reason and records the prior state. |
| WX-0104 | P1 / portal-maturity | Confirming fictional termination creates asset, access and handover assignments without calling external systems. |
| WX-0105 | P1 / portal-maturity | The screen distinguishes retained directory identity from new employment and onboarding requirements. |
| WX-0106 | P1 / portal-maturity | The preview lists affected direct-report scopes and prevents assigning an employee as their own manager. |
| WX-0107 | P1 / portal-maturity | Creating a fictional reporting cycle is refused with the affected employee IDs shown. |
| WX-0108 | P1 / portal-maturity | A saved directory edit displays old value, new value, actor preview and change sequence. |
| WX-0109 | P1 / portal-maturity | An employee can propose a directory correction and HR can accept or reject it with a recorded outcome. |
| WX-0110 | P1 / portal-maturity | New hires receive the selected checklist version while existing completed onboarding retains its original version. |
| WX-0151 | P1 / portal-maturity | Preparing a run requires a valid chosen sample period and accepts only approved unpaid time inside it. |
| WX-0152 | P1 / portal-maturity | A run freezes each fictional employee’s configured sample rate and displays that rate beside consumed hours. |
| WX-0153 | P1 / portal-maturity | A future-dated sample rate change leaves an already submitted payroll receipt unchanged. |
| WX-0154 | P1 / portal-maturity | Changing approved input after preparation marks the prepared run stale and requires intentional re-preparation. |
| WX-0155 | P1 / portal-maturity | A review table states why each time entry is included or excluded from the selected sample run. |
| WX-0156 | P1 / portal-maturity | A manager can return submitted fictional time to its owner with a visible reason and no payroll eligibility. |
| WX-0157 | P1 / portal-maturity | An owner can edit an unpaid draft entry and the change does not mutate approved or consumed entries. |

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
