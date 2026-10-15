import type { HrFixture } from './model'
import type { HrDemoState } from './persistence'
import type { RecruitingState } from './recruiting'
import type { ApplicationStage, RecruitingActor, RecruitingApplication, RecruitingCoreServices, RecruitingDomainEvent, RecruitingHireBinding, RecruitingLifecycleV1, RecruitingPerson } from './recruiting-lifecycle-types'
import { assert, assertRecruitingActor, canonicalRecruitingJson, copyRecruiting, exactKeys, isRecruitingManager, nextRecruitingId, RECRUITING_LIMITS, recruitingEmail, recruitingEmployees, recruitingId, recruitingInstant, recruitingInteger, recruitingText, sameRecruitingValue } from './recruiting-lifecycle-value'

export type RecruitingReplayServices = Pick<RecruitingCoreServices, 'requisitions' | 'interviews' | 'isTimeZoneSupported'>
export const recruitingEventId = (sequence: number) => `recruit-event-${String(sequence).padStart(4, '0')}`
export const recruitingTerminal = (stage: ApplicationStage) => ['hired', 'rejected', 'withdrawn'].includes(stage)
const lifecycleKeys = ['schemaVersion', 'sequence', 'adoption', 'people', 'applications', 'requisitions', 'approvals', 'jobs', 'publications', 'interviews', 'scorecards', 'hireBindings', 'events']
const stages: ApplicationStage[] = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn']

function baseline(adoption: RecruitingLifecycleV1['adoption'], raw: HrFixture): RecruitingLifecycleV1 {
  exactKeys(adoption, ['eventId', 'actor', 'recordedAt', 'legacyJobs', 'legacyCandidates', 'legacyHiredEmployees', 'legacyHireLinks', 'legacySequence'])
  recruitingInstant(adoption.recordedAt); recruitingInteger(adoption.legacySequence, 0, Number.MAX_SAFE_INTEGER)
  assert(adoption.eventId === recruitingEventId(1))
  for (const key of ['legacyJobs', 'legacyCandidates', 'legacyHiredEmployees', 'legacyHireLinks'] as const) assert(Array.isArray(adoption[key]))
  assert(adoption.legacyHiredEmployees.length === adoption.legacyHireLinks.length)
  const employees = recruitingEmployees(raw.employees, adoption.legacyHiredEmployees)
  const known = new Set(employees.map(employee => employee.id)); assertRecruitingActor(adoption.actor, known); assert(isRecruitingManager(adoption.actor))
  const life: RecruitingLifecycleV1 = { schemaVersion: 1, sequence: 1, adoption: copyRecruiting(adoption), people: [], applications: [], requisitions: [], approvals: [], jobs: [], publications: [], interviews: [], scorecards: [], hireBindings: [], events: [] }
  for (const job of adoption.legacyJobs) {
    recruitingId(job.id, 200); assert(!life.jobs.some(item => item.id === job.id)); assert(['draft', 'published', 'closed'].includes(job.status)); assert(known.has(job.managerId))
    recruitingText(job.title, 3, 100); recruitingText(job.department, 2, 80)
    life.jobs.push({ id: job.id, revision: 1, title: job.title, department: job.department, managerEmployeeId: job.managerId, state: job.status, requisitionId: null, currentPublicationId: null, provenance: { kind: 'legacy', jobId: job.id, initialState: job.status } })
  }
  assert(new Set(adoption.legacyCandidates.map(item => item.id)).size === adoption.legacyCandidates.length)
  for (const candidate of adoption.legacyCandidates) {
    recruitingId(candidate.id, 200); assert(stages.includes(candidate.stage)); assert(life.jobs.some(job => job.id === candidate.jobId))
    const workEmail = recruitingEmail(candidate.workEmail)
    assert(!life.people.some(person => person.workEmail === workEmail), 'Legacy candidate identities conflict. No recruiting adoption was saved.')
    const person: RecruitingPerson = { id: nextRecruitingId('rperson', life.people), firstName: recruitingText(candidate.firstName, 2, 60), lastName: recruitingText(candidate.lastName, 2, 60), workEmail, provenance: { kind: 'legacy', candidateId: candidate.id } }
    const application: RecruitingApplication = { id: nextRecruitingId('rapplication', life.applications), personId: person.id, jobId: candidate.jobId, stage: candidate.stage, stageEnteredAt: null, lastStageRecordedAt: null, provenance: { kind: 'legacy', candidateId: candidate.id, initialStage: candidate.stage }, hireBindingId: null }
    const matches = employees.filter(employee => employee.workEmail.trim().toLowerCase() === workEmail)
    if (candidate.stage === 'hired') {
      const index = adoption.legacyHiredEmployees.findIndex(employee => employee.id === candidate.employeeId)
      assert(index >= 0 && matches.length === 1 && matches[0].id === candidate.employeeId)
      const employee = adoption.legacyHiredEmployees[index], links = adoption.legacyHireLinks[index]
      exactKeys(links, ['employeeId', 'instanceId', 'hireEventId']); assert(links.employeeId === employee.id)
      for (const value of [links.instanceId, links.hireEventId]) if (value !== null) recruitingId(value, 200)
      assert(links.hireEventId === null || links.instanceId !== null)
      const binding: RecruitingHireBinding = { id: nextRecruitingId('rhire', life.hireBindings), personId: person.id, applicationId: application.id, employeeId: employee.id, provenance: { kind: 'legacy', candidateId: candidate.id }, employeeSnapshot: copyRecruiting(employee), checklist: { version: typeof employee.onboardingTemplateVersion === 'string' ? employee.onboardingTemplateVersion : null, tasks: employee.onboarding.map(task => ({ id: task.id, title: task.title })) }, initialBalances: null, employmentAtHire: null, legacyEmploymentLinks: { instanceId: links.instanceId, hireEventId: links.hireEventId } }
      application.hireBindingId = binding.id; life.hireBindings.push(binding)
    } else { assert(candidate.employeeId === undefined && matches.length === 0, 'A legacy candidate conflicts with an employee identity. No recruiting adoption was saved.') }
    life.people.push(person); life.applications.push(application)
  }
  assert(life.hireBindings.length === adoption.legacyHiredEmployees.length)
  assert(new Set(life.hireBindings.map(hire => hire.employeeId)).size === life.hireBindings.length)
  return life
}

