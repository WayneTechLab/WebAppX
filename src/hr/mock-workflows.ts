import type { HrEmploymentInstance, HrLifecycleState } from './lifecycle-types'
import type { RecruitingState } from './recruiting'
import { recruitingEmploymentBaseline } from './recruiting-employment-baseline'
import { canApproveTimeEntry, canEditEmployeeProfile, validateTimeEntry, type HrActor, type HrFixture, type HrRecord } from './model'

export type MockOnboarding = { profileReviewed: boolean; jobReviewed: boolean; tasks: Record<string, boolean>; stage: 'draft' | 'reviewed' | 'complete'; receipt?: string }
export type MockTimeEntry = HrRecord & { employeeId: string; date: string; hours: number; status: 'draft' | 'submitted' | 'approved'; source: 'manual' | 'timer' | 'fixture'; payrollReceipt?: string; returnReason?: string; returnedBy?: string }
export type MockSamplePeriod = { start: string; end: string }
export type MockSampleRate = { effectiveFrom: string; hourlyRateCents: number }
export type MockPayrollInput = { entryId: string; employeeId: string; hours: number; rateCents: number; date?: string; rateEffectiveFrom?: string }
export type MockBenefitElection = { employeeId: string; planId: string; election: 'enroll' | 'waive'; stage: 'draft' | 'reviewed' | 'confirmed'; receipt?: string }
export type MockTimer = { employeeId: string; role: HrActor['role']; date: string; startedAt: number }
export type MockPayrollEmployeeTotal = { employeeId: string; hours: number; grossCents: number; illustrativeWithholdingCents: number; benefitDeductionCents: number; netCents: number }
export type MockPayroll = {
  stage: 'idle' | 'prepared' | 'calculated' | 'reviewed' | 'submitted';
  inputs: MockPayrollInput[];
  period?: MockSamplePeriod;
  benefitInputs: { employeeId: string; planId: string; deductionCents: number }[];
  employeeTotals: MockPayrollEmployeeTotal[];
  hours: number; grossCents: number; illustrativeWithholdingCents: number; benefitDeductionCents: number; netCents: number; receipt?: string;
}
export type MockHrState = { onboarding: Record<string, MockOnboarding>; profileEmails: Record<string, string>; employeeStatuses: Record<string, string>; timeEntries: MockTimeEntry[]; benefitElections: MockBenefitElection[]; payroll: MockPayroll; payrollHistory: MockPayroll[]; sequence: number; sampleRates?: Record<string, MockSampleRate[]>; lifecycle?: HrLifecycleState }
export type MockHrEvent =
  | { type: 'review-profile' | 'review-job' | 'review-onboarding' | 'complete-onboarding'; employeeId: string; instanceId?: string }
  | { type: 'change-profile'; employeeId: string; workEmail: string }
  | { type: 'check-task'; employeeId: string; taskId: string; complete: boolean; instanceId?: string }
  | { type: 'add-time'; date: string; hours: number; source: 'manual' | 'timer' }
  | { type: 'submit-time'; entryIds: string[] }
  | { type: 'approve-time'; entryId: string }
  | { type: 'return-time'; entryId: string; reason: string }
  | { type: 'edit-time'; entryId: string; date: string; hours: number }
  | { type: 'delete-time'; entryId: string; confirmed: boolean }
  | { type: 'set-sample-rate'; employeeId: string; effectiveFrom: string; hourlyRateCents: number }
  | { type: 'elect-benefit'; planId: string; election: 'enroll' | 'waive' }
  | { type: 'review-benefit' | 'confirm-benefit'; planId: string }
  | { type: 'prepare-payroll'; period: MockSamplePeriod }
  | { type: 'calculate-payroll' | 'review-payroll' | 'submit-payroll' }

const blankPayroll = (): MockPayroll => ({ stage: 'idle', inputs: [], benefitInputs: [], employeeTotals: [], hours: 0, grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: 0 })
export const MOCK_HOURLY_RATE_CENTS = 3000
export const MOCK_WITHHOLDING_RATE = 0.2
export const MOCK_BENEFIT_DEDUCTION_CENTS = 2500
export const MOCK_PAY_PERIOD = Object.freeze({ start: '2026-10-01', end: '2026-10-15' })

/** Optional extensions preserve legacy save/export/history shapes. New runs
 * must deliberately supply a period and rates; old payCents has no cadence. */
