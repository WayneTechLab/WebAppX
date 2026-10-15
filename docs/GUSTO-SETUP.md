# Gusto and the standard HR workspace

WebAppX 3.4.0 provides account-free native HR workflows, selected genuine Gusto
React SDK workflows, and an optional Firebase backend foundation. The portable specifications
live in `.SYSTEMX/GUSTO/`; React code lives in `src/hr/`, and server adapters in
`integrations/gusto/`. Read each capability's implementation status before adoption.

## Review each capability before connecting

The [Gusto capability adoption gap matrix](GUSTO-CAPABILITY-GAPS.md) covers all
33 portable capability IDs with separate native mock, selected SDK, host backend,
provider and evidence dimensions. Exactly three SDK exports are selected in the
current preview; an endpoint inventory entry does not mean its UI is mounted.
Run `gusto:capabilities:check` to detect source or documentation drift.

Use [reviewed role examples](HR-ROLE-EXAMPLES.md), the proposed
[tenant membership fields](TENANT-MEMBERSHIP-PROPOSAL.md) and
[operations readiness index](OPERATIONS-READINESS.md) when choosing an adoption
scope. For account-free evaluation, follow the
[HR demo](demos/HR-FIVE-MINUTE.md) and [printable worksheet](PORTAL-EVALUATOR-WORKSHEET.md).
The [portal maturity guide](PORTAL-MATURITY.md) explains current payroll setup,
time corrections and recovery controls; its
[dated QA receipt](PORTAL-MATURITY-QA-2026-10-15.md) separates focused local
observations from integrated publishing gates.
To adopt CMS and CRM without HR, use the deliberately separate
[temporary app walkthrough](examples/hr-disabled-adoption.md).

The [native recruiting lifecycle how-to](HR-RECRUITING-LIFECYCLE.md) describes
explicit adoption, requisition review, independent applications, assigned private
scorecards and exact hire previews. Agent 0 **locally accepted WX-0201–WX-0210
and separate WX-0951** on source
`7337709b79b995c3f1e76254aa51fd86bbd1f215`, bringing the catalog to **122 done /
878 remaining**. The [recruiting QA receipt](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md)
records **63 CI stages**, **198 actual browser checks/groups** (184 across
fourteen common suites, 8 HR-disabled and 6 LAN) and Hosting preflight, all with
terminal exit 0. Application **3.4.0**, deploy **0**, remains unchanged; no
deployment or provider activation occurred. Publication is verified separately.

## Try the template without an account

```bash
npm ci
npm run hr:test
npm run dev:mock
```

Open the URL printed by Vite and visit:

| Route | What you can test |
| --- | --- |
| `/hr` | Entry points and connection requirements |
| `/hr/demo` | Synthetic management, employee, manager and contractor workspaces |
| `/hr/demo/admin/employees` | Employee search, status filters and fictional records |
| `/hr/demo/employee/onboarding` | Profile/job review, required checklist and simulated onboarding completion |
| `/hr/demo/admin/employees/:employeeId/onboarding` | Onboarding review opened from a fictional employee's record |
| `/hr/demo/employee/time` | Native time entry, own unpaid draft editing/confirmed deletion and timesheet submission |
| `/hr/demo/manager/time` | Scoped manager approval or return of submitted time with a reason |
| `/hr/demo/employee/benefits` | Employee-owned sample enrollment/waiver, review and confirmation |
| `/hr/demo/admin/benefits` | Read-only sample benefit catalog; no election authority |
| `/hr/demo/employee/time-off` | Vacation/sick request, cancellation and reserved sample balances |
| `/hr/demo/manager/time-off` | Direct-report leave approval/rejection |
| `/hr/demo/employee/tasks`, `/hr/demo/employee/training` | Scoped task and training completion |
| `/hr/demo/employee/policies`, `/hr/demo/employee/documents` | Policy and eligible non-tax document acknowledgments |
| `/hr/demo/employee/assets` | Assigned asset acknowledgment and return request |
| `/hr/demo/manager/assets` | Scoped return confirmation |
| `/hr/demo/employee/requests`, `/hr/demo/manager/requests` | Employee HR help desk and direct-report request queue |
| `/hr/demo/admin/cases` | Owner/HR request assignment, start, resolution and reopening |
| `/hr/demo/employee/activity`, `/hr/demo/manager/activity`, `/hr/demo/admin/activity` | People-operation activity in the selected role's scope |
| `/hr/demo/admin/reports` | Derived native workforce and workflow report with role-gated amounts |
| `/hr/demo/employee/paystubs` | Own simulated statements from submitted native payroll receipts |
| `/hr/demo/admin/recruiting` | Owner/HR legacy pipeline before explicit adoption; locally accepted recruiting lifecycle adds reviewed requisitions, independent applications, interviews, scoped scorecards and exact hire previews |
| `/hr/demo/admin/performance`, `/hr/demo/employee/performance`, `/hr/demo/manager/performance` | Scoped goals and self-review/manager-publication/employee-acknowledgment cycle |
| `/hr/demo/admin/surveys`, `/hr/demo/employee/surveys` | Identified employee feedback with draft, publish, own answer, submit and close stages |
| `/hr/demo/admin/payroll` | Explicit chosen period and employee rate timelines through eligible hours, fictional calculation, review and simulated submission |
| `/hr/demo/sdk` | Genuine SDK directory, admin onboarding and payroll flows with local synthetic sessions |

