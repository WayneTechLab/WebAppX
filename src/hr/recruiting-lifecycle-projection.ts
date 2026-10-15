import type { HrFixture } from './model'
import type { HrDemoState } from './persistence'
import type { ApplicationStage, ApplicationView, JobView, ManagementInterviewView, OwnInterviewView, PublicStageInterval, RecruitingActor, RecruitingApplication, RecruitingLifecycleV1, ScopedRecruitingView } from './recruiting-lifecycle-types'
import { assert, assertRecruitingActor, canonicalRecruitingJson, copyRecruiting, exactKeys, isRecruitingManager, recruitingEmployees, recruitingInstant } from './recruiting-lifecycle-value'

export function recruitingStageIntervals(life: RecruitingLifecycleV1, app: RecruitingApplication, observedAt?: string): PublicStageInterval[] {
  if (observedAt !== undefined) { recruitingInstant(observedAt); assert(app.lastStageRecordedAt === null || observedAt >= app.lastStageRecordedAt, 'Observation time precedes a recorded public stage boundary.') }
  let stage: ApplicationStage = app.provenance.kind === 'legacy' ? app.provenance.initialStage : 'applied'
  let enteredAt: string | null = app.provenance.kind === 'legacy' ? null : life.events.find(event => event.kind === 'application-created' && event.applicationId === app.id)?.recordedAt ?? null
  const intervals: PublicStageInterval[] = []
  const interval = (exitedAt: string | null) => ({ stage, enteredAt, exitedAt, durationMs: enteredAt === null || exitedAt === null ? null : Date.parse(exitedAt) - Date.parse(enteredAt), boundary: enteredAt === null ? 'unknown-legacy' as const : exitedAt === null ? 'open' as const : 'known' as const })
  for (const event of life.events) if ((event.kind === 'application-stage' || event.kind === 'hired') && event.applicationId === app.id) {
    intervals.push(interval(event.recordedAt)); stage = event.kind === 'hired' ? 'hired' : event.stage; enteredAt = event.recordedAt
  }
  const open = interval(null)
  if (enteredAt !== null && observedAt !== undefined) open.durationMs = Date.parse(observedAt) - Date.parse(enteredAt)
  intervals.push(open)
  return intervals
}
export function recruitingApplicationView(life: RecruitingLifecycleV1, app: RecruitingApplication, observedAt?: string): ApplicationView {
  const outcome = life.events.filter(event => event.kind === 'application-stage' && event.applicationId === app.id && (event.stage === 'rejected' || event.stage === 'withdrawn')).at(-1)
  const legacyId = app.provenance.kind === 'legacy' ? app.provenance.candidateId : null
  return { id: app.id, personId: app.personId, jobId: app.jobId, stage: app.stage, stageEnteredAt: app.stageEnteredAt, intervals: recruitingStageIntervals(life, app, observedAt), outcomeReason: outcome?.kind === 'application-stage' ? outcome.reason : null, hiredEmployeeId: life.hireBindings.find(hire => hire.id === app.hireBindingId)?.employeeId ?? null, legacyActivity: copyRecruiting(life.adoption.legacyCandidates.find(candidate => candidate.id === legacyId)?.activity ?? []) }
}
export function recruitingJobView(job: RecruitingLifecycleV1['jobs'][number]): JobView {
  return { id: job.id, title: job.title, department: job.department, managerEmployeeId: job.managerEmployeeId, state: job.state, revision: job.revision, requisitionId: job.requisitionId, publication: job.currentPublicationId ? { kind: 'captured', publicationId: job.currentPublicationId } : job.provenance.kind === 'legacy' && ['published', 'closed'].includes(job.provenance.initialState) ? { kind: 'legacy-unrecorded' } : { kind: 'none' } }
}
export function recruitingInterviewView(interview: RecruitingLifecycleV1['interviews'][number], employees: HrFixture['employees']): ManagementInterviewView {
  return { id: interview.id, applicationId: interview.applicationId, startAt: interview.startAt, timeZone: interview.timeZone, durationMinutes: interview.durationMinutes, participants: interview.participantEmployeeIds.map(employeeId => { const person = employees.find(employee => employee.id === employeeId); assert(person); return { employeeId, displayName: `${person.firstName} ${person.lastName}` } }) }
}

