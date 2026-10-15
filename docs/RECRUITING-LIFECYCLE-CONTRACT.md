# Recruiting lifecycle shared implementation contract

Design reviewed by **Agent 0 on 2026-10-15** against published source
`7a582ed4a5396d54aa94e3ca780667d1b07f179e`. Implementation is authorized by the
user's active all-1,000 backlog goal and is dispatched in explicit bounded
lanes. This contract supplies no acceptance evidence: **WX-0201–WX-0210 remain
TODO** until their original criteria pass source, persistence and browser review.
The [implementation plan](RECRUITING-LIFECYCLE-IMPLEMENTATION-PLAN.md) preserves
the original scope. Section 12 below resolves the final independent audit;
its concrete decisions take precedence over earlier illustrative shapes.

Scope: original WX-0201–WX-0210, all P1/local TODO with `dependsOn: []`. Their
original criteria remain requisition records/review, candidate conflict preview,
multiple applications, interviews, private scorecards, reasons, recorded-time
metrics, withdrawal and exact atomic hiring summary. This contract preserves
those targets; it adds no provider or account authority.

## 1. Recommended decisions

1. `recruiting.lifecycle` is an optional schema 1 extension with an **explicit
   preview/confirm adoption action**. Reads, exports, ordinary legacy commands,
   failed previews and no-ops never adopt it.
2. Absence retains every existing legacy command and its existing rules. A
   present malformed/unsupported extension refuses; truthiness must never select
   the legacy path. Once adopted, new person/application records are the sole
   person/application authority. Legacy candidate objects and activity remain
   unchanged. New commands cannot call the old candidate reducer as a fallback.
3. Use a private per-document command controller with random ephemeral preview
   handles. The controller owns the complete HR source and update function.
   Scoped components receive only authorized views and commands. They receive
   neither complete state, child-supplied full-state updater callbacks, source
   digests nor serialized full-state confirmation values.
4. Enter interviewer mode at the existing native recruiting route through a
   local shell mode. Mount a dedicated minimal shell in place of the management
   workspace. Do not add an `HrRole`, portable route or query-string authority.
5. Use explicit canonical UTC event timestamps with separate chronology streams:
   public stage transitions per application, and private scorecard saves/submission
   per interview/author. A hidden draft never advances another author's bound.
   Scheduled interview start is separate. No global timestamp ordering or
   clock-derived legacy dates are introduced.
6. One person can have multiple applications but at most one recruiting hire.
   Preserve adopted employee IDs; derive a prospective new employee ID from the
   stable new person ID. A later rehire belongs to employment lifecycle.

## 2. Current source constraints to integrate deliberately

- `src/hr/recruiting.ts` currently combines identity and one application in
  `RecruitingCandidate`, with generic email duplicate refusal. `transitionRecruiting`
  has no timestamps, requisitions, withdrawal, interviews or scorecards.
- `src/hr/persistence.ts` currently requires every hired employee to have exactly
  one old `candidate.stage === 'hired'` record. That check must be conditional:
  preserve it when the extension is absent; use exact person/application/hire
  bindings when present. Old candidate stage must stay frozen after adoption.
- `src/hr/recruiting-link.ts` creates directory employee capture, onboarding,
  profile/status maps and balances together. With employment lifecycle present
  it also captures the selected template and creates an employment instance.
- The current HR workspace's child callback accepts a function that receives
  complete `HrDemoState`. That API cannot be passed to a scoped interviewer.
  The existing full-state JSON confirmation design also cannot be reused there.
- Existing save validation is synchronous. Browser-save envelopes have a
  2,000,000-character limit; individual backup text adds a 512-character envelope
  allowance and has a separately checked maximum UTF-8 file size. New fields
  must remain inside these existing complete-workspace limits.
- The root layout and native HR workspace separately render navigation/chrome.
  Hiding one card inside `HrRecruiting` does not hide management navigation,
  payroll/directory links, backup controls or unrelated status/error output.

## 3. Proposed durable TypeScript shape

The names below are a concrete proposal, ready to freeze as a type contract
after review. Existing types are referenced rather than redefined. IDs are
stable opaque local identifiers; receipt/event sequence is not a timestamp.

```ts
type Id = string
type UtcInstant = string // exactly YYYY-MM-DDTHH:mm:ss.sssZ; round-trip valid
type RecruitingActor =
  | { mode: 'native'; actor: HrActor }
  | { mode: 'interviewer'; employeeId: Id }

type ApplicationStage =
  | 'applied' | 'screening' | 'interview' | 'offer'
  | 'hired' | 'rejected' | 'withdrawn'

type RecruitingPerson = {
  id: Id
  firstName: string
  lastName: string
  workEmail: string // trimmed/lowercase .invalid; identity is NOT this string
  provenance:
    | { kind: 'legacy'; candidateId: Id }
    | { kind: 'created'; eventId: Id }
}

type RecruitingApplication = {
  id: Id
  personId: Id
  jobId: Id
  stage: ApplicationStage
  stageEnteredAt: UtcInstant | null
  lastStageRecordedAt: UtcInstant | null // stage stream only; replay-derived
  provenance:
    | { kind: 'legacy'; candidateId: Id; initialStage: ApplicationStage }
    | { kind: 'created'; eventId: Id }
  hireBindingId: Id | null
}

type RequisitionContent = {
  department: string
  ownerEmployeeId: Id // independent from job.managerEmployeeId
  headcount: number // integer 1..50, recorded planning value, NOT a hiring quota
}
type RecruitingRequisition = {
  id: Id
  revision: number
  content: RequisitionContent
  state: 'draft' | 'in-review' | 'approved' | 'rejected'
  currentApprovalId: Id | null
}
type RequisitionApproval = {
  id: Id
  requisitionId: Id
  revision: number
  content: RequisitionContent
  eventId: Id
  actor: RecruitingActor
  recordedAt: UtcInstant
}

type LifecycleJob = {
  id: Id
  revision: number
  title: string
  department: string
  managerEmployeeId: Id
  state: 'draft' | 'published' | 'closed'
  requisitionId: Id | null
  currentPublicationId: Id | null
  provenance:
    | { kind: 'legacy'; jobId: Id; initialState: 'draft'|'published'|'closed' }
    | { kind: 'created'; eventId: Id }
}
type JobPublication = {
  id: Id
  jobId: Id
  jobRevision: number
  job: { title: string; department: string; managerEmployeeId: Id }
  requisitionApprovalId: Id
  eventId: Id
  actor: RecruitingActor
  recordedAt: UtcInstant
}

type RecruitingInterview = {
  id: Id
  applicationId: Id
  participantEmployeeIds: Id[]
  startAt: UtcInstant // meeting start, may be later than recordedAt
  timeZone: string // supported named IANA zone, or UTC; no numeric offset alias
  durationMinutes: number
  createdEventId: Id
}
type ScorecardContent = {
  rubricVersion: 'sample-interview-v1'
  ratings: { roleUnderstanding: number; collaboration: number; problemSolving: number }
  comments: string // fictional, bounded; private until explicit submit
}
type RecruitingScorecard = {
  id: Id
  interviewId: Id
  applicationId: Id
  authorEmployeeId: Id
  revision: number
  content: ScorecardContent
  state: 'draft' | 'submitted'
  latestDraftEventId: Id // most recent own scorecard-saved event; private linkage
  lastOwnRecordedAt: UtcInstant // this interview/author's saves/submission only
  submittedEventId: Id | null
}

type RecruitingHireBinding = {
  id: Id
  personId: Id
  applicationId: Id
  employeeId: Id
  provenance:
    | { kind: 'legacy'; candidateId: Id }
    | { kind: 'created'; eventId: Id }
  employeeSnapshot: HrEmployee // exact immutable captured hiredEmployees record
  checklist: { version: string | null; tasks: { id: Id; title: string }[] }
  initialBalances: { vacation: number; sick: number } | null
}

type RecruitingLifecycleV1 = {
  schemaVersion: 1
  sequence: number // next event; contiguous accepted event order only
  adoption: {
    eventId: Id
    actor: RecruitingActor
    recordedAt: UtcInstant
    legacyJobs: RecruitingJob[]
    legacyCandidates: RecruitingCandidate[]
    legacyHiredEmployees: HrEmployee[]
    legacySequence: number
  }
  people: RecruitingPerson[]
  applications: RecruitingApplication[]
  requisitions: RecruitingRequisition[]
  approvals: RequisitionApproval[]
  jobs: LifecycleJob[]
  publications: JobPublication[]
  interviews: RecruitingInterview[]
  scorecards: RecruitingScorecard[]
  hireBindings: RecruitingHireBinding[]
  events: RecruitingDomainEvent[]
}
// RecruitingState gains lifecycle?: RecruitingLifecycleV1.
```