Demo roles apply only to synthetic preview data and do not alter Firebase claims.
Saved native HR domain changes persist in this browser’s versioned local storage
at the same origin. **Reset sample changes** clears HR’s saved snapshot and
restores its fixtures. Do not enter real employee information. Connected routes
such as `/admin/hr`, `/employee`,
`/manager/hr` and `/contractor` require Firebase sign-in and an adopted server
integration; the reusable template keeps their live data/actions unavailable.

## Complete the native account-free journeys

Start at `/hr/demo` and use the synthetic portal/role selector. These are
app-owned browser workflows. The selector does not authenticate a real employee,
change Firebase claims or grant authority to Gusto. Use the fixture's employee,
manager and management identities as the screen requests. Use an eligible fictional
employee for the benefit/time/payroll link, and confirm any sample enrollment before
preparing payroll if you want its illustrative deduction included.

| Journey | Sequence to review |
| --- | --- |
| Onboarding | Select the fictional employee. Use **Review sample profile** and **Review sample job**, finish every checklist item, then **Review onboarding summary** and **Confirm simulated onboarding**. Inspect the completion receipt and active demo directory state. |
| Benefits | In employee benefits, use **Elect sample enrollment** or **Elect sample waiver** for an available plan, **Review sample election**, then **Confirm sample election**. Inspect its `MOCK-BENEFIT-...` receipt. Management views do not elect or confirm for the employee. |
| Timesheet | In employee time, add a valid sample entry or use the sample timer. Use **Submit own sample timesheet**, switch to its scoped manager and **Approve sample time**, or provide a reason and **Return sample time**. Its employee corrects a returned unpaid draft with **Edit draft**, saves, resubmits and obtains approval. Draft/submitted/returned hours cannot enter payroll; self-approval is unavailable. |
| Payroll | As the demo employer owner or payroll admin, choose **Sample period start/end** and add an explicit dated rate for every otherwise-eligible employee. Read **Time-entry eligibility**, then use **Prepare sample payroll**, **Calculate fictional totals**, **Review simulated payroll** and **Simulate payroll submission**. Inspect its `MOCK-PAYROLL-...` receipt and frozen hours/rates. |

Exercise each stage in order. A later-stage button is not a substitute for its
prerequisites; changing an input requires review of the resulting state before
completion. Mock payroll calculations are sample arithmetic, and the receipt
records a local simulation. Neither sends money, files taxes, enrolls insurance
or writes an external payroll record.

### Choose the native payroll inputs explicitly

1. Open **Management → Payroll workspace** as employer owner or payroll admin.
   Choose **Sample period start** and **Sample period end**. Dates must form a
   valid inclusive range of 1–366 calendar days. **2026-10-01 through
   2026-10-15** is the walkthrough choice; the initial form has no selected period.
2. In **Configure fictional hourly rates**, choose **Rate employee**, enter
   **Fictional hourly rate (dollars)** and **Rate effective date**, then **Add
   sample rate**. Repeat for every otherwise-eligible employee/work date. The
   initial seed has no rates: absent means **unconfigured**, and fixture
   `payCents` values do not declare an hourly cadence. Use an effective date on
   or before the work date. Each later timeline change needs a strictly later
   effective date; each time row uses the latest rate effective on its own date.
3. Read every row in **Time-entry eligibility**. An active fictional employee's
   valid, approved and unpaid time within the chosen period qualifies only with
   an explicit applicable rate. Onboarding completion makes the employee active.
   A missing rate for otherwise-eligible hours blocks preparation with a setup
   error. It does not silently remove those hours.
4. Prepare, calculate, review and simulate submission in order. Preparation
   freezes the period, dates, hours, rates/effective dates and confirmed benefit
   inputs. A changed approved input, applicable rate, eligibility or included
   confirmed benefit makes unfinished preparation stale. Changing the selected
   period also requires reprepare. When **Payroll preparation is stale** appears,
   calculation/review/submission stay blocked until **Reprepare sample payroll**.
   Recalculate and review its new totals deliberately.
5. Inspect the submitted receipt and each included employee's **My pay**. The
   submitted period, time/rates, benefit inputs and totals remain frozen after
   later timeline changes. Consumed time is excluded from later runs. Flat 20%
   illustrative withholding and $25 per confirmed enrolled plan remain sample
   arithmetic, rounded per employee with deductions capped to that employee's
   pay after withholding. These are not wage, overtime, tax or insurance rules.

For the separate **$167 single-employee example**, use a fresh evaluation context
with the unchanged initial seed. Confirm Avery's sample health enrollment, then
as Morgan approve Avery's existing **time-001**, eight hours dated **2026-10-09**.
As employer owner, choose **2026-10-01 through 2026-10-15** and explicitly add
Avery's fictional **$30/hour** effective **2026-10-01**. Jordan's unapproved draft
does not qualify. Prepare and calculate: eight eligible hours and one confirmed
enrollment produce **$240 gross, $48 illustrative withholding, $25 sample benefit
deduction and $167 simulated net**. Review, simulate submission and inspect the
receipt and Avery's own frozen statement. The
[paced two-employee demo](demos/HR-FIVE-MINUTE.md) and
[maturity QA scenario](PORTAL-MATURITY-QA-2026-10-15.md) use different inputs and
totals. Keep each scenario in its own context.

### Correct or remove unpaid draft time

