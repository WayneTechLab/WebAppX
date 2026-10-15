# HR employment lifecycle implementation plan

Planning date: **2026-10-15**. Status: **ten HR criteria accepted locally;
verification complete**. The catalog and QA receipt own acceptance
and executed evidence; this document retains the implementation contract.

This is the bounded HR lane under the
[complete execution plan](WEBAPPX-EXECUTION-PLAN.md), following the historical
portal safety wave. The original planning observation preceded acceptance of the safety wave.
The historical safety checkpoint recorded **91 done / 909 remaining** after
fourteen local criteria were accepted. The [canonical catalog](backlog/webappx-1000-todo.json)
now records **109 done / 891 remaining**, after acceptance of these ten HR
criteria, six CMS/CRM criteria and two audited recovery criteria. Read live
counts from the repository root:

```sh
node -e 'const fs=require("node:fs"); const {items}=JSON.parse(fs.readFileSync("docs/backlog/webappx-1000-todo.json","utf8")); const counts=items.reduce((out,item)=>(out[item.status]=(out[item.status]??0)+1,out),{}); console.log(JSON.stringify({total:items.length,...counts},null,2));'
```

The original source observations below retain their planning scope. Current app
source is integrated at `458a045`, followed by harness-only `fdf6012`. Read the
[current feature guide](PORTAL-LIFECYCLE.md) and
[lifecycle QA receipt](PORTAL-LIFECYCLE-QA-2026-10-15.md) for implemented controls
and actual standalone execution. The native journey passed **20/20 checks/check
groups** on the final 100-file runtime freeze; targeted keyboard **9/9** and
quality **6/6** runs also passed with their documented harness corrections.
**Current verification is complete: all 62 CI stages passed with terminal exit
0 on `fdf60124e49659e9c33d30db59e45ff8369a38e1`.** Independent report review
confirmed **180 actual browser checks/check groups**. Hosting preflight passed on
the same final runtime before the harness-only commit; no deployment occurred.
Agent 0 accepted these ten HR criteria, the other six feature criteria and
audited **WX-0467/WX-0487**. Remaining priorities are **70 P1, 665 P2 and
156 P3**; remaining gates are **724 local, 127 operator and 40 provider**.
Source and wiki publication require separate direct remote parity checks.
The
[next recruiting plan](RECRUITING-LIFECYCLE-IMPLEMENTATION-PLAN.md) remains a
proposal. No provider, catalog or managed-release change follows from this plan.

## Original scope and criteria

All ten items are accepted locally. Their original priority is `P1`, phase `portal-maturity`, area
`hr-onboarding`, gate `local`, with source
`src/hr/components/HrWorkspace.tsx`. Each original canonical dependency list is
empty (`[]`). The engineering order in this plan does not change those lists.

| ID | Original title | Original acceptance criterion | Original dependencies |
| --- | --- | --- | --- |
| WX-0101 | Add effective-dated employment instances | A fictional rehire creates a new employment instance while prior onboarding receipts remain attached to the original instance. | `[]` |
| WX-0102 | Add a fictional employee transfer workflow | A transfer preview shows previous and proposed department, manager and effective date before confirmation. | `[]` |
| WX-0103 | Add employment lifecycle transition reasons | Each proposed leave, return or termination transition requires a sample reason and records the prior state. | `[]` |
| WX-0104 | Add a simulated offboarding checklist | Confirming fictional termination creates asset, access and handover assignments without calling external systems. | `[]` |
| WX-0105 | Add a rehire comparison screen | The screen distinguishes retained directory identity from new employment and onboarding requirements. | `[]` |
| WX-0106 | Add a manager reassignment preview | The preview lists affected direct-report scopes and prevents assigning an employee as their own manager. | `[]` |
| WX-0107 | Add organization chart cycle validation | Creating a fictional reporting cycle is refused with the affected employee IDs shown. | `[]` |
| WX-0108 | Add directory field change history | A saved directory edit displays old value, new value, actor preview and change sequence. | `[]` |
| WX-0109 | Add a profile correction request flow | An employee can propose a directory correction and HR can accept or reject it with a recorded outcome. | `[]` |
| WX-0110 | Add onboarding template versions | New hires receive the selected checklist version while existing completed onboarding retains its original version. | `[]` |

## Original source contracts — planning observation

- [Mock workflows](../src/hr/mock-workflows.ts) store one onboarding record,
  profile email and employment status per employee ID. Onboarding contains
  profile/job review flags, task completion, stage and an optional receipt.
  Completed onboarding is locked; later profile edits preserve that receipt.
- [The workspace](../src/hr/components/HrWorkspace.tsx) overlays email and status
  for the directory, while action adapters receive the recruiting fixture.
  Department, job title and manager are still fixture-derived. A transfer must
  reach the records used by authorization as well as the visible directory.