Recommendation: make extension jobs authoritative too after adoption, leaving
original `recruiting.jobs`, candidate objects, activity arrays and legacy
sequence as their captured compatibility base. This prevents an old publish
callback from bypassing the requisition rule or appending an unclassified
legacy receipt. New hired-employee captures remain append-only in the existing
`hiredEmployees` collection; they are linked by `hireBindings`.

This adds explicit job/publication collections to the earlier plan. It avoids a
second mutable job status/approval authority and should be accepted or revised
before dispatch, not improvised by parallel lanes.

### IDs and adoption provenance

- New people use a person-collection allocator, for example `rperson-0001`.
  It never derives identity from email or application ID. New application IDs
  use a separate allocator, for example `rapplication-0001`.
- Adoption assigns stable person/application IDs in captured legacy-array
  order and records each original candidate ID. It consumes one adoption event,
  not a fabricated event for each historical stage.
- New employee IDs are prospectively `employee-<personId>`. The hire preview
  shows the exact value before acceptance. Adopted hires retain their original
  candidate-derived employee IDs through an immutable legacy hire binding.
- New records use safe IDs of at most 128 characters. Existing legacy IDs up
  to the current 200-character validator bound remain in provenance fields
  unchanged. Reject collisions/reserved keys; never truncate or repair an ID.
- If legacy normalized emails, person/job pairs or hire links conflict, refuse
  adoption with an owner/HR conflict preview. No automatic merging or deletion.
- Capture original arrays with original values/activity ordering and preserve
  their serialization through accepted extension commands. Validation compares
  them to the captured adoption base; parsing a file may normalize JSON syntax,
  but application commands cannot rewrite the legacy records.
- Adopted hire bindings preserve known checklist version facts; otherwise the
  version and original initial balances remain null/unknown. Capture actual task
  definitions and current records without inventing historical setup values.
- There is no fabricated approval for an already published legacy job. Its
  provenance explicitly says legacy publication with no recorded requisition
  approval. Existing applications may continue under that captured publication.
  New publication of a legacy draft requires a real reviewed requisition.

## 4. Commands, chronology and replay invariants

New commands use the following families. Every accepted command records exactly
the specified durable event(s); preview/refusal/cancel/no-op/replay records none.

```ts
type RecruitingCommand =
  | { kind: 'adopt'; recordedAt: UtcInstant }
  | { kind: 'create-requisition'; content: RequisitionContent; recordedAt: UtcInstant }
  | { kind: 'edit-requisition'; requisitionId: Id; revision: number; content: RequisitionContent; recordedAt: UtcInstant }
  | { kind: 'request-requisition-review'; requisitionId: Id; revision: number; recordedAt: UtcInstant }
  | { kind: 'review-requisition'; requisitionId: Id; revision: number; outcome: 'approved'|'rejected'; reason: string; recordedAt: UtcInstant }
  | { kind: 'create-job'; title: string; department: string; managerEmployeeId: Id; requisitionId: Id; recordedAt: UtcInstant }
  | { kind: 'bind-job-requisition'; jobId: Id; revision: number; requisitionId: Id; recordedAt: UtcInstant }
  | { kind: 'publish-job'|'close-job'; jobId: Id; revision: number; recordedAt: UtcInstant }
  | { kind: 'create-person-application'; jobId: Id; firstName: string; lastName: string; workEmail: string; recordedAt: UtcInstant }
  | { kind: 'add-person-application'; personId: Id; jobId: Id; recordedAt: UtcInstant }
  | { kind: 'move-application'; applicationId: Id; expectedStage: ApplicationStage; nextStage: 'screening'|'interview'|'offer'; recordedAt: UtcInstant }
  | { kind: 'end-application'; applicationId: Id; expectedStage: ApplicationStage; outcome: 'rejected'|'withdrawn'; reason: string; recordedAt: UtcInstant }
  | { kind: 'schedule-interview'; applicationId: Id; participantEmployeeIds: Id[]; startAt: UtcInstant; timeZone: string; durationMinutes: number; recordedAt: UtcInstant }
  | { kind: 'save-scorecard'; interviewId: Id; expectedRevision: number|null; content: ScorecardContent; recordedAt: UtcInstant }
  | { kind: 'submit-scorecard'; scorecardId: Id; expectedRevision: number; recordedAt: UtcInstant }
  | { kind: 'hire'; applicationId: Id; recordedAt: UtcInstant }
```

Native owner/HR actors manage requisitions, jobs, people, stages, interviews and
hire. Interviewer actors can save/submit only their assigned own scorecards.
The scorer's author ID always comes from the actor, never a caller field.
Native owner/HR is not an implicit scorecard author. Explicit requisition review
is required, but the criterion does not require inventing a second approver or
separation-of-duties rule beyond the selected local authorization.

