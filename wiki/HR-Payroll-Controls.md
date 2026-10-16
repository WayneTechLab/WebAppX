# HR Payroll Controls

**Locally accepted — 2026-10-15.** Agent 0 accepted **WX-0159/WX-0160**
after 21 payroll browser groups, all 35 status meanings, 68-stage CI and Hosting
preflight on source `42818dd7baf3d335f27c401c37d048bd842617fa`. Read the
[dated QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PAYROLL-SETUP-QA-2026-10-15.md)
for exact source, observations and limits. No deployment or provider acceptance
is implied. See the
[complete source guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PAYROLL-CONTROLS.md)
and [approved contract](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PAYROLL-CONTROL-CONTRACT.md)
for the precise compatibility, arithmetic and authority boundaries.

## Open the local mock

```bash
npm ci
npm run dev:mock
```

Use the printed origin and open `/hr/demo/admin/payroll`. Choose **Employer
owner** or **Payroll admin** under **Synthetic management role**. No Gusto
account, Firebase sign-in, Java, emulator or provider credential is required.
Use fictional data. The browser profile, host, scheme and port determine which
saved workspace returns after refresh.

First create an ordinary native submitted receipt: finish required onboarding,
submit time, approve it with a different scoped manager, choose a sample period
and explicit hourly rates, then **Prepare sample payroll** → **Calculate
fictional totals** → **Review simulated payroll** → **Simulate payroll
submission**. Fixed historical fixture payrolls are separate from these
interactive receipts. Submission alone does not close the date window.

## Close a company-wide sample window

In **Sample payroll closures and corrections** → **Close a submitted sample
period**:

1. Choose **Submitted period** with explicit recorded start/end dates.
2. Enter **Closure recorded date** on or after the period end and a printable
   **Closure reason** of 2–500 characters.
3. Choose **Preview period closure**. Review every submitted receipt for the
   exact window, consumed-entry count, pending-preparation effect, date and reason.
4. Choose **Confirm period closure**, or **Cancel closure preview**.

Closure includes every employee and every submitted receipt for that exact
inclusive window. It refuses unresolved unpaid time, inconsistent consumed links,
omitted receipts and overlapping nonidentical windows. A periodless legacy
receipt cannot establish a closure period; its known consumed dates can still
expose a conflict. Resolve draft/submitted unpaid work before closing.

After closure, manual/timer time for those dates, edits into or out of the window,
submission/approval/return/deletion in it, and any overlapping ordinary payroll
preparation refuse in the model. A wider period cannot bypass the lock by silently
skipping closed rows. A failed stop-and-add retains its timer without creating
phantom time. Saved overlapping pending payroll remains intact but explicitly
stale; intentionally prepare a nonoverlapping open period to continue.

No ordinary command reopens a window. A deliberate complete HR import or
restore/Undo can replace it with an earlier snapshot through the existing
recovery controls. Browser-local closure is not a tamper-proof security boundary.

### Keep or discard temporary time/payroll inputs

Final closure confirmation checks current authority and the latest dirty payroll
period/rate, manual-time, timer, time-edit and return-reason groups, including a
timer started after preview. It excludes the closure/correction forms and
unrelated HR/CMS/CRM drafts.

- **Keep editing** cancels the close attempt and preserves the temporary fields
  and timer without calling domain confirmation.
- **Discard and leave** discards only the listed dirty groups, then tries the
  source-bound confirmation. Those explicitly authorized discards stay discarded
  if the confirmation is stale. The closure form's inputs remain intact.

There is no retain option for this closure decision. Every later explicit
Confirm rechecks the dirty groups and latest workspace facts.

## Make a separate monetary correction

In **Create a separate fictional payroll correction**:

1. Choose **Original receipt** and **Correction employee** from the original
   captured participants. A correction can target an open or closed original;
   closure is not a prerequisite.
2. Review **Immutable original statement** and **Current cumulative balance**.
3. Enter **Correction recorded date**, **Correction reason**, and all three
   corrected **cumulative** dollar targets: fictional gross, illustrative
   withholding and sample benefits. Use plain nonnegative decimal text with
   at most two decimals. Net is calculated as gross minus both deductions.
4. Choose **Preview payroll correction**. Compare original, previous cumulative,
   **Separate signed adjustment** and proposed cumulative amounts, plus the
   original-receipt and previous-adjustment links.
5. Choose **Confirm fictional payroll correction** or **Cancel correction
   preview**. Cancel keeps the text without accepting a record.

Each target replaces the cumulative balance for that original receipt/employee;
the signed delta is computed from the previous balance. A repeated identical
target refuses the no-op without a new receipt. Do not add cumulative targets
and deltas together. The original hours, rates, benefit snapshots, consumed time,
submitted statement and ordinary payroll totals remain unchanged.

Corrections use manual fictional amounts, with no automatic 20% recalculation
or tax engine. Negative deltas do not debit or recover money. The ordinary
native rounding rule also stays unchanged: two `0.125`-hour entries at `$30.04`
give `$7.51` employee gross after rounding the summed products once, not `$7.52`.
This arithmetic example is not a browser verification claim.

## Review by role

| Preview | Surface |
| --- | --- |
| Employer owner / payroll admin | Closure/correction writers and separate receipt history. |
| Employee | `/hr/demo/employee/paystubs`: original **Your simulated pay receipts** plus only the selected employee's **Your separate fictional payroll adjustments**. |
| Auditor | **Payroll control metadata**: counts, dates, stable employee IDs and receipt links, without correction amounts or reasons. |
| HR admin / manager / contractor | No control writer or monetary correction projection. |

These selectors do not authenticate users or grant provider access. Complete
local HR saves and exports remain readable and include all saved amounts/reasons.

## Save, back up and recover

Preview changes no record. Confirmation checks the latest complete workspace,
actor, route, replacement epoch and one-use preview again. A refused/stale action
keeps domain records intact; review retained inputs and create a fresh preview.

Successful feedback means **accepted in memory**. Check the browser storage
notice before refresh. If a normal domain save fails, export the current
workspace while it remains open; an older save may return after refresh.
The app does not automatically retry the command.

**Export workspace** and **Export all workspaces** carry the optional controls.
Individual import, combined selective restore, HR-only restore and Undo validate
and replace the complete selected HR snapshot, preserving unchecked CMS/CRM.
Unsaved fields, timers, preferences, restore history and the separate SDK session
are outside portable workspace files. Inspection detects hidden control content
changes while displaying bounded metadata instead of money/reasons.

The existing opt-in **Require checkpoint before individual imports** and
**Require checkpoint before Reset** preferences still apply. Required capture or
storage failure refuses replacement; unknown preferences refuse too. **Reset
sample changes** restores the HR fixture without controls. With its checkpoint
preference known off, a failed save removal can accept the seed only in memory
and warns that the old save may return after refresh; other portals and existing
restore history remain separate.

Legacy extension absence remains absent. Unsupported legacy receipts stay in
ordinary history but are not actionable control targets; no missing historical
period, actor or rate is invented. See [Template Portals](Template-Portals.md)
and [Portal Safety and Recovery](Portal-Safety-and-Recovery.md) for the existing
replacement, checkpoint and rollback workflows.

The existing `npm run hr:test` and `npm run portals:test` aliases include focused
control and inspection suites. Commands are repeatable checks, not pass receipts.
Live Gusto, filing, funding and money movement retain their separate
[provider setup](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md)
and acceptance requirements.
