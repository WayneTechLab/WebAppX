# HR lifecycle, CMS releases and CRM ownership implementation plan

Planning date: **2026-10-15**. Status: **implementation in an isolated checkout;
all sixteen criteria remain TODO**. This is the next bounded assignment under
the [full 1,000-item execution plan](WEBAPPX-EXECUTION-PLAN.md), following the
accepted [portal safety wave](PORTAL-SAFETY-QA-2026-10-15.md).

The implementation checkout starts at `61d39c9c855fb3f56913cb7c2f8010a6a485b746`.
The catalog at this planning observation contains **91 done / 909 remaining**.
This plan supplies no completion evidence, provider authority or production
activation. Original definitions, dependencies, priorities and acceptance gates
remain unchanged. Reusable SYSTEMX seeds and managed releases remain intact.

## Original local scope

The HR records have no canonical dependencies; their engineering order is a
local implementation choice. CMS and CRM each include their P2 predecessors
before the dependent P1 criterion can be accepted. Every gate below is local.

| ID | Priority | Original dependencies | Original acceptance criterion |
| --- | --- | --- | --- |
| WX-0101 | P1 | — | A fictional rehire creates a new employment instance while prior onboarding receipts remain attached to the original instance. |
| WX-0102 | P1 | — | A transfer preview shows previous and proposed department, manager and effective date before confirmation. |
| WX-0103 | P1 | — | Each proposed leave, return or termination transition requires a sample reason and records the prior state. |
| WX-0104 | P1 | — | Confirming fictional termination creates asset, access and handover assignments without calling external systems. |
| WX-0105 | P1 | — | The screen distinguishes retained directory identity from new employment and onboarding requirements. |
| WX-0106 | P1 | — | The preview lists affected direct-report scopes and prevents assigning an employee as their own manager. |
| WX-0107 | P1 | — | Creating a fictional reporting cycle is refused with the affected employee IDs shown. |
| WX-0108 | P1 | — | A saved directory edit displays old value, new value, actor preview and change sequence. |
| WX-0109 | P1 | — | An employee can propose a directory correction and HR can accept or reject it with a recorded outcome. |
| WX-0110 | P1 | — | New hires receive the selected checklist version while existing completed onboarding retains its original version. |
| WX-0314 | P2 | — | A publisher can collect several approved entries into a named local release without publishing them immediately. |
| WX-0315 | P2 | WX-0314 | A release preview identifies stale approvals and duplicate routes and applies no entries if validation fails. |
| WX-0316 | P1 | WX-0315 | Activating a valid sample release updates all included frozen publications or leaves the entire CMS state unchanged. |
| WX-0379 | P2 | — | An owner or manager preview can reassign an unconverted lead and records both fictional assignees. |
| WX-0380 | P2 | WX-0379 | The transfer preview lists linked contacts, opportunities and tasks and identifies every affected record before confirmation. |
| WX-0381 | P1 | WX-0380 | A confirmed transfer updates all supported graph owners consistently or rejects the entire operation. |

## Parallel implementation and ownership

| Lane | Owned implementation | Integration contract |
| --- | --- | --- |
| HR core | Optional lifecycle types/projection/actions/templates; workflow, persistence, recruiting links and focused literal model tests | One editable active onboarding payload; archived original instance receipts; one effective fixture for display and every action/role helper. |
| HR employment UI | New employment lifecycle component | Explicit transfer/reason/offboarding/rehire/template previews and confirmations; scope-aware dirty form groups, visible text and refusal preservation. |
| HR corrections UI | New correction/history component | Employee-own proposals; HR review/direct edit; old/new/actor/sequence history; optional page-bound employee scope. |
| CMS releases | CMS model, strict optional extension, persistence, UI and literal release tests | Named approved snapshots; pure stale/route preview; all included frozen publications activate in one accepted update or no change. |
| CRM ownership | CRM model, persistence, UI and literal transfer tests | Full supported graph preview and atomic owner change; historical activity remains captured. Unconverted lead reassignment is separate from account graph transfer. |
| Agent 0 | HR workspace wiring, shared inspection/differences, source bindings, status inventory, browser integration, documentation, acceptance and Git | Sole shared-file owner; serialize dependencies and independently review literal complete records before publishing. |

Domain work is isolated from the primary checkout's current publication gate.
No lane writes the primary app, catalog, shared provider, package scripts,
managed releases or another owner's files. Agent 0 integrates reviewed source.

## Compatibility and verification requirements

- Read legacy saves without materializing extensions or changing their bytes.
  Initialize a new extension only through a meaningful accepted action. Refusal,
  preview, no-op and replay consume no sequence and write no save.
- [The HR contract plan](HR-LIFECYCLE-IMPLEMENTATION-PLAN.md) details employment
  instances, captured checklists, scope changes and corrections. Preserve prior
  onboarding/payroll receipts and consumed time; explicitly show the rehire
  policy for existing balances, rates and benefits. Choose simulation dates
  explicitly; no background scheduling or current-date inference is introduced.
- CMS captures remain valid historical snapshots after ordinary edits make a
  release stale. Strict import validation checks their shape independently from
  current activation eligibility. Activation rechecks every member and route
  before exposing the complete new state.
- CRM transfers include company, contacts, all linked opportunities and tasks,
  and converted leads. A matching free-text company name creates no graph edge.
  Reject unauthorized/no-op/conflicting/stale transfers without changing state.
- Extend complete restore inspection and differences for each new durable HR
  and CMS collection. Preserve individual import, selected restore, Undo and
  the dirty CMS editor exception.
- Exercise real UI, refresh, export/import, selected restore/Undo, role scope,
  stale confirmations, exact refusal preservation and independent expected
  payloads. Extend accessible-name, monochrome-status and x-large evidence for
  the new controls and outcomes; keep fixture rendering distinct from actions.
- Refresh reviewed source bindings deliberately. Run the required full CI,
  Hosting preflight, SYSTEMX drift and template preservation gates before
  publication. Record each original criterion only after accepted evidence.

Contact merge criteria **WX-0370–WX-0371** remain outside this assignment. Their
survivor/seed identity, converted-email and cross-company compatibility contract
requires a separate reviewed design. Provider/operator, deployment, native
Windows and manual screen-reader acceptance retain their named evidence gates.
