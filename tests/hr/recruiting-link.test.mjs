import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

// Compile the real host models in memory. No provider, browser, reusable records
// or external service is involved in this cross-module integration proof.
const urls = {}
async function load(name) {
  const source = readFileSync(new URL(`../../src/hr/${name}.ts`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  const resolved = compiled.replace(/from ['"]\.\/([^'"]+)['"]/g, (_, dependency) => {
    assert.ok(urls[dependency], `Load ${dependency} before ${name}`)
    return `from '${urls[dependency]}'`
  })
  urls[name] = `data:text/javascript;base64,${Buffer.from(`${resolved}\n//# sourceURL=hr-${name}.mjs`).toString('base64')}`
  return import(urls[name])
}
await load('model')
const workflow = await load('mock-workflows')
const people = await load('people-operations')
const recruiting = await load('recruiting')
const link = await load('recruiting-link')
const insights = await load('insights')
const performance = await load('performance')
const surveys = await load('surveys')
const base = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }
const avery = { role: 'employee', employeeId: 'employee-002' }
const morgan = { role: 'manager', employeeId: 'employee-001' }

function initial() {
  return { recruiting: recruiting.createRecruitingState(base), workflow: workflow.createMockHrState(base), operations: people.createPeopleOperations(base) }
}
function apply(state, event, actor = owner, fixture = base) {
  return link.applyRecruitingToHr(state.recruiting, state.workflow, state.operations, actor, event, fixture)
}
function toOffer(state = initial()) {
  const job = state.recruiting.jobs[0]
  const candidate = state.recruiting.candidates.find(record => record.firstName === 'Casey')
  state = apply(state, { type: 'set-job-status', jobId: job.id, status: 'published' })
  for (const stage of ['screening', 'interview', 'offer']) state = apply(state, { type: 'advance-candidate', candidateId: candidate.id, stage })
  return state
}
function hire(state = toOffer()) {
  const candidate = state.recruiting.candidates.find(record => record.firstName === 'Casey')
  return apply(state, { type: 'advance-candidate', candidateId: candidate.id, stage: 'hired' })
}
function hrChange(state, actor, event, fixture) {
  return workflow.transitionMockHr(state, actor, event, fixture)
}
function submitPayroll(state, fixture = base) {
  for (const person of fixture.employees) if (!state.sampleRates?.[person.id]) state = hrChange(state, owner, { type: 'set-sample-rate', employeeId: person.id, effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }, fixture)
  for (const type of ['prepare-payroll', 'calculate-payroll', 'review-payroll', 'submit-payroll']) state = hrChange(state, owner, { type, ...(type === 'prepare-payroll' ? { period: { start: '2026-10-01', end: '2026-10-15' } } : {}) }, fixture)
  return state
}
function ongoingWork() {
  const state = initial()
  state.workflow = hrChange(state.workflow, avery, { type: 'change-profile', employeeId: avery.employeeId, workEmail: 'avery.saved@example.invalid' }, base)
  for (const type of ['elect-benefit', 'review-benefit', 'confirm-benefit']) state.workflow = hrChange(state.workflow, avery, { type, planId: 'benefit-001', election: 'enroll' }, base)
  state.workflow = hrChange(state.workflow, morgan, { type: 'approve-time', entryId: 'time-001' }, base)
  state.workflow = submitPayroll(state.workflow)
  state.workflow = hrChange(state.workflow, avery, { type: 'add-time', date: '2026-10-15', hours: 2, source: 'manual' }, base)
  state.operations = people.transitionPeopleOperations(state.operations, { type: 'complete-task', recordId: 'task-001' }, avery, base)
  state.operations = people.transitionPeopleOperations(state.operations, { type: 'request-pto', startDate: '2026-10-15', endDate: '2026-10-15', leaveType: 'vacation' }, avery, base)
  return state
}

test('publishing and advancing Casey initializes a single onboarding hire and new leave balances without resetting existing work', () => {
  const state = ongoingWork()
  const before = structuredClone(state)
  const offered = toOffer(state)
  assert.equal(offered.recruiting.candidates.find(candidate => candidate.firstName === 'Casey').stage, 'offer')
  assert.deepEqual(offered.workflow, before.workflow)
  assert.deepEqual(offered.operations, before.operations)
  const result = hire(offered)
  const employee = result.recruiting.hiredEmployees[0]
  assert.equal(result.recruiting.hiredEmployees.length, 1)
  assert.equal(employee.firstName, 'Casey')
  assert.equal(employee.lastName, 'Fiction')
  assert.equal(employee.managerId, morgan.employeeId)
  assert.equal(employee.employmentStatus, 'onboarding')
  assert.equal(employee.compensationConfigured, false)
  assert.equal(result.workflow.employeeStatuses[employee.id], 'onboarding')
  assert.deepEqual(result.workflow.onboarding[employee.id], { profileReviewed: false, jobReviewed: false, stage: 'draft', tasks: Object.fromEntries(employee.onboarding.map(task => [task.id, false])) })
  assert.equal(result.workflow.profileEmails[employee.id], employee.workEmail)
  assert.deepEqual(result.operations.balances[employee.id], { vacation: 40, sick: 24 })
  for (const person of base.employees) {
    assert.deepEqual(result.workflow.onboarding[person.id], before.workflow.onboarding[person.id])
    assert.equal(result.workflow.profileEmails[person.id], before.workflow.profileEmails[person.id])
    assert.equal(result.workflow.employeeStatuses[person.id], before.workflow.employeeStatuses[person.id])
    assert.deepEqual(result.operations.balances[person.id], before.operations.balances[person.id])
  }
  for (const key of ['timeEntries', 'benefitElections', 'payroll', 'payrollHistory', 'sequence']) assert.deepEqual(result.workflow[key], before.workflow[key])
  for (const key of ['records', 'ptoRequests', 'activity', 'sequence']) assert.deepEqual(result.operations[key], before.operations[key])
  const effective = link.recruitingFixture(base, result.recruiting)
  assert.equal(effective.employees.length, base.employees.length + 1)
  assert.equal(effective.employees.find(person => person.id === employee.id).workEmail, 'casey.fiction@example.invalid')
  assert.deepEqual(state, before)
  assert.equal(base.employees.some(person => person.id === employee.id), false)
})

test('a recruited employee completes onboarding, submits own hours, receives scoped manager approval and sees matching frozen pay', () => {
  const result = hire(toOffer(ongoingWork()))
  const fixture = link.recruitingFixture(base, result.recruiting)
  const employee = result.recruiting.hiredEmployees[0]
  const self = { role: 'employee', employeeId: employee.id }
  let state = result.workflow
  assert.throws(() => hrChange(state, self, { type: 'complete-onboarding', employeeId: employee.id }, fixture), /Review sample onboarding/)
  state = hrChange(state, self, { type: 'review-profile', employeeId: employee.id }, fixture)
  state = hrChange(state, self, { type: 'review-job', employeeId: employee.id }, fixture)
  for (const task of employee.onboarding) state = hrChange(state, self, { type: 'check-task', employeeId: employee.id, taskId: task.id, complete: true }, fixture)
  state = hrChange(state, self, { type: 'review-onboarding', employeeId: employee.id }, fixture)
  state = hrChange(state, self, { type: 'complete-onboarding', employeeId: employee.id }, fixture)
  assert.equal(state.employeeStatuses[employee.id], 'active')
  state = hrChange(state, self, { type: 'add-time', date: '2026-10-15', hours: 8, source: 'manual' }, fixture)
  const entryId = state.timeEntries.at(-1).id
  state = hrChange(state, self, { type: 'submit-time', entryIds: [entryId] }, fixture)
  assert.throws(() => hrChange(state, self, { type: 'approve-time', entryId }, fixture), /Approval requires/)
  state = hrChange(state, morgan, { type: 'approve-time', entryId }, fixture)
  state = submitPayroll(state, fixture)
  assert.deepEqual(state.payroll.inputs.map(input => input.entryId), [entryId])
  assert.equal(state.payrollHistory.length, result.workflow.payrollHistory.length + 1)
  assert.deepEqual(state.payroll.employeeTotals, [{ employeeId: employee.id, hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 0, netCents: 19200 }])
  const statements = insights.projectEmployeePayStatements(self, fixture, state)
  assert.equal(statements.length, 1)
  assert.equal(statements[0].employeeName, 'Casey Fiction')
  assert.equal(statements[0].receipt, state.payroll.receipt)
  assert.equal(statements[0].periodStart, '2026-10-01')
  assert.equal(statements[0].periodEnd, '2026-10-15')
  assert.equal(statements[0].netCents, state.payroll.employeeTotals[0].netCents)
  assert.deepEqual(statements[0].entries, [{ id: entryId, date: '2026-10-15', hours: 8, rateCents: 3000 }])
  assert.equal(insights.projectEmployeePayStatements(morgan, fixture, state).length, 0)
  assert.equal(insights.projectEmployeePayStatements(avery, fixture, state).some(statement => statement.employeeId === employee.id), false)
  assert.throws(() => hrChange(state, owner, { type: 'submit-payroll' }, fixture), /Review fictional/)
})

test('hiring does not automatically make approved new-hire time eligible before onboarding completion', () => {
  const result = hire()
  const fixture = link.recruitingFixture(base, result.recruiting)
  const employee = result.recruiting.hiredEmployees[0]
  const self = { role: 'employee', employeeId: employee.id }
  let state = hrChange(result.workflow, self, { type: 'add-time', date: '2026-10-15', hours: 8, source: 'manual' }, fixture)
  const entryId = state.timeEntries.at(-1).id
  state = hrChange(state, self, { type: 'submit-time', entryIds: [entryId] }, fixture)
  state = hrChange(state, morgan, { type: 'approve-time', entryId }, fixture)
  assert.equal(state.employeeStatuses[employee.id], 'onboarding')
  assert.throws(() => hrChange(state, owner, { type: 'prepare-payroll', period: { start: '2026-10-01', end: '2026-10-15' } }, fixture), /active sample employee/)
  assert.equal(insights.projectEmployeePayStatements(self, fixture, state).length, 0)
})

test('duplicate hires and unauthorized or out-of-order pipeline changes leave recruiting and HR inputs unchanged', () => {
  const offered = toOffer(ongoingWork())
  const candidate = offered.recruiting.candidates.find(person => person.firstName === 'Casey')
  const before = structuredClone(offered)
  assert.throws(() => apply(offered, { type: 'advance-candidate', candidateId: candidate.id, stage: 'hired' }, morgan), /Only the owner or HR/)
  assert.deepEqual(offered, before)
  const hired = hire(offered)
  const accepted = structuredClone(hired)
  assert.throws(() => apply(hired, { type: 'advance-candidate', candidateId: candidate.id, stage: 'hired' }), /final stage/)
  assert.deepEqual(hired, accepted)
  const draft = initial()
  const draftBefore = structuredClone(draft)
  assert.throws(() => apply(draft, { type: 'advance-candidate', candidateId: draft.recruiting.candidates[0].id, stage: 'hired' }), /Publish/)
  assert.deepEqual(draft, draftBefore)
})

test('employee and HR-state collisions reject the entire hire without overwriting any ledger', () => {
  const offered = toOffer(ongoingWork())
  const candidate = offered.recruiting.candidates.find(person => person.firstName === 'Casey')
  const expectedId = hire(offered).recruiting.hiredEmployees[0].id
  const action = { type: 'advance-candidate', candidateId: candidate.id, stage: 'hired' }
  const collisionBase = structuredClone(base)
  collisionBase.employees.push({ ...structuredClone(base.employees[0]), id: expectedId, workEmail: 'existing.identity@example.invalid' })
  const beforeBaseCollision = structuredClone(offered)
  assert.throws(() => apply(offered, action, owner, collisionBase), /already been added|collides/)
  assert.deepEqual(offered, beforeBaseCollision)
  for (const field of ['onboarding', 'profileEmails', 'employeeStatuses', 'balances']) {
    const collision = structuredClone(offered)
    if (field === 'balances') collision.operations.balances[expectedId] = { vacation: 7, sick: 3 }
    else if (field === 'profileEmails') collision.workflow.profileEmails[expectedId] = 'preserve.profile@example.invalid'
    else if (field === 'employeeStatuses') collision.workflow.employeeStatuses[expectedId] = 'active'
    else collision.workflow.onboarding[expectedId] = { stage: 'reviewed', profileReviewed: true, jobReviewed: true, tasks: {} }
    const before = structuredClone(collision)
    assert.throws(() => apply(collision, action), /already exists/)
    assert.deepEqual(collision, before)
  }
  const hired = hire(offered)
  const corruptedRecruiting = structuredClone(hired.recruiting)
  corruptedRecruiting.hiredEmployees.push(structuredClone(corruptedRecruiting.hiredEmployees[0]))
  const copied = structuredClone(corruptedRecruiting)
  assert.throws(() => link.recruitingFixture(base, corruptedRecruiting), /collides/)
  assert.deepEqual(corruptedRecruiting, copied)
})

test('effective recruited identities can receive new performance and survey assignments without changing base fixture membership', () => {
  const result = hire()
  const fixture = link.recruitingFixture(base, result.recruiting)
  const employee = result.recruiting.hiredEmployees[0]
  const self = { role: 'employee', employeeId: employee.id }
  let goals = performance.createPerformanceState(base)
  goals = performance.transitionPerformance(goals, owner, { type: 'create-goal', employeeId: employee.id, title: 'Complete the fictional starter project' }, fixture)
  assert.equal(performance.scopedPerformance(goals, self, fixture).goals.at(-1).employeeId, employee.id)
  assert.throws(() => performance.transitionPerformance(goals, owner, { type: 'create-review', employeeId: employee.id, title: 'Starter review' }, base), /employee|Employee/)
  goals = performance.transitionPerformance(goals, owner, { type: 'create-review', employeeId: employee.id, title: 'Starter review' }, fixture)
  assert.equal(performance.scopedPerformance(goals, self, fixture).reviews.at(-1).managerId, morgan.employeeId)
  let feedback = surveys.createSurveysState(base)
  feedback = surveys.transitionSurveys(feedback, owner, { type: 'create-survey', title: 'New hire experience', audienceIds: [employee.id], ratingPrompt: 'How clear were the sample steps?', textPrompt: 'What sample step would you improve?' }, fixture)
  const surveyId = feedback.surveys.at(-1).id
  feedback = surveys.transitionSurveys(feedback, owner, { type: 'publish-survey', surveyId }, fixture)
  assert.deepEqual(surveys.scopedSurveys(feedback, self, fixture).find(survey => survey.id === surveyId).audienceIds, [employee.id])
  assert.equal(surveys.scopedSurveys(feedback, avery, fixture).some(survey => survey.id === surveyId), false)
  assert.equal(base.employees.some(person => person.id === employee.id), false)
})
