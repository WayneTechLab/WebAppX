# Portal capability vocabulary

This matrix describes the implemented, account-free HR, CMS and CRM previews.
Its role names are synthetic workflow inputs. Selecting a preview identity,
importing a backup or receiving a `MOCK-*` receipt does not authenticate a user,
set a Firebase claim, grant tenant membership or authorize a provider operation.
The matrix records current source behavior for WX-0501; it is documentation,
not an additional authorization policy.

## Shared terms

| Capability | Meaning in the current previews |
| --- | --- |
| **read** | Obtain the module's rendered or explicitly scoped projection. The scope and excluded fields matter; knowing a record ID alone does not satisfy an ownership check. |
| **create** | Add a supported fictional record or draft through a domain transition. Editing, submitting, completing and acknowledging existing records are described alongside the relevant workflow below. |
| **approve** | Make a workflow decision, such as a leave decision or exact-revision CMS review. A self-service review/confirmation is identified separately; it does not imply permission to approve someone else's record. |
| **publish** | Release a saved sample to another in-app projection or workflow stage. CMS publication freezes a local snapshot; an HR job, survey or performance publication stays inside the synthetic workspace. |
| **export** | Download a readable JSON backup of complete demo workspace state. This is broader than a role's read projection and is explained in [the export boundary](#export-boundary). |

Capabilities apply to an **actor, resource, action and current workflow state**.
For example, a CMS publisher cannot publish an unapproved revision, and a CRM
representative cannot change another representative's opportunity. An allowed
role is only one prerequisite. “None” below means no implemented domain action
in that category; it does not prevent the person using this browser from
switching to a different fictional preview identity.

## HR matrix

HR uses seven `HrRole` values and four portal families. The management preview
offers owner, payroll admin, HR admin and auditor selections; employee, manager
and contractor routes bind their own fictional subject. The route catalog and
host extensions determine which pages each role can open. Domain functions
separately check subjects, reporting lines, assignments and workflow stages.

| Synthetic HR role | read | create | approve | publish | export |
| --- | --- | --- | --- | --- | --- |
| `employer-owner` | Company employee directory/profiles, compensation and simulated payroll; people operations, recruiting, performance and surveys within their field projections | PTO for known employees; recruiting jobs/candidates; goals/review cycles; surveys. Can edit profiles, complete employee onboarding, configure dated fictional hourly rates and prepare/calculate simulated payroll for an explicitly chosen period | Company time and PTO decisions; review/confirm employee onboarding and current simulated payroll. Cannot write another person's self-review, manager review or survey response | Jobs and surveys; cannot publish a performance review as owner | Complete HR backup |
| `payroll-admin` | Company employee directory/profiles, compensation, time/PTO metadata, document index and simulated payroll. Benefit plans are visible; employee elections are not projected to this role | No new time/PTO/recruiting/talent records. Can complete employee onboarding, configure dated fictional hourly rates and prepare/calculate simulated payroll for an explicitly chosen period; cannot edit employee profile email | Review/confirm employee onboarding and current simulated payroll; cannot approve time or PTO | None | Complete HR backup |
| `hr-admin` | Company employee directory/profiles, people operations, recruiting, performance and surveys within their field projections; no compensation or payroll amounts | PTO for known employees; recruiting jobs/candidates; goals/review cycles; surveys. Can edit profiles and complete employee onboarding | Company time and PTO decisions; review/confirm employee onboarding. Cannot impersonate a self-review author, assigned manager reviewer or survey respondent | Jobs and surveys; cannot publish a performance review as HR admin | Complete HR backup |
| `manager` | Own/direct-report workforce, time, leave, assignments and performance; service requests from direct reports. No employee compensation | Own time/PTO; own/direct-report goals; direct-report review cycles. Can edit or explicitly delete own unpaid draft time. Cannot create an HR help-desk request in this role | Direct-report submitted time and pending PTO, excluding self; can return submitted unpaid direct-report time with a reason, review the assigned direct report's performance after self submission and confirm permitted asset returns | Performance reviews only when this actor is the recorded reviewer and still the employee's direct manager | Complete HR backup |
| `employee` | Own profile, compensation/pay statements, time, leave and assignments; own performance projection and assigned published/closed surveys; own help-desk requests | Own time/PTO, goals, help-desk requests and answers to assigned open surveys. Can edit own profile, edit or explicitly delete own unpaid draft time, save own self-review, and progress own goals | No decisions on others. Can review/confirm own onboarding and benefit election, submit own time/self-review/survey, and acknowledge own permitted assignments/published review | None | Complete HR backup |
| `contractor` | Bound contractor profile, payment placeholders, document index and assigned task placeholders; no employee directory or employee compensation | No domain record creation in the contractor UI; its onboarding checklist uses local preview toggles | None | None | Complete HR backup |
| `auditor` | Company directory, contractor directory, document index, reports and people activity; simulated payroll receipt metadata/counts without amounts. Profile details, recruiting, performance and surveys have no auditor route in the current UI | None | None | None | Complete HR backup |

