# Portal state and browser retention contract

This contract describes the native, account-free HR, CMS and CRM demos. It
addresses WX-0060 and WX-0601, including the current return-location, controlled
CMS buffer, sample payroll/time-correction and recovery inspection behavior.
A **saved draft** is a workspace record created by
an application action, even when its workflow stage is still `draft`. An
**unsaved input** is text or a selection still held by a form. Only workspace
records enter workspace saves, exports and recovery snapshots.

## Browser-retained records

The three workspace slots use `localStorage` at the current browser origin
(scheme, hostname and port). Each stores readable JSON with
`{ schemaVersion: 1, module, data }`. A fresh workspace opens its fictional seed
without writing a workspace slot; the first saved action writes the whole
workspace. There is no automatic expiry or background upload in this contract.
Browser deletion, profile deletion or eviction can remove these saves. People
using the same browser profile and address can read them. Use fictional data
only; preview identities do not provide authentication or provider authority.

| Browser slot | Retained categories after a successful saved action |
| --- | --- |
| `webappx.demo.hr` | Onboarding profile/job/task checks, stages and receipts; edited synthetic work email and employee status; draft, submitted and approved time entries, including stopped timers added as records, saved date/hour corrections and manager return reasons/identity; optional effective-dated fictional hourly rate timelines; draft/reviewed/confirmed benefit elections; the current payroll simulation, chosen sample period, frozen dated/rated inputs, calculated totals and submitted payroll history; time-off requests, balances, task/policy/training/asset/document records and people-operation activity; service requests, assignments, resolution text and activity; recruiting draft/published/closed jobs, candidate details/stages/activity and linked hired employees; performance goals and saved private self/manager review comments, stages and activity; survey drafts, questions, audience IDs, saved draft and submitted identified answers, receipts and activity; completed fixture checklist keys and acknowledgements; selected management preview role and employee preview identity. |
| `webappx.demo.cms` | All editorial entries: draft title/slug/body, current revision and status, author ID, reviewer feedback, approval revision/reviewer/receipt, and frozen published title/slug/body/revision/receipt where present; CMS action receipts/activity and sequence. Published snapshots remain readable beside later draft edits until replaced or retired by an application action. |
| `webappx.demo.crm` | Fictional company names and owner IDs; contact names, email addresses, company/owner links; lead names, emails, company names, status and conversion links; opportunity titles, amounts, stages, company/contact/owner/lead links; follow-up task titles, owners, opportunity links and status; CRM activity receipts/descriptions and sequence. |
| `webappx.demo.restore-points` | Complete **current record snapshots for the selected portals only**, captured manually in a named point or before each successful combined selective restore or Undo; point ID, UTC creation time, manual/restore/undo kind, selected module IDs, optional label and (for Undo) source point ID. These snapshots can contain all of the private mock drafts and fictional contact details listed above. They contain no unsaved forms or running timers. |

The native schemas are defined by
[`HrDemoState`](../src/hr/persistence.ts),
[`CmsState`](../src/cms/model.ts),
[`CrmState`](../src/crm/model.ts) and
[`RestorePoint`](../src/portals/restore-points.ts). The
[`persistence helpers`](../src/portals/persistence.ts) enforce a 2,000,000
serialized-character limit per workspace envelope. This is a character count,
not a quota promise in bytes. Browser quota can reject a smaller save.

## Temporary UI and navigation

Within the same mounted portal shell, all three native portals stay mounted
while hidden. The shell remembers each portal's last supported pathname;
directory cards and shared portal links return there. Hidden HR keeps that
pathname, so its current subpage's forms and live timer remain mounted during a
visit to CMS, CRM or the directory. Unavailable routes do not overwrite the
remembered supported pathname. Return locations omit query/hash and normalize
trailing slashes; the original deep-link URL retains its own query/hash until
navigation. This memory is temporary shell state, excluded from workspace saves
and exports; a reload starts a new shell at the current URL. The behavior is in
[`TemplatePortalsPage`](../src/pages/TemplatePortalsPage.tsx) and
[`routes`](../src/portals/routes.ts).

