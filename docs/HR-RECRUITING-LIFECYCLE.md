# Native HR recruiting lifecycle

Status: **locally accepted — 2026-10-15**. Agent 0 accepted **WX-0201–WX-0210
and the separately scoped WX-0951**, eleven original criteria, on source
`7337709b79b995c3f1e76254aa51fd86bbd1f215`. The catalog now records **122 done /
878 remaining**; the full 1,000-item goal remains active. The
[dated recruiting QA receipt](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md) records
the completed **63-stage CI**, **198 actual browser checks/groups** (184 across
fourteen common suites, 8 HR-disabled and 6 LAN) and Hosting preflight, all with
terminal exit 0. The application remains **3.4.0**, deploy **0**; no deployment
or provider activation occurred. Source/wiki publication requires separate
remote parity verification. Follow the authoritative
[shared contract, section 12](RECRUITING-LIFECYCLE-CONTRACT.md#12-final-agent-0-integration-decisions)
and the [implementation plan](RECRUITING-LIFECYCLE-IMPLEMENTATION-PLAN.md).

## Open the fictional workspace

After normal dependency setup, run `npm run dev:mock` and open the printed app
URL. Visit `/hr/demo/admin/recruiting` as the fictional employer owner or HR
administrator. Use sample names, `.invalid` emails and fictional free text.
The route and preview selectors establish no real account authority.

The native workspace is separate from the genuine SDK's local sample session.
No job board, calendar, email, offer, bank or provider write is triggered by
these recruiting controls. Read [Gusto setup](GUSTO-SETUP.md) for those separate
native/SDK/backend boundaries.

## 1. Adopt existing recruiting records explicitly

Before adoption, the existing legacy job/candidate controls retain their
established rules. Reading, exporting or using an ordinary legacy action does
not create the optional recruiting extension.

In **Adopt the saved recruiting records**:

1. Enter **Recorded UTC time** explicitly, in the exact millisecond form
   `2026-10-15T09:00:00.000Z`. This is an illustrative input, not a recorded run.
2. Choose **Preview recruiting adoption** and read **Recruiting adoption
   preview**. Preview changes no record.
3. Choose **Confirm recruiting adoption**, or **Cancel recruiting adoption
   preview** to retain the inputs without accepting it. **Discard adoption
   draft** clears that form's temporary changes.

Adoption captures existing jobs, candidates, hired employees and known legacy
employment links. Original job/candidate arrays, activity and legacy sequence
remain frozen as the compatibility base. The original hired-employee prefix
also stays unchanged; later authoritative hires append new captured employees.
The optional extension becomes the sole
authority for new people, applications, jobs and recruiting events. It does not
create employment history or automatically merge conflicting identities.

An adopted candidate becomes a stable person and an application. Old activity
remains literal receipt/action/actor-role rows under **Legacy application
activity for [application ID]**, labeled **unknown legacy time**. Old published
jobs retain **Legacy publication; no recorded approval**. Adoption supplies no
historical approval or old stage timestamps.

## 2. Review a requisition before publishing a job

In **Create sample requisition**, enter **Requisition department**,
**Requisition owner**, **Planning headcount** and **Recorded sample time (UTC)**.
Use **Preview create sample requisition**, then the shared **Confirm fictional
recruiting action** or **Cancel recruiting action preview** control.

| Next step | What to review |
| --- | --- |
| **Request review for [requisition ID]** | Preview the current revision and request explicit review. Requesting review records no approval. |
| **Review requisition [requisition ID]** | Choose **Requisition review outcome**, enter **Requisition review reason** and an explicit time, then preview and confirm. Approval captures that exact content/revision; rejection records a reason without an approval capture. |
| **Create requisition-backed sample job** | Select **Approved requisition**, enter **Sample job title**, matching **Approved job department**, **Sample hiring manager** and time. Preview and confirm the draft job. |
| **Bind approved requisition to [job ID]** | A legacy draft or changed requisition department needs a reviewed binding. Binding captures the approved department and increments the job revision. |
| **Publish sample job [job ID]** | Preview and confirm only after its current requisition approval, binding and eligible manager agree. Publication freezes the approval ID and job revision/title/department/manager. |

The owner and manager are separate choices and may name the same person. The
current owner must be active; the hiring manager must be an eligible active
manager with an existing team. Headcount is a bounded planning value, **1–50**;
hires do not consume it or enforce a hiring quota.

Editing a requisition increments its revision, returns it to draft and clears
current approval. Earlier approvals and publications remain historical captures.
If a retained form's revision changes, its inputs stay intact and another
preview is refused until that form's **Discard … draft** action loads current
values. A published job can close only after all its applications are hired,
rejected or withdrawn. This slice has no closed-job reopening.

## 3. Keep one person and several independent applications

Use **Add a fictional person and application** for a new identity. Fill its
fictional name/email, **Application job** and **Recorded UTC time**. Choose
**Preview new person and application**, then **Confirm new person and
application**, or cancel the preview.

A normalized email matching a recruiting person produces **Review the existing
identity** without creating either record. **Choose existing person for a
separate application** fills the separate form; it does not accept an action or
merge identities. Review **Existing recruiting person**, **Separate application
job** and time, then use **Preview separate application** and **Confirm separate
application**. The person/job pair must be new. A current directory employee
email collision cannot be resolved by creating a duplicate recruiting person.

Each application retains its own job, stage and outcome. In **Manage application
[ID]**, advance with **Preview move to screening**, **interview** or **offer**,
followed by the matching confirmation. To end it, choose **Terminal application
outcome**: **Reject this application** or **Withdraw this application**. Enter
**Sample outcome reason** and time, then preview and confirm rejection or
withdrawal. Both are terminal and distinct; neither can later advance or hire.
Other applications for the person remain unchanged, and prior events remain.

## 4. Supply times rather than inferring them

Every accepted new event uses an explicit valid UTC instant in
`YYYY-MM-DDTHH:mm:ss.sssZ` form. A public stage event cannot precede that
application's previous public stage event; equality is allowed. Private
scorecard chronology belongs to each interview/author pair and does not advance
another author's or a public stage's time bound.

**Stage timing for [application ID]** reports entered/exited UTC boundaries and
duration in milliseconds. Legacy unknown entry time stays unknown. Under
**Observe open stage durations**, enter **Optional observation UTC time** and
choose **Apply duration observation**. It must not precede a displayed
application's recorded public boundary. An empty observation retains known
closed durations and leaves open duration unobserved. This read changes no
domain record. After saved facts change, reapply the observation as the notice
requests; the UI does not reuse an observation against changed source silently.

For illustration, explicit stage boundaries at 09:00 and 10:00 UTC on the same
date produce 3,600,000 ms. Receipt sequence, current clock and a scheduled
interview's future start are never substitutes for those boundaries.

## 5. Schedule locally, then enter an assigned interviewer

In **Sample interviews**, choose a nonterminal **Interview application**. Enter
**Interview start in UTC**, **Named interview time zone**, **Interview duration
in minutes**, **Schedule recorded time in UTC** and **Fictional interview
participants**. Choose **1–5** known participants and **15–240** whole minutes.
Use `UTC` or a supported named zone such as `America/Los_Angeles`; numeric
offset aliases are refused. The explicit UTC instant and zone are stored
separately; the form does not resolve an ambiguous local clock time for you.

Choose **Preview sample interview**, inspect its start/zone/duration/participants,
then **Confirm sample interview** or **Cancel interview preview**. **Discard
interview draft** reverts temporary inputs. Scheduling sends no invitation,
advances no stage and supplies no proof that an interview occurred.

In **Open an assigned fictional interviewer**, choose **Assigned fictional
interviewer**, then **Enter interviewer preview**. The selector offers known
identities assigned to recorded interviews. The dedicated shell shows only
assigned interview context and that identity's own cards; management navigation,
directory/payroll and complete-workspace recovery tools are not mounted there.

### Save a private card, then submit its saved revision

1. In the assigned interview, choose **Role understanding**, **Collaboration**
   and **Problem solving** ratings, each **1–5**. Enter **Fictional scorecard
   comments** and **Scorecard recorded time in UTC**.
2. Choose **Preview own scorecard draft**, inspect the exact content/revision,
   then **Confirm own draft save** or **Cancel scorecard preview**.
3. To share the saved card, use **Preview scorecard submission** and **Confirm
   scorecard submission**. Unsaved content must first be saved or discarded.
   Submission has its own explicit recorded time, at or after this pair's last
   own action. It freezes the saved revision and content.
4. **Your own scorecard history** retains the selected author's save/submission
   times. **Submitted sample scorecards** in management exposes explicitly
   submitted cards, excluding other authors' unsubmitted cards and earlier draft
   revisions. A submitted card is immutable in this local slice.

### Privacy, leaving and temporary work

This is fictional **local preview privacy**, not authentication, encryption or
protection from the browser's owner. A complete HR save, deliberate export and
recovery point contain the full accepted workspace, including **saved private
scorecards and draft-save history**. A management review projection excludes
those drafts; an exported file is not that filtered projection.

Use **Leave interviewer preview** to return to management, or the neutral
**Portal directory** link to leave the route. A dirty own scorecard or live
preview uses **Keep editing** / **Discard and leave**. Keep cancels the transition
and retains the current identity/inputs; Discard clears temporary work and
invalidates its preview before leaving. Own scorecard groups cannot use
**Leave and keep draft**. Discarding temporary changes does not delete an already
accepted private draft. Identity/mode changes never relabel one author's draft
as someone else's.

## 6. Review every record before a fictional hire

For an application at **offer**, use **Preview exact fictional hire**. In
**Review every new hire record**, inspect:

| Preview section | Addition to review |
| --- | --- |
| **Employee identity, assignment and captured checklist** | Stable employee ID derived from the person, fictional identity/email, job/department/manager, pending captured tasks, and explicitly unconfigured synthetic compensation. |
| **Initial onboarding requirements** | Profile/job review flags, exact required task keys and draft onboarding stage. |
| **Initial directory profile** / **Initial employee status** | Matching employee ID/email and initial `onboarding` status. |
| **Initial leave balances in hours** | Exact opening balances. The current fictional seed supplies 40 vacation / 24 sick hours; these are sample values, not a leave policy. |
| **Employment records created by this hire** | The exact employment instance/event if that separate extension exists; otherwise an explicit statement that neither is created. |

Finish or explicitly discard other temporary stage/outcome drafts for this
application. **Confirm exact fictional hire** accepts the linked addition
together; cancel retains the hire inputs without changing records. A changed
workspace, stale handle, current employee collision, ineligible manager,
withdrawn application or second hire for the same person refuses the action.
The hire does not accept an offer externally or activate compensation/payroll.

When employment history already exists, the preview includes original instance
1, its captured selected checklist and the linked employment hire event using
the workspace's simulation date. When it is absent, recruiting hire leaves it
absent and records that fact in immutable hire provenance. Ordinary onboarding
can proceed. If employment is materialized later, only that new hire's original
instance can use a `recruiting-baseline` capture of the actual onboarding
flags/tasks/receipt. A prior completed checklist has unknown historical actor
and date; the app does not invent hire/completion events or approvals for it.
Later rehire remains the separate [employment lifecycle](PORTAL-LIFECYCLE.md).

## 7. Refresh, export and recover deliberately

Accepted actions use the native HR browser save at the same origin. Check the
visible storage notice before refreshing. In memory-only mode, keep the page
open and **Export workspace** before reload; a successful action is not proof
of a successful save. Unsaved fields, live preview handles and selected
interviewer mode are temporary and excluded from portable records.

Leave interviewer mode before opening full-workspace tools. **Export workspace**
downloads the complete HR state. **Import workspace** validates a local HR JSON
file and previews whole-HR replacement; use **Replace HR workspace** or **Cancel
import**. Optional required import/Reset checkpoints retain their independent
settings and refusal rules. Import is not a person/application merge.

At `/portals`, **Import combined backup** starts with no selected modules.
Select HR and review the complete inventory/differences before **Restore
selected workspaces**; unchecked CMS/CRM remain separate. **Undo…** also replaces
the complete captured module scope after its own preview and new checkpoint.
Legacy files may have no recruiting extension; present extensions require
strict links, captures, replay and bounds. Restoring an older file can therefore
restore the earlier absent/present state intentionally.

Default inspection shows bounded identifiers, counts, states and known dates;
hidden comments/reasons and draft history affect differences without displaying
their content. Local history stays at this origin and is not in portable
exports. For history/storage failures, follow the keep-open/export ordering in
the [failure drill](PORTAL-RECOVERY-FAILURE-DRILL.md) and
[state contract](PORTAL-STATE-CONTRACT.md); clearing damaged history discards
that history and does not repair it.

## Optional typed provider boundary — WX-0951

The [provider adapter](../src/hr/provider-adapter.ts) defines eight native
command families: `workflow`, `people-operations`, `service-desk`, `recruiting`,
`recruiting-lifecycle`, `performance`, `surveys` and `lifecycle`.
`OptionalHrProviderAdapter.execute` separates them from four possible outcomes:

| Outcome | Meaning of the typed contract |
| --- | --- |
| `provider-result` | A provider value requiring the adopter's reviewed validation/projection; it is not accepted native state. |
| `refused` | `invalid-input`, `not-authorized` or `not-ready`. |
| `retry` | `manual-retry` or `review-before-retry`; this schedules nothing and authorizes no repeated write. |
| `unsupported` | `adapter-unconfigured` or `unmapped-command`. |

The supplied `createUnconfiguredHrProviderAdapter()` returns a frozen object:
`mode: 'mock'`, `providerConnected: false`, `payrollExecutionEnabled: false`.
It returns `unsupported / adapter-unconfigured` without reading command payloads,
changing native records or starting transport/retry work. Declared `disabled`,
`demo` and `production` modes enable nothing by themselves. Native reducers,
the separate SDK mock and optional disabled backend keep their own boundaries.
This source contract accepts no provider integration or activation.

## Verification references

`npm run hr:test`, `npm run portals:test` and `npm run browser:recruiting` expose
the focused and browser checks after normal setup. The
[dated recruiting QA receipt](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md) binds the
actual reports, final source, independently audited 63-stage CI and browser
results, Hosting preflight and Agent 0's eleven criterion decisions. This how-to
is not an additional execution receipt. Earlier dated QA receipts remain
historical observations at their original revisions. Local acceptance supplies
no provider, production, other-platform or manual screen-reader acceptance.
