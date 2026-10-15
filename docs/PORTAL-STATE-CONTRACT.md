# Portal state and browser retention contract

This contract describes the native, account-free HR, CMS and CRM demos. It
addresses WX-0060 and WX-0601, including guarded navigation, controlled drafts,
optional replacement checkpoints, sample payroll/time corrections and recovery
inspection. This is a **current source contract**; the new safety behavior's
execution and acceptance are recorded separately in the
[safety QA receipt](PORTAL-SAFETY-QA-2026-10-15.md). A source description does not
promote a preliminary run to final browser evidence.
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
| `webappx.demo.restore-points` | Complete **current record snapshots for the selected portals only**, captured manually, before combined selective restore/Undo, or before individual import/Reset when its separate checkpoint option is enabled; point ID, UTC creation time, `manual`/`restore`/`undo`/`import`/`reset` kind, selected module IDs, optional label and (for Undo) source point ID. These snapshots can contain all of the private mock drafts and fictional contact details listed above. They contain no unsaved forms or running timers. |
| `webappx.demo.recovery-preferences` | Separate schema-version-1 booleans `beforeImport` and `beforeReset`, shared by native portals at this origin. Both are off when the slot is absent. Explicit setting changes persist both choices; workspace exports and restore-point snapshots exclude them. Unreadable or malformed settings are an error, rather than evidence that either option is off. |

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

### Shared unsaved-work decisions

Registered dirty forms are checked before a transition that can hide or destroy
them. The shared **Leave with unsaved changes?** dialog lists the affected form
groups and offers **Keep editing** or **Discard and leave**. Keep cancels the
pending transition, retaining exact inputs; where a hidden form supplies an
owner/focus target, its retained supported portal view is activated before
focus returns. Discard resets only the affected registered form groups and then
performs the pending transition once. Neither choice creates domain records.

Moving to another portal or the directory can also offer **Leave and keep
draft**, because the owning portal remains mounted. That choice keeps its
temporary inputs in the open document. Same-portal subpage/SDK changes and
destructive tab/identity transitions do not promise this retained option.
Leaving the whole portal shell considers dirty groups in all retained portals;
exiting it clears volatile session slots. Browser Back/Forward and app links
use the same guarded navigation driver. Closing/reloading uses the browser's
native unload warning when dirty work exists; prompt display/text depends on
the browser and does not save a draft.

Clean Back/Forward traversal uses the browser's observed destination normally.
**Every guarded dirty history traversal** uses a disclosed current-slot fallback,
including when native positions or owned markers are available: position alone
does not prove the cause of an asynchronous traversal event. The dialog explains
that the approved page is kept **at the current browser history position** and
that leaving opens the requested destination at that same position. Keep
preserves drafts and the approved route there. Only Discard or an offered
retained-draft choice accepts the original requested URL into that slot. The
fallback adds no entries and does not truncate the forward stack; the driver
issues no `history.go()`, search/watchdog traversal or pending retry. Back/Forward
entries may therefore differ, and exact prior stack/entry restoration is not
promised. Ordinary AppLink push navigation retains its separate guarded push
behavior. See the [navigation driver](../src/lib/navigation.ts).

Directory cards and shared return links remain pathname-only. Retained-owner
focus may preserve that owner's observed query/hash only when its pathname
matches the shell-validated supported owner pathname. An unsupported observed
descendant cannot replace the validated owner destination.

HR registers meaningful profile, manual-time/timer/correction/return, period/rate,
leave, request, recruiting, performance and survey form groups. Its role/identity
changes and affected record-local actions guard the corresponding scope. CMS
registers the editor, create form and separate per-entry feedback, including
hidden author inputs. CMS identity switching itself retains these controlled
buffers. CRM registers controlled lead, conversion amount, company, contact,
opportunity and follow-up drafts; tab and preview-identity changes guard the
affected CRM groups. Filters, messages and persisted records are not dirty work
by themselves. Each successful accepted action synchronously rebases its own
form group, including accepted memory-only actions, so it does not prompt for
already accepted work or erase another form's draft. Validation/refusal keeps
the affected draft dirty. See the [shared controller](../src/portals/unsaved-work-core.ts)
and [React integration](../src/portals/unsaved-work.tsx).