| Portal | Survives switching to another portal or the directory in the same document | Clears or changes during ordinary navigation | After a successful combined restore or Undo that selects this portal |
| --- | --- | --- | --- |
| HR | Workspace records, including saved management role and employee identity, remain in the shared provider. The last supported subpage and its mounted inputs, live timer, local filters/selections/messages and individual-backup preview remain across portal/directory switches. | Navigating to a different HR subpage unmounts the previous content. Its unsaved profile email; directory search/status; time-entry date/hours/correction forms/live timer; payroll period/rate inputs and history-total selection; leave drafts; service-request forms/filter; recruiting forms/filters/selection; goal/review edits; and survey questions/answers clear when their owning component unmounts. HR preview-identity, reset and import generation changes also clear affected local UI. A canceled timer creates no time entry. | The whole native HR view remounts at the remembered supported pathname with restored records. Its unsaved forms, live timer, local selections/messages and individual-backup preview clear. Management role and employee identity come from the restored HR workspace, because they are saved records. |
| CMS | Current preview identity, selected entry, collection/search filters, controlled create draft, selected-entry editor buffer and per-entry review-feedback buffers, messages and individual-backup preview remain. Create/edit buffers survive switching identity away from author and back. Hidden author edits are labeled as temporary. | Selecting a different entry while its editor is dirty first asks **Keep editing** or **Discard changes and switch**. Keep retains the current entry/buffer and focuses its title; Discard changes the selection and drops only that editor buffer. Selecting a different entry with a clean editor switches directly. Successful save resets that editor buffer to saved fields; successful create clears its create buffer. Review feedback clears after a successful return action. Identity switches change visible controls without discarding these controlled buffers. Reloading or leaving the shell creates fresh local UI. No live timer exists. | The whole CMS view remounts: author preview, default selected sample article, all collections, empty search, fresh form inputs based on restored records, and cleared create/editor/review-feedback/validation/backup state. If the default entry is absent, no selected-content editor is shown until an entry is chosen. |
| CRM | Current preview identity, selected tab, current tab's unsaved lead/company/contact/opportunity/follow-up fields, opportunity company/contact selection, feedback and individual-backup preview remain. | Changing tabs unmounts the previous tab's forms; changing identity remounts the keyed tab content and clears those forms. Changing opportunity company remounts the contact selector. Reloading or leaving the entire portal shell returns to owner preview and Dashboard. No live timer exists. | The whole CRM view remounts: owner preview, Dashboard, cleared current forms/local selections/feedback and individual-backup preview, with restored records. |

All unsaved fields, live timer metadata, temporary filters, tab selections and
CMS/CRM preview identities in the table are excluded from `localStorage`, JSON
workspace downloads and restore points. HR's management role and employee
identity are the explicit saved-selection exception. A reload clears temporary
UI even when saved workspace records return.

CMS validates controlled create/edit drafts before a saved action. Invalid
submissions retain the buffer, identify field errors, and focus the first
invalid field without changing the saved workspace. Dirty editor content must
be saved before Request review is available. Keep, Discard, identity switches
and validation feedback are temporary UI decisions, not editorial revisions.

HR's exact local inputs are in
[`HrWorkspace`](../src/hr/components/HrWorkspace.tsx),
[`PeopleOperations`](../src/hr/components/PeopleOperations.tsx),
[`HrServiceDesk`](../src/hr/components/HrServiceDesk.tsx),
[`HrRecruiting`](../src/hr/components/HrRecruiting.tsx),
[`HrPerformance`](../src/hr/components/HrPerformance.tsx) and
[`HrSurveys`](../src/hr/components/HrSurveys.tsx). CMS and CRM keys and defaults
are in [`CmsDemo`](../src/cms/CmsDemo.tsx) and
[`CrmDemo`](../src/crm/CrmDemo.tsx).

## Save, replacement and recovery boundaries