- [The recruiting link](../src/hr/recruiting-link.ts) creates a hire's workflow
  maps and leave balances in one accepted update. Recruiting currently supplies
  one fixed checklist for a new hire.
- [Persistence validation](../src/hr/persistence.ts) requires every employee's
  workflow maps and balances, and requires onboarding task IDs to match the
  employee's fixture checklist. A versioned checklist cannot simply be added to
  the UI without changing that validation contract.
- [Linked operations](../src/hr/linked-operations.ts) use explicit employee/task
  mappings for selected sample policies and training. The mappings do not
  currently distinguish employment instances.
- [Role helpers](../src/hr/model.ts), [people operations](../src/hr/people-operations.ts),
  [service desk](../src/hr/service-desk.ts), [performance](../src/hr/performance.ts)
  and [recruiting](../src/hr/recruiting.ts) use employee and manager relationships
  for scope checks. Performance reviews capture a manager ID and also require
  that manager to remain the employee's current direct manager for review writes.
- [Workspace inspection](../src/portals/workspace-inspection.ts) enumerates the
  present HR collections. New lifecycle collections need explicit inventory and
  difference identities before recovery inspection can claim complete coverage.

These observations describe the original pre-implementation planning source;
they are not a current feature inventory. The linked feature guide describes
the integrated implementation. The separate SDK mock session is not the native
HR workspace and is outside this lane.

## Original proposed state and compatibility contract

### Identity, instances and captured onboarding

Keep the directory employee ID stable across employment. Add an optional,
versioned lifecycle extension to the HR saved-state contract. Absence must
continue to decode as the existing valid legacy workspace. Proposed records are:

| Record | Required meaning when the extension is present |
| --- | --- |
| Employment instance | Unique instance ID, employee ID, effective start/end, initial status and assignment, and ordered lifecycle/assignment changes. |
| Active onboarding binding | Employee ID, employment instance ID, captured template version and task definitions. One authoritative active onboarding payload remains associated with this binding. |
| Historical onboarding | Original instance ID and captured onboarding payload, including its original receipt and template/checklist identity. It is immutable after archival. |
| Directory change | Field, old value, new value, actor preview, change sequence and origin, such as direct edit or accepted correction. |
| Correction request | Request ID, requesting employee, allowed field, captured old value/revision, proposed value and recorded review outcome. |
| Lifecycle activity | Transition ID/sequence, instance and employee IDs, effective date, prior/proposed state, sample reason and actor preview. |

Do not maintain two independently editable active onboarding copies. Preserve
the existing employee-keyed active onboarding surface for compatibility; archive
the previous instance's payload before replacing it with new requirements on a
confirmed rehire. The instance/template binding determines which checklist
validates that active record.

Legacy instances have an explicitly unknown start date until a reviewed action
supplies facts. Do not infer employment dates from fixture status, a receipt,
the current clock or the saved-file timestamp. Do not manufacture a completion
receipt for a fixture whose tasks happen to be complete.

All new records use bounded, safe IDs and monotonic action sequences. A
meaningful accepted action consumes a sequence; preview, cancellation, refusal
and duplicate confirmation do not. Actor preview records the selected local
role and bound employee ID when present; it is not an authenticated identity.

### Effective dates and one employee projection

Introduce one pure effective-employee projection over the fixture, recruited
hires and lifecycle records. Use its output consistently for directory/profile,
time and leave approvals, people operations, service desk, recruiting manager
choices, performance, dashboards and reports.

Use explicit sample dates rather than hidden clock reads. Before implementation,
freeze one deterministic policy for future dates. The recommended bounded
policy is an explicit simulation date, with confirmation allowed only for
changes effective on or before it and no background scheduler. Reject invalid
dates, overlapping instances and changes that would reorder an already accepted
timeline. A rehire starts after the preceding instance ends. An unknown legacy
start does not justify a fabricated historical interval.

Transfers preserve the person and employment instance. Their preview shows old
and proposed department, manager and effective date, plus direct-report scope
changes. Validate the proposed full reporting graph before acceptance: known
manager or explicit no-manager, no self-manager and no cycle. Return the actual
affected employee IDs for cycle errors. Validate the graph again during import;
UI filtering is insufficient.

### Lifecycle and assignment policy

Freeze a small explicit transition table before writing the reducer: active to
sample leave, leave to active, and active/leave to terminated; rehire creates a
new onboarding instance. Leave, return and termination require a bounded,
trimmed printable sample reason and record the prior state. Leave here is an
employment status transition, separate from the existing vacation/sick request
domain.

Termination confirmation creates asset-return, access-review and handover
assignments, each bound to the terminating employment instance. Their stable
identities prevent duplicate creation. Existing tasks, asset acknowledgements
and history remain intact. Access review is a fictional local assignment; no
account is disabled or provider action asserted. A manager with current reports
must first transfer those reports or receive a clear refusal listing them.

