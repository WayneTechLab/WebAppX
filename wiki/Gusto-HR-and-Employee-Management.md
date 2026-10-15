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
| Employee preview | `/hr/demo/employee` | Own synthetic profile, onboarding checklist, benefit election, timesheet and time-off requests |
| Manager preview | `/hr/demo/manager` | Scoped team records, submitted timesheet review and sample time-off approvals |
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

These host workflows use browser memory. Reset or reload restores the fixture.
Mock totals, confirmations and submission receipts do not send payroll, enroll
benefits or establish provider acceptance. No account, provider or cloud call is
needed. The role selector remains a synthetic fixture control. See
[the step-by-step setup guide](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md)
for the exact routes and completion checks.

## Browser verification — 2026-10-14

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

`npm run hr:test` passed **41 tests**: 16 native model/workflow, 11 SDK-client
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

## Start locally

```bash
npm ci
npm run hr:test
npm run dev
```

Open Vite's printed URL at `/hr/demo`, then choose a synthetic portal/role.
Native state resets on refresh. Use `/hr/demo/sdk` for the selected genuine SDK
components; **Reset SDK samples** clears its separate local session. Production
builds retain the native HR preview; the SDK mock API is local
development only.
This host workflow update keeps the selected dotSYSTEMX 1.9.0-alpha.6 release
and portable contract fingerprints intact. The optional Firebase and real Demo
integration gates remain separate.

Follow [Gusto setup](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md)
for checks, fixtures, optional Firebase module activation and the phased migration
to actual Gusto Demo and production. Return to [Home](Home.md) or
[Unified Template Guide](Unified-Template-Guide.md) for the rest of WebAppX.