export function validMockPeriod(value: unknown): value is MockSamplePeriod {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const period = value as MockSamplePeriod
  if (Object.keys(value).length !== 2 || typeof period.start !== 'string' || typeof period.end !== 'string'
    || !validateTimeEntry(period.start, 1).valid || !validateTimeEntry(period.end, 1).valid) return false
  const days = (Date.parse(period.end + 'T00:00:00Z') - Date.parse(period.start + 'T00:00:00Z')) / 86400000 + 1
  return days >= 1 && days <= 366
}

export function sampleRateFor(state: MockHrState, employeeId: string, date: string): MockSampleRate | undefined {
  return state.sampleRates?.[employeeId]?.filter(rate => rate.effectiveFrom <= date).at(-1)
}

export function payrollEligibility(state: MockHrState, fixture: HrFixture, period: unknown) {
  const validPeriod = validMockPeriod(period)
  return state.timeEntries.map(entry => {
    const reasons: string[] = []
    if (!validPeriod) reasons.push('Choose a valid sample period (1–366 calendar days).')
    if (entry.payrollReceipt) reasons.push(`Already consumed by ${entry.payrollReceipt}.`)
    if (entry.status !== 'approved') reasons.push(entry.status === 'draft' && entry.returnReason ? `Returned draft: ${entry.returnReason}` : `Time is ${entry.status}, not approved.`)
    const validEntry = validateTimeEntry(entry.date, entry.hours)
    if (!validEntry.valid) reasons.push(validEntry.error ?? 'Invalid time entry.')
    if (state.timeEntries.filter(value => value.employeeId === entry.employeeId && value.date === entry.date).reduce((sum, value) => sum + value.hours, 0) > 24) reasons.push('Combined employee/day hours exceed 24.')
    if (!fixture.employees.some(employee => employee.id === entry.employeeId) || state.employeeStatuses[entry.employeeId] !== 'active') reasons.push('Employee is not active in this sample.')
    if (validPeriod && (entry.date < period.start || entry.date > period.end)) reasons.push('Work date is outside the selected period.')
    const baseEligible = reasons.length === 0
    const rate = sampleRateFor(state, entry.employeeId, entry.date)
    if (!rate) reasons.push('No explicit fictional hourly rate is configured for this work date.')
    return { entryId: entry.id, employeeId: entry.employeeId, date: entry.date, hours: entry.hours,
      included: reasons.length === 0, baseEligible, reasons,
      ...(rate ? { rateCents: rate.hourlyRateCents, rateEffectiveFrom: rate.effectiveFrom } : {}) }
  })
}

function payrollSnapshot(state: MockHrState, fixture: HrFixture, period: MockSamplePeriod) {
  const eligibility = payrollEligibility(state, fixture, period)
  const missing = eligibility.filter(entry => entry.baseEligible && entry.rateCents === undefined)
  if (missing.length) throw new Error(`Configure an explicit fictional hourly rate for every eligible employee/work date: ${[...new Set(missing.map(entry => entry.employeeId))].join(', ')}.`)
  const included = eligibility.filter(entry => entry.included)
  const employeeIds = new Set(included.map(entry => entry.employeeId))
  return {
    inputs: included.map(entry => ({ entryId: entry.entryId, employeeId: entry.employeeId, date: entry.date, hours: entry.hours, rateCents: entry.rateCents!, rateEffectiveFrom: entry.rateEffectiveFrom! })),
    benefitInputs: state.benefitElections.filter(election => election.stage === 'confirmed' && election.election === 'enroll' && employeeIds.has(election.employeeId))
      .map(election => ({ employeeId: election.employeeId, planId: election.planId, deductionCents: MOCK_BENEFIT_DEDUCTION_CENTS })),
  }
}