The rehire comparison separates retained identity/contact/history from the new
instance ID, effective date, assignment and onboarding checklist. It must state
the handling of existing balances and sample rate timelines; no implicit rate
cadence, balance reset or compensation inference is permitted. Submitted payroll
receipts and statements remain frozen. Unsaved preparation uses the existing
freshness rules when eligibility changes; lifecycle changes must not rewrite
submitted inputs or historical totals.

### Directory history and correction review

Start correction requests with the existing editable synthetic work-email
field. Transfers own department/manager changes. Do not add tax, bank, identity
or other sensitive profile data to satisfy these criteria.

Preserve existing authorized direct-profile behavior. An accepted direct edit
or correction appends one change record with old/new values, actor preview and
sequence. No-op edits append nothing. An employee may propose only their own
correction; owner/HR may accept or reject with a recorded outcome. Acceptance
checks the captured previous value/revision again. A stale proposal requires
review and cannot silently overwrite a newer edit. Applying the value and
recording acceptance/history form one transaction.

### Template versions and employment-bound links

Define immutable local checklist versions with stable version/task IDs. Capture
the selected version and task definitions for every newly created employment
instance. The initial template selection should be explicit and preserve the
current default checklist behavior for old API calls until the new contract is
reviewed. Recruiting and rehire both use the same template-assignment function.

Changing the selected version affects subsequent hires/rehires. It does not
change existing task titles, completions, reviewed summaries or receipts.
Legacy onboarding retains its captured fixture checklist. Completed onboarding
remains attached to its original employment instance and version.

Bind new policy/training/offboarding assignments to their instance. Existing
employee-only sample links must resolve to their legacy instance, not whichever
instance is active later. Acknowledging an old assignment must never complete
rehire onboarding. Onboarding actions and confirmations carry the intended
instance identity so stale controls cannot mutate a newer instance.

### Roles and performance policy

Recommended lifecycle mutation roles are employer owner and HR administrator.
Employees can view their own records and propose their own correction; managers
receive their projected direct-report scope. Preserve the seven existing role
contracts, compensation restrictions and contractor separation. Payroll admin,
auditor and manager previews do not gain lifecycle mutation through a route or
disabled control. Check authority in each pure transition.

A manager transfer must preview affected in-flight performance reviews. The
recommended bounded policy is to refuse a transfer that would remove the
captured manager's required relationship while a review is unfinished, and
explain that the existing cycle must finish first. Do not silently change a
review's manager, copy unpublished comments to the new manager, or republish a
review. Published/acknowledged review content remains frozen. The precise
definition of finished must be frozen with the implementation contract; using
`acknowledged` matches the current new-cycle gate.

Use an explicit manager identity choice if demonstrating both sides of a
transfer requires one. Any saved selected-manager field must be optional for
legacy snapshots, with the current deterministic default preserved.

## Validator, atomicity and recovery requirements

1. Keep valid legacy HR snapshots usable across browser load, individual import,
   combined import, restore points and Undo. Do not eagerly migrate or rewrite
   named fixture files, receipt payloads or old saved bytes merely by reading.
2. When the lifecycle extension exists, validate it completely: exact supported
   version, fields/types/bounds, unique IDs, known employee/instance/template
   references, valid dates and order, graph acyclicity, checklist binding,
   sequence consistency and current/archive agreement. Malformed partial
   extensions must refuse rather than falling back to legacy interpretation.
3. Validate a complete candidate snapshot before replacing accepted state.
   Rehire, termination assignments, accepted correction/history and linked hire
   initialization each commit together. A failed operation preserves the whole
   prior state and consumes no receipt or sequence.
4. Preview returns the proposed changes and the facts/revision it reviewed.
   Confirmation recomputes authority, source identity, prior state and graph
   validity. A changed source or target produces a refreshed preview, not a
   partial or stale confirmation.
5. Distinguish accepted in-memory state from browser persistence status, using
   the existing portal contract. A successful accepted action establishes its
   form baseline even when storage reports failure; a refused action does not.
6. Add every new collection and nested checklist/assignment record to recovery
   inspection and difference manifests with stable identities. Preserve exact
   source payloads in individual/combined exports and history. Existing recovery
   checkpoint and import validation happen before replacement as documented in
   the [workspace recovery glossary](WORKSPACE-RECOVERY-GLOSSARY.md).

## UI and unsaved form integration

Place this lane in native employee profile/onboarding management, with a
separate employee-owned correction form. Extract focused components instead of
expanding unrelated HR cards. Proposed labels include **Preview sample
transfer**, **Confirm sample transfer**, **Preview employment transition**,
**Confirm fictional termination**, **Compare fictional rehire**, **Request
directory correction** and **Onboarding template version**. Freeze final labels
with the independent browser owner before implementation acceptance.

