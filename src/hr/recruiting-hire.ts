import type { HrEmployee } from './model'
import { createMockHrState, effectiveWorkflowFixture } from './mock-workflows'
import { createPeopleOperations } from './people-operations'
import { recruitingFixture } from './recruiting-link'
import { hrOnboardingTemplate, recruitingManagers } from './recruiting'
import type { HrEmploymentInstance, HrLifecycleEvent } from './lifecycle-types'
import type { ExactHireCreation, RecruitingHireAdapter, RecruitingHireInput } from './recruiting-lifecycle-types'
import { assert, copyRecruiting, isRecruitingManager, recruitingId, sameRecruitingValue } from './recruiting-lifecycle-value'

/** Build the linked native addition once; the core owns its recruiting event. */
export function buildRecruitingHire(input: RecruitingHireInput): ReturnType<RecruitingHireAdapter['build']> {
  const { state, rawFixture, actor, person, application, job, event, hireBindingId } = input
  assert(isRecruitingManager(actor), 'This recruiting preview is unavailable.')
  const lifecycle = state.recruiting.lifecycle
  assert(lifecycle && lifecycle.schemaVersion === 1, 'Adopt the recruiting lifecycle before preparing this hire.')
  assert(sameRecruitingValue(lifecycle.people.find(item => item.id === person.id), person))
  assert(sameRecruitingValue(lifecycle.applications.find(item => item.id === application.id), application))
  assert(sameRecruitingValue(lifecycle.jobs.find(item => item.id === job.id), job))
  assert(application.personId === person.id && application.jobId === job.id && application.stage === 'offer' && application.hireBindingId === null)
  assert(job.state === 'published' && !lifecycle.hireBindings.some(item => item.personId === person.id || item.applicationId === application.id || item.id === hireBindingId))
  assert(event.actor.mode === 'native' && sameRecruitingValue(event.actor, actor) && event.sequence === lifecycle.sequence)
  const currentFixture = effectiveWorkflowFixture(state.workflow, recruitingFixture(rawFixture, state.recruiting))
  assert(recruitingManagers(currentFixture).some(manager => manager.id === job.managerEmployeeId), 'Choose an eligible current hiring manager before preparing this hire.')
  assert(!currentFixture.employees.some(employee => employee.workEmail.trim().toLowerCase() === person.workEmail), 'This fictional person is already in the employee directory.')

  const employeeId = `employee-${person.id}`
  recruitingId(employeeId)
  recruitingId(hireBindingId)
  assert(!currentFixture.employees.some(employee => employee.id === employeeId))
  assert([state.workflow.onboarding, state.workflow.profileEmails, state.workflow.employeeStatuses, state.operations.balances].every(records => !Object.hasOwn(records, employeeId)), 'The prospective hire already has linked HR records.')
  const template = hrOnboardingTemplate(state.workflow.lifecycle?.selectedTemplateVersion ?? 'sample-v1')
  const employee: HrEmployee = {
    id: employeeId, firstName: person.firstName, lastName: person.lastName,
    workEmail: person.workEmail, department: job.department, jobTitle: job.title,
    employmentStatus: 'onboarding', managerId: job.managerEmployeeId,
    payCents: 0, compensationStatus: 'unconfigured-synthetic', compensationConfigured: false,
    onboarding: template.tasks.map(task => ({ ...task, status: 'pending' })),
    onboardingTemplateVersion: template.version,
  }
  const seedFixture = { ...rawFixture, employees: [employee] }
  const onboarding = createMockHrState(seedFixture).onboarding[employeeId]
  const balance = createPeopleOperations(seedFixture).balances[employeeId]
  const next = copyRecruiting(state)
  next.recruiting.hiredEmployees.push(copyRecruiting(employee))
  next.workflow.onboarding[employeeId] = copyRecruiting(onboarding)
  next.workflow.profileEmails[employeeId] = person.workEmail
  next.workflow.employeeStatuses[employeeId] = 'onboarding'
  next.operations.balances[employeeId] = copyRecruiting(balance)

  let employment: ExactHireCreation['employment'] = null
  if (next.workflow.lifecycle) {
    const history = next.workflow.lifecycle
    const initial = { status: 'onboarding', department: employee.department, jobTitle: employee.jobTitle, managerId: employee.managerId }
    const instanceId = `employment-${employeeId}-1`
    assert(!history.instances.some(instance => instance.id === instanceId || instance.employeeId === employeeId) && !Object.hasOwn(history.activeInstances, employeeId))
    const instance: HrEmploymentInstance = {
      id: instanceId, employeeId, startDate: history.simulationDate, endDate: null,
      initial, current: { ...initial }, templateVersion: template.version,
      tasks: template.tasks.map(task => ({ ...task })),
    }
    const sequence = history.sequence
    const hireEvent: HrLifecycleEvent = {
      id: `lifecycle-${sequence}`, sequence, kind: 'hire', employeeId, instanceId,
      effectiveDate: history.simulationDate, actor: { ...actor.actor }, reason: '',
      previous: null, proposed: { ...initial },
    }
    assert(!history.events.some(item => item.id === hireEvent.id || item.sequence === sequence))
    history.instances.push(instance)
    history.activeInstances[employeeId] = instanceId
    history.events.push(hireEvent)
    history.sequence++
    employment = { instance: copyRecruiting(instance), event: copyRecruiting(hireEvent) }
  }
  const creation: ExactHireCreation = {
    employee: copyRecruiting(employee), onboarding: copyRecruiting(onboarding),
    profile: { employeeId, workEmail: person.workEmail }, status: { employeeId, value: 'onboarding' },
    balance: { employeeId, vacation: balance.vacation, sick: balance.sick }, employment,
  }
  const binding = {
    id: hireBindingId, personId: person.id, applicationId: application.id, employeeId,
    provenance: { kind: 'created' as const, eventId: event.id }, employeeSnapshot: copyRecruiting(employee),
    checklist: { version: template.version, tasks: template.tasks.map(task => ({ ...task })) },
    initialBalances: copyRecruiting(balance),
    employmentAtHire: employment
      ? { kind: 'created' as const, instanceId: employment.instance.id, hireEventId: employment.event.id }
      : { kind: 'absent' as const },
    legacyEmploymentLinks: null,
  }
  // No active employee selection, legacy candidate mutation, recruiting event,
  // unrelated balance, existing receipt or submitted payroll changes here.
  return { next, binding, creation }
}

export const recruitingHireAdapter: RecruitingHireAdapter = { build: buildRecruitingHire }
