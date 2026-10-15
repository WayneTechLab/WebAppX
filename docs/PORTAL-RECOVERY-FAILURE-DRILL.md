# Portal recovery failures: preserve, inspect, recover

This guide covers native, account-free HR, CMS and CRM browser workspaces. It
implements the guidance and fictional rehearsal scope of WX-0756, WX-0757 and
WX-0775. It is a source/runbook contract; the batch's dated QA receipt records
actual execution and acceptance separately. The implementation starting source
for this batch is `532cc4ad63d18a4fe911b0a9b18e258b85ef3416`; this is not an
assertion that the new drill existed in that unchanged commit.

## Three facts to keep separate

| State | What it means | What can preserve it |
| --- | --- | --- |
| Current memory | Accepted workspace records in the still-open page. A normal action may be accepted here even when saving fails. A failed combined restore does not accept replacement records into memory. | Export each workspace or Export all workspaces **before reload, closing the tab or leaving the portal shell**. Unsaved form text and live timers are excluded; copy needed fictional unsaved text separately. |
| Saved workspace slots | `webappx.demo.hr`, `.cms` and `.crm` at this exact scheme/host/port and browser profile. Refresh reads these, which may differ from current memory after an uncertain rollback. | Preserve current portable exports first. Inspect each portal independently; recover only the intended portal scope from a reviewed backup after storage works. |
| Restore history | `webappx.demo.restore-points`, containing complete selected record captures. It is separate from workspace saves and is excluded from portable workspace exports. | A valid retained point may be usable after review. Unusable history can be explicitly discarded; clearing it does not reconstruct its captures. |

The current [state contract](PORTAL-STATE-CONTRACT.md) and
[recovery glossary](WORKSPACE-RECOVERY-GLOSSARY.md) define ordinary saves,
imports, Reset, named points, selective restore and Undo. Readable exports and
history can include private mock reviews, survey answers and fictional contact
details. Keep them in an appropriate local location. This rehearsal uses only
the reviewed fictional named seed; it grants no provider or production access.

## Damaged or incompatible restore history

Follow this order when the directory says **Restore-point history is damaged or
incompatible**:

1. **Keep the current page open.** Stop restore/Undo attempts. Do not use Reset
   or browser/site-data deletion as a substitute for identifying what remains.
2. **Preserve the current records.** Use Export all workspaces and, when useful,
   the individual HR/CMS/CRM exports. Confirm that downloads completed and keep
   them separately from the browser. These preserve current accepted records,
   not the unusable history slot, unsaved forms or live timer metadata.
3. **Check all three portals independently.** Note the exact origin, each
   portal's Browser save status, recognizable fictional records and its
   individual downloaded contents. A readable current view does not establish
   that its saved slot agrees with memory. If the warning instead says rollback
   is uncertain, follow the next section before any reload.
4. **Decide whether to discard the unusable history.** In Restore points & Undo,
   choose Clear restore points, read the confirmation, then explicitly choose
   Confirm clear restore points. Canceling leaves the bytes unchanged. This
   action discards only the history slot; it leaves current workspace saves and
   existing downloaded files separate. It does **not repair**, recover, decode
   or recreate the damaged captures. A portable workspace backup is not a
   backup of those history entries.
5. **Check the outcome.** The history list should become empty without a
   remaining history error. Check HR, CMS and CRM again. After current records
   are preserved and storage is available, a deliberate reload can establish
   which records actually return from each saved slot. Compare every portal
   with its preserved export, rather than inferring success from one portal.
6. If history cannot be cleared, a save is unavailable, or any portal differs,
   **stop and retain the open page and downloads**. Address the browser's storage
   availability/quota, then deliberately restore the affected portal from its
   reviewed backup. If no trustworthy backup or readable memory remains, this
   application cannot reconstruct the lost records; do not report them repaired.

Individual imports and Reset normally sit outside automatic history. Where an
optional pre-replacement capture is enabled, unusable history can also block
that enabled operation. Review its displayed choice and failure message;
disabling an option does not recover the damaged history. The drill below uses
the default individual-import behavior and a combined selected restore.