| Action | Workspace records and saves | Temporary UI | Recovery history |
| --- | --- | --- | --- |
| Successful native action | Updates the current workspace and writes its complete envelope synchronously in the action turn. Other portal saves are separate. | Action-specific; a successful create/save can reset its controlled buffer, and identity or record keys can remount affected forms. | No automatic point. |
| Single-portal import | Validates and saves a complete replacement before accepting it in memory. Other portal records stay unchanged. | On success, the importing portal clears its form generation; CMS returns to author/default selection/all collections/empty search; CRM returns to owner/Dashboard. HR restores saved role/employee selections from the imported data. | No automatic point. |
| Portal Reset | Recreates that portal's fictional seed and removes its workspace slot. Other workspace saves stay unchanged. | HR clears route-local forms through its reset generation and restores seed role/employee selections. CMS resets identity/entry/filters/forms. CRM resets forms/tab to Dashboard but preserves its current preview identity. | **Preserved.** Reset does not delete older snapshots of that portal. Undoing a retained point can therefore reintroduce records that were reset. |
| Create named restore point | Captures the complete current in-memory records of explicitly selected portals, including seeds or accepted memory-only changes. Does not import, apply or write any workspace slot. | Does not advance portal revision keys; mounted forms, timers and selections remain. | Writes history alone with kind `manual` and a required trimmed, single-line label of 1–100 characters. Preview shows projected character use and pruning. Uses the same 5-point/2,000,000-character budget as automatic captures. |
| Rename point | Changes only the persisted label of the selected existing point. Its ID, creation time, kind, scope, captured records and source-point link remain exact. Workspace slots remain unchanged. | Does not advance portal revision keys. | Writes history alone. Does not recreate, reorder or prune captures; an oversized or invalid label is refused. |
| Combined selective restore / Undo | Validates the complete backup or selected saved point, captures current selected records, then saves history and all selected workspace replacements. Only after success does the provider accept the selected states and advance their revision keys. It replaces whole workspaces, with no merge. | Only selected portal roots remount and clear their temporary UI. Unchecked HR/CMS/CRM retain their mounted subpage/forms/timers/selections and current records. | Adds a point first, including before Undo so Undo can be reversed. Newest first; at most 5 points within 2,000,000 serialized characters. Oldest points are removed as needed. An oversized newest point rejects the restore. |
| Clear restore points | Leaves current HR/CMS/CRM records and workspace slots unchanged. | Does not advance portal revision keys. | Removes only `webappx.demo.restore-points` after explicit confirmation. Downloaded files remain separate. |
| Clear browser/site data | Browser-controlled deletion may remove workspace slots, history and other app preferences for that origin. | A later page load opens seeds when no saves exist. | Browser-controlled; separate downloaded backups are not managed by this application. |

The shared owner and selected-root revision changes are in
[`PortalWorkspaceProvider`](../src/portals/PortalWorkspaceProvider.tsx).
[`useDemoPersistence`](../src/portals/useDemoPersistence.ts) owns native state;
[`restore-workspaces`](../src/portals/restore-workspaces.ts) and
[`restore-budget`](../src/portals/restore-budget.ts) prepare and commit selected
saves and recovery history. `localStorage` has no multi-key transaction: these
helpers attempt rollback if a write fails and report uncertain recovery if a
rollback also fails. A failed combined restore does not accept replacement
states or remount portal roots. Follow its displayed export/recovery guidance
before refreshing if browser saves may differ from the still-open memory state.

## Sample time, periods and rates

Only an employee's own unpaid draft time can be edited or explicitly deleted.
Submitted unpaid time can be returned to draft by a different scoped manager,
with a saved single-line reason; the employee can correct and resubmit it.
Date/hour validation and the combined 24-hour employee/day limit apply to
creation, correction, submission and approval. Submitted, approved or
payroll-consumed entries cannot be edited/deleted as drafts; consumed time
cannot be returned or approved again.

New sample payroll preparation requires an explicit inclusive period of 1–366
calendar days and an explicit fictional hourly rate for every otherwise eligible
employee/work date. Rate changes append a later effective date to an employee's
timeline; the latest rate effective on each work date is frozen in its prepared
input with that date. Fixture compensation has no assumed hourly cadence and is
not inherited as a rate. An absent rate timeline remains absent in legacy saves.
Eligibility excludes unpaid drafts/submissions, out-of-period or inactive
employees, invalid hours and already-consumed entries, with reasons shown.

Approved input, eligibility, rate or confirmed-benefit changes can make an open
preparation stale. Calculate/review/submit refuse stale preparation until it is
deliberately prepared again. Submitted receipts retain their original period,
inputs and totals; later rate changes do not rewrite them. Optional new fields
preserve existing legacy save shapes. Legacy unsubmitted preparation needs an
explicit period and rates before it can continue. Legacy submitted statements
retain the historical fixed-period fallback. All calculations are fictional
local examples, outside provider payroll, funding, tax or legal acceptance.

## Captured detail and structured differences

**Inspect captured records** reads a selected point without applying it.
[`workspace-inspection`](../src/portals/workspace-inspection.ts) and
[`WorkspaceInspection`](../src/portals/WorkspaceInspection.tsx) provide complete
HR/CMS/CRM collection counts and bounded stable identifiers. HR includes nested
onboarding/payroll/rate, service, recruiting, performance and survey collections;
CMS includes approval and frozen-publication snapshots; CRM includes every saved
entity and activity collection. Maps count by key; current payroll counts once
even when idle. Nested records/containers are separate from primary totals.
Preview flags, saved selections and sequence counters are metadata, excluded
from entity totals. Static fixture directories are not captured record instances.