export function createRecruitingAdoption(state: HrDemoState, actor: RecruitingActor, recordedAt: string, raw: HrFixture): RecruitingLifecycleV1 {
  assert(!Object.hasOwn(state.recruiting, 'lifecycle'), 'Recruiting workflows have already been adopted.')
  recruitingInstant(recordedAt)
  const legacyHireLinks = state.recruiting.hiredEmployees.map(employee => {
    const instance = state.workflow.lifecycle?.instances.find(item => item.employeeId === employee.id && item.previousInstanceId === undefined)
    const event = instance && state.workflow.lifecycle?.events.find(item => item.kind === 'hire' && item.instanceId === instance.id)
    return { employeeId: employee.id, instanceId: instance?.id ?? null, hireEventId: event?.id ?? null }
  })
  const adoption = { eventId: recruitingEventId(1), actor: copyRecruiting(actor), recordedAt, legacyJobs: copyRecruiting(state.recruiting.jobs), legacyCandidates: copyRecruiting(state.recruiting.candidates), legacyHiredEmployees: copyRecruiting(state.recruiting.hiredEmployees), legacyHireLinks, legacySequence: state.recruiting.sequence }
  const life = baseline(adoption, raw)
  life.events.push({ id: adoption.eventId, sequence: 1, actor: copyRecruiting(actor), recordedAt, kind: 'adopt', adoption: copyRecruiting(adoption) }); life.sequence = 2
  assertRecruitingCaps(life)
  return life
}