## Worked example: write succeeds, later write and rollback fail

`localStorage` provides no transaction across multiple keys. The application
prepares/validates all selected replacement records, reads prior raw slots,
saves a recovery point, then writes selected workspace slots. If a write throws,
it attempts to roll back every attempted slot, including the slot whose write
may have changed storage before throwing. If a rollback also throws, the page
reports uncertainty and keeps its previous live workspace records.

The controlled drill starts with a real saved HR time draft, CMS article edit
and CRM lead. Let **C** mean those complete current records and **S** the named
seed. A seed backup is selected for **HR and CMS only**. Before this attempt,
history is absent. The test-only storage wrapper produces this exact sequence:

| Step | Storage operation | Controlled outcome |
| --- | --- | --- |
| 1 | Write automatic history capture of current HR/CMS | Succeeds. |
| 2 | Write target HR seed envelope | Succeeds. |
| 3 | Write target CMS seed envelope | Changes CMS, then throws a quota-style exception. |
| 4 | Roll back CMS to its previous envelope | Succeeds; the changed-then-thrown slot is included in rollback. |
| 5 | Roll back HR to its previous envelope | Throws before writing. HR remains the target seed save. |
| 6 | Remove newly written history to restore its prior absence | Throws before removal. The attempted capture remains. |

The exact resulting states are:

| Portal or history | Still-open memory | Actual saved slot in this controlled example |
| --- | --- | --- |
| HR | **C**: seed plus `MOCK-TIME-0001`, employee `employee-001`, 2026-10-14, 1.25 hours, manual draft; saved employee selection is `employee-001`; workflow sequence 2. | **S**, because HR rollback failed. Reloading now would lose the current draft/selection from memory. |
| CMS | **C**: `cms-article-001` title `Fictional recovery drill saved draft`, revision 2, receipt `MOCK-CMS-0001`; published seed page unchanged. | **C**, because CMS rollback succeeded. |
| CRM | **C**: new `lead-0001`, `recovery-drill@fixture.invalid`, new status, owner `crm-owner`, receipt `MOCK-CRM-0001`, sequence 2; all seed records unchanged. | **C**, byte-identical because CRM was unchecked. |
| Restore history | The provider reloads the readable persisted history after the failed attempt; this does not accept target workspace records. | One valid `restore` point capturing **C's HR/CMS**, with its actual generated ID/time. Its presence does not prove that the requested restore succeeded. |

The UI identifies **HR save, restore-point history** as rollback failures and
instructs the user to keep the page open and export current workspaces before
refreshing. In an actual browser incident, a thrown storage operation may or
may not have changed a slot; this example's exact mixed state is known because
the isolated fault fixture controls and verifies those operations. Do not
generalize its exact slot contents to an uncontrolled incident.

### Stop and recover from this example

1. Stop further mutations and **do not reload**. Export all workspaces from the
   current page. Confirm that the real rescue download contains **C for HR,
   CMS and CRM**. Exporting does not repair storage; the mixed slots above remain.
2. Preserve the error message, origin and downloaded file. Browser save badges
   alone are not a three-portal recovery proof. The application has reported
   that current memory and saved slots may disagree.
3. Make storage available. In the automated fixture this means disarming only
   the synthetic wrapper. It does not model fixing a browser privacy setting,
   disk problem or real quota issue.
4. Import the preserved portable rescue file in the directory. Review the
   preview and select **HR and CMS**. Leave CRM unchecked. The valid attempted
   capture is preserved and a new point captures the affected current memory
   before the successful recovery. If history is unusable instead, first follow
   the explicit history-discard steps above; do not silently bypass its error.
5. Confirm only after reviewing the intended target, selected scopes, difference
   counts and storage preview. A failure still requires keeping the page open;
   do not infer success from the disappearance of a file picker.
6. Verify **each of HR, CMS and CRM independently** using its individual export
   and saved envelope. HR/CMS must equal the rescued current records. CRM's raw
   saved bytes must remain unchanged. The drill checks complete records, not
   just a title, count or status badge.
