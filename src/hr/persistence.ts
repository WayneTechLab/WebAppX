import type { HrFixture, HrRole } from './model'
import { createMockHrState, type MockHrState } from './mock-workflows'
import { createPeopleOperations, type PeopleOperationsState } from './people-operations'
import { createHrServiceDesk, type HrServiceDeskState } from './service-desk'
import { createRecruitingState, type RecruitingState } from './recruiting'
import { createPerformanceState, type PerformanceState } from './performance'
import { createSurveysState, type SurveysState } from './surveys'

/** One JSON snapshot keeps a hire and its linked HR requirements atomic. */
export type HrDemoState = {
  workflow: MockHrState; operations: PeopleOperationsState; serviceDesk: HrServiceDeskState;
  recruiting: RecruitingState; performance: PerformanceState; surveys: SurveysState;
  completed: string[]; acknowledgements: string[];
  managementRole: HrRole; selectedEmployee: string;
}

export function createHrDemoState(fixture: HrFixture): HrDemoState {
  return {
    workflow: createMockHrState(fixture), operations: createPeopleOperations(fixture),
    serviceDesk: createHrServiceDesk(fixture), recruiting: createRecruitingState(fixture),
    performance: createPerformanceState(fixture), surveys: createSurveysState(fixture),
    completed: [], acknowledgements: [], managementRole: 'employer-owner',
    selectedEmployee: (fixture.employees.find(employee => employee.managerId) ?? fixture.employees[0])?.id ?? '',
  }
}

type ObjectValue = Record<string, unknown>
type Check = (value: unknown) => boolean
const object = (value: unknown): value is ObjectValue => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const text = (value: unknown): value is string => typeof value === 'string' && value.length <= 10000
const id = (value: unknown): value is string => text(value) && /^[A-Za-z0-9_-]{1,200}$/.test(value) && !['__proto__', 'constructor', 'prototype'].includes(value)
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const sequence = (value: unknown) => number(value) && Number.isSafeInteger(value)
const boolean = (value: unknown) => typeof value === 'boolean'
const list = (value: unknown, check: Check): value is unknown[] => Array.isArray(value) && value.length <= 10000 && value.every(check)
const choice = (...values: string[]): Check => value => typeof value === 'string' && values.includes(value)
const optional = (value: unknown, check: Check) => value === undefined || check(value)
const fields = (value: unknown, checks: Record<string, Check>): value is ObjectValue => object(value) && Object.entries(checks).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]))
const map = (value: unknown, check: Check): value is ObjectValue => object(value) && Object.keys(value).length <= 10000 && Object.entries(value).every(([key, item]) => id(key) && check(item))
const unique = (items: ObjectValue[], key = 'id') => new Set(items.map(item => item[key])).size === items.length
const strings = (value: unknown) => list(value, text) && new Set(value).size === value.length
const roles = choice('employer-owner', 'payroll-admin', 'hr-admin', 'manager', 'employee', 'contractor', 'auditor')
const activity = (value: unknown) => fields(value, { receipt: text, action: text, actorRole: roles }) && optional(value.employeeId, id)
const record = (value: unknown) => fields(value, { id }) && ['title', 'name', 'status', 'employeeId', 'contractorId', 'type', 'description', 'receipt', 'version', 'dueDate'].every(key => optional(value[key], text))
const arrayObjects = (value: unknown, check: Check): value is ObjectValue[] => list(value, check) && unique(value as ObjectValue[])
const nonnegativeFields = { hours: number, grossCents: number, illustrativeWithholdingCents: number, benefitDeductionCents: number, netCents: number }

/** Reject incomplete, malformed or cross-linked snapshots before any UI consumes them.
 * This protects demo stability; browser storage remains user-editable sample data,
 * and these role selections never establish authentication or provider authority.
 */
export function isHrDemoState(value: unknown, base: HrFixture): value is HrDemoState {
  try { return validateHrDemoState(value, base) } catch { return false }
}