export function assertRecruitingCaps(life: RecruitingLifecycleV1) {
  for (const key of ['people', 'applications', 'jobs', 'requisitions', 'approvals', 'publications', 'interviews', 'scorecards', 'events'] as const) {
    assert(Array.isArray(life[key]) && life[key].length <= RECRUITING_LIMITS[key], 'This local workspace has reached its capacity. No records were changed.')
    assert(new Set(life[key].map(item => item.id)).size === life[key].length)
  }
  assert(Array.isArray(life.hireBindings) && life.hireBindings.length <= RECRUITING_LIMITS.people)
  assert(new Set(life.hireBindings.map(item => item.id)).size === life.hireBindings.length)
  for (const person of life.people) assert(life.applications.filter(app => app.personId === person.id).length <= RECRUITING_LIMITS.applicationsPerPerson)
  for (const app of life.applications) {
    assert(life.interviews.filter(interview => interview.applicationId === app.id).length <= RECRUITING_LIMITS.interviewsPerApplication)
    assert(life.events.filter(event => 'applicationId' in event && event.applicationId === app.id).length <= RECRUITING_LIMITS.eventsPerApplication)
  }
}
function application(life: RecruitingLifecycleV1, id: string) { const found = life.applications.find(app => app.id === id); assert(found); return found }
function advance(app: RecruitingApplication, recordedAt: string, stage: ApplicationStage) {
  assert(!recruitingTerminal(app.stage)); assert(app.lastStageRecordedAt === null || recordedAt >= app.lastStageRecordedAt, 'Choose a timestamp at or after this application’s last recorded stage time.')
  app.stage = stage; app.stageEnteredAt = recordedAt; app.lastStageRecordedAt = recordedAt
}
function requirePublished(life: RecruitingLifecycleV1, app: RecruitingApplication) { assert(life.jobs.some(job => job.id === app.jobId && job.state === 'published')) }
function protectOtherCollections(before: RecruitingLifecycleV1, after: RecruitingLifecycleV1, allowed: string[]) {
  exactKeys(after, lifecycleKeys)
  for (const key of lifecycleKeys.filter(key => !allowed.includes(key))) assert(sameRecruitingValue(before[key as keyof RecruitingLifecycleV1], after[key as keyof RecruitingLifecycleV1]))
}

