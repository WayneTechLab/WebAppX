# Payroll period closure and correction contract

## Agent 0 implementation assignment — 2026-10-15

This next wave is authorized for implementation in the owned isolated worktree
above published recruiting checkpoint `49a9efe345c815c2bead1cbbeb83204d31e64290`.
GitHub main and all 61 native wiki pages were verified synchronized; wiki source
commit is `85ff5907dc891a20fffd3aab53078bc739383a7a`. The 123 application runtime
files match tested source `7337709b79b995c3f1e76254aa51fd86bbd1f215`.
The canonical goal remains active at **122 done / 878 remaining**.

Agent 0 approves the original hard closure and cumulative monetary-correction
policy plus all five resolutions in section 12 as the implementation contract.
WX-0159 and WX-0160 remain TODO; no payroll-control implementation, test, browser,
CI or acceptance outcome is claimed here. Required final verification and each
original criterion remain intact. The prior temporary v2 and its independent
review are preserved separately. References below to an unassigned or anticipated
publication boundary describe that earlier design stage; this assignment
supersedes those execution-status statements.

Codec and recovery clarification: present control data requires bounded plain
JSON for the complete envelope and exact semantic fields on new control shapes.
Existing unrelated native semantic schemas and supported extra plain-JSON
metadata remain unchanged; anchors preserve complete original snapshots. Ordinary
mounted-source changes stale previews while preserving raw inputs. Deliberately
accepted import/restore/Undo/Reset retains the existing dirty guard and selected
module temporary-state clearing/remount behavior; Keep preserves the prior
workspace and raw input. No draft-survival promise overrides authorized Discard
and replacement.

Additional module boundary: core/replay/guards may import native HR types only
from mock-workflows/persistence. Their runtime imports must remain pure neutral
value/model helpers, so ordinary mock-workflow guards can import the pure payroll
control helpers without a runtime cycle. The existing native period semantics
remain unchanged; strict control qualification uses the same calendar/window
rules. No validator may import UI, storage, a controller or a complete-state
service that imports it.

# Native payroll closure and receipt-linked corrections — contract v2

Prepared for Agent 0 on 2026-10-15. **Design contract v2 incorporating independent review; not implementation or acceptance evidence.**

Resolves the five review areas in `/tmp/webappx-payroll-closure-review.md` under Agent 0 decisions. Section 12 freezes the concrete replay, arithmetic, identity, dirty-decision and integration boundaries. This revision writes only a new temporary contract; the original proposal and review remain preserved.

## 1. Observed basis and exact original scope

Primary checkout inspected:

`/Volumes/WTL - Backup 2026/CSA-iEM/Code/Repos/WayneTechLab/WebAppX`

Current source read/rebase basis: `7337709b79b995c3f1e76254aa51fd86bbd1f215`, containing the recruiting integration. Its active CI and later publication are separate gates; this design does not establish their outcome. Agent 0 identified **122 accepted / 878 TODO** as the anticipated next publication baseline, not a publication or acceptance result verified by this document. WX-0159 and WX-0160 remain TODO.

The original proposal read `6c6079c3b9b2c5fe6e34f39c61f5b3ecef95279a` and observed 111 done / 889 TODO. Those are preserved historical observations, superseded only as this v2 design's source read basis. No repository mutation or catalog status change is made here.

Canonical catalog: `docs/backlog/webappx-1000-todo.json`, schema 1, project
`WebAppX`, intent `proposed-backlog`, creation date `2026-10-14`, original proposal
source commit `8359285c99069349d6218fe871868baab76868e5`.

| Field | WX-0159 | WX-0160 |
| --- | --- | --- |
| Original title | Add mock pay-period closure | Add fictional payroll correction runs |
| Original acceptance | Closing a submitted sample period prevents new entries from silently changing its frozen payroll totals. | A correction references the original receipt and records a separate adjustment without rewriting submitted history. |
| Area | `hr-payroll` | `hr-payroll` |
| Priority | `P1` | `P1` |
| Phase | `portal-maturity` | `portal-maturity` |
| Current status | `todo` | `todo` |
| Original source | `src/hr/mock-workflows.ts` | `src/hr/mock-workflows.ts` |
| Gate | `local` | `local` |
| Dependencies | `[]` | `[]` |

Neither criterion declares the other as a dependency. Implementation ordering
below does not alter these canonical fields. No catalog or repository file was
modified to prepare this proposal. Only this temporary proposal was written.

### Agent 0 approval in principle — 2026-10-15

Agent 0 approved the following design decisions in principle on 2026-10-15:

- Explicit hard closure of a company-wide sample date window, with no reopening
  command and no bypass through overlapping ordinary payroll periods.
- Monetary-only cumulative target corrections, with independently derived signed
  deltas and an immutable original-receipt reference. Original hours, rates,
  consumed entries and submitted receipts remain unchanged.
- Monetary corrections for qualified periodless legacy receipts, without
  fabricating a historical period or using the statement display fallback as
  proof of a recorded closure window.
- Optional `workflow.payrollControl` with one authoritative event collection and
  bounds of 100 receipt anchors, 50 closures, 200 corrections and 250 total
  events, all within the existing complete 2,000,000-character saved-envelope cap.
- Owner/payroll-admin writers, separate own-employee adjustment views and
  auditor metadata without monetary amounts.

This approval and v2 refinement authorize the design direction, **not repository implementation, canonical acceptance or a claim that new behavior has passed tests**. No payroll source changes are authorized while the current CI is running. This v2 has been read against source `7337709…`; before a later implementation assignment, confirm that it is the actual tested/published recruiting source or explicitly rebase to the final publication SHA and catalog. The anticipated 122/878 checkpoint is not treated as published evidence. The original `6c6079…` / 111-item observations remain historical.

The original `dependsOn: []` fields remain unchanged for both criteria. A
correction may reference an open or closed qualified submitted receipt; requiring
closure first would invent a dependency absent from WX-0160. Corrections record
explicit manual fictional monetary targets and reconciled deltas. They invoke
no actual tax engine and do not automatically apply the ordinary run's 20%
illustrative withholding rule to a correction.

## 2. What the current source already provides

