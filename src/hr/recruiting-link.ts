import type { HrFixture } from './model'
import { createMockHrState, effectiveWorkflowFixture, type MockHrState } from './mock-workflows'
import { createPeopleOperations, type PeopleOperationsState } from './people-operations'
import { transitionRecruiting, type RecruitingEvent, type RecruitingState } from './recruiting'
import type { HrActor } from './model'

export function recruitingFixture(base: HrFixture, recruiting: RecruitingState): HrFixture {
  const ids = new Set(base.employees.map(employee => employee.id))
  for (const employee of recruiting.hiredEmployees) {
    if (ids.has(employee.id)) throw new Error('A sample hire collides with an existing employee identity.')
    ids.add(employee.id)
  }
  return { ...base, employees: [...base.employees, ...recruiting.hiredEmployees] }
}

/** A native sample hire initializes HR requirements without resetting other work. */
export function applyRecruitingToHr(recruiting: RecruitingState, workflow: MockHrState, operations: PeopleOperationsState, actor: HrActor, event: RecruitingEvent, base: HrFixture) {
  const fixture = recruitingFixture(base, recruiting)
  const nextRecruiting = transitionRecruiting(recruiting, actor, event, effectiveWorkflowFixture(workflow, fixture), workflow.lifecycle?.selectedTemplateVersion)
  const previousIds = new Set(recruiting.hiredEmployees.map(employee => employee.id))
  const additions = nextRecruiting.hiredEmployees.filter(employee => !previousIds.has(employee.id))
  recruitingFixture(base, nextRecruiting)
  if (!additions.length) return { recruiting: nextRecruiting, workflow, operations }
  if (additions.some(employee => [workflow.onboarding, workflow.profileEmails, workflow.employeeStatuses, operations.balances].some(records => Object.hasOwn(records, employee.id)))) throw new Error('Sample HR state already exists for that hire.')
  const seedFixture = { ...base, employees: additions }
  const seed = createMockHrState(seedFixture)
  const peopleSeed = createPeopleOperations(seedFixture)
  const nextLifecycle = workflow.lifecycle ? structuredClone(workflow.lifecycle) : undefined
  if (nextLifecycle) {
    for (const employee of additions) {
      const initial = { status: 'onboarding', department: employee.department, jobTitle: employee.jobTitle, managerId: employee.managerId }
      const instanceId = `employment-${employee.id}-1`
      nextLifecycle.instances.push({ id: instanceId, employeeId: employee.id, startDate: nextLifecycle.simulationDate, endDate: null, initial, current: { ...initial }, templateVersion: String(employee.onboardingTemplateVersion), tasks: employee.onboarding.map(task => ({ id: task.id, title: task.title })) })
      nextLifecycle.activeInstances[employee.id] = instanceId
      const sequence = nextLifecycle.sequence++
      nextLifecycle.events.push({ id: `lifecycle-${sequence}`, sequence, kind: 'hire', employeeId: employee.id, instanceId, effectiveDate: nextLifecycle.simulationDate, actor: { ...actor }, reason: '', previous: null, proposed: { ...initial } })
    }
  }
  return {
    recruiting: nextRecruiting,
    workflow: {
      ...workflow,
      ...(nextLifecycle ? { lifecycle: nextLifecycle } : {}),
      onboarding: { ...workflow.onboarding, ...seed.onboarding },
      profileEmails: { ...workflow.profileEmails, ...seed.profileEmails },
      employeeStatuses: { ...workflow.employeeStatuses, ...seed.employeeStatuses },
    },
    operations: { ...operations, balances: { ...operations.balances, ...peopleSeed.balances } },
  }
}