/** One pure event authority, shared by command candidates and strict import. */
export function applyRecruitingEvent(previous: RecruitingLifecycleV1, event: RecruitingDomainEvent, raw: HrFixture, services: RecruitingReplayServices): RecruitingLifecycleV1 {
  event = copyRecruiting(event)
  assert(event.id === recruitingEventId(previous.sequence) && event.sequence === previous.sequence); recruitingInstant(event.recordedAt)
  const knownEmployeeIds = new Set([...raw.employees.map(employee => employee.id), ...previous.hireBindings.map(binding => binding.employeeId)])
  assertRecruitingActor(event.actor, knownEmployeeIds)
  const privateEvent = ['scorecard-saved', 'scorecard-submitted'].includes(event.kind)
  assert(privateEvent ? event.actor.mode === 'interviewer' : isRecruitingManager(event.actor))
  let life = copyRecruiting(previous)
  const envelope = ['id', 'sequence', 'actor', 'recordedAt', 'kind']
  if (event.kind === 'person-created') {
    exactKeys(event, [...envelope, 'person']); exactKeys(event.person, ['id', 'firstName', 'lastName', 'workEmail', 'provenance']); exactKeys(event.person.provenance, ['kind', 'eventId'])
    const person = event.person
    assert(person.id === nextRecruitingId('rperson', life.people) && person.provenance.kind === 'created' && person.provenance.eventId === event.id)
    assert(person.firstName === recruitingText(person.firstName, 2, 60) && person.lastName === recruitingText(person.lastName, 2, 60) && person.workEmail === recruitingEmail(person.workEmail))
    assert(!life.people.some(item => item.workEmail === person.workEmail))
    // Directory email eligibility is checked when the command is planned.
    // Historical replay cannot infer another domain's past email corrections.
    life.people.push(copyRecruiting(person))
  } else if (event.kind === 'application-created') {
    exactKeys(event, [...envelope, 'applicationId', 'application']); const app = event.application
    exactKeys(app, ['id', 'personId', 'jobId', 'stage', 'stageEnteredAt', 'lastStageRecordedAt', 'provenance', 'hireBindingId']); exactKeys(app.provenance, ['kind', 'eventId'])
    assert(app.id === nextRecruitingId('rapplication', life.applications) && event.applicationId === app.id && life.people.some(person => person.id === app.personId))
    assert(app.provenance.kind === 'created' && app.provenance.eventId === event.id && app.stage === 'applied' && app.stageEnteredAt === event.recordedAt && app.lastStageRecordedAt === event.recordedAt && app.hireBindingId === null)
    assert(!life.applications.some(item => item.personId === app.personId && item.jobId === app.jobId)); requirePublished(life, app)
    life.applications.push(copyRecruiting(app))
  } else if (event.kind === 'application-stage') {
    exactKeys(event, [...envelope, 'applicationId', 'previousStage', 'stage', 'reason'])
    const app = application(life, event.applicationId); assert(app.stage === event.previousStage); requirePublished(life, app)
    if (event.stage === 'rejected' || event.stage === 'withdrawn') assert(event.reason === recruitingText(event.reason, 2, 500))
    else { assert(event.reason === null); assert(['applied', 'screening', 'interview'].includes(app.stage) && ['applied', 'screening', 'interview', 'offer'][['applied', 'screening', 'interview', 'offer'].indexOf(app.stage) + 1] === event.stage) }
    advance(app, event.recordedAt, event.stage)
  } else if (event.kind === 'hired') {
    exactKeys(event, [...envelope, 'applicationId', 'hire']); const app = application(life, event.applicationId), hire = event.hire
    const person = life.people.find(item => item.id === app.personId), job = life.jobs.find(item => item.id === app.jobId)
    assert(person && job && app.stage === 'offer'); requirePublished(life, app)
    exactKeys(hire, ['id', 'personId', 'applicationId', 'employeeId', 'provenance', 'employeeSnapshot', 'checklist', 'initialBalances', 'employmentAtHire', 'legacyEmploymentLinks']); exactKeys(hire.provenance, ['kind', 'eventId'])
    assert(hire.id === nextRecruitingId('rhire', life.hireBindings) && hire.personId === person.id && hire.applicationId === app.id && hire.employeeId === `employee-${person.id}` && hire.provenance.kind === 'created' && hire.provenance.eventId === event.id && hire.legacyEmploymentLinks === null)
    assert(!knownEmployeeIds.has(hire.employeeId) && !life.hireBindings.some(item => item.personId === person.id))
    const employee = hire.employeeSnapshot
    exactKeys(employee, ['id', 'firstName', 'lastName', 'workEmail', 'department', 'jobTitle', 'employmentStatus', 'managerId', 'payCents', 'compensationConfigured', 'compensationStatus', 'onboarding'], ['onboardingTemplateVersion'])
    assert(employee.id === hire.employeeId && employee.firstName === person.firstName && employee.lastName === person.lastName && employee.workEmail === person.workEmail && employee.department === job.department && employee.jobTitle === job.title && employee.managerId === job.managerEmployeeId && employee.employmentStatus === 'onboarding' && employee.payCents === 0 && employee.compensationConfigured === false && employee.compensationStatus === 'unconfigured-synthetic')
    exactKeys(hire.checklist, ['version', 'tasks']); assert(['sample-v1', 'sample-v2'].includes(String(hire.checklist.version)))
    assert(Array.isArray(employee.onboarding) && employee.onboarding.every(task => task.status === 'pending'))
    assert(sameRecruitingValue(hire.checklist.tasks, employee.onboarding.map(task => ({ id: task.id, title: task.title }))))
    assert(sameRecruitingValue(hire.initialBalances, { vacation: 40, sick: 24 }))
    assert(hire.employmentAtHire)
    if (hire.employmentAtHire.kind === 'absent') exactKeys(hire.employmentAtHire, ['kind'])
    else { exactKeys(hire.employmentAtHire, ['kind', 'instanceId', 'hireEventId']); assert(hire.employmentAtHire.kind === 'created' && hire.employmentAtHire.instanceId === `employment-${hire.employeeId}-1`); recruitingId(hire.employmentAtHire.hireEventId, 200) }
    app.hireBindingId = hire.id; advance(app, event.recordedAt, 'hired'); life.hireBindings.push(copyRecruiting(hire))
  } else if (['requisition-changed', 'requisition-reviewed', 'job-changed', 'job-published'].includes(event.kind)) {
    life = services.requisitions.replay(life, event as Parameters<typeof services.requisitions.replay>[1], { knownEmployeeIds, isTimeZoneSupported: services.isTimeZoneSupported })
    protectOtherCollections(previous, life, ['requisitions', 'approvals', 'jobs', 'publications'])
  } else if (['interview-scheduled', 'scorecard-saved', 'scorecard-submitted'].includes(event.kind)) {
    life = services.interviews.replay(life, event as Parameters<typeof services.interviews.replay>[1], { knownEmployeeIds, isTimeZoneSupported: services.isTimeZoneSupported })
    protectOtherCollections(previous, life, ['interviews', 'scorecards'])
  } else assert(false)
  life.events.push(copyRecruiting(event)); life.sequence++; assertRecruitingCaps(life)
  return life
}