Proposed event envelope:

```ts
type EventBase = { id: Id; sequence: number; actor: RecruitingActor; recordedAt: UtcInstant }
type RecruitingDomainEvent = EventBase & (
  | { kind: 'adopt'; adoption: RecruitingLifecycleV1['adoption'] }
  | { kind: 'person-created'; person: RecruitingPerson }
  | { kind: 'application-created'; applicationId: Id; application: RecruitingApplication }
  | { kind: 'application-stage'; applicationId: Id; previousStage: ApplicationStage; stage: ApplicationStage; reason: string|null }
  | { kind: 'requisition-changed'; requisitionId: Id; previousRevision: number|null; requisition: RecruitingRequisition }
  | { kind: 'requisition-reviewed'; requisitionId: Id; revision: number; outcome: 'approved'|'rejected'; reason: string; approval: RequisitionApproval|null }
  | { kind: 'job-changed'; jobId: Id; previousRevision: number|null; job: LifecycleJob }
  | { kind: 'job-published'; jobId: Id; publication: JobPublication }
  | { kind: 'interview-scheduled'; applicationId: Id; interview: RecruitingInterview }
  | { kind: 'scorecard-saved'; applicationId: Id; previousRevision: number|null; scorecard: RecruitingScorecard }
  | { kind: 'scorecard-submitted'; applicationId: Id; interviewId: Id; scorecardId: Id; authorEmployeeId: Id; draftEventId: Id; revision: number }
  | { kind: 'hired'; applicationId: Id; hire: RecruitingHireBinding }
)
```

Event-specific field allowlists and valid actor/action pairs are strict. Replay
reconstructs current collections from the captured legacy baseline plus events;
an arbitrary current record cannot override that replay. Preserve the complete
previous stage history. Rejection and withdrawal require 2–500 printable sample
characters, are distinct and terminal, and can never hire. Hiring appends the
hire event/stage result without changing another application for that person.

Every `recordedAt` is canonical UTC, but monotonicity belongs to a declared
stream rather than every event that happens to carry an `applicationId`:

| Stream | Events that advance it | Replay cursor and lower bound |
| --- | --- | --- |
| Public application stages, keyed by `applicationId` | `application-created`, `application-stage`, `hired` | `lastStageRecordedAt`; compare only with the previous event in this stage stream. Equality is allowed. The current known `stageEnteredAt` equals this cursor. |
| Private scorecard work, keyed by `(interviewId, authorEmployeeId)` | That author's `scorecard-saved` and `scorecard-submitted` | `lastOwnRecordedAt` on that pair's scorecard; compare only with the previous event in this own stream. Equality is allowed; no cursor exists before its first save. |
| Scheduling | One `interview-scheduled` event creates an interview | Validate that event's explicit time and immutable capture; it advances neither stage nor scorecard cursors. `startAt` is an independent scheduled meeting instant. |

Adoption creates unknown-time application stage baselines: both
`stageEnteredAt` and `lastStageRecordedAt` are null, including an already-hired
legacy application. The first real stage transition can establish a known time
without inventing the unknown interval before it. A newly created application
starts at `applied` and initializes both fields from its `application-created`
event. Stage moves, rejection/withdrawal and hiring update both fields exactly
once; saving/submitting a scorecard and scheduling an interview update neither.

Replay consumes accepted global `sequence` order to establish existence,
authorization and exact record links, then validates timestamps against only the
relevant stream cursor. It must not take a maximum of all application events,
all interview events or all scorecard events. No cross-author, cross-interview,
stage-to-scorecard, scheduling-to-scorecard or global time ordering is imposed.
For example, author A's private save at `2030-01-01T12:00:00.000Z` cannot prevent
author B saving at `2026-10-15T09:00:00.000Z` on the same interview. Nor can it
prevent a public stage transition whose time is valid for that application's
stage stream. New commands still require the target/interview/assignment and
legal application state to exist at their accepted replay sequence; independent
timestamps do not relax those domain preconditions.

No global `simulationAt` authority is needed: duration queries take an explicit
observation instant. Requisition/job/adoption events retain valid explicit
timestamps and causal revision/capture links, but do not impose a timestamp
floor on application or private scorecard streams.

Scorecard replay rules are concrete:

- A first save creates revision 1 for the exact interview/actor pair. Each later
  save while still draft requires that pair's exact previous revision and
  increments it by one. The event captures the new content; its scorecard
  snapshot has `state: 'draft'`, `latestDraftEventId === event.id`,
  `lastOwnRecordedAt === event.recordedAt` and `submittedEventId: null`.
- `submit-scorecard` still accepts only `scorecardId`, `expectedRevision` and
  explicit `recordedAt`. The controller privately resolves that author's current
  valid latest draft event during preview and binds it with the full source.
  The component does not supply or receive a globally sequenced draft event ID.
- Submission creates its own `scorecard-submitted` event whose `draftEventId`
  references the exact latest own `scorecard-saved` event. Its interview,
  application, scorecard, author and revision must all agree. The referenced
  event must be earlier in accepted sequence, belong to the authorized author,
  contain a valid complete rubric/content draft, and still be the current draft.
  A different author's, older revision's or already submitted draft is invalid.
- Submission preserves the draft's revision/content and `latestDraftEventId`,
  changes state to submitted, sets `submittedEventId` to its own event ID and
  advances only `lastOwnRecordedAt`. Its time must be at least the latest own
  save time; it need not be at least another author's or the application's time.
  Submitted scorecards are immutable; repeat submission and later saves refuse.
- Complete validation independently rebuilds both cursor families and draft
  links from events. Current cursor/link fields must exactly match that replay;
  imported maxima, cross-author links and fabricated cursor values cannot become
  authority. A submission event never invents a missing draft or increments its
  revision. Draft-save event bodies/history remain private to their author after
  submission too. Hiring review receives only the explicitly submitted content
  and allowlisted submission result, never earlier draft revisions.

Duration metrics use actual stage transition instants. An unknown start or end
produces an unknown interval, not zero. Open-stage duration uses the explicitly
chosen observation time and refuses an observation earlier than its known stage
entry. Scorecard saves and submissions do not restart stage duration. Public
activity may show an explicit submission's own recorded time, but that activity
row is not a stage transition and does not close or reopen a stage interval.

Interview `startAt` is an independently validated meeting instant and can be in
the future relative to scheduling `recordedAt`. Do not use it as event time or
automatically advance stages. Validate the named zone through an injected,
browser-safe Intl validation adapter; accept named supported zones and UTC,
refuse unsupported/numeric-offset names. Store the chosen name and explicit UTC
instant; do not silently resolve a local daylight-saving ambiguity. This slice
sends no invitations and makes no assertion that an interview actually occurred.