| Existing source | Observed behavior | Concrete remaining gap |
| --- | --- | --- |
| `src/hr/mock-workflows.ts:5–35,44–105` | Explicit 1–366-day periods, dated fictional hourly rates, eligibility explanations, prepared snapshots and freshness checks. Current active status, approved/unpaid time, confirmed benefits and rates affect a new run. | No durable open/closed period state or closure command. |
| `src/hr/mock-workflows.ts:233–293,320–359` | Submitted entries become consumed by one payroll receipt. Consumed entries cannot be edited, deleted, returned, approved again or reused. Submission appends a detached complete payroll snapshot. | New unpaid time can be created for the same date window, and another ordinary preparation for that window can include it. This does not rewrite an old receipt, but no explicit closure decision exists. |
| `src/hr/components/HrWorkspace.tsx:213–245` | Management payroll exposes choose period, configure rate, prepare, calculate, review, submit and historical receipts. Owner/payroll admin are the writers. | No Close period action, closure preview, receipt-linked correction form or separate adjustment history. |
| `src/hr/insights.ts:32–59` and `src/hr/components/HrInsights.tsx` | Employee statements use saved submitted totals and frozen inputs; periodless legacy receipts keep the established legacy display fallback. A later rate change does not recalculate a submitted statement. | No correction projection. Adding corrections to ordinary payroll history would either violate its positive-only shape or misrepresent an adjustment as another ordinary hours run. |
| `src/hr/persistence.ts:99–106,114,132–134` | Existing payroll shape accepts nonnegative values and optional period/date fields, preserves legacy snapshots, and checks input references to known employee/time records. | No extension validator, receipt-linked correction reconciliation or closed-window enforcement. Existing legacy validation is not a complete receipt arithmetic/event replay proof. |
| `src/hr/lifecycle.ts` and `tests/hr/lifecycle.test.mjs:294–307` | Employment transitions preserve submitted payroll and consumed time. Historical pay survives termination/rehire. | Closure/correction must continue this behavior rather than recalculate a historical employee using today's status, manager, rate, benefits or employment instance. |
| `src/portals/useDemoPersistence.ts` | Functional setters run once against a synchronous latest-state reference, outside React updater replay, then attempt the browser save. Replacement epoch changes on accepted import/restore/Undo/Reset. | The new controller must use that latest-state boundary and distinguish accepted in memory from saved successfully. |

Relevant existing tests read, not rerun:

- `tests/hr/mock-workflows.test.mjs:235–317`: immutable submitted inputs, role
  checks, no replay, separate per-employee deductions and totals.
- `tests/hr/payroll-periods-rates.test.mjs:41–193`: legacy preservation, explicit
  periods/rates, freshness, new unpaid time after submission, codec round trips.
- `tests/hr/time-editing.test.mjs`: return/edit/delete scope and consumed locks.
- `tests/hr/selected-payroll-insights.test.mjs`: own saved-period statements and
  periodless legacy display compatibility.
- `tests/hr/lifecycle.test.mjs:294–307`: nonempty submitted payroll survives
  termination, rehire and later template selection byte-for-byte.
- `tests/browser/payroll-lifecycle.mjs:262–316`: existing browser journey source
  checks a frozen `MOCK-PAYROLL-0006` with 17.75 hours, gross 532.50, illustrative
  withholding 106.50, benefits 25.00 and net 401.00, plus own statements and
  consumed-input refusal. This source is useful regression coverage, not proof
  of closure or corrections and not a new browser observation by this review.

## 3. Recommended bounded product decisions

### 3.1 Explicit hard closure of a company-wide date window

Recommend a deliberate Close submitted period command after ordinary submission.
Closure is not automatic when a payroll submits. Its scope is the entire fictional
workspace's inclusive date window, across employee identities and employment
instances. It is not a lifecycle employment closure or a provider filing.

For the smallest complete version:

1. Require an explicit recorded period already present on at least one submitted
   receipt. List and capture every submitted receipt for that exact period.
2. Refuse closure while any time in the window is draft, submitted/unapproved,
   approved-but-unconsumed, or inconsistently consumed. Display the exact IDs and
   the reason. Resolve or delete unpaid draft time before closing.
3. Refuse overlapping, nonidentical closed windows. The exact-period submitted receipt list, in retained history order, must equal the closure's complete anchored receipt set. Refuse any extra unanchored same-period receipt, any nonidentical recorded submitted period overlapping the window, and any periodless receipt with a known linked consumed-entry date in the window. Disclose safe conflicting receipt IDs; invent no period ownership or missing historical date. Recheck these invariants on import/replay, not only at creation.
4. Once closed, refuse new time at dates in the window and edits moving time into
   or out of the window. Ordinary prepare must refuse any selected period
   overlapping it, including a larger window intended to bypass the closed dates.
   Submission and freshness must recheck closure; a prepared stale run cannot
   bypass the guard.
5. Enforce this in the model, not just disabled buttons. Stop-timer ultimately uses add-time and cannot bypass closure. At final confirmation, run the conservative existing-ID dirty guard specified in section 12, including a timer started after preview. A failed stop/add preserves its temporary timer and creates no phantom record.
6. Add/submit/approve/return/edit/delete guards use both the existing entry date
   and proposed date where relevant. Existing paid-entry locks stay in force.
   A closed window cannot be reopened by an ordinary command in this slice.
7. Later lifecycle actions, rates, elections or new employees never change the
   closed window, original snapshots or existing paid-entry links.

This is intentionally a hard-lock policy. An alternative is to retain late time
as unpaid, explicitly exclude it from ordinary payroll and add a separate
late-time adjustment pipeline. That is larger than this monetary-only correction slice and remains outside it. Agent 0 has chosen the hard-lock policy above.

### 3.2 Corrections are separate signed monetary adjustments

Recommend one employee and one original submitted receipt per correction, with
explicit **replacement cumulative monetary totals** for gross, illustrative
withholding and sample benefits. Compute net and the signed delta from the
original employee total plus all previously accepted adjustments for that pair.

This avoids requiring users to perform delta arithmetic and supports positive,
negative and deduction-only corrections without negative ordinary payroll rows.
The UI must state that these are manually entered fictional amounts: no tax
engine or automatic 20% recomputation is claimed for the correction. The ordinary
payroll's existing flat arithmetic remains unchanged.

