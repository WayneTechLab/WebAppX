# Recruiting lifecycle implementation plan

Planning date: **2026-10-15**. Status: **proposal for Agent 0 review; no
implementation is authorized by this document**. The ten criteria below remain
**TODO**. The preceding sixteen criteria, WX-0101–WX-0110, WX-0314–WX-0316 and
WX-0379–WX-0381, have since completed local integration and acceptance together
with two recovery criteria; see the [lifecycle QA receipt](PORTAL-LIFECYCLE-QA-2026-10-15.md).
Their evidence does not accept any of the ten recruiting criteria below.

This is a proposed next slice under the
[full execution plan](WEBAPPX-EXECUTION-PLAN.md), following the accepted safety
checkpoint `f5ed3de`. It changes no catalog status, dependency, completion
metadata or acceptance gate. This document records source observations and a
design proposal; it records no new test execution, browser observation,
provider adoption or production readiness.

## Original canonical scope

The [canonical catalog](backlog/webappx-1000-todo.json) has schema version `1`,
project `WebAppX`, intent `proposed-backlog`, creation date `2026-10-14` and
original `sourceCommit` `8359285c99069349d6218fe871868baab76868e5`. That original
source commit identifies the proposal basis; it is not an execution or browser
observation revision.

These canonical fields are identical for all ten selected items:

| Field | Original value |
| --- | --- |
| `area` | `hr-talent` |
| `priority` | `P1` |
| `phase` | `portal-maturity` |
| `status` | `todo` |
| `source` | `src/hr/recruiting.ts` |
| `gate` | `local` |
| `dependsOn` | `[]` |

The following titles and acceptance criteria are copied from the catalog.
Each item is dependency-ready under its declared empty dependency list. The
engineering sequence later in this plan does not add canonical dependencies.

| ID | Original title | Original acceptance |
| --- | --- | --- |
| WX-0201 | Add reusable recruiting requisition records | A fictional job references an approved sample requisition with department, owner and headcount. |
| WX-0202 | Add recruiting requisition approval previews | A draft requisition moves through explicit sample review before its associated job can publish. |
| WX-0203 | Add candidate duplicate detection | A new fictional candidate matching an existing email shows a conflict preview without creating a duplicate application. |
| WX-0204 | Add multiple applications per fictional candidate | One candidate can apply to two jobs while each application retains its own stages and outcome. |
| WX-0205 | Add interview scheduling without delivery | A sample interview records participants, named time zone and duration without sending calendar invitations. |
| WX-0206 | Add structured interview scorecards | An interviewer saves a private fictional scorecard and explicitly submits it to the hiring review. |
| WX-0207 | Add candidate stage transition reasons | Rejected or withdrawn sample applications record a visible reason and preserve prior stage activity. |
| WX-0208 | Add recruiting stage duration metrics | A fictional timeline reports time in stage from recorded timestamps rather than inferred sequence numbers. |
| WX-0209 | Add candidate withdrawal as a terminal outcome | A withdrawn application cannot be hired and remains distinct from an employer rejection. |
| WX-0210 | Add hiring preview validation summaries | Before mock hire, the screen lists directory, onboarding and balance records that will be created atomically. |

The other dependency-ready P1 local candidates found in the primary catalog
review were WX-0159/WX-0160, WX-0656 and WX-0951. Pay-period corrections, manual
screen-reader evidence and the optional provider interface are separate slices.
They are outside this proposed recruiting assignment.

## Current source observations — planning only