## 5. Requisition and publication captures

Requisition owner and job hiring manager are separate fields and concepts; they
may happen to name the same employee. Both bind known supported current employee
identities. Headcount is recorded bounded planning information. It is not
consumed by hires and does not enforce a hiring quota.

Draft edits increment revision and clear current approval. Submit-for-review and
explicit review are separate actions. An approval is an immutable content and
revision capture, and a publication captures that exact approval plus job
revision/department/manager. Later edits preserve earlier captures. A new publish
requires current approval/binding agreement and an eligible job manager. Closing
checks authoritative extension applications, including withdrawn as terminal;
there is no closed-job reopening in this slice. Historical published jobs retain
their original provenance without invented approval.

## 6. Four extension combinations and atomic hiring

| Recruiting extension | Employment extension | Required behavior |
| --- | --- | --- |
| Absent | Absent | Every original recruiting command works unchanged. No adoption or invented employment date. Existing candidate-based hire IDs remain. |
| Absent | Present | Original recruiting commands remain available; existing employment-aware hire adapter captures its chosen checklist and known/null simulation date exactly as today. |
| Present | Absent | New application/person authority and exact hire binding create directory capture, active onboarding/profile/status maps and vacation/sick balances in one candidate. Keep employment extension absent and employment dates unknown. |
| Present | Present | Same transaction additionally creates the employment instance/event with the employment extension's selected checklist and known/null simulation date. Recruiting UTC event time must not silently set an employment date. |

Adoption itself never flips employment extension presence. A hire summary lists
the exact employee ID, immutable employee capture, checklist/version/task flags,
profile/status entries, initial balances and any employment records before
confirmation. Current initial balances are vacation 40/sick 24, sourced from the
existing helper. Compensation remains explicitly unconfigured. Source/person/
application/target collisions, withdrawn/rejected/already-hired applications,
another hire for the person or stale state refuse the whole transaction.

Validate each `hiredEmployees` row through exactly one authoritative hire binding
and matching person/application. A legacy binding preserves its adopted employee
ID; a created binding requires the exact person-derived ID and snapshot. The
old candidate's frozen stage is never required to change to hired. Conversely,
forging an application to hired without all its directory/onboarding/balance/
employment links must fail complete validation. Submitted payroll, consumed
time, prior receipts, existing balances/rates/benefits and other applications
remain untouched.

**Cross-extension integration issue to freeze explicitly:** current employment
materialization always assigns `legacy-<employeeId>` to original instances, while
its validator expects a captured `onboardingTemplateVersion` marker to agree.
New recruiting hires made while employment extension is absent still know their
captured checklist. Recommend a root-owned materialization adapter taking the
validated recruiting hire facts: it preserves the known version/tasks and emits
the original employment hire binding with `startDate: null`/event date null when
no employment date was chosen. It uses the recorded original native hire actor
from the binding; it invents no actor, approval or date. This occurs only on the
next meaningful action that already materializes employment, never on read or
recruiting adoption. Existing pre-recruiting legacy hires keep the current
legacy template contract. This adapter and all four combination transitions need
literal tests before the shared type contract is considered complete.

## 7. Private preview binding and latest-state API

### Alternatives evaluated

| Mechanism | Evaluation |
| --- | --- |
| Existing JSON-stringified full state returned as confirmation | Reject for recruiting. It directly exposes hidden HR/private scorecard payloads to scoped components and DOM/debug consumers. |
| Unkeyed SHA-256 digest returned to component | Better than serialization, but a low-entropy private comment could be guessed offline against known state; async WebCrypto also adds a source-change race unless confirmation rechecks inside the commit. Not recommended as the public token. |
| Async keyed HMAC, private random key, opaque public tag | Viable with WebCrypto and careful freshness recheck after every await. Adds async scheduling and cancellation complexity; no dependency is needed, but it is unnecessary for this local bounded workflow. |
| Random handle with private ephemeral binding table | **Recommended.** Synchronous latest-state commit fits the existing persistence handle, while a public random handle contains no source bytes or reversible digest. |

The recommendation requires no new dependency. A browser-safe controller creates
a 256-bit unpredictable handle with `crypto.getRandomValues`; unavailable secure
randomness refuses preview with a safe message. Never fall back to counters,
timestamps, `Math.random` or source-derived text for the handle.

Privately bind each handle to a cloned normalized command, actor identity/mode,
replacement epoch and mode generation, complete canonical JSON source, raw
fixture facts, and prospectively allocated record IDs. Canonical serialization
includes every saved HR field and private event, preserves array order, rejects
unsupported values and is bounded by the existing save budget. Store those
facts in an unexported closure. Do not expose the binding table, source string,
private error/candidate state or a debugging getter to any component/global.

Caps: at most 8 live handles, a 10-minute monotonic session TTL, and at most
4,000,000 captured source characters across bindings. Evict oldest handles
before issuing a new one, with later confirmation receiving a generic expired/
stale message. Expiry affects only temporary previews, never domain timestamps.
Refresh, accepted replacement, mode/identity change and controller disposal clear
bindings. Successful confirmation consumes its handle; cancellation consumes
only that handle. Any failed confirmation invalidates that handle and preserves
typed input; re-preview explicitly to retry. No handle is persisted, exported,
displayed, put in an HTML attribute, URL, log or status message.

### Scoped API

```ts
type PreviewHandle = string & { readonly __opaquePreviewHandle: unique symbol }
type SafeRefusal = { ok: false; code: 'unavailable'|'invalid'|'stale'|'limit'; message: string }
type PublicPreview =
  | ManagementRecruitingPreview // authorized requisition/application/hire facts
  | OwnScorecardPreview // own content/context only; no other saved draft metadata
type PreviewResult = SafeRefusal | { ok: true; handle: PreviewHandle; preview: PublicPreview }
type CommandResult = SafeRefusal | { ok: true; feedback: string; view: ScopedRecruitingView }

type ScopedRecruitingView =
  | { mode: 'management'; jobs: JobView[]; requisitions: RequisitionView[];
      people: PersonView[]; applications: ApplicationView[];
      interviews: ManagementInterviewView[]; submittedScorecards: SubmittedScorecardView[];
      publicActivity: PublicRecruitingActivity[] }
  | { mode: 'interviewer'; employeeId: Id; assignedInterviews: OwnInterviewView[] }

type RecruitingController = {
  view(options?: { observedAt?: UtcInstant }): ScopedRecruitingView | SafeRefusal
  preview(command: RecruitingCommand): PreviewResult
  confirm(request: { kind: RecruitingCommand['kind']; handle: PreviewHandle }): CommandResult
  cancel(handle: PreviewHandle): void
}

// Private adapter supplied only by the trusted shell/provider integration:
type RecruitingControllerAdapter = {
  readCurrent(): HrDemoState
  readActor(): RecruitingActor
  readEpoch(): number
  readModeGeneration(): number
  readRawFixture(): HrFixture
  replaceCurrent(build: (latest: HrDemoState) => HrDemoState): boolean
  randomBytes(length: number): Uint8Array
  monotonicNow(): number
}
// createRecruitingController(adapter) returns RecruitingController;
// scoped children NEVER receive adapter, readCurrent or replaceCurrent.
```

