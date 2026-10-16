# Account-free employment, release and ownership workflows

**CRM source/documentation compatibility supplement.** CRM source compatibility was reviewed at `4e025a3b5c21d0accef4e2e02add2c7eff54d589` against the145-source CRM freeze3 manifest. Existing HR and CMS implementations are unchanged. Existing CRM ownership commands now participate in an optional ordered journal after a first merge; earlier activity keeps its recorded fields. The separate [CRM duplicates and merges guide](CRM-DUPLICATES-AND-MERGES.md) describes merge direction, historical privacy and whole-workspace recovery. This source-only supplement does not relabel the earlier lifecycle, recruiting or payroll observations or accept the new CRM criteria.

This additive header is a source/documentation review on 2026-10-15 at metadata commit `3ae29392709778a6f552d26dcb4222f4977f26fb`. The [dated CRM adoption receipt](CRM-ADOPTION-QA-2026-10-15.md) independently qualifies observations of implementation `4e025a3b5c21d0accef4e2e02add2c7eff54d589`. It is not execution at this metadata commit. Earlier source audits retain their examined basis `8308237b6bff9e5c6b8c6beb1b54b5c91c82a683`; any later harness-only execution-source changes need their separately reviewed receipt scope.

Status: **original lifecycle workflows and recruiting integration locally
accepted**. Their [original lifecycle QA](PORTAL-LIFECYCLE-QA-2026-10-15.md) and
[recruiting QA](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md) retain their original
observations, revisions and runtime freezes. The recruiting acceptance on
`7337709b79b995c3f1e76254aa51fd86bbd1f215` brought the catalog to
**122 done / 878 remaining at that checkpoint**. See the
[execution plan](WEBAPPX-EXECUTION-PLAN.md) for current progress.

This guide's source contract was re-reviewed against
`42818dd7baf3d335f27c401c37d048bd842617fa` and the **130-source payroll freeze 3**
for coexistence with optional payroll closure/correction records. This is a
source-only review; it does not relabel the earlier 100-source lifecycle or
123-source recruiting browser observations. [Payroll controls](HR-PAYROLL-CONTROLS.md)
have separate verification and acceptance in the
[payroll/setup QA receipt](PAYROLL-SETUP-QA-2026-10-15.md). No new CI/browser result,
criterion acceptance, source/wiki publication, production deployment or provider
authority is established by this source review.

Use fictional information only. Start `npm run dev:mock`, open the exact local
origin printed by the command and choose `/portals`. No account is required for
these native workspaces. Saves belong to that browser profile and origin
(scheme, hostname and port). The separate Gusto SDK preview has its own sample
session and does not share these HR employment records.

## Find the controls

| Workspace | Route and navigation | Relevant preview role |
| --- | --- | --- |
| HR employment | `/hr/demo/admin/employees` → **Employees** → **Employment lifecycle**. **Organization** at `/hr/demo/admin/organization` also contains the controls. A profile's **Employment lifecycle and transfers** link returns to this section. | **Synthetic management role**: Employer owner or HR admin. |
| HR directory correction | Open **View record** for an employee, for example `/hr/demo/admin/employees/employee-002`. Employee self-service profile at `/hr/demo/employee/profile` contains the employee's own correction form. | Employee or manager for an own proposal; owner/HR for direct edits and outcomes. |
| CMS release | `/cms/demo` → **Local release bundles**. | **CMS preview identity**: **Pat · publisher**. Author and separate reviewer prepare the approved entries. |
| CRM ownership | `/crm/demo` → **Ownership**. | **CRM preview identity**: **Casey Example · Owner** or **Morgan Example · Sales manager**. |

These selectors demonstrate local access rules. They do not authenticate a
person, change Firebase claims or create account/provider authority. HR employee
and manager views remain scoped; sales representatives see their own CRM records
and cannot use ownership transfer controls. Auditor previews remain read-only.