export function payrollFreshness(state: MockHrState, fixture: HrFixture): { stale: boolean; reason: string } {
  if (state.payroll.stage === 'idle' || state.payroll.stage === 'submitted') return { stale: false, reason: '' }
  if (!validMockPeriod(state.payroll.period) || state.payroll.inputs.some(input => !input.date || !input.rateEffectiveFrom)) {
    return { stale: true, reason: 'Legacy preparation needs a chosen period and explicit fictional rates. Reprepare sample payroll.' }
  }
  try {
    const snapshot = payrollSnapshot(state, fixture, state.payroll.period)
    const signature = (value: Pick<MockPayroll, 'inputs' | 'benefitInputs'>) => JSON.stringify([
      value.inputs.map(input => [input.entryId, input.employeeId, input.date, input.hours, input.rateCents, input.rateEffectiveFrom]).sort((left, right) => String(left[0]).localeCompare(String(right[0]))),
      value.benefitInputs.map(input => [input.employeeId, input.planId, input.deductionCents]).sort((left, right) => `${left[0]}:${left[1]}`.localeCompare(`${right[0]}:${right[1]}`)),
    ])
    const changed = signature(snapshot) !== signature(state.payroll)
    return { stale: changed, reason: changed ? 'Approved hours, eligibility, rates or confirmed benefits changed. Reprepare sample payroll intentionally.' : '' }
  } catch (error) { return { stale: true, reason: error instanceof Error ? error.message + ' Reprepare sample payroll.' : 'Reprepare sample payroll.' } }
}

export function elapsedMockHours(startedAt: number, stoppedAt: number) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(stoppedAt) || stoppedAt <= startedAt) throw new Error('The sample timer requires a positive elapsed duration.')
  const elapsedHours = (stoppedAt - startedAt) / 3600000
  if (elapsedHours > 24) throw new Error('The sample timer cannot record more than 24 hours.')
  const hours = Math.max(0.0001, Math.round(elapsedHours * 10000) / 10000)
  return hours
}

export function startMockTimer(actor: HrActor, date: string, startedAt: number, fixture: HrFixture): MockTimer {
  const employeeId = requireOwnEmployee(actor, fixture)
  const validation = validateTimeEntry(date, 1)
  if (!validation.valid) throw new Error(validation.error)
  if (!Number.isFinite(startedAt)) throw new Error('The sample timer requires a valid start time.')
  return { employeeId, role: actor.role, date, startedAt }
}

export function stopMockTimer(timer: MockTimer, actor: HrActor, stoppedAt: number, fixture: HrFixture): Extract<MockHrEvent, { type: 'add-time' }> {
  const employeeId = requireOwnEmployee(actor, fixture)
  if (timer.employeeId !== employeeId || timer.role !== actor.role) throw new Error('The sample timer belongs to another preview identity. Start a new timer.')
  return { type: 'add-time', date: timer.date, hours: elapsedMockHours(timer.startedAt, stoppedAt), source: 'timer' }
}

/** One projection supplies current native HR display and authorization facts. */
export function effectiveWorkflowFixture(state: MockHrState, fixture: HrFixture): HrFixture {
  return { ...fixture, employees: fixture.employees.map(employee => {
    const instance = state.lifecycle?.instances.find(item => item.id === state.lifecycle!.activeInstances[employee.id])
    return { ...employee, ...(instance ? { department: instance.current.department, jobTitle: instance.current.jobTitle, managerId: instance.current.managerId, employmentInstanceId: instance.id, onboardingTemplateVersion: instance.templateVersion, onboarding: instance.tasks.map(task => ({ ...task, status: state.onboarding[employee.id].tasks[task.id] ? 'complete' : 'pending' })) } : {}), workEmail: state.profileEmails[employee.id] ?? employee.workEmail, employmentStatus: state.employeeStatuses[employee.id] ?? employee.employmentStatus, onboardingStatus: state.onboarding[employee.id]?.stage === 'complete' ? 'simulated-complete' : employee.onboardingStatus }
  }) }
}

/** Materialize only for an accepted action; unknown legacy dates remain null. */
export function createHrLifecycle(state: MockHrState, fixture: HrFixture, simulationDate: string | null, recruiting?: RecruitingState): HrLifecycleState {
  const instances: HrEmploymentInstance[] = fixture.employees.map(employee => {
    const baseline = recruitingEmploymentBaseline(state, employee, recruiting)
    if (baseline) return { id: `employment-${employee.id}-1`, employeeId: employee.id, startDate: null, endDate: null, ...baseline, current: { ...baseline.initial } }
    const initial = { status: state.employeeStatuses[employee.id], department: employee.department, jobTitle: employee.jobTitle, managerId: employee.managerId }
    return { id: `employment-${employee.id}-1`, employeeId: employee.id, startDate: null, endDate: null, initial, current: { ...initial }, templateVersion: `legacy-${employee.id}`, tasks: employee.onboarding.map(task => ({ id: task.id, title: task.title })) }
  })
  return { schemaVersion: 1, simulationDate, sequence: 1, selectedTemplateVersion: 'sample-v1', instances, activeInstances: Object.fromEntries(instances.map(instance => [instance.employeeId, instance.id])), events: [], directoryHistory: [], corrections: [], offboardingAssignments: [] }
}

