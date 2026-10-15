# Gusto and the standard HR workspace

WebAppX 3.4.0 provides account-free native HR workflows, selected genuine Gusto
React SDK workflows, and an optional Firebase backend foundation. The portable specifications
live in `.SYSTEMX/GUSTO/`; React code lives in `src/hr/`, and server adapters in
`integrations/gusto/`. Read each capability's implementation status before adoption.

## Try the template without an account

```bash
npm ci
npm run hr:test
npm run dev
```

Open the URL printed by Vite and visit:

| Route | What you can test |
| --- | --- |
| `/hr` | Entry points and connection requirements |
| `/hr/demo` | Synthetic management, employee, manager and contractor workspaces |
| `/hr/demo/admin/employees` | Employee search, status filters and fictional records |
| `/hr/demo/employee/onboarding` | Profile/job review, required checklist and simulated onboarding completion |
| `/hr/demo/admin/employees/:employeeId/onboarding` | Onboarding review opened from a fictional employee's record |
| `/hr/demo/employee/time` | Native time entry and timesheet submission |
| `/hr/demo/manager/time` | Scoped manager review of submitted timesheets |
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
| `/hr/demo/admin/recruiting` | Owner/HR sample job and candidate pipeline, ending in a native onboarding employee |
| `/hr/demo/admin/performance`, `/hr/demo/employee/performance`, `/hr/demo/manager/performance` | Scoped goals and self-review/manager-publication/employee-acknowledgment cycle |
| `/hr/demo/admin/surveys`, `/hr/demo/employee/surveys` | Identified employee feedback with draft, publish, own answer, submit and close stages |
| `/hr/demo/admin/payroll` | Approved hours through fictional payroll calculation, review and simulated submission |
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
| Timesheet | In employee time, add a valid sample entry or use the sample timer. Use **Submit own sample timesheet**, switch to its scoped manager and **Approve sample time**. Draft/submitted hours cannot enter payroll; self-approval is unavailable. |
| Payroll | As the demo employer owner or payroll admin, use **Prepare sample payroll**, **Calculate fictional totals**, **Review simulated payroll** and **Simulate payroll submission**. Inspect its `MOCK-PAYROLL-...` receipt and linked hours. |

Exercise each stage in order. A later-stage button is not a substitute for its
prerequisites; changing an input requires review of the resulting state before
completion. Mock payroll calculations are sample arithmetic, and the receipt
records a local simulation. Neither sends money, files taxes, enrolls insurance
or writes an external payroll record.

The fixed sample pay period is **2026-10-01 through 2026-10-15**. Only an active
fictional employee's approved, unpaid time entries within that period qualify.
Onboarding completion makes that employee active in the demo directory.
Payroll preparation freezes approved hours and confirmed enrollment choices.
Later changes need a new preparation. Entries linked to a simulated submission
receipt are excluded from later runs, and confirmed elections/onboarding stay
locked until Reset. The displayed rate, withholding and benefit deductions are
deliberately fictional; use the screen's labels rather than treating them as
real tax, wage or insurance calculations.

For a repeatable linked example, confirm Avery's sample health enrollment, add
eight hours dated 2026-10-15, submit them and approve them as Morgan. Preparing
payroll as the employer owner produces eight eligible hours and one confirmed
enrollment: fictional gross $240, illustrative withholding $48, sample benefit
deduction $25 and simulated net $167. Review, simulate submission and inspect
the receipt. Jordan's onboarding can be completed separately to verify its
active directory readback. Reset clears receipts and restores the original fixture.

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
[persistence QA receipt](PORTAL-PERSISTENCE-QA-2026-10-14.md) for current verification.
The optional Firebase module retains its separately documented implementation
and adoption gates; completing a native demo does not enable that module.

### Back up or transfer native HR

Save the domain actions you want to keep, then choose **Export workspace** in
native HR. The download contains the whole native HR snapshot: recruiting/hires,
onboarding, benefits, time/payroll, people operations, service requests,
performance and surveys, plus HR’s saved role/employee choice. It excludes
unsaved form edits, running timers and the independent SDK preview session.

In another browser, open `/hr/demo`, choose **Import workspace**, and select the
HR JSON file. Inspect the module, export time and file, then choose **Replace HR
workspace** or **Cancel import**. Import replaces the full HR sample, not selected
employees or a merge. Export the destination first if it needs a backup.
Success saves the replacement to that browser’s storage for refresh; CMS and
CRM remain unchanged. Each portal needs its own backup file.

Size, envelope version, module and full nested schema checks run before import.
Invalid/wrong-module files preserve current records, and a failed browser save
keeps the prior workspace with a visible error. Files are read locally without
an upload, login, Firebase or Gusto key. A file can move between origins, but
subsequent saves in each browser remain independent.

Backups are plain-text fictional data, including private review and survey
answer drafts and mock payroll receipts. The current preview role does not
filter the export. Keep real personal information and credentials out; a receipt
inside an editable backup is not provider execution proof. See the
[portal backup guide](TEMPLATE-PORTALS.md#export-and-import-without-an-account)
and [backup QA receipt](PORTAL-BACKUP-QA-2026-10-14.md).

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
for the exact authoring sequence, privacy gates and mock hire connection.

| Module | Sequence and scope |
| --- | --- |
| Recruiting | Owner/HR creates and publishes a sample job, adds a unique fictional `.invalid` candidate and advances applied → screening → interview → offer → hired. The hire begins native onboarding with unconfigured compensation; it is not an active employee or an executed offer. |
| Performance | The employee updates own goals and saves/submits own self-review. Only the assigned direct manager saves/publishes manager feedback; the employee acknowledges it. Owner/HR can assign goals/open cycles but cannot impersonate either author. |
| Surveys | Owner/HR drafts questions and audience, saves and publishes. Each assigned employee saves own 1–5 rating/text answers before submitting once. Owner/HR closes the survey. Submitted names/answers are visible to owner/HR/auditor; results are identified, never anonymous. |

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
payroll-ready time, which also requires active employment and the fixed sample
pay period. Compensation amounts are available to owner/payroll admin and to an
employee for their own submitted pay; manager, HR and auditor views do not gain
compensation authority from a dashboard link.

After simulating native payroll submission, switch to an included employee and
open `/hr/demo/employee/paystubs`. **Your simulated pay receipts** shows that
employee's submitted totals and frozen time/benefit inputs. No statement appears
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

The current optional adapter is a tested foundation, with connected transport
disabled. The module does not claim full SDK mock coverage or production payroll
readiness. Production deployment and financial actions require their own operator
authorization in the adopted app.

```bash
npm run hr:test
npm run systemx:status
npm run systemx:validate
npm run ci:all                         # maintain this blank reusable template
npm run deploy -- hosting --preflight
```

See [managed imports](SYSTEMX-INTEGRATION.md) and
[template maintenance](TEMPLATE-MAINTENANCE.md) for publication and preservation.
