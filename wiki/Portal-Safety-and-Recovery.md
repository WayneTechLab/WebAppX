# Portal Safety and Recovery

This guide describes the native account-free HR, CMS and CRM workspaces in
WebAppX 3.4.0. The current wave starts from
`532cc4ad63d18a4fe911b0a9b18e258b85ef3416`. It records implemented source
behavior; the [safety QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-SAFETY-QA-2026-10-15.md)
records actual execution and accepted gates. Earlier maturity/evaluator receipts
retain their original source bases, dates and observations.

The separate genuine SDK preview has its own `npm run browser:sdk-quality`
companion with a canonical same-origin local API gate. It covers selected session,
onboarding, pending payroll, fictional receipt and Reset meanings. Native workspace
saves remain separate. The SDK receipt uses explicit fictional labels and removes
the default provider-partnership wording. Actual results belong in the linked QA
receipt; unmounted SDK exports retain their own scope.

Agent 0 accepted **14 original local criteria**. The catalog now records **91 done / 909 remaining**: **82 P1, 670 P2 and 157 P3**, with **742 local, 127 operator and 40 provider** acceptance gates remaining. The full 1,000-item goal remains active.

**Integrated verification passed: all 61 CI stages, 160 browser checks/check groups and Hosting preflight.** The current safety QA receipt records the source, retained reports, fixture corrections and local evidence limits. Production deployment was not performed.

## Keep or discard temporary work

Registered forms compare their current values with an accepted baseline. A
meaningful edit makes that form dirty; returning to normalized saved values
becomes clean. A successful in-memory domain action clears only its completed
form group, even when the browser cannot persist that action. Failed validation
keeps the temporary input. Saved domain drafts and filters are separate from
unsaved form work.

When navigation would discard registered work, the dialog offers:

| Choice | Result |
| --- | --- |
| **Keep editing** | Cancel that move and return to the owning form or a useful visible fallback. Retained work in a hidden portal can activate its supported owner route. |
| **Discard and leave** | Discard the affected temporary groups, then perform the requested move. This does not undo accepted workspace records. |
| **Leave and keep draft**, when offered | Move between eligible mounted portal/directory destinations and retain temporary inputs in this open page. This is not a save or export. |

Leaving the portal shell considers hidden retained forms too. HR subject/role
changes, CRM tab/identity changes and CMS entry switches use the relevant form
guards. Linked CRM choices stay controlled within their forms. The CMS entry switch also has its specific **Keep editing**
and **Discard changes and switch** decision. A browser unload warning is a
separate native boundary. Refresh or closing the page loses temporary buffers.

Dirty Back/Forward uses a disclosed current-history-slot fallback. **Keep
editing** preserves the approved view and drafts; **Discard and leave** opens
the requested URL in that same slot. It adds no history entry and does not
truncate forward history, but the Back/Forward entries can differ afterward.
Clean Back/Forward traversal remains normal, and ordinary app links keep their
push behavior. This is the editing decision's history behavior.

Read the [state contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-STATE-CONTRACT.md)
and [capability vocabulary](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-CAPABILITIES.md)
for exact form and synthetic role scopes.

## Resolve a CMS editor after replacement

A dirty CMS author editor is the deliberate exception to selected workspace
remount clearing. Individual import, combined selective restore and Undo retain
that editor in a volatile slot. A successful replacement or changed baseline,
including different content at the same numeric revision, requires an explicit
choice in **CMS editor recovery**.

1. Read the **Editor baseline**, **Restored draft** and **Unsaved text** columns.
   They display escaped text; they do not execute imported markup.
2. Choose **Reload restored draft** to discard the unsaved buffer, or
   **Reapply unsaved text** to copy only meaningfully edited fields onto the
   restored draft's other fields. Normalization-only title/slug changes do not
   overwrite restored values.
3. Reapply requires the recognized assigned author and an existing restored
   entry. A stale choice or second replacement must be reviewed again. Invalid
   reapplied text stays editable with all normal field/slug errors.