export function replayRecruitingLifecycle(recruiting: RecruitingState & { lifecycle?: unknown }, raw: HrFixture, services: RecruitingReplayServices): RecruitingLifecycleV1 {
  canonicalRecruitingJson(recruiting)
  assert(Object.hasOwn(recruiting, 'lifecycle'))
  const current = recruiting.lifecycle as RecruitingLifecycleV1
  exactKeys(current, lifecycleKeys); assert(current.schemaVersion === 1 && Array.isArray(current.events) && current.events.length > 0)
  let life = baseline(current.adoption, raw)
  assert(sameRecruitingValue(recruiting.jobs, life.adoption.legacyJobs) && sameRecruitingValue(recruiting.candidates, life.adoption.legacyCandidates) && recruiting.sequence === life.adoption.legacySequence)
  const first = current.events[0]
  exactKeys(first, ['id', 'sequence', 'actor', 'recordedAt', 'kind', 'adoption'])
  assert(first.kind === 'adopt' && first.id === recruitingEventId(1) && first.sequence === 1 && sameRecruitingValue(first.adoption, current.adoption) && sameRecruitingValue(first.actor, current.adoption.actor) && first.recordedAt === current.adoption.recordedAt)
  life.events.push(copyRecruiting(first)); life.sequence = 2
  for (let index = 1; index < current.events.length; index++) {
    const event = current.events[index]
    if (event.kind === 'person-created') {
      const next = current.events[index + 1]
      assert(next?.kind === 'application-created' && next.application.personId === event.person.id && next.recordedAt === event.recordedAt && sameRecruitingValue(next.actor, event.actor))
    }
    life = applyRecruitingEvent(life, event, raw, services)
  }
  assertRecruitingCaps(life)
  assert(sameRecruitingValue(current, life))
  const expectedHires = [...life.adoption.legacyHiredEmployees, ...life.hireBindings.filter(hire => hire.provenance.kind === 'created').map(hire => hire.employeeSnapshot)]
  assert(sameRecruitingValue(recruiting.hiredEmployees, expectedHires))
  return life
}
