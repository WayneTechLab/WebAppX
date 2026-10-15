import type { HrEmployee, HrFixture, HrRole } from './model'
import type { HrEmploymentInstance } from './lifecycle-types'
import { createMockHrState, validMockPeriod, type MockHrState } from './mock-workflows'
import { validateTimeEntry } from './model'
import { createPeopleOperations, type PeopleOperationsState } from './people-operations'
import { createHrServiceDesk, type HrServiceDeskState } from './service-desk'
import { createRecruitingState, hrOnboardingTemplate, type RecruitingState } from './recruiting'
import { createPerformanceState, type PerformanceState } from './performance'
import { createSurveysState, type SurveysState } from './surveys'
import { assertRecruitingBaselineInstance, assertValidRecruitingLifecycle } from './recruiting-lifecycle-validation'
import { canonicalRecruitingJson } from './recruiting-lifecycle-value'

/** One JSON snapshot keeps a hire and its linked HR requirements atomic. */
export type HrDemoState = {
  workflow: MockHrState; operations: PeopleOperationsState; serviceDesk: HrServiceDeskState;
  recruiting: RecruitingState; performance: PerformanceState; surveys: SurveysState;
  completed: string[]; acknowledgements: string[];
  managementRole: HrRole; selectedEmployee: string; selectedManager?: string;
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
  // A present extension opts the whole saved envelope into plain JSON before
  // structural validation can read any user-defined nested property.
  if (object(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, 'recruiting')
    if (descriptor && !('value' in descriptor)) return false
    if (descriptor && 'value' in descriptor && object(descriptor.value) && Object.hasOwn(descriptor.value, 'lifecycle')) canonicalRecruitingJson({ schemaVersion: 1, module: 'hr', data: value })
  }
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
  if (!optional(value.selectedManager, knownEmployee)) return false
  if (!knownEmployee(value.selectedEmployee) || hires.some(employee => employee.managerId !== null && !knownEmployee(employee.managerId))) return false
  const jobs = recruiting.jobs as ObjectValue[]
  const candidates = recruiting.candidates as ObjectValue[]
  if (jobs.some(job => !knownEmployee(job.managerId)) || candidates.some(candidate => !jobs.some(job => job.id === candidate.jobId))) return false
  if (candidates.some(candidate => candidate.stage === 'hired'
    ? !hires.some(employee => employee.id === candidate.employeeId && employee.workEmail === candidate.workEmail)
    : candidate.employeeId !== undefined)) return false
  const hasRecruitingLifecycle = Object.hasOwn(recruiting, 'lifecycle')
  if (!hasRecruitingLifecycle && hires.some(employee => candidates.filter(candidate => candidate.stage === 'hired' && candidate.employeeId === employee.id).length !== 1)) return false

  const knownPlan: Check = entry => typeof entry === 'string' && base.benefits.some(plan => plan.id === entry)
  const date: Check = entry => typeof entry === 'string' && validateTimeEntry(entry, 1).valid
  const hourlyRate: Check = entry => sequence(entry) && number(entry) && entry > 0 && entry <= 1_000_000
  const timeCheck = (entry: unknown) => fields(entry, { id, employeeId: knownEmployee, date: text, hours: item => number(item) && item <= 24, status: choice('draft', 'submitted', 'approved'), source: choice('manual', 'timer', 'fixture') }) && optional(entry.payrollReceipt, text)
    && (entry.returnReason === undefined && entry.returnedBy === undefined || typeof entry.returnReason === 'string' && entry.returnReason.trim() === entry.returnReason && entry.returnReason.length > 0 && entry.returnReason.length <= 500 && !/[\r\n]/.test(entry.returnReason) && !entry.returnReason.includes('\0') && knownEmployee(entry.returnedBy) && entry.returnedBy !== entry.employeeId)
  const payrollCheck = (entry: unknown) => fields(entry, {
    ...nonnegativeFields, stage: choice('idle', 'prepared', 'calculated', 'reviewed', 'submitted'),
    inputs: items => list(items, input => fields(input, { entryId: id, employeeId: knownEmployee, hours: number, rateCents: number })
      && (input.date === undefined && input.rateEffectiveFrom === undefined || date(input.date) && date(input.rateEffectiveFrom) && String(input.rateEffectiveFrom) <= String(input.date) && hourlyRate(input.rateCents))),
    benefitInputs: items => list(items, input => fields(input, { employeeId: knownEmployee, planId: knownPlan, deductionCents: number })),
    employeeTotals: items => list(items, total => fields(total, { employeeId: knownEmployee, ...nonnegativeFields })),
  }) && optional(entry.receipt, text) && optional(entry.period, validMockPeriod)
    && (entry.period === undefined || (entry.inputs as ObjectValue[]).every(input => date(input.date) && date(input.rateEffectiveFrom) && object(entry.period) && String(input.date) >= String(entry.period.start) && String(input.date) <= String(entry.period.end)))
  const workflow = workflowValue
  if (!fields(workflow, {
    sequence,
    onboarding: entry => map(entry, item => fields(item, { profileReviewed: boolean, jobReviewed: boolean, tasks: tasks => map(tasks, boolean), stage: choice('draft', 'reviewed', 'complete') }) && optional(item.receipt, text)),
    profileEmails: entry => map(entry, text), employeeStatuses: entry => map(entry, text),
    timeEntries: entry => arrayObjects(entry, timeCheck),
    benefitElections: entry => list(entry, item => fields(item, { employeeId: knownEmployee, planId: knownPlan, election: choice('enroll', 'waive'), stage: choice('draft', 'reviewed', 'confirmed') }) && optional(item.receipt, text)),
    payroll: payrollCheck, payrollHistory: entry => list(entry, item => payrollCheck(item) && object(item) && item.stage === 'submitted' && text(item.receipt)),
  })) return false
  if (workflow.sampleRates !== undefined && (!object(workflow.sampleRates) || !Object.entries(workflow.sampleRates).every(([employeeId, timeline]) => knownEmployee(employeeId)
    && Array.isArray(timeline) && timeline.length > 0 && timeline.length <= 1000 && timeline.every((rate, index) => fields(rate, { effectiveFrom: date, hourlyRateCents: hourlyRate })
      && Object.keys(rate).length === 2 && (index === 0 || String(timeline[index - 1].effectiveFrom) < String(rate.effectiveFrom)))))) return false
  // Every hire must restore its workflow maps and balance in the same snapshot.
  for (const name of ['onboarding', 'profileEmails', 'employeeStatuses']) {
    const entries = workflow[name] as ObjectValue
    if (Object.keys(entries).length !== employeeIds.size || !Object.keys(entries).every(knownEmployee)) return false
  }
  for (const employee of employees) {
    const onboarding = (workflow.onboarding as ObjectValue)[String(employee.id)] as ObjectValue
    const tasks = onboarding.tasks as ObjectValue
    const extension = object(workflow.lifecycle) ? workflow.lifecycle : undefined
    const instance = extension && object(extension.activeInstances) && Array.isArray(extension.instances) ? extension.instances.find(item => object(item) && item.id === (extension.activeInstances as ObjectValue)[String(employee.id)]) : undefined
    const sourceTasks = (object(instance) && Array.isArray(instance.tasks) ? instance.tasks : employee.onboarding) as { id: string }[]
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
  if (hasRecruitingLifecycle) assertValidRecruitingLifecycle(value as HrDemoState, base)
  return validateLifecycle(value, employees, hasRecruitingLifecycle)
}


/** The extension is optional, but a present extension is never a legacy fallback. */
function validateLifecycle(state: ObjectValue, employees: ObjectValue[], hasRecruitingLifecycle: boolean): boolean {
  const workflow = state.workflow as ObjectValue
  if (workflow.lifecycle === undefined) return true
  const exact = (value: unknown, required: string[], allowed: string[] = []): value is ObjectValue => object(value) && required.every(key => Object.hasOwn(value, key)) && Object.keys(value).every(key => required.includes(key) || allowed.includes(key))
  const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : object(value) ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, stable(entry)])) : value
  const equal = (a: unknown, b: unknown) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))
  const date = (value: unknown): value is string => typeof value === 'string' && validateTimeEntry(value, 1).valid
  const printable = (value: unknown, max = 100): value is string => typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= max && !Array.from(value).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  const syntheticEmail = (value: unknown) => printable(value, 160) && /^[^\s@]+@[^\s@]+\.invalid$/i.test(value)
  const known = (value: unknown): value is string => typeof value === 'string' && employees.some(employee => employee.id === value)
  const actor = (value: unknown): value is ObjectValue => exact(value, ['role'], ['employeeId', 'contractorId']) && roles(value.role) && optional(value.employeeId, known) && optional(value.contractorId, id)
  const writer = (value: ObjectValue) => ['employer-owner', 'hr-admin'].includes(String(value.role))
  const snapshot = (value: unknown): value is ObjectValue => exact(value, ['status', 'department', 'jobTitle', 'managerId']) && printable(value.status, 40) && printable(value.department, 80) && printable(value.jobTitle) && (value.managerId === null || known(value.managerId))
  const lifecycle = workflow.lifecycle
  if (!exact(lifecycle, ['schemaVersion', 'simulationDate', 'sequence', 'selectedTemplateVersion', 'instances', 'activeInstances', 'events', 'directoryHistory', 'corrections', 'offboardingAssignments']) || lifecycle.schemaVersion !== 1 || !(lifecycle.simulationDate === null || date(lifecycle.simulationDate)) || !sequence(lifecycle.sequence) || Number(lifecycle.sequence) < 1) return false
  if (!['sample-v1', 'sample-v2'].includes(String(lifecycle.selectedTemplateVersion))) return false
  if (!arrayObjects(lifecycle.instances, value => exact(value, ['id', 'employeeId', 'startDate', 'endDate', 'initial', 'current', 'templateVersion', 'tasks'], ['previousInstanceId', 'archivedOnboarding', ...(hasRecruitingLifecycle ? ['recruitingBaseline'] : [])]) && id(value.id) && known(value.employeeId) && (value.startDate === null || date(value.startDate)) && (value.endDate === null || date(value.endDate)) && snapshot(value.initial) && snapshot(value.current) && printable(value.templateVersion, 200) && arrayObjects(value.tasks, task => exact(task, ['id', 'title']) && id(task.id) && printable(task.title, 200)) && optional(value.previousInstanceId, id))) return false
  const instances = lifecycle.instances as ObjectValue[]
  if (!map(lifecycle.activeInstances, id) || Object.keys(lifecycle.activeInstances).length !== employees.length || !Object.keys(lifecycle.activeInstances).every(known)) return false
  const active = lifecycle.activeInstances as ObjectValue
  const events = lifecycle.events
  if (!arrayObjects(events, value => exact(value, ['id', 'sequence', 'kind', 'effectiveDate', 'actor', 'reason', 'previous', 'proposed'], ['employeeId', 'instanceId']) && id(value.id) && sequence(value.sequence) && Number(value.sequence) > 0 && value.id === `lifecycle-${value.sequence}` && choice('transfer', 'leave', 'return', 'terminate', 'rehire', 'hire', 'onboarding-complete', 'select-template', 'set-simulation-date')(value.kind) && (date(value.effectiveDate) || value.effectiveDate === null && ['hire', 'onboarding-complete'].includes(String(value.kind))) && actor(value.actor) && text(value.reason) && (value.previous === null || typeof value.previous === 'string' || snapshot(value.previous)) && (typeof value.proposed === 'string' || snapshot(value.proposed)) && optional(value.employeeId, known) && optional(value.instanceId, id))) return false
  const changes = events as ObjectValue[]
  if (lifecycle.simulationDate === null && (changes.some(change => change.effectiveDate !== null) || instances.some(instance => instance.startDate !== null))) return false
  if (changes.some((change, index) => change.effectiveDate !== null && String(change.effectiveDate) > String(lifecycle.simulationDate) || index > 0 && Number(changes[index - 1].sequence) >= Number(change.sequence))) return false
  let selected = 'sample-v1'
  for (const change of changes) {
    if (change.kind === 'set-simulation-date') {
      if (change.employeeId !== undefined || change.instanceId !== undefined || !writer(change.actor as ObjectValue) || !(change.previous === null || date(change.previous)) || change.proposed !== change.effectiveDate || change.reason !== '') return false
    } else if (change.kind === 'select-template') {
      if (change.employeeId !== undefined || change.instanceId !== undefined || !writer(change.actor as ObjectValue) || change.previous !== selected || !['sample-v1', 'sample-v2'].includes(String(change.proposed)) || change.previous === change.proposed || change.reason !== '') return false
      selected = String(change.proposed)
    } else if (!instances.some(instance => instance.id === change.instanceId && instance.employeeId === change.employeeId)) return false
  }
  if (selected !== lifecycle.selectedTemplateVersion) return false
  // Reconstruct every accepted graph and template choice, not only its final view.
  const historical = new Map(instances.filter(instance => String(instance.templateVersion).startsWith('legacy-') || Object.hasOwn(instance, 'recruitingBaseline')).map(instance => [instance.employeeId, instance.initial as ObjectValue]))
  let historicalTemplate = 'sample-v1'
  const graphValid = () => {
    for (const [employeeId, entry] of historical) {
      const seen = new Set<unknown>([employeeId]); let manager = entry.managerId
      while (manager !== null) { if (seen.has(manager)) return false; seen.add(manager); const next = historical.get(manager); if (!next) return false; manager = next.managerId }
    }
    return true
  }
  if (!graphValid()) return false
  for (const change of changes) {
    if (change.kind === 'select-template') historicalTemplate = String(change.proposed)
    else if (change.kind !== 'set-simulation-date') {
      const instance = instances.find(instance => instance.id === change.instanceId)!
      if ((change.kind === 'hire' || change.kind === 'rehire') && instance.templateVersion !== historicalTemplate) return false
      if (!snapshot(change.proposed)) return false
      historical.set(change.employeeId, change.proposed)
      if (!graphValid()) return false
    }
  }
  const onboardingCheck = (value: unknown, tasks: ObjectValue[]) => exact(value, ['profileReviewed', 'jobReviewed', 'tasks', 'stage'], ['receipt']) && boolean(value.profileReviewed) && boolean(value.jobReviewed) && map(value.tasks, boolean) && choice('draft', 'reviewed', 'complete')(value.stage) && optional(value.receipt, text) && Object.keys(value.tasks).length === tasks.length && tasks.every(task => Object.hasOwn(value.tasks as ObjectValue, String(task.id)))
  const receipts = new Set<string>()
  for (const employee of employees) {
    const chain = instances.filter(instance => instance.employeeId === employee.id)
    if (!chain.length || active[String(employee.id)] !== chain.at(-1)!.id) return false
    for (let index = 0; index < chain.length; index++) {
      const instance = chain[index]; const tasks = instance.tasks as ObjectValue[]
      const recruitingBaseline = Object.hasOwn(instance, 'recruitingBaseline')
      if (instance.id !== `employment-${employee.id}-${index + 1}` || instance.previousInstanceId !== (index ? chain[index - 1].id : undefined)) return false
      if (recruitingBaseline) {
        if (!hasRecruitingLifecycle || index !== 0) return false
        assertRecruitingBaselineInstance(state as HrDemoState, employee as HrEmployee, instance as HrEmploymentInstance)
      }
      if (index === 0) {
        const initial = instance.initial as ObjectValue
        if (initial.department !== employee.department || initial.jobTitle !== employee.jobTitle || initial.managerId !== employee.managerId) return false
        if (employee.onboardingTemplateVersion !== undefined && instance.templateVersion !== employee.onboardingTemplateVersion) return false
      }
      if (recruitingBaseline) {
        // The strict capture above supplies the immutable template and status.
      } else if (index === 0 && instance.startDate === null && instance.templateVersion === `legacy-${employee.id}`) {
        if (!equal(tasks, (employee.onboarding as ObjectValue[]).map(task => ({ id: task.id, title: task.title })))) return false
      } else {
        if (!(date(instance.startDate) || index === 0 && instance.startDate === null) || instance.startDate !== null && String(instance.startDate) > String(lifecycle.simulationDate)) return false
        let template
        try { template = hrOnboardingTemplate(String(instance.templateVersion)) } catch { return false }
        if (!equal(tasks, template.tasks) || (instance.initial as ObjectValue).status !== 'onboarding') return false
        if (index && (!date(chain[index - 1].endDate) || String(instance.startDate) <= String(chain[index - 1].endDate))) return false
      }
      if (instance.endDate !== null && (!date(instance.endDate) || instance.endDate > String(lifecycle.simulationDate) || instance.startDate !== null && String(instance.endDate) < String(instance.startDate))) return false
      let current = instance.initial as ObjectValue; let lastDate = instance.startDate as string | null
      for (const change of changes.filter(change => change.instanceId === instance.id)) {
        if (lastDate && (change.effectiveDate === null || String(change.effectiveDate) < lastDate)) return false
        if (change.effectiveDate !== null) lastDate = String(change.effectiveDate)
        if (change.kind === 'rehire' || change.kind === 'hire') {
          if ((instance.initial as ObjectValue).status !== 'onboarding' || change.previous !== null || !equal(change.proposed, instance.initial) || change.effectiveDate !== instance.startDate || !writer(change.actor as ObjectValue)) return false
          continue
        }
        if (!equal(change.previous, current) || !snapshot(change.proposed) || current.status === 'terminated') return false
        const proposed = change.proposed
        if (change.kind === 'onboarding-complete') {
          const author = change.actor as ObjectValue
          if (!(writer(author) || author.role === 'payroll-admin' || author.role === 'employee' && author.employeeId === employee.id) || ['terminated', 'on-leave'].includes(String(current.status)) || proposed.status !== 'active' || !equal({ ...current, status: 'active' }, proposed)) return false
        } else {
          if (!writer(change.actor as ObjectValue)) return false
          if (change.kind === 'transfer') {
            if (change.reason !== '' || equal(current, proposed) || current.status !== proposed.status || current.jobTitle !== proposed.jobTitle) return false
          } else {
            if (!printable(change.reason, 500) || String(change.reason).length < 2 || !equal({ ...current, status: proposed.status }, proposed)) return false
            if (change.kind === 'leave' && !(current.status === 'active' && proposed.status === 'on-leave') || change.kind === 'return' && !(current.status === 'on-leave' && proposed.status === 'active') || change.kind === 'terminate' && !(['active', 'on-leave', 'onboarding'].includes(String(current.status)) && proposed.status === 'terminated' && instance.endDate === change.effectiveDate)) return false
          }
        }
        current = proposed
      }
      if (!equal(current, instance.current) || (current.status === 'terminated') !== (instance.endDate !== null)) return false
      if (index > 0 && changes.filter(change => change.instanceId === instance.id && change.kind === 'rehire').length !== 1) return false
      const hires = changes.filter(change => change.instanceId === instance.id && change.kind === 'hire')
      if (recruitingBaseline ? hires.length !== 0 : index === 0 && !String(instance.templateVersion).startsWith('legacy-') && hires.length !== 1) return false
      const currentOnboarding = (workflow.onboarding as ObjectValue)[String(employee.id)]
      const captured = index === chain.length - 1 ? currentOnboarding : instance.archivedOnboarding
      if (!onboardingCheck(captured, tasks) || index === chain.length - 1 && instance.archivedOnboarding !== undefined || index < chain.length - 1 && current.status !== 'terminated') return false
      const completions = changes.filter(change => change.instanceId === instance.id && change.kind === 'onboarding-complete')
      if (completions.length > 1 || completions.length === 1 && (!object(captured) || captured.stage !== 'complete' || captured.profileReviewed !== true || captured.jobReviewed !== true || !printable(captured.receipt, 200) || !Object.values(captured.tasks as ObjectValue).every(value => value === true))) return false
      const observedCompletion = recruitingBaseline && object(instance.recruitingBaseline) && instance.recruitingBaseline.completion !== null
      if (observedCompletion && (completions.length !== 0 || !equal(captured, (instance.recruitingBaseline as ObjectValue).capturedOnboarding))) return false
      if (!observedCompletion && !String(instance.templateVersion).startsWith('legacy-') && object(captured) && captured.stage === 'complete' && completions.length !== 1) return false
      if (object(captured) && typeof captured.receipt === 'string') { if (receipts.has(captured.receipt)) return false; receipts.add(captured.receipt) }
    }
    if ((chain.at(-1)!.current as ObjectValue).status !== (workflow.employeeStatuses as ObjectValue)[String(employee.id)]) return false
  }
  const projected = new Map(instances.filter(instance => active[String(instance.employeeId)] === instance.id).map(instance => [instance.employeeId, instance.current as ObjectValue]))
  for (const [employeeId, value] of projected) {
    const seen = new Set<unknown>([employeeId]); let manager = value.managerId
    while (manager !== null) { if (seen.has(manager)) return false; seen.add(manager); const next = projected.get(manager); if (!next) return false; manager = next.managerId }
  }
  if (((state.performance as ObjectValue).reviews as ObjectValue[]).some(review => review.stage !== 'acknowledged' && projected.get(review.employeeId)?.managerId !== review.managerId)) return false
  if (!arrayObjects(lifecycle.directoryHistory, value => exact(value, ['id', 'sequence', 'employeeId', 'field', 'oldValue', 'newValue', 'actor', 'origin'], ['correctionId']) && sequence(value.sequence) && Number(value.sequence) > 0 && value.id === `directory-${value.sequence}` && known(value.employeeId) && value.field === 'workEmail' && text(value.oldValue) && printable(value.newValue, 160) && value.oldValue !== value.newValue && actor(value.actor) && choice('direct', 'correction')(value.origin) && optional(value.correctionId, id))) return false
  const history = lifecycle.directoryHistory as ObjectValue[]
  if (!arrayObjects(lifecycle.corrections, value => exact(value, ['id', 'sequence', 'employeeId', 'instanceId', 'field', 'oldValue', 'proposedValue', 'status', 'actor'], ['outcome']) && sequence(value.sequence) && Number(value.sequence) > 0 && value.id === `correction-${value.sequence}` && known(value.employeeId) && instances.some(instance => instance.id === value.instanceId && instance.employeeId === value.employeeId) && value.field === 'workEmail' && text(value.oldValue) && syntheticEmail(value.proposedValue) && value.oldValue !== value.proposedValue && choice('pending', 'accepted', 'rejected')(value.status) && actor(value.actor) && ['employee', 'manager'].includes(String(value.actor.role)) && value.actor.employeeId === value.employeeId && (value.status === 'pending' ? value.outcome === undefined : exact(value.outcome, ['sequence', 'actor', 'reason']) && sequence(value.outcome.sequence) && Number(value.outcome.sequence) > Number(value.sequence) && actor(value.outcome.actor) && writer(value.outcome.actor) && printable(value.outcome.reason, 500) && String(value.outcome.reason).length >= 2))) return false
  const corrections = lifecycle.corrections as ObjectValue[]
  if (corrections.some(correction => correction.status === 'pending' && corrections.filter(item => item.employeeId === correction.employeeId && item.status === 'pending').length !== 1)) return false
  for (const correction of corrections) {
    const ownerInstance = instances.find(instance => instance.id === correction.instanceId)!
    const created = changes.find(change => change.instanceId === ownerInstance.id && (change.kind === 'hire' || change.kind === 'rehire'))
    const replaced = changes.find(change => change.kind === 'rehire' && instances.some(instance => instance.id === change.instanceId && instance.previousInstanceId === ownerInstance.id))
    if (created && Number(correction.sequence) < Number(created.sequence) || replaced && Number(correction.sequence) > Number(replaced.sequence)) return false
    if (object(correction.outcome) && replaced && Number(correction.outcome.sequence) > Number(replaced.sequence)) return false
  }
  for (const change of history) {
    const author = change.actor as ObjectValue
    if (!writer(author) && !(author.role === 'employee' && author.employeeId === change.employeeId)) return false
    if (change.origin === 'direct' && change.correctionId !== undefined) return false
    if (change.origin === 'correction' && history.some(previous => previous.employeeId === change.employeeId && Number(previous.sequence) > Number(corrections.find(correction => correction.id === change.correctionId)?.sequence ?? Infinity) && Number(previous.sequence) < Number(change.sequence))) return false
    if (change.origin === 'correction' && !corrections.some(correction => correction.id === change.correctionId && correction.status === 'accepted' && correction.employeeId === change.employeeId && correction.oldValue === change.oldValue && correction.proposedValue === change.newValue && equal((correction.outcome as ObjectValue).actor, author) && Number(correction.sequence) < Number(change.sequence) && Number(change.sequence) < Number((correction.outcome as ObjectValue).sequence))) return false
  }
  for (const employee of employees) {
    const rows = history.filter(change => change.employeeId === employee.id)
    if (rows.some((row, index) => index > 0 && (Number(rows[index - 1].sequence) >= Number(row.sequence) || rows[index - 1].newValue !== row.oldValue))) return false
    if (rows.length && rows.at(-1)!.newValue !== (workflow.profileEmails as ObjectValue)[String(employee.id)]) return false
  }
  if (corrections.some(correction => history.filter(change => change.correctionId === correction.id).length !== (correction.status === 'accepted' ? 1 : 0))) return false
  if (!arrayObjects(lifecycle.offboardingAssignments, value => exact(value, ['id', 'employeeId', 'instanceId', 'transitionId', 'kind', 'title', 'status']) && id(value.id) && known(value.employeeId) && id(value.instanceId) && id(value.transitionId) && choice('asset', 'access', 'handover')(value.kind) && printable(value.title, 200) && value.status === 'assigned')) return false
  const assignments = lifecycle.offboardingAssignments as ObjectValue[]
  if (assignments.some(assignment => !changes.some(change => change.kind === 'terminate' && change.id === assignment.transitionId && change.employeeId === assignment.employeeId && change.instanceId === assignment.instanceId) || assignment.id !== `${assignment.transitionId}-${assignment.kind}`)) return false
  const operationTasks = ((state.operations as ObjectValue).records as ObjectValue).tasks as ObjectValue[]
  if (assignments.some(assignment => operationTasks.filter(task => task.id === assignment.id && task.employeeId === assignment.employeeId && task.employmentInstanceId === assignment.instanceId && task.sourceId === assignment.id && task.lifecycleTransitionId === assignment.transitionId && task.offboardingKind === assignment.kind && task.title === assignment.title && ['pending', 'completed'].includes(String(task.status))).length !== 1)) return false
  if (operationTasks.some(task => task.lifecycleTransitionId !== undefined && !assignments.some(assignment => assignment.id === task.id))) return false
  if (changes.filter(change => change.kind === 'terminate').some(change => { const rows = assignments.filter(assignment => assignment.transitionId === change.id); return rows.length !== 3 || new Set(rows.map(row => row.kind)).size !== 3 })) return false
  const sequences = [...changes.map(change => change.sequence), ...history.map(change => change.sequence), ...corrections.flatMap(correction => [correction.sequence, ...(object(correction.outcome) ? [correction.outcome.sequence] : [])])].map(Number).sort((a, b) => a - b)
  return sequences.length === Number(lifecycle.sequence) - 1 && sequences.every((value, index) => value === index + 1)
}
