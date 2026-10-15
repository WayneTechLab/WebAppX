# Connected account-free HR portal

This host extension builds on WebAppX 3.4.0 and the portable
[`.SYSTEMX/GUSTO` contracts](../.SYSTEMX/GUSTO/README.md). It is a working
synthetic portal for developing and testing people workflows without a Gusto
account. Native HR saves domain actions to a versioned browser-local snapshot
so they survive refresh at the same origin. **Reset sample changes** clears only
HR’s saved snapshot and restores its fixtures. Use fictional information only;
preview role projections do not secure data saved in this browser.

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
| Recruiting | Draft/publish job, candidate stages and mock hire | A fictional hire creates native onboarding requirements and directory identity |
| Performance | Goals and a self-review/manager-publication/employee-acknowledgment cycle | Private drafts and author-specific transitions feed scoped progress counts |
| Surveys | Draft/publish identified feedback, own answer draft/submission and close | Submitted-only aggregates; employee views contain only their own assigned feedback |
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
saved native data. HR, CMS and CRM use separate versioned `localStorage`
snapshots. Refresh, leaving the demo area and returning, and opening another
tab at the same origin restore each module’s last successful saved state.
**Reset** affects only the selected module. No HR records are copied into CMS
or CRM. See [Template Portals](TEMPLATE-PORTALS.md) for their separate roles
and the [persistence QA receipt](PORTAL-PERSISTENCE-QA-2026-10-14.md) for the
current checked behavior.

The `/hr/demo/sdk` route still has an independent SDK sample session. Returning
to native HR restores its saved snapshot; native actions never modify SDK state.
Only saved domain actions are persisted: unsaved form edits and active timers
are not guaranteed to survive remounts. Visible workspace notices identify
storage failure or rejected malformed/unsupported snapshots. Blocked/full
storage falls back to memory. Browser/site-data clearing, private browsing, or
a different hostname/port can lose or hide samples. Tabs do not live-merge; the
last successful write wins. Anyone with access to the browser can inspect its
saved data, regardless of selected preview role.

| Portal | Useful routes |
| --- | --- |
| Management | `/hr/demo/admin`, `/hr/demo/admin/reports`, `/hr/demo/admin/cases`, `/hr/demo/admin/recruiting`, `/hr/demo/admin/performance`, `/hr/demo/admin/surveys`, `/hr/demo/admin/activity` |
| Employee | `/hr/demo/employee`, `/hr/demo/employee/paystubs`, `/hr/demo/employee/time-off`, `/hr/demo/employee/requests`, `/hr/demo/employee/performance`, `/hr/demo/employee/surveys`, `/hr/demo/employee/activity` |
| Manager | `/hr/demo/manager`, `/hr/demo/manager/time-off`, `/hr/demo/manager/requests`, `/hr/demo/manager/performance`, `/hr/demo/manager/activity` |

Tasks, training, policies, documents and assets have their own applicable portal
navigation entries. The 64 imported portable route definitions remain unchanged;
five additional host routes provide employee/manager requests and activity for
management, employees and managers.

## Native HR workspace files

Use **Export workspace** to download native HR’s full validated domain state as
plain-text JSON. It includes saved onboarding, benefits, time/payroll and
receipts, people operations, service requests, talent records and HR’s saved
role/employee choice. Unsaved form fields, running timers and the independent
SDK sample are excluded. The file includes private review/survey drafts;
export is not limited to the current role projection. Use fictional data only.

To restore here or in another browser, open native HR, choose **Import workspace**
and select the HR file. Inspect its preview and choose **Replace HR workspace**
to replace all native HR records, or **Cancel import**. Export the destination first
if you want to retain it. The importer checks size, format/version, module and
the complete nested schema. Invalid/incompatible files preserve current records;
a storage write failure preserves the prior workspace and reports an error.
A successful import saves locally, survives refresh and leaves CMS/CRM unchanged.
Each portal has a separate backup file; there is no merge or automatic browser sync.