## HR: choose dates and a checklist version

In **Employment lifecycle**, choose **Employment simulation date**. For example,
use October 15, 2026 for a fictional termination and October 16 for a later
rehire. **Use simulation date** opens **Simulation date preview**; **Confirm
simulation date** accepts it. A preview or its Cancel button changes no saved
HR record.

New lifecycle actions require an explicit valid simulation date. Effective dates
must be on or before it and must follow the employment instance's accepted
timeline. The simulation date cannot move backward from the last accepted
lifecycle action. There is no background scheduling or automatic activation when
the real clock reaches an effective date.

Under **Captured onboarding template versions**, choose **Onboarding template
version**, then **Preview template selection** and **Confirm template selection**.

| Version | New-instance checklist |
| --- | --- |
| **Sample welcome checklist v1 · sample-v1** | Complete own profile; review sample welcome checklist. |
| **Sample welcome checklist v2 · sample-v2** | The v1 requirements plus fictional access and security guidance. |

The selection applies to subsequent hires and rehires. Existing captured
definitions, completion flags and receipts keep their version. Selecting the
already selected version is a no-op refusal. An original saved workspace can
still complete its existing onboarding and original recruiting journey without
first choosing a lifecycle date; unknown original dates remain unknown.

A recruiting-only hire does not create employment history automatically.
Ordinary onboarding may finish before employment is first materialized. A later
meaningful lifecycle action or **Save sample profile** can capture that new
hire's original instance 1 from its actual checklist/flags/receipt. Previously
completed onboarding remains active with unknown historical actor/date; it is
not restarted or assigned an invented completion event. A hire made while
employment history already exists instead creates its reviewed original
instance/event immediately. Later rehire always creates a new incomplete
captured checklist and retains the prior instance's onboarding history. See the
[recruiting how-to](HR-RECRUITING-LIFECYCLE.md),
[first-instance baseline](../src/hr/recruiting-employment-baseline.ts) and
[hire adapter](../src/hr/recruiting-hire.ts).

## HR: preview a transfer or employment transition

Choose **Lifecycle employee**. The current instance card identifies the person,
employment instance, status, dates and captured checklist.

For a transfer:

1. Enter **Transfer department**, **Transfer manager** and **Transfer effective
   date**. A manager can be an existing active fictional employee or **No
   manager**.
2. Choose **Preview sample transfer**. Review the previous/proposed assignment,
   date and **Affected direct-report scopes**. The lists identify which employees
   the previous and proposed managers would see in their direct-report scope.
3. Choose **Confirm sample transfer**, or **Cancel transfer preview**. Use
   **Discard transfer draft** when you want to remove the temporary form edits.

Self-management and reporting cycles refuse with the affected employee IDs.
Changing a direct manager also refuses while that employee has an unfinished
performance review. Complete the existing cycle through acknowledgement first:
the employee saves/submits the self-review, the captured direct manager
saves/publishes the manager review, and the employee chooses **Acknowledge sample
review**. Existing review comments and reviewer identity are preserved.

For a status change, choose **Employment transition**, enter **Transition
effective date** and **Sample transition reason**, then choose **Preview
employment transition**. The preview includes the prior state and reason.

| Choice | Allowed starting state | Confirmation |
| --- | --- | --- |
| **Sample leave** | Active | **Confirm sample leave** |
| **Return from sample leave** | On leave | **Confirm sample return** |
| **Fictional termination** | Active, on leave or onboarding | **Confirm fictional termination** |

Sample employment leave is separate from vacation/sick requests and their
existing balance calculations. A manager with current direct reports must have
those reports reassigned before termination. Refusal preserves the current
records and entered form values.

## HR: offboarding, rehire and retained history

