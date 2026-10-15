import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const compile = file => ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const dataUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const modelUrl = dataUrl(compile('../../src/hr/model.ts'))
const workflowUrl = dataUrl(compile('../../src/hr/mock-workflows.ts').replace(/from ['"]\.\/model['"]/g, `from '${modelUrl}'`))
const insights = await import(dataUrl(compile('../../src/hr/insights.ts').replace(/from ['"]\.\/model['"]/g, `from '${modelUrl}'`).replace(/from ['"]\.\/mock-workflows['"]/g, `from '${workflowUrl}'`)))
const workflow = await import(workflowUrl)
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }
const avery = { role: 'employee', employeeId: 'employee-002' }
const jordan = { role: 'employee', employeeId: 'employee-003' }
const manager = { role: 'manager', employeeId: 'employee-001' }
const apply = (state, actor, event) => workflow.transitionMockHr(state, actor, event, fixture)

function onboard(state, employeeId) {
  state = apply(state, owner, { type: 'review-profile', employeeId })
  state = apply(state, owner, { type: 'review-job', employeeId })
  for (const task of fixture.employees.find(employee => employee.id === employeeId).onboarding) state = apply(state, owner, { type: 'check-task', employeeId, taskId: task.id, complete: true })
  state = apply(state, owner, { type: 'review-onboarding', employeeId })
  return apply(state, owner, { type: 'complete-onboarding', employeeId })
}
function confirmBenefit(state, actor, planId) {
  state = apply(state, actor, { type: 'elect-benefit', planId, election: 'enroll' })
  state = apply(state, actor, { type: 'review-benefit', planId })
  return apply(state, actor, { type: 'confirm-benefit', planId })
}
function addApprovedTime(state, actor, hours) {
  state = apply(state, actor, { type: 'add-time', date: '2026-10-14', hours, source: 'manual' })
  const entryId = state.timeEntries.at(-1).id
  state = apply(state, actor, { type: 'submit-time', entryIds: [entryId] })
  return apply(state, manager, { type: 'approve-time', entryId })
}
function submitPayroll(state) {
  for (const person of fixture.employees) if (!state.sampleRates?.[person.id]) state = apply(state, owner, { type: 'set-sample-rate', employeeId: person.id, effectiveFrom: '2026-10-01', hourlyRateCents: 3000 })
  for (const type of ['prepare-payroll', 'calculate-payroll', 'review-payroll', 'submit-payroll']) state = apply(state, owner, { type, ...(type === 'prepare-payroll' ? { period: { start: '2026-10-01', end: '2026-10-15' } } : {}) })
  return state
}

test('dashboard links and counts are scoped to the selected role and live workflow state', () => {
  let state = workflow.createMockHrState(fixture)
  const initial = insights.projectHrInsights({ actor: avery, fixture, state })
  assert.equal(initial.people, 1)
  assert.equal(initial.benefits.available, 2)
  assert.equal(initial.benefits.unconfirmed, 2)
  assert.equal(initial.time.submitted, 1)
  assert.ok(initial.actions.every(action => action.to.startsWith('/hr/demo/employee/')))
  assert.ok(initial.actions.some(action => action.id === 'onboarding'))
  assert.equal(initial.actions.some(action => action.id === 'payroll'), false)
  state = onboard(state, avery.employeeId)
  state = confirmBenefit(state, avery, 'benefit-001')
  const changed = insights.projectHrInsights({ actor: avery, fixture, state })
  assert.equal(changed.onboardingIncomplete, 0)
  assert.equal(changed.benefits.enrolled, 1)
  assert.equal(changed.benefits.unconfirmed, 1)
  assert.equal(changed.actions.some(action => action.id === 'onboarding'), false)
  assert.deepEqual(changed.workforce.map(employee => employee.id), [avery.employeeId])
})

test('submitted payroll becomes frozen employee self-service receipts with matching totals', () => {
  let state = workflow.createMockHrState(fixture)
  state = apply(state, manager, { type: 'approve-time', entryId: 'time-001' })
  state = confirmBenefit(state, avery, 'benefit-001')
  state = submitPayroll(state)
  const [statement] = insights.projectEmployeePayStatements(avery, fixture, state)
  assert.equal(statement.receipt, state.payroll.receipt)
  assert.equal(statement.employeeId, avery.employeeId)
  assert.equal(statement.hours, 8)
  assert.deepEqual([statement.grossCents, statement.illustrativeWithholdingCents, statement.benefitDeductionCents, statement.netCents], [24000, 4800, 2500, 16700])
  assert.deepEqual(statement.entries, [{ id: 'time-001', date: '2026-10-09', hours: 8, rateCents: 3000 }])
  assert.deepEqual(statement.benefitPlanTitles, [fixture.benefits.find(plan => plan.id === 'benefit-001').name])
  assert.equal(insights.projectEmployeePayStatements(jordan, fixture, state).length, 0)
  const report = insights.projectHrInsights({ actor: owner, fixture, state })
  assert.equal(report.time.paid, 1)
  assert.equal(report.time.readyForPayroll, 0)
  assert.equal(report.payroll.submittedRuns, 1)
  assert.equal(report.payroll.totals.netCents, 16700)
  assert.equal(insights.projectHrInsights({ actor: avery, fixture, state }).actions.find(action => action.id === 'pay-history').count, 1)
})

test('tiny employee pay caps only that employee benefit and sum of self receipts matches the run', () => {
  let state = workflow.createMockHrState(fixture)
  state.timeEntries = []
  state = onboard(state, jordan.employeeId)
  state = addApprovedTime(state, avery, 0.01)
  state = addApprovedTime(state, jordan, 1)
  state = confirmBenefit(state, avery, 'benefit-001')
  state = submitPayroll(state)
  const [a] = insights.projectEmployeePayStatements(avery, fixture, state)
  const [j] = insights.projectEmployeePayStatements(jordan, fixture, state)
  assert.deepEqual([a.grossCents, a.illustrativeWithholdingCents, a.benefitDeductionCents, a.netCents], [30, 6, 24, 0])
  assert.deepEqual([j.grossCents, j.illustrativeWithholdingCents, j.benefitDeductionCents, j.netCents], [3000, 600, 0, 2400])
  for (const key of ['grossCents', 'illustrativeWithholdingCents', 'benefitDeductionCents', 'netCents']) assert.equal(a[key] + j[key], state.payroll[key])
  assert.ok(a.entries.every(entry => entry.id !== j.entries[0].id))
  assert.equal(a.benefitPlanTitles.length, 1)
  assert.equal(j.benefitPlanTitles.length, 0)
})

test('unsubmitted, duplicate and unconsumed histories cannot create extra pay statements', () => {
  let state = workflow.createMockHrState(fixture)
  state = apply(state, manager, { type: 'approve-time', entryId: 'time-001' })
  state = submitPayroll(state)
  state.payrollHistory.push(structuredClone(state.payrollHistory[0]))
  assert.equal(insights.projectEmployeePayStatements(avery, fixture, state).length, 1)
  const unsubmitted = structuredClone(state)
  unsubmitted.payrollHistory.forEach(payroll => { payroll.stage = 'reviewed' })
  assert.equal(insights.projectEmployeePayStatements(avery, fixture, unsubmitted).length, 0)
  const unconsumed = structuredClone(state)
  delete unconsumed.timeEntries.find(entry => entry.id === 'time-001').payrollReceipt
  assert.equal(insights.projectEmployeePayStatements(avery, fixture, unconsumed).length, 0)
  const noTotals = structuredClone(state)
  noTotals.payrollHistory.forEach(payroll => { delete payroll.employeeTotals })
  assert.equal(insights.projectEmployeePayStatements(avery, fixture, noTotals).length, 0)
  const changedTime = structuredClone(state)
  changedTime.timeEntries.find(entry => entry.id === 'time-001').hours = 12
  assert.equal(insights.projectEmployeePayStatements(avery, fixture, changedTime)[0].hours, 8)
  assert.equal(insights.projectEmployeePayStatements(avery, fixture, changedTime)[0].entries[0].hours, 8)
})

test('HR, manager, auditor and unbound identities receive no compensation fields or pay statements', () => {
  let state = workflow.createMockHrState(fixture)
  state = apply(state, manager, { type: 'approve-time', entryId: 'time-001' })
  state = submitPayroll(state)
  for (const actor of [{ role: 'hr-admin' }, manager, { role: 'auditor' }, { role: 'employee' }, { role: 'employee', employeeId: 'missing' }, { role: 'contractor', contractorId: 'contractor-001' }]) {
    const projection = insights.projectHrInsights({ actor, fixture, state })
    assert.equal(projection.payroll.totals, undefined)
    assert.deepEqual(insights.projectEmployeePayStatements(actor, fixture, state), [])
    assert.ok(projection.workforce.every(employee => !Object.hasOwn(employee, 'payCents')))
  }
  const auditor = insights.projectHrInsights({ actor: { role: 'auditor' }, fixture, state })
  assert.equal(auditor.payroll.submittedRuns, 1)
  assert.ok(auditor.actions.every(action => action.to === '/hr/demo/admin/payroll/history'))
})

test('manager reports and action inbox exclude a different team and self approvals', () => {
  const scopedFixture = structuredClone(fixture)
  scopedFixture.employees.find(employee => employee.id === jordan.employeeId).managerId = 'another-manager'
  const state = workflow.createMockHrState(scopedFixture)
  state.timeEntries.push({ id: 'self-time', employeeId: manager.employeeId, date: '2026-10-14', hours: 1, status: 'submitted', source: 'manual' })
  const requests = [...fixture.timeOffRequests, { id: 'foreign-pto', employeeId: jordan.employeeId, status: 'pending' }, { id: 'own-pto', employeeId: manager.employeeId, status: 'pending' }]
  const report = insights.projectHrInsights({ actor: manager, fixture: scopedFixture, state, requests, openOperations: 2 })
  assert.deepEqual(report.workforce.map(employee => employee.id), [manager.employeeId, avery.employeeId])
  assert.equal(report.time.submitted, 2)
  assert.equal(report.actions.find(action => action.id === 'time-approvals').count, 1)
  assert.equal(report.requests.pending, 2)
  assert.equal(report.actions.find(action => action.id === 'pto-approvals').count, 1)
  assert.equal(report.actions.find(action => action.id === 'operations').to, '/hr/demo/manager/tasks')
  const payrollAdmin = insights.projectHrInsights({ actor: { role: 'payroll-admin' }, fixture, state, openOperations: 2 })
  assert.equal(payrollAdmin.actions.some(action => action.id === 'operations'), false)
})

test('assignment inbox links each kind to its own permitted portal module', () => {
  const state = workflow.createMockHrState(fixture)
  const operations = { tasks: 1, policies: 2, training: 3, assets: 4, documents: 5 }
  const own = insights.projectHrInsights({ actor: avery, fixture, state, operations, openServiceRequests: 1 })
  const assignments = own.actions.filter(action => action.id.startsWith('operations-'))
  assert.equal(assignments.length, 5)
  for (const action of assignments) {
    const kind = action.id.replace('operations-', '')
    assert.equal(action.to, `/hr/demo/employee/${kind}`)
    assert.equal(action.count, operations[kind])
  }
  assert.equal(own.actions.find(action => action.id === 'service-requests').to, '/hr/demo/employee/requests')
  const team = insights.projectHrInsights({ actor: manager, fixture, state, operations, openServiceRequests: 1 })
  assert.deepEqual(team.actions.filter(action => action.id.startsWith('operations-')).map(action => action.id), ['operations-tasks', 'operations-training', 'operations-assets'])
  assert.equal(team.actions.find(action => action.id === 'service-requests').to, '/hr/demo/manager/requests')
  const payroll = insights.projectHrInsights({ actor: { role: 'payroll-admin' }, fixture, state, operations })
  assert.deepEqual(payroll.actions.filter(action => action.id.startsWith('operations-')).map(action => action.id), ['operations-documents'])
  const unknown = insights.projectHrInsights({ actor: { role: 'unknown' }, fixture, state, operations, openOperations: 10 })
  assert.equal(unknown.actions.length, 0)
})

const sampleTalent = {
  recruiting: { publishedJobs: 2, activeCandidates: 3, hires: 1 },
  performance: { goals: 4, completedGoals: 1, openReviews: 2, selfReviewsDue: 2, managerReviewsDue: 1, acknowledgmentsDue: 1 },
  surveys: { draft: 1, published: 2, closed: 1, assigned: 3, unsubmitted: 2, submittedResponses: 1 },
}

test('talent projections guard module access even when unauthorized counts are supplied', () => {
  const state = workflow.createMockHrState(fixture)
  const expectedModules = [
    [owner, ['recruiting', 'performance', 'surveys']],
    [{ role: 'hr-admin' }, ['recruiting', 'performance', 'surveys']],
    [manager, ['performance']],
    [avery, ['performance', 'surveys']],
    [{ role: 'payroll-admin' }, []],
    [{ role: 'auditor' }, []],
    [{ role: 'contractor', contractorId: 'contractor-001' }, []],
    [{ role: 'employee' }, []],
    [{ role: 'manager', employeeId: 'missing' }, []],
    [{ role: 'unknown' }, []],
  ]
  for (const [actor, modules] of expectedModules) {
    const projection = insights.projectHrInsights({ actor, fixture, state, talent: sampleTalent })
    const visibleModules = Object.keys(projection.talent).filter(key => projection.talent[key] !== undefined)
    assert.deepEqual(visibleModules, modules, actor.role)
    if (!modules.length) assert.equal(projection.actions.some(action => action.id.startsWith('talent-')), false, actor.role)
  }
})

test('talent inbox actions resolve to permitted canonical routes for owner, HR, manager and employee', async () => {
  const model = await import(modelUrl)
  const routes = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/ROUTES.json', import.meta.url), 'utf8')).routes
  const state = workflow.createMockHrState(fixture)
  for (const actor of [owner, { role: 'hr-admin' }, manager, avery]) {
    const projection = insights.projectHrInsights({ actor, fixture, state, talent: sampleTalent })
    const actions = projection.actions.filter(action => action.id.startsWith('talent-'))
    assert.ok(actions.length > 0)
    for (const action of actions) {
      const resolution = model.resolveHrPath(action.to)
      const match = model.matchHrRoute(resolution.canonical, routes)
      assert.ok(match, action.to)
      assert.equal(model.canViewRoute(actor, match.route), true, `${actor.role}: ${action.to}`)
    }
    if (actor.role === 'manager') assert.ok(actions.every(action => action.to === '/hr/demo/manager/performance'))
    if (actor.role === 'employee') assert.ok(actions.every(action => ['/hr/demo/employee/performance', '/hr/demo/employee/surveys'].includes(action.to)))
  }
})

test('talent counts and due actions update while private text and invalid counts are discarded', () => {
  const state = workflow.createMockHrState(fixture)
  const supplied = structuredClone(sampleTalent)
  supplied.performance.privateSelfReview = 'DO NOT PROJECT THIS SELF REVIEW'
  supplied.performance.privateManagerReview = 'DO NOT PROJECT THIS MANAGER REVIEW'
  supplied.surveys.privateResponses = ['DO NOT PROJECT THIS ANSWER']
  const initial = insights.projectHrInsights({ actor: avery, fixture, state, talent: supplied })
  assert.equal(initial.talent.performance.openReviews, 2)
  assert.equal(initial.actions.find(action => action.id === 'talent-self-reviews').count, 2)
  assert.equal(initial.actions.find(action => action.id === 'talent-review-acknowledgments').count, 1)
  assert.equal(initial.actions.find(action => action.id === 'talent-survey-responses').count, 2)
  assert.equal(JSON.stringify(initial).includes('DO NOT PROJECT'), false)
  supplied.performance.completedGoals = 4
  supplied.performance.selfReviewsDue = 0
  supplied.performance.acknowledgmentsDue = 0
  supplied.surveys.unsubmitted = 0
  supplied.surveys.submittedResponses = 3
  const complete = insights.projectHrInsights({ actor: avery, fixture, state, talent: supplied })
  assert.equal(complete.talent.surveys.submittedResponses, 3)
  assert.deepEqual(complete.actions.filter(action => action.id.startsWith('talent-')), [])
  const invalid = insights.projectHrInsights({ actor: owner, fixture, state, talent: { recruiting: { publishedJobs: -2, activeCandidates: Number.NaN, hires: Number.POSITIVE_INFINITY }, surveys: { ...sampleTalent.surveys, assigned: 2.8 } } })
  assert.deepEqual(invalid.talent.recruiting, { publishedJobs: 0, activeCandidates: 0, hires: 0 })
  assert.equal(invalid.talent.surveys.assigned, 2)
})

test('workforce and self projections use the passed dynamic hire fixture', () => {
  const expanded = structuredClone(fixture)
  const hire = { ...structuredClone(fixture.employees[2]), id: 'employee-hired-001', firstName: 'Casey', lastName: 'Fiction', department: 'Operations', managerId: manager.employeeId, employmentStatus: 'onboarding' }
  expanded.employees.push(hire)
  const state = workflow.createMockHrState(expanded)
  const company = insights.projectHrInsights({ actor: owner, fixture: expanded, state, talent: sampleTalent })
  assert.equal(company.people, fixture.employees.length + 1)
  assert.ok(company.workforce.some(employee => employee.id === hire.id))
  assert.ok(company.actions.some(action => action.to === `/hr/demo/admin/employees/${hire.id}/onboarding`))
  const own = insights.projectHrInsights({ actor: { role: 'employee', employeeId: hire.id }, fixture: expanded, state, talent: { performance: sampleTalent.performance, surveys: sampleTalent.surveys } })
  assert.deepEqual(own.workforce.map(employee => employee.id), [hire.id])
  assert.equal(own.talent.performance.goals, 4)
  const team = insights.projectHrInsights({ actor: manager, fixture: expanded, state })
  assert.ok(team.workforce.some(employee => employee.id === hire.id))
})