The correction does not edit hours, rates, time entries, election snapshots,
consumption links or an original pay statement. In particular, it must not claim
that extra hours were approved or paid when only a monetary adjustment was
entered. Original hours remain visible beside the separate adjustment. A future
time/rate correction mode would need its own reviewed model and evidence.

Corrections may reference an open or closed original receipt. Requiring closure
would invent a dependency between WX-0160 and WX-0159. Subsequent corrections
always reference the original receipt, never another adjustment as their origin;
an explicit prior-adjustment link orders the same employee/receipt chain.

## 4. Proposed optional durable shape

Names are proposals for Agent 0 review. Keep the existing outer HR/storage/
backup schemas and ordinary `MockPayroll` unchanged. Add only
`workflow.payrollControl?: MockPayrollControlV1`, absent in old saves.

```ts
type PayrollMoney = {
  grossCents: number
  illustrativeWithholdingCents: number
  benefitDeductionCents: number
  netCents: number
}
type SignedPayrollMoney = PayrollMoney // values here may be negative
type PayrollWriter = { role: 'employer-owner' | 'payroll-admin'; employeeId?: string }
type PayrollReceiptAnchor = {
  receipt: string // canonical ordinary MOCK-PAYROLL receipt; positive safe integer suffix
  snapshot: MockPayroll // detached exact original history record, including legacy omissions
}
type PayrollControlBase = {
  id: string             // payroll-control-0001, derived from the own sequence
  sequence: number
  actor: PayrollWriter
  recordedOn: string     // user-supplied valid YYYY-MM-DD, never wall-clock inference
  reason: string
}
type PayrollPeriodClosed = PayrollControlBase & {
  kind: 'period-closed'
  period: MockSamplePeriod
  receiptIds: string[]   // exact nonempty set of anchored original receipts for the window
}
type PayrollAdjusted = PayrollControlBase & {
  kind: 'receipt-adjusted'
  adjustmentReceipt: string // MOCK-PAYROLL-ADJUSTMENT-<padded event sequence>; collision-checked
  originalReceipt: string
  employeeId: string
  previousAdjustmentId: string | null
  previous: PayrollMoney
  proposed: PayrollMoney
  delta: SignedPayrollMoney
}
type MockPayrollControlV1 = {
  schemaVersion: 1
  sequence: number       // next own event, contiguous accepted events only
  anchors: PayrollReceiptAnchor[]
  events: (PayrollPeriodClosed | PayrollAdjusted)[]
}
```

One event collection is authoritative. Derive closure and correction views;
do not maintain a second mutable collection with duplicated event authority.
`previous`, `proposed` and `delta` serve reconciliation and visible review.
The anchor captures a referenced original receipt only once, at its first
accepted closure/correction. Complete anchor snapshots retain unknown legacy
values without retroactive facts. Captures are contained provenance, not another
set of payroll receipts for reporting totals.

No empty extension is materialized during read, render, preview, export, refusal,
cancel or no-op. The first successful close/correction creates it atomically.
New ordinary payrolls continue using the existing global `workflow.sequence` and
ordinary receipt format. Control events use only their own sequence; no historical
ordinary receipt is renumbered and no past submission date/actor is fabricated.

Suggested finite bounds, independent of existing stricter envelope bounds:

| Value | Proposed bound |
| --- | --- |
| Anchored original receipts | 100 |
| Closed windows | 50 |
| Corrections | 200 |
| Total control events | 250; contiguous sequence 1..250, next sequence <=251 |
| Receipts in one closure | 1..100, distinct |
| IDs and receipt strings | Existing safe bounded ID alphabet; maximum 200 characters |
| Reason | Trimmed 2..500 printable characters; no control characters |
| Date window | Existing valid explicit 1..366-day inclusive period |
| Monetary targets | Whole safe integer cents 0..1,000,000,000,000 per component |
| Net | Computed, nonnegative, and exactly gross minus withholding minus benefits |
| Delta | Safe signed integer; proposed minus previous, no negative zero |
| Complete HR save | Existing saved-envelope size limit, checked before acceptance; no pruning |

At a bound, refuse safely with all old records intact. Do not evict older
closures, corrections, anchors or receipts to accept new work.

## 5. Receipt, arithmetic and chronology invariants

### Original target qualification

An anchor must match exactly one current `payrollHistory` record, with matching
receipt and full retained content. A current `workflow.payroll` in submitted
stage with that receipt must agree with the same history record. No duplicate
receipt IDs, duplicate employee totals, duplicate consumed inputs or conflicting
employee/time ownership may qualify. Validate arithmetic and all crosslinks for
targeted originals without globally rewriting/rejecting every permissive legacy
receipt in an extension-absent save.

Require target employee totals to reconcile to original frozen inputs and aggregate values. For each employee, sum unrounded `hours * rateCents` products in native input order, then apply `Math.round` once; never round each input separately. Employee/run hours use their native input order. Monetary original components and aggregate sums must be nonnegative safe integer cents; correction target components are additionally bounded to 1,000,000,000,000 cents. Original withholding/benefits are frozen amounts subject to reconciliation and net equations; qualification imposes no historical 20% rule. Require
each referenced consumed entry to remain approved, owned by the same employee,
linked to that exact original receipt and consistent with its frozen hours and
known saved work date. Original recorded rates/deductions are history, not
recomputed from today's rates/elections. An old receipt that cannot qualify stays
readable/exportable under existing rules; a new action refuses with a bounded
explanation instead of repairing it.

Periodless legacy submitted receipts may receive a monetary-only correction
after target qualification. Their period remains **unknown in the new control
record**; the existing legacy statement display fallback is not historical proof
of an explicit chosen period. They cannot establish closure without a separately
reviewed explicit period-assertion feature, which this slice does not include.

### Correction chain

- The original employee must actually occur in the referenced receipt's frozen
  employee totals and inputs. A same-ID employee added later is not sufficient.
- First `previous` equals that original frozen employee monetary tuple. Every
  subsequent `previous` equals the prior correction's `proposed`, and
  `previousAdjustmentId` is that exact latest event in the same pair.