Selective restore and Undo show current-to-target added, removed and changed
entity counts for selected modules before confirmation. Identity determines
membership; reordering identified collections alone is unchanged. The complete
saved payload participates in change detection, including hidden fields. A
nested change may also change its complete parent, so nested rows do not add to
module primary totals. Each collection/change category displays at most eight
identifiers by default with exact omitted counts. Invalid/duplicate identities
or bounded traversal overflow refuse inspection with a fixed message.

The detail/difference panels expose identifiers and counts, without names,
emails, titles, content, comments, answers, amounts or reasons. The underlying
restore point and downloaded backup still contain readable complete fictional
records. Inspection is not anonymization, authentication or authorization, and
has no restore/write/activity side effects.

Undo confirmation binds the complete point used by the displayed preview.
Before writing, it rereads persisted history and requires the same point ID and
exact captured point payload, including scope, label and creation time. A missing
or changed point is refused; refresh and review the current capture before
retrying. A point with the same ID and different records cannot silently replace
the preview target. Current selected records are captured for the reverse Undo
only after this check and normal validation/budget checks succeed.

## Storage unavailable, damaged saves and exports

When a normal action cannot save, its accepted records remain in the current
page's memory and the UI reports that refresh may lose them. They still follow
the mounted-session navigation behavior above. Reset can also succeed only in
memory when the browser refuses to remove an old save; that old save may return
after refresh. A later successful saved action replaces the portal envelope.
The application does not claim cross-tab synchronization.

An incompatible/damaged workspace save opens fresh fictional records and
reports recovery without silently deleting the old slot. Reset removes it, or
the next successful saved action replaces it. Damaged/unreadable restore history
blocks restore/Undo until the user clears or recovers it. A combined restore
that cannot save its automatic recovery point is not applied.

Single downloads use `format: "webappx-mock-workspace"`; combined downloads use
`format: "webappx-mock-workspaces"`, both at schema version 1 with a UTC export
timestamp. They serialize **current accepted in-memory workspace records**,
including seed records, saved drafts and accepted changes whose browser save
failed. They exclude unsaved UI, running timers, recovery history, unrelated
browser settings and the separate SDK session. They are readable JSON files on
the device; exporting does not upload records or write a workspace save.
See the [single codec](../src/portals/backup.ts),
[combined codec](../src/portals/combined-backup.ts) and
[backup controls](../src/portals/CombinedWorkspaceBackup.tsx).

The [`Gusto SDK preview`](../src/hr/gusto/GustoSdkPreview.tsx) uses a separate
synthetic session and is outside native HR persistence, exports and restore
points. Moving between it and native HR changes the rendered HR component. The
native workspace contract does not establish SDK session retention, provider
wire behavior, live HR access or any production acceptance.

## Verification

[`portal-state-contract.mjs`](../tests/browser/portal-state-contract.mjs) uses a
fresh isolated browser context and the owned local browser runner. Ordinary
records are changed through rendered controls; browser storage is read for
evidence. It checks saved draft time, retained HR subpages/timers/forms versus
owning-subpage/identity cancellation, CMS controlled buffer identity retention
and dirty-switch Keep/Discard, CRM mounted form behavior, exact unchanged saved
payloads, selected replacement and untouched-portal UI,
restore snapshots, Reset versus history, and refresh. An isolated denied-storage
fixture checks that accepted records can still be exported from memory. Reports
and downloads belong in the runner's temporary artifact directory, outside
tracked reusable files. This is local browser evidence only.

[`portal-foundation.mjs`](../tests/browser/portal-foundation.mjs) covers the
shared directory/links, supported deep links, remembered HR return destinations,
keyboard breadcrumbs and explanation focus, unavailable pages, save summaries
and isolated damaged/denied-storage states. Both suites create their own
loopback Vite server, browser and isolated contexts and close only their owned
resources. They do not use or clear a private user's browser/profile/origin.

This is a current source contract. Dated QA receipts retain their original
source and observation scope; updating this guide does not refresh a historical
browser observation or establish provider adoption. The documentation freshness
mapping and dated review decision must be deliberately rebound by the maintainer
to a reviewed source revision and this guide's digest.
