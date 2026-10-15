# HR, CMS and CRM portals for the reusable template

WebAppX should support three connected business workspaces: people operations
(HR), publishing (CMS) and customer relationships (CRM). This document records
the source inventory and proposed adoption architecture as of October 14, 2026.
The account-free HR talent workflows, CMS editorial core and CRM relationship
workspace are implemented in this update. The broader adoption architecture
and shared backend described below remain proposed. Browser and repository
checks from the earlier talent wave are recorded in the
[talent and portals QA receipt](HR-TALENT-QA-2026-10-14.md). Current browser-local
persistence checks are recorded in the
[persistence QA receipt](PORTAL-PERSISTENCE-QA-2026-10-14.md). Portable file backup
checks are recorded separately in the
[per-portal backup QA receipt](PORTAL-BACKUP-QA-2026-10-14.md). Combined files and
selective restores are recorded in the
[combined backup QA receipt](COMBINED-BACKUP-QA-2026-10-14.md). Automatic local
restore-point and Undo checks are recorded in the
[restore-point QA receipt](RESTORE-POINTS-QA-2026-10-14.md). The shared registry
and restore storage-budget preview have their own
[P1 QA receipt](PORTAL-REGISTRY-BUDGET-QA-2026-10-14.md). No live
business portal is activated by the HR preview or an administrator signing in.

## Keyboard onboarding and recovery

Use **Tab** and **Shift+Tab** to move through normal page controls, **Enter** to
follow links or activate actions, and **Space** to activate buttons or toggle
checkboxes. Keyboard focus has a visible outline/ring on the journey's controls.
The restore and Undo previews are page regions; Tab continues through the page.

### Native onboarding

1. Open the native employee preview and **My profile**. A blank required
   **Synthetic work email** is rejected by native form validation, with focus
   remaining on that field. Save a fictional `.invalid` email when testing.
2. Open **My onboarding** and activate **Review sample profile**. Focus advances
   to **Review sample job** after the completed profile action disables itself.
3. Complete job review, then each required checklist action. Focus moves to
   the next required task; completed task buttons expose their pressed state.
4. When the checklist is ready, focus moves to **Review onboarding summary**,
   then **Confirm simulated onboarding** after review. Confirmation focuses the
   completion status and its mock receipt. Saved onboarding still follows the
   existing browser-local persistence rules.

### Selective restore, Undo and history

1. On `/portals`, activate **Import combined backup** with Enter. Choose a local
   compatible backup in the native file picker. Once validation succeeds, focus
   moves to **Choose workspaces to restore**. A rejected import returns focus to
   **Import combined backup** with its visible error.
2. Tab to each **Restore HR/CMS/CRM** checkbox and use Space to select a scope.
   None is chosen automatically. The budget preview and explicit confirmation
   rules still apply; a disabled Restore button cannot be activated.
3. Tab to **Restore selected workspaces** or **Cancel combined restore**. Success
   or cancellation returns focus to **Import combined backup**. Workspace/history
   semantics are the same as the pointer-operated flow.
4. Activate a point's **Undo…** button. Focus moves to its Undo heading. Inspect
   captured scope, record summaries and budget, then Tab to **Confirm undo** or
   **Cancel undo**. Closing the preview returns focus to the opening Undo button
   when it remains available. If retention removed it, focus lands on
   **Restore points & Undo** instead.
5. **Clear restore points** similarly focuses its confirmation heading.
   Cancelling returns to its opener; successful clearing uses the history heading
   when the now-disabled Clear button cannot receive focus.

### Automated scope

`npm run browser:keyboard` exercises the two authored keyboard journeys;
`npm run browser:keyboard:test` checks driver guards. The driver uses real Tab
traversal and keyboard press/type input, with read-only observations to verify
the active element, visible focus, states, history and exported payloads.
Initial navigation/reload and setting a file in a keyboard-opened native chooser
are explicit harness boundaries. These tests do not automate the operating
system file-picker key sequence or establish screen-reader, every-workflow or
whole-site WCAG acceptance. Read the
[keyboard QA receipt](KEYBOARD-PORTALS-QA-2026-10-15.md) for exact results and gates.

**Accepted local keyboard results — 2026-10-15:** **WX-0653/WX-0654** passed
nine browser checks (three onboarding and six recovery), with 110 onboarding
and 266 restore/Undo focus observations. Eleven keyboard driver guard tests and
16 existing seed/runner guards passed. Empty required email created no save;
the keyboard-completed onboarding receipt was exactly `MOCK-ONBOARDING-0001`,
and reload/full export matched independent expected records with CMS/CRM intact.

Keyboard cancellation preserved complete raw workspace/history bytes and export.
HR+CMS restore left CRM unchanged; Undo cancellation and confirmation returned
focus to the exact opening Undo button. Undo of the oldest point after five-point
retention removed its opener and focused **Restore points & Undo**. Reload
preserved the exact recovered states/history and five retained points. Both
owned resources closed; only the expected missing Firebase warning appeared.
Independent review had no unresolved findings. Clear-history focus handling is
implemented but is outside these nine accepted browser checks. Read the receipt
for final CI, preflight and drift results.

