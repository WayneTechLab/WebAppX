# Gusto HR and employee management

The WebAppX 3.4.0 HR extension standardizes management, employee, manager and
contractor pages around a portable `.SYSTEMX/GUSTO/` contract. The default preview
uses fictional data and requires no Gusto account.

Start with [Gusto setup and testing](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md),
[Firebase architecture](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-FIREBASE.md),
and the [portable package](https://github.com/WayneTechLab/WebAppX/tree/main/.SYSTEMX/GUSTO).

| Surface | Entry point | Implemented boundary |
| --- | --- | --- |
| HR entry | `/hr` | Connection requirements and preview navigation |
| Management preview | `/hr/demo/admin` | Employee directory, onboarding review, read-only benefit catalog and staged fictional payroll |
| Employee preview | `/hr/demo/employee` | Own profile, onboarding, benefits, time/leave, assignments, simulated pay receipts and HR help desk |
| Manager preview | `/hr/demo/manager` | Scoped team records, time/leave review, assignment/asset actions and direct-report service requests |
| Contractor preview | `/hr/demo/contractor` | Separate fictional profile, onboarding and payment previews |
| Gusto SDK preview | `/hr/demo/sdk` in `npm run dev` | Genuine directory, admin onboarding and payroll components with local synthetic sessions |
| Connected portals | `/admin/hr`, `/employee`, `/manager/hr`, `/contractor` | Guarded; live integration remains unconfigured in the reusable template |

The SDK contract pins version 0.56.6 and API date 2026-06-15. The selected local
handlers accept only supported synthetic reads/writes and refuse credentials,
unknown endpoints and foreign-company IDs. Genuine admin onboarding data entry
is followed by explicit mock form/new-hire confirmations and completion readback;
SDK Summary/Done alone is not completion. Genuine payroll uses local
prepare/calculate/poll/review/synthetic-submit transitions through its submitted
summary and the host's **Simulated payroll processed** banner. I-9, legal signatures,
tax filing and money movement remain outside the samples. These selected paths
are not full SDK or provider acceptance. Benefits/time interfaces are native,
and their state is separate from the SDK sample session.
The [setup guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md)
provides the verified fictional Jordan/Texas/Check onboarding sequence and an
SDK payroll walkthrough from **Regular Hours** `80` → `8` through **Calculate
and review → Submit**. Its separate zero-tax fixture shows `$200` gross and no
debit; it does not use the native timesheet/benefit calculation. No real
SSN, banking data, cookies, authentication credentials or Gusto account is needed
for these local requests.

## Native account-free workflow sequence

The local host links the employee, manager and management previews:

1. Review the fictional employee profile/job, complete the required onboarding
   checklist, review the summary and confirm simulated onboarding completion.
2. In the employee self preview, elect sample enrollment or waiver, review and
   confirm the fictional benefit election. Management views are read-only here.
3. Enter and submit the employee timesheet, then use its scoped manager to
   approve it. Payroll consumes approved hours rather than a draft timesheet.
4. Prepare the payroll preview from approved hours, calculate fictional totals,
   review it and simulate submission. Inspect the visible mock receipt.

Use an eligible fictional employee for benefits, time and payroll. The sample
pay period is 2026-10-01 through
2026-10-15; only active employees' approved, unpaid entries in that period qualify.
Payroll preparation freezes approved time and confirmed enrollment choices;
later changes require a new preparation. Receipted time entries cannot be used
again, and completed onboarding/confirmed elections remain locked until Reset.

These native host workflows save domain actions in a versioned browser-local
snapshot. Refresh restores that saved state at the same origin; **Reset sample
changes** clears only HR’s saved snapshot and restores its fixtures.
Mock totals, confirmations and submission receipts do not send payroll, enroll
benefits or establish provider acceptance. No account, provider or cloud call is
needed. The role selector remains a synthetic fixture control. See
[the step-by-step setup guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md)
for the exact routes and completion checks.

## Additional native portal workflows

These native workflows extend the browser-local host preview. The selected
paths passed the portal browser verification below; the earlier core-flow
receipt retains its original scope.

| Area | Workflow and boundary |
| --- | --- |
| Leave | Request, approve, reject or cancel vacation/sick leave. Fixed grants are 40 vacation/24 sick hours per employee; pending/approved requests reserve them. New requests count eight hours per inclusive UTC weekday, reject overlapping date ranges and insufficient balances, and have no accrual/holiday/partial-day policy. |
| Assignments | Complete scoped tasks/training; the assigned person acknowledges their own policy or eligible non-tax document metadata. Sample policy/training links update only matching assignments, without completing hiring. These actions are not legal signing or certification. |
| Assets | Acknowledge an assignment, request return and obtain scoped manager/owner/HR return confirmation; no equipment is moved. |
| People activity | View scoped `MOCK-PEOPLE-...` operation receipts and status changes. |
| Dashboards/reports | Derive workforce and native workflow counts for the selected role. Compensation amounts stay with owner/payroll admin or an employee's own pay. |
| Pay statements | After native simulated submission, `/hr/demo/employee/paystubs` projects own receipt-linked approved hours and employee totals. Benefit deductions are capped to that employee's available sample pay and reconcile to run totals. Historical fixture statements are separate. |
| Service desk | Employee creates an equipment/access/general HR request. A direct-report manager or owner/HR assigns, starts, resolves and can reopen it; employees read their own status. The cases page is not exposed to auditors. |
| Recruiting | Owner/HR publishes sample jobs and advances candidates through applied, screening, interview, offer and hire. A mock hire begins native onboarding with compensation unconfigured. |
| Performance | Own goal progress and self-review, assigned direct-manager publication, then employee acknowledgment. Self and manager drafts have separate visibility gates; auditors see metadata without review comments. |
| Identified feedback | Owner/HR drafts/publishes/closes surveys; assigned employees save and submit own answers. Submitted names/rating/text are visible to owner/HR/auditor; other employees' answers and unsent drafts stay out of employee results. |

New `/hr/demo/employee/requests`, `/hr/demo/manager/requests` and scoped activity
routes belong to WebAppX. The portable SYSTEMX **64-page** contract and managed
alpha.6 fingerprints remain unchanged. Requests, balances, activity and statements
persist with HR’s saved native snapshot until its Reset or site-data clearing;
they neither call Gusto nor feed the separate SDK fixture. Read the
[native portal walkthrough and production gaps](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md#native-people-operations-and-service-desk)
and [HR portal guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL.md)
for actor scopes and step-by-step use. Auditors use scoped activity, reports and
payroll metadata without compensation amounts. Real staff use still needs authenticated
server authorization, persistent records, actual leave policies, controlled
documents/fulfillment and accepted provider payroll integrations.

### Talent workflow scope

Read the [recruiting, performance and identified-feedback walkthrough](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL.md#recruiting-performance-and-identified-feedback)
for the new module APIs and exact save/submit/publish order. Recruiting is
owner/HR-only; it does not execute offers or create provider accounts. A hire
must complete explicit native onboarding before appearing Active. Owner/HR can
administer performance cycles but cannot impersonate either review author.
Survey feedback is **identified, not anonymous**; saved answer drafts stay
private in projections, and submitted-only counts/means do not establish a
confidential-feedback design. The earlier talent browser evidence and test totals
are recorded in the [talent/CMS/CRM QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-TALENT-QA-2026-10-14.md),
separately from the historical portal checkpoint below. Use
[Template Portals](Template-Portals.md) for the independent HR, CMS and CRM demo
navigation, module resets and production boundaries.
The earlier talent checkpoint passed **109 HR** plus **20 CMS/CRM tests** (10
each). Read the [persistence QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-PERSISTENCE-QA-2026-10-14.md)
for current refresh and reset checks. Opening `/hr/demo/sdk` leaves its sample
state independent; returning restores the saved native HR snapshot.

The selected talent browser paths verified Casey's hire/directory/onboarding
connection and performance privacy through employee acknowledgment. An
identified survey produced 2/2 submitted responses, ratings 5 and 3, mean 4 and
closure `MOCK-SURVEY-0007`; private drafts contributed no results. CMS separately
verified exact revision approval, retained publication during edits and
retirement. See the current QA receipt for the bounded local proof.
The final new-hire run also verified Casey's completed onboarding, eight
manager-approved October 15 hours and `MOCK-PAYROLL-0003`/own statement at
$240 gross, $48 illustrative withholding, $0 benefit and $192 net. HR retained
four people while navigating CMS/CRM, and CMS Reset did not clear HR or CRM.
CRM's verified $1,500 won opportunity and ownership/auditor boundaries remain
separate from employee/payroll records.

### Earlier portal verification — 2026-10-14

After a full reload, the native browser check verified policy/task/onboarding
links, non-tax document acknowledgment, training and manager-confirmed asset
return. October 19–20 produced 16 leave hours; overlap was refused and scoped
decisions/cancellation restored the 40-hour vacation balance. Avery and Morgan
completed the seven-action request cycle while Jordan saw no requests.

Avery's confirmed health enrollment and approved eight hours produced
`MOCK-PAYROLL-0003`: $240 gross, $48 illustrative withholding, $25 benefit and
$167 net. Her self-service statement matched the same totals and time/plan
inputs; Jordan saw no statement. Owner reports reconciled the receipt and leave
decisions. Auditor reports/history showed metadata without currency amounts or
mutation controls.

At that checkpoint, the automated HR suite passed **70 tests**: 17 native workflow,
9 people operations, 7 insights, 7 linked operations, 5 service desk,
11 SDK-client mock and 14 backend boundary checks. Read the
[portal QA record](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-PORTAL-QA-2026-10-14.md)
for the exact browser and test scope. The earlier 41-test browser receipt below
remains historical. The SDK UI was not rerun; native state does not modify its
fixture or establish real provider, legal, tax, benefits or payroll acceptance.

## Earlier browser verification — 2026-10-14

The [full browser QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-BROWSER-QA-2026-10-14.md)
records the linked native mock on macOS Apple Silicon, with Firebase
initialization disabled and no Gusto account, provider call or financial action.
Version remains **3.4.0** for these fixes.

| Native check | Observed result |
| --- | --- |
| Pending onboarding | Jordan's new eight hours were approved by Morgan but excluded from payroll while Jordan remained onboarding. Changing the reviewed work email cleared pending profile/summary review. Reviewing again and confirming made Jordan Active and those approved hours eligible. |
| Unconfirmed election | A reviewed but unconfirmed retirement enrollment produced no benefit deduction: $240 fictional gross, $48 illustrative withholding and $192 net. |
| Frozen preparation | Confirming retirement after preparation kept that run at $192 net. Preparing again captured one confirmed plan: $240 gross, $48 withholding, $25 benefit deduction and $167 net. Review/submission produced `MOCK-PAYROLL-0004`. |
| Waiver and employee isolation | Avery's confirmed health waiver and approved eight hours produced $192 net and `MOCK-PAYROLL-0007`. Jordan's receipted hours and enrollment were excluded from Avery's run; both receipts remained visible. |
| Timer ownership | Timers retain their original employee, role and work date. Identity/role changes or Reset cancel them; stopping with the original identity keeps the starting date even if the date field changed. |

At that checkpoint, `npm run hr:test` passed **41 tests**: 16 native model/workflow, 11 SDK-client
mock and 14 optional backend boundary tests. Model regressions also verify that
unchanged profile saves preserve review and later contact edits preserve completed
hiring and its historical receipt. The October 13 release receipt's
39-test result remains historical. Native timesheets and elections stay separate
from the SDK fixture; this session did not retest the SDK onboarding/payroll UI,
deploy Firebase or establish provider, tax, benefits or production acceptance.

## Credentials and ownership

Gusto documents application-specific credentials through a Developer Portal
account; it does not document a shared/public test key. Its
[hosted Flows demo](https://docs.gusto.com/embedded-payroll/docs/try-it-now) is
available without API keys for visual exploration. See the
[Embedded setup](https://docs.gusto.com/embedded-payroll/docs/getting-started)
before a real sandbox integration.

Gusto remains authoritative for payroll/tax/bank/provider documents. The app
owns tenant membership, identity mapping, restricted HR storage and native
recruiting, policies, assets, training, performance and access workflows.
The package records page sections, role permissions, empty/error states and
implementation phases so a specification is not mistaken for a working adapter.

## Native HR export/import

**Export workspace** downloads one complete native HR snapshot as plain-text
JSON, including saved hires/onboarding, benefits, time/payroll receipts, people
operations, requests, performance, surveys and the saved role/employee choice.
It excludes unsaved fields, running timers and the separate SDK session. Whole
workspace export includes private review/survey drafts regardless of preview role.

Open native HR in the destination browser, choose **Import workspace**, select
the HR file and inspect its module/export time/file preview. Choose **Replace HR
workspace** to replace all native HR records, or **Cancel import**. Export the destination
first if you want to retain a copy. Each individual file has its own matching
portal; there is no merge or live synchronization. Success saves only HR locally
for refresh; CMS and CRM records remain unchanged.

The importer validates size, format/version, module and the full nested schema
before replacement. Invalid/wrong-module files and failed browser saves preserve
the prior workspace and report an error. Files are read locally without account
or upload. Use fictional data only; files are not encrypted, trusted memberships
or provider execution proof. See [Template Portals](Template-Portals.md#back-up-restore-or-move-a-workspace)
and the [backup QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/PORTAL-BACKUP-QA-2026-10-14.md).

## HR in a combined backup

The `/portals` directory offers **Export all workspaces** for a single JSON file
with current HR, CMS and CRM records, including fixtures for untouched portals.
At the destination choose **Import combined backup**. The entire file and all
three module schemas must validate before summaries and unchecked selection
boxes appear. Select HR alone, or any combination of full portals, then choose
**Restore selected workspaces**. **Cancel combined restore** leaves records untouched.
Only selected portals are replaced and saved; unselected memory and saved bytes
remain unchanged. Selected unsaved forms/timers reset after success.

All selected writes precede memory changes. Failed saves attempt rollback to
previous selected-key bytes and keep old memory. A rollback failure reports
possibly partial browser storage; export current memory before refresh, restore
storage access/capacity, and retry or Reset affected portals. Browser storage
cannot guarantee an atomic multi-key transaction. Individual HR files continue
to use native HR’s separate import controls.

Bundles are local plain-text fictional data, including private drafts and mock
receipts. They exclude unsaved fields/timers, authentication data and SDK state.
No Gusto/Firebase account, upload or provider action is required. Read
[Template Portals](Template-Portals.md#combined-backup-and-selective-restore)
and the [combined QA receipt](https://github.com/WayneTechLab/WebAppX/blob/main/docs/COMBINED-BACKUP-QA-2026-10-14.md).

## Start locally

```bash
npm ci
npm run hr:test
npm run dev
```

Open Vite's printed URL at `/hr/demo`, then choose a synthetic portal/role.
Saved native HR actions survive refresh in the same browser and origin.
**Reset sample changes** clears only native HR’s saved snapshot. Storage status
is visible: blocked/full storage falls back to memory, and malformed or
unsupported snapshots start fresh fixtures with a notice. Unsaved form fields
and active timers are not guaranteed to restore. Browser/site-data clearing,
private browsing or a changed hostname/port may remove or hide samples. Tabs do
not live-merge; the last successful write wins. Preview roles do not protect
saved data from the browser user, so use fictional data only.

Use `/hr/demo/sdk` for the selected genuine SDK components; **Reset SDK samples**
clears its separate local session. Production builds retain the native HR preview; the SDK mock API is local
development only.
This host workflow update keeps the selected dotSYSTEMX 1.9.0-alpha.6 release
and portable contract fingerprints intact. The optional Firebase and real Demo
integration gates remain separate.

Follow [Gusto setup](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md)
for checks, fixtures, optional Firebase module activation and the phased migration
to actual Gusto Demo and production. Return to [Home](Home.md) or
[Unified Template Guide](Unified-Template-Guide.md) for the rest of WebAppX.
