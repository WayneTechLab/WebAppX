# HR Recruiting Lifecycle

**Implemented source under verification — 2026-10-15.** This walkthrough
describes the isolated recruiting implementation. **WX-0201–WX-0210 and separate
WX-0951 remain TODO**. It claims no completed browser/full-CI acceptance or
publication of that work. The
[full source how-to](https://github.com/WayneTechLab/WebAppX/blob/main/docs/HR-RECRUITING-LIFECYCLE.md)
contains precise fields, limits, recovery and provider-contract details; the
[shared contract, section 12](https://github.com/WayneTechLab/WebAppX/blob/main/docs/RECRUITING-LIFECYCLE-CONTRACT.md#12-final-agent-0-integration-decisions)
governs final authority and compatibility decisions.

Start `npm run dev:mock`, open its printed origin and visit
`/hr/demo/admin/recruiting` as fictional employer owner or HR administrator. Use
sample names, `.invalid` emails and fictional comments. These selectors do not
authenticate an employee or grant provider access.

## Adopt deliberately

Under **Adopt the saved recruiting records**, enter **Recorded UTC time** in
`YYYY-MM-DDTHH:mm:ss.sssZ` form. Choose **Preview recruiting adoption**, inspect
the preview, then **Confirm recruiting adoption** or **Cancel recruiting
adoption preview**. Cancel retains the temporary inputs without accepting them.

Only this explicit action adopts recruiting history. Existing legacy actions,
reads and exports do not adopt automatically. Original jobs, candidates,
activity and legacy sequence remain the frozen compatibility base. The original
hired-employee prefix stays unchanged while new authoritative hires append their
captures. New extension people/applications/jobs/events become authoritative.
Adoption creates no employment history, historical approval or old timestamp.
Legacy activity retains literal receipts/actions/actor roles with **unknown
legacy time**; legacy publication keeps its unrecorded-approval label.

## Requisition → review → job publication

1. **Create sample requisition** with department, active owner, **Planning
   headcount** and explicit recorded time. Preview and use **Confirm fictional
   recruiting action** or **Cancel recruiting action preview**.
2. **Request review for [requisition ID]**, then **Review requisition [ID]** with
   an explicit outcome and reason. A request is not approval. Approval captures
   that exact revision/content.
3. In **Create requisition-backed sample job**, choose **Approved requisition**,
   matching department and an eligible active hiring manager with a team.
   Owner and manager are independent choices. Headcount is planning information,
   not a quota consumed by hires.
4. Bind a legacy draft or changed department through **Bind approved requisition
   to [job ID]**. Preview **Publish sample job [ID]** and confirm only after
   current approval/binding agreement. Earlier captures survive later edits.

A changed requisition revision invalidates current approval. Retained forms
refuse a new preview after their opening revision changes; explicit **Discard
… draft** loads current values. Closing needs terminal hired/rejected/withdrawn
applications; there is no closed-job reopening in this slice.

## One person, independent applications

**Preview new person and application** checks normalized email before acceptance.
If **Review the existing identity** appears, no new record was created. **Choose
existing person for a separate application** fills the separate form; review a
different job, then **Preview separate application** → **Confirm separate
application**. It preserves the existing person and does not merge records.
Duplicate person/job pairs and current employee email collisions refuse.

Use each application's **Manage application [ID]** controls to preview/confirm
screening, interview and offer. To end it, choose **Reject this application** or
**Withdraw this application**, enter **Sample outcome reason** and explicit UTC
time, then preview and confirm. Rejection and withdrawal remain distinct,
terminal outcomes. They preserve prior events and leave other applications alone.

**Apply duration observation** reads the optional explicit observation time for
open intervals. Closed durations use recorded stage boundaries; legacy unknown
boundaries stay unknown. A future meeting start, receipt sequence or hidden
scorecard action is not a public stage clock. Reapply an observation after the
saved-facts-change notice.

## Schedule, save privately, submit explicitly

Choose **Interview application**, an explicit UTC start, **Named interview time
zone**, 15–240 minutes, explicit schedule-recorded UTC time and 1–5 known
participants. Use `UTC` or a supported named zone; numeric offsets are refused.
**Preview sample interview** → **Confirm sample interview** records a local
schedule without sending an invitation or advancing a stage.

Choose **Assigned fictional interviewer** → **Enter interviewer preview**.
The dedicated shell displays only assigned context and that author's own
scorecards. Fill the three 1–5 ratings, **Fictional scorecard comments** and
**Scorecard recorded time in UTC**. **Preview own scorecard draft** → **Confirm
own draft save** saves privately. After saving or discarding unsaved content,
**Preview scorecard submission** → **Confirm scorecard submission** shares the
exact saved revision with hiring review. Submitted cards are immutable. HR
review excludes unsubmitted cards and earlier draft revisions.

This is **local preview privacy**, not authentication or encryption. Complete
HR saves, portable exports and recovery points include saved private cards and
draft-save history. They are not filtered to the current review projection.
Keep every field fictional.

Use **Leave interviewer preview** or **Portal directory** to leave. Dirty own
cards or live previews offer **Keep editing** / **Discard and leave**. Keep
cancels the transition and retains the current identity; Discard clears
temporary changes and invalidates its preview. Own scorecard groups do not
offer **Leave and keep draft**. Accepted saved drafts remain saved.

## Exact hiring summary and recovery

At offer, **Preview exact fictional hire** lists the complete employee identity,
assignment/checklist, onboarding flags, directory profile/status and opening
leave balances. Finish or discard other temporary drafts for that application,
then use **Confirm exact fictional hire**, or cancel. Source/identity changes,
stale handles, collisions, withdrawal and repeat hiring refuse the action.

If employment history exists, the preview also shows original instance 1 and
its linked employment event. If absent, neither is created by recruiting hire.
Later materialization can capture the new hire's actual onboarding baseline;
historical completion actor/date remain unknown. Rehire uses the separate
[employment lifecycle](Portal-Lifecycle.md).

Check the save notice before refresh. If changes are memory-only, keep the page
open, leave interviewer mode deliberately and **Export workspace** before
reload. Unsaved fields/handles are excluded. **Import workspace** replaces whole
HR after validation and explicit **Replace HR workspace**, or **Cancel import**.
At the directory, select HR deliberately for combined restore/Undo; unchecked
CMS/CRM remain separate. Review complete module scope and differences first.
Recovery inspection hides free text but compares complete hidden payloads.
See [Portal Safety and Recovery](Portal-Safety-and-Recovery.md) for failure and
keep-open/export ordering.

## Separate optional provider contract

WX-0951 defines eight native command families: workflow, people operations,
service desk, legacy recruiting, recruiting lifecycle, performance, surveys and
employment lifecycle. The four typed outcomes are `provider-result`, `refused`,
`retry` and `unsupported`. A retry state schedules no work or replay authority.

The supplied adapter is frozen at `mode: 'mock'`, `providerConnected: false` and
`payrollExecutionEnabled: false`. It returns `unsupported / adapter-unconfigured`
without transport or native mutation. Declaring demo/production modes or using a
local workflow enables no backend, SDK integration or provider operation. Read
[Gusto setup](https://github.com/WayneTechLab/WebAppX/blob/main/docs/GUSTO-SETUP.md)
for the separate adoption boundaries.

`npm run browser:recruiting` is the prepared owned browser journey. Its existence
and this page are not execution evidence. Final source bindings, independent
browser reports, 63-stage CI, preflight and criterion acceptance remain with
Agent 0; earlier dated receipts retain their original scope.
