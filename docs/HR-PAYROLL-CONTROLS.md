# Native mock payroll closures and corrections

**Locally accepted — 2026-10-15.** Agent 0 accepted original criteria
**WX-0159 — Add mock pay-period closure** and **WX-0160 — Add fictional
payroll correction runs** after the final 21-group/35-status browser journey,
68-stage CI and Hosting preflight on committed source
`42818dd7baf3d335f27c401c37d048bd842617fa`. Read the
[dated QA receipt](PAYROLL-SETUP-QA-2026-10-15.md) for source and observation
bindings. No production deployment or provider acceptance is implied.

The approved [payroll control contract](PAYROLL-CONTROL-CONTRACT.md), especially
section 12, governs the model and integration boundaries. The shorter
[wiki walkthrough](../wiki/HR-Payroll-Controls.md) follows the same controls.

## Open the account-free workspace

From the app checkout:

```bash
npm ci
npm run dev:mock
```

Open the printed loopback origin, then `/hr/demo/admin/payroll`. The isolated
mock launcher needs no Firebase sign-in, Gusto account, provider credential,
Java or emulator. Its default port is allocated locally; saved samples belong
to the exact browser profile and origin. To reuse an available fixed port,
the launcher also supports `npm run dev:mock -- --port 5185`; it uses a strict
port and does not stop an unrelated listener.

Choose **Employer owner** or **Payroll admin** under **Synthetic management
role**. Find **Sample payroll closures and corrections** below the ordinary
**Run a simulated payroll** panel. Use fictional records and reasons throughout.
The native simulation is separate from the SDK preview and live Gusto services.

## Create an ordinary submitted receipt first

Closure and correction choices come from qualified **submitted native mock
receipts**, not the separate fixed historical fixture payrolls. If no choice is
available, first complete the ordinary flow:

1. Finish any required employee onboarding, submit sample time, and approve it
   through a different scoped manager preview.
2. In Management → Payroll, choose **Sample period start** and **Sample period
   end**, an inclusive window of 1–366 calendar days.
3. Configure every eligible employee's explicit fictional hourly rate using
   **Rate employee**, **Fictional hourly rate (dollars)**, **Rate effective date**
   and **Add sample rate**. Fixture compensation is not an hourly-rate default.
4. Use **Prepare sample payroll** → **Calculate fictional totals** → **Review
   simulated payroll** → **Simulate payroll submission**.

The ordinary run freezes its time/rate/benefit inputs and employee totals.
Consumed time is already protected against reuse. Submission by itself does
not close the company's date window; closure is a separate explicit action.

The existing ordinary calculation sums each employee's unrounded
`hours × rateCents` products in input order and rounds that sum once. For
example, two `0.125`-hour entries at `$30.04` per hour give `751` cents gross:
`Math.round(375.5 + 375.5)`, rather than `752` cents from rounding each entry.
The ordinary illustrative withholding remains its existing sample arithmetic.

## Close the entire company window

Under **Close a submitted sample period**:

1. Choose **Submitted period**. Its option identifies an original receipt and
   its explicit dates; the command covers the exact company window, including
   **every** submitted receipt for those same dates.
2. Enter **Closure recorded date** in `YYYY-MM-DD` form, on or after the period
   end, and a **Closure reason** of 2–500 printable characters.
3. Choose **Preview period closure**. In **Period closure preview**, inspect
   **All submitted receipts in this window**, **Consumed time entries**,
   **Pending ordinary preparation**, the date, reason and effect.
4. Choose **Confirm period closure**, or **Cancel closure preview** to retain
   the text without accepting an event.

Closure refuses unresolved draft, submitted/unapproved or approved/unconsumed
time in the window, broken consumed-input links, omitted same-period receipts,
and nonidentical overlapping submitted or closed windows. A periodless legacy
receipt with a known consumed work date inside the window is also a conflict;
the app does not invent its missing period to complete a closure.

Resolve unpaid work through its ordinary controls before closing. A submitted
timesheet can be returned for correction by its scoped manager; an employee can
edit or explicitly delete an unpaid draft. Closed-window rules apply to every
employee and employment instance, including later hires.

### What the lock changes

