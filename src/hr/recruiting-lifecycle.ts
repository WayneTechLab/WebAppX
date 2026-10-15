import type { HrFixture } from './model'
import type { HrDemoState } from './persistence'
import { effectiveWorkflowFixture } from './mock-workflows'
import type { ApplicationStage, ConflictResult, ExactHireCreation, ManagementRecruitingPreview, OwnScorecardPreview, PublicPreview, RecruitingActor, RecruitingCommand, RecruitingCoreServices, RecruitingDomainEvent, RecruitingLifecycleV1, RecruitingPlanContext } from './recruiting-lifecycle-types'
import { applyRecruitingEvent, createRecruitingAdoption, recruitingEventId, replayRecruitingLifecycle } from './recruiting-lifecycle-replay'
import { projectRecruitingView } from './recruiting-lifecycle-projection'
import { assert, assertRecruitingActor, canonicalRecruitingJson, copyRecruiting, exactKeys, isRecruitingManager, nextRecruitingId, recruitingEmail, recruitingEmployees, recruitingInstant, recruitingText, refuse, sameRecruitingValue } from './recruiting-lifecycle-value'

export class RecruitingConflict extends Error { constructor(public readonly conflict: ConflictResult['conflict']) { super('That fictional identity or application already exists. Review the conflict before choosing a separate application.'); this.name = 'RecruitingConflict' } }
const reqKinds = ['create-requisition', 'edit-requisition', 'request-requisition-review', 'review-requisition', 'create-job', 'bind-job-requisition', 'publish-job', 'close-job']
const interviewKinds = ['schedule-interview', 'save-scorecard', 'submit-scorecard']
const coreFields: Record<string, string[]> = {
  adopt: [], 'create-person-application': ['jobId', 'firstName', 'lastName', 'workEmail'], 'add-person-application': ['personId', 'jobId'], 'move-application': ['applicationId', 'expectedStage', 'nextStage'], 'end-application': ['applicationId', 'expectedStage', 'outcome', 'reason'], hire: ['applicationId'],
}
export function recruitingCommandKind(command: unknown): unknown {
  assert(command !== null && typeof command === 'object')
  const descriptor = Object.getOwnPropertyDescriptor(command, 'kind'); assert(descriptor && 'value' in descriptor && descriptor.enumerable)
  return descriptor.value
}
export function authorizeRecruitingCommand(actor: RecruitingActor, kind: unknown) {
  canonicalRecruitingJson(actor)
  const privateCommand = kind === 'save-scorecard' || kind === 'submit-scorecard'
  if (privateCommand ? actor?.mode !== 'interviewer' : !isRecruitingManager(actor)) refuse('This recruiting preview is unavailable.', 'unavailable')
  assert(typeof kind === 'string' && (Object.hasOwn(coreFields, kind) || reqKinds.includes(kind) || interviewKinds.includes(kind)))
}
function detectAdoptionConflicts(state: HrDemoState, raw: HrFixture) {
  const people = new Map<string, { id: string; displayName: string }>()
  for (const [index, candidate] of state.recruiting.candidates.entries()) {
    const email = recruitingEmail(candidate.workEmail), prior = people.get(email)
    if (prior) throw new RecruitingConflict({ kind: 'person', ...prior })
    const employee = recruitingEmployees(raw.employees, state.recruiting.hiredEmployees).find(employee => employee.workEmail.trim().toLowerCase() === email && !(candidate.stage === 'hired' && candidate.employeeId === employee.id))
    if (employee) throw new RecruitingConflict({ kind: 'employee', id: employee.id, displayName: `${employee.firstName} ${employee.lastName}` })
    people.set(email, { id: `rperson-${String(index + 1).padStart(4, '0')}`, displayName: `${candidate.firstName} ${candidate.lastName}` })
  }
}
function assertHireReplacement(before: HrDemoState, next: HrDemoState, creation: ExactHireCreation, employeeId: string) {
  const expected = copyRecruiting(before)
  assert(!Object.hasOwn(expected.workflow.onboarding, employeeId) && !Object.hasOwn(expected.workflow.profileEmails, employeeId) && !Object.hasOwn(expected.workflow.employeeStatuses, employeeId) && !Object.hasOwn(expected.operations.balances, employeeId))
  expected.recruiting.hiredEmployees.push(copyRecruiting(creation.employee)); expected.workflow.onboarding[employeeId] = copyRecruiting(creation.onboarding)
  expected.workflow.profileEmails[employeeId] = creation.profile.workEmail; expected.workflow.employeeStatuses[employeeId] = creation.status.value
  expected.operations.balances[employeeId] = { vacation: creation.balance.vacation, sick: creation.balance.sick }
  assert(creation.employee.id === employeeId && creation.profile.employeeId === employeeId && creation.status.employeeId === employeeId && creation.balance.employeeId === employeeId)
  if (creation.employment) {
    const life = expected.workflow.lifecycle; assert(life)
    life.instances.push(copyRecruiting(creation.employment.instance)); life.activeInstances[employeeId] = creation.employment.instance.id
    life.events.push(copyRecruiting(creation.employment.event)); life.sequence++
  }
  assert(sameRecruitingValue(expected, next), 'The hire did not match its exact reviewed additions.')
}
export function buildRecruitingCandidate(state: HrDemoState, actor: RecruitingActor, command: RecruitingCommand, raw: HrFixture, services: RecruitingCoreServices): { next: HrDemoState; preview: PublicPreview } {
  authorizeRecruitingCommand(actor, recruitingCommandKind(command))
  canonicalRecruitingJson(command); recruitingInstant(command.recordedAt)
  const employees = effectiveWorkflowFixture(state.workflow, { ...raw, employees: recruitingEmployees(raw.employees, state.recruiting.hiredEmployees) }).employees
  assertRecruitingActor(actor, new Set(employees.map(employee => employee.id)))
  assert(services.validateCandidate(state, raw), 'The current recruiting workspace is unavailable.')
  const source = canonicalRecruitingJson(state), fixtureSource = canonicalRecruitingJson(raw)
  let next = copyRecruiting(state), life: RecruitingLifecycleV1
  let hireCreation: ExactHireCreation | null = null
  if (command.kind === 'adopt') {
    exactKeys(command, ['kind', 'recordedAt']); detectAdoptionConflicts(state, raw)
    life = createRecruitingAdoption(state, actor, command.recordedAt, raw)
  } else {
    assert(Object.hasOwn(state.recruiting, 'lifecycle'), 'Explicitly adopt recruiting workflows before using this action.')
    life = replayRecruitingLifecycle(state.recruiting, raw, services)
    const context: RecruitingPlanContext = { lifecycle: copyRecruiting(life), actor: copyRecruiting(actor), employees: copyRecruiting(employees), event: (offset = 0) => { assert(Number.isSafeInteger(offset) && offset >= 0 && offset < 4); const sequence = life.sequence + offset; return { id: recruitingEventId(sequence), sequence, actor: copyRecruiting(actor), recordedAt: command.recordedAt } }, isTimeZoneSupported: services.isTimeZoneSupported }
    let events: RecruitingDomainEvent[]
    if (reqKinds.includes(command.kind)) events = services.requisitions.plan(command as Parameters<typeof services.requisitions.plan>[0], context)
    else if (interviewKinds.includes(command.kind)) events = services.interviews.plan(command as Parameters<typeof services.interviews.plan>[0], context)
    else {
      exactKeys(command, ['kind', 'recordedAt', ...coreFields[command.kind]])
      if (command.kind === 'create-person-application' || command.kind === 'add-person-application') {
        const job = life.jobs.find(job => job.id === command.jobId); assert(job?.state === 'published', 'Choose a published sample job.')
        let person
        events = []
        if (command.kind === 'create-person-application') {
          const workEmail = recruitingEmail(command.workEmail), duplicate = life.people.find(person => person.workEmail === workEmail)
          if (duplicate) throw new RecruitingConflict({ kind: 'person', id: duplicate.id, displayName: `${duplicate.firstName} ${duplicate.lastName}` })
          const employee = employees.find(employee => employee.workEmail.trim().toLowerCase() === workEmail)
          if (employee) throw new RecruitingConflict({ kind: 'employee', id: employee.id, displayName: `${employee.firstName} ${employee.lastName}` })
          const envelope = context.event()
          person = { id: nextRecruitingId('rperson', life.people), firstName: recruitingText(command.firstName, 2, 60), lastName: recruitingText(command.lastName, 2, 60), workEmail, provenance: { kind: 'created' as const, eventId: envelope.id } }
          events.push({ ...envelope, kind: 'person-created', person })
        } else { person = life.people.find(person => person.id === command.personId); assert(person, 'Choose an existing fictional person.') }
        const duplicate = life.applications.find(app => app.personId === person.id && app.jobId === job.id)
        if (duplicate) throw new RecruitingConflict({ kind: 'application', id: duplicate.id, displayName: `${person.firstName} ${person.lastName}` })
        const envelope = context.event(events.length), id = nextRecruitingId('rapplication', life.applications)
        events.push({ ...envelope, kind: 'application-created', applicationId: id, application: { id, personId: person.id, jobId: job.id, stage: 'applied', stageEnteredAt: command.recordedAt, lastStageRecordedAt: command.recordedAt, provenance: { kind: 'created', eventId: envelope.id }, hireBindingId: null } })
      } else if (command.kind === 'move-application' || command.kind === 'end-application') {
        const app = life.applications.find(app => app.id === command.applicationId); assert(app && app.stage === command.expectedStage, 'The current application stage changed. Preview again.')
        const stage = command.kind === 'move-application' ? command.nextStage : command.outcome
        assert(['screening', 'interview', 'offer', 'rejected', 'withdrawn'].includes(stage))
        events = [{ ...context.event(), kind: 'application-stage', applicationId: app.id, previousStage: app.stage, stage: stage as ApplicationStage, reason: command.kind === 'end-application' ? recruitingText(command.reason, 2, 500) : null }]
      } else {
        assert(command.kind === 'hire' && isRecruitingManager(actor))
        const app = life.applications.find(app => app.id === command.applicationId), person = life.people.find(person => person.id === app?.personId), job = life.jobs.find(job => job.id === app?.jobId)
        assert(app?.stage === 'offer' && person && job?.state === 'published' && !life.hireBindings.some(hire => hire.personId === person.id), 'This fictional application cannot create another hire.')
        const manager = employees.find(employee => employee.id === job.managerEmployeeId)
        assert(manager?.employmentStatus === 'active' && employees.some(employee => employee.managerId === manager.id), 'Choose an active supported hiring manager.')
        assert(!employees.some(employee => employee.id === `employee-${person.id}` || employee.workEmail.trim().toLowerCase() === person.workEmail), 'This fictional person already belongs to the employee directory.')
        const envelope = context.event()
        const hire = services.hire.build({ state: copyRecruiting(state), rawFixture: copyRecruiting(raw), actor: copyRecruiting(actor), person: copyRecruiting(person), application: copyRecruiting(app), job: copyRecruiting(job), event: envelope, hireBindingId: nextRecruitingId('rhire', life.hireBindings) })
        assertHireReplacement(state, hire.next, hire.creation, hire.binding.employeeId); assert(sameRecruitingValue(hire.creation.employee, hire.binding.employeeSnapshot))
        next = copyRecruiting(hire.next); hireCreation = copyRecruiting(hire.creation)
        events = [{ ...envelope, kind: 'hired', applicationId: app.id, hire: copyRecruiting(hire.binding) }]
      }
    }
    assert(events.length > 0 && events.length <= 2)
    for (const event of events) life = applyRecruitingEvent(life, event, raw, services)
  }
  ;(next.recruiting as typeof next.recruiting & { lifecycle: RecruitingLifecycleV1 }).lifecycle = life
  replayRecruitingLifecycle(next.recruiting, raw, services)
  if (JSON.stringify({ schemaVersion: 1, module: 'hr', data: next }).length > 2_000_000) refuse('This local workspace has reached its capacity. No records were changed.', 'limit')
  assert(services.validateCandidate(next, raw), 'The complete recruiting result was refused.')
  assert(canonicalRecruitingJson(state) === source && canonicalRecruitingJson(raw) === fixtureSource)
  assert(!sameRecruitingValue(state, next), 'No-op recruiting actions are refused.')
  if (actor.mode === 'interviewer') {
    const view = projectRecruitingView(next, actor, raw); assert(view.mode === 'interviewer')
    const interview = view.assignedInterviews.find(item => command.kind === 'save-scorecard' ? item.id === command.interviewId : command.kind === 'submit-scorecard' && item.ownScorecard?.id === command.scorecardId)
    assert(interview?.ownScorecard)
    const old = (state.recruiting as typeof state.recruiting & { lifecycle: RecruitingLifecycleV1 }).lifecycle.scorecards.find(card => card.interviewId === interview.id && card.authorEmployeeId === actor.employeeId)
    const common = { interviewId: interview.id, applicationId: interview.application.id, authorEmployeeId: actor.employeeId, content: copyRecruiting(interview.ownScorecard.content), recordedAt: command.recordedAt, ownChronologyFloor: old?.lastOwnRecordedAt ?? null }
    const preview: OwnScorecardPreview = command.kind === 'save-scorecard' ? { ...common, kind: 'save-scorecard', previousRevision: old?.revision ?? null, proposedRevision: interview.ownScorecard.revision, proposedState: 'draft' } : { ...common, kind: 'submit-scorecard', scorecardId: interview.ownScorecard.id, draftRevision: interview.ownScorecard.revision, proposedRevision: interview.ownScorecard.revision, proposedState: 'submitted' }
    return { next, preview }
  }
  const view = projectRecruitingView(next, actor, raw), before = projectRecruitingView(state, actor, raw); assert(view.mode === 'management' && before.mode === 'management')
  const changed = <T extends { id: string }>(records: T[], prior: T[]) => records.filter(item => !prior.some(old => old.id === item.id && sameRecruitingValue(old, item)))
  const preview: ManagementRecruitingPreview = { kind: command.kind as ManagementRecruitingPreview['kind'], recordedAt: command.recordedAt, changedPeople: changed(view.people, before.people), changedApplications: changed(view.applications, before.applications), requisition: changed(view.requisitions, before.requisitions)[0] ?? null, job: changed(view.jobs, before.jobs)[0] ?? null, conflict: null, interview: changed(view.interviews, before.interviews)[0] ?? null, hire: hireCreation, warnings: command.kind === 'adopt' ? ['Legacy records and unknown history stay captured. Future draft publication requires an explicitly reviewed requisition.'] : [] }
  return { next, preview }
}