Sources: [`HrRole`, route/subject/compensation and approval helpers](../src/hr/model.ts),
[portable route roles](../.SYSTEMX/GUSTO/ROUTES.json),
[host route additions](../src/hr/catalog.ts),
[workspace routing and actor binding](../src/hr/components/HrWorkspace.tsx),
[onboarding/time/benefits/payroll transitions](../src/hr/mock-workflows.ts),
[people operations](../src/hr/people-operations.ts),
[service desk](../src/hr/service-desk.ts),
[recruiting](../src/hr/recruiting.ts),
[performance](../src/hr/performance.ts),
[surveys](../src/hr/surveys.ts) and
[pay-statement/report projections](../src/hr/insights.ts).

The HR scopes have several deliberate distinctions:

- **Own person and direct report:** self-service transitions require a known
  employee or contractor binding where applicable. Manager time/leave approval
  requires a current direct report and rejects self approval. Performance
  review additionally requires the review's recorded manager. Owner/HR leave
  decisions use their administrative role; the direct-manager self exclusion
  does not impose a separate-person approval rule on those administrative roles.
- **Assignment and acknowledgment:** owners/HR and direct managers can complete
  permitted task/training records, but policy/document acknowledgment requires
  the bound person. Only non-tax policy, handbook, welcome or training document
  types are acknowledgeable. These receipts are not legal signatures or
  physical custody evidence. Employee benefit confirmation is self service;
  administrators cannot elect a benefit for the employee.
- **Private review drafts:** `scopedPerformance` hides draft self comments from
  everyone except the subject. It hides manager comments from non-reviewers
  until publication; auditors never receive either comment field. Owners/HR
  can assign a cycle but cannot write or publish its assigned manager review.
- **Identified survey answers:** `scopedSurveys` returns an employee's own
  audience assignment and answers only after survey publication. Owner/HR and
  the auditor projection receive submitted responses, excluding saved response
  drafts and `saved` activity. These are identified surveys, without an
  anonymity guarantee. Only an assigned employee role can answer.
- **Projection versus page access:** the performance and survey helpers support
  an auditor projection, while the current route catalog excludes auditors from
  those pages. A helper's broader vocabulary does not create an accessible UI
  journey. Contractor checklist toggles are workspace UI state; their route
  presentation is not a domain authorization check.
- **Time correction:** a manager can return submitted, unpaid time only for a
  current direct report other than themselves, with a saved reason. The bound
  employee or manager can edit or explicitly delete only their own unpaid
  drafts, then resubmit corrected time for approval. Submitted, approved and
  receipted time cannot be edited or deleted through those draft actions.
- **Fixture compensation and fictional rates:** the existing fixture
  compensation amount remains read-only and declares no hourly cadence.
  Owner/payroll previews separately append explicit fictional hourly rates for
  known employees with strictly later effective dates. Payroll chooses the
  applicable rate by each work date; a new hire has no implied sample rate.
- **Chosen payroll period and freshness:** new preparations require an explicit
  period of 1–366 calendar days and a configured rate for every otherwise
  eligible employee/work date. The eligibility table explains inclusion and
  exclusion. Changed approved hours, eligibility, rates or confirmed benefits
  require intentional repreparation before calculation, review or submission;
  changing the selected period also makes the UI preparation stale. Submitted
  receipts retain frozen dates, hours, rates, deductions and totals. Own employee
  statements show their receipt's saved period; older receipts without a period
  retain the legacy sample period of 2026-10-01 to 2026-10-15.

## CMS matrix

Every recognized CMS preview identity can read the editorial workspace,
including unpublished content and review feedback. `viewer` means read-only
for domain mutations; it does not mean published-content-only access.

| Synthetic CMS role | read | create | approve | publish | export |
| --- | --- | --- | --- | --- | --- |
| `author` | All editorial entries, drafts, feedback, activity and published samples | Draft page/article; can edit and submit only entries whose `authorId` matches the actor | None | None | Complete CMS backup |
| `reviewer` | All editorial entries, drafts, feedback, activity and published samples | None | Approve or return an `in-review` entry at the expected revision; reviewer must differ from author | None | Complete CMS backup |
| `publisher` | All editorial entries, drafts, feedback, activity and published samples | None | None | Publish an exact, separately approved current revision; retire an existing sample publication | Complete CMS backup |
| `viewer` | All editorial entries, drafts, feedback, activity and published samples | None | None | None | Complete CMS backup |