| Source | Existing behavior observed in source | Gap relevant to this proposal |
| --- | --- | --- |
| [Recruiting model](../src/hr/recruiting.ts) | Jobs have department, manager and draft/published/closed status. A candidate contains one `jobId`, one stage and activity. Email duplication is refused across candidates and employees. | No requisitions, separate application records, conflict preview, interview records, scorecards or withdrawal. Duplicate refusal currently prevents a second application by the same person. |
| [Recruiting activity](../src/hr/recruiting.ts) | Activity contains receipt, action and actor role. Stage order and terminal hired/rejected states are enforced. | No recorded timestamps, stage intervals or explicit rejection reason. Sequence numbers cannot establish elapsed time. |
| [Recruiting UI](../src/hr/components/HrRecruiting.tsx) | Job/candidate forms use the existing dirty-form controller. Candidate controls progress stages, reject or directly hire. | No requisition review, participant schedule, scorecard submission, reason form or exact hire summary. |
| [Hire integration](../src/hr/recruiting-link.ts) | A returned replacement initializes the employee, onboarding/profile/status maps and leave balance while retaining unrelated state. Current-wave source also links a new hire to the selected onboarding template and employment lifecycle when present. | A read-only pre-hire summary and stale confirmation contract are missing. Current-wave lifecycle integration remains under verification and must be reviewed after that wave is accepted. |
| [HR persistence](../src/hr/persistence.ts) | Validates the existing recruiting shape, hired identity links and associated HR records in one snapshot. | New records, optional-extension consistency, privacy projections and application-to-hire links will require strict validation. |
| [Recovery inspection](../src/portals/workspace-inspection.ts) | Counts jobs, candidates, their activity and hired onboarding records. Current-wave source adds employment lifecycle inspection. | New recruiting collections need explicit inventory, stable identities, bounded differences and hidden-payload fingerprints. Current-wave source is not new acceptance evidence. |

The existing [recruiting tests](../tests/hr/recruiting.test.mjs) and
[hire integration tests](../tests/hr/recruiting-link.test.mjs) describe the
single-application pipeline, generic duplicate refusal, atomic hire and scope
preservation. The [2026-10-14 talent receipt](HR-TALENT-QA-2026-10-14.md)
documents the earlier recruiting journey. These are useful foundations, not
acceptance of WX-0201–WX-0210. No test or browser run was performed to prepare
this plan, and the dated receipt must remain unchanged.

## Proposed optional schema and authority

All names and fields in this section are **proposals**, subject to Agent 0's
review before implementation. Use one optional `recruiting.lifecycle` schema
extension. Keep existing saves valid when it is absent, and do not add it during
reads, rendering, summaries, previews, export, refusal or no-op operations.

Proposed top-level shape:

```ts
type RecruitingLifecycleV1 = {
  schemaVersion: 1
  sequence: number
  simulationAt: string | null
  people: RecruitingPerson[]
  applications: RecruitingApplication[]
  requisitions: RecruitingRequisition[]
  jobRequisitionLinks: RecruitingJobRequisitionLink[]
  interviews: RecruitingInterview[]
  scorecards: RecruitingScorecard[]
  events: RecruitingLifecycleEvent[]
}
// Proposed addition only:
// RecruitingState.lifecycle?: RecruitingLifecycleV1
```

| Proposed record | Required identity and fields | Main invariants |
| --- | --- | --- |
| `RecruitingPerson` | Stable `id`, fictional first/last name, normalized `.invalid` email; optional `employeeId` and legacy source ID. | One normalized email identifies one candidate person. A person may have several applications. Existing employee collisions remain explicit refusals. |
| `RecruitingApplication` | Stable `id`, `personId`, `jobId`, stage, nullable `stageEnteredAt`, provenance, optional hired employee link. | Stages are applied/screening/interview/offer/hired/rejected/withdrawn. One application per person/job in this slice. Each application's history and outcome are independent. |
| `RecruitingRequisition` | Stable `id`, revision, department, owner employee ID, positive bounded headcount; draft/in-review/approved/rejected state; explicit review record tied to revision. | New publication requires the approved captured revision. An edit invalidates current approval; earlier approval remains historical. Approval is recorded only after a deliberate review action. |
| `RecruitingJobRequisitionLink` | `jobId`, requisition ID, approved revision and approval event ID. | One current binding per job; validate exact department/owner/headcount contract before publication. Historical publication binding must remain inspectable after later requisition changes. |
| `RecruitingInterview` | Stable `id`, application ID, interviewer employee IDs, explicit UTC start instant, named time zone, positive bounded duration in minutes and status. | Participants are supported fictional identities. Store both the instant and zone; refuse invalid or ambiguous input. Scheduling emits no invitation or outbound operation. |
| `RecruitingScorecard` | Stable `id`, interview ID, application ID, author employee ID, rubric/version, bounded structured ratings and fictional comments, draft/submitted state; explicit submission event ID when submitted. | Only the assigned author edits their draft. Submission is deliberate, revalidated and immutable in this slice. Submission exposes the card to the hiring-review projection. |
| `RecruitingLifecycleEvent` | Stable `id`, sequence, kind, acting preview identity, explicit nullable legacy time, application/requisition/interview/scorecard references as appropriate, captured previous/proposed structured values and bounded reason where required. | New transitions record actual selected sample timestamps. Events are append-only; reasons and comments never appear in default recovery inspection. |