Termination preview lists three assignments that confirmation would create:
asset return, access review and handover. Confirmation captures them against the
terminating employment instance and adds matching pending work in **People
tasks** at `/hr/demo/admin/tasks`. The existing task completion workflow can mark
that work complete. **Fictional offboarding assignments** retains the original
assignment capture; its historical `assigned` label is separate from the current
task's completion status. No physical asset, external account or access service
is changed.

After termination, use **Fictional rehire comparison**:

1. Enter **Rehire department**, **Rehire job title**, **Rehire manager** and
   **Rehire start date**. The start must be after the previous end date and on or
   before the chosen simulation date.
2. Choose **Compare fictional rehire**. Review **Retained directory identity and
   history** beside **New employment and onboarding requirements**.
3. Choose **Confirm fictional rehire**. If another transfer or transition draft
   is still meaningful, finish it or use its explicit Discard button first.

The directory employee ID and contact details persist. Rehire creates a new
employment instance with a fresh incomplete checklist from the selected version.
The prior onboarding payload and receipt remain archived on the prior instance.
**Employment instances and captured onboarding** and **Employment lifecycle
history** distinguish those records. The new instance becomes the current
instance immediately, with employment status **Onboarding**. Its employment
status becomes **Active** only after its own reviewed checklist is completed
and confirmed.

Rehire keeps existing leave balances, fictional hourly rate timelines and benefit
elections unchanged. Unconfigured rates remain unconfigured. No hourly cadence
is inferred from fixture compensation. Submitted payroll receipts, statements
and consumed time keep their frozen values. A change that affects an unfinished
payroll preparation uses the existing stale/reprepare rules described in
[portal maturity workflows](PORTAL-MATURITY.md).

Rehire applies the same unfinished-review manager guard as transfer. Keeping the
old manager permits the existing review to remain workable; changing that
manager requires acknowledgement of the existing cycle first. The workflow
does not silently move private review comments to another reviewer.

## HR: propose and review a directory correction

In **Directory corrections and history**, an employee or manager can use
**Propose your directory correction** for their own record. Enter **Proposed
work email** using a fictional `.invalid` address and choose **Simulation date**.
Choose **Preview correction request**, review the old/proposed values, then
**Confirm correction request preview**. A pending request changes no directory
email.

An owner/HR preview can review the request using **Correction outcome**,
**Correction outcome reason** and **Simulation date**, then **Preview correction
outcome** → **Confirm correction outcome preview**. Acceptance records the email
change and outcome together. Rejection records the outcome while preserving the
current email. A newer directory edit or a different employment instance makes
an old acceptance stale; review a current proposal rather than overwriting it.

Owner/HR can also use **Direct directory email edit** → **New directory work
email** → **Preview directory edit** → **Confirm directory edit preview**. The
ordinary **Synthetic work email** → **Save sample profile** action retains its
existing permissions and also records a meaningful accepted change in history.
Email case is retained; surrounding whitespace is normalized.

**Saved directory change history** displays old value, new value, field, actor
preview, origin and change sequence. Requests show their employment instance,
request sequence and recorded outcome. Sequences describe local accepted action
order; they are not timestamps or an authenticated audit trail.

## CMS: prepare, preview and activate a local release

A release needs at least two distinct entries whose current revisions have
separate reviewer approval. Use **Alex · author** to create/save content and
**Request review**, then **Riley · reviewer** to **Approve revision**. Repeat for
each member. A saved edit invalidates that entry's prior approval.

1. Choose **Pat · publisher**. In **Local release bundles**, enter **Release
   name**, select at least two **Approved release entries**, then choose
   **Prepare release draft**. This saves captured content, approval and previous
   publication snapshots. Included publications and publication receipts remain
   unchanged.
2. Choose **Preview release _name_**. In **CMS release activation preview**, read
   the entry/route, captured approval, previous frozen publication and current
   draft columns. Preview writes nothing.
3. A **Ready to activate** preview enables **Confirm activate release**. All
   included frozen publications change together in one accepted CMS state, with
   their publication receipts captured by the activated bundle. **Cancel release
   activation** preserves the saved draft bundle and current publications.