Concrete DTO field proposal (all arrays are fresh copies; no getters/references
back to source objects):

```ts
type JobView = {
  id: Id; title: string; department: string; managerEmployeeId: Id
  state: LifecycleJob['state']; revision: number; requisitionId: Id|null
  publication: { kind: 'none' } | { kind: 'legacy-unrecorded' } | { kind: 'captured'; publicationId: Id }
}
type RequisitionView = RecruitingRequisition & { approvals: RequisitionApproval[] }
type PersonView = { id: Id; firstName: string; lastName: string; workEmail: string; hiredEmployeeId: Id|null }
type PublicStageInterval = {
  stage: ApplicationStage; enteredAt: UtcInstant|null; exitedAt: UtcInstant|null
  durationMs: number|null; boundary: 'known'|'unknown-legacy'|'open'
}
type ApplicationView = {
  id: Id; personId: Id; jobId: Id; stage: ApplicationStage
  stageEnteredAt: UtcInstant|null; intervals: PublicStageInterval[]
  outcomeReason: string|null; hiredEmployeeId: Id|null
}
type ManagementInterviewView = {
  id: Id; applicationId: Id; startAt: UtcInstant; timeZone: string
  durationMinutes: number; participants: { employeeId: Id; displayName: string }[]
}
type SubmittedScorecardView = {
  id: Id; applicationId: Id; interviewId: Id; authorEmployeeId: Id
  revision: number; content: ScorecardContent; submittedAt: UtcInstant
}
type OwnInterviewView = {
  id: Id; startAt: UtcInstant; timeZone: string; durationMinutes: number
  candidate: { displayName: string }
  application: { id: Id; stage: ApplicationStage }
  job: { id: Id; title: string }
  ownScorecard: { id: Id; revision: number; state: 'draft'|'submitted'; content: ScorecardContent }|null
  lastOwnRecordedAt: UtcInstant|null // this interview/author's only time floor
  ownHistory: { kind: 'saved'|'submitted'; recordedAt: UtcInstant; revision: number }[]
}
type PublicRecruitingActivity = {
  kind: 'adopt'|'person-created'|'application-created'|'application-stage'
    |'requisition-changed'|'requisition-reviewed'|'job-changed'|'job-published'
    |'interview-scheduled'|'scorecard-submitted'|'hired'
  recordedAt: UtcInstant; applicationId?: Id; jobId?: Id; requisitionId?: Id
  description: string // allowlisted facts only, never generated from hidden drafts
}
type OwnScorecardPreview = {
  interviewId: Id; applicationId: Id; authorEmployeeId: Id
  content: ScorecardContent; recordedAt: UtcInstant
  ownChronologyFloor: UtcInstant|null // only the selected pair's prior own event
} & (
  | { kind: 'save-scorecard'; previousRevision: number|null; proposedRevision: number; proposedState: 'draft' }
  | { kind: 'submit-scorecard'; scorecardId: Id; draftRevision: number; proposedRevision: number; proposedState: 'submitted' }
)
type ExactHireCreation = {
  employee: HrEmployee; onboarding: MockOnboarding
  profile: { employeeId: Id; workEmail: string }
  status: { employeeId: Id; value: 'onboarding' }
  balance: { employeeId: Id; vacation: number; sick: number }
  employment: { instance: HrEmploymentInstance; event: HrLifecycleEvent }|null
}
type ManagementRecruitingPreview = {
  kind: Exclude<RecruitingCommand['kind'], 'save-scorecard'|'submit-scorecard'>
  recordedAt: UtcInstant
  // Only facts already authorized in this management recruiting view:
  changedPeople: PersonView[]; changedApplications: ApplicationView[]
  requisition: RequisitionView|null; job: JobView|null
  conflict: { kind: 'person'|'employee'|'application'; id: Id; displayName: string }|null
  interview: ManagementInterviewView|null; hire: ExactHireCreation|null
  warnings: string[]
}
```

An authorized duplicate conflict is a non-confirmable preview result, not an
accepted create action: extend `PreviewResult` with `{ok:false, code:'conflict',
conflict: ManagementRecruitingPreview['conflict'], message:string}` for native
owner/HR only. It carries no handle. Explicitly selecting the existing person
then requests a separate `add-person-application` preview. Interviewer never
receives this variant or the management preview union at runtime; its narrowed
controller port accepts only save/submit and returns only own-scorecard data.
Submission previews show the exact own saved revision/content being submitted;
`draftRevision` and `proposedRevision` are equal. The controller's private handle
binding additionally captures the resolved `draftEventId`; no new public command
parameter, source timestamp maximum or global-event identifier is required.

Authorization happens before lookup: first validate current actor and requested
action family; then build its authorized application/interview/scorecard index
privately; target lookup occurs only in that authorized index. Unknown and
unauthorized interviewer targets return the same fixed message, with no echoed
IDs, names, existence differences or hidden validation paths. Owner/HR can get
authorized candidate conflict detail. Interviewer cannot request that command.

At confirmation, validate actor/action family before handle lookup, then require
the handle's actor/mode/kind/epoch/generation to match. Inside the existing
synchronous `replaceCurrent(latest => ...)` callback, compare complete current
source and raw fixture to the private binding, rerun domain authorization and
all candidate validation, build exactly one complete candidate and return it.
No preceding view check substitutes for that inside-commit comparison. The
scoped component supplies no callback receiving `latest`. If the updater never
runs or refuses, report failure and retain its dirty baseline. Success means
accepted memory; persistence failure retains the existing visible storage
warning/export behavior, not a false model refusal.

This is local component privacy and race protection, not cryptographic
protection from the person controlling the browser. The random handle prevents
the preview API itself from disclosing or supporting guesses about hidden text.
It grants no account authority.

## 8. Projection privacy and interviewer shell composition

`OwnInterviewView` contains only assigned interview ID/time/zone/duration,
minimum candidate display name and application/job context, and that author's
own scorecard/content/history. It contains no full employee fixture, employee
email, compensation, payroll, other applications or another author's scorecard.
Shared participants do not grant draft access. Owner/HR hiring review receives
submitted cards, never another author's drafts or draft-save events.