Register transfer fields, lifecycle reason/date fields, rehire choices,
correction proposals/review notes and any template-selection draft through the
existing [HR draft helper](../src/hr/components/useHrFormDraft.ts). Give each
group stable employee/instance/action identity, a visible focus target and
normalized reversion-to-baseline behavior. Filters, read-only history and an
unmodified preview are not dirty.

Guard local target/instance changes that would lose a dirty group through the
shared unsaved transition request. Keep preserves the original target and
values; Discard clears only the affected temporary values before the transition.
Accepted actions clear/rebase their own group synchronously; failed actions
retain it. Preserve the existing explicit Reset/import replacement policy and
accepted replacement epoch behavior. No additional navigation dialog should be
added to those explicit replacement actions.

## Implementation order and ownership boundary

1. Freeze optional state shape, dates, role matrix, performance policy and legacy
   examples; implement pure projection and full candidate validation first.
2. Implement instance creation/archive, template capture and instance-bound
   onboarding transitions; connect recruiting atomically.
3. Implement transfer/graph previews and lifecycle reasons, then transactional
   offboarding assignments and the rehire comparison.
4. Add directory change history and correction review with stale-source checks.
5. Integrate native UI, effective scope consumers and dirty form groups.
6. Update persistence/recovery inventory, meaningful tests, browser journeys,
   role/capability evidence and operator documentation before acceptance.

One owner should hold the lifecycle model, onboarding/recruiting adapters and
HR validator together. Agent 0 coordinates shared recovery inventory, generated
role/capability bindings, browser ownership, documentation, catalog acceptance
and Git integration. Existing immutable managed releases, research inventories,
named fixture bytes and blank reusable SYSTEMX records remain preserved.

## Independent acceptance evidence required

| Scenario | Required independent assertions |
| --- | --- |
| Legacy restoration | Literal pre-extension saves decode through individual/combined import, restore and Undo; existing onboarding and submitted payroll payloads remain complete and unchanged. Reading does not invent dates or write a migration. |
| Rehire and receipts | One persistent employee ID, two distinct employment IDs, non-overlapping known dates; first onboarding receipt stays on the first instance; new checklist begins incomplete. Duplicate confirmation preserves the complete state. |
| Checklist versions | Complete version A, select B, create a hire/rehire; B goes only to the new instance. A's definitions, completion and receipt remain unchanged. Unknown/mismatched versions or task IDs refuse import. |
| Transfer scope | With independent literal IDs, old manager loses and new manager gains the intended directory/time/PTO/request scope. Preview shows exact previous/proposed values and effective date before writes. |
| Reporting graph | Self-manager, two-person and longer cycles refuse with the actual cycle IDs; a valid unrelated branch succeeds. Malformed imported graphs refuse before replacement. |
| Lifecycle reasons | Blank/whitespace/control-character reason, invalid dates and illegal prior-state transitions refuse with whole-state equality and unchanged sequence. Valid leave/return/termination records prior state and actor. |
| Offboarding | Accepted termination creates exactly the asset/access/handover categories with correct instance IDs, preserves prior assignments and produces no provider/network calls. Failed validation commits none of them. |
| Directory correction | Employee cannot propose for another person; HR acceptance/rejection records an outcome. Direct edit and accepted correction display literal old/new values, actor and sequence. A stale proposal cannot overwrite a newer edit. |
| Old assignment isolation | Completing a policy/training assignment from the first instance cannot advance the rehire checklist. A stale onboarding action cannot mutate a new instance. |
| Performance and payroll | Transfer refusal explains an unfinished affected review. Published comments, completed onboarding, paid time, submitted payroll inputs and statements remain intact through lifecycle changes. |
| Unsaved participants | Actual controls exercise Keep/Discard, normalized reversion, accepted-action cleanliness, failed-action retention, hidden-group focus and unchanged raw saves during cancelled navigation. |
| Browser and recovery | Actual rendered preview/confirm controls, fresh owned browser context, independent expected IDs/values, full exports and exact saved-byte/history assertions; selected restore/Undo covers all new collections and leaves unchecked modules intact. |

Tests must assert behavior and complete preservation against independently
constructed expectations, not merely render generated snapshots or repeat the
reducer's calculations. Temporary fixtures may model cycles, multiple managers
and legacy receipts; immutable bundled fixtures remain unchanged.

Agent 0 accepted the ten original criteria after independent review and the
required integrated CI, Hosting preflight, drift, template and documentation
checks. The linked QA receipt retains the actual results. Local mock evidence does not establish a
provider connection, production authorization, deployed health or operational
employment action. Follow [HR portal boundaries](HR-PORTAL.md) and
[Gusto setup boundaries](GUSTO-SETUP.md) throughout the lane.