7. Only after the rescue is safely retained and the recovery succeeds, reload
   and repeat the three independent comparisons. In this example all three
   saved envelopes return to their exact pre-fault bytes, and history contains
   the prior attempted capture plus the new recovery capture. Neither capture
   is relabeled as evidence that the original failed restore succeeded.

## Execute the fictional local drill

Prerequisites are the normal installed app dependencies and explicitly installed
Playwright Chromium. Run from the checkout:

```bash
node scripts/browser-recovery-drill.mjs
# Optional visible browser or chosen local artifact parent:
node scripts/browser-recovery-drill.mjs --headed --output /path/to/local/artifacts
```

The entrypoint uses the existing owned browser runner and unchanged
`webappx-portal-smoke-v1` seed/digest checks. It allocates its own loopback port,
ignores app environment files/inherited client credentials, and opens fresh
isolated Chromium contexts. It does not reuse or clear a private user's browser,
profile or origin. Normal domain changes use visible controls; imports use real
file uploads and exports use real downloads. Independent hand-written expected
records are compared against every field of all three portal exports and saves.

| Exercise | Required outcome |
| --- | --- |
| Bad individual imports | Both malformed JSON and an incompatible CMS record are refused before a replacement control appears; exact saved bytes, history absence, unrelated preference and current memory remain unchanged. |
| Bad combined imports | Both malformed JSON and an incomplete three-workspace bundle are refused before a selective restore preview appears; the same exact preservation assertions hold. |
| Unavailable storage | An actual CMS revision action is accepted in memory and shows unavailable-save guidance. A rescue export before reload contains that revision with unchanged HR/CRM seeds; no workspace slot exists. Reload returns all three seeds. |
| Failed selected restore / uncertain rollback | The six controlled operations and exact mixed memory/save/history table above are independently asserted. Warning text and the still-open memory are checked. |
| Portable recovery | A real rescue download is taken **before any reload**, then HR/CMS are recovered from it after the fault is disarmed. CRM stays unchecked and byte-identical. Every portal's individual export and saved envelope matches before and after reload. |
| Damaged history | Malformed history is injected only in its isolated context after ordinary saved actions. All current records are exported first. History blocks combined restore; opening the clear confirmation changes nothing. Explicit confirmation removes only unusable history; downloaded backup bytes and all portal saves remain exact, including after reload. No repair is claimed. |

### Fault and evidence boundaries

The three contexts deliberately modify only the browser **storage platform**:

- The partial-write context temporarily wraps `Storage` methods and arms the
  exact six-operation scenario. It never injects React/provider/domain state.
- The unavailable-storage context makes the `localStorage` getter throw a
  synthetic `SecurityError`. This is a controlled fault, not observation of an
  actual browser privacy mode or user preference.
- The damaged-history context writes one deliberately invalid fictional history
  string. It never corrupts a real user slot or workspace record.

The runner prints its fresh artifact directory and emits `report.json` with
check groups, exact origin, observations and owned browser/server cleanup flags.
`recovery-drill-observations.json` distinguishes the three fault boundaries.
Artifacts retain malformed upload fixtures, before/uncertain raw saves, actual
portable and per-portal downloads, status scenes and one trace per context. The
actual uncertain-rollback, unavailable-save and damaged-history scenes each
have a color screenshot and a `-monochrome.png` companion. The companion applies
only a temporary `html` grayscale CSS filter and removes the stylesheet after
capture; it changes no workspace or storage state. Additional `-status.png` and
`-status-monochrome.png` files capture the actual product DOM warning locator
at readable viewport dimensions, preserving the full-page originals. The
damaged-history locator includes the error and clear-history controls. Reported
capture dimensions must fit within 1440 × 1080 so a long difference table cannot
shrink the guidance into unreadable text in an image viewer. A failure also retains
`failure.png` and partial observations. Preserve
failed artifacts when diagnosing a mismatch; a failed assertion is not a passed
drill. The runner exits nonzero for failure and closes only resources it owns.

This is local synthetic recovery evidence. It does not establish deployed
service health, provider remediation, real incident recovery, device coverage,
native Windows execution or operator acceptance of a production workflow.