Do not return global recruiting sequence, an application-wide event-time maximum,
hidden draft counts, private validation paths or private-event gaps in scoped
activity DTOs. Public timeline rows use safe stage facts and local display
ordinals rather than global event sequence. `lastStageRecordedAt` describes only
public stage events; its known current value is already reflected by the public
`stageEnteredAt`. The interviewer receives only `lastOwnRecordedAt` and its own
history as the selected interview/author's chronology floor. It receives no
globally sequenced draft-event IDs or another author's save/submission timestamps.

Neither timestamp prefilling nor validation consults another author's private
stream. There is no hidden lower bound to explain through a generic chronology
error: only an invalid timestamp or that author's own earlier timestamp can
cause its chronology refusal. An unrelated private save can still stale an
already-issued full-source-bound handle. That uses the existing generic stale
result; a fresh preview with the same valid own timestamp must succeed when no
other domain prerequisite changed. Staleness must not silently advance a time
field, create a cross-author chronology constraint or disclose the changed data.

At `/hr/demo/admin/recruiting`, the trusted shell owns a volatile native versus
interviewer mode and selected fictional interviewer. Entering/switching/exiting
uses existing scoped unsaved-work decisions. The selector is explicitly a local
preview control. No mode/role is read from an import, URL or account claim.

Recommended render split:

```text
Trusted HR provider / command-controller owner (full state kept private)
  native mode -> existing management HR shell + recruiting management DTO
  interviewer mode -> RecruitingInterviewerShell(scoped view, controller port)
```

Choose the branch before rendering ordinary HR navigation, management/employee
selectors, directory, payroll, dashboards, help requests, global HR workflow
feedback or complete backup controls. Unmount those components in interviewer
mode; CSS hiding is insufficient. The outer layout/breadcrumb integration also
uses neutral recruiting chrome while that mode is active, with an explicit
**Leave interviewer preview** and neutral portal exit. No links into owner
payroll/directory navigation are rendered. Exiting can restore the prior native
preview after the dirty decision; it does not cast an interviewer into HrActor.

Native seven-role and 64-route contracts remain unchanged. Shared provider state
can stay mounted internally, but no scoped component receives full HR state or
unrelated error/status props. Source-contract tests and actual DOM/accessibility
tree assertions must verify composition as well as the pure projection.

Saved private scorecards and events exist in the complete HR save and deliberate
complete export. Disclose this at preview selection and export entry. Offer no
full-workspace download inside the interviewer shell; explain that leaving the
mode opens the ordinary complete-workspace tools. Shared recovery inspection is
the explicit metadata exception: bounded safe IDs/counts/status/revisions with
exact omission counts can cover all collections. It still hides names, emails,
ratings, comments, reasons and private event bodies. Complete hidden content
participates in differences. Recovery controls are not mounted in interviewer
mode and are not an alternate scoped data API.

## 9. Concrete proposed bounds

| Item | Cap/validation |
| --- | --- |
| Jobs / requisitions | 50 each; new title 3–100, department 2–80 printable characters; revision 1..1000. |
| People | 200; first/last name 2–60; trimmed lowercase .invalid email 5–160; unique normalized email among people; explicit directory collision refusal. |
| Applications | 400 total, at most 8 per person, one per person/job; no automatic closure/withdrawal of other apps after a hire. |
| Approval/publication captures | 500 approvals / 50 publication captures; no silent pruning. |
| Interviews | 200 total, 10 per application; 1–5 distinct supported employee participants; 15–240 whole minutes. |
| Scorecards | One per interview/author; 1000 total; revision 1..1000; exact three rubric ratings, integers 1–5; trimmed fictional comments 3–2000. |
| Domain events | 6000 total, 200 per application; exact append-only replay with contiguous accepted sequence; no retention pruning. |
| Reasons | 2–500 printable characters; required for rejection/withdrawal and requisition rejection/review outcome. |
| Time | Exact valid UTC millisecond form, no offsets/coercion/invalid calendar dates; equality allowed within each application stage stream and each interview/author scorecard stream; no cross-stream/global ordering; named zone and meeting start separately validated. |
| Workspace | Existing complete save/backup limits remain. Preview candidate checks the actual complete save-envelope size before acceptance; hitting any cap refuses the entire command with no partial record or counter consumption. |

Cap messages to an interviewer must not disclose another author's draft counts
or payload sizes. Use a safe generic local-capacity message; detailed complete
workspace inspection belongs only to the disclosed recovery metadata surface.
Malformed-present validation enforces these caps and strict field allowlists.

## 10. Staged disjoint ownership after review

Agent 0 dispatches the lanes explicitly after the shared types/API checkpoint.
One dedicated core owner freezes the shared interface before consumers edit:

| Stage/lane | Exclusive proposed files | Contract |
| --- | --- | --- |
| 0 — Shared core owner | New recruiting-lifecycle-types, adoption/application/event replay, controller binding/projection modules and focused core tests | Sole shared types, source authority, command dispatcher, random-handle table and safe errors. Freeze before parallel consumers. |
| 1A — Requisitions | New requisition reducer/helper/component and tests | Pure handlers over frozen contract; immutable approval/publication captures. No dispatcher/type/persistence edits. |
| 1B — Interview/scorecards | New interview/scorecard handlers/components and tests | Safe author projection; no full-state props/callbacks, no new portable role. Core owner integrates handler exports serially. |
| 1C — People/application UI | New person/application/conflict/timeline component and tests | Consume scoped management DTOs and controller; no second reducer or legacy writes. |
| 1D — Hire summary | New hiring-preview projection/component and tests | Exact candidate records from one core transaction; no independent hire mutation. |
| 2 — Persistence/recovery owner | HR validator, new recruiting strict validator, inspection + codec/diff tests | Switch absent/present rules explicitly; replay/cross-links and all four extension combinations. Ownership handed off after core type freeze. |
| Agent 0 — Existing integration | recruiting.ts/link, mock-workflows employment materialization, existing HrRecruiting/HrWorkspace/HrPage/layout/chrome/router hooks | Legacy dispatch, controller host, effective fixture, shell split, source bindings, package/docs/catalog/Git. Serialize these shared changes. |
| 3 — Independent browser/evidence | New recruiting suite/runner and dated receipt | Actual controls, scoped props/DOM privacy, independent literal records, owned processes; run only after runtime freeze. |