/** Fresh allowlisted DTOs only. Never return private event IDs/counters/history to another author. */
export function projectRecruitingView(state: HrDemoState, actor: RecruitingActor, raw: HrFixture, options: { observedAt?: string } = {}): ScopedRecruitingView {
  canonicalRecruitingJson(actor)
  assert(isRecruitingManager(actor) || actor?.mode === 'interviewer', 'This recruiting preview is unavailable.')
  exactKeys(options, [], ['observedAt']); if (options.observedAt !== undefined) recruitingInstant(options.observedAt)
  const employees = recruitingEmployees(raw.employees, state.recruiting.hiredEmployees)
  assertRecruitingActor(actor, new Set(employees.map(employee => employee.id)))
  const life = (state.recruiting as typeof state.recruiting & { lifecycle?: RecruitingLifecycleV1 }).lifecycle
  if (actor.mode === 'interviewer') {
    return { mode: 'interviewer', employeeId: actor.employeeId, assignedInterviews: (life?.interviews ?? []).filter(interview => interview.participantEmployeeIds.includes(actor.employeeId)).map(interview => {
      const app = life!.applications.find(item => item.id === interview.applicationId), person = life!.people.find(item => item.id === app?.personId), job = life!.jobs.find(item => item.id === app?.jobId)
      assert(app && person && job)
      const own = life!.scorecards.find(card => card.interviewId === interview.id && card.authorEmployeeId === actor.employeeId)
      const ownHistory = life!.events.flatMap<OwnInterviewView['ownHistory'][number]>(event => event.kind === 'scorecard-saved' && event.scorecard.authorEmployeeId === actor.employeeId && event.scorecard.interviewId === interview.id ? [{ kind: 'saved' as const, recordedAt: event.recordedAt, revision: event.scorecard.revision }] : event.kind === 'scorecard-submitted' && event.authorEmployeeId === actor.employeeId && event.interviewId === interview.id ? [{ kind: 'submitted' as const, recordedAt: event.recordedAt, revision: event.revision }] : [])
      return { id: interview.id, startAt: interview.startAt, timeZone: interview.timeZone, durationMinutes: interview.durationMinutes, candidate: { displayName: `${person.firstName} ${person.lastName}` }, application: { id: app.id, stage: app.stage }, job: { id: job.id, title: job.title }, ownScorecard: own ? { id: own.id, revision: own.revision, state: own.state, content: copyRecruiting(own.content) } : null, lastOwnRecordedAt: own?.lastOwnRecordedAt ?? null, ownHistory }
    }) }
  }
  assert(isRecruitingManager(actor))
  if (!Object.hasOwn(state.recruiting, 'lifecycle')) {
    return { mode: 'management', jobs: state.recruiting.jobs.map(job => ({ id: job.id, title: job.title, department: job.department, managerEmployeeId: job.managerId, state: job.status, revision: 1, requisitionId: null, publication: job.status === 'draft' ? { kind: 'none' } : { kind: 'legacy-unrecorded' } })), people: state.recruiting.candidates.map((candidate, index) => ({ id: `rperson-${String(index + 1).padStart(4, '0')}`, firstName: candidate.firstName, lastName: candidate.lastName, workEmail: candidate.workEmail, hiredEmployeeId: candidate.employeeId ?? null })), applications: state.recruiting.candidates.map((candidate, index) => ({ id: `rapplication-${String(index + 1).padStart(4, '0')}`, personId: `rperson-${String(index + 1).padStart(4, '0')}`, jobId: candidate.jobId, stage: candidate.stage, stageEnteredAt: null, intervals: [{ stage: candidate.stage, enteredAt: null, exitedAt: null, durationMs: null, boundary: 'unknown-legacy' }], outcomeReason: null, hiredEmployeeId: candidate.employeeId ?? null, legacyActivity: copyRecruiting(candidate.activity) })), requisitions: [], interviews: [], submittedScorecards: [], publicActivity: [] }
  }
  assert(life)
  return { mode: 'management', jobs: life.jobs.map(recruitingJobView), requisitions: life.requisitions.map(requisition => ({ ...copyRecruiting(requisition), approvals: copyRecruiting(life.approvals.filter(approval => approval.requisitionId === requisition.id)) })), people: life.people.map(person => ({ id: person.id, firstName: person.firstName, lastName: person.lastName, workEmail: person.workEmail, hiredEmployeeId: life.hireBindings.find(hire => hire.personId === person.id)?.employeeId ?? null })), applications: life.applications.map(app => recruitingApplicationView(life, app, options.observedAt)), interviews: life.interviews.map(interview => recruitingInterviewView(interview, employees)), submittedScorecards: life.scorecards.filter(card => card.state === 'submitted').map(card => { const event = life.events.find(item => item.id === card.submittedEventId); assert(event?.kind === 'scorecard-submitted'); return { id: card.id, applicationId: card.applicationId, interviewId: card.interviewId, authorEmployeeId: card.authorEmployeeId, revision: card.revision, content: copyRecruiting(card.content), submittedAt: event.recordedAt } }), publicActivity: life.events.flatMap(event => event.kind === 'scorecard-saved' ? [] : [{ kind: event.kind, recordedAt: event.recordedAt, ...('applicationId' in event ? { applicationId: event.applicationId } : {}), ...('jobId' in event ? { jobId: event.jobId } : {}), ...('requisitionId' in event ? { requisitionId: event.requisitionId } : {}), description: event.kind === 'application-stage' ? `${event.previousStage} → ${event.stage}${event.reason ? ` · ${event.reason}` : ''}` : event.kind.replaceAll('-', ' ') }]) }
}