[`transitionCms`](../src/cms/model.ts) recognizes the actor's exact ID/role pair,
checks expected revisions, and rejects actions with the wrong role or workflow
stage. An author edit increments the revision and invalidates prior approval.
The published snapshot stays frozen while a newer draft changes. The separate
[`cmsPublishedEntries`](../src/cms/model.ts) projection returns only published
content, collection/entry IDs, revision and publication receipt; it excludes
unpublished drafts, author/reviewer metadata and feedback.
[The demo UI](../src/cms/CmsDemo.tsx) exposes both editorial and published views;
its selected role does not turn the whole workspace into that public projection.
The create/edit forms use the same ordered field validation as the domain and
show every affected field, moving focus to the first invalid control. Selecting
another entry with unsaved author changes offers **Keep editing** or **Discard
changes and switch** before changing the editor. A successful save establishes
a clean baseline. Surrounding title/body whitespace and slug case/whitespace
that normalize to the saved values do not create a dirty warning. Temporary
form buffers survive preview identity changes and remain outside saved exports.

## CRM matrix

| Synthetic CRM role | read | create | approve | publish | export |
| --- | --- | --- | --- | --- | --- |
| `owner` | All companies, contacts, leads, opportunities, tasks and activity | Companies/leads; contacts/opportunities/tasks on valid linked records. Can qualify/convert leads, advance open opportunities and complete tasks across owners | None; qualification/conversion are direct sales workflow transitions | None | Complete CRM backup |
| `sales-manager` | Same company-wide synthetic scope as owner | Same supported transitions and linked-record scope as owner | None | None | Complete CRM backup |
| `sales-rep` | Own records and activity, with company/contact/opportunity links also required to remain in scope | Own companies/leads; contacts/opportunities/tasks only through permitted linked records. Can qualify/convert own leads, advance own open opportunities and complete own tasks | None | None | Complete CRM backup |
| `auditor` | All synthetic CRM records and activity | None | None | None | Complete CRM backup |

[`scopedCrmState`, `canWriteCrm` and `transitionCrm`](../src/crm/model.ts)
recognize exact fixture actor ID/role pairs. Read and write scope checks exist in
the model, including direct calls that bypass the buttons. Company/contact/
opportunity/task links must agree; cross-owner or missing linked records cannot
be used to expand a representative's projected scope. New companies and leads
belong to the creating actor; contacts and opportunities inherit the company
owner, and tasks inherit the opportunity owner. Owner and sales manager do not
gain a separate approval or external-publication workflow. Winning a sample
opportunity creates no invoice, contract, payment or outbound message.
The [CRM persistence validator](../src/crm/persistence.ts) requires recognized
string enums and consistent ownership/relationship edges before import can
replace a saved workspace. Unsupported properties, including notes, are refused
rather than added to the schema; oversized notes are therefore also refused.
Individual and combined import paths revalidate complete graphs before applying
replacement. These compatibility checks do not grant a preview role access.

## Export boundary

**All preview roles can download the complete module workspace, including
records and fields outside their current read projection.** The per-portal
[`DemoWorkspaceBackup`](../src/portals/DemoWorkspaceBackup.tsx) has no actor
parameter or role check. HR, CMS and CRM callers pass their complete current
domain state, rather than `scopedPerformance`, `scopedSurveys`,
`cmsPublishedEntries` or `scopedCrmState` results. Consequently:

- An HR contractor or auditor preview can export HR state containing saved
  performance draft comments, survey draft answers, payroll state and receipts
  where present, even though those fields are absent from that role's pages.
- A CMS viewer can export unpublished drafts and review metadata.
- A CRM representative can export other representatives' records from the
  shared fictional workspace.

The [portal directory](../src/pages/TemplatePortalsPage.tsx) also renders
[`CombinedWorkspaceBackup`](../src/portals/CombinedWorkspaceBackup.tsx) without
requiring any preview identity. `createCombinedBackup` receives all three
workspaces, including default state for an untouched portal. Selecting one
portal for restore does not create a narrower export.

The [single backup codec](../src/portals/backup.ts) and
[combined codec](../src/portals/combined-backup.ts) validate format, version,
timestamp, size and complete domain graph compatibility. These checks establish
that fictional state can be restored; they do not prove who exported it or
authorize its contents. Files are readable JSON and contain saved domain drafts
and receipts. Unsaved form fields, running timers, restore-point history and
the separate SDK mock session are excluded. Per-module import and selective
whole-portal restore use explicit replacement confirmation, without a role or
tenant authorization boundary.

