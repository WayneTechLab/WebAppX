import type { HrActor, HrEmployee, HrFixture } from './model'
import type { RecruitingActivity, RecruitingCandidate, RecruitingJob, RecruitingState } from './recruiting'
import type { HrDemoState } from './persistence'
import type { MockOnboarding } from './mock-workflows'
import type { HrEmploymentInstance, HrLifecycleEvent } from './lifecycle-types'

/** Frozen recruiting contract. Portable facts are separate from private controller bindings. */
export type Id = string
export type UtcInstant = string // exactly YYYY-MM-DDTHH:mm:ss.sssZ; round-trip valid
export type RecruitingActor =
  | { mode: 'native'; actor: HrActor }
  | { mode: 'interviewer'; employeeId: Id }

export type ApplicationStage =
  | 'applied' | 'screening' | 'interview' | 'offer'
  | 'hired' | 'rejected' | 'withdrawn'

export type RecruitingPerson = {
  id: Id
  firstName: string
  lastName: string
  workEmail: string // trimmed/lowercase .invalid; identity is NOT this string
  provenance:
    | { kind: 'legacy'; candidateId: Id }
    | { kind: 'created'; eventId: Id }
}

export type RecruitingApplication = {
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

export type RequisitionContent = {
  department: string
  ownerEmployeeId: Id // independent from job.managerEmployeeId
  headcount: number // integer 1..50, recorded planning value, NOT a hiring quota
}
export type RecruitingRequisition = {
  id: Id
  revision: number
  content: RequisitionContent
  state: 'draft' | 'in-review' | 'approved' | 'rejected'
  currentApprovalId: Id | null
}
export type RequisitionApproval = {
  id: Id
  requisitionId: Id
  revision: number
  content: RequisitionContent
  eventId: Id
  actor: RecruitingActor
  recordedAt: UtcInstant
}

export type LifecycleJob = {
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
export type JobPublication = {
  id: Id
  jobId: Id
  jobRevision: number
  job: { title: string; department: string; managerEmployeeId: Id }
  requisitionApprovalId: Id
  eventId: Id
  actor: RecruitingActor
  recordedAt: UtcInstant
}

export type RecruitingInterview = {
  id: Id
  applicationId: Id
  participantEmployeeIds: Id[]
  startAt: UtcInstant // meeting start, may be later than recordedAt
  timeZone: string // supported named IANA zone, or UTC; no numeric offset alias
  durationMinutes: number
  createdEventId: Id
}
export type ScorecardContent = {
  rubricVersion: 'sample-interview-v1'
  ratings: { roleUnderstanding: number; collaboration: number; problemSolving: number }
  comments: string // fictional, bounded; private until explicit submit
}
export type RecruitingScorecard = {
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

export type RecruitingHireBinding = {
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
  employmentAtHire: EmploymentAtRecruitingHire | null
  legacyEmploymentLinks: { instanceId: Id | null; hireEventId: Id | null } | null
}

export type RecruitingLifecycleV1 = {
  schemaVersion: 1
  sequence: number // next event; contiguous accepted event order only
  adoption: {
    eventId: Id
    actor: RecruitingActor
    recordedAt: UtcInstant
    legacyJobs: RecruitingJob[]
    legacyCandidates: RecruitingCandidate[]
    legacyHiredEmployees: HrEmployee[]
    legacyHireLinks: { employeeId: Id; instanceId: Id | null; hireEventId: Id | null }[]
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

export type RecruitingCommand =
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

export type EventBase = { id: Id; sequence: number; actor: RecruitingActor; recordedAt: UtcInstant }
export type RecruitingDomainEvent = EventBase & (
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

export type PreviewHandle = string & { readonly __opaquePreviewHandle: unique symbol }
export type SafeRefusal = { ok: false; code: 'unavailable'|'invalid'|'stale'|'limit'; message: string }
export type PublicPreview =
  | ManagementRecruitingPreview // authorized requisition/application/hire facts
  | OwnScorecardPreview // own content/context only; no other saved draft metadata
export type ConflictResult = { ok: false; code: 'conflict'; conflict: NonNullable<ManagementRecruitingPreview['conflict']>; message: string }
export type PreviewResult = SafeRefusal | ConflictResult | { ok: true; handle: PreviewHandle; preview: PublicPreview }
export type CommandResult = SafeRefusal | { ok: true; feedback: string; view: ScopedRecruitingView }

export type ScopedRecruitingView =
  | { mode: 'management'; jobs: JobView[]; requisitions: RequisitionView[];
      people: PersonView[]; applications: ApplicationView[];
      interviews: ManagementInterviewView[]; submittedScorecards: SubmittedScorecardView[];
      publicActivity: PublicRecruitingActivity[] }
  | { mode: 'interviewer'; employeeId: Id; assignedInterviews: OwnInterviewView[] }

export type RecruitingController = {
  view(options?: { observedAt?: UtcInstant }): ScopedRecruitingView | SafeRefusal
  preview(command: RecruitingCommand): PreviewResult
  confirm(request: { kind: RecruitingCommand['kind']; handle: PreviewHandle }): CommandResult
  cancel(handle: PreviewHandle): void
  clear(): void
  dispose(): void
}

// Private adapter supplied only by the trusted shell/provider integration:
export type RecruitingControllerAdapter = {
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

export type JobView = {
  id: Id; title: string; department: string; managerEmployeeId: Id
  state: LifecycleJob['state']; revision: number; requisitionId: Id|null
  publication: { kind: 'none' } | { kind: 'legacy-unrecorded' } | { kind: 'captured'; publicationId: Id }
}
export type RequisitionView = RecruitingRequisition & { approvals: RequisitionApproval[] }
export type PersonView = { id: Id; firstName: string; lastName: string; workEmail: string; hiredEmployeeId: Id|null }
export type PublicStageInterval = {
  stage: ApplicationStage; enteredAt: UtcInstant|null; exitedAt: UtcInstant|null
  durationMs: number|null; boundary: 'known'|'unknown-legacy'|'open'
}
export type ApplicationView = {
  id: Id; personId: Id; jobId: Id; stage: ApplicationStage
  stageEnteredAt: UtcInstant|null; intervals: PublicStageInterval[]
  outcomeReason: string|null; hiredEmployeeId: Id|null
  legacyActivity: RecruitingActivity[]
}
export type ManagementInterviewView = {
  id: Id; applicationId: Id; startAt: UtcInstant; timeZone: string
  durationMinutes: number; participants: { employeeId: Id; displayName: string }[]
}
export type SubmittedScorecardView = {
  id: Id; applicationId: Id; interviewId: Id; authorEmployeeId: Id
  revision: number; content: ScorecardContent; submittedAt: UtcInstant
}
export type OwnInterviewView = {
  id: Id; startAt: UtcInstant; timeZone: string; durationMinutes: number
  candidate: { displayName: string }
  application: { id: Id; stage: ApplicationStage }
  job: { id: Id; title: string }
  ownScorecard: { id: Id; revision: number; state: 'draft'|'submitted'; content: ScorecardContent }|null
  lastOwnRecordedAt: UtcInstant|null // this interview/author's only time floor
  ownHistory: { kind: 'saved'|'submitted'; recordedAt: UtcInstant; revision: number }[]
}
export type PublicRecruitingActivity = {
  kind: 'adopt'|'person-created'|'application-created'|'application-stage'
    |'requisition-changed'|'requisition-reviewed'|'job-changed'|'job-published'
    |'interview-scheduled'|'scorecard-submitted'|'hired'
  recordedAt: UtcInstant; applicationId?: Id; jobId?: Id; requisitionId?: Id
  description: string // allowlisted facts only, never generated from hidden drafts
}
export type OwnScorecardPreview = {
  interviewId: Id; applicationId: Id; authorEmployeeId: Id
  content: ScorecardContent; recordedAt: UtcInstant
  ownChronologyFloor: UtcInstant|null // only the selected pair's prior own event
} & (
  | { kind: 'save-scorecard'; previousRevision: number|null; proposedRevision: number; proposedState: 'draft' }
  | { kind: 'submit-scorecard'; scorecardId: Id; draftRevision: number; proposedRevision: number; proposedState: 'submitted' }
)
export type ExactHireCreation = {
  employee: HrEmployee; onboarding: MockOnboarding
  profile: { employeeId: Id; workEmail: string }
  status: { employeeId: Id; value: 'onboarding' }
  balance: { employeeId: Id; vacation: number; sick: number }
  employment: { instance: HrEmploymentInstance; event: HrLifecycleEvent }|null
}
export type ManagementRecruitingPreview = {
  kind: Exclude<RecruitingCommand['kind'], 'save-scorecard'|'submit-scorecard'>
  recordedAt: UtcInstant
  // Only facts already authorized in this management recruiting view:
  changedPeople: PersonView[]; changedApplications: ApplicationView[]
  requisition: RequisitionView|null; job: JobView|null
  conflict: { kind: 'person'|'employee'|'application'; id: Id; displayName: string }|null
  interview: ManagementInterviewView|null; hire: ExactHireCreation|null
  warnings: string[]
}

export type EmploymentAtRecruitingHire =
  | { kind: 'absent' }
  | { kind: 'created'; instanceId: Id; hireEventId: Id }

export type RequisitionCommand = Extract<RecruitingCommand, { kind: 'create-requisition' | 'edit-requisition' | 'request-requisition-review' | 'review-requisition' | 'create-job' | 'bind-job-requisition' | 'publish-job' | 'close-job' }>
export type InterviewCommand = Extract<RecruitingCommand, { kind: 'schedule-interview' | 'save-scorecard' | 'submit-scorecard' }>
export type RequisitionEvent = Extract<RecruitingDomainEvent, { kind: 'requisition-changed' | 'requisition-reviewed' | 'job-changed' | 'job-published' }>
export type InterviewEvent = Extract<RecruitingDomainEvent, { kind: 'interview-scheduled' | 'scorecard-saved' | 'scorecard-submitted' }>
export type RecruitingWithLifecycle = RecruitingState & { lifecycle: RecruitingLifecycleV1 }

/** Trusted pure domain ports. Components never receive these contexts. */
export type RecruitingPlanContext = {
  lifecycle: RecruitingLifecycleV1
  actor: RecruitingActor
  employees: readonly HrEmployee[]
  event(offset?: number): EventBase
  isTimeZoneSupported(zone: string): boolean
}
export type RecruitingReplayContext = {
  knownEmployeeIds: ReadonlySet<Id>
  isTimeZoneSupported(zone: string): boolean
}
export type RecruitingDomainHandler<C extends RecruitingCommand, E extends RecruitingDomainEvent> = {
  plan(command: C, context: RecruitingPlanContext): E[]
  replay(lifecycle: RecruitingLifecycleV1, event: E, context: RecruitingReplayContext): RecruitingLifecycleV1
}
export type RecruitingHireInput = {
  state: HrDemoState
  rawFixture: HrFixture
  actor: Extract<RecruitingActor, { mode: 'native' }>
  person: RecruitingPerson
  application: RecruitingApplication
  job: LifecycleJob
  event: EventBase
  hireBindingId: Id
}
export type RecruitingHireAdapter = {
  /** Build one pure full-state HR addition. Preserve the existing lifecycle until core appends its hire event. */
  build(input: RecruitingHireInput): { next: HrDemoState; binding: RecruitingHireBinding; creation: ExactHireCreation }
}
export type RecruitingCoreServices = {
  requisitions: RecruitingDomainHandler<RequisitionCommand, RequisitionEvent>
  interviews: RecruitingDomainHandler<InterviewCommand, InterviewEvent>
  hire: RecruitingHireAdapter
  /** Complete validator composed by the trusted host. Never invokes this dispatcher/controller. */
  validateCandidate(state: HrDemoState, rawFixture: HrFixture): boolean
  isTimeZoneSupported(zone: string): boolean
}
export type RecruitingControllerOptions = RecruitingControllerAdapter & { services: RecruitingCoreServices }
export type RecruitingManagementPort = RecruitingController
export type RecruitingInterviewerPort = {
  view(): Extract<ScopedRecruitingView, { mode: 'interviewer' }> | SafeRefusal
  preview(command: Extract<RecruitingCommand, { kind: 'save-scorecard' | 'submit-scorecard' }>): SafeRefusal | { ok: true; handle: PreviewHandle; preview: OwnScorecardPreview }
  confirm(request: { kind: 'save-scorecard' | 'submit-scorecard'; handle: PreviewHandle }): SafeRefusal | { ok: true; feedback: string; view: Extract<ScopedRecruitingView, { mode: 'interviewer' }> }
  cancel(handle: PreviewHandle): void
}