- `proposed.netCents = gross - withholding - benefits`; each subtraction must be
  safe and the result nonnegative. `delta = proposed - previous` componentwise;
  delta net must also equal delta gross minus delta withholding minus delta
  benefits. A completely zero delta is a refused no-op, consuming no ID.
- A negative delta is a fictional downward adjustment, not a debit, recovery of
  money, cancellation of the original receipt or provider reversal.
- Re-preview after another adjustment recomputes the current previous balance.
  A stale confirmation cannot append the same adjustment twice. Repeating a
  command whose target already equals current amounts is a no-op refusal.
- Ordinary gross/net/payroll-history counts remain original-receipt totals.
  Show original, separate signed adjustments and a clearly labeled cumulative
  illustrative balance in distinct projections. Never count both a correction
  target and its delta as additional ordinary pay.

### Explicit dates and historical identity

`recordedOn` is an explicitly entered real calendar date. For a recorded period,
it must be on/after period end. Accepted control events have nondecreasing
`recordedOn`; equal dates are allowed and own sequence supplies ordering.
Periodless legacy originals have no invented submission/period chronology floor;
only known prior control dates constrain them. This date does not silently
advance `workflow.lifecycle.simulationDate`, invent UTC times or claim when the
original payroll actually submitted.

Owner and payroll-admin are the only writers, as for current payroll. HR admin,
auditor, manager, employee, contractor, unknown role and invalid bound identities
refuse before returning money or another employee's details. Preview roles do not
establish trusted authentication. A currently terminated/on-leave employee's
historical receipt may still be corrected; use original captured identity and
amounts, not current payroll eligibility. Rehire must not move the correction to
a new employment instance or invent an old instance ID that was never captured.

## 6. Commands, preview and latest-root integration

```ts
type PayrollControlCommand =
  | { kind: 'close-period'; period: MockSamplePeriod; recordedOn: string; reason: string }
  | { kind: 'adjust-receipt'; originalReceipt: string; employeeId: string;
      recordedOn: string; reason: string;
      proposed: Pick<PayrollMoney, 'grossCents' | 'illustrativeWithholdingCents' | 'benefitDeductionCents'> }
```

Use a pure candidate/validation/replay boundary and a small volatile command
controller. No storage or provider calls in domain code. Preview must list exact
period/receipts/employee, current amounts, proposed amounts, signed deltas, reason,
explicit date, effect on new time/ordinary preparation, and preservation of
original history. Close preview includes unresolved entries and overlaps as a
non-confirmable refusal. Net and IDs are generated by the domain, not trusted
from form input.

The controller owns opaque private one-use preview handles, never displayed or persisted: at most 8 live bindings, 4,000,000 captured complete-source/raw-fixture characters across them, 10-minute monotonic expiry, and 4,096 issued handles per controller lifetime. Evict oldest live bindings to meet the live/character limits; refuse at the issued limit without weakening secure randomness. Bind the complete current `HrDemoState`, raw base fixture, current
writer, exact command/selection, HR replacement epoch and controller generation.
Full source content changes at the same sequence must stale the handle. Guard
source/actor/epoch both at confirmation and inside the root's latest functional
replacement. Do not authorize by sequence alone or accept a replacement built
from a render-captured partial workflow.

Use private volatile handles rather than serializing the entire HR workspace as
a visible confirmation token. A monotonic expiry can limit preview lifetime but
must not supply domain dates. Random-source failure, expiry, replacement,
identity/role change, form edit, cancel and unmount invalidate handles. Refusal,
replay and no-op leave source, history, clocks, sequences and storage unchanged.

Parent integration must resolve the current actor and effective fixture again
against the latest complete state, including the final recruiting-wave shape
after it lands. Use a root functional update that builds and validates exactly
once against the synchronous current ref, then accepts the complete next state.
Do not use a representative employee projection or pass full state to self-service
UI. A refused current-source callback must not clear a draft or claim success.

Successful acceptance can still have a browser-save warning under the existing
contract. Report accepted in memory separately from saved to browser; clear only
the successful form's dirty group at memory acceptance. Quota/save failure must
not trigger a second command or automatic retry. The ordinary native payroll
commands remain separate; the optional adapter/backend/SDK receive no operation.

## 7. UI and dirty-form contract

Use the existing management payroll route; add no portable route, HrRole,
account claim or provider screen. Recommend a small extracted
`HrPayrollControl.tsx` rather than expanding the existing one-line receipt JSX.

Management controls:

- Submitted period/receipt selector, with explicit legacy unknown-period wording.
- **Preview period closure**, **Confirm period closure**, **Cancel closure preview**.
- **Original receipt**, **Correction employee**, **Correction recorded date**,
  **Correction reason**, **Corrected cumulative fictional gross (dollars)**,
  **Corrected cumulative illustrative withholding (dollars)** and
  **Corrected cumulative sample benefits (dollars)**.
- **Preview payroll correction**, **Confirm fictional payroll correction**,
  **Cancel correction preview**.
- Accessible all-field error summary; focus first invalid editable control.
  Native form validation must not prevent the custom summary.
- Closed-period history and separate adjustment receipt list, with original
  receipt links, explicit dates/actors, previous/proposed/delta values and safe
  read-only fallback when a selected record disappears after restore.

Use exact decimal-string to integer-cent parsing. Refuse empty, exponent,
nonfinite, partial and overprecision input; do not silently round a correction
typed with more than two decimals. Keep exact raw text on refusal while comparing
normalized semantic cents for dirty reversion.

Register separate closure/correction groups with `useHrFormDraft`/`useUnsavedWork`
and stable scoped IDs. Changing receipt, employee, role, view, mode or route uses
the existing scoped dirty decision. Keep editing retains raw inputs and focuses
their real owner; discard invalidates preview then changes the target. Hidden
owner/payroll drafts must remain registered. Preview/cancel alone does not mark
the input draft clean. Validation/stale refusal retains text; only accepted
memory action rebases its own group synchronously.

Closing a period checks temporary time/timer/payroll groups at final confirmation through the concrete conservative ID scope in section 12; Keep cancels the attempted close and discard occurs only through the existing decision. Closure/correction drafts themselves are excluded from that guard. An overlapping saved pending ordinary preparation stays byte-for-byte intact and visibly becomes stale after closure; calculation/review/submission refuse until an intentional open-period preparation. It is never relabeled as a submitted or closed run. Freshness and current selected-period messages distinguish ordinary preparation, closure and correction amounts.