export function createMockHrState(fixture: HrFixture): MockHrState {
  return {
    onboarding: Object.fromEntries(fixture.employees.map(employee => [employee.id, {
      profileReviewed: false, jobReviewed: false, stage: 'draft',
      tasks: Object.fromEntries((employee.onboarding ?? []).map(task => [task.id, ['complete', 'completed'].includes(task.status)])),
    }])),
    profileEmails: Object.fromEntries(fixture.employees.map(employee => [employee.id, employee.workEmail])),
    employeeStatuses: Object.fromEntries(fixture.employees.map(employee => [employee.id, employee.employmentStatus])),
    timeEntries: fixture.timeEntries.map(entry => ({ ...entry, employeeId: String(entry.employeeId), date: String(entry.date), hours: Number(entry.hours), status: ['draft', 'submitted', 'approved'].includes(String(entry.status)) ? entry.status as MockTimeEntry['status'] : 'draft', source: 'fixture' })),
    benefitElections: [], payroll: blankPayroll(), payrollHistory: [], sequence: 1,
  }
}

function requireOwnEmployee(actor: HrActor, fixture: HrFixture) {
  if (!['employee', 'manager'].includes(actor.role) || !actor.employeeId || !fixture.employees.some(employee => employee.id === actor.employeeId)) throw new Error('A bound synthetic employee identity is required.')
  return actor.employeeId
}

function requireOnboardingAccess(actor: HrActor, employeeId: string, fixture: HrFixture) {
  if (!fixture.employees.some(employee => employee.id === employeeId)) throw new Error('The fictional employee was not found.')
  if (actor.role === 'employee' && actor.employeeId === employeeId || ['employer-owner', 'hr-admin', 'payroll-admin'].includes(actor.role)) return
  throw new Error('This demo role cannot change that employee onboarding record.')
}

function requirePayrollRole(actor: HrActor) {
  if (!['employer-owner', 'payroll-admin'].includes(actor.role)) throw new Error('Only the employer owner or payroll admin may simulate a payroll run.')
}