## What exists today

| Surface | Implemented source | Current boundary |
| --- | --- | --- |
| Public website | [App router](../src/router.tsx), public pages and shared layout | React/Vite routes; no CMS-backed publication pipeline |
| Demo portal directory | [Template portal shell](../src/pages/TemplatePortalsPage.tsx) | Account-free navigation between separately scoped HR, CMS and CRM samples; keeps modules mounted while switching demo portals |
| Shared portal registry | [Typed metadata](../src/portals/registry.ts) | One source for HR/CMS/CRM module identities, labels, descriptions and demo routes across the directory, navigation, cross-links and module validation |
| Combined mock backups | [Directory controls](../src/portals/CombinedWorkspaceBackup.tsx), [bundle codec](../src/portals/combined-backup.ts), [restore adapter](../src/portals/restore-workspaces.ts) | One validated local file, explicit selective whole-portal restore and rollback attempts; no cloud/account or atomic multi-key transaction |
| Automatic restore points | [History controls](../src/portals/RestorePointHistory.tsx), [history model](../src/portals/restore-points.ts) | Origin-local selected-scope snapshots before combined restore/Undo; latest five within 2,000,000 characters, explicit recovery confirmation and clearing |
| Staff entry | [Admin dashboard](../src/pages/AdminDashboardPage.tsx) | Firebase sign-in and trusted Level 4/5 claim gate; readiness cards link to local tools |
| HR workspaces | [HR portal](HR-PORTAL.md) and host-owned `src/hr/` | Working synthetic employee/manager/management workflows; versioned browser-local snapshot, separate protected live boundary |
| CMS workspace | [CMS demo](../src/cms/CmsDemo.tsx), [CMS transitions](../src/cms/model.ts), [CMS tests](../tests/portals/cms.test.mjs) | Working account-free draft/review/publish/retire core with frozen in-app public projection; browser-local snapshot persistence, no network publishing or server storage |
| CRM workspace | [CRM demo](../src/crm/CrmDemo.tsx), [CRM transitions](../src/crm/model.ts), [CRM tests](../tests/portals/crm.test.mjs) | Working account-free companies/contacts, lead conversion, opportunity pipeline and tasks; owner-scoped records and local receipts, no messaging or external sales operations |
| CMS and CRM local fixtures | [LAN server](../.SYSTEMX/LAN/server.mjs), [LAN guide](../.SYSTEMX/LAN/README.md) | Guarded local record editing in the developer control plane; not a deployed business portal |
| Page/source editing | [LAN stack contract](../.SYSTEMX/LAN/UNIFIED-AUTH-AND-STACK-CONTRACT.md) | Local source/page/metadata operations with backup, diff and confirmation controls |
| CMS design contracts | [Designer CMS schema](../.SYSTEMX/LAN/Builder/contracts/designer-cms.schema.json) | Collection, item, query, binding and form schema; not proof of an end-user publishing engine |
| Shared identity | [Firebase runtime](../src/config/firebase.ts), [account levels](../src/auth/accountLevels.ts) | Public/member/customer/staff shell access; no complete tenant/module membership service |
| Optional HR storage foundation | [Gusto Firebase guide](GUSTO-FIREBASE.md) | Explicit adoption work remains before durable live portal mutations |

The LAN is a developer/operator control plane. Deployed CMS and CRM portals
should be application routes with their own scoped services and records.
Keep LAN routes and source-edit capabilities outside production bundles.

### Shared directory and route recovery

Start only the native account-free workspaces with **`npm run dev:mock`**.
It prints its `/portals` URL, ignores environment files and inherited provider
configuration, and keeps Firebase/emulators/LAN connections disabled. Use
`npm run dev:mock -- --port 5185` when a stable browser-save origin is needed.
An occupied explicit port fails without replacing another listener. When the
app has no Firebase configuration, the visible **Account-free mode** notice
keeps the portals reachable and explains the optional sign-in setup.

Directory cards show the shared registry's description, workflows and preview
roles alongside each workspace's current save summary:

| Summary | Meaning |
| --- | --- |
| Ready | Sample fixtures are active; no successful domain save is required to browse, including after a successful Reset |
| Saved | A domain state saved successfully or loaded from the current browser origin; the detailed message distinguishes those cases |
| Recovered | A malformed/incompatible save was rejected and fixtures are active with an explanation; existing rejected bytes remain until a later successful action or explicit Reset replaces/removes them |
| Unavailable | Browser storage could not be read or written; current mock records may be usable in memory, but persistence is not guaranteed |

The summaries read the same provider state used inside each portal. Navigating
to the directory does not save fresh fixtures. They report local browser storage
and do not imply provider or cloud readiness.

A shared **Account-free mock workspace** banner appears across portal pages and
links to **How mock data is handled**. Breadcrumbs provide directory/workspace
return paths and HR portal/page context. Supported trailing-slash deep links
keep their original query and hash. Unknown descendants display a portal-specific
unavailable-page explanation with links back to that workspace or the directory;
showing or leaving the recovery page preserves saved fictional records.
Following **How mock data is handled** uses in-app navigation, retaining mounted
unsaved portal forms while showing the handling details.