Employee self-service can show only that employee's separate adjustments and
original link, preserving the original statement byte-for-byte. Owner/payroll
admin may see amounts for permitted historical records. Auditor may see bounded
IDs/counts/status/recorded dates without money, reasons or names; other roles must
not acquire compensation through a new projection. Complete HR backup remains
the explicit existing role-agnostic local export, never an authorization claim.

## 8. Validation, recovery and complete preservation

Absence means legacy behavior until explicit use; own `payrollControl: undefined`,
null, unsupported version, partial shape, unknown keys, accessors, hidden/symbol
properties, non-JSON values, cycles and overbounds refuse when present. Read data
descriptors before structural access; never invoke a getter to decide whether
the extension exists. Keep old supported saves and submitted receipts unmodified.

Strictly validate each anchor against its unique actual history record, then replay control events from empty state to reconstruct closure conflicts, receipt/employee chains, previous/proposed/delta arithmetic, sequence, dates and generated IDs. A present extension must have at least one event. Anchors are unique first-use captures in event/receipt-reference order and exactly the union of event references; reject orphan anchors, reordered introductions, duplicate anchors or unused captures. For each closed window, independently recheck the exact current receipt set and every known consumed-entry link as specified in section 12. A malformed present extension never falls back to legacy.
Require exact equality with retained derived/captured values; do not repair an
input, synthesize missing arrays or silently drop records. Explain that editable
local JSON is not a signed audit log: coordinated tampering cannot establish
trusted business history, even when structurally consistent.

Every successful ordinary native command must preserve existing control data.
Closure/adjustment commands must preserve every unrelated HR field, all original
payroll-history bytes/array order, original frozen payroll pointer when applicable,
consumed entries, rates/elections, employment/recruiting/performance/surveys,
operations/balances, selected-role metadata, CMS and CRM records. A deliberate
ordinary reprepare may still replace the current nonhistorical payroll pointer
under its existing rules; it must not alter past history/control anchors.

Complete save, single HR backup, combined backup, selective restore, Undo and
restore-point snapshots must retain the extension. Reset intentionally restores
the absent seed shape. Existing independent import/Reset checkpoint preferences
and reviewed confirmation bindings apply unchanged; no new storage key or
automatic checkpoint on preview/ordinary acceptance.

Recovery inspection adds primary control-event records and one extension metadata
record. Anchor snapshots are contained provenance, not additional primary payroll
receipts. Emit only safe IDs, event kind, original/previous link IDs, bounded
actor role/ID and valid recorded dates/window; never money, reason, employee name,
email or hidden source. All anchor/event content still participates in differences.
Absent-extension inspection output and legacy hashes remain exact. Added/removed
extension collection unions are symmetric, and omission counts remain explicit.

## 9. Independent acceptance evidence required after implementation

No following test or browser observation has been run for this proposal.

### Hand-authored arithmetic fixture

Use an independently specified one-employee original, not an expected value
obtained by invoking the function under test: original 8.0000 hours at 3,000
cents/hour; gross 24,000; illustrative withholding 4,800; benefits 2,500; net
16,700. Give it a real submitted/consumed source setup with a recorded period
`2026-10-01` to `2026-10-15`.

On explicit control date `2026-10-16`:

1. Close it and verify a second identical closure is a no-op refusal.
2. Original statement remains 8 hours and net 16,700.
3. First monetary correction target 27,000 / 5,400 / 2,500 / 19,100 produces
   signed delta +3,000 / +600 / 0 / +2,400.
4. Second target 25,500 / 5,100 / 2,500 / 17,900 produces delta -1,500 / -300 /
   0 / -1,200 from the previous correction; origin still the original receipt.
5. A benefits-only target 25,500 / 5,100 / 2,000 / 18,400 produces delta 0 / 0 /
   -500 / +500. Net equation holds at every step.
6. Sum of adjustment deltas equals latest target minus original. None of these
   changes adds or consumes time, changes original hours, or rewrites its receipt.

Also cover multiple employees/receipts and cent-rounding edge cases with literal
expected records. Existing 17.75-hour/532.50/106.50/25/401 journey must continue
unchanged; do not rewrite its dated receipts as new evidence.

### Focused model / semantic / callback requirements

- Legacy extension absence byte equality; valid old saves/unknown-period originals;
  strict present-invalid refusals including root/nested getters with reads zero.
- Role and exact target scope; missing/duplicate receipt, unknown employee,
  nonreconciling original, forged anchor/history/crosslink, invalid date, overlap,
  unpaid pending time and no-op all refuse without partial state or IDs consumed.
- New time, timer stop, moving dates, approval/submission and larger overlapping
  ordinary payroll preparation cannot bypass hard closure; adjacent open dates
  continue normally. Model guards survive lifecycle/rehire and rate changes.
- Positive, negative, benefits-only and repeated correction chains; exact
  previous link, safe cents/bounds, all-zero delta refusal, aggregate reconciliation.
- Same-sequence changed content, another adjustment, actor/selection change,
  replacement epoch, stale/cancelled/expired/replayed handle and latest-functional
  source changes all refuse; raw form inputs and complete source remain exact.
- Valid import/save/export/combined/selective restore/Undo/Reset round trips;
  existing checkpoint default/required preferences and storage-failure behavior.
- Full HR plus unrelated CMS/CRM byte preservation, nonempty old payroll/history,
  employment/recruiting optional combinations after the recruiting wave lands.
- Scoped self-service/auditor projection absence of other employees' amounts and
  reasons; complete inspection with hidden monetary changes detected but not leaked.
- Actual UI callback tests for dirty ownership, custom validation summary,
  normalization reversion, stale refusal and accepted-memory clean baseline.

### Actual browser requirements

Use a named seed and fresh owned browser profiles/preview child; no user profile,
listener, provider, credentials or injected application state. Hand-author expected
complete exports and compare after UI actions/reload. Keep diagnosis failures.

1. Real period/rate/approval/submission flow, closure preview/cancel/confirm,
   visible scope/receipt/date, unresolved/overlap refusal and subsequent late-time
   refusal. Compare original paid entries and original receipt bytes throughout.
