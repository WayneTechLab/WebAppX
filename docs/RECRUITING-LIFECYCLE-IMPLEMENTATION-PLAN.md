# Recruiting lifecycle implementation plan

Planning and status date: **2026-10-15**. Status: **integrated and locally
accepted for eleven original criteria**.
The authoritative [shared contract, section 12](RECRUITING-LIFECYCLE-CONTRACT.md#12-final-agent-0-integration-decisions)
governs final types, authority, privacy and compatibility. Earlier design
illustrations retained below are historical and cannot override that section or
the [implemented shared types](../src/hr/recruiting-lifecycle-types.ts).

Agent 0 accepted **WX-0201–WX-0210** and the separately scoped **WX-0951** optional
provider adapter criterion on source
`7337709b79b995c3f1e76254aa51fd86bbd1f215`. The catalog now records **122 done /
878 remaining**; the full 1,000-item goal remains active. The preceding **111 done /
889 remaining** confirmation checkpoint remains historical. The
[recruiting QA receipt](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md) records completed
**63-stage CI**, **198 actual browser checks/groups** (184 across fourteen common
suites, 8 HR-disabled and 6 LAN) and Hosting preflight, all with terminal exit 0.
The application remains **3.4.0**, deploy **0**; no deployment or provider
activation occurred. Source/wiki publication is verified separately by remote
parity. Earlier dated QA receipts retain their own source and observation scope.

## Current implementation and verification boundary

| Integrated implementation | Source and scope |
| --- | --- |
| Explicit adoption and one event authority | [Core](../src/hr/recruiting-lifecycle.ts) and [replay](../src/hr/recruiting-lifecycle-replay.ts) require a separate `adopt` preview/confirm command before extension actions. Reads and ordinary legacy actions do not adopt. Captured legacy records remain the compatibility base. |
| Requisition and publication workflow | [Handler](../src/hr/recruiting-requisitions.ts) and [management UI](../src/hr/components/HrRecruitingRequisitions.tsx) implement explicit review, immutable approval/publication captures, separate owner/manager choices and bounded headcount planning. |
| People, applications and timelines | The core, [projection](../src/hr/recruiting-lifecycle-projection.ts) and [application UI](../src/hr/components/HrRecruitingApplications.tsx) implement authorized conflict previews, independent applications, reasons, terminal withdrawal and explicit recorded-time intervals. |
| Interviews and private scorecards | [Interview handler](../src/hr/recruiting-interviews.ts), scoped DTOs and command ports implement assigned-author drafts and explicit submission. [Controller](../src/hr/recruiting-controller.ts) privately binds source, actor, epoch, generation and ephemeral handles. |
| Atomic hire and later employment materialization | [Hire adapter](../src/hr/recruiting-hire.ts), [employment baseline](../src/hr/recruiting-employment-baseline.ts) and [strict validation](../src/hr/recruiting-lifecycle-validation.ts) capture exact additions and distinguish immutable hire facts from later onboarding/profile/employment changes. |
| Recovery and scoped shell | [Inspection](../src/portals/workspace-inspection.ts) inventories the optional collections and hidden payloads. The [preview provider](../src/hr/RecruitingPreviewProvider.tsx) keeps volatile identity selection in HR; shared layout consumes only [generic boolean chrome state](../src/portals/ScopedPortalChrome.tsx). |
| Separate WX-0951 contract | [Provider adapter](../src/hr/provider-adapter.ts) separates native commands, provider outcomes, retry states and unsupported operations. Its supplied implementation stays mock/unconfigured, performs no transport and grants no provider authority. |

Focused lane/model/callback checks were executed during implementation. The
requisition handoff's **23 focused tests**, scoped lint and then-current
TypeScript pass remain intermediate observations. Final acceptance instead uses
the reviewed source bindings and completed integration/browser evidence in the
[recruiting QA receipt](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md), including the
[host tests](../tests/hr/recruiting-lifecycle-host.test.mjs),
[integration tests](../tests/hr/recruiting-integration.test.mjs) and
[independent browser journey](../tests/browser/recruiting.mjs). This documentation
update executes no new application test or browser journey.

Integration and acceptance checkpoint, owned by Agent 0:

1. Independent host/source review and strict persistence review covered optional
   recruiting/employment combinations and later profile/onboarding changes.
   Final source is bound to **123-source freeze 4** at the revision above.
2. The owned recruiting journey and affected browser regressions completed;
   the aggregate is **198 actual checks/groups**, independently audited against
   the reports. Failed diagnostics and earlier receipt bytes remain preserved.
   No manual screen-reader or other-platform acceptance is inferred.
3. The final **63-stage** `ci:all` and Hosting preflight both reached terminal
   exit 0 on that source. The dated QA records the execution and source bindings.
4. Agent 0 reviewed and accepted the ten original recruiting criteria and the
   separate WX-0951 local contract. Canonical progress is **122 done / 878
   remaining**; original criterion definitions and dependencies remain intact.
5. Source/wiki publication requires its own direct remote parity verification.
   Local acceptance and preflight supply no production deployment authorization,
   provider activation or operational adoption.

## Original canonical scope

The [canonical catalog](backlog/webappx-1000-todo.json) has schema version `1`,
project `WebAppX`, intent `proposed-backlog`, creation date `2026-10-14` and
original `sourceCommit` `8359285c99069349d6218fe871868baab76868e5`. That original
source commit identifies the proposal basis; it is not an execution or browser
observation revision.

These proposal-origin fields were identical for all ten selected items. The
original `todo` value below is historical; current completion is the eleven-item
acceptance recorded above and in the canonical catalog.

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

The historical candidate-selection review also identified WX-0159/WX-0160,
WX-0656 and WX-0951. Pay-period corrections and manual screen-reader evidence
remain separate work. WX-0951 is now an accepted, separately scoped local
contract in this wave, with its original definition intact:

| Field | Original WX-0951 value |
| --- | --- |
| Title | Define an optional provider adapter interface |
| Acceptance | A typed contract separates native HR commands, provider results, retry states and unsupported operations while mock mode stays the default. |
| Area / priority / phase | `integrations` / `P1` / `extensions` |
| Status / gate / dependencies | `todo` / `local` / `[]` |
| Source | `docs/GUSTO-SETUP.md` |

## Historical source observations — before implementation

This table preserves the planning-era baseline and its then-missing work. It
does not describe the current integrated implementation listed above, and supplies
no new execution or acceptance evidence.

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
acceptance of WX-0201–WX-0210. No test or browser run was performed for the
original planning-only preparation; later implementation checks are scoped
separately above. The dated receipt must remain unchanged.

## Historical schema proposal — superseded by the reviewed contract

The following illustration is retained as **historical design**, not the current
type contract. Section 12 of the reviewed shared contract and the implemented
types take precedence. In particular, the implementation has no `simulationAt`
or `jobRequisitionLinks` field; it uses explicit approval/publication captures,
jobs, hire bindings and an adoption envelope. The optional extension remains
absent during reads, rendering, summaries, previews, export, refusal and no-ops.

Historical proposed top-level shape:

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

### Compatibility design, with the adopted explicit action clarified

1. With no extension, read the existing jobs, candidate/application records and
   hires exactly as stored. A pure view may expose deterministic legacy person
   and application IDs, but it must not write or consume a sequence.
2. **Current decision: only a separate explicit `adopt` preview/confirm action
   materializes recruiting history.** Other new workflow commands refuse until
   adoption; the first meaningful ordinary action does not adopt automatically.
   Capture the existing candidate-to-person/application relationship with
   explicit legacy provenance. Preserve the original candidate records and
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

## Historical command and preview design

The reviewed shared contract and current implementation above settle the final
command/DTO shape. This original design table remains rationale, not a second
dispatcher or permission to bypass the trusted controller.

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

## Historical interviewer privacy design and continuing local limits

The original proposal below led to the reviewed native/interviewer actor union
and dedicated local shell. It creates no native HR role or broader manager
authority. Current exact DTOs, selector placement and final privacy decisions
are governed by the shared contract, especially section 12.

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

## Historical sequencing and disjoint ownership proposal

This table retains the original proposed split. Agent 0 subsequently reviewed
the shared contract and dispatched implementation; current ownership and
remaining integration steps are coordinated separately. The table does not
authorize new edits or represent every current file owner.

| Lane | Criteria and owned files | Shared integration boundary |
| --- | --- | --- |
| A — Requisitions | WX-0201/WX-0202; new requisition helper/types, requisition component and focused tests. | Consume the frozen shared lifecycle types; return pure proposals, not provider or storage writes. |
| B — People/applications | WX-0203/WX-0204/WX-0207/WX-0208/WX-0209; shared extension types plus new identity/application/timeline helpers, application component and tests. | Sole type-contract owner; freeze identity and event shapes before C/D/E implement consumers. |
| C — Interviews/scorecards | WX-0205/WX-0206; new scheduling/scorecard helpers, components and tests. | Consume application IDs and the reviewed interviewer actor/projection contract. No edits to B's files. |
| D — Hiring summary | WX-0210; new preview helper/component and focused atomic/stale/refusal tests. | Consume B's application projection and the accepted employment/template API; do not duplicate hire mutation logic. |
| E — Persistence/recovery | Strict optional extension validation, legacy round trips, complete counts/differences and recovery tests. | Sole owner of HR persistence and shared inspection changes during this wave, after earlier owners hand them off. |
| F — Browser/evidence | New owned browser journey/runner, independent literal expected records and a new dated QA receipt. | Runs after runtime freeze; preserves failed diagnostics and earlier receipts. No domain edits. |
| Agent 0 — Integration | Existing recruiting dispatch/projections, hire integration, HR route/component composition, shared command/docs/catalog wiring and final review. | Sole owner of existing `recruiting.ts`, `recruiting-link.ts`, `HrRecruiting.tsx` and `HrWorkspace.tsx`; serialize shared changes. |

Original suggested order, retained as historical design:

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

## Retained acceptance checklist

The original verification boundaries below remain the acceptance checklist.
Completed results, final source bindings and Agent 0's eleven criterion decisions
are recorded in the [recruiting QA receipt](HR-RECRUITING-LIFECYCLE-QA-2026-10-15.md).
This retained checklist adds no execution observation or criterion definition.

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

Agent 0 completed the final 63-stage CI and Hosting preflight on the reviewed
source and accepted the eleven original local criteria using the separately
recorded QA evidence. The historical design itself was not acceptance evidence.
Source/wiki publication, provider activation, deployment and operational adoption
remain separate boundaries.
