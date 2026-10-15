# Workspace recovery glossary

This glossary addresses WX-0903 for the native, fictional HR, CMS and CRM
workspaces, including the current named-history and inspection behavior.
Source review: **2026-10-15**, using changed working source atop starting base
`950f9ba0c4e48faaa65056f504f105201838e3ec`; that base commit does not already
contain this wave's changes. The
[portal state contract](PORTAL-STATE-CONTRACT.md) remains the detailed behavior
reference. The [maturity guide](PORTAL-MATURITY.md) gives the current control
sequence and its [QA receipt](PORTAL-MATURITY-QA-2026-10-15.md) records focused
execution. Earlier receipts retain their historical scope. This documentation
pass adds no new browser execution evidence. The integrated **56-stage CI and
Hosting preflight passed**, with 111 browser checks/check groups in the receipt.

## Terms in the current application

| Term | Meaning and boundary | Current behavior source |
| --- | --- | --- |
| **Save** | A successful native application action accepts a record change into the current in-memory workspace and attempts to save that complete portal to browser storage. A saved draft can still have workflow status `draft`. Text still in an unsubmitted form is an unsaved input. If browser persistence fails, the accepted records remain open in memory and the UI warns that refresh may lose them. | [State hook](../src/portals/useDemoPersistence.ts), [browser persistence](../src/portals/persistence.ts), [retained-record contract](PORTAL-STATE-CONTRACT.md#browser-retained-records) |
| **Export** | Downloads readable JSON of current accepted in-memory records for one portal or all three. It includes fictional seeds, saved drafts, receipts and accepted actions whose browser save failed. It excludes unsaved forms, running timers, temporary filters/tab selections, restore-point history, unrelated browser settings and the separate Gusto SDK session. Export creates a separate file; it does not upload records or write a browser workspace save. | [Single codec](../src/portals/backup.ts), [combined codec](../src/portals/combined-backup.ts), [export boundary](PORTAL-STATE-CONTRACT.md#storage-unavailable-damaged-saves-and-exports) |
| **Import** | Reads and validates a compatible backup. Reading a file or seeing its preview does not apply it. A single-portal import replaces the complete portal only after its save succeeds; it leaves other portals unchanged and creates **no automatic restore point**. Combined-file import validates all three workspaces, then lets the user explicitly select portals for restore. Selection replaces whole workspaces; it does not merge individual records. | [Single replacement](../src/portals/import-state.ts), [combined preview/control](../src/portals/CombinedWorkspaceBackup.tsx), [combined validation](../src/portals/combined-backup.ts) |
| **Restore point** | A browser-local snapshot of the complete current records for an explicitly selected set of portals. Combined restore and Undo save one automatically before replacement; **Create named restore point** captures one manually without applying a restore. Ordinary actions and single-portal imports create no automatic point. A point records its ID, UTC capture time, selected portals, `restore`/`undo`/`manual` kind and optional label; a manual point requires a label. It excludes unsaved UI/timers. History keeps at most five points within a 2,000,000-serialized-character budget, including labels and the envelope. Oldest points can be pruned when a new capture is added; an oversized newest point refuses the operation. | [Point model and retention](../src/portals/restore-points.ts), [budget](../src/portals/restore-budget.ts), [commit sequence](../src/portals/restore-workspaces.ts) |
| **Manual capture** | Enter a **Restore point name**, select **Capture HR/CMS/CRM**, review retained/pruned counts and serialized size, then choose **Create named restore point**. This writes only restore-point history. It does not import, replace current records, write workspace saves or clear portal forms. Confirmation rereads and validates history and rechecks the actual budget; a preview does not reserve browser quota. | [Capture controls](../src/portals/RestorePointControls.tsx), [history-only capture and preview](../src/portals/restore-points.ts), [provider](../src/portals/PortalWorkspaceProvider.tsx) |
| **Point label** | A trimmed, single-line label of 1–100 characters; line separators and control characters are rejected. **Point label → Save point label** changes only that point's label in history, preserving its ID, capture time, kind, selected portals, captured records and Undo source identity. It cannot prune other points to make a larger label fit. Existing unlabeled schema-1 points remain readable without migration writes. | [Label validation and rename](../src/portals/restore-points.ts), [label control](../src/portals/RestorePointControls.tsx) |
| **Captured-record inspection** | **Inspect captured records** shows every captured collection's complete count, with at most eight identifiers per row and an exact omitted count. Primary records, nested records and metadata are separated to avoid double counting. Names, email values, titles, content, comments, answers, amounts and reasons are hidden. Opening details writes no workspace saves, history or activity. The underlying local JSON remains readable fictional data. | [Inspection panel](../src/portals/WorkspaceInspection.tsx), [inspection model](../src/portals/workspace-inspection.ts) |
| **Difference preview** | Combined restore and Undo compare current records to the selected target, reporting added, removed and changed stable-ID records for selected portals only. Added means present only in the target; removed means present only now; changed means the same ID has different fields, including hidden fields. Identified-collection reordering alone is unchanged. These bounded identifier/count views do not offer record-level selection: confirmation still replaces whole selected workspaces. Viewing them writes no saves, history or activity. | [Difference panel](../src/portals/WorkspaceInspection.tsx), [comparison model](../src/portals/workspace-inspection.ts), [combined controls](../src/portals/CombinedWorkspaceBackup.tsx) |
| **Undo** | Chooses an existing point and reapplies its captured whole workspaces for exactly the portals recorded in that point. Review its current capture, selected differences and budget before confirmation. The app binds confirmation to the exact rendered point, including ID, time, kind, label, scope and payload, and rereads history before replacement. A changed or missing point refuses and requires refresh/review. Undo first saves a new point of those portals' current records, so a later Undo can reverse that replacement. Other portal records remain unchanged. Selected portal roots remount and clear their temporary UI after success. | [Undo operation](../src/portals/restore-workspaces.ts), [shared state and selected-root revisions](../src/portals/PortalWorkspaceProvider.tsx), [history control](../src/portals/RestorePointHistory.tsx) |
| **Reset** | Returns one portal's current records to its original fictional seed and attempts to remove that portal's browser save. Other portals stay unchanged. **Restore-point history is preserved**, so Undo from an older point can reintroduce reset records. If removing the old save fails, the seed is open only in memory and the previous save may return after refresh. Reset does not remove downloaded files. | [Reset state hook](../src/portals/useDemoPersistence.ts), [save removal](../src/portals/persistence.ts), [Reset/recovery contract](PORTAL-STATE-CONTRACT.md#save-replacement-and-recovery-boundaries) |
| **History clear** | The explicitly confirmed “Clear restore points” action removes `webappx.demo.restore-points`. It preserves the current HR/CMS/CRM records and workspace saves and does not remount those portals. It does not erase previously downloaded backups. A failed removal reports that the application could not confirm the clear. Browser/site-data deletion is a separate browser operation with a broader scope. | [History removal](../src/portals/restore-points.ts), [confirmation UI](../src/portals/RestorePointHistory.tsx), [shared history owner](../src/portals/PortalWorkspaceProvider.tsx) |
| **Origin** | The combination of **scheme, hostname and port** at which the app is open, within the browser's profile/storage context. Changing `http` to `https`, `localhost` to `127.0.0.1`, or the port selects a different origin and can expose different workspace saves/history. A pathname such as `/hr` or `/crm` does not create a new origin. Separate browser profiles also have separate storage contexts. | [Browser-retention contract](PORTAL-STATE-CONTRACT.md#browser-retained-records), [session origin guidance](GETTING-STARTED.md#start-the-integrated-local-workspace) |
| **Session return** | Directory cards and shared portal links return to the last supported subsection while the portal shell stays mounted. Unsupported routes cannot replace that destination. This is temporary navigation memory, with no localStorage/sessionStorage preference; a fresh document starts at defaults. Capturing or renaming a point does not remount portal UI; successful restore/Undo remounts only selected roots. | [Route memory](../src/portals/routes.ts), [mounted shell](../src/pages/TemplatePortalsPage.tsx), [maturity guide](PORTAL-MATURITY.md#session-navigation-and-verification) |

## Recovery behavior to keep in mind

The application can export accepted records from the still-open page even
after an ordinary save fails. Unsaved form text and running timer metadata do
not become workspace records through export. HR's saved management role and
employee preview identity are retained record exceptions; CMS/CRM temporary
preview identities are outside exports. See the
[navigation/state table](PORTAL-STATE-CONTRACT.md#temporary-ui-and-navigation)
for the exact form and remount behavior.

Combined restore and Undo validate and prepare their recovery point before
accepting replacement states. If history cannot be read or the automatic point
cannot be saved, the operation refuses. Browser storage has no transaction
across multiple keys: the helpers attempt rollback after a write failure. If
rollback also fails, displayed recovery guidance says browser saves may differ
from the still-open in-memory workspaces. Keep the tab open, export the current
records and follow that guidance before refreshing. A failed combined operation
does not accept replacement states or remount selected portal roots.

Manual capture and label changes validate the complete history, write only its
key and confirm the saved bytes by reading them back. They refuse stale history
and attempt to restore its exact previous bytes after a write/readback failure.
If that rollback cannot be confirmed, the result reports uncertain history;
workspace records and workspace saves have not been changed by that history
action. Keep the page open, export current workspaces and review history when
browser storage is available. Invalid labels, damaged history and a label that
would exceed the budget refuse without accepting a changed capture.

Browser saves and recovery history are readable local JSON for fictional data;
they have no authentication, tenant isolation, automatic expiry or background
upload in this native demo contract. A complete export is role agnostic and can
contain fictional drafts beyond the visible role projection. The
[capability/export boundary](PORTAL-CAPABILITIES.md) and
[security assumptions](SECURITY-ASSUMPTIONS.md) describe the additional work
required before real records or services are adopted.

For the detailed evaluation workflow, use the
[portal guide](TEMPLATE-PORTALS.md) and [maturity guide](PORTAL-MATURITY.md). Existing
[browser state-contract scenarios](../tests/browser/portal-state-contract.mjs)
and [restore model cases](../tests/portals/restore-workspaces.test.mjs) are
source/evidence pointers; their presence here does not assert a new test run.
