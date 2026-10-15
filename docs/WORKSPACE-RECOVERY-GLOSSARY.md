# Workspace recovery glossary

This glossary addresses WX-0903 for the native, fictional HR, CMS and CRM
workspaces. Source review: **2026-10-15**, using the working source from
integration baseline `aae465ae033f3191a69ed7d40056b0c6e2159e17`. The
[portal state contract](PORTAL-STATE-CONTRACT.md) remains the detailed behavior
reference. This documentation pass adds no new browser execution evidence.

## Terms in the current application

| Term | Meaning and boundary | Current behavior source |
| --- | --- | --- |
| **Save** | A successful native application action accepts a record change into the current in-memory workspace and attempts to save that complete portal to browser storage. A saved draft can still have workflow status `draft`. Text still in an unsubmitted form is an unsaved input. If browser persistence fails, the accepted records remain open in memory and the UI warns that refresh may lose them. | [State hook](../src/portals/useDemoPersistence.ts), [browser persistence](../src/portals/persistence.ts), [retained-record contract](PORTAL-STATE-CONTRACT.md#browser-retained-records) |
| **Export** | Downloads readable JSON of current accepted in-memory records for one portal or all three. It includes fictional seeds, saved drafts, receipts and accepted actions whose browser save failed. It excludes unsaved forms, running timers, temporary filters/tab selections, restore-point history, unrelated browser settings and the separate Gusto SDK session. Export creates a separate file; it does not upload records or write a browser workspace save. | [Single codec](../src/portals/backup.ts), [combined codec](../src/portals/combined-backup.ts), [export boundary](PORTAL-STATE-CONTRACT.md#storage-unavailable-damaged-saves-and-exports) |
| **Import** | Reads and validates a compatible backup. Reading a file or seeing its preview does not apply it. A single-portal import replaces the complete portal only after its save succeeds; it leaves other portals unchanged and creates **no automatic restore point**. Combined-file import validates all three workspaces, then lets the user explicitly select portals for restore. Selection replaces whole workspaces; it does not merge individual records. | [Single replacement](../src/portals/import-state.ts), [combined preview/control](../src/portals/CombinedWorkspaceBackup.tsx), [combined validation](../src/portals/combined-backup.ts) |
| **Restore point** | A browser-local snapshot of the complete current records for the portals selected in a combined restore or Undo. It is saved automatically before replacement; ordinary actions and single-portal imports create no point. A point records its ID, UTC time, selected portals and restore/undo kind. It excludes unsaved UI/timers. History keeps at most five points within a 2,000,000-serialized-character budget, dropping oldest points as needed; an oversized newest point refuses the operation. | [Point model and retention](../src/portals/restore-points.ts), [budget](../src/portals/restore-budget.ts), [commit sequence](../src/portals/restore-workspaces.ts) |
| **Undo** | Chooses an existing point and reapplies its captured whole workspaces for exactly the portals recorded in that point. It does not reverse an individual edit or merge records. It first saves a new point of those portals' current records, so a later Undo can reverse that replacement. Other portal records remain unchanged. Selected portal roots remount and clear their temporary UI after success. | [Undo operation](../src/portals/restore-workspaces.ts), [shared state and selected-root revisions](../src/portals/PortalWorkspaceProvider.tsx), [history control](../src/portals/RestorePointHistory.tsx) |
| **Reset** | Returns one portal's current records to its original fictional seed and attempts to remove that portal's browser save. Other portals stay unchanged. **Restore-point history is preserved**, so Undo from an older point can reintroduce reset records. If removing the old save fails, the seed is open only in memory and the previous save may return after refresh. Reset does not remove downloaded files. | [Reset state hook](../src/portals/useDemoPersistence.ts), [save removal](../src/portals/persistence.ts), [Reset/recovery contract](PORTAL-STATE-CONTRACT.md#save-replacement-and-recovery-boundaries) |
| **History clear** | The explicitly confirmed “Clear restore points” action removes `webappx.demo.restore-points`. It preserves the current HR/CMS/CRM records and workspace saves and does not remount those portals. It does not erase previously downloaded backups. A failed removal reports that the application could not confirm the clear. Browser/site-data deletion is a separate browser operation with a broader scope. | [History removal](../src/portals/restore-points.ts), [confirmation UI](../src/portals/RestorePointHistory.tsx), [shared history owner](../src/portals/PortalWorkspaceProvider.tsx) |
| **Origin** | The combination of **scheme, hostname and port** at which the app is open, within the browser's profile/storage context. Changing `http` to `https`, `localhost` to `127.0.0.1`, or the port selects a different origin and can expose different workspace saves/history. A pathname such as `/hr` or `/crm` does not create a new origin. Separate browser profiles also have separate storage contexts. | [Browser-retention contract](PORTAL-STATE-CONTRACT.md#browser-retained-records), [session origin guidance](GETTING-STARTED.md#start-the-integrated-local-workspace) |

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

Browser saves and recovery history are readable local JSON for fictional data;
they have no authentication, tenant isolation, automatic expiry or background
upload in this native demo contract. A complete export is role agnostic and can
contain fictional drafts beyond the visible role projection. The
[capability/export boundary](PORTAL-CAPABILITIES.md) and
[security assumptions](SECURITY-ASSUMPTIONS.md) describe the additional work
required before real records or services are adopted.

For the detailed evaluation workflow, use the
[portal guide](TEMPLATE-PORTALS.md). Existing
[browser state-contract scenarios](../tests/browser/portal-state-contract.mjs)
and [restore model cases](../tests/portals/restore-workspaces.test.mjs) are
source/evidence pointers; their presence here does not assert a new test run.