2. Correct the actual original receipt via positive, negative and deduction-only
   UI paths. Verify all literal amounts, separate adjustment receipts and original
   link, exact original employee statement and reload persistence.
3. Dirty receipt/employee/role/route switch Keep/discard, custom all-field summary
   and first-invalid focus; source/restore change between preview and confirmation
   refuses while raw text remains recoverable.
4. Actual selective HR restore plus Undo includes/removes control records as
   captured and preserves complete untouched CMS/CRM exports; Reset removes only
   HR as documented. Test required checkpoint refusal/success where relevant.
5. Employee-own visibility, auditor no money, no controls/amounts for denied roles;
   no hidden duplicate status announcements asserted without actual observations.
6. Keyboard/focus, narrow 390px with x-large text, long receipt/reason, horizontal
   table reachability, grayscale/AX hit testing and controls without clipping.
7. No browser console errors or outgoing provider requests; owned child PID,
   freeze manifest, cleanup and source revision recorded. Report observations as
   local functional/visual evidence only. Manual screen reader, Windows devices,
   provider adoption, real payroll/taxes/funding/filing and owner business approval
   remain separate unclaimed boundaries.

Root performs independent review and required integrated CI/preflight before any
publication or canonical acceptance. Existing stages are preserved; focused tests
are wired once, and new browser groups should extend the existing payroll runner
unless separate runner isolation is concretely necessary.

## 10. Smallest proposed ownership and files

After decisions and rebasing onto the then-frozen recruiting source:

| Ownership | Proposed scope |
| --- | --- |
| Domain owner | New `src/hr/payroll-control-types.ts`, `payroll-control.ts`, `payroll-control-controller.ts`; focused independently authored domain/controller tests. Type-only cross-domain dependencies, no storage/transport. |
| UI owner | New `src/hr/components/HrPayrollControl.tsx`; own callback tests. Props receive permitted projection/port, not a self-service full-state escape hatch. |
| Agent 0 serialized integration | Existing `mock-workflows.ts` closed-window guards and optional type; `persistence.ts` strict extension validation; `HrWorkspace.tsx` latest-root/controller/UI mounting; `insights.ts`/`HrInsights.tsx` separate scoped adjustment projection; shared inspection/UI labels; package/CI/docs/source bindings/catalog/Git. |
| Independent review / browser owner | Refusal/legacy/arithmetic review, hand-authored complete expected exports and actual UI/visual/AX evidence. |

`payroll-control.ts` must not runtime-import persistence if persistence imports its
validator. Use type-only full-state imports, a pure extension replay/validation
boundary and an explicit validated current-state service at the controller/root
boundary. Do not add an ad hoc second global HR store or provider adapter.

## 11. Approved design decisions and remaining execution boundary

Agent 0 approved decisions 1–5 in principle on 2026-10-15. They are recorded here
as the design baseline for independent review, not pending approval questions.

1. **Closure policy:** hard company-window lock with no unresolved unpaid time,
   no reopening and refusal of overlapping windows. A late-time pipeline is
   outside this bounded slice.
2. **Correction meaning:** monetary-only cumulative targets with signed
   derived deltas, explicit manual illustrative amounts and unchanged hours/rates.
   This supports both increase and decrease without claiming new approved hours.
   A corrected-hours/rate engine is a distinct larger design.
3. **Legacy period handling:** monetary corrections for qualified periodless
   legacy receipts but no inferred closure window. Keep all legacy saves/statement
   display rules; do not convert the display fallback into a stored historical fact.
4. **Schema/capture bounds:** optional `workflow.payrollControl`, one event
   authority and at most one full anchor per referenced original, with the proposed
   100-anchor / 50-closure / 200-correction / 250-event and existing-envelope caps.
5. **Review/projection:** owner/payroll writers, own employee separate
   adjustments, auditor metadata only, and one atomic preview/confirm acceptance
   per correction rather than adding persistent correction drafts/review stages.
6. **Execution boundary:** implementation remains unassigned and unauthorized. Independent review has produced the five resolutions frozen in section 12. This v2 reads source `7337709…`, but later implementation must first confirm/rebase to the actual tested and published recruiting checkpoint and its catalog. The anticipated 122/878 baseline is not gate completion. Do not apply this temporary design over a running CI freeze.

## 12. Frozen independent-review resolutions

### 12.1 Complete company-window inventory and immutable history

For each closed window, creation, every accepted complete-state validation and import replay require all of the following. Ordinary payrolls do not share the control event clock; inspecting only anchored rows is insufficient.

- `receiptIds` equals **all** submitted history receipts with that exact explicit period, in retained history order, with no omissions/additions. Every one has a unique exact anchor.
- Refuse extra unanchored same-period receipts and every nonidentical recorded overlapping receipt/window. A periodless receipt with any known consumed-entry date in the window also refuses closure, even if it already has an anchor for a correction. It cannot be smuggled into the exact-period set.
- Every current entry whose known date lies in the window is approved and consumed. Its receipt resolves to exactly one closure-set history record and one matching frozen input, with exact employee, hours and every known frozen date. Every closure receipt input resolves back to exactly one consumed entry. Reject duplicate input ownership across history receipts, orphan links, unpaid entries and changed anchors.
- Missing optional original input dates, rate-effective dates or recorded periods stay missing. A known linked current work date can establish a conflict; it never fills an omitted historical input date or manufactures a period. Invalid/unsupported link data refuses control activation and remains readable under extension-absent legacy rules.
- Adding time or changing any existing/proposed time date into a closed window refuses. Edits moving existing time out of a closed window, submit/approve/return/delete actions on it, and any overlapping ordinary preparation also refuse in the model. Check the whole selected period before computing eligible rows; do not silently exclude only locked rows.
- Known earlier original snapshots, raw history order, consumed entries and current submitted pointer remain exact. If a nonhistorical pending pointer overlaps the newly closed window, preserve it and derive an explicit stale/closed-window reason; allow that stale pointer in valid imports, but block ordinary calculate/review/submit. Intentional reprepare for an open nonoverlapping window is the existing resolution path.

No normal command reopens a closure. Deliberate whole-workspace import/selective restore/Undo may restore a snapshot from before closure, under the existing dirty/confirmation/checkpoint/epoch controls. That is a disclosed replacement, not a tamper-proof permanent lock or a reopening command.

