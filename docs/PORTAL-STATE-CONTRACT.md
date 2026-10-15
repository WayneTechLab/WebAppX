# Portal state and browser retention contract

This contract describes the native, account-free HR, CMS and CRM demos. It
addresses WX-0060 and WX-0601. A **saved draft** is a workspace record created by
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
| `webappx.demo.hr` | Onboarding profile/job/task checks, stages and receipts; edited synthetic work email and employee status; draft, submitted and approved time entries, including stopped timers that were added as records; draft/reviewed/confirmed benefit elections; the current payroll simulation, inputs, calculated totals and submitted payroll history; time-off requests, balances, task/policy/training/asset/document records and people-operation activity; service requests, assignments, resolution text and activity; recruiting draft/published/closed jobs, candidate details/stages/activity and linked hired employees; performance goals and saved private self/manager review comments, stages and activity; survey drafts, questions, audience IDs, saved draft and submitted identified answers, receipts and activity; completed fixture checklist keys and acknowledgements; selected management preview role and employee preview identity. |
| `webappx.demo.cms` | All editorial entries: draft title/slug/body, current revision and status, author ID, reviewer feedback, approval revision/reviewer/receipt, and frozen published title/slug/body/revision/receipt where present; CMS action receipts/activity and sequence. Published snapshots remain readable beside later draft edits until replaced or retired by an application action. |
| `webappx.demo.crm` | Fictional company names and owner IDs; contact names, email addresses, company/owner links; lead names, emails, company names, status and conversion links; opportunity titles, amounts, stages, company/contact/owner/lead links; follow-up task titles, owners, opportunity links and status; CRM activity receipts/descriptions and sequence. |
| `webappx.demo.restore-points` | Before each successful combined selective restore or Undo, complete **current record snapshots for the selected portals only**, plus point ID, UTC creation time, restore/undo kind, selected module IDs and (for Undo) source point ID. These snapshots can contain all of the private mock drafts and fictional contact details listed above. They contain no unsaved forms or running timers. |

The native schemas are defined by
[`HrDemoState`](../src/hr/persistence.ts),
[`CmsState`](../src/cms/model.ts),
[`CrmState`](../src/crm/model.ts) and
[`RestorePoint`](../src/portals/restore-points.ts). The
[`persistence helpers`](../src/portals/persistence.ts) enforce a 2,000,000
serialized-character limit per workspace envelope. This is a character count,
not a quota promise in bytes. Browser quota can reject a smaller save.

## Temporary UI and navigation

Within the portal shell, CMS and CRM stay mounted while hidden. HR also stays
mounted, but its hidden pathname becomes `/hr/demo/admin`; a previously open
HR subpage is replaced by the management dashboard. Returning through the
shared HR link opens that dashboard. This distinction comes from
[`TemplatePortalsPage`](../src/pages/TemplatePortalsPage.tsx), rather than a
general promise that every subpage stays open.

| Portal | Survives switching to another portal or the directory in the same document | Clears or changes during ordinary navigation | After a successful combined restore or Undo that selects this portal |
| --- | --- | --- | --- |
| HR | Workspace records, including saved management role and employee identity, remain in the shared provider. The native workspace-level feedback and backup-preview state can remain mounted. | Leaving an HR subpage for another portal/directory replaces its route content. Unsaved profile email; directory search/status; time-entry date/hours and live timer; payroll-history totals selection; leave request selections/dates; service-request drafts/filter/assignment/resolution; recruiting forms/filters/selected candidate; goal/review form edits; and unsaved survey questions/answers clear when their owning subpage unmounts. HR subpage, identity and keyed-component changes can also clear the affected local UI. A running timer does not become a time entry when it is canceled. | The whole native HR view remounts with the restored records. Its unsaved forms, live timer, local selections/messages and individual-backup preview clear. Management role and employee identity come from the restored HR workspace, because they are saved records. |
| CMS | Current preview identity, selected entry, collection/search filters, unsaved create/edit text and review-feedback text, messages and individual-backup preview remain while their current form is mounted. | Changing identity changes available forms; selecting another entry or saving a revision remounts the keyed edit form. Changing a form's owning entry/identity can discard that form's unsaved text. Reloading or leaving the entire portal shell creates fresh local UI. No live timer exists. | The whole CMS view remounts: author preview, default selected sample article, all collections, empty search, fresh form inputs based on restored records, and cleared feedback/backup preview. If the default entry is absent from the restored workspace, no selected-content editor is shown until an entry is chosen. |
| CRM | Current preview identity, selected tab, current tab's unsaved lead/company/contact/opportunity/follow-up fields, opportunity company/contact selection, feedback and individual-backup preview remain. | Changing tabs unmounts the previous tab's forms; changing identity remounts the keyed tab content and clears those forms. Changing opportunity company remounts the contact selector. Reloading or leaving the entire portal shell returns to owner preview and Dashboard. No live timer exists. | The whole CRM view remounts: owner preview, Dashboard, cleared current forms/local selections/feedback and individual-backup preview, with restored records. |

All unsaved fields, live timer metadata, temporary filters, tab selections and
CMS/CRM preview identities in the table are excluded from `localStorage`, JSON
workspace downloads and restore points. HR's management role and employee
identity are the explicit saved-selection exception. A reload clears temporary
UI even when saved workspace records return.

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
| Successful native action | Updates the current workspace and writes its complete envelope synchronously in the action turn. Other portal saves are separate. | Action-specific; a successful create may reset its form, and saved revision/identity keys can remount affected forms. | No automatic point. |
| Single-portal import | Validates and saves a complete replacement before accepting it in memory. Other portal records stay unchanged. | On success, the importing portal clears its form generation; CMS returns to author/default selection/all collections/empty search; CRM returns to owner/Dashboard. HR restores saved role/employee selections from the imported data. | No automatic point. |
| Portal Reset | Recreates that portal's fictional seed and removes its workspace slot. Other workspace saves stay unchanged. | HR clears route-local forms through its reset generation and restores seed role/employee selections. CMS resets identity/entry/filters/forms. CRM resets forms/tab to Dashboard but preserves its current preview identity. | **Preserved.** Reset does not delete older snapshots of that portal. Undoing a retained point can therefore reintroduce records that were reset. |
| Combined selective restore / Undo | Validates the complete backup or selected saved point, captures current selected records, then saves history and all selected workspace replacements. Only after success does the provider accept the selected states and advance their revision keys. It replaces whole workspaces, with no merge. | Only selected portal roots remount. CMS/CRM temporary UI in unchecked portals is retained; leaving HR for the directory can already have cleared its route-local UI before the operation. | Adds a point first, including before Undo so Undo can be reversed. Newest first; at most 5 points within 2,000,000 serialized characters. Oldest points are removed as needed. An oversized newest point rejects the restore. |
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
evidence. It checks draft time retention versus canceled timer/unsaved inputs,
CMS/CRM mounted form behavior, selected replacement and untouched-portal UI,
restore snapshots, Reset versus history, and refresh. An isolated denied-storage
fixture checks that accepted records can still be exported from memory. Reports
and downloads belong in the runner's temporary artifact directory, outside
tracked reusable files. This is local browser evidence only.