The directory's [restore history](../src/portals/RestorePointHistory.tsx) is a
separate local facility with no preview-role check. A named manual point captures
the explicitly selected portals' current domain state into history only;
it does not apply a restore, rewrite workspace save slots or clear temporary
forms. Renaming changes only a point's label while preserving its capture, scope,
identity and creation time. Captures share the existing bounded history and may
prune the oldest points when needed.

[Record inspection and difference previews](../src/portals/WorkspaceInspection.tsx)
show collection counts and bounded identifiers, excluding displayed field values
such as names, emails, content, comments, answers, amounts and reasons. Differences
compare current state to the selected target and identify added, removed or
changed records, including changes to hidden saved fields. Inspection writes no
state and grants no new data authority. Confirming Undo rechecks the exact point
shown in its preview against stored history, saves a pre-Undo point, then replaces
only the captured portal scope. Changed or missing source points are refused.

This behavior belongs to the shared, account-free demo browser. Browser storage
and imported data are editable by its user. A production export implementation
needs its own trusted actor/resource/field scope and authorization check; the
demo backup mechanism is not an employee, contractor or auditor export policy.

## Session return locations

The [portal shell](../src/pages/TemplatePortalsPage.tsx) remembers each module's
last supported pathname within the mounted session. Directory cards and shared
workspace links return to that subsection; query/hash values are not remembered.
The [route helpers](../src/portals/routes.ts) revalidate that each destination
belongs to its exact module and exclude unsupported routes, inherited map values
and unsafe HR parameters. This temporary navigation memory is separate from
workspace records, backup exports and restore revisions. A directory visit keeps
the remembered HR path while the HR workspace is hidden; selective restore clears
only the restored modules' temporary UI.

## Firebase and provider boundary

The [application account-level capabilities](../src/auth/accountLevels.ts) are
separate from these demo roles. There is no conversion from `employer-owner`,
CMS `publisher` or CRM `owner` to a Firebase `level`, `admin` or other custom
claim. The [protected HR shell](../src/pages/HrPage.tsx) checks sign-in and the
existing management staff boundary, then keeps real HR workflows unavailable
pending trusted membership, employer connection and server adapter setup.

The optional [Gusto backend security module](../integrations/gusto/functions/src/security.mjs)
uses verified UID, active server-managed organization membership, role
allowlists and mapped provider resources. It has its own policy and must be
reviewed independently: its classification allowlists are not identical to the
browser demo's compensation projection. Its
[directory/payroll status projections](../integrations/gusto/functions/src/projections.mjs)
exclude provider secrets and payroll earnings. A matching role string is not
evidence that either backend policy was invoked or a live provider was enabled.

The current demos have no tenant selector or server authorization adapter for
their shared browser records. The model actor arguments represent selectable
fixture identities, without independent authentication. The root
[Firestore rules](../firestore.rules)
and [Storage rules](../storage.rules) contain their own account-level examples;
they do not enforce the CMS/CRM/HR browser transition matrix. Real tenant
isolation, confidential storage, authorized exports, server audit/retention and
provider/publication acceptance remain adoption work described in
[the portal design](TEMPLATE-PORTALS.md).

## Verification references

The existing domain suites exercise direct transitions and scoped projections,
including foreign-resource denial, separate CMS review, stale revisions,
manager self exclusion, private drafts, and backup preservation of complete
state. Run these from the repository root when changing this matrix or the
corresponding source:

```bash
npm run hr:test
npm run portals:test
npm run docs:links
```

Relevant focused suites are [HR workflow scope](../tests/hr/mock-workflows.test.mjs),
[chosen periods and fictional rates](../tests/hr/payroll-periods-rates.test.mjs),
[time correction](../tests/hr/time-editing.test.mjs),
[selected-period statements](../tests/hr/selected-payroll-insights.test.mjs),
[people operations](../tests/hr/people-operations.test.mjs),
[service desk](../tests/hr/service-desk.test.mjs),
[recruiting](../tests/hr/recruiting.test.mjs),
[performance draft projections](../tests/hr/performance.test.mjs),
[survey respondent scope](../tests/hr/surveys.test.mjs),
[CMS roles](../tests/portals/cms.test.mjs),
[CRM ownership](../tests/portals/crm.test.mjs),
[CRM import refusal](../tests/portals/crm-import-validation.test.mjs),
[module backups](../tests/portals/backup.test.mjs) and
[combined backups](../tests/portals/combined-backup.test.mjs),
[named history points](../tests/portals/manual-restore-points.test.mjs),
[record inspection](../tests/portals/workspace-inspection.test.mjs) and
[session return locations](../tests/portals/return-location.test.mjs).
Passing these checks supplies local source/workflow evidence. It does not
establish production authorization, confidential-data protection or provider
activation.