Changed content, approval or previous publication makes a captured member stale.
Prepare a new release after the required review. Duplicate reserved routes are
refused across current draft and frozen publication routes within a collection.
No member is activated when validation fails. A change to the workspace or
preview identity after review shows **Preview out of date**; choose **Refresh
release preview** and review again. An activated release cannot be replayed.

A saved stale draft release remains a historical capture and may be imported or
inspected if its record shape is valid. Its saved existence does not mean it is
eligible to activate. Activation updates fictional local publications; it does
not publish a website or deploy content to a provider.

## CRM: reassign a lead or transfer a linked account

Open **Ownership** as an owner or sales manager preview. For one unconverted
lead, choose **Lead to reassign** and **New lead assignee**, then **Preview lead
assignment**. Review the current/new assignees and choose **Confirm lead
assignment**. This changes only that new or qualified lead. It creates no
company, contact, opportunity or follow-up. Converted leads move with their
linked account instead.

For an account:

1. In **Transfer a sample account**, choose **Account to transfer** and **New
   account owner**, then **Preview account transfer**.
2. Read **Complete affected record list**. It includes the company, every linked
   contact, converted lead, opportunity and opportunity follow-up task, including
   closed opportunities and completed tasks.
3. Choose **Confirm account transfer** to accept the complete supported graph
   together, or **Cancel account transfer preview** to retain current records
   and temporary selection.

The complete validated CRM workspace is required. A representative's filtered
view cannot establish authority over a hidden account graph. Current actor ID
and role, selection and full workspace are checked again at confirmation. A
changed source requires a fresh preview. The destination must be a registered
fictional assignee with a supported non-auditor role. Same-owner no-ops and a
duplicate company name already owned by the destination refuse.

The full graph must fit the **200-record** review limit. Larger graphs refuse as
a whole; there is no partial transfer. Unconverted leads with matching company
name text have no account link and remain separate. Historical activity retains
its original ownership and description; the new change receipt records both
fictional assignees and affected IDs. No customer notification or external email
is sent.

## Saved state, restore inspection and temporary work