### 12.2 Exact original qualification and cumulative integer corrections

- Require nonempty, uniquely owned frozen inputs and exactly one employee-total row per participating employee, with no unrelated duplicate totals. The correction's selected employee must have original frozen inputs and totals.
- Require finite native-valid hours (`0 < hours <= 24`) and positive safe-integer frozen rate cents. Each referenced current consumed time record must have a valid native YYYY-MM-DD date; arbitrary/unknown date text that the permissive legacy codec accepts is unsupported for control qualification, remains readable/exportable, and is never repaired. An omitted original input date/rate-effective date is different: a qualified periodless receipt may omit them, retaining those omissions even when its linked consumed record has a known valid date. Where original dates exist, validate them and agree with the consumed record. Evaluate products and sums in the original input-array order. For each employee: `hours = sum(hours)` and `grossCents = Math.round(sum(hours * rateCents))`, rounding once after the unrounded sum. Run hours use full native input order; run monetary totals equal the sum of employee monetary tuples in employee-total order.
- All original monetary fields, rounded products/sums and net equations must be nonnegative safe integers; hours sums must be finite; every unrounded product and running gross sum must be finite, nonnegative and no greater than `Number.MAX_SAFE_INTEGER`, and every rounded result must be a safe integer. No coercion, silent rounding of target input, overflow, nonfinite values or negative zero is accepted. Unsupported legacy originals remain readable/exportable but cannot be anchored for control activation.
- Target gross/withholding/benefits are integer cents in `0..1_000_000_000_000`; generated target net is nonnegative and exactly gross minus both deductions. Prior original amounts may exceed the target cap only while remaining safe integers; each derived subtraction must still be safe. No old 20% withholding formula or today's rate/election/eligibility is imposed on a frozen original.
- First `previous` equals the original employee tuple. Later `previous` equals the latest same-original/same-employee event's `proposed`, linked by exact `previousAdjustmentId`. Every delta is proposed minus previous and independently reconciles net. An all-zero delta refuses without consuming IDs. Origin remains the original receipt; corrections neither depend on closure nor use an adjustment as origin.
- Display original statement, individual signed deltas and a cumulative balance for that employee/original pair separately. No unsafe across-receipt grand total or double-counting target plus delta is permitted. This slice needs no across-receipt monetary grand total.
- Original hours, rate inputs, benefit snapshots, consumed-entry receipts, pay history and ordinary payroll counts remain unchanged. Corrections are explicit manual fictional money targets, not extra hours, tax calculations, funding, reversal or recovery of money.

Independent native-UI rounding witness: two entries of `0.125` hours at `3,004` cents/hour have one employee gross of `751` cents after `Math.round(375.5 + 375.5)`, not `752` cents from rounding each input first. The existing draft edit supports `0.0001`-hour steps and the rate form supports `$30.04`; no new input capability or injected application state is required. Preserve the existing native calculation order in tests.

### 12.3 Canonical identities, first-use anchors and replay authority

A qualified original receipt is native-canonical: it matches `^MOCK-PAYROLL-\d{4,}$`; its numeric suffix is a positive safe integer and the whole string equals ``MOCK-PAYROLL-${String(n).padStart(4, '0')}``. Thus `0001` and `10000` are canonical; `0000`, `1`, `00001`, decimals and unsupported imported labels cannot activate controls. Such unsupported legacy receipts are not rewritten or hidden from existing read/export paths.

Control event `n` has `sequence: n`, `id: payroll-control-<n padded to at least four digits>`. A correction at that event has `adjustmentReceipt: MOCK-PAYROLL-ADJUSTMENT-<same padded n>`. The first closure consumes event 1; a following first correction therefore has receipt `MOCK-PAYROLL-ADJUSTMENT-0002`. There is no independent correction counter. Generated IDs/receipts must not collide with any current ordinary pointer/history/control receipt string, including unsupported legacy text. Refuse collision before any acceptance or counter consumption.

Only the event collection is authoritative. A present control extension has schema 1, 1..250 contiguous events, next sequence equal to event count plus one, at most 50 closures/200 corrections, and at most 100 unique anchors. Introduce an anchor exactly once at first reference; closure references follow retained history order, adjustment references its one original. The anchor array follows that first-use order and contains exactly the referenced originals, with their complete snapshot/omissions. Reject empty/partial/unknown version, unused/reordered/duplicate anchors, malformed references, inconsistent current submitted pointer, forged chains, arithmetic and every unknown property. Never repair input or prune accepted history to make room.

### 12.4 Concrete conservative dirty-decision mechanism

The current unsaved API supports only `{portal, ids, label, retain}` selection. It exposes neither a participant enumeration nor a predicate selector. Use that existing exact-ID API; add no global draft readback or wildcard/private registry capability.

Immediately before final closure confirmation, the trusted root coordinator first validates the current native writer/mode/route; an unauthorized caller gets no dirty dialog or target detail. It then derives a conservative list from the **latest complete HR state** and raw fixture:

```text
hr:payroll:period
hr:payroll:rate
hr:time:<each raw-or-hired employee ID>:manual
hr:time:<each raw-or-hired employee ID>:timer
hr:time:<each current time-entry ID>:correction
hr:time:<each current time-entry ID>:return
```

Deduplicate this list. It covers all registered native time/payroll drafts regardless of date, rather than reading private buffers to guess relevance. Unregistered IDs have no effect. Preserve the existing actual ID shapes and recheck them against the final source during implementation. New groups are separately named `hr:payroll-control:closure` and `hr:payroll-control:correction`; neither is in the guard list. CMS/CRM, recruiting, benefits, directory, and unrelated HR groups are excluded.

The trusted root closure-confirm capability runs `request({portal:'hr',ids,label:'Confirm sample period closure; review temporary time and payroll changes',retain:false}, commit)`. The scoped closure child receives this capability, not full HR state/registry access. Request reads live dirty refs and resolution re-reads them, covering a timer started after preview. Keep cancels this close attempt, preserves exact temporary text/timer and does not call the controller; the read-only preview may remain. A queued dirty decision itself is not a failed domain confirmation and does not consume that handle. Every later explicit Confirm repeats this guard; normal edit/source/actor/epoch/expiry/cancel invalidation still applies. Discard is explicitly authorized only for the listed currently dirty groups; it does not fabricate time or mutate domain state.

