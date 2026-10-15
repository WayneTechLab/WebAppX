import {
  canApproveTimeEntry, canApproveTimeOff, canViewCompensation, scopedEmployees, scopedRecords,
  type HrActor, type HrFixture, type HrPortal, type HrRecord,
} from './model'
import { MOCK_PAY_PERIOD, type MockHrState } from './mock-workflows'

export type HrTalentCounts = {
  recruiting?: { publishedJobs: number; activeCandidates: number; hires: number }
  performance?: { goals: number; completedGoals: number; openReviews: number; selfReviewsDue: number; managerReviewsDue: number; acknowledgmentsDue: number }
  surveys?: { draft: number; published: number; closed: number; assigned: number; unsubmitted: number; submittedResponses: number }
}

export type HrInsightProps = {
  actor: HrActor
  fixture: HrFixture
  state: MockHrState
  requests?: HrRecord[]
  openOperations?: number
  openServiceRequests?: number
  operations?: Partial<Record<'tasks' | 'policies' | 'training' | 'assets' | 'documents', number>>
  talent?: HrTalentCounts
}
export type HrInsightAction = { id: string; title: string; detail: string; to: string; count: number }
export type HrPayStatement = {
  id: string; receipt: string; employeeId: string; employeeName: string;
  periodStart: string; periodEnd: string; hours: number;
  grossCents: number; illustrativeWithholdingCents: number; benefitDeductionCents: number; netCents: number;
  entries: { id: string; date: string; hours: number }[];
  benefitPlanTitles: string[];
}

/** Only frozen, submitted and consumed inputs can appear in self-service pay history. */
export function projectEmployeePayStatements(actor: HrActor, fixture: HrFixture, state: MockHrState): HrPayStatement[] {
  const permitted = new Set(scopedEmployees(actor, fixture.employees).filter(employee => canViewCompensation(actor, employee.id)).map(employee => employee.id))
  if (!permitted.size) return []
  const seen = new Set<string>()
  return state.payrollHistory.flatMap(payroll => {
    if (payroll.stage !== 'submitted' || !payroll.receipt || seen.has(payroll.receipt) || !payroll.inputs.length || !Array.isArray(payroll.employeeTotals)) return []
    // A stale or partial receipt must not expose a purported employee statement.
    if (!payroll.inputs.every(input => state.timeEntries.some(entry => entry.id === input.entryId && entry.employeeId === input.employeeId && entry.status === 'approved' && entry.payrollReceipt === payroll.receipt))) return []
    seen.add(payroll.receipt)
    return payroll.employeeTotals.flatMap(total => {
      if (!permitted.has(total.employeeId)) return []
      const inputs = payroll.inputs.filter(input => input.employeeId === total.employeeId)
      const employee = fixture.employees.find(value => value.id === total.employeeId)
      if (!employee || !inputs.length) return []
      const entries = inputs.map(input => {
        const entry = state.timeEntries.find(value => value.id === input.entryId)!
        return { id: entry.id, date: entry.date, hours: input.hours }
      })
      return [{
        id: `${payroll.receipt}:${total.employeeId}`, receipt: payroll.receipt!, employeeId: total.employeeId,
        employeeName: `${employee.firstName} ${employee.lastName}`, periodStart: MOCK_PAY_PERIOD.start, periodEnd: MOCK_PAY_PERIOD.end,
        hours: total.hours, grossCents: total.grossCents, illustrativeWithholdingCents: total.illustrativeWithholdingCents,
        benefitDeductionCents: total.benefitDeductionCents, netCents: total.netCents, entries,
        benefitPlanTitles: payroll.benefitInputs.filter(input => input.employeeId === total.employeeId).map(input => String(fixture.benefits.find(plan => plan.id === input.planId)?.name ?? fixture.benefits.find(plan => plan.id === input.planId)?.title ?? input.planId)),
      }]
    })
  }).reverse()
}

function count(value: number) { return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0 }