| Attempt after closure | Result |
| --- | --- |
| Add manual time or stop-and-add a timer for a closed date | Refused; no time entry or sequence is consumed. A failed timer add keeps the running timer available. |
| Edit time into or out of the closed window; submit, approve, return or delete time in it | Refused by the model; existing paid-entry protections still apply. |
| Prepare the same, partially overlapping or wider ordinary period | The **whole period** refuses before row selection. Locked rows are not silently skipped to prepare the remaining rows. |
| Continue an already saved overlapping prepared/calculated/reviewed run | Its snapshot stays intact and import-valid, with a closed-window stale explanation; calculate, review and submit refuse. |
| Intentionally prepare a nonoverlapping open period | Ordinary eligibility and rate checks apply. Use **Reprepare sample payroll** when shown. |

The original submitted payroll, rates, benefits and consumed-time links stay
unchanged. No ordinary command reopens the window. A deliberate complete HR
workspace replacement can restore an earlier pre-closure snapshot under the
normal import/restore/Undo controls; this is a disclosed replacement, not a
tamper-proof lock against the browser owner.

## Review temporary work before the final close

Final closure confirmation checks current writer authority, then asks the
shared unsaved-work controller about these existing HR form groups:

- Chosen payroll period and rate setup.
- Manual time and timers for all known raw or hired employees.
- Edit and return-reason buffers for current time entries.

The scope is conservative: it includes these groups regardless of the draft's
date and reads their latest dirty references. A timer started after preview is
therefore still covered. It excludes the closure/correction forms themselves,
benefits, recruiting, directory, CMS and CRM forms.

**Keep editing** cancels this close attempt and preserves the temporary fields
and timer; it does not call domain confirmation. **Discard and leave** explicitly
discards only the listed currently dirty groups, then attempts confirmation.
Those authorized discards remain discarded if the later confirmation refuses
because the source changed. The closure form's own raw inputs remain intact.
No retain option is offered for this closure decision. A later explicit Confirm
repeats the check.

## Record a separate cumulative monetary correction

A correction can reference a qualified original receipt whether its period is
open or closed. It never requires closure first. Under **Create a separate
fictional payroll correction**:

1. Choose **Original receipt**, then **Correction employee**. Employee IDs come
   from that receipt's captured participants. A current name or rehire instance
   is not substituted for historical identity.
2. Review **Immutable original statement** and **Current cumulative balance**.
3. Enter **Correction recorded date** and **Correction reason**. Recorded dates
   must be valid, stay in control-event order, and be on or after the original
   period end when that end was recorded.
4. Enter all three **corrected cumulative** targets: fictional gross,
   illustrative withholding and sample benefits, in dollars. Use plain decimal
   text with at most two decimals, from `0.00` to `10000000000.00`; no currency
   symbols, separators, exponent notation or negative targets. Net is derived
   as gross minus both deductions and must remain nonnegative.
5. Choose **Preview payroll correction**. Review **Payroll correction preview**:
   original receipt/period/employee, previous adjustment link, immutable original,
   previous cumulative balance, **Separate signed adjustment**, proposed
   cumulative balance, reason and effect.
6. Choose **Confirm fictional payroll correction**, or **Cancel correction
   preview** to keep the inputs without creating a record.

The targets are the desired cumulative balance for this **one original receipt
and employee**, not an amount to add again. The first delta is target minus
original; later deltas are target minus the previous accepted cumulative target.
Every adjustment still references the original receipt and explicitly links its
preceding adjustment. If all components already equal the current cumulative
balance, preview refuses the no-op without creating an event or receipt.

### Worked arithmetic example

These are illustrative values, not a browser test result. With no benefit
deduction, the `$7.51` rounding example above can produce this correction chain:

| Record | Gross | Withholding | Benefits | Net |
| --- | ---: | ---: | ---: | ---: |
| Immutable ordinary original | $7.51 | $1.50 | $0.00 | $6.01 |
| First cumulative target | $8.01 | $1.60 | $0.00 | $6.41 |
| First separate delta | +$0.50 | +$0.10 | $0.00 | +$0.40 |
| Second cumulative target | $7.01 | $1.40 | $0.00 | $5.61 |
| Second separate delta | −$1.00 | −$0.20 | $0.00 | −$0.80 |

The second target is already cumulative. Adding it to the first target or to
the original would double-count. Corrections do not change approved hours,
rate inputs, benefit snapshots, consumed entries, original statements, submitted
history or ordinary payroll counts. They use manual fictional monetary targets;
they do not apply a tax engine or automatically recalculate the ordinary 20%
illustrative withholding. Negative deltas do not debit or recover money.