| Portal | Survives switching to another portal or the directory in the same document | Clears or changes during ordinary navigation | After a successful combined restore or Undo that selects this portal |
| --- | --- | --- | --- |
| HR | Workspace records and saved management role/employee identity remain. After an offered Leave and keep draft decision, the last supported subpage's mounted inputs, timer, filters/selections/messages and backup preview remain across portal/directory switches. | A guarded same-portal subpage or role/identity transition can unmount its previous forms after Discard; Keep preserves them. Reset/import generation changes clear affected local UI after acceptance. Unguarded local filters/selections still follow their owning component lifetime. A canceled timer creates no time entry. | The native HR view remounts at the remembered supported pathname with restored records. Its unsaved forms, timer, selections/messages and individual-backup preview clear. Management role and employee identity come from the restored saved records. |
| CMS | Preview identity, selection, collection/search filters, create/editor/per-entry feedback buffers, messages and backup preview remain during retained portal navigation. Create/edit buffers survive switching identity away from author and back; hidden author edits are labeled temporary. | Dirty entry selection has its separate **Keep editing** / **Discard changes and switch** choice. Keep returns to the editor or its recovery comparison; Discard drops that editor buffer and selects the target. Clean entry selection switches directly. Successful save clears only its editor buffer, successful create clears its create form, and successful return clears that entry's feedback. Reload/shell exit clears all temporary state. | CMS resets author/filters/search/create/feedback/backup state, but retains the editor's exact raw unsaved text in a volatile slot. If meaningful dirty text predates the accepted replacement, a comparison requires explicit reload/reapply before ordinary editing/save. The edited entry is selected when present; otherwise the normal sample/first available entry is used and missing-entry recovery is shown. |
| CRM | Preview identity, active tab and controlled drafts survive retained portal navigation. The mounted tab keeps lead/company/contact/opportunity/follow-up inputs and conversion amounts, local selections, feedback and backup preview. | Tab and identity changes ask about affected dirty groups before their keyed content unmounts. Keep cancels the change; Discard resets those drafts then changes view. Opportunity company change resets its dependent contact selection. Successful actions rebase only their submitted form. Reload/shell exit starts owner preview and Dashboard. | CRM returns to owner preview/Dashboard with restored records; selected replacement clears its controlled drafts, local selections/feedback and backup preview. |

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

### CMS editor comparison after accepted replacement

Only an **accepted** individual import, selected restore or Undo advances the
replacement epoch and retains the prior editor for replacement recovery.
Canceled/refused/failed replacement leaves the current editor and records in
place. Accepted Reset deliberately clears the volatile editor as well as the
other CMS temporary forms. No editor text is stored in browser saves, exports
or history.

Meaningful dirty text from before replacement is shown in **CMS editor recovery**
beside its exact editor baseline and restored title/slug/body, including when
the restored record has the same numeric revision but different content.
**Reload restored draft** discards that buffer. **Reapply unsaved text** copies
only meaningfully edited fields onto the restored record's current editor;
untouched and normalization-only fields retain restored values. Both choices
change temporary state only; **Save draft revision** must still validate and
accept the new revision. Invalid reapplied text remains editable with field
errors. Reapply is unavailable for a missing entry or anyone except its assigned
author. The comparison token binds the replacement epoch, restored record,
baseline and exact raw buffer; a changed or obsolete comparison is refused.
See [editor recovery](../src/cms/editor-recovery.ts).

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
| Single-portal import | Validates and saves a complete replacement before accepting it in memory. Its confirmation binds current records, incoming data and reviewed preferences; enabled checkpoints also bind history. Other portal records stay unchanged. | On success, importing forms reset. CMS returns to author/all collections/empty search and retains only its editor buffer for explicit comparison; CRM returns to owner/Dashboard. HR restores saved role/employee selections. A refusal leaves the existing UI/records open. | Known-off: no point. Enabled: first saves a selected-portal point with kind `import`, labeled **Before [HR/CMS/CRM] individual import**, then saves the replacement. |
| Portal Reset | Recreates that portal's fictional seed and removes only its workspace slot. Known-off preserves the original one-click/memory-only-removal-failure semantics. Enabled requires its reviewed confirmation and successful checkpoint/removal before accepting the seed. | Accepted Reset clears affected forms/timers; HR restores seed role/employee selections; CMS clears its volatile editor and other forms; CRM returns to Dashboard and preserves its preview identity. | Existing history is retained, subject to normal oldest-point pruning only when a new required capture is added. Known-off creates no point. Enabled adds kind `reset`, labeled **Before [HR/CMS/CRM] Reset**. Older points can still reintroduce reset records through Undo. |
| Create named restore point | Captures the complete current in-memory records of explicitly selected portals, including seeds or accepted memory-only changes. Does not import, apply or write any workspace slot. | Does not advance portal revision keys; mounted forms, timers and selections remain. | Writes history alone with kind `manual` and a required trimmed, single-line label of 1–100 characters. Preview shows projected character use and pruning. Uses the same 5-point/2,000,000-character budget as automatic captures. |
| Rename point | Changes only the persisted label of the selected existing point. Its ID, creation time, kind, scope, captured records and source-point link remain exact. Workspace slots remain unchanged. | Does not advance portal revision keys. | Writes history alone. Does not recreate, reorder or prune captures; an oversized or invalid label is refused. |
| Combined selective restore / Undo | Validates the complete backup or selected saved point, captures current selected records, then saves history and all selected replacements. Only success accepts states and advances selected revision keys. Whole workspaces are replaced without merge. | Selected roots reset their temporary UI, with the retained CMS editor comparison exception above. Unchecked portals retain current records and mounted temporary state. | Adds a point first, including before Undo so Undo can be reversed. Newest first; at most 5 points within 2,000,000 serialized characters. Oldest are pruned as needed. An oversized newest point rejects restore. |
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