Run **`npm run browser:foundation`** for the authored registry-card, route,
breadcrumb and save-summary checks, including isolated synthetic malformed/
unavailable-storage cases. The
[execution foundation receipt](EXECUTION-FOUNDATION-QA-2026-10-15.md) records
actual outcomes and separates normal UI actions from storage-fault injection.

**Accepted foundation results — 2026-10-15:** all nine authored browser checks
passed, including optional Firebase guidance, complete registry card content,
trailing-slash/query/hash preservation, keyboard breadcrumbs, unsupported-route
recovery, unsaved CMS/document preservation, save/refresh summaries and isolated
corrupted/denied-storage states. The 120 portal model tests and existing nine
keyboard browser checks also passed. Owned browser/server cleanup succeeded;
only the expected unset-Firebase warning appeared. The receipt records review
corrections, the 17 accepted IDs and final publication gates. The complete goal
remains active at **24 done / 976 remaining** across the 1,000-item catalog.

### Shared portal registry

`src/portals/registry.ts` is the source for the native demo portals' module
identities, display labels, descriptions and entry routes. The directory,
shared navigation and portal cross-links consume these entries instead of
maintaining separate catalogs. Backup and restore module validation use the
same known identities, keeping displayed choices aligned with accepted files.

The registry describes available app surfaces. It does not authenticate a
preview role, grant organization membership, activate a provider, share domain
records or add a tenant backend. HR's native demo and its separate SDK session
retain their existing boundaries. When adding a portal, start with this registry,
then explicitly add its state validator, persistence adapter, routes and tests;
metadata alone does not make a new module importable.

## Browser-local persistence

Native HR, CMS and CRM each save a separate versioned `localStorage` snapshot.
Saved domain actions survive refresh, leaving the demo area and returning, and
native HR remounts after visiting `/hr/demo/sdk`. The SDK sample keeps its own
independent state and is not persisted by this adapter. Modules do not copy
records or identities into one another.

| Module | Browser-local key |
| --- | --- |
| Native HR | `webappx.demo.hr` |
| CMS | `webappx.demo.cms` |
| CRM | `webappx.demo.crm` |

Each saved JSON envelope contains `schemaVersion: 1`, its `module` and `data`.
The adapter accepts at most 2,000,000 serialized characters per snapshot;
browser quota can impose a lower limit. Initial fixtures are not automatically
saved. Domain state updates save synchronously during the action, so an
immediate refresh does not wait for a React effect. Reset removes that module’s
key rather than storing another fixture snapshot.

The visible **Browser save.** notice distinguishes ready, saved, restored and
reset states. **Browser save needs attention.** reports unavailable storage or
a recovered incompatible/damaged save. If removing a saved snapshot fails,
Reset still restores fixtures in memory but warns that the previous save may
return after refresh; allow storage and Reset again. A rejected old snapshot
is replaced by the next successfully saved action or removed by Reset.

- Use the same browser profile and origin: scheme, hostname and port identify
  the storage location. A different port or `localhost` versus `127.0.0.1` opens
  a separate set of samples.
- Use each module’s **Reset** to clear only that saved snapshot and restore its
  fixtures. Clearing site data or ending some private-browsing sessions can
  remove all saved samples for that origin.
- Save the domain action before refreshing. Unsaved form fields, active timers
  and transient UI messages are not guaranteed to restore.
- Inspect the visible storage status. Read/write failures fall back to memory.
  Malformed or unsupported snapshots are rejected and fresh fixtures load with
  a notice, rather than trusting incompatible saved records.
- Multiple tabs do not merge changes live. Each tab works on its own loaded
  snapshot; the last successful write wins. Avoid concurrent edits while testing.
- Browser storage is inspectable by the browser user and same-origin scripts.
  Preview role selectors demonstrate projections; they do not secure saved
  data. Use fictional names, `.invalid` addresses and synthetic free text only.
  Never enter real employee/customer information, credentials or secrets.

No login, Firebase emulator, cloud storage, provider key or external service is
required. Local storage does not implement trusted memberships, server rules,
managed backup schedules, encryption, production retention policies or production
authorization. Read the
[persistence QA receipt](PORTAL-PERSISTENCE-QA-2026-10-14.md) for checked browser
paths and their limits; earlier QA receipts retain their original behavior.

## Export and import without an account

**Export workspace** downloads one native portal’s complete current domain
snapshot as a JSON file. **Import workspace** reads a file locally, previews its
module/export time/file, and asks for an explicit **Replace HR workspace**,
**Replace CMS workspace** or **Replace CRM workspace** confirmation. **Cancel import**
leaves the current records intact. No login, upload or server is involved.

### Move a workspace to another browser

1. Complete or save domain actions in the source portal. Export HR, CMS and CRM
   separately for individual files, or use the combined directory controls below.
   Each individual file contains only its named module.
2. Copy the file to the destination browser/computer. Open the matching native
   portal at any origin running the compatible app version.
