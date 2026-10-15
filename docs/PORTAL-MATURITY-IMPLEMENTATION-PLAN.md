# Next portal implementation batch — 2026-10-15

Status: **planned, unaccepted**. This is a bounded implementation assignment
under the [all-1,000 execution plan](WEBAPPX-EXECUTION-PLAN.md), using source
baseline `aae465ae033f3191a69ed7d40056b0c6e2159e17`. The
[canonical catalog](backlog/webappx-1000-todo.json) retains every original
criterion, dependency and completion record. These 16 items are P1, local-gated
TODOs with empty canonical dependency lists. The order below is an engineering
sequence, not a change to those dependencies or authority to use a provider.

## Parallel ownership and original acceptance targets

| Lane | Items | Concrete outcome and verification |
| --- | --- | --- |
| HR payroll | WX-0151–WX-0155 | Chosen validated period; approved/unpaid time in that period; explicit fictional employee rates frozen beside hours; effective-dated future rate changes preserve submitted receipts; changed input marks preparation stale; inclusion/exclusion explanations agree with preparation. |
| HR timesheets | WX-0156–WX-0158 | Manager returns submitted time with a reason and no payroll eligibility; owner edits unpaid drafts; confirmed draft deletion preserves submitted/paid history. Validate date/hours, employee/day aggregate and ownership at each transition. |
| CMS editor | WX-0280, WX-0282 | Complete field error summary and first-invalid focus; switching an unsaved editor offers keep-editing/discard. Successful saves establish a clean baseline. |
| CRM import | WX-0397 | Exact string enums, unknown/oversized notes and invalid graph edges refuse before saved workspace replacement; use complete saved/current-state sentinels. |
| Recovery history | WX-0453, WX-0454 | Label an existing point without changing ID/time/scope/payload; create a named selected-scope point with history-only writes. Retain old unlabeled points and existing retention/budget safeguards. |
| Recovery inspection | WX-0457, WX-0458 | Complete collection counts and bounded identifiers for each captured module; added/removed/changed entity counts before restore/Undo. Keep free-text fields hidden by default and make inspection pure. |
| Portal navigation | WX-0056 | Return from the directory to the last supported subsection within the session. Remember only validated portal routes; reject unsupported path contamination. |

HR payroll/timesheet edits share an owner for `mock-workflows.ts`, relevant HR
components and persistence. CMS and CRM lanes own their domain source/tests.
Recovery history and inspection should expose independent model contracts;
Agent 0 integrates shared provider and history/combined-backup UI changes.
Navigation stays out of domain workflow files. Agent 0 integrates all lanes,
checks source bindings, accepts criteria and publishes the final tested tree.

## Evidence that motivates this batch

A read-only planning reproduction found that the current CRM validator accepts
`['new']`, `['discovery']` and `['open']` for lead/opportunity/task enums through
`String(value)` coercion. This is a concrete type-validation gap to repair under
WX-0397. Existing graph checks remain valuable. Unsupported notes are currently
rejected as unknown fields; no profile/notes schema should be invented merely
to satisfy the item's title.

HR currently uses one fixed period and one global sample hourly rate. Existing
`payCents` values do not declare an hourly cadence and must not silently acquire
that meaning. Submitted payroll already contains useful frozen snapshots.
Persisted individual/combined backups and recovery points need a deliberate
compatibility design before new required fields are introduced.

CMS entry selection currently remounts uncontrolled editor fields without a
discard decision. Recovery history has no names/manual creation/detail inventory
or entity difference preview. Directory links currently return to portal roots.
These are source observations, not acceptance evidence or new browser results.

## Browser acceptance sequence

1. Return submitted time, confirm exclusion from payroll, then edit/resubmit/
   approve. Choose period/rates, prepare, change approved input and observe a
   stale block. Reprepare/submit; a later rate change leaves the receipt intact.
2. Submit multiple invalid CMS fields and verify summary/focus. Correct/save,
   then test both keep-editing and discard on a dirty entry switch.
3. Import malformed CRM enums/notes/edges; verify visible refusal and unchanged
   complete export plus exact saved bytes.
4. Name a recovery point and create a manual HR+CMS point; verify all workspace
   saves untouched. Inspect complete counts/bounded IDs and difference counts,
   then exercise existing selective restore/Undo safeguards.
5. Leave an HR subsection for the directory and return to it. Unsupported routes
   must not become remembered return locations.

Use actual rendered controls, fresh owned contexts and independent expected
values. Existing saved-state compatibility and generated role/capability source
bindings are review gates. Run the required full CI, Hosting preflight, drift,
template, documentation and repository/wiki parity checks before publication.
No production deployment, account connection or provider execution belongs to
this local batch. Reusable SYSTEMX context/plan/task/memory seeds remain blank.