### Separate optional import and Reset checkpoints

**Require checkpoint before individual imports** and **Require checkpoint before
Reset** are independent, origin-wide native-portal preferences. Absence of their
separate slot is a known default-off state. Malformed/unreadable preferences
are unknown: imports and Reset fail closed until settings can be read and the
user explicitly saves the displayed choices. Unknown preferences do not silently
disable a previously required capture. Other ordinary accepted actions can still
remain only in memory when storage is unavailable.

An enabled action shows its selected-portal capture, projected serialized
characters, retained count and oldest-point pruning before confirmation. This
preview performs no writes and reserves no quota. Confirmation rechecks exact
current/incoming records, both settings and the enabled history snapshot before
writing; stale or missing confirmation refuses replacement and refreshes the
review. Even a known-off individual import binds the visible replacement
preview. A known-off one-click Reset has no checkpoint preview promise to bind.

For an enabled import/Reset, history is saved and read back before the selected
workspace is written/removed and read back. Any capture, size, storage or
readback failure refuses memory acceptance. Rollback attempts exact prior
history and selected-slot bytes, including a write that changed before throwing.
If rollback cannot be confirmed, memory remains open and the UI identifies
uncertain slots and requires export before refresh. Unselected workspace saves
and unrelated preferences are outside the write set. Combined restore/Undo
continue to require automatic capture independently of these two settings.
See [preferences](../src/portals/recovery-preferences.ts),
[replacement coordinator](../src/portals/replacement-recovery.ts) and the
[worked failure drill](PORTAL-RECOVERY-FAILURE-DRILL.md).

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

CMS entry differences also expose bounded allowlisted collection ID, draft and
approval/publication revisions, workflow state, reviewer/receipt IDs and separate
draft/approval/publication projection change labels. CRM company/contact/lead/
opportunity differences show bounded owner and linked company/contact/lead/
opportunity IDs plus lead state or opportunity stage. Added/removed metadata
uses an explicit absent side. Per-category detail rows share the eight-ID default
limit and exact omitted counts; full hidden payloads still decide changes.

The detail/difference panels expose identifiers, counts and that allowlisted
structured metadata, without names, emails, titles, body text, comments,
answers, amounts or reasons. CMS's separate **editor recovery comparison**
intentionally shows the user's raw baseline/restored/unsaved text in its own
editing context; it is not the count/metadata-only restore difference panel.
The underlying
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
memory in known-off mode when the browser refuses to remove an old save; that old save may return
after refresh. A later successful saved action replaces the portal envelope.
The application does not claim cross-tab synchronization.

An incompatible/damaged workspace save opens fresh fictional records and
reports recovery without silently deleting the old slot. Reset removes it, or
the next successful saved action replaces it. Damaged/unreadable restore history
blocks restore/Undo until the user clears or recovers it. A combined restore
that cannot save its automatic recovery point is not applied. Enabled individual
import/Reset also refuses unusable history. The
[failure drill/runbook](PORTAL-RECOVERY-FAILURE-DRILL.md) orders preservation,
independent save checks and explicit discard of unusable history without
claiming that the lost history was repaired.

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

The [safety QA receipt](PORTAL-SAFETY-QA-2026-10-15.md) distinguishes development,
frozen-runtime and integrated observations for the new guard/editor/checkpoint
behavior. The [status inventory](PORTAL-STATUS-INVENTORY.md) describes actual
rendering, controlled rare-state fixtures and monochrome boundaries. The
[recovery failure drill](PORTAL-RECOVERY-FAILURE-DRILL.md) uses explicit isolated
storage faults and real uploads/downloads to compare current memory, saved slots
and history. Consult the dated receipt for which executions are complete; these
source links alone establish no new browser, accessibility or provider result.

This is a current source contract. Dated QA receipts retain their original
source and observation scope; updating this guide does not refresh a historical
browser observation or establish provider adoption. The documentation freshness
mapping and dated review decision must be deliberately rebound by the maintainer
to a reviewed source revision and this guide's digest.