Exact ID prefixes, field names, collection caps and rubric fields must be frozen
in the reviewed type contract. Keep explicit JSON-safe bounds and strict field
allowlists; do not accept partially present extensions as legacy data.

### Legacy compatibility without duplicate authority

1. With no extension, read the existing jobs, candidate/application records and
   hires exactly as stored. A pure view may expose deterministic legacy person
   and application IDs, but it must not write or consume a sequence.
2. The first meaningful accepted new workflow action may materialize the
   extension. Capture the existing candidate-to-person/application relationship
   with explicit legacy provenance. Preserve the original candidate records and
   their activity bytes as the compatibility base. If existing identities or
   normalized emails conflict, refuse adoption with an authorized conflict
   preview; do not silently merge, repair or discard those legacy records.
3. Once present, the extension is the sole authority for candidate identity,
   application stage, outcome and new application activity. The old candidate
   array is a historical compatibility base, not a second editable pipeline.
   Update every consumer through one reviewed projection: transitions, scoped
   reads, summaries, job closure, hire integration, validation and inspection.
4. Existing jobs and `hiredEmployees` retain their established identities. New
   hire identity must derive from the person, not each application. Hiring one
   person twice is refused; a later rehire uses the reviewed employment lifecycle
   workflow rather than silently creating a second directory person.
5. Existing published jobs keep their historical publication state and show
   that no requisition approval was recorded. Never manufacture approval. A new
   publication, including publication of a legacy draft, requires a deliberately
   reviewed requisition binding. Agent 0 must approve this compatibility rule
   and its effect on existing publish controls before implementation.
6. Never infer old timestamps from receipt sequence, planning date, current
   clock, employment dates or catalog completion metadata. Legacy stage entry
   time is unknown. Preserve existing receipts, and report unavailable historic
   durations explicitly. New events use selected sample times only.

The authority switch is the main schema review decision. If a different design
is chosen, it must still provide one authoritative application model and
byte-preserving reads of old saves. Dual mutable candidate/application copies
are not an acceptable shortcut.

## Proposed command and preview contract

Use pure preview/confirm functions over the full captured HR workspace, actor
and explicit action. A preview returns structured scope, proposed records,
issues and an opaque volatile confirmation value. It makes no state changes.
Confirmation rechecks the complete current workspace, actor, action and captured
references. Stale, unauthorized, invalid, duplicate, replayed and no-op actions
return or throw a fixed refusal with every original record and counter intact.

