import { canApproveTimeEntry, canEditEmployeeProfile, validateTimeEntry, type HrActor, type HrFixture, type HrRecord } from './model'

export type MockOnboarding = { profileReviewed: boolean; jobReviewed: boolean; tasks: Record<string, boolean>; stage: 'draft' | 'reviewed' | 'complete'; receipt?: string }
export type MockTimeEntry = HrRecord & { employeeId: string; date: string; hours: number; status: 'draft' | 'submitted' | 'approved'; source: 'manual' | 'timer' | 'fixture'; payrollReceipt?: string }
export type MockBenefitElection = { employeeId: string; planId: string; election: 'enroll' | 'waive'; stage: 'draft' | 'reviewed' | 'confirmed'; receipt?: string }
export type MockTimer = { employeeId: string; role: HrActor['role']; date: string; startedAt: number }
export type MockPayrollEmployeeTotal = { employeeId: string; hours: number; grossCents: number; illustrativeWithholdingCents: number; benefitDeductionCents: number; netCents: number }
export type MockPayroll = {
  stage: 'idle' | 'prepared' | 'calculated' | 'reviewed' | 'submitted';
  inputs: { entryId: string; employeeId: string; hours: number; rateCents: number }[];
  benefitInputs: { employeeId: string; planId: string; deductionCents: number }[];
  employeeTotals: MockPayrollEmployeeTotal[];
  hours: number; grossCents: number; illustrativeWithholdingCents: number; benefitDeductionCents: number; netCents: number; receipt?: string;
}
export type MockHrState = { onboarding: Record<string, MockOnboarding>; profileEmails: Record<string, string>; employeeStatuses: Record<string, string>; timeEntries: MockTimeEntry[]; benefitElections: MockBenefitElection[]; payroll: MockPayroll; payrollHistory: MockPayroll[]; sequence: number }
export type MockHrEvent =
  | { type: 'review-profile' | 'review-job' | 'review-onboarding' | 'complete-onboarding'; employeeId: string }
  | { type: 'change-profile'; employeeId: string; workEmail: string }
  | { type: 'check-task'; employeeId: string; taskId: string; complete: boolean }
  | { type: 'add-time'; date: string; hours: number; source: 'manual' | 'timer' }
  | { type: 'submit-time'; entryIds: string[] }
  | { type: 'approve-time'; entryId: string }
  | { type: 'elect-benefit'; planId: string; election: 'enroll' | 'waive' }
  | { type: 'review-benefit' | 'confirm-benefit'; planId: string }
  | { type: 'prepare-payroll' | 'calculate-payroll' | 'review-payroll' | 'submit-payroll' }

const blankPayroll = (): MockPayroll => ({ stage: 'idle', inputs: [], benefitInputs: [], employeeTotals: [], hours: 0, grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: 0 })
export const MOCK_HOURLY_RATE_CENTS = 3000
export const MOCK_WITHHOLDING_RATE = 0.2
export const MOCK_BENEFIT_DEDUCTION_CENTS = 2500
export const MOCK_PAY_PERIOD = Object.freeze({ start: '2026-10-01', end: '2026-10-15' })

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

export function transitionMockHr(state: MockHrState, actor: HrActor, event: MockHrEvent, fixture: HrFixture): MockHrState {
  const next = structuredClone(state)
  const receipt = (kind: string) => `MOCK-${kind}-${String(next.sequence++).padStart(4, '0')}`
  if (event.type === 'change-profile') {
    if (!fixture.employees.some(employee => employee.id === event.employeeId) || !canEditEmployeeProfile(actor, event.employeeId)) throw new Error('This demo role cannot change that employee profile.')
    const workEmail = event.workEmail.trim()
    if (!workEmail) throw new Error('A synthetic work email is required.')
    if (next.profileEmails[event.employeeId] !== workEmail) {
      next.profileEmails[event.employeeId] = workEmail
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
    if (entries.some(entry => !entry || entry.employeeId !== employeeId || entry.status !== 'draft')) throw new Error('Only your own draft entries may be submitted.')
    entries.forEach(entry => { entry!.status = 'submitted' })
    return next
  }
  if (event.type === 'approve-time') {
    const entry = next.timeEntries.find(value => value.id === event.entryId)
    if (!entry || !canApproveTimeEntry(actor, entry, fixture.employees)) throw new Error('Approval requires a submitted entry within this role and team scope; self-approval is unavailable.')
    entry.status = 'approved'
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
    const entries = next.timeEntries.filter(entry => entry.status === 'approved' && !entry.payrollReceipt && next.employeeStatuses[entry.employeeId] === 'active' && entry.date >= MOCK_PAY_PERIOD.start && entry.date <= MOCK_PAY_PERIOD.end)
    if (!entries.length) throw new Error(`Approve at least one unpaid time entry for an active sample employee in ${MOCK_PAY_PERIOD.start} to ${MOCK_PAY_PERIOD.end} before preparing payroll.`)
    const employeeIds = new Set(entries.map(entry => entry.employeeId))
    next.payroll = {
      ...blankPayroll(), stage: 'prepared', hours: entries.reduce((sum, entry) => sum + entry.hours, 0),
      inputs: entries.map(entry => ({ entryId: entry.id, employeeId: entry.employeeId, hours: entry.hours, rateCents: MOCK_HOURLY_RATE_CENTS })),
      benefitInputs: next.benefitElections.filter(election => election.stage === 'confirmed' && election.election === 'enroll' && employeeIds.has(election.employeeId)).map(election => ({ employeeId: election.employeeId, planId: election.planId, deductionCents: MOCK_BENEFIT_DEDUCTION_CENTS })),
    }
  } else if (event.type === 'calculate-payroll') {
    if (next.payroll.stage !== 'prepared') throw new Error('Prepare approved sample inputs before calculation.')
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
    next.payroll.stage = 'reviewed'
  } else if (event.type === 'submit-payroll') {
    if (next.payroll.stage !== 'reviewed') throw new Error('Review fictional totals before simulating submission.')
    const entries = next.payroll.inputs.map(input => next.timeEntries.find(entry => entry.id === input.entryId))
    if (entries.some(entry => !entry || entry.status !== 'approved' || entry.payrollReceipt)) throw new Error('Prepared inputs are unavailable or already included in a simulated receipt.')
    next.payroll.receipt = receipt('PAYROLL'); next.payroll.stage = 'submitted'
    entries.forEach(entry => { entry!.payrollReceipt = next.payroll.receipt })
    next.payrollHistory.push(structuredClone(next.payroll))
  } else throw new Error('Unknown mock workflow transition.')
  return next
}