/** Reconstruct count-only summaries; never forward private review or survey data. */
function scopedTalentCounts(actor: HrActor, fixture: HrFixture, talent?: HrTalentCounts): HrTalentCounts {
  const administrative = ['employer-owner', 'hr-admin'].includes(actor.role)
  const boundEmployee = Boolean(actor.employeeId && fixture.employees.some(employee => employee.id === actor.employeeId))
  const performanceAllowed = administrative || ['manager', 'employee'].includes(actor.role) && boundEmployee
  const surveysAllowed = administrative || actor.role === 'employee' && boundEmployee
  const recruiting = administrative && talent?.recruiting ? {
    publishedJobs: count(talent.recruiting.publishedJobs), activeCandidates: count(talent.recruiting.activeCandidates), hires: count(talent.recruiting.hires),
  } : undefined
  const performance = performanceAllowed && talent?.performance ? {
    goals: count(talent.performance.goals), completedGoals: count(talent.performance.completedGoals), openReviews: count(talent.performance.openReviews),
    selfReviewsDue: count(talent.performance.selfReviewsDue), managerReviewsDue: count(talent.performance.managerReviewsDue), acknowledgmentsDue: count(talent.performance.acknowledgmentsDue),
  } : undefined
  const surveys = surveysAllowed && talent?.surveys ? {
    draft: count(talent.surveys.draft), published: count(talent.surveys.published), closed: count(talent.surveys.closed),
    assigned: count(talent.surveys.assigned), unsubmitted: count(talent.surveys.unsubmitted), submittedResponses: count(talent.surveys.submittedResponses),
  } : undefined
  return { recruiting, performance, surveys }
}