function validateHrDemoState(value: unknown, base: HrFixture): boolean {
  if (!fields(value, {
    workflow: object, operations: object, serviceDesk: object, recruiting: object, performance: object, surveys: object,
    completed: strings, acknowledgements: strings,
    managementRole: choice('employer-owner', 'payroll-admin', 'hr-admin', 'auditor'), selectedEmployee: text,
  })) return false
  const { recruiting: recruitingValue, workflow: workflowValue, operations: operationsValue, serviceDesk: serviceValue, performance: performanceValue, surveys: surveysValue } = value
  if (!object(recruitingValue) || !object(workflowValue) || !object(operationsValue) || !object(serviceValue) || !object(performanceValue) || !object(surveysValue)) return false
  const recruiting = recruitingValue
  const employeeCheck = (employee: unknown) => fields(employee, {
    id, firstName: text, lastName: text, workEmail: text, department: text, jobTitle: text,
    employmentStatus: text, managerId: entry => entry === null || id(entry), payCents: number,
    onboarding: entry => arrayObjects(entry, task => fields(task, { id, title: text, status: text })),
  }) && optional(employee.compensationConfigured, boolean) && optional(employee.compensationStatus, text)
  if (!fields(recruiting, {
    sequence,
    hiredEmployees: entry => arrayObjects(entry, employeeCheck),
    jobs: entry => arrayObjects(entry, job => fields(job, { id, title: text, department: text, managerId: id, status: choice('draft', 'published', 'closed'), activity: item => list(item, activity) })),
    candidates: entry => arrayObjects(entry, candidate => fields(candidate, { id, jobId: id, firstName: text, lastName: text, workEmail: text, stage: choice('applied', 'screening', 'interview', 'offer', 'hired', 'rejected'), activity: item => list(item, activity) }) && optional(candidate.employeeId, id)),
  })) return false
  const hires = recruiting.hiredEmployees as ObjectValue[]
  const employees = [...base.employees, ...hires]
  if (!unique(employees)) return false
  const employeeIds = new Set(employees.map(employee => employee.id))
  const knownEmployee: Check = entry => typeof entry === 'string' && employeeIds.has(entry)
  const knownContractor: Check = entry => typeof entry === 'string' && base.contractors.some(contractor => contractor.id === entry)
  const knownSubject = (entry: ObjectValue) => optional(entry.employeeId, knownEmployee) && optional(entry.contractorId, knownContractor)
  if (!knownEmployee(value.selectedEmployee) || hires.some(employee => employee.managerId !== null && !knownEmployee(employee.managerId))) return false
  const jobs = recruiting.jobs as ObjectValue[]
  const candidates = recruiting.candidates as ObjectValue[]
  if (jobs.some(job => !knownEmployee(job.managerId)) || candidates.some(candidate => !jobs.some(job => job.id === candidate.jobId))) return false
  if (candidates.some(candidate => candidate.stage === 'hired'
    ? !hires.some(employee => employee.id === candidate.employeeId && employee.workEmail === candidate.workEmail)
    : candidate.employeeId !== undefined)) return false
  if (hires.some(employee => candidates.filter(candidate => candidate.stage === 'hired' && candidate.employeeId === employee.id).length !== 1)) return false

  const knownPlan: Check = entry => typeof entry === 'string' && base.benefits.some(plan => plan.id === entry)
  const timeCheck = (entry: unknown) => fields(entry, { id, employeeId: knownEmployee, date: text, hours: item => number(item) && item <= 24, status: choice('draft', 'submitted', 'approved'), source: choice('manual', 'timer', 'fixture') }) && optional(entry.payrollReceipt, text)
  const payrollCheck = (entry: unknown) => fields(entry, {
    ...nonnegativeFields, stage: choice('idle', 'prepared', 'calculated', 'reviewed', 'submitted'),
    inputs: items => list(items, input => fields(input, { entryId: id, employeeId: knownEmployee, hours: number, rateCents: number })),
    benefitInputs: items => list(items, input => fields(input, { employeeId: knownEmployee, planId: knownPlan, deductionCents: number })),
    employeeTotals: items => list(items, total => fields(total, { employeeId: knownEmployee, ...nonnegativeFields })),
  }) && optional(entry.receipt, text)
  const workflow = workflowValue
  if (!fields(workflow, {
    sequence,
    onboarding: entry => map(entry, item => fields(item, { profileReviewed: boolean, jobReviewed: boolean, tasks: tasks => map(tasks, boolean), stage: choice('draft', 'reviewed', 'complete') }) && optional(item.receipt, text)),
    profileEmails: entry => map(entry, text), employeeStatuses: entry => map(entry, text),
    timeEntries: entry => arrayObjects(entry, timeCheck),
    benefitElections: entry => list(entry, item => fields(item, { employeeId: knownEmployee, planId: knownPlan, election: choice('enroll', 'waive'), stage: choice('draft', 'reviewed', 'confirmed') }) && optional(item.receipt, text)),
    payroll: payrollCheck, payrollHistory: entry => list(entry, item => payrollCheck(item) && object(item) && item.stage === 'submitted' && text(item.receipt)),
  })) return false
  // Every hire must restore its workflow maps and balance in the same snapshot.
  for (const name of ['onboarding', 'profileEmails', 'employeeStatuses']) {
    const entries = workflow[name] as ObjectValue
    if (Object.keys(entries).length !== employeeIds.size || !Object.keys(entries).every(knownEmployee)) return false
  }
  for (const employee of employees) {
    const onboarding = (workflow.onboarding as ObjectValue)[String(employee.id)] as ObjectValue
    const tasks = onboarding.tasks as ObjectValue
    const sourceTasks = employee.onboarding as { id: string }[]
    if (Object.keys(tasks).length !== sourceTasks.length || sourceTasks.some(task => !Object.hasOwn(tasks, task.id))) return false
  }
  const timeEntries = workflow.timeEntries as ObjectValue[]
  const payrolls = [workflow.payroll, ...(workflow.payrollHistory as ObjectValue[])] as ObjectValue[]
  if (payrolls.some(payroll => (payroll.inputs as ObjectValue[]).some(input => !timeEntries.some(entry => entry.id === input.entryId && entry.employeeId === input.employeeId)))) return false
  const benefitKeys = (workflow.benefitElections as ObjectValue[]).map(election => `${election.employeeId}:${election.planId}`)
  if (new Set(benefitKeys).size !== benefitKeys.length) return false

  const operations = operationsValue
  if (!fields(operations, {
    sequence,
    ptoRequests: entry => arrayObjects(entry, request => fields(request, { id, employeeId: knownEmployee, startDate: text, endDate: text, type: choice('vacation', 'sick'), hours: number, status: choice('pending', 'approved', 'rejected', 'cancelled') }) && optional(request.receipt, text) && optional(request.reason, text)),
    balances: entry => map(entry, balance => fields(balance, { vacation: number, sick: number })),
    records: entry => fields(entry, Object.fromEntries(['tasks', 'policies', 'training', 'assets', 'documents'].map(name => [name, (items: unknown) => arrayObjects(items, item => record(item) && object(item) && knownSubject(item))]))),
    activity: entry => arrayObjects(entry, item => fields(item, { id, receipt: text, sequence, action: text, actor: actor => fields(actor, { role: roles }) && knownSubject(actor), module: choice('time-off', 'tasks', 'policies', 'training', 'assets', 'documents'), recordId: id, previousStatus: text, status: text, description: text }) && knownSubject(item)),
  })) return false
  const balances = operations.balances as ObjectValue
  if (Object.keys(balances).length !== employeeIds.size || !Object.keys(balances).every(knownEmployee)) return false
  if (!fields(serviceValue, {
    sequence, requests: entry => arrayObjects(entry, request => fields(request, { id, category: choice('equipment', 'access', 'hr-general'), title: text, details: text, status: choice('open', 'in-progress', 'resolved'), assigneeId: assignee => assignee === null || assignee === 'hr-team' || knownEmployee(assignee), activity: items => list(items, activity) }) && optional(request.employeeId, knownEmployee) && optional(request.resolution, text)),
  })) return false
  if (!fields(performanceValue, {
    sequence,
    goals: entry => arrayObjects(entry, goal => fields(goal, { id, employeeId: knownEmployee, title: text, progress: item => number(item) && item <= 100, status: choice('draft', 'active', 'completed'), activity: items => list(items, activity) })),
    reviews: entry => arrayObjects(entry, review => fields(review, { id, employeeId: knownEmployee, managerId: knownEmployee, title: text, stage: choice('draft', 'self-submitted', 'manager-review', 'published', 'acknowledged'), activity: items => list(items, activity) }) && optional(review.selfComments, text) && optional(review.managerComments, text)),
  })) return false
  if (!fields(surveysValue, {
    sequence, surveys: entry => arrayObjects(entry, survey => fields(survey, {
      id, title: text, status: choice('draft', 'published', 'closed'),
      audienceIds: items => list(items, knownEmployee) && new Set(items).size === items.length,
      questions: questions => fields(questions, { ratingPrompt: text, textPrompt: text }),
      responses: items => list(items, response => fields(response, { employeeId: knownEmployee, rating: rating => sequence(rating) && number(rating) && rating >= 1 && rating <= 5, text, status: choice('draft', 'submitted') }) && optional(response.receipt, text)),
      activity: items => list(items, activity),
    }) && optional(survey.receipt, text) && (survey.responses as ObjectValue[]).every(response => (survey.audienceIds as unknown[]).includes(response.employeeId)) && unique(survey.responses as ObjectValue[], 'employeeId')),
  })) return false
  return true
}