## Role-specific review

| Preview | Available payroll-control surface |
| --- | --- |
| Employer owner / payroll admin | Qualified original choices, closure/correction preview and confirmation, closed-window list and separate adjustment receipts. |
| Employee | At `/hr/demo/employee/paystubs`, **Your simulated pay receipts** remains original; **Your separate fictional payroll adjustments** contains only that selected employee's adjustments and cumulative balances. |
| Auditor | Management payroll shows **Payroll control metadata** with counts, receipt links, employee IDs and recorded dates; no correction amounts or reasons. |
| HR admin, manager, contractor | No payroll-control writer port or monetary correction projection. Their existing separate HR capabilities retain their scope. |

Role and identity selectors are fictional preview controls, not authentication,
Firebase claims or provider memberships. Complete browser-local saves and exports
still contain all saved HR control amounts/reasons; a role-specific view does not
encrypt or filter the saved workspace.

## Preview freshness, storage and recovery

Previews change no records. Confirmation is one-use and checks the latest
complete source, fixture, actor, route, replacement epoch and preview lifetime
again inside the synchronous root update. Editing/canceling, changing identity
or replacing the workspace can invalidate a preview. A stale/refused confirmation
does not write a domain record; retained form inputs can be reviewed and previewed
again. There is no automatic retry or use of a rendered stale candidate.

A successful control message explicitly means **accepted in memory**. Read the
browser storage notice before refreshing. If a normal domain save fails, the
accepted in-memory record remains available, with a warning and export path;
the older browser save may return after refresh. Export the current workspace
before refreshing to retain those fictional records.

- **Export workspace** / **Import workspace** carry the complete optional HR
  controls. **Export all workspaces** / **Import combined backup** also carry
  them while allowing explicit selective restore. Unsaved fields, running timers,
  restore-point history, preferences and the separate SDK session are not portable
  workspace data.
- HR-only selective restore and Undo replace the complete selected HR snapshot,
  including closure events, corrections and receipt anchors, while unchecked
  CMS/CRM stay separate. Their existing required restore-point capture and
  rollback rules remain in force.
- **Require checkpoint before individual imports** and **Require checkpoint
  before Reset** keep their existing independent opt-in behavior. A required
  capture/preview/storage failure refuses replacement; unknown preferences also
  refuse. A denied import does not replace current memory or saved data.
- **Reset sample changes** restores the fresh HR fixture with no control arm.
  With the Reset checkpoint setting known off, failure to remove the old save
  can still accept fresh records in memory and warns that old data may return
  after refresh. Reset does not clear CMS/CRM or erase existing restore history.
- Strict imports reject malformed controls, changed anchors, broken consumed
  links, forged correction chains and non-JSON data before acceptance. Legacy
  extension absence stays absent. Unsupported legacy receipts remain readable
  in their ordinary history/statement path but cannot become actionable control
  targets; a legacy display fallback never establishes a recorded period.

Recovery inspection counts control events once and one metadata row for the
extension. Complete hidden amounts/reasons/anchor contents affect differences,
but default inspection details expose bounded structured metadata rather than
those values.

## Maintainer boundaries and local checks

The optional `workflow.payrollControl` arm keeps the existing outer save/backup
schemas. One authoritative event stream carries closures and corrections; each
referenced original is captured once in first-use anchor order. Reads, previews,
no-ops, cancellation and refusal do not create an empty arm or consume IDs.

Limits are 100 unique anchored originals, 50 closures, 200 corrections and 250
events, within the existing 2,000,000-character complete HR envelope limit.
Capacity refusal preserves prior history; no automatic pruning is performed.
These serialized limits do not measure or reserve browser storage quota.

Relevant maintained tests are included in the existing aliases:

```bash
npm run hr:test
npm run portals:test
```

The payroll core, controller, UI/host, native guards/codecs and inspection tests
have distinct scopes. A command in this guide is not evidence that it passed.
The [dated QA receipt](PAYROLL-SETUP-QA-2026-10-15.md) records the completed
browser, CI, preflight and original-criterion acceptance against the committed
source above. Repeating a command is a separate observation.

For provider adoption, use [Gusto setup](GUSTO-SETUP.md). These native controls
perform no provider request, filing, funding, bank transfer, debit or reversal.
Provider approval, credentials, server-side organization/role enforcement and
live acceptance remain separate from account-free mock behavior.