export function projectHrInsights({ actor, fixture, state, requests = fixture.timeOffRequests, openOperations = 0, openServiceRequests = 0, operations, talent }: HrInsightProps) {
  const employees = scopedEmployees(actor, fixture.employees)
  const ids = new Set(employees.map(employee => employee.id))
  const time = scopedRecords(actor, state.timeEntries, fixture.employees)
  const pto = scopedRecords(actor, requests, fixture.employees)
  const benefits = fixture.benefits.flatMap(plan => Array.isArray(plan.employeeIds) ? plan.employeeIds.filter((id): id is string => typeof id === 'string' && ids.has(id)).map(employeeId => ({ planId: plan.id, employeeId })) : [])
  const elections = state.benefitElections.filter(election => ids.has(election.employeeId))
  const unfinished = employees.filter(employee => state.onboarding[employee.id]?.stage !== 'complete')
  const approvals = time.filter(entry => canApproveTimeEntry(actor, entry, fixture.employees))
  const drafts = time.filter(entry => entry.employeeId === actor.employeeId && entry.status === 'draft')
  const ready = time.filter(entry => entry.status === 'approved' && !entry.payrollReceipt && state.employeeStatuses[String(entry.employeeId)] === 'active' && String(entry.date) >= MOCK_PAY_PERIOD.start && String(entry.date) <= MOCK_PAY_PERIOD.end)
  const unconfirmedBenefits = benefits.filter(plan => !elections.some(election => election.employeeId === plan.employeeId && election.planId === plan.planId && election.stage === 'confirmed'))
  const pendingPto = pto.filter(request => ['pending', 'requested'].includes(String(request.status)))
  const ptoApprovals = pendingPto.filter(request => canApproveTimeOff(actor, request, fixture.employees))
  const statements = projectEmployeePayStatements(actor, fixture, state)
  const isPayroll = ['employer-owner', 'payroll-admin'].includes(actor.role)
  const isAdmin = ['employer-owner', 'payroll-admin', 'hr-admin', 'auditor'].includes(actor.role)
  const portal: HrPortal = isAdmin ? 'admin' : actor.role === 'manager' ? 'manager' : actor.role === 'contractor' ? 'contractor' : 'employee'
  const base = `/hr/demo/${portal}`
  const talentCounts = scopedTalentCounts(actor, fixture, talent)
  const actions: HrInsightAction[] = []
  const add = (id: string, title: string, detail: string, to: string, count: number) => { if (count > 0) actions.push({ id, title, detail, to, count }) }
  if (actor.role === 'employee') add('onboarding', 'Finish your onboarding', 'Review your profile, job and checklist before confirming.', `${base}/onboarding`, unfinished.length)
  else if (['employer-owner', 'payroll-admin', 'hr-admin'].includes(actor.role)) {
    for (const employee of unfinished) add(`onboarding-${employee.id}`, `Review ${employee.firstName}'s onboarding`, 'Open the unfinished sample checklist.', `${base}/employees/${employee.id}/onboarding`, 1)
  } else if (actor.role === 'manager') add('onboarding', 'Review team onboarding status', 'See the employees within your team scope.', `${base}/team`, unfinished.filter(employee => employee.id !== actor.employeeId).length)
  add('time-approvals', 'Approve submitted time', 'Review hours before they can enter a payroll snapshot.', `${base}/time`, approvals.length)
  if (['employee', 'manager'].includes(actor.role)) add('time-drafts', 'Submit your draft hours', 'Draft entries stay out of payroll until submitted and approved.', `${base}/time`, drafts.length)
  add('pto-approvals', 'Review time off requests', 'Approve or reject requests within your role and team scope.', `${base}/time-off`, ptoApprovals.length)
  if (actor.role === 'employee') add('benefits', 'Confirm benefit elections', 'Choose enroll or waive, review, then confirm each available plan.', `${base}/benefits`, unconfirmedBenefits.length)
  else if (['employer-owner', 'payroll-admin', 'hr-admin'].includes(actor.role)) add('benefits', 'Review benefit election status', 'Follow up on sample plans without a confirmed election.', `${base}/benefits`, unconfirmedBenefits.length)
  if (isPayroll) add('payroll', 'Prepare approved hours for payroll', 'Only active employees and unpaid hours in the sample period are eligible.', `${base}/payroll`, ready.length)
  if (actor.role === 'employee') add('pay-history', 'View your simulated pay receipts', 'Payroll receipts are visible here after simulated submission.', `${base}/paystubs`, statements.length)
  if (operations && actor.role !== 'auditor') {
    const modules = { tasks: 'Complete HR tasks', policies: 'Acknowledge assigned policies', training: 'Complete assigned training', assets: 'Review assigned equipment', documents: 'Review assigned documents' }
    const moduleAccess: Record<string, string[]> = {
      'employer-owner': Object.keys(modules), 'hr-admin': Object.keys(modules), employee: Object.keys(modules),
      manager: ['tasks', 'training', 'assets'], contractor: ['tasks', 'documents'], 'payroll-admin': ['documents'],
    }
    for (const [kind, title] of Object.entries(modules)) {
      const allowed = (moduleAccess[actor.role] ?? []).includes(kind)
      if (allowed) add(`operations-${kind}`, title, 'Continue the assignments in this module within your current scope.', `${base}/${kind}`, Math.max(0, operations[kind as keyof typeof operations] ?? 0))
    }
  } else if (['employer-owner', 'hr-admin', 'employee', 'manager', 'contractor'].includes(actor.role)) add('operations', 'Review open HR assignments', 'Start with your task list, then review other modules in the portal navigation.', `${base}/tasks`, Math.max(0, openOperations))
  if (['employer-owner', 'hr-admin', 'manager', 'employee'].includes(actor.role)) add('service-requests', actor.role === 'employee' ? 'Follow your HR service requests' : 'Review employee service requests', 'Follow up on open requests in the synthetic HR service desk.', `${base}/${isAdmin ? 'cases' : 'requests'}`, Math.max(0, openServiceRequests))
  if (actor.role === 'auditor') add('receipts', 'Review simulated payroll history', 'Receipt counts are available without compensation amounts.', `${base}/payroll/history`, state.payrollHistory.filter(payroll => payroll.stage === 'submitted' && Boolean(payroll.receipt)).length)
  if (talentCounts.recruiting) add('talent-recruiting', 'Review the recruiting pipeline', `${talentCounts.recruiting.publishedJobs} published sample jobs · ${talentCounts.recruiting.hires} completed sample hires.`, `${base}/recruiting`, talentCounts.recruiting.activeCandidates)
  if (talentCounts.performance) {
    const performance = talentCounts.performance
    const unfinishedGoals = Math.max(0, performance.goals - performance.completedGoals)
    add('talent-goals', actor.role === 'employee' ? 'Update your goal progress' : 'Review goal progress', 'Continue the fictional goals visible to this role.', `${base}/performance`, unfinishedGoals)
    if (actor.role === 'employee') {
      add('talent-self-reviews', 'Complete your sample self reviews', 'Save and submit your own review before it can be shared.', `${base}/performance`, performance.selfReviewsDue)
      add('talent-review-acknowledgments', 'Acknowledge shared sample feedback', 'Read the review shared with you and record a sample acknowledgment.', `${base}/performance`, performance.acknowledgmentsDue)
    } else if (actor.role === 'manager') add('talent-manager-reviews', 'Complete direct-report sample reviews', 'Continue the manager reviews assigned within your team scope.', `${base}/performance`, performance.managerReviewsDue)
    else add('talent-open-reviews', 'Follow up on open performance reviews', 'Review cycle progress without exposing private draft review text.', `${base}/performance`, performance.openReviews)
  }
  if (talentCounts.surveys) {
    if (actor.role === 'employee') add('talent-survey-responses', 'Answer your assigned sample surveys', 'Only your assigned, published surveys are available for a response.', `${base}/surveys`, talentCounts.surveys.unsubmitted)
    else {
      add('talent-draft-surveys', 'Prepare draft sample surveys', 'Review audience and questions before publishing a fictional survey.', `${base}/surveys`, talentCounts.surveys.draft)
      add('talent-published-surveys', 'Review published sample surveys', 'Follow response counts and close a sample survey when ready.', `${base}/surveys`, talentCounts.surveys.published)
    }
  }
  const departmentNames = [...new Set(employees.map(employee => employee.department))].sort()
  const payrollRuns = new Set(state.payrollHistory.filter(payroll => payroll.stage === 'submitted' && Boolean(payroll.receipt) && payroll.inputs.some(input => ids.has(input.employeeId))).map(payroll => payroll.receipt)).size
  const totals = isPayroll || actor.role === 'employee' && employees.length > 0 ? statements.reduce((sum, statement) => ({
    grossCents: sum.grossCents + statement.grossCents, illustrativeWithholdingCents: sum.illustrativeWithholdingCents + statement.illustrativeWithholdingCents,
    benefitDeductionCents: sum.benefitDeductionCents + statement.benefitDeductionCents, netCents: sum.netCents + statement.netCents,
  }), { grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: 0 }) : undefined
  return {
    people: employees.length,
    active: employees.filter(employee => (state.employeeStatuses[employee.id] ?? employee.employmentStatus) === 'active').length,
    onboardingIncomplete: unfinished.length,
    departments: departmentNames.map(name => ({ name, people: employees.filter(employee => employee.department === name).length })),
    workforce: employees.map(employee => ({ id: employee.id, name: `${employee.firstName} ${employee.lastName}`, department: employee.department, jobTitle: employee.jobTitle, status: state.employeeStatuses[employee.id] ?? employee.employmentStatus, onboarding: state.onboarding[employee.id]?.stage ?? 'draft' })),
    time: { draft: time.filter(entry => entry.status === 'draft').length, submitted: time.filter(entry => entry.status === 'submitted').length, approvedUnpaid: time.filter(entry => entry.status === 'approved' && !entry.payrollReceipt).length, paid: time.filter(entry => Boolean(entry.payrollReceipt)).length, readyForPayroll: ready.length, readyHours: ready.reduce((sum, entry) => sum + Number(entry.hours), 0) },
    benefits: { available: benefits.length, unconfirmed: unconfirmedBenefits.length, enrolled: elections.filter(election => election.stage === 'confirmed' && election.election === 'enroll').length, waived: elections.filter(election => election.stage === 'confirmed' && election.election === 'waive').length },
    requests: { pending: pendingPto.length, approved: pto.filter(request => request.status === 'approved').length, rejected: pto.filter(request => request.status === 'rejected').length, cancelled: pto.filter(request => request.status === 'cancelled').length },
    payroll: { submittedRuns: payrollRuns, statements: statements.length, totals },
    openOperations: Math.max(0, openOperations), openServiceRequests: Math.max(0, openServiceRequests), talent: talentCounts, actions,
  }
}