4. Use ordinary **Save draft revision** to create a revision after permissions and
   validation pass. Reload/Reapply themselves change no workspace save,
   approval, publication or activity receipt. The frozen published sample stays
   unchanged by unsaved text.

Accepted **Reset CMS samples** clears the volatile editor as well as other
temporary CMS UI. Other selected ordinary forms and timers keep their existing
replacement clearing behavior. Unsaved review feedback retained after approval
has a temporary edit/discard panel; it does not offer an invalid-stage review
action.

## Choose import and Reset checkpoint settings

Each native backup panel exposes two independent origin-local settings:

- **Require checkpoint before individual imports**
- **Require checkpoint before Reset**

Both are off initially. They apply to all native portals at that browser origin,
survive refresh in their own settings slot, and are excluded from workspace
exports and restore-point payloads. Damaged or unreadable preferences refuse
replacement until explicitly reviewed; they never silently disable protection.

| Operation | Confirmation and capture |
| --- | --- |
| Individual import, setting off | Validate the complete matching workspace and explicitly review Replace. The confirmed facts must still match; no automatic checkpoint is added. |
| Individual import, setting on | Review the module-only destination checkpoint and retention budget. Save it before writing the imported workspace; refuse missing/stale confirmation or failed required capture. |
| Reset, setting known off | Keep the existing one-click Reset. Accept the fresh seed and clear temporary UI even if removing an old save fails; the visible warning explains that old records can return after refresh. |
| Reset, setting on | Review and confirm the module-only destination capture first. Failed required capture/replacement accepts no new seed or temporary UI reset. |

Required confirmation binds the reviewed current record, target, settings and
history facts. A changed preview must be reviewed again. Captures share the
existing bounded five-point/2,000,000-character history. Other portal saves and
unrelated storage are outside an individual replacement's writes. These local
checks do not grant authentication, provider access or a role permission.

## Inspect before applying a restore

Inspection and difference previews are pure reads. Complete hidden saved values
participate in change detection; displayed detail stays bounded and omits free
text and amounts.

- CMS entries distinguish draft, approval and frozen publication changes, with
  revisions/status and allowed reviewer/receipt IDs.
- CRM companies, contacts, leads and opportunities show allowed owner/link IDs,
  lead states and opportunity stages.
- Each identifier limit has an exact omitted count. Invalid data or traversal
  overflow refuses inspection instead of presenting a partial result as complete.

**Create named restore point** and label editing change history only. They do
not replace workspaces or clear forms. Combined restore and Undo replace whole
selected portals only after their separate validation, budget and confirmation
steps; unselected save bytes remain unchanged. Complete readable exports still
include saved fictional drafts outside the active preview role's projection.

## Preserve records when storage fails

Keep the current page open and export accepted in-memory records before a
reload if persistence is unavailable or rollback is uncertain. Multi-key
browser storage is not an atomic transaction. A failed required replacement
accepts no new memory and attempts exact affected-byte rollback; an unsuccessful
rollback can leave stored data different from the open page.

Read the ordered [recovery failure drill](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-RECOVERY-FAILURE-DRILL.md)
before clearing damaged history, retrying or restoring a rescue file. Clearing
history removes history only; it does not repair data, reset portals or remove
downloaded backups. Use fictional data and isolated profiles for fault exercises.

## Repeat the local checks

After `npm ci` and the explicit `npm run browser:install` setup:

```bash
npm run safety:test
npm run browser:safety
npm run browser:quality
npm run browser:recovery-drill
```

The model suite covers the pure decision, recovery, preference and metadata
contracts. Browser suites use fresh owned contexts and owned loopback preview
children, with reports, traces, screenshots and actual downloads. Cleanup is
reported for the resources owned by each run. Existing user browsers and other
listeners are outside those resources.

The [status inventory](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-STATUS-INVENTORY.md)
separates performed interactions from labeled rare-state render fixtures and
actual product-component displays. It covers monochrome state meaning, visible
accessible-name ambiguity and real **Extra large** preference at narrow width.
These checks do not establish manual screen-reader, native Windows, provider,
deployed-service or production acceptance. See [Testing & QA](Testing-and-QA.md)
and the current safety receipt for completed evidence and remaining gates.