| Command family | Proposed behavior to review |
| --- | --- |
| Requisition draft/review/bind/publish | Preview department, owner, headcount and exact revision. Require explicit review before binding and publication. Refuse stale approval, changed binding or unsupported owner. Preserve historical approval facts. |
| Candidate conflict/create/application | Match normalized email before mutation. Show an authorized conflict preview with existing person and application IDs. Permit an explicit new application to a different job; refuse a duplicate person/job application. Never silently merge records or create an application on a refused duplicate-person submission. |
| Stage transition/reject/withdraw | Validate current application, published job and allowed next stage. Require a visible sample reason for rejection or withdrawal; record prior state and selected timestamp. Terminal withdrawn/rejected applications cannot progress or hire. Other applications remain unchanged. |
| Interview schedule | Preview application, participants, named zone, instant and duration. Require an explicit instant/zone pair so daylight-saving ambiguity cannot be silently resolved. No calendar integration, delivery queue or external identity is introduced. |
| Scorecard save/submit | Validate assigned interviewer identity before record lookup/projection. Save only that author's draft. Explicit submission freezes the submitted card and makes it visible to hiring review; drafts remain absent from that projection. |
| Hire preview/confirm | List exact directory identity, onboarding/template tasks, profile/status maps, balance and any employment-instance/event records that will be added. Show collision/eligibility issues before confirmation. Revalidate after any intervening HR edit and accept one complete replacement or no change. Preserve submitted payroll, onboarding receipts and unrelated applications/workspaces. |

For timeline metrics, require monotonic recorded times for a given application.
Measure completed intervals between actual timestamped stage transitions. An
open interval uses the explicitly selected sample observation time. Display
unknown legacy boundaries as unknown, with no invented zero or estimated
duration. A receipt sequence orders events; it is not a clock.

## Interviewer privacy and local preview limits

Propose a recruiting-specific preview actor rather than granting a new native
HR role or broadening manager authority. One possible union is an HR actor mode
and an interviewer mode bound to an existing fictional employee ID. Agent 0
must review its exact type and selector placement.

- Owner/HR-admin previews manage requisitions, applications, scheduling and
  hiring review. They do not receive another interviewer's unsubmitted scorecard
  through the review projection.
- An interviewer preview sees only assigned interviews and the minimum
  candidate/application/job context needed to write their own scorecard. It
  cannot browse the recruiting directory, other drafts, compensation, payroll,
  unrelated HR records or application mutation controls.
- A draft is visible and editable only to its assigned author. Submitted cards
  are visible to the authorized hiring-review preview. Other interviewers do
  not acquire draft access merely by sharing the interview.
- Apply authorization before returning records, errors, summaries or conflict
  information. Removing a control from the UI does not establish this boundary.
- Reuse the shared dirty-form controller. Switching interviewer, application,
  interview, subpage or accepted workspace requires the existing scoped
  Keep/Discard decision; drafts must not be rebound to another author or record.
- This is fictional **local preview privacy**, not account authorization,
  cryptographic isolation or protection from the person controlling the
  browser. The complete HR save and deliberate portable export contain the
  complete workspace, including saved private scorecards. State this limit in
  the product where the user chooses the preview/export. No provider identity,
  invitation, email, calendar access or live HR authority follows from it.
- Default recovery details show bounded IDs, statuses, revisions, dates and
  counts. Full hidden payload fingerprints detect comment/reason changes while
  names, emails, comments, reasons and scorecard answers remain absent from that
  default presentation.

## Sequencing and disjoint ownership proposal

These are proposed lanes, not dispatched assignments. Agent 0 first reviews
the schema authority, transition rules, role projections and compatibility
policy. The preceding sixteen-item wave completed its own verification and
acceptance before its employment/template APIs are treated as a settled base.