export function transitionMockHr(state: MockHrState, actor: HrActor, event: MockHrEvent, fixture: HrFixture, recruiting?: RecruitingState): MockHrState {
  const next = structuredClone(state)
  const receipt = (kind: string) => `MOCK-${kind}-${String(next.sequence++).padStart(4, '0')}`
  if (event.type === 'change-profile') {
    if (!fixture.employees.some(employee => employee.id === event.employeeId) || !canEditEmployeeProfile(actor, event.employeeId)) throw new Error('This demo role cannot change that employee profile.')
    const workEmail = event.workEmail.trim()
    if (!workEmail) throw new Error('A synthetic work email is required.')
    if (workEmail.length > 160 || Array.from(workEmail).some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) throw new Error('Use no more than 160 printable characters for the synthetic work email.')
    if (next.profileEmails[event.employeeId] !== workEmail) {
      next.lifecycle ??= createHrLifecycle(state, fixture, null, recruiting)
      const oldValue = next.profileEmails[event.employeeId]
      next.profileEmails[event.employeeId] = workEmail
      if (next.lifecycle) {
        const sequence = next.lifecycle.sequence++
        next.lifecycle.directoryHistory.push({ id: `directory-${sequence}`, sequence, employeeId: event.employeeId, field: 'workEmail', oldValue, newValue: workEmail, actor: { ...actor }, origin: 'direct' })
      }
      const onboarding = next.onboarding[event.employeeId]
      // Completed receipts describe an accepted historical sample. Later contact
      // edits must not revoke employment; pending onboarding must be reviewed anew.
      if (onboarding && onboarding.stage !== 'complete') {
        onboarding.profileReviewed = false
        onboarding.stage = 'draft'
      }
    }
    return next
  }
  if (['review-profile', 'review-job', 'check-task', 'review-onboarding', 'complete-onboarding'].includes(event.type)) {
    const change = event as Extract<MockHrEvent, { employeeId: string }>
    requireOnboardingAccess(actor, change.employeeId, fixture)
    if (next.lifecycle && (('instanceId' in change && change.instanceId !== undefined) ? change.instanceId !== next.lifecycle.activeInstances[change.employeeId] : next.lifecycle.activeInstances[change.employeeId] !== `employment-${change.employeeId}-1`)) throw new Error('Review the current employment instance before changing onboarding.')
    const onboarding = next.onboarding[change.employeeId]
    if (!onboarding || onboarding.stage === 'complete') throw new Error('Completed sample onboarding is locked until the demo is reset.')
    if (change.type === 'review-profile') { onboarding.profileReviewed = true; onboarding.stage = 'draft' }
    if (change.type === 'review-job') { onboarding.jobReviewed = true; onboarding.stage = 'draft' }
    if (change.type === 'check-task') {
      if (!Object.hasOwn(onboarding.tasks, change.taskId)) throw new Error('The sample onboarding task was not found.')
      onboarding.tasks[change.taskId] = change.complete; onboarding.stage = 'draft'
    }
    if (change.type === 'review-onboarding') {
      if (!onboarding.profileReviewed || !onboarding.jobReviewed || Object.values(onboarding.tasks).some(complete => !complete)) throw new Error('Review the profile and job, and finish every sample checklist item first.')
      onboarding.stage = 'reviewed'
    }
    if (change.type === 'complete-onboarding') {
      if (onboarding.stage !== 'reviewed') throw new Error('Review sample onboarding before confirming completion.')
      onboarding.stage = 'complete'; onboarding.receipt = receipt('ONBOARDING'); next.employeeStatuses[change.employeeId] = 'active'
      if (next.lifecycle) {
        const instance = next.lifecycle.instances.find(item => item.id === next.lifecycle!.activeInstances[change.employeeId])!
        if (instance.current.status === 'terminated' || instance.current.status === 'on-leave') throw new Error('This employment instance cannot complete onboarding in its current state.')
        const previous = { ...instance.current }
        instance.current.status = 'active'
        const sequence = next.lifecycle.sequence++
        next.lifecycle.events.push({ id: `lifecycle-${sequence}`, sequence, kind: 'onboarding-complete', employeeId: change.employeeId, instanceId: instance.id, effectiveDate: next.lifecycle.simulationDate, actor: { ...actor }, reason: 'Sample onboarding confirmed', previous, proposed: { ...instance.current } })
      }
    }
    return next
  }
  if (event.type === 'add-time') {
    const employeeId = requireOwnEmployee(actor, fixture)
    const validation = validateTimeEntry(event.date, event.hours)
    if (!validation.valid) throw new Error(validation.error)
    const existingHours = next.timeEntries.filter(entry => entry.employeeId === employeeId && entry.date === event.date).reduce((sum, entry) => sum + entry.hours, 0)
    if (existingHours + event.hours > 24) throw new Error('Combined draft, submitted and approved sample entries cannot exceed 24 hours for one employee/day.')
    next.timeEntries.push({ id: receipt('TIME'), employeeId, date: event.date, hours: event.hours, source: event.source, status: 'draft' })
    return next
  }
  if (event.type === 'submit-time') {
    const employeeId = requireOwnEmployee(actor, fixture)
    if (!event.entryIds.length || new Set(event.entryIds).size !== event.entryIds.length) throw new Error('Select at least one distinct draft entry.')
    const entries = event.entryIds.map(id => next.timeEntries.find(entry => entry.id === id))
    if (entries.some(entry => !entry || entry.employeeId !== employeeId || entry.status !== 'draft' || entry.payrollReceipt)) throw new Error('Only your own draft entries may be submitted.')
    for (const entry of entries) {
      const validation = validateTimeEntry(entry!.date, entry!.hours)
      if (!validation.valid) throw new Error(validation.error)
      if (next.timeEntries.filter(value => value.employeeId === employeeId && value.date === entry!.date).reduce((sum, value) => sum + value.hours, 0) > 24) throw new Error('Combined employee/day hours cannot exceed 24.')
    }
    entries.forEach(entry => { entry!.status = 'submitted' })
    return next
  }
  if (event.type === 'approve-time') {
    const entry = next.timeEntries.find(value => value.id === event.entryId)
    if (!entry || entry.payrollReceipt || !canApproveTimeEntry(actor, entry, fixture.employees)) throw new Error('Approval requires a submitted entry within this role and team scope; self-approval is unavailable.')
    const validation = validateTimeEntry(entry.date, entry.hours)
    if (!validation.valid) throw new Error(validation.error)
    if (next.timeEntries.filter(value => value.employeeId === entry.employeeId && value.date === entry.date).reduce((sum, value) => sum + value.hours, 0) > 24) throw new Error('Combined employee/day hours cannot exceed 24.')
    entry.status = 'approved'
    return next
  }
  if (event.type === 'return-time') {
    const entry = next.timeEntries.find(value => value.id === event.entryId)
    if (!entry || entry.payrollReceipt || actor.role !== 'manager' || !canApproveTimeEntry(actor, entry, fixture.employees)) throw new Error('Only a different scoped manager can return submitted unpaid time.')
    if (typeof event.reason !== 'string' || !event.reason.trim() || event.reason.trim().length > 500 || /[\r\n]/.test(event.reason) || event.reason.includes('\0')) throw new Error('Enter a return reason of 1–500 characters.')
    entry.status = 'draft'; entry.returnReason = event.reason.trim(); entry.returnedBy = actor.employeeId!
    return next
  }
  if (event.type === 'edit-time' || event.type === 'delete-time') {
    const employeeId = requireOwnEmployee(actor, fixture)
    const entry = next.timeEntries.find(value => value.id === event.entryId)
    if (!entry || entry.employeeId !== employeeId || entry.status !== 'draft' || entry.payrollReceipt) throw new Error('Only your own unpaid draft time may be edited or deleted.')
    if (event.type === 'delete-time') {
      if (event.confirmed !== true) throw new Error('Confirm deletion of this draft time entry.')
      next.timeEntries = next.timeEntries.filter(value => value.id !== entry.id)
    } else {
      const validation = validateTimeEntry(event.date, event.hours)
      if (!validation.valid) throw new Error(validation.error)
      const otherHours = next.timeEntries.filter(value => value.id !== entry.id && value.employeeId === employeeId && value.date === event.date).reduce((sum, value) => sum + value.hours, 0)
      if (otherHours + event.hours > 24) throw new Error('Combined draft, submitted and approved sample entries cannot exceed 24 hours for one employee/day.')
      entry.date = event.date; entry.hours = event.hours
    }
    return next
  }
  if (event.type === 'set-sample-rate') {
    requirePayrollRole(actor)
    if (!fixture.employees.some(employee => employee.id === event.employeeId)) throw new Error('Choose a known fictional employee for the sample rate.')
    if (typeof event.effectiveFrom !== 'string' || !validateTimeEntry(event.effectiveFrom, 1).valid) throw new Error('Enter a valid sample rate effective date.')
    if (!Number.isSafeInteger(event.hourlyRateCents) || event.hourlyRateCents <= 0 || event.hourlyRateCents > 1_000_000) throw new Error('Enter an explicit fictional hourly rate greater than zero and no more than $10,000, in whole cents.')
    const timeline = next.sampleRates?.[event.employeeId] ?? []
    if (timeline.length >= 1000) throw new Error('This sample rate timeline has reached its 1,000-change limit.')
    if (timeline.length && event.effectiveFrom <= timeline.at(-1)!.effectiveFrom) throw new Error('Add a later effective date to the sample rate timeline; previous rates are preserved.')
    next.sampleRates = { ...next.sampleRates, [event.employeeId]: [...timeline, { effectiveFrom: event.effectiveFrom, hourlyRateCents: event.hourlyRateCents }] }
    return next
  }
  if (['elect-benefit', 'review-benefit', 'confirm-benefit'].includes(event.type)) {
    const change = event as Extract<MockHrEvent, { planId: string }>
    const employeeId = requireOwnEmployee(actor, fixture)
    if (actor.role !== 'employee') throw new Error('Benefit elections are available only in the employee self preview.')
    const plan = fixture.benefits.find(value => value.id === change.planId)
    if (!plan || !Array.isArray(plan.employeeIds) || !plan.employeeIds.includes(employeeId)) throw new Error('This sample plan is not available for the bound employee.')
    const current = next.benefitElections.find(value => value.employeeId === employeeId && value.planId === change.planId)
    if (change.type === 'elect-benefit') {
      if (!['enroll', 'waive'].includes(change.election)) throw new Error('Select enroll or waive.')
      if (current?.stage === 'confirmed') throw new Error('Confirmed sample elections are locked until reset.')
      if (current) { current.election = change.election; current.stage = 'draft' }
      else next.benefitElections.push({ employeeId, planId: change.planId, election: change.election, stage: 'draft' })
    } else {
      if (!current) throw new Error('Choose a sample election first.')
      if (change.type === 'review-benefit') {
        if (current.stage !== 'draft') throw new Error('Only a draft election can be reviewed.')
        current.stage = 'reviewed'
      } else {
        if (current.stage !== 'reviewed') throw new Error('Review the sample election before confirming.')
        current.stage = 'confirmed'; current.receipt = receipt('BENEFIT')
      }
    }
    return next
  }
  requirePayrollRole(actor)
  if (event.type === 'prepare-payroll') {
    if (!validMockPeriod(event.period)) throw new Error('Choose a valid sample payroll period of 1–366 calendar days before preparing.')
    const snapshot = payrollSnapshot(next, fixture, event.period)
    if (!snapshot.inputs.length) throw new Error(`Approve at least one unpaid time entry for an active sample employee in ${event.period.start} to ${event.period.end} before preparing payroll.`)
    next.payroll = {
      ...blankPayroll(), stage: 'prepared', period: { ...event.period }, hours: snapshot.inputs.reduce((sum, entry) => sum + entry.hours, 0), ...snapshot,
    }
  } else if (event.type === 'calculate-payroll') {
    if (next.payroll.stage !== 'prepared') throw new Error('Prepare approved sample inputs before calculation.')
    const freshness = payrollFreshness(next, fixture)
    if (freshness.stale) throw new Error('Payroll preparation is stale. ' + freshness.reason)
    next.payroll.employeeTotals = [...new Set(next.payroll.inputs.map(input => input.employeeId))].map(employeeId => {
      const inputs = next.payroll.inputs.filter(input => input.employeeId === employeeId)
      const hours = inputs.reduce((sum, input) => sum + input.hours, 0)
      const grossCents = Math.round(inputs.reduce((sum, input) => sum + input.hours * input.rateCents, 0))
      const illustrativeWithholdingCents = Math.round(grossCents * MOCK_WITHHOLDING_RATE)
      // An employee's election may consume only their own available sample pay.
      const benefitDeductionCents = Math.min(grossCents - illustrativeWithholdingCents, next.payroll.benefitInputs.filter(input => input.employeeId === employeeId).reduce((sum, input) => sum + input.deductionCents, 0))
      return { employeeId, hours, grossCents, illustrativeWithholdingCents, benefitDeductionCents, netCents: grossCents - illustrativeWithholdingCents - benefitDeductionCents }
    })
    next.payroll.grossCents = next.payroll.employeeTotals.reduce((sum, employee) => sum + employee.grossCents, 0)
    next.payroll.illustrativeWithholdingCents = next.payroll.employeeTotals.reduce((sum, employee) => sum + employee.illustrativeWithholdingCents, 0)
    next.payroll.benefitDeductionCents = next.payroll.employeeTotals.reduce((sum, employee) => sum + employee.benefitDeductionCents, 0)
    next.payroll.netCents = next.payroll.employeeTotals.reduce((sum, employee) => sum + employee.netCents, 0)
    next.payroll.stage = 'calculated'
  } else if (event.type === 'review-payroll') {
    if (next.payroll.stage !== 'calculated') throw new Error('Calculate fictional totals before review.')
    const freshness = payrollFreshness(next, fixture)
    if (freshness.stale) throw new Error('Payroll preparation is stale. ' + freshness.reason)
    next.payroll.stage = 'reviewed'
  } else if (event.type === 'submit-payroll') {
    if (next.payroll.stage !== 'reviewed') throw new Error('Review fictional totals before simulating submission.')
    const freshness = payrollFreshness(next, fixture)
    if (freshness.stale) throw new Error('Payroll preparation is stale. ' + freshness.reason)
    const entries = next.payroll.inputs.map(input => next.timeEntries.find(entry => entry.id === input.entryId))
    if (entries.some(entry => !entry || entry.status !== 'approved' || entry.payrollReceipt)) throw new Error('Prepared inputs are unavailable or already included in a simulated receipt.')
    next.payroll.receipt = receipt('PAYROLL'); next.payroll.stage = 'submitted'
    entries.forEach(entry => { entry!.payrollReceipt = next.payroll.receipt })
    next.payrollHistory.push(structuredClone(next.payroll))
  } else throw new Error('Unknown mock workflow transition.')
  return next
}