File transfer needs no account or upload, and can bridge origins/browsers. It
does not grant trusted employee membership or execute provider operations.
Read the [backup guide](TEMPLATE-PORTALS.md#export-and-import-without-an-account)
and [backup QA receipt](PORTAL-BACKUP-QA-2026-10-14.md) for scope and verification.

## Earlier persistence browser checkpoint — 2026-10-14

The [current receipt](PORTAL-PERSISTENCE-QA-2026-10-14.md) records successful
same-origin refresh checks for Casey’s hire/four-person directory, completed
onboarding, eight submitted hours, prepared payroll and submitted
`MOCK-PAYROLL-0003`: $240 gross, $48 illustrative withholding, $0 benefits and
$192 net. Avery’s confirmed health election, 40% goal progress, saved self-review
draft, and saved/submitted identified survey answers restored as well. Native
HR restored after SDK preview and About/back. HR Reset followed by refresh
restored HR fixtures while preserving separately saved CMS/CRM markers; their
own Reset checks likewise left HR’s saved people/payroll records intact.

## Recruiting, performance and identified feedback

These modules use native fictional records. The earlier portal QA receipt and
its 70-test checkpoint remain historical. The
[talent/CMS/CRM QA record](HR-TALENT-QA-2026-10-14.md) records that earlier wave's separate
browser and automated acceptance evidence.
That talent checkpoint passed **109 HR** and **20 CMS/CRM tests** (10 each);
those results do not substitute for the current persistence or browser checks.

The earlier talent browser check verified Casey's native hire/directory/onboarding
connection through completion, private self/manager review drafts through publication and employee
acknowledgment, and identified survey results from two submitted ratings (5 and
3), mean 4, closed with `MOCK-SURVEY-0007`. Saved survey drafts contributed no
results. The full receipt preserves the exact scope of those local observations.
Casey's eight October 15 hours, approved by Morgan, then produced
`MOCK-PAYROLL-0003`: $240 gross, $48 illustrative withholding, $0 benefit and
$192 net, matching own pay history. The final dashboard reflected four people,
one hire, one active candidate, one completed goal, Jordan's remaining open
review and the closed survey's two submitted responses. Shared CMS/CRM
navigation preserved those native records; Reset CMS left HR intact.

### Recruiting to native onboarding

1. As owner or HR administrator, open `/hr/demo/admin/recruiting`. Create a draft
   sample job with a fictional title/department and an active sample manager,
   then publish it. Publishing changes only this browser's state.
2. Add a fictional candidate to the published job, using a unique email such as
   `alex.candidate@example.invalid`. The application starts **applied**.
3. Use **Begin screening → Move to interview → Prepare sample offer → Hire into
   mock onboarding**. Stages must be completed in order. An active application
   may instead be rejected; hired/rejected applications are locked.
4. The native hire starts **onboarding**, with pending requirements and
   compensation marked **unconfigured**. Open the directory or select that
   employee in the employee preview, review profile/job, finish the checklist,
   review the summary and explicitly confirm simulated onboarding. A hire alone
   does not complete that review or configure real pay. The unconfigured marker
   describes provider adoption; it does not block the deliberately fixed $30/hour
   native fictional calculator once the employee meets its other sample gates.
5. A published job can close only after all of its candidates are hired or
   rejected. Closed jobs and terminal applications have no reopening path.

Recruiting records are restricted to owner/HR, including exclusion from manager
and auditor views. No public application, job-board publication, invitation,
offer document, compensation agreement, background check or provider account is
created. Native onboarding and sample leave balances belong to the host session.

### Goals and performance review

1. Open the applicable **Performance** page. The employee, direct manager or
   owner/HR can create a goal; only that employee updates whole-number progress
   from 0–100. Use **Save sample progress** or **Complete sample goal**.
   Completed goals are locked.
2. Owner/HR or the employee's direct manager opens a review cycle with a separate
   assigned manager. Only one unfinished cycle per employee is allowed.
3. As that employee, write fictional feedback, **Save self-review draft**, then
   **Submit sample self-review**. Save the current text before submitting.
4. As the assigned direct manager, **Save manager review draft**, then **Publish
   sample review**. Save the current text before publishing.
5. Return to the employee and **Acknowledge sample review**. Acknowledgment records
   receipt, not agreement, a performance score or a compensation decision.

The stages are draft → self-submitted → manager-review → published → acknowledged.
Self-review draft text is excluded from other role projections until submission.
Unpublished manager text stays with that manager, including exclusion from
owner/HR views. Owner/HR can administer cycles but cannot write/submit another
person's self-review or publish the manager's feedback. Managers cannot review
themselves. Auditor projections omit both kinds of review comments; payroll and
contractor roles have no performance records.

### Identified employee feedback

1. As owner/HR, open **Surveys**, choose the employee audience and edit the rating
   and short-text questions. **Create sample survey draft**, or edit an existing
   draft and **Save sample survey draft**, before **Publish saved sample survey**.
   Publication freezes the saved audience and questions.
2. As an assigned employee, open `/hr/demo/employee/surveys`. Choose a whole rating
   from 1–5 and fictional text, then **Save my sample answers**. The saved draft
   remains in that employee's projection and is excluded from submitted results.
3. Use **Submit my sample response** once. Submission shares the employee's name,
   rating and text with owner/HR and the read-only auditor. Submitted responses
   are locked; other employees see only their own answers.
4. Owner/HR can inspect submitted response counts, mean rating and rating
   distribution, then **Close sample survey**. Closing prevents further answers;
   there is no reopening path. New hires are not added to an existing audience.

This is **identified feedback**, with no anonymous collection, anonymization or
minimum response threshold. Managers, payroll admins and contractors receive no
survey records. Neither publication nor submission sends messages or changes
the separate SDK fixture. Real confidential feedback needs an independently
reviewed privacy and retention design before adoption.

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
| [recruiting.ts](../src/hr/recruiting.ts), [recruiting-link.ts](../src/hr/recruiting-link.ts) | Owner/HR pipeline and atomic mock-hire connection to native onboarding/leave balances |
| [performance.ts](../src/hr/performance.ts) | Author-specific goals/review stages and scoped comment privacy |
| [surveys.ts](../src/hr/surveys.ts) | Identified feedback lifecycle, own answer drafts and submitted-only results |
| [insights.ts](../src/hr/insights.ts) | Scoped reports, actionable counts and submitted employee pay statements |
| [HrWorkspace.tsx](../src/hr/components/HrWorkspace.tsx) | Native state, browser-local snapshot restoration, role selection and routing |

The genuine SDK preview at `/hr/demo/sdk` uses its separate development-only mock
API sessions. Native operations do not modify SDK fixtures or provider state.
See [Gusto setup](GUSTO-SETUP.md) for that boundary.

## Work remaining toward a production HR portal

Access provisioning and automation remain specification or fixture previews.
Real candidate intake, external recruiting messages/offers, production review
governance and confidential or anonymous feedback require separate accepted
adapters and policies. Contractor onboarding
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
