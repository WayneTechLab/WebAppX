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
| `/hr/demo/employee/time-off` | Sample request and scoped management approval |
| `/hr/demo/admin/payroll` | Approved hours through fictional payroll calculation, review and simulated submission |
| `/hr/demo/sdk` | Genuine SDK directory, admin onboarding and payroll flows with local synthetic sessions |

Demo roles apply only to synthetic preview data and do not alter Firebase claims.
Native HR preview changes live in React state and reset on refresh. Do not enter
real employee information. Connected routes such as `/admin/hr`, `/employee`,
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

Reset or reload restores the synthetic fixture. The flows do not persist to
Firestore, contact Gusto, send invitations or create provider/cloud accounts.
The optional Firebase module retains its separately documented implementation
and adoption gates; completing a native demo does not enable that module.

## Genuine SDK preview boundary

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