3. Export the destination’s current workspace if you want to retain it. Import
   the source file, inspect the preview and confirm the named replacement.
4. Check the visible save status, inspect the imported records and refresh.
   The destination now owns an independent browser-local save. Editing either
   browser does not update the other; repeat export/import to transfer again.

Import is full replacement, not merging, deduplication or synchronization.
The selected file must pass size, backup-envelope version, module and full nested
schema checks. A wrong-module or incompatible/damaged file cannot replace records.
Replacement commits only after browser storage accepts the imported snapshot;
if saving fails, prior records remain active and a visible error explains the
failure. Importing HR cannot change CMS/CRM or the independent SDK sample.
The browser’s existing `schemaVersion: 1` local-storage envelopes remain unchanged;
portable files use their own backup envelope and must come from **Export workspace**.
A backup uses `format: "webappx-mock-workspace"`, `schemaVersion: 1`, `module`,
`exportedAt` (UTC ISO timestamp) and `data`. The file picker rejects files above
8,002,048 bytes before reading; parsing also limits decoded text to 2,000,512
characters and the resulting browser-save envelope to 2,000,000 characters.
Browser quota may be lower, in which case replacement is refused without changing
the current records. Newer unsupported formats are rejected; no migration is inferred.

Only saved-action domain state is portable. Unsaved fields, running timers and
most interface selections are excluded; native HR’s saved role/employee choice
is included. The SDK preview’s separate session is excluded. Reset still clears
only the chosen browser-local module, leaving files already downloaded intact.

### File contents and trust boundary

The JSON is plain text and contains the whole fictional workspace, including
review drafts, unsent survey answers, employee/customer records and activity or
payroll/publication receipts. Export is not filtered by the currently selected
preview role. Anyone holding the file can read those records. Use fictional data
only; files are not encrypted, signed or trusted identity/provider records.
Validation checks supported structure, not the truth or provenance of editable
file contents. Import cannot grant Firebase permissions, execute payroll, publish
a website or create an account.

Read the [per-portal backup QA receipt](PORTAL-BACKUP-QA-2026-10-14.md) for that
feature’s earlier checks. The combined receipt below records the current scope;
earlier refresh-only and talent receipts retain their historical scope.

### Combined backup and selective restore

The `/portals` directory adds **Export all workspaces** and **Import combined
backup**. Export reads the complete current HR, CMS and CRM domain states,
including initial fixtures for a portal that has not yet created a browser save.
It downloads one file without saving new fixture snapshots or contacting a server.
The existing individual portal controls and file format remain available.

1. Save/complete the domain actions you want to retain, then choose **Export all
   workspaces** on `/portals`.
2. Copy that file to the destination browser/computer. Export its current data
   first if it must be retained, then choose **Import combined backup**.
3. The importer validates the entire envelope and all three complete module
   schemas before offering a preview. Review its file, export time and HR/CMS/CRM
   record summaries. Even a broken module you intend to leave unselected rejects
   the file before selection.