| Lane | Criteria and owned files | Shared integration boundary |
| --- | --- | --- |
| A — Requisitions | WX-0201/WX-0202; new requisition helper/types, requisition component and focused tests. | Consume the frozen shared lifecycle types; return pure proposals, not provider or storage writes. |
| B — People/applications | WX-0203/WX-0204/WX-0207/WX-0208/WX-0209; shared extension types plus new identity/application/timeline helpers, application component and tests. | Sole type-contract owner; freeze identity and event shapes before C/D/E implement consumers. |
| C — Interviews/scorecards | WX-0205/WX-0206; new scheduling/scorecard helpers, components and tests. | Consume application IDs and the reviewed interviewer actor/projection contract. No edits to B's files. |
| D — Hiring summary | WX-0210; new preview helper/component and focused atomic/stale/refusal tests. | Consume B's application projection and the accepted employment/template API; do not duplicate hire mutation logic. |
| E — Persistence/recovery | Strict optional extension validation, legacy round trips, complete counts/differences and recovery tests. | Sole owner of HR persistence and shared inspection changes during this wave, after earlier owners hand them off. |
| F — Browser/evidence | New owned browser journey/runner, independent literal expected records and a new dated QA receipt. | Runs after runtime freeze; preserves failed diagnostics and earlier receipts. No domain edits. |
| Agent 0 — Integration | Existing recruiting dispatch/projections, hire integration, HR route/component composition, shared command/docs/catalog wiring and final review. | Sole owner of existing `recruiting.ts`, `recruiting-link.ts`, `HrRecruiting.tsx` and `HrWorkspace.tsx`; serialize shared changes. |

Suggested order:

1. Review and freeze the proposed schema, bounds, legacy adoption rule and role
   projections. Do not begin implementation from this planning document alone.
2. Implement B's identity/application contract and A's requisition workflow.
   C can implement against frozen IDs and events once those contracts exist.
3. Integrate stages, reasons, withdrawal and recorded time; add scorecard
   submission and D's exact hiring summary without parallel mutation engines.
4. E completes strict snapshot validation, inventory/diffs and portable recovery
   before the browser freeze. Review all consumers of the legacy candidate array.
5. F records independent UI outcomes. Agent 0 reviews each original criterion,
   then makes any deliberate catalog/evidence updates and publication decision.

## Required verification before acceptance

The list below is a future verification plan, not an executed result.

| Boundary | Required evidence |
| --- | --- |
| Legacy preservation | Literal old snapshots read, preview, export and round-trip without materialized extensions or changed bytes. Preserve old candidate activity, receipts, payroll and onboarding records. Refuse malformed present extensions instead of falling back to legacy. |
| Requisitions | Draft/review/approval/binding/publication journey; unapproved and stale revision refusals; department, owner and headcount checks; unchanged state/counters after each refusal. |
| Identity/applications | Case-normalized email conflict preview; no duplicate person or person/job application; one person with two jobs, independent stages/reasons/outcomes; denied-role conflict information absent. |
| Interview/scorecard | Actual schedule fields survive refresh and recovery; invalid participant/time/zone/duration refusals; author-only draft visibility; other interviewer and HR review projections exclude drafts; explicit submission exposes only the submitted card to review. Verify projection data as well as controls. |
| Timeline/outcomes | Independently specified timestamps and literal elapsed durations; unknown legacy interval remains unknown; backwards time refused; rejection and withdrawal remain distinct and terminal with reasons and preserved prior events. |
| Hire | Exact previewed directory/onboarding/balance/employment records match the accepted result. A stale preview, collision, withdrawn application, unsupported actor or replay changes no records. Another application, submitted payroll and prior receipts remain identical. |
| Complete recovery | Strict import links and bounds; selected restore/Undo in both directions when the extension is absent on one side; every new collection counted without inflating totals for references or snapshots; hidden content changes detected; bounded IDs/details and explicit omissions; no free text in default inspection. |
| Dirty forms/accessibility | Keep/Discard and identity/subpage/replacement scope; meaningful accessible labels and focus; no hidden-module duplicate status feedback; readable monochrome and x-large evidence for new controls/statuses. Manual screen-reader acceptance remains its own evidence requirement. |
| Browser independence | Use owned isolated contexts, actual forms and controls, downloads/uploads where required and literal expected complete records. Keep fixture rendering, source review, model execution and observed UI facts distinct. Preserve earlier dated receipts and all failed diagnostics. |

Agent 0 must run the repository's required integration, full CI, Hosting
preflight, SYSTEMX drift, template and link gates at the appropriate final
boundary. Their required future execution is not a pass claim in this plan.
No completion, gate success, provider activation, deployment or operational
adoption follows from preparing or approving this local design.