The extensions are optional for older valid saves. Optional employment/release/
ownership records are added by their supported accepted actions. Recruiting
instead requires its separate explicit adoption preview/confirmation; reads,
ordinary legacy actions and previews do not adopt. Original employment starts
and completion dates can remain unknown; the application does not invent dates
from the clock or old receipts. The
[shared recruiting contract](RECRUITING-LIFECYCLE-CONTRACT.md#12-final-agent-0-integration-decisions)
governs its immutable adoption and authoritative event records.

Optional payroll controls coexist in the same complete HR snapshot. Accepted
employment changes and later hires do not erase original payroll anchors or
reopen a closed company date window. Individual/combined import, selected
restore and Undo validate a present payroll-control arm and replay its complete
events; older valid absence stays absent. Whole-HR replacement can intentionally
restore an earlier pre-closure snapshot. Default inspection hides its amounts
and reasons while comparing the complete payload. See
[payroll controls](HR-PAYROLL-CONTROLS.md).

Individual/combined import, selected restore and Undo validate complete saved
records before replacement. HR instance/template links, sequences, reporting
graphs, completion/receipt agreement and offboarding task links must agree. CMS
captures and CRM owner/link relationships are also validated. An invalid file
does not become acceptable by selecting only another module.

In **Restore points & Undo**, use **Inspect captured records** and the selected
current-to-target difference preview. Counts and bounded identifiers include HR
instances, captured checklists, archives, transitions, corrections/outcomes and
offboarding links; CMS release members and publication captures; CRM ownership
receipt metadata and affected links. Hidden text still participates in change
detection. Email values, reasons, content bodies and amounts are not exposed as
inspection metadata. Inspecting a file or point changes no workspace record.

Restore and Undo replace whole selected portals. Unselected portals keep their
saved bytes. Temporary form groups use the shared Keep/Discard decisions;
successful accepted actions establish a baseline for their own form, and failed
actions retain input. Refresh loses unsaved form values and volatile previews.
The existing dirty CMS editor comparison remains available after supported
replacement. Reset and optional replacement checkpoints follow the existing
[state contract](PORTAL-STATE-CONTRACT.md) and
[recovery glossary](WORKSPACE-RECOVERY-GLOSSARY.md).

Complete HR captures can include saved private recruiting cards and their
draft-save history. Default inspection exposes only bounded safe metadata and
compares hidden content; exports are complete, not filtered by preview identity.
In assigned-interviewer mode, dirty own cards/previews offer Keep/Discard without
a retained-draft exit. CMS/CRM nested children stay mounted but detached from the
connected document until the ordinary shell returns, preserving temporary
selections/previews without exposing them in that scoped DOM/accessibility-tree
view. This is local preview presentation, not authentication. See the
[retained surfaces](../src/portals/RetainedPortalSurface.tsx) and
[recruiting how-to](HR-RECRUITING-LIFECYCLE.md).

A successful in-memory action can coexist with a browser persistence warning.
Keep the page open and export accepted records before refreshing when storage
is unavailable. These local workflows send no external email, disable no real
account, move no asset, execute no payroll and grant no provider access. Production
authentication, server authorization and provider adoption remain separate work.

## Original lifecycle scope and historical evidence

The [wave implementation plan](PORTAL-LIFECYCLE-IMPLEMENTATION-PLAN.md) retains
the sixteen original criteria and dependencies. The
[HR lifecycle contract plan](HR-LIFECYCLE-IMPLEMENTATION-PLAN.md) records the
design boundaries. Run the dedicated native journey after explicit Chromium
installation:

```bash
npm run hr:test
npm run portals:test
npm run browser:portal-lifecycle
```

The [dated lifecycle QA receipt](PORTAL-LIFECYCLE-QA-2026-10-15.md) records the
standalone **20/20 checks/check groups** on a freeze of **100 runtime sources**,
with digest
`48fb5c3a1b0aeebbb6d52f982aa95c5689c9c26b1b9e325c8c39b0b4a99d4882`.
Its separate quality inventory covers **46 new status meanings**, **22 semantic
accessible-name audits**, **129 control boxes**, **20 caller-literal input-value
probes** and **22 Tab-reachability probes**. Targeted keyboard **9/9** and
quality **6/6** runs passed after actual native-picker focus observation and
literal profile-history fixture corrections. These figures describe their
retained scenarios; they are not global coverage or manual accessibility claims.

**At the accepted lifecycle checkpoint, all 62 CI stages passed with terminal exit
0 on `fdf60124e49659e9c33d30db59e45ff8369a38e1`.** Independent report review
confirmed **180 actual browser checks/check groups**. Hosting preflight passed on
the same final runtime before that harness-only commit; deployment was skipped.
Agent 0 accepted all sixteen feature criteria and the separately audited
**WX-0467/WX-0487**, eighteen original local criteria. At that historical checkpoint,
the catalog recorded
**109 done / 891 remaining**: **70 P1, 665 P2 and 156 P3**, with **724 local,
127 operator and 40 provider** gates remaining. Source and wiki publication require separate direct remote parity checks.
The integrated [recruiting implementation](RECRUITING-LIFECYCLE-IMPLEMENTATION-PLAN.md)
has a separate eleven-criterion local acceptance, including the optional provider
contract. Its evidence is not this guide's original eighteen-criterion receipt.
Use the
[recruiting how-to](HR-RECRUITING-LIFECYCLE.md) and
[current recruiting QA](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md) for that scope.
Current catalog progress comes from the [execution plan](WEBAPPX-EXECUTION-PLAN.md).
Earlier dated QA receipts retain their original sources and observation scopes.