4. HR, CMS and CRM selection boxes start unchecked. Select at least one complete
   portal and review the [storage-budget preview](#restore-storage-budget-preview).
   A valid budget enables **Restore selected workspaces**; **Cancel combined
   restore** leaves records and history unchanged.
5. Confirming replaces the selected portals’ full domain states and saves them
   locally for refresh. Unselected in-memory states and exact saved browser bytes
   stay untouched. No merge, record-level selection or ongoing sync occurs.

Selected modules remount after a successful restore, clearing their unsaved
forms, active timers and transient interface messages. Unselected modules retain
those interface states. The independent SDK preview is outside the bundle.

A combined file uses `format: "webappx-mock-workspaces"`, `schemaVersion: 1`,
`exportedAt` (UTC ISO timestamp) and `workspaces: { hr, cms, crm }`. It is distinct
from the singular `webappx-mock-workspace` format. Import each type through its
matching controls. Combined imports reject files over 24,008,192 bytes before
reading and text over 6,002,048 decoded characters before parsing. Each resulting
module browser-save envelope retains the 2,000,000-character limit. Browser
storage quota may be smaller; the bundle does not change the existing three
local-storage keys or their schema.

Immediately before applying, the app revalidates the selected snapshots, captures
the selected keys’ previous exact bytes, and attempts all selected writes before
changing any in-memory workspace. A failed write triggers a rollback attempt for
the selected keys and leaves prior in-memory records active. `localStorage` does
not support an atomic multi-key transaction: if rollback also fails, the warning
explicitly says browser storage may be partially changed. In that case, export
the current in-memory data before refreshing, restore storage access/capacity,
and retry the restore or Reset the affected modules. Unselected keys are never
written. Concurrent browser tabs still use last-write-wins behavior; avoid edits
in other tabs while restoring.

The complete bundle is plain-text fictional data, including private review and
survey drafts, feedback and mock receipts independent of preview roles. No
authentication credentials, unsaved fields, running timers or SDK state belong
in it. Structural validation does not authenticate editable records or prove a
provider action. No account, upload, Firebase/Gusto connection, cloud restore or
production publication is introduced. See the
[combined backup QA receipt](COMBINED-BACKUP-QA-2026-10-14.md) for tested scope.

### Restore storage-budget preview

The **Storage budget preview** appears before a combined selective restore or
Undo can be confirmed. It calculates the selected operation's app storage budget:

| Preview value | Meaning |
| --- | --- |
| Selected workspace size | Serialized browser-save envelope for each selected portal, including its schema/module wrapper; each must fit 2,000,000 characters |
| Selected workspace total | Sum of the selected serialized workspace envelopes; this is a size summary, not a shared browser-quota allowance |
| New restore point | Size of the recovery snapshot built from the selected portals' current in-memory domain records |
| Current history | Validated, normalized restore-point history read from this browser origin |
| Projected history | History after adding the new point and pruning oldest points to retain at most five within 2,000,000 serialized characters |

All sizes are serialized character counts. They are not file bytes, allocated
disk usage or a measurement of available `localStorage` quota. Browser storage
may be unavailable or full even when every app limit passes. The preview neither
reserves space nor writes history or workspace keys.

Changing the selected portals updates the calculation. Current domain records
and loaded history are also inputs, so the recovery estimate captures current work,
including saved changes made after the imported backup was exported. Unsaved
forms, active timers and the independent SDK session remain excluded.
For Undo, the selection is fixed to the chosen point's captured portals; the
same preview includes the new point needed to reverse that Undo.
**Refresh storage preview** rereads history from this browser origin without
applying the restore. Tabs still do not merge live edits or lock each other;
avoid changing the same workspaces from another tab during recovery.

With no selection, choose a portal first. Invalid state, unreadable/rejected
history or a new point too large for the retention budget prevents confirmation
with a reason. Existing history and workspaces remain intact. Export current
workspaces before explicitly clearing rejected history if a portable copy is
needed. A pruning preview identifies history that would be discarded if the
confirmed operation succeeds; viewing or cancelling the preview does not prune it.

Confirmation repeats validation against the current state and browser history.
The actual recovery point must save before any workspace overwrite. A failed
write still follows the rollback and recovery-warning behavior described above;
the size preview cannot make browser writes atomic. See the
[P1 QA receipt](PORTAL-REGISTRY-BUDGET-QA-2026-10-14.md) for automated fault cases,
actual browser checks and repository gates at the checked revision.

**Observed local browser results — 2026-10-14:** directory cards, navigation and
cross-links reached all three registered portals. Nested HR payroll remained
reachable; `/hr/demo-other` returned the 404 surface. Preview/cancellation
preserved complete exported payloads. HR-only restore preserved CMS/CRM, and
Undo recovered the original payloads after refresh. CMS+CRM restore preserved
HR; all-three restore also passed.

Projected history sizes matched the confirmed history at every checkpoint:
4,748 → 9,525 → 12,486 → 15,048 → 22,602 → 24,994 characters. The sixth restore
retained five points and pruned one. A valid CMS browser save of 1,994,127
characters imported successfully. With that current state, an incoming all-three
restore totaling just 7,073 characters required a 2,000,440-character recovery
point and 2,000,471-character history envelope. The preview correctly disabled
Restore because the history exceeded 2,000,000 characters; cancellation preserved
all exported payloads. No browser errors were observed; the expected missing
Firebase configuration warning remained. See the receipt for the exact sequence.

### Automatic restore points and Undo

Each confirmed combined selective restore first saves a restore point containing
only the selected portals’ current domain states. The point must be written to
browser storage before any workspace is overwritten. A failed or oversized
checkpoint refuses the restore and keeps the workspaces active. Saving a point
is separate from the selected workspace writes; those writes retain the rollback
and partial-storage warning behavior described above. Rollback attempts include
both the history key and attempted selected workspace keys. If that rollback
fails, the warning identifies the uncertain browser slots; keep the tab open and
export current in-memory workspaces before refreshing.

On `/portals`, **Restore points & Undo** reads `webappx.demo.restore-points`.
The history survives refresh on the same browser profile and origin; points are
listed newest first. **Refresh restore points** reloads the current history from
this browser address. Each point identifies its creation time and affected portals.
Undo restores the complete snapshots in that point; its scope cannot expand to
portals that were not captured.

1. Choose **Undo…** for the point you want to recover. Review its time, affected
   portals, the **Current**/**Recover** record summaries and the
   [storage-budget preview](#restore-storage-budget-preview) before choosing
   **Confirm undo**, or **Cancel undo** to keep the current records.
2. Confirm only after reviewing the replacement scope. Undo replaces those whole
   portals, including any domain changes saved after the point was created.
   Cancel leaves every workspace and the history intact.
3. The app saves a new point of the affected portals’ current states before
   applying Undo. Use that newer point to reverse the Undo if needed. It must
   pass the same validation, retention and storage checks as a normal restore.
4. Inspect the save result and refresh. The recovered records persist; selected
   modules remount and clear their unsaved forms, timers and transient messages.
   Other portals’ records, browser saves and interface state stay unchanged.

This history retains at most **five points**, subject to a total **2,000,000
serialized-character limit**, including its envelope. Oldest points are pruned
when needed. If the newest point alone exceeds the limit, the operation is
refused; existing history is preserved. Browser quota may impose a lower limit.
Validation checks history format/version and the complete saved domain records.
Malformed or unsupported history blocks combined restores and Undo. Export the
current workspaces if you want a portable copy, then choose **Clear restore
points** and **Confirm clear restore points** to discard the rejected history
and try again. **Keep restore points** cancels the clearing action. Clearing
points leaves all three current workspaces and their browser saves intact.

Points capture domain snapshots, including current in-memory domain state if an
earlier normal save failed. They do not capture exact old storage bytes, unsaved
forms, active timers or the independent SDK session. Restoring initial fixtures
through Undo creates a valid saved snapshot. Individual portal imports, normal
edits and Reset do not automatically create points. Points are not included in
either JSON backup format; export workspace files separately to move records to
another browser. Clearing site data also clears this origin’s history.

Like the workspaces, points are inspectable plain-text fictional records,
including private drafts, survey responses and mock receipts regardless of
preview role. They require no account, upload, Firebase or Gusto credentials.
They are local recovery aids with bounded retention, not a cloud backup service.
Avoid simultaneous edits/restores in other tabs: there is no live history merge
or cross-tab locking. The [restore-point QA receipt](RESTORE-POINTS-QA-2026-10-14.md)
records this update’s browser observations and automated gates separately from
the earlier combined-backup checkpoint.

### Earlier persistence browser checkpoint — 2026-10-14

Selected same-origin refresh checks passed in all three native modules. HR
restored hire/onboarding, approved-time/payroll stages, confirmed benefits,
performance progress/review drafts and saved/submitted survey answers. CMS
restored an editable revision 3 while retaining published revision 2 and
`MOCK-CMS-0004`. CRM restored one converted lead and a $1,500 won opportunity,
with $6,500 open pipeline, three companies, three contacts and six actions.
Native HR also restored after SDK preview and About/back. All three Reset then
refresh checks restored only the chosen module and preserved the other modules’
saved markers. The [current receipt](PORTAL-PERSISTENCE-QA-2026-10-14.md) retains
exact figures and separates these UI observations from automated gates and
production/provider acceptance.

## Shared shell and separate module permissions

Use one application shell for organization selection, navigation, search,
notifications, accessibility and session status. Each workspace owns its
navigation, records, role checks and mutations. A shell account level does not
grant every HR, CMS or CRM capability.

Proposed organization membership:

```text
organizations/{orgId}
  memberships/{authUid}
    status: active | suspended
    modules:
      hr: [employee | manager | hr-admin | payroll-admin | auditor]
      cms: [author | reviewer | publisher | viewer]
      crm: [representative | manager | administrator | auditor]
    scopes: named team / assignment / employee references
```

These are proposed backend records. Roles must come from a trusted membership
issuer and be checked for every query and mutation. Validate organization
membership and record ownership independently. The organization in the URL or
browser selector is a request, not authority. Owner status may administer
memberships through a reviewed backend; it should not bypass every module's
sensitive-data policy implicitly.

Keep the existing HR role vocabulary for HR. CMS and CRM roles are additions,
not substitutes for employee/payroll roles. Customer subscription tiers remain
separate from staff permissions. The current local demo identity selectors
continue to control fictional records only.

### Proposed role matrix

| Role | HR | CMS | CRM |
| --- | --- | --- | --- |
| Employee | Own permitted profile, assignments, leave, reviews and statements | Published employee-facing content if assigned | No customer access by default |
| HR administrator | Scoped people/recruiting workflows; compensation restrictions still apply | No publishing access by default | No customer access by default |
| Payroll administrator | Approved payroll scope | No content access by default | No customer access by default |
| CMS author | No HR access by default | Create/edit assigned drafts and request review | No customer access by default |
| CMS reviewer | No HR access by default | Review an exact revision and return feedback | No customer access by default |
| CMS publisher | No HR access by default | Publish approved revisions; retire/restore through recorded actions | No customer access by default |
| CRM representative | No HR access by default | Read published sales content | Assigned contacts, companies, opportunities and activities |
| CRM manager | No HR access by default | No publishing access by default | Team assignments, pipeline and approved reports |
| Module auditor | Allowed module metadata and audit views | Read authorized revisions and publishing receipts | Read approved records and audit metadata; no mutation |
| Organization administrator | Assign reviewed module memberships | Assign reviewed module memberships | Assign reviewed module memberships |

A person can hold multiple explicit roles. The dashboard should render only
authorized modules and actions; services must still enforce those checks when
called directly.

## Proposed route and file structure

Retain existing HR URLs. The account-free entry points are `/portals`,
`/cms/demo`, `/crm/demo` and the existing `/hr/demo/...` family. The proposed
expanded subroutes and protected CMS/CRM routes below are not implemented:

| Workspace | Account-free routes | Protected adopted routes |
| --- | --- | --- |
| Portal overview | `/portals` with availability labels | `/admin` with permitted workspace links |
| CMS | `/cms/demo`, `/cms/demo/collections`, `/cms/demo/content/:id`, `/cms/demo/reviews`, `/cms/demo/assets`, `/cms/demo/locales`, `/cms/demo/preview/:id` | `/admin/cms/...` |
| CRM | `/crm/demo`, `/crm/demo/contacts`, `/crm/demo/companies`, `/crm/demo/leads`, `/crm/demo/opportunities`, `/crm/demo/activities`, `/crm/demo/tasks`, `/crm/demo/reports` | `/admin/crm/...` |
| HR | Existing `/hr/demo/...` family | Existing protected HR route family |

Proposed host-owned modules:

```text
src/portals/       # module catalog, shell links, organization context, shared UI
src/cms/           # model, permissions, mock transitions, fixtures, views
src/crm/           # model, permissions, mock transitions, fixtures, views
src/pages/         # CmsPage.tsx and CrmPage.tsx entry points
integrations/cms/  # optional server adapter and content delivery boundary
integrations/crm/  # optional server adapter and import/export boundary
tests/cms/         # workflow and permission regressions
tests/crm/         # workflow and permission regressions
```

Keep product runtime extensions in the host tree. The imported managed
`.SYSTEMX` release and research archives remain immutable. Reuse visual
primitives and navigation helpers; share domain records only through explicit
projections rather than importing another module's full state.

## CMS: content model and publication workflow

The implemented CMS mock supports **pages and articles**, collection/title/slug
search, a plain-text content editor, draft/review/publish/retire states,
deterministic activity receipts and a frozen local public projection. Use
`/cms/demo` and switch its fictional author, reviewer, publisher and read-only
viewer identities. Controls act on fictional browser-local records. The shared
demo shell preserves each module when switching among HR, CMS, CRM and the
portal directory. Saved records also survive refresh or leaving and returning
at the same browser origin; **Reset CMS samples** clears only CMS’s saved
snapshot and restores its fixtures. The model enforces permissions independently of
visible buttons.

An author saves a revision and requests review. A separate reviewer approves
that exact revision or returns it with feedback. The publisher simulates
publication. Editing an approved or published entry creates a new draft and
invalidates approval; the older public snapshot remains unchanged until the
new revision is approved and published. Publishing and retirement produce
local receipts. Case-insensitive slugs are reserved within their collection,
including the still-published slug while a draft uses a new one. The preview
renders text, never HTML supplied by an editor.

FAQ/announcement collections, locale filters, a complete retained revision
browser, review queue, asset library and durable publishing transport remain
adoption work. The proposed records below describe that expanded target; the
mock does not claim to persist these backend collections.

Proposed records under an organization:

| Record group | Minimum fields and rules |
| --- | --- |
| `cms_collections` | Schema ID/version, field definitions, permitted audience, validation rules |
| `cms_content` | Collection ID, slug, locale, owner, workflow state, draft revision ID, published revision ID |
| `cms_revisions` | Immutable validated field values, revision number, author, timestamp; no embedded credentials |
| `cms_reviews` | Content/revision ID, assigned reviewer, decision, feedback and receipt |
| `cms_assets` | Tenant-owned asset metadata, alt text, usage references and approved transport state |
| `cms_publications` | Exact approved revision, audience, publication/retirement time and receipt |

Workflow: **draft → in review → approved → published → retired**. Reviewers may
return a draft for changes. Editing an approved draft invalidates its approval.
Publishing selects the exact approved revision. A later draft must not replace
the published version until it completes review. Restoring old content creates
a new reviewed publication event. Locale variants have separate review states
and a unique collection/slug/locale combination.

The public site reads a minimal published projection containing only approved
public fields. Drafts, internal notes, reviewer identity and private asset URLs
stay outside that projection. A mock preview renders synthetic drafts inside
the application; it does not deploy, create a public URL or modify the live
website. Production publishing requires an adopted delivery adapter, server
authorization and an explicit operator publication policy.

## CRM: relationship model and pipeline workflow

The implemented CRM mock provides companies, contacts, leads, opportunity
stages, follow-up tasks, scoped activity and dashboard reports. It uses fixed
owner, sales manager, two representative and read-only auditor identities.
Representatives access their own linked records. All emails use fictional
`.invalid` domains. No external messages or customer systems are contacted.

The table below proposes the broader production data model; fields beyond the
working mock remain adoption work.

| Proposed record group | Minimum fields and rules |
| --- | --- |
| `crm_contacts` | Name, fictional work channels, company reference, owner, communication preferences and provenance |
| `crm_companies` | Organization name, synthetic domain, owner and linked contact IDs |
| `crm_leads` | Source, qualification state, contact/company references, assigned representative |
| `crm_opportunities` | Company/contact references, pipeline/stage, currency, value, expected close date, owner and outcome reason |
| `crm_activities` | Subject references, permitted note, activity type, author and occurrence time |
| `crm_tasks` | Subject reference, assignee, due date, status and completion receipt |
| `crm_stage_events` | Opportunity ID, previous/new stage, actor, reason and receipt |

Implemented lead flow: **new → qualified → converted**. Conversion checks
ownership and duplicate identities, reuses a company owned by the same
representative where appropriate, and creates a contact/opportunity exactly
once. Opportunity flow: **discovery → proposal → negotiation → won**, or an
open opportunity can be marked **lost**. Tasks inherit the linked opportunity's
owner and can complete once. Each action updates dashboard counts and the
sample activity timeline.

Disqualification, outcome reasons, reopening, due-date scheduling, bulk import,
advanced account relationships and communication preferences are proposed
expansions beyond this mock core.

Reports distinguish pipeline value from won value and label all amounts as
fictional. Neither state implies a contract, invoice, payment or sent message.
Account-free actions add local activity receipts; email, phone, bulk import,
export and external synchronization remain disabled until their own adapters
and authorization are implemented.

## Proposed cross-module handoffs

| Link | Allowed projection and explicit action |
| --- | --- |
| HR recruiting → CMS job listing | HR approves a public job projection containing title, description, location label and application instructions. CMS reviews and publishes it. Candidate records and internal evaluations stay in HR. |
| CMS public form → CRM lead | An adopted form service creates a scoped lead only for an explicit customer inquiry with captured purpose/provenance. A mock submission creates fictional local data only. |
| CRM → CMS collateral | CRM may reference approved, published sales content by publication ID. It cannot read the draft review record. |
| Employee → CRM assignee | An explicit membership/assignment reference may identify an active staff owner. It does not copy HR compensation, health, absence or review data. |
| Shared dashboard → module action | Each module returns authorized aggregate counts and a permitted route. A shared inbox must not expose hidden record titles or sensitive note text. |

These handoffs are designs for adoption; the current demos do not transfer
records between modules. A recruiting candidate is not automatically a customer contact. A customer
contact is not automatically an employee. Matching email strings do not grant
permission to merge records or share personal information. Any approved handoff
uses an explicit action, selected fields, provenance, a destination permission
check and a receipt. Deletion/retention policies must remain explicit per module
when durable storage is adopted.

## Account-free development approach

1. Ship fictional fixtures and deterministic transition functions in each host
   module. No provider keys, login, billing, email delivery or cloud services
   are required for the mock route family.
2. Save fictional domain state to separate versioned browser-local snapshots,
   with visible storage status and module-specific Reset. The implemented demos
   restore saved actions after refresh or returning to the same origin. Browser
   persistence is not server durability, confidential storage or authentication.
   Use per-module JSON export/import or a combined HR/CMS/CRM backup with
   selective whole-portal restore for manual fictional-workspace backups and
   browser transfer, with validation and explicit replacement confirmation.
   Provide at least two organizations for cross-tenant negative tests once
   organization selection is implemented.
3. Validate state transitions and role scope in shared domain functions used by
   the UI. Test direct calls with unknown IDs, foreign assignments and repeated
   actions, as well as happy paths.
4. Keep mock state separate from LAN fixtures and optional emulator records.
   Mock publish means an in-app published projection; mock CRM activity means a
   local receipt. Neither crosses into the operator control plane or provider.
5. Add tenant-scoped server storage behind an explicit adapter only after mock acceptance.
   Re-run workflow and permission checks through trusted server endpoints and
   storage rules before connecting real data.

## Delivery phases and acceptance

| Phase | Concrete deliverable | Acceptance evidence |
| --- | --- | --- |
| Portal foundation, implemented local shell | Shared demo catalog/navigation, separate versioned browser snapshots, independent Reset, per-module JSON files and combined backups/selective restore | Navigation and same-origin refresh restore saved domain records; validated confirmed imports replace only selected full modules; production organization/membership contract remains proposed |
| CMS mock core, implemented | Page/article editor, separate exact-revision review, frozen local preview and publish/retire receipts | Ten domain tests cover transitions, permissions, stale revisions, slug uniqueness and public-field projection; release browser evidence must separately verify the UI |
| CMS expanded mock, proposed | Asset metadata, locale variants, full revision history and review queue | Locale and asset references remain scoped; each variant has independent review/publication state |
| CRM mock core, implemented | Contacts/companies, lead conversion, opportunity stages, tasks/activities and dashboard | Browser qualifies/converts once, advances and closes a sample opportunity, completes a task; foreign-owner actions and duplicate conversion are refused |
| Cross-module mock | Reviewed job projection and explicit synthetic inquiry handoff | Only selected fields move; no candidate/customer merge; dashboard count and destination record reconcile |
| Durable adopted app | Tenant membership, server adapters, rules, audit/retention and storage transport | Two-tenant isolation, direct endpoint rejection, restart persistence and independently scoped role checks pass |
| Optional providers/live publication | Selected CMS delivery, CRM messaging or integration adapters | Operator-approved setup, provider-specific verification and publication evidence; mocks remain usable without accounts |

The implemented mocks inform the proposed shared patterns. A passing synthetic
workflow does not establish server authorization or production publishing.
New app adopters should select required modules and complete their acceptance
evidence before enabling real business records or public publication.
