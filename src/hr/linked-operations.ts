import type { HrActor, HrFixture, HrRecord } from './model'
import { transitionMockHr, type MockHrState } from './mock-workflows'
import { transitionPeopleOperations, type PeopleOperationsEvent, type PeopleOperationsState } from './people-operations'

// Explicit connections for the bundled fictional assignments. Adopters should
// replace these IDs with reviewed app-owned mappings; titles are never authority.
const sampleLinks = [
  { eventType: 'acknowledge-policy', module: 'policies', sourceId: 'policy-001', employeeId: 'employee-002', taskId: 'task-001', onboardingTaskId: 'policy' },
  { eventType: 'complete-training', module: 'training', sourceId: 'training-002', employeeId: 'employee-003', taskId: 'task-002', onboardingTaskId: undefined },
] as const

function sourceId(record: HrRecord) {
  return typeof record.sourceId === 'string' ? record.sourceId : record.id
}

function fixtureAssignment(records: HrRecord[], id: string, employeeId: string) {
  return records.some(record => record.id === id && (record.employeeId === employeeId || Array.isArray(record.employeeIds) && record.employeeIds.includes(employeeId)))
}

/** Apply one people operation and its explicit sample links as one pure update. */
export function applyLinkedPeopleOperation(workflow: MockHrState, operations: PeopleOperationsState, event: PeopleOperationsEvent, actor: HrActor, fixture: HrFixture): { workflow: MockHrState; operations: PeopleOperationsState } {
  let nextOperations = transitionPeopleOperations(operations, event, actor, fixture)
  let nextWorkflow = workflow
  if (event.type !== 'acknowledge-policy' && event.type !== 'complete-training') return { workflow: nextWorkflow, operations: nextOperations }

  for (const link of sampleLinks) {
    if (event.type !== link.eventType) continue
    const employee = fixture.employees.find(person => person.id === link.employeeId)
    const source = nextOperations.records[link.module].find(record => record.id === event.recordId)
    const task = nextOperations.records.tasks.find(record => sourceId(record) === link.taskId && record.employeeId === link.employeeId)
    if (workflow.lifecycle && workflow.lifecycle.activeInstances[link.employeeId] !== `employment-${link.employeeId}-1`) continue
    if (!employee || !source || sourceId(source) !== link.sourceId || source.employeeId !== link.employeeId || !task) continue
    if (!fixtureAssignment(fixture.native[link.module] ?? [], link.sourceId, link.employeeId) || !fixtureAssignment(fixture.native.tasks ?? [], link.taskId, link.employeeId)) continue

    if (task.status === 'pending') nextOperations = transitionPeopleOperations(nextOperations, { type: 'complete-task', recordId: task.id }, actor, fixture)
    if (link.onboardingTaskId && employee.onboarding.some(item => item.id === link.onboardingTaskId)) {
      const onboarding = nextWorkflow.onboarding[link.employeeId]
      if (onboarding && onboarding.stage !== 'complete' && Object.hasOwn(onboarding.tasks, link.onboardingTaskId) && !onboarding.tasks[link.onboardingTaskId]) {
        nextWorkflow = transitionMockHr(nextWorkflow, actor, { type: 'check-task', employeeId: link.employeeId, taskId: link.onboardingTaskId, complete: true, ...(nextWorkflow.lifecycle ? { instanceId: nextWorkflow.lifecycle.activeInstances[link.employeeId] } : {}) }, fixture)
      }
    }
  }
  return { workflow: nextWorkflow, operations: nextOperations }
}
