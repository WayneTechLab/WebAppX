# WebAppX execution plan — complete the 1,000-item backlog

The owner authorized completion of the full catalog on **2026-10-15**.
The active goal is to implement every remaining item and verify its original
acceptance criteria. This plan covers all 1,000 stable IDs; the canonical
[catalog](backlog/webappx-1000-todo.json) owns status and evidence. The
[checklist](backlog/WEBAPPX-1000-TODO.md) and CSV remain generated views.

The separate [review index](BACKLOG-EVIDENCE.md) attaches scoped historical
receipts with examined and observation revisions. It does not accept work
or convert an earlier browser result into a current execution.

Current verified progress: **134 done / 866 remaining**.
Remaining priorities: **56 P1 · 654 P2 · 156 P3**.
Remaining acceptance gates: **699 local · 40 provider · 127 operator**.

## Assigned implementation plans

The current payroll/setup wave is defined by the [payroll control contract](PAYROLL-CONTROL-CONTRACT.md)
and [developer setup implementation plan](SETUP-CONTRACTS-IMPLEMENTATION-PLAN.md).
It covers WX-0159, WX-0160, WX-0011–0014, WX-0016, WX-0019, WX-0020 and WX-0022–0024.
An implementation assignment or focused test result does not check off these items.
Their canonical statuses and completion receipts remain the authority below.

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
| Project setup and developer experience | WX-0001–WX-0050 | 21 | 29 |
| Shared portal architecture | WX-0051–WX-0100 | 10 | 40 |
| HR onboarding and directory | WX-0101–WX-0150 | 10 | 40 |
| HR payroll, benefits and time | WX-0151–WX-0200 | 10 | 40 |
| HR talent and employee operations | WX-0201–WX-0250 | 10 | 40 |
| CMS models and authoring | WX-0251–WX-0300 | 3 | 47 |
| CMS review and publication | WX-0301–WX-0350 | 3 | 47 |
| CRM leads and contacts | WX-0351–WX-0400 | 4 | 46 |
| CRM sales and service | WX-0401–WX-0450 | 0 | 50 |
| Mock persistence, backup and recovery | WX-0451–WX-0500 | 12 | 38 |
| Identity, membership and permissions | WX-0501–WX-0550 | 2 | 48 |
| Firebase data, functions and rules | WX-0551–WX-0600 | 0 | 50 |
| Security and privacy | WX-0601–WX-0650 | 2 | 48 |
| Testing, quality and accessibility | WX-0651–WX-0700 | 9 | 41 |
| Design, responsiveness and interaction | WX-0701–WX-0750 | 4 | 46 |
| Observability, support and operations | WX-0751–WX-0800 | 7 | 43 |
| CI, delivery and infrastructure | WX-0801–WX-0850 | 5 | 45 |
| SYSTEMX and agent workflows | WX-0851–WX-0900 | 10 | 40 |
| Documentation and adoption kits | WX-0901–WX-0950 | 11 | 39 |
| Optional integrations, extensibility and internationalization | WX-0951–WX-1000 | 1 | 49 |

Domain waves (the dependency graph overrides this order):

| Wave | Areas | Done | Remaining |
| --- | --- | ---: | ---: |
| Foundation | setup, systemx | 31 | 69 |
| Shared core | portal-shell, identity, security | 14 | 136 |
| Recovery | mock-recovery | 12 | 38 |
| Human resources | hr-onboarding, hr-payroll, hr-talent | 30 | 120 |
| Content | cms-authoring, cms-publishing | 6 | 94 |
| Customer relationships | crm-contacts, crm-sales | 4 | 96 |
| Quality and design | quality, design | 13 | 87 |
| Operations and delivery | operations, delivery | 12 | 88 |
| Adoption | adoption | 11 | 39 |
| Connected extensions | firebase, integrations | 1 | 99 |

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
| WX-0656 | P1 / portal-maturity | Manual evidence records storage save, import refusal, restore success and Undo result announcements without duplicate announcements from hidden modules. |
| WX-0015 | P2 / foundation | A developer starting the template can see links for the public app, three mock portals and optional local control plane with their distinct prerequisites. |
| WX-0017 | P2 / foundation | The app can run an explicitly selected walkthrough session that never writes mock saves and clearly labels refresh behavior. |
| WX-0018 | P2 / foundation | A preview lists only WebAppX-owned mock keys and the portal/history effect of clearing each key without deleting browser data. |
| WX-0021 | P2 / foundation | An adoption command previews identity substitutions in a temporary copy and leaves the original template and ignored files unchanged. |
| WX-0701 | P2 / foundation | HR, CMS and CRM use documented surface, spacing and emphasis tokens with one sample page demonstrating each token. |
| WX-0702 | P2 / foundation | A local preference changes row spacing without hiding record labels or action controls and survives refresh. |
| WX-0703 | P2 / foundation | Section headings expose consistent hierarchy and support metric, action and descriptive text slots without duplicate page titles. |
| WX-0704 | P2 / foundation | Each invalid field has a linked error message and the form summary targets the same control. |
| WX-0705 | P2 / foundation | A disabled sample action has nearby text explaining the exact unmet prerequisite without requiring hover. |
| WX-0706 | P2 / foundation | Domain confirmations show action, affected record and receipt with a keyboard-operable copy control. |
| WX-0707 | P2 / foundation | The shell shows saved, memory-only and pending-form states without collapsing distinct storage errors into success. |
| WX-0861 | P2 / foundation | The host records its supported managed release range and an import preview warns when a new release is outside that reviewed range. |
| WX-0862 | P2 / foundation | A refused downgrade reports the active version, requested version and safe review alternatives without rewriting retained snapshots. |
| WX-0863 | P2 / foundation | A read-only comparison export lists retained versions, manifest schemas and observed fingerprint results at two examined host revisions without rewriting snapshots. |
| WX-0864 | P2 / foundation | A read-only tool shows which outer instructional files differ from selected defaults and labels host-owned customization rather than overwriting it. |
| WX-0865 | P2 / foundation | A temporary-copy check demonstrates using ignored original bootstrap backups to recover from a deliberately interrupted refresh. |
| WX-0866 | P2 / foundation | SYSTEMX tool checks report which temporary copies were created and whether each was removed after success or retained for a failed check. |
| WX-0867 | P2 / foundation | The context command can explain the byte or line contribution of each record without automatically loading more project history. |
| WX-0868 | P2 / foundation | A fictional secret-marker fixture proves resume packets omit excluded local runtime and private prompt files. |

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
