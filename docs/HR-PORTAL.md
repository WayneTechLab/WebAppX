# Connected account-free HR portal

This host extension builds on WebAppX 3.4.0 and the portable
[`.SYSTEMX/GUSTO` contracts](../.SYSTEMX/GUSTO/README.md). It is a working
synthetic portal for developing and testing people workflows without a Gusto
account. Native React state remains in one browser session; refresh or **Reset
sample changes** restores the fixture. Use fictional information only.

## Implemented native workflows

| Area | Working behavior | Connection |
| --- | --- | --- |
| Dashboards | Role-scoped metrics and action inbox with links to unfinished work | Reflects current onboarding, time, elections, absence, assignments, requests and submitted payroll |
| Employee onboarding | Profile/job review, checklist, summary and simulated completion | Completion makes the fictional employee active for payroll eligibility |
| Benefits | Employee-owned enrollment or waiver, review, confirmation and receipt | Only confirmed enrollments enter a newly prepared payroll snapshot |
| Time tracking | Manual entry, identity-bound timer, submission and scoped approval | Only active employees' approved, unpaid entries in the fixed sample period enter payroll |
| Payroll | Prepare, calculate, review, simulate submission and prevent replay | Stores frozen per-employee totals and consumes only the approved input entries |
| Pay history | Employee-owned simulated statements with time and benefit input details | Reads submitted native payroll receipts; separate historical fixture statements stay labeled |
| Time off | Request, approve, reject, cancel, balance reservations and overlap checks | Pending and approved leave reserve the synthetic balance; decisions update dashboards and activity |
| People assignments | Tasks, policy/document acknowledgments, training and asset return tracking | Role-scoped status changes, assignment counts and deterministic activity receipts |
| HR help desk | Employee request, assignment, start, resolution and reopen | Employee, direct-report manager and management views read the same request state |
| Reports | Current workforce, department, time pipeline, election and absence totals | Payroll amounts follow compensation permissions and submitted receipts |

The synthetic absence policy starts each employee at **40 vacation hours** and
**24 sick hours**, charges **eight hours per Monday–Friday day**, and supports
requests up to 30 calendar days. It excludes holiday calendars, accruals, carryover,
jurisdiction rules and payroll absence earnings. Approved leave does **not** add
paid time to payroll: only approved work time enters the existing calculation.

The fixed sample payroll period is October 1–15, 2026. Rates remain deliberately
fictional: $30/hour, flat 20% illustrative withholding and $25 per confirmed
sample enrolled plan. Amounts round per employee. Benefits are capped against
that employee's own remaining sample pay, and employee statement totals reconcile
to the submitted run. These are development calculations, not wage/tax or
insurance calculations.

## Portal navigation

Start with `/hr/demo`. Switch portals through the links at the top; switch the
fictional employee or management role with its selector. Portal navigation keeps
the current session data. A new tab or full reload starts a separate session.

| Portal | Useful routes |
| --- | --- |
| Management | `/hr/demo/admin`, `/hr/demo/admin/reports`, `/hr/demo/admin/cases`, `/hr/demo/admin/activity` |
| Employee | `/hr/demo/employee`, `/hr/demo/employee/paystubs`, `/hr/demo/employee/time-off`, `/hr/demo/employee/requests`, `/hr/demo/employee/activity` |
| Manager | `/hr/demo/manager`, `/hr/demo/manager/time-off`, `/hr/demo/manager/requests`, `/hr/demo/manager/activity` |

Tasks, training, policies, documents and assets have their own applicable portal
navigation entries. The 64 imported portable route definitions remain unchanged;
five additional host routes provide employee/manager requests and activity for
management, employees and managers.

## Permission boundaries

- Employees act on their own fictional records and view their own simulated pay.
- Managers work within their direct-report scope and cannot approve their own
  time or leave. They can confirm a direct report's sample asset return.
- Owner and HR administrator manage people operations and general HR requests.
- Owner and payroll administrator run simulated payroll. HR administrators,
  managers and auditors do not receive compensation totals from the new reports.
- Auditors review permitted records and receipt metadata without mutation.
- Policy and document acknowledgments are sample acknowledgments, not legal
  signatures. Tax/provider forms remain placeholders.
- Preview roles never create Firebase claims, provider credentials or access to
  live HR records.

## Runtime structure

| Host file | Responsibility |
| --- | --- |
| [catalog.ts](../src/hr/catalog.ts) | Imported portable routes plus explicit host extensions |
| [mock-workflows.ts](../src/hr/mock-workflows.ts) | Onboarding, approved time, benefits and payroll state transitions |
| [people-operations.ts](../src/hr/people-operations.ts) | Absence balances, assignments, records and scoped activity |
| [linked-operations.ts](../src/hr/linked-operations.ts) | Explicit links between sample policy/training assignments and onboarding/tasks |
| [service-desk.ts](../src/hr/service-desk.ts) | Role-checked request lifecycle and receipts |
| [insights.ts](../src/hr/insights.ts) | Scoped reports, actionable counts and submitted employee pay statements |
| [HrWorkspace.tsx](../src/hr/components/HrWorkspace.tsx) | Shared session state, role selection and routing |

The genuine SDK preview at `/hr/demo/sdk` uses its separate development-only mock
API sessions. Native operations do not modify SDK fixtures or provider state.
See [Gusto setup](GUSTO-SETUP.md) for that boundary.

## Work remaining toward a production HR portal

Recruiting/candidate pipelines, performance reviews, surveys, access provisioning
and automation remain specification or fixture previews. Contractor onboarding
and payments remain their separately labeled previews. A complete adopted app
also needs durable tenant-scoped storage, trusted server authorization for each
mutation, audit retention, secure document transport, notification delivery,
validated HR policies and operational support. The optional
[Firebase foundation](GUSTO-FIREBASE.md) is not automatically activated by the
browser workflows.

Authorized Gusto Demo and production integration remains a separate adoption
phase with server-held credentials and provider acceptance checks. No shared
key, provider account, live payroll, legal form completion, tax filing or money
movement is supplied by this portal.