Required review/acceptance cases include: explicit adoption/no-adoption legacy
commands; malformed present extension; candidate/activity/raw-hire preservation;
two jobs for one person; duplicate and unauthorized conflict privacy; new person
hire once while another application remains byte-identical; all four extension
combinations and later employment materialization; requisition owner versus
manager, headcount above/below hires without quota semantics; unknown legacy
publication approval; stale revision/capture refusal; equal and backward public
stage times per application, unknown intervals and no global chronology; same
interview authors A/B with A's hidden 2030 save and B's valid 2026 save/submit;
independent interviews for one author; own-stream equal timestamps accepted and
backward timestamps refused; public stage transitions unaffected by private
future saves; submission links latest own valid draft and preserves revision/
stage-entry/duration; other-author/old-draft/missing-draft/cursor forgeries refused;
future meeting starts and scheduling times independent from both event streams;
invalid named zones; own scorecard draft/save/submit and hidden draft-event/error/
summary exclusion; unrelated hidden changes stale an old handle but a fresh
preview with the same own time remains valid; random handle source/actor/kind/epoch/expiry/replay/eviction
and cross-controller refusal; latest-state commit race; no full-state callback
or serialized token in scoped props/DOM/logs; strict import/replay/receipt/graph
forgeries; complete export/restore/Undo with hidden draft changes and bounded
metadata exception; dirty Keep/Discard, 390px Extra large layout and exact saved
bytes after refusals. Browser observations, pure fixtures and acceptance remain
separate evidence. No provider/calendar/email delivery is in this slice.

## 11. Exact chronology refinement for final contract review

Agent 0 accepted explicit adoption, authoritative extension jobs/people/
applications, immutable legacy/capture records, the private random-handle
controller, restricted interviewer shell and provenance-aware later employment
materialization. This revision changes only the chronology contract before the
final type/API freeze:

1. Replace application `lastRecordedAt` with replay-derived
   `lastStageRecordedAt`. Only application creation, stage transition and hiring
   advance it or `stageEnteredAt`. Unknown legacy baselines keep both null.
2. Add scorecard `lastOwnRecordedAt` and `latestDraftEventId`. Saves/submission
   advance only the `(interviewId, authorEmployeeId)` stream; another author,
   interview, scheduling event or public stage event never changes its bound.
3. Add exact saved-event revision continuity and an explicit submission-event
   `draftEventId` plus matching interview/application/author/card/revision links.
   Submission has its own event time, preserves saved content/revision and never
   changes stage entry. Draft history stays author-private after submission.
4. Keep save/submit command signatures and the private random-handle controller
   shape. Resolve and bind submission's latest draft event privately. Project
   only the author's own time floor/revision/content; do not expose global event
   IDs, hidden maxima or other authors' draft/submission timestamps.
5. Keep meeting `startAt` distinct from scheduling `recordedAt`. Global sequence
   defines accepted causal replay order, with no global or cross-stream timestamp
   ordering. Duration queries use only public stage boundaries and an explicit
   observation instant.
6. Add independent replay/privacy regressions for interleaved authors/times,
   independent interviews, unchanged stage metrics, exact draft submission links,
   forged cursors and refresh-after-stale with unchanged valid own timestamps.

Final contract approval and lane dispatch remain pending. This temporary file is
the sole changed artifact; no tracked implementation or acceptance is claimed.

## 12. Final Agent 0 integration decisions

These decisions resolve the independent source audit. They are implementation
requirements, without supplying new test or browser observations.

### Immutable adopted hires

The adoption envelope and its event contain exact `legacyHiredEmployees` in
addition to jobs, candidates and legacy sequence. Derive adopted hire bindings
from that captured array and the original candidate links. The ordinary
`hiredEmployees` collection must preserve that exact prefix, followed only by
captures produced by new authoritative hire events. Do not anchor raw immutable
hire captures to today's overlaid employee values. Legacy raw jobs/candidates/
activity/sequence remain frozen throughout extension commands.

Every new hire binding also records immutable employment-at-hire provenance:

```ts
type EmploymentAtRecruitingHire =
  | { kind: 'absent' }
  | { kind: 'created'; instanceId: Id; hireEventId: Id }
```

Adopted legacy bindings capture their actual known links separately. An absent
employment extension at adoption is not proof that an old hire had no history;
never rewrite old provenance into a new created-hire claim.

### First-instance baseline when employment is materialized later

A new recruiting hire created while employment history was absent can complete
ordinary onboarding before employment is materialized. Introduce an explicit
`recruiting-baseline` provenance arm for its **original instance 1 only**, without
a previous instance. Bind the authoritative new recruiting hire ID and its
`employmentAtHire.kind === 'absent'`; record the exact pre-materialization
onboarding flags/receipt, captured checklist version/tasks and initial assignment
from the immutable raw hire. Historical completion actor and date are explicitly
unknown. Do not manufacture employment hire/completion events or template
selection events for pre-capture history.

Initial active status requires a genuinely complete captured onboarding checklist,
both reviews and valid completion receipt. Otherwise initial status is onboarding.
Replay derives this status from the baseline payload and checks all links; it
never trusts an arbitrary current active flag. Include baseline instances in
the initial reporting graph. Subsequent onboarding completion uses the ordinary
post-materialization event rules. Rehires and employment-present new hires retain
all existing initial-onboarding/hire/completion requirements. A baseline cannot
be applied to them. Existing pre-extension legacy hires retain their prior
legacy template rules.

Both materialization entry points must receive explicit validated recruiting
provenance: `initialLifecycle` in lifecycle actions and the first meaningful
ordinary `change-profile`. Use a root-owned full-state adapter or explicit
provenance parameter, inside the same accepted transaction. Recruiting adoption
alone and reads never materialize employment. Preserve all four optional-
extension combinations and later transitions with literal complete-record tests.

### Current eligibility and historical replay

Validate new management commands against the current effective fixture and
existing supported manager eligibility. Historical replay validates captured
actor/action pairs, stable identities, immutable content and links, without
requiring the captured manager/owner/participant to remain active or retain a
team today. Recruiting sequence alone cannot reconstruct separately changing
employment history. No new historical eligibility claim is inferred.

An interviewer is a known, assigned fictional employee identity. Current
employment status does not remove historical own cards or silently rebind the
selected identity. This compatible identity rule does not grant broader role or
account authority. Invalid/unknown/unassigned targets share the same safe refusal.

### Publication absence and explicit duration observation

`JobView.publication` includes `{ kind: 'none' }` for an unpublished draft. Only
an actually captured historical legacy publication may say `legacy-unrecorded`.
New publication requires the immutable approved requisition capture.

`controller.view(options?: { observedAt?: UtcInstant })` accepts an optional
explicit observation instant. Without it, known closed stage intervals retain
their recorded durations and an open interval's duration is unknown. With it,
validate the instant against that application's public stage cursor only.
Never infer observation from `Date.now`, scheduled meeting start or hidden
scorecard timestamps. The management UI exposes the explicit observation input.

### Finite recovery inspection manifest

Preserve exact legacy reports when the extension is absent. Classify these ten
optional collections as primary records, keyed by their stable `id`:

| Collection prefix | Safe default metadata |
| --- | --- |
| `recruiting.lifecycle.people` | ID and provenance kind; no names/email. |
| `recruiting.lifecycle.applications` | ID, person/job IDs, stage, known UTC stage dates, hire-binding ID. |
| `recruiting.lifecycle.requisitions` | ID, revision, state, owner ID, headcount, approval ID; no department text. |
| `recruiting.lifecycle.approvals` | ID, requisition/revision/event IDs, UTC instant and bounded actor metadata. |
| `recruiting.lifecycle.jobs` | ID, revision, state, manager/requisition/publication IDs; no title/department. |
| `recruiting.lifecycle.publications` | ID, job/revision/approval/event IDs and UTC instant. |
| `recruiting.lifecycle.interviews` | ID, application/participant IDs, UTC start, named zone, duration and event ID. |
| `recruiting.lifecycle.scorecards` | ID, interview/application/author IDs, revision, state, rubric version and known own/submission linkage; no ratings/comments. |
| `recruiting.lifecycle.hireBindings` | ID, person/application/employee IDs, provenance kind, checklist version and employment-at-hire kind/link IDs. |
| `recruiting.lifecycle.events` | ID, sequence, kind, UTC instant, bounded actor and known object-reference IDs; no reason/draft/rating/content bodies. |

The extension's sequence/adoption provenance is one bounded metadata record.
Adoption copies, event-embedded snapshots, hire-embedded employee/checklist data
and captured requisition/publication content are nested captures, not additional
primary people/jobs/hires. Fingerprints include every retained byte of those
hidden records and private histories; differences detect rubric/comment/reason
changes without rendering them. No silent pruning or invented empty arrays.

Add dedicated safe recruiting actor-union and canonical UTC-instant metadata
validators; do not broaden the existing date-only or HrRole-only helpers.
Optional comparison ordering explicitly includes `recruiting.lifecycle.*`, and
both directions/reorder stability/hidden changes/legacy exact hashes remain tested.
This recovery metadata is a disclosed exception outside the interviewer shell,
whose components receive neither full workspace tools nor the inspection adapter.

### Adopted employment-link capture

Created hire bindings have non-null `employmentAtHire` (`absent` or exact
`created` links) and `legacyEmploymentLinks: null`. Adopted bindings instead
have `employmentAtHire: null` plus explicit nullable legacy link fields. Capture
an ordered `legacyHireLinks` row for every raw legacy hired employee in the
adoption payload/event. Replay derives adopted bindings from these immutable
adoption facts. Non-null links must refer to the matching retained historical
employment instance/event. Null means unrecorded; later materialization cannot
retroactively change it into proof that employment was absent at hire.

### Explicit adoption and literal management legacy activity

The current [command core](../src/hr/recruiting-lifecycle.ts) requires a separate
`adopt` preview/confirm command. No first meaningful ordinary action, read or
preview implicitly materializes recruiting history. This does not change the
separate employment materialization rules above.

Management `ApplicationView.legacyActivity` retains literal native
`{ receipt, action, actorRole }` rows in their original order. Before adoption,
the [projection](../src/hr/recruiting-lifecycle-projection.ts) copies the existing
candidate's activity; afterward it copies the matching candidate activity from
the immutable adoption capture. It does not convert these rows into new domain
events or infer a timestamp from a receipt, sequence or adoption date. The
[management UI](../src/hr/components/HrRecruitingApplications.tsx) labels their
recorded UTC time as unknown legacy time. Interviewer DTOs do not gain this
management history field or another author's private draft history.

### Deterministic scorecard identity for the public pair

The [interview handler](../src/hr/recruiting-interviews.ts) derives a first
scorecard's ID only from `JSON.stringify([interviewId, employeeId])` encoded as
UTF-8. It applies FNV-1a with offset `0xcbf29ce484222325`, prime
`0x100000001b3` and unsigned 64-bit truncation after each XOR/multiply. The ID is
`rscorecard-` plus 16 lowercase hexadecimal digits, padded with leading zeros.
Later revisions preserve that ID. Another record already using the derived ID
causes refusal rather than reuse or a different allocator.

The assigned interview/author pair is the sole identity input. Global sequence,
another author's draft count or time, email and scorecard content are not inputs.
This ordinary stable identifier is not a credential, secrecy hash or preview
handle; authorization still checks the selected known, assigned author before
lookup and projection.

### Controller lifetime handle bound

The [controller](../src/hr/recruiting-controller.ts) allocates at most **4,096
distinct handle strings per controller lifetime**, tracked by its private
`issued` set. Consuming, canceling, expiring, evicting or clearing a live binding
does not allow a previously allocated string to be reused or lower that lifetime
count. Reaching the cap refuses a new preview with the safe instruction to save
current work before reloading. `dispose()` clears the sets and permanently makes
that controller unavailable; it does not reactivate the disposed instance.

This lifetime cap is separate from the eight retained live bindings, ten-minute
expiry and combined 4,000,000-character binding budget. Preview handles remain
ephemeral and outside portable domain records; a random handle grants no account
or provider authority.

### Current directory email checks and historical profile corrections

New person creation and hire planning use the current effective directory from
`effectiveWorkflowFixture`, including `workflow.profileEmails`, to refuse an
existing employee email. The [hire adapter](../src/hr/recruiting-hire.ts) checks
the same effective fixture; raw immutable employee-at-hire email is not today's
eligibility source. Normalized uniqueness among recruiting people remains a
separate invariant.

[Historical replay](../src/hr/recruiting-lifecycle-replay.ts) does not apply
today's corrected directory email to an older `person-created` event. Recruiting
sequence cannot reconstruct another domain's historical email corrections.
Replay still validates captured people, exact hire snapshots, identities and
event links. For a new authoritative hire,
[cross-domain validation](../src/hr/recruiting-lifecycle-validation.ts) preserves
the raw hire email and anchors any later directory-history chain at that
captured value; without such history the profile email must match it.
Current corrections neither rewrite the original hire nor retroactively
invalidate a previously valid recruiting identity fact.

### Generic boolean dependency for shared chrome

[Shared layout](../src/components/layout/Layout.tsx) depends only on the generic
[ScopedPortalChrome](../src/portals/ScopedPortalChrome.tsx) boolean context. It
receives no HR actor, interviewer employee ID, recruiting controller, full state
or role capability. The [HR preview provider](../src/hr/RecruitingPreviewProvider.tsx)
owns volatile selection, mode generation, route scope and dirty-transition
coordination, and supplies only `active` to the generic chrome provider.

That boolean chooses the minimal shared presentation. Known/assigned identity
checks, scoped data projection and command authorization remain with the trusted
HR owner and controller. Hiding ordinary chrome is not itself authorization,
provider isolation or an authenticated role.