Inside the accepted decision callback, confirm the original one-use opaque handle through the latest-root controller. Do not rebuild an accepted replacement from rendered props. Domain source/actor/epoch changes stale it, including a newly added employee/time entry after the guard scope was derived; new groups cannot silently enable a close. Every final attempt recomputes the guard scope. Saved pending ordinary payroll is domain state, not a dirty form; preserve its snapshot and display the explicit stale result described in 12.1.

Authorized discard of the listed temporary groups is a separate user-approved effect. If the subsequent domain confirmation refuses as stale, those explicitly discarded groups remain discarded; the closure/correction form's own raw inputs stay intact and no domain record/ID/save is accepted. Explain this in the dialog/closure copy and test it. Refusal without such explicit discard preserves all buffers. Stop/add refusal retains the running timer until a separately authorized discard, with no phantom entry.

### 12.5 Authority, private capabilities, strict optional codec and integration

- Native owner and payroll-admin are the writers. Resolve permitted current actor/selection before target lookup and again inside the latest callback. Historical replay checks the captured writer/known stable identity, not today's employment eligibility. Employee-own adjustment projection is bound to that employee; auditor metadata excludes money/reasons/names. Other roles receive no monetary DTO or target-existence detail.
- Preserve current compact root actor construction: absent employee/contractor fields are omitted, never own `undefined` values. No post-hoc JSON round trip may repair an invalid actor/candidate, and no validator relaxation may accommodate it.
- Private controllers use secure 256-bit random handles with no counter/time/source-digest fallback, 8 live handles, 4,000,000 captured source+fixture characters across bindings, 10-minute monotonic expiry and 4,096 issued handles per controller lifetime. Evict oldest live previews to satisfy live/character caps; never reissue a consumed handle in that lifetime. Random failure/issued limit refuses safely. Bind complete source/fixture/command/selection/actor/epoch/generation. Every failed confirmation, including wrong-family/malformed narrowed requests, consumes the safely supplied own data-property handle without executing a getter. Edits/cancel/unmount/mode/actor/epoch changes invalidate it.
- Detect optional control presence before structural reads: inspect root `workflow` own descriptor first; reject a getter without calling it. Then inspect `workflow.payrollControl` own descriptor. Own `undefined` is present-invalid. A present arm opts its full envelope into bounded plain JSON with strict nested fields, no accessors/hidden/symbol/inherited data/cycles/holes/undefined/nonfinite/overbounds. Recruiting absence is not a bypass. Preserve supported plain-JSON legacy absence and existing recruiting/lifecycle validators.
- Pure control replay/qualification imports full-state types only and concrete pure helpers. It cannot runtime-import persistence, controller, UI or root services if persistence imports it. Trusted composition supplies complete validation at the controller/root boundary. No second HR store, provider write or transport operation is introduced.
- Reads, previews, rejected/no-op/cancelled commands and exports do not materialize the extension. First successful control acceptance is one complete candidate evaluated once against the synchronous latest ref, validated before memory/save, with no intermediate writes. Save failure remains accepted memory with the existing warning/export path; never retry the command automatically.
- Profile edits, termination/rehire, recruiting, benefits, rates and ordinary payroll actions preserve anchors/events and submitted history. Original receipts identify stable employee IDs, not historical names or absent employment-instance IDs. If displaying a current directory label, disclose its current provenance; no correction rebinds to a current rehire instance.
- Recovery/import/selective restore/Undo/Reset retain existing checkpoint preferences, transaction failure rules, dirty guard, source-bound confirmation and replacement epochs. Control records participate in full content differences while inspection emits only bounded safe metadata/explicit omissions. All recruiting/employment/control optional-presence combinations require actual codec and callback coverage.

## Appendix: inspected source hashes

The original proposal fingerprints below remain historical `6c6079…` provenance. The v2 read basis follows them; neither list is payroll implementation evidence.

```text
98251e7ff60deceb7b504972a10e64752a0f0579dd3d8fb628f8025b984f0f25  src/hr/mock-workflows.ts
4ec2c8e543e6b25fa2a955761f95e164563cb6f5db7e67ce8337bc6fc4d1c5f5  src/hr/persistence.ts
2ce6ac351fdc5c8a9447e05ef485650a945bcb7bcf88be2ab8a33d5819f957c3  src/hr/insights.ts
297f4fb063ca37a98a22566a67ec3fe64d92c392931d15d2691261aeba96c9fb  src/hr/components/HrWorkspace.tsx
89d2c31ea8fd5f6a86016bd7d57ace18a02b2c7605df9558ad86923e066087b4  src/hr/lifecycle.ts
7ea3895df10dc73752ee5fb622f3fed08957f0a4d031485d09b1a2747fda05ed  src/portals/useDemoPersistence.ts
```


### V2 current recruiting-source read basis

Observed HEAD `7337709b79b995c3f1e76254aa51fd86bbd1f215`; publication and the anticipated 122/878 catalog checkpoint remain separate pending observations.

```text
4197404a605b370245d4a7542aba9a31ed620c852f1643e330cb42288c638136  src/hr/mock-workflows.ts
052a06301f32565b5c89e8bdde9f2d075752ff08cd172293408116cb8e3a2d1f  src/hr/persistence.ts
2ce6ac351fdc5c8a9447e05ef485650a945bcb7bcf88be2ab8a33d5819f957c3  src/hr/insights.ts
d37bc8bc39d8bd1af1a6b075f7193dda802dd8d7b184d0af90a87bac566749c3  src/hr/components/HrWorkspace.tsx
db1c8cd09a3145d6c0e4dfc48215d961127bb33be0306e7fcec7994ea838fb68  src/hr/lifecycle.ts
7ea3895df10dc73752ee5fb622f3fed08957f0a4d031485d09b1a2747fda05ed  src/portals/useDemoPersistence.ts
dfd6a0be7859fa08f973a9663aa7ec4e721a09c9d1afc29b63765f6a6246aa30  src/hr/recruiting-lifecycle-validation.ts
```