A scoped manager returning submitted time must enter **Return reason for [entry
ID]** and choose **Return sample time**. It becomes an unpaid draft with a
visible retained reason, excluded until its owner corrects/resubmits it and a
different authorized actor approves it. The employee can use **Edit draft**,
change the date/hours and **Save draft changes**, or **Cancel draft editing**.
Validation requires a valid date, positive hours no greater than 24, and at most
24 combined hours for that employee/date across all entries.

For an owned unpaid draft, **Delete draft** opens a confirmation. **Keep draft**
cancels; **Confirm delete draft** removes only that draft. Editing/deleting cannot
change submitted, approved or consumed time, submitted payroll history or frozen
statements. Returning cannot change consumed time or approve the manager's own
entry. See the [HR workflow guide](HR-PORTAL.md#return-correct-or-delete-unpaid-draft-time)
for the connected correction path.

Refreshing restores the last successfully saved native HR snapshot. **Reset
sample changes** clears only HR’s saved state and restores its synthetic fixture.
The flows do not write to Firestore, contact Gusto, send invitations or create
provider/cloud accounts.

The workspace shows storage status. If storage is blocked or full, it visibly
falls back to memory; malformed or unsupported saved snapshots are rejected
and fresh fixtures load with a notice. Unsaved form fields and active timers
are not guaranteed to survive refresh. Private browsing, clearing browser/site
data, or changing hostname/port may lose or hide samples. Tabs do not merge
live changes; the last successful write wins. Saved data is accessible to the
browser user, so role selectors do not make it confidential. Keep every name,
address and free-text field fictional. Read the
[earlier persistence QA receipt](PORTAL-PERSISTENCE-QA-2026-10-14.md) for its
dated verification scope.
The optional Firebase module retains its separately documented implementation
and adoption gates; completing a native demo does not enable that module.

### Back up or transfer native HR

Save the domain actions you want to keep, then choose **Export workspace** in
native HR. The download contains the whole native HR snapshot: recruiting/hires,
onboarding, benefits, time/payroll, explicit rate timelines and frozen periods,
people operations, service requests,
performance and surveys, plus HR’s saved role/employee choice. It excludes
unsaved form edits, running timers and the independent SDK preview session.

In another browser, open `/hr/demo`, choose **Import workspace**, and select the
HR JSON file. Inspect the module, export time and file, then choose **Replace HR
workspace** or **Cancel import**. Import replaces the full HR sample, not selected
employees or a merge. Export the destination first if it needs a backup.
Success saves the replacement to that browser’s storage for refresh; CMS and
CRM remain unchanged. Each individual portal file has its own matching import.

Size, envelope version, module and full nested schema checks run before import.
Invalid/wrong-module files preserve current records, and a failed browser save
keeps the prior workspace with a visible error. Files are read locally without
an upload, login, Firebase or Gusto key. A file can move between origins, but
subsequent saves in each browser remain independent.

Existing schema-version-1 saves, individual/combined files and restore points
remain compatible. New rate, period, frozen input and return metadata are
optional for legacy decoding and strict when present. Old submitted receipts
keep their original fields and historical October 1–15 period interpretation;
an old unfinished preparation requires an explicit chosen period, configured
rates and intentional reprepare. Import does not invent rates or rewrite a
submitted receipt.

Backups are plain-text fictional data, including private review and survey
answer drafts and mock payroll receipts. The current preview role does not
filter the export. Keep real personal information and credentials out; a receipt
inside an editable backup is not provider execution proof. See the
[portal backup guide](TEMPLATE-PORTALS.md#export-and-import-without-an-account)
and [backup QA receipt](PORTAL-BACKUP-QA-2026-10-14.md).

### Include HR in a combined backup

On `/portals`, **Export all workspaces** downloads HR, CMS and CRM together,
including initial samples for untouched portals. **Import combined backup**
validates the entire file and all three module schemas, then previews its export
time, file and per-portal record summaries. HR/CMS/CRM selection boxes start
unchecked; select at least one and choose **Restore selected workspaces**, or
**Cancel combined restore**. Select only HR to replace the complete native HR state while
preserving CMS/CRM memory and saved bytes, or select other whole portals too.
Combined files use the directory’s controls; individual HR files still use HR’s
**Import workspace**. Restore does not merge employees or transfer SDK sessions.

Selected forms/timers reset after successful restore. The app attempts all
selected browser writes before changing their in-memory states, and attempts to
roll back prior saved bytes if any write fails. A second failure during rollback
produces an explicit potentially-partial-storage warning; export current memory
before refresh, restore storage access/capacity, and retry or Reset the affected
portals. Browser storage has no atomic multi-key transaction. See the
[combined backup guide](TEMPLATE-PORTALS.md#combined-backup-and-selective-restore)
and [combined QA receipt](COMBINED-BACKUP-QA-2026-10-14.md). This account-free,
local-file flow requires no Gusto/Firebase credentials or upload.

### Recover a selective restore without an account

Before overwriting selected portals from a combined file, the directory saves a
restore point of those portals’ current domain states. History persists refresh
on the same browser/origin. Choose **Undo…**, review the point’s time, scope and
record summaries, then confirm or cancel. Undo replaces every captured portal
in full, including changes saved afterward. It first saves a new point so the
Undo can be reversed. Selecting HR alone leaves CMS/CRM and SDK state untouched.

At most five points fit within a 2,000,000-character serialized history budget;
oldest points are pruned as needed. If the newest point is too large or browser
storage refuses it, restore/Undo stops before changing workspaces. Damaged or
unsupported history blocks these operations until explicit **Clear restore
points**, which leaves current workspaces intact. Points exclude unsaved forms,
timers and SDK sessions, and are not exported in either JSON format. Individual
imports and Reset capture a labeled destination point only when their separate
required-checkpoint preference is enabled. Both default off; ordinary actions
create no point. See the [current state contract](PORTAL-STATE-CONTRACT.md) and
[safety receipt](PORTAL-SAFETY-QA-2026-10-15.md).

History includes plain-text fictional employee records, drafts and mock receipts.
Use exported files to move records between browsers; local history requires no
Gusto/Firebase account or credentials. See the [restore-point guide](TEMPLATE-PORTALS.md#automatic-restore-points-and-undo)
and [earlier QA receipt](RESTORE-POINTS-QA-2026-10-14.md). The
[maturity guide](PORTAL-MATURITY.md) covers the current named/manual capture,
record inspection and difference-preview controls.

### Earlier refresh verification — 2026-10-14

The [persistence browser receipt](PORTAL-PERSISTENCE-QA-2026-10-14.md) verified
Casey’s hire, completed onboarding, submitted eight hours and prepared payroll
through refresh checkpoints. Submitted `MOCK-PAYROLL-0003` restored $240 gross,
$48 illustrative withholding, $0 benefits and $192 net. Avery’s confirmed health
enrollment, 40% goal progress/self-review draft and saved/submitted survey answers
also restored. Native HR returned after SDK preview and About/back. Reset then
refresh restored only the chosen module’s fixtures, preserving the other two
modules’ saved markers. The receipt also records CMS revision/publication and
CRM lead-to-won refresh checks separately from earlier QA history.

## Recruiting, performance and identified feedback

The talent modules use the native session and role projections. Read the
[talent walkthrough](HR-PORTAL.md#recruiting-performance-and-identified-feedback)
for the earlier authoring sequence, privacy gates and mock hire connection.
The recruiting row below describes the retained **unadopted legacy** workflow;
after deliberate adoption, use the [recruiting lifecycle guide](HR-RECRUITING-LIFECYCLE.md).

| Module | Sequence and scope |
| --- | --- |
| Recruiting | Owner/HR creates and publishes a sample job, adds a unique fictional `.invalid` candidate and advances applied → screening → interview → offer → hired. The hire begins native onboarding with unconfigured compensation; it is not an active employee or an executed offer. |
| Performance | The employee updates own goals and saves/submits own self-review. Only the assigned direct manager saves/publishes manager feedback; the employee acknowledges it. Owner/HR can assign goals/open cycles but cannot impersonate either author. |
| Surveys | Owner/HR drafts questions and audience, saves and publishes. Each assigned employee saves own 1–5 rating/text answers before submitting once. Owner/HR closes the survey. Submitted names/answers are visible to owner/HR/auditor; results are identified, never anonymous. |

### Locally accepted recruiting lifecycle

At the same recruiting route, **Preview recruiting adoption** → **Confirm
recruiting adoption** explicitly captures the saved legacy jobs, candidates,
activity and hires. Reads and ordinary legacy actions do not adopt. Original
jobs/candidates/activity/legacy sequence stay frozen; the original hired-employee
prefix stays unchanged while new hires append captures. Extension
people/applications/jobs/events become the authority for new work. Old activity
has unknown legacy times and
old publication gains no fabricated requisition approval.

Create a sample requisition, request explicit review and record its outcome
before binding/publishing a job. Department, owner and bounded planning
headcount are reviewed separately from the eligible hiring manager. A matching
person email yields a conflict preview without creation; **Choose existing
person for a separate application** starts a deliberate second-job application,
not an identity merge. Rejection and withdrawal require a visible reason and
remain distinct terminal outcomes. Public stage durations use recorded UTC
boundaries and **Apply duration observation**, never sequence or hidden draft
times. Scheduling stores an explicit UTC start, supported named zone, duration
and known participants without invitation delivery.

**Enter interviewer preview** opens only assigned context and the selected
author's cards. **Confirm own draft save** persists privately; **Confirm
scorecard submission** shares that exact saved revision with hiring review.
**Leave interviewer preview** respects Keep/Discard for temporary work. These
are fictional local projection rules. Complete HR saves, deliberate exports and
recovery points include saved private scorecards and draft-save history;
interviewer mode is not account authentication or encrypted isolation.

**Preview exact fictional hire** lists directory, onboarding/checklist,
profile/status, balance and any employment instance/event additions before a
single accepted replacement. Without employment history it leaves that extension
absent. Later materialization can capture actual onboarding completion with an
unknown historical actor/date instead of inventing events. Refresh/import and
selected restore/Undo retain their whole-workspace and storage-failure rules.
Follow the [full how-to](HR-RECRUITING-LIFECYCLE.md) and authoritative
[contract section 12](RECRUITING-LIFECYCLE-CONTRACT.md#12-final-agent-0-integration-decisions)
for exact labels, stale refusals and recovery ordering. Agent 0's acceptance of
the eleven original criteria is recorded in the
[recruiting QA receipt](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md). Earlier QA
receipts retain their original source and observation scope.

Saved survey answers stay out of other role projections and submitted-only
aggregates. Performance self-review drafts stay private until submission;
manager drafts stay with the assigned manager until publication. Auditors see
performance metadata without review comments. Publication/acknowledgment is a
local workflow transition, not legal signing, employee agreement, pay-setting,
external recruitment or provider acceptance. Questions/audiences lock on survey
publication, and future hires are not invited automatically.

The earlier talent wave’s test total and browser evidence are separate from the
70-test portal checkpoint; read the
[talent/CMS/CRM QA record](HR-TALENT-QA-2026-10-14.md). No production service or
SDK fixture is activated. The [Template Portals guide](TEMPLATE-PORTALS.md)
describes independent CMS/CRM roles and state alongside the native HR module.
The earlier talent checkpoint passed **109 HR tests** and **20 CMS/CRM tests**
(10 each). That browser run has its own acceptance scope in the receipt and
does not establish current refresh-persistence behavior.

The verified talent paths include Casey's hire into the native directory and
completed onboarding, performance draft privacy through employee acknowledgment, and an
identified survey with two submitted ratings (5 and 3), mean 4 and closure
`MOCK-SURVEY-0007`. Saved answer drafts contributed zero submitted results.
The CMS browser path also verified returned feedback, exact revision approval,
published-snapshot preservation during edits and retirement. These local
results do not enable a provider or production backend.
In the final native session, Casey's eight October 15 hours were approved by
Morgan and consumed by `MOCK-PAYROLL-0003`: $240 gross, $48 illustrative
withholding, no benefit deduction and $192 net. Own pay history matched.
CMS/CRM/shared-portal checks also passed: a $1,500 opportunity reached won after
single conversion, record scopes held, and CMS Reset preserved HR/CRM state.

## Native people operations and service desk

The additional portal workflows use the same synthetic native session as
onboarding, time, benefits and payroll. WebAppX adds employee/manager request
routes and employee/manager/admin activity routes without changing the portable
SYSTEMX **64-page** contract. Saved operations, request activity and simulated
statements survive refresh at the same origin. **Reset sample changes** clears
HR’s saved snapshot and restores its fixtures. The selected native paths passed
the
[portal browser verification](HR-PORTAL-QA-2026-10-14.md); the earlier
[October 14 QA receipt](GUSTO-BROWSER-QA-2026-10-14.md) retains its original
onboarding/time/benefit/payroll scope and 41-test checkpoint.
Read the [HR portal guide](HR-PORTAL.md) for the detailed capability and scope map.

### Earlier portal automated checks

At that checkpoint, `npm run hr:test` passed **70 tests**: 17 native workflow, 9 people operations,
7 insights, 7 linked operations, 5 service desk, 11 SDK-client mock and 14 optional
backend boundary checks. This establishes the automated model/contract coverage.
The earlier 41-test checkpoint is historical.

### Earlier portal browser verification — 2026-10-14

The [portal QA receipt](HR-PORTAL-QA-2026-10-14.md) records a fresh native session
after full reload, with Firebase initialization disabled and fictional data only:

- Avery's policy acknowledgment updated her mapped task/onboarding item; explicit
  profile/job/summary review and confirmation still completed hiring. Non-tax
  document acknowledgment worked while tax placeholders exposed no action.
  Morgan completed Jordan's mapped training/task without reviewing his profile.
- Avery requested October 19–20 and saw exactly 16 weekday hours. Reservation,
  overlap refusal, manager rejection/approval and employee cancellation worked;
  the final vacation balance returned to 40 hours. Asset return required the
  manager's confirmation.
- Avery and Morgan completed the service-request lifecycle through reopening
  and a second resolution, preserving seven activity actions. Jordan saw no
  request from Avery's session work.
- Avery's confirmed health plan and approved original eight-hour time row
  produced `MOCK-PAYROLL-0003`: $240 gross, $48 illustrative withholding, $25
  sample benefit and $167 net. Her own statement matched those totals and the
  consumed time/plan inputs; Jordan had no statement.
- Owner reports reconciled the receipt, consumed time and leave decisions.
  Auditor reports/history displayed permitted metadata without compensation
  amounts or mutation controls.

These results cover native mock behavior. SDK fixture state stayed separate;
its UI was not rerun for this enhancement. No provider, cloud deployment, real
leave policy, legal signing, insurance or payroll acceptance follows from it.

### Leave requests and balances

1. Choose an employee identity and open **Time off**. Request vacation or sick
   leave using a free date range and **Submit sample leave request**. An employee or manager
   can request only for their own bound identity; owner/HR can select a known
   employee.
2. The fixed sample grant is **40 vacation hours and 24 sick hours per employee**.
   Pending and approved requests both reserve hours. Existing fixture requests
   can therefore make available hours lower than the grant.
3. New requests count eight hours per Monday–Friday date, inclusive, using UTC
   calendar dates. Weekend-only requests, ranges over 30 calendar days,
   insufficient balances and overlaps with the same employee's pending/approved
   leave are refused. The overlap guard compares inclusive date ranges across
   vacation and sick leave.
4. Switch to the employee's manager for a direct-report approval/rejection, or
   to owner/HR for company scope. Use **Approve sample leave**, **Reject sample
   leave** or an authorized **Cancel sample leave**. Rejection/cancellation
   releases the reservation. Inspect the balance and activity
   after each transition. Auditor views are read-only.

This is a fixed fictional policy with no accrual, holiday calendar, partial-day
rules or real PTO/payroll export. Approved leave does not create worked hours
for the native payroll example.

### Assignments, acknowledgments and assets

Open the employee's **Tasks**, **Policies**, **Documents**, **Training** or
**Assets** page, then follow the available scoped action:

| Record | Synthetic transition |
| --- | --- |
| Task | Use **Complete my sample task**; managers/HR have explicitly labeled scoped completion controls. |
| Policy | The assigned person uses **Acknowledge my sample policy**; managers/administrators cannot acknowledge for someone else. |
| Document | The assigned person uses **Acknowledge my sample document** for eligible policy, handbook, welcome or training metadata; tax/provider documents remain unavailable. |
| Training | Use **Complete my sample training**; a permitted manager/HR can explicitly mark an assigned sample complete. |
| Asset | Use **Acknowledge sample assignment**, **Request sample asset return**, then switch to the employee's manager or owner/HR for **Confirm sample asset return**. |

People activity displays scoped `MOCK-PEOPLE-...` receipts and status changes.
The actions do not sign documents, certify training, provision access, move
equipment or establish physical custody. A manager acts within their team;
owner/HR can manage company records and the auditor cannot mutate them.
The bundled policy and training links update only explicitly mapped sample
assignments: Avery's **Demo welcome policy** on **Policies** can complete her
pending policy task/checklist, and Jordan's **Demo starter training** on
**Training** can complete his matching task. A separate document acknowledgment
does not trigger the policy link. These links do not
review Jordan's profile/job, confirm a summary or complete hiring. Adopters must
review their own mappings instead of inferring authority from record titles.

### Service request from employee to manager or HR

1. In `/hr/demo/employee/requests`, choose the fictional employee. Use category
   **Equipment**, **App access** or **HR general**, a sample title such as
   `Demo laptop accessory` and fictional details; then **Submit sample request**.
2. Switch to `/hr/demo/manager/requests` for that employee's manager, or
   `/hr/demo/admin/cases` as owner/HR. Choose the **Sample HR team** or the
   permitted manager, then **Assign sample owner**.
3. Use **Start sample request**, enter a fictional resolution and
   **Resolve sample request**. The authorized manager/HR can then
   **Reopen sample request**. Inspect the `MOCK-HR-...` activity sequence.
4. Return to the same employee to read their own request and resolution. An
   employee cannot resolve/reopen it. Managers see direct-report requests,
   excluding their own requests and company cases. The cases page is not exposed
   to auditors; they use scoped people activity, reports and payroll metadata.

Assignment records responsibility for the sample; it does not expand the
selected actor's role/team permission. No email, account provisioning, equipment
fulfillment or real HR case is sent.

### Dashboards, reports and self-service pay statements

Portal dashboards and **Reports** derive scoped workforce and native workflow
counts from the current session. Counts of all approved/unpaid time can exceed
payroll-ready time, which also requires active employment, a configured rate and
dates inside the prepared period. Before preparation, dashboard readiness uses
the historical October 1–15 sample window; the payroll workspace still requires
an explicit period choice and shows eligibility for its chosen dates.
Compensation amounts are available to owner/payroll admin and to an
employee for their own submitted pay; manager, HR and auditor views do not gain
compensation authority from a dashboard link.

After simulating native payroll submission, switch to an included employee and
open `/hr/demo/employee/paystubs`. **Your simulated pay receipts** shows that
employee's submitted period, totals and frozen time/rate/benefit inputs. Later
rate timeline changes preserve these submitted values. No statement appears
for merely prepared or calculated pay. Each employee's combined benefit deduction
is capped to their own pay after illustrative withholding; employee totals sum
to the run totals. The separate historical fixture statement does not enter
these session totals. These are browser previews, not provider paystub PDFs or
tax documents; native state never feeds the separate SDK fixture.

## Genuine SDK preview boundary

The SDK preview has its own independent sample state. Opening it can unmount
native HR, but returning restores HR’s last successfully saved browser-local
snapshot. SDK state disappears when its preview unmounts; it is not saved by
the native HR/CMS/CRM persistence adapter. Native records never feed SDK payroll.

The SDK preview pins `@gusto/embedded-react-sdk` **0.56.6**, its published API
dependency **0.3.1** and API date **2026-06-15**. Start `/hr/demo/sdk` in Vite
development and select a flow. The genuine components use an absolute same-origin
mock base URL, bounded local endpoint handlers and isolated synthetic sessions:

| Selector | Genuine component and mock boundary |
| --- | --- |
| Employee directory | `EmployeeManagement.EmployeeList`: Active, Onboarding and Dismissed queries, synthetic snake_case responses, version headers and pagination. |
| Employee onboarding | `EmployeeOnboarding.OnboardingExecutionFlow` in admin mode: fictional Profile → Compensation → Federal taxes → State taxes → Check payment → Deductions → Summary. The selected sample omits I-9. |
| Payroll workflow | `Payroll.PayrollExecutionFlow`: fictional configuration/prepare → calculate and poll → review → synthetic submission and poll. No provider or bank is contacted. |

SDK onboarding Summary/Done is navigation, not a completion operation. Finish
the data steps, then review the host's **Simulate employee form review** and
**Simulate new-hire report review** confirmations before **Complete simulated
onboarding**. The host performs an explicit local status update and readback.
These confirmations do not sign legal forms, file a report or verify employment
eligibility. They are additional mock requirements, not hidden legal completion.

### Automated selected SDK status checks

`npm run browser:sdk-quality` opens a separate owned loopback worker and fresh
browser context for the genuine pinned SDK. Its explicit gate permits that
worker's canonical local `/__gusto_mock__/` routes and assets. The native portal
runner keeps its stricter backend boundary. No Gusto account or key is used.

The companion checks startup/retry, directory, onboarding data and final review,
real prepare/calculate/submit pending states, processed receipt and Reset. Rare
API-error render fixtures are labeled separately from ordinary control-driven
transitions. Expected failures are tied to exact one-shot requests. Complete
native browser storage remains unchanged. Read the
[safety QA receipt](PORTAL-SAFETY-QA-2026-10-15.md) and
[status inventory](PORTAL-STATUS-INVENTORY.md) for actual execution and retained
monochrome evidence. This covers the selected local workflows; unmounted SDK
exports and connected provider operations retain their own acceptance scope.

### Repeat the bounded SDK onboarding sample

Select **Employee onboarding** and keep the supplied fictional Jordan record.
The local requests omit cookies and authentication credentials; no Gusto
account, real SSN or bank information is needed. Use only the existing sample
values, and follow this verified Texas/Check path:

| Step | Safe sample action |
| --- | --- |
| Profile | Keep the prefilled fictional identity and masked SSN fixture. Keep `100 Fictional Lane`, `Austin`, `TX`, `78701`; choose the supplied work location and `2026-10-15` in the date picker. Save and continue. |
| Compensation | Use `Fictional Developer`, **Paid by hour** and the illustrative `$30` rate. Save the job/compensation, then continue from the job grid. |
| Federal taxes | Use the sample **Single** status and `0` values. Save and continue; this is fixture input, not tax advice or a filing. |
| State taxes | Continue through the Texas sample with no withholding questions. Other states and question sets are outside this verified path. |
| Payment | Keep **Check** and continue. No real account or routing number is needed. |
| Deductions | Continue through the empty sample deductions. |
| Summary | Inspect the outstanding simulated forms/new-hire requirements. **Done** returns from the data wizard; it does not complete onboarding. |
| Host completion | Select both explicit simulated review confirmations, use **Complete simulated onboarding**, and inspect its completed-status readback. Switch to **Employee directory → Active** and verify Jordan appears there. |

The masked fixture and mock confirmations do not establish legal signing,
identity verification, new-hire filing or real employment eligibility. Reset
the SDK samples to repeat this scenario.

### Repeat the bounded SDK payroll sample

Select **Payroll workflow**. This separate SDK fixture uses fictional Avery's
`$25` hourly rate and a zero-tax calculation; it does not consume the native
timesheet or benefit election used in the `$167` native example above.
No bank connection or account is needed.

| Step | Safe sample action and readback |
| --- | --- |
| Edit hours | Open the row's **Edit** button menu, choose **Edit**, change **Regular Hours** from `80` to `8`, then **Save**. |
| Calculate | Use **Calculate and review** and wait for the local calculation/polling to reach **Review payroll**. |
| Review | The verified fixture shows fictional `$200` gross/company pays, `$0` tax and `$0` debit, **Check** payment and the synthetic company account ending `0000`. These values are sample arithmetic, not a real tax calculation or bank confirmation. |
| Simulate submission | Use **Submit**, then inspect the genuine SDK **Payroll submitted** summary and host **Simulated payroll processed** banner. No Gusto submission, wages, tax filing or funds movement occurs. |
| Inspect fictional receipt | Choose **View payroll receipt**. The session-scoped local receipt appears only after simulated submission, with explicit fictional total, debit/tax labels and local mock text. Reset removes that session’s receipt. This is separate from native statements and is not a provider paystub/download. |

The submitted sample cannot be submitted again without resetting its SDK
session. Download, check/paystub and cancellation actions are outside this
bounded mock journey; a control rendered by the genuine component does not
establish a local handler for every SDK operation.

Selected writes change only local fictional fixtures. Credentials, foreign-company
IDs and unsupported operations remain refused. Native benefit/time/payroll state
is separate from the SDK sample session; native approved hours are not exported
to the SDK by this preview. **Reset SDK samples** clears that session's changes;
refresh starts a new session. Native **Reset** restores its own fixture separately.
Use prefilled fictional data and keep real employee, tax or banking information out.

These selected flows do not establish full SDK, every onboarding scenario, real
tax calculations, payroll funding or provider acceptance. Benefits and time have
native interfaces because SDK 0.56.6 has no corresponding React UI flows.
The local mock server is absent from Hosting and `npm run preview`; the native
HR simulations still run in the built app. The portable `.SYSTEMX/GUSTO` contracts
and selected immutable 1.9.0-alpha.6 distribution retain their original fingerprints.

## Is there a test key?

No shared/public integration key is documented. Gusto Embedded Demo requires a
Developer Portal account, organization and application, which supplies that app's
own client ID and secret. That sandbox setup is separate from opening a live
payroll company. See [Gusto's getting-started guide](https://docs.gusto.com/embedded-payroll/docs/getting-started).

Gusto's [hosted Flows demonstration](https://docs.gusto.com/embedded-payroll/docs/try-it-now)
can be viewed without API keys. It does not supply reusable API credentials.
The local WebAppX mocks are the account-free development path.

Embedded Payroll and App Integrations are separate programs. Embedded fits the
onboarding/payroll/contractor flows in this architecture. SDK installation alone
does not grant API or production access; review the
[program comparison](https://docs.gusto.com/app-integrations/docs/app-integrations-vs-embedded-payroll)
before selecting a Gusto program for an adopted app.

## Package and ownership

Read [the portable package](../.SYSTEMX/GUSTO/README.md),
[route specifications](../.SYSTEMX/GUSTO/ROUTES.json),
[capability ownership](../.SYSTEMX/GUSTO/CAPABILITIES.json), and
[the Firebase adapter](GUSTO-FIREBASE.md).

The selected immutable SYSTEMX release supplies shared defaults. Existing outer
`.SYSTEMX/GUSTO/` copies become project owned on adoption and are preserved by
future imports. Keep local fixtures/configuration out of managed snapshots.
Do not populate the reusable template's coordination or employee records.

| Layer | Owner |
| --- | --- |
| Payroll, tax/bank setup, payment execution and provider documents | Gusto; real execution needs an approved integration |
| Tenant memberships, trusted identity mappings and redacted projections | Adopted app backend |
| Recruiting, organization, checklists, policies, assets, training and performance | App-owned HR modules; page specifications distinguish previews from implemented workflows |
| SDK components and endpoint inventory | Pinned Gusto artifact, with retained upstream license/provenance |
| `.SYSTEMX/GUSTO` contracts and synthetic examples | Portable standard |

## Optional typed provider adapter — locally accepted contract

The app-owned [typed provider contract](../src/hr/provider-adapter.ts) is the
separate local WX-0951 scope. It accepts eight `HrNativeCommand` families:
`workflow`, `people-operations`, `service-desk`, `recruiting`,
`recruiting-lifecycle`, `performance`, `surveys` and `lifecycle`.

| Typed outcome | Contract boundary |
| --- | --- |
| `provider-result` | An adopter-defined value, separate from accepted native state and requiring reviewed validation/projection. |
| `refused` | `invalid-input`, `not-authorized` or `not-ready`. |
| `retry` | `manual-retry` or `review-before-retry`; no scheduled retry or permission to repeat a write. |
| `unsupported` | `adapter-unconfigured` or `unmapped-command`. |

`createUnconfiguredHrProviderAdapter()` returns a frozen mock-default object
with `providerConnected: false` and `payrollExecutionEnabled: false`. `execute`
returns `unsupported / adapter-unconfigured`, reads no payload and performs no
native write, transport or retry work. The `disabled`, `demo` and `production`
mode names are type vocabulary, not activation. Native reducers, the selected
SDK mock session and the optional Firebase backend remain separate. This
interface configures none of them and supplies no provider acceptance. Agent 0
accepted **WX-0951's local typed contract** with the separately recorded
[recruiting QA evidence](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md); that decision
does not activate an adapter or accept a provider integration.

## Adopt the Firebase module

The optional module in `integrations/gusto/functions/` has its own package and
lockfile. It is not registered in root `firebase.json` and is disabled by default.
Read its configuration and [Firebase setup](GUSTO-FIREBASE.md) before activation.

Use a Standard-compatible Firestore model under `organizations/{orgId}`.
Membership, role, employee/company mappings, OAuth material, webhook inboxes and
provider projections are backend managed. Store minimal directory/status
projections separately from restricted HR records. SSNs, bank accounts, tax
answers, raw paystubs and sensitive provider responses are not mirrored by default.
The backend tests exercise membership/resource boundaries independently of page
visibility. Root account level and a role selected in the public preview do not
authorize Gusto endpoints.

## Migration and checks

### Work remaining for a production HR application

The native previews require an adopted backend before real staff use: persistent
organization records, trusted employee/manager mappings, server-enforced scopes,
audit retention, conflict handling and approved notifications. Leave needs the
organization's actual accrual, calendar, partial-day and jurisdiction policy.
Document/asset operations need controlled storage, versioned acknowledgments,
real fulfillment and any required signature or custody process. Service requests
need an accepted support and privacy workflow. Payroll/pay statements still need
authorized provider execution and independently verified wage, tax and deduction
behavior. None of those production integrations is activated by a mock receipt.

The native approved-hours link feeds only the fictional payroll preview. For a
future App Integrations time-tracking adapter, Gusto requires shift-level records
with UTC start/end timestamps, a named time zone and classified hours, rather
than a pay-period aggregate. Review its
[time-tracking integration guide](https://docs.gusto.com/app-integrations/docs/syncing-time-tracking-data)
and validate the program-specific adapter separately.

1. Build and review synthetic navigation, forms, role policy and data contracts.
2. Adopt trusted memberships and native HR storage; validate emulator rules.
3. Obtain application-specific Demo credentials through Gusto's program.
4. Implement the token vault/serialized refresh and curated proxy operations.
   Verify company/self bindings, SDK wire shapes, API date, scopes and conflicts.
5. Verify webhook signatures and representation against actual Demo evidence,
   then validate deduplication and reconciliation with authorized resources.
6. Validate each enabled provider workflow in Demo, including payroll/contractor
   write gates. Demo scope behavior is not production authorization proof.
7. Complete Gusto program/QA and the adopted app's production release gates.

The existing optional Firebase adapter remains a separately tested foundation,
with connected transport disabled. The app-owned typed interface above is a
locally accepted contract. Neither claims full SDK mock coverage or production
payroll readiness. Production deployment and financial actions require their own
operator authorization in the adopted app.

```bash
npm run hr:test
npm run systemx:status
npm run systemx:validate
npm run ci:all                         # maintain this blank reusable template
npm run deploy -- hosting --preflight
```

See [managed imports](SYSTEMX-INTEGRATION.md) and
[template maintenance](TEMPLATE-MAINTENANCE.md) for publication and preservation.
