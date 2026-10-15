import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const workflow = await loadMockModel(new URL('../../src/hr/mock-workflows.ts', import.meta.url))
const people = await loadMockModel(new URL('../../src/hr/people-operations.ts', import.meta.url))
const desk = await loadMockModel(new URL('../../src/hr/service-desk.ts', import.meta.url))
const linked = await loadMockModel(new URL('../../src/hr/recruiting-link.ts', import.meta.url))
const performance = await loadMockModel(new URL('../../src/hr/performance.ts', import.meta.url))
const surveys = await loadMockModel(new URL('../../src/hr/surveys.ts', import.meta.url))
const persistence = await loadMockModel(new URL('../../src/hr/persistence.ts', import.meta.url))
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const initial = () => persistence.createHrDemoState(fixture)
const validate = state => persistence.isHrDemoState(state, fixture)
const roundTrip = state => JSON.parse(JSON.stringify(state))
const owner = { role: 'employer-owner' }
const avery = { role: 'employee', employeeId: 'employee-002' }
const manager = { role: 'manager', employeeId: 'employee-001' }

test('the complete initial HR snapshot is JSON safe and valid', () => {
  const state = initial()
  assert.deepEqual(roundTrip(state), state)
  assert.equal(validate(roundTrip(state)), true)
  assert.equal(state.managementRole, 'employer-owner')
})

test('saved onboarding, benefits, approved time and payroll receipts restore together', () => {
  const state = initial()
  for (const type of ['elect-benefit', 'review-benefit', 'confirm-benefit']) state.workflow = workflow.transitionMockHr(state.workflow, avery, { type, planId: 'benefit-001', election: 'enroll' }, fixture)
  state.workflow = workflow.transitionMockHr(state.workflow, manager, { type: 'approve-time', entryId: 'time-001' }, fixture)
  state.workflow = workflow.transitionMockHr(state.workflow, owner, { type: 'set-sample-rate', employeeId: avery.employeeId, effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }, fixture)
  for (const type of ['prepare-payroll', 'calculate-payroll', 'review-payroll', 'submit-payroll']) state.workflow = workflow.transitionMockHr(state.workflow, owner, { type, ...(type === 'prepare-payroll' ? { period: { start: '2026-10-01', end: '2026-10-15' } } : {}) }, fixture)
  state.selectedEmployee = avery.employeeId
  state.managementRole = 'payroll-admin'
  state.completed = ['contractor-001:profile']
  state.acknowledgements = ['training-001']
  const restored = roundTrip(state)
  assert.equal(validate(restored), true)
  assert.equal(restored.workflow.payrollHistory.length, 1)
  assert.equal(restored.workflow.benefitElections[0].stage, 'confirmed')
  assert.equal(restored.workflow.timeEntries[0].status, 'approved')
  assert.deepEqual(restored.completed, state.completed)
})

test('hired employees and onboarding balances survive the same snapshot', () => {
  let state = initial()
  const candidate = state.recruiting.candidates[0]
  const events = [{ type: 'set-job-status', jobId: candidate.jobId, status: 'published' }, ...['screening', 'interview', 'offer', 'hired'].map(stage => ({ type: 'advance-candidate', candidateId: candidate.id, stage }))]
  for (const event of events) state = { ...state, ...linked.applyRecruitingToHr(state.recruiting, state.workflow, state.operations, owner, event, fixture) }
  const restored = roundTrip(state)
  assert.equal(validate(restored), true)
  const hire = restored.recruiting.hiredEmployees[0]
  assert.equal(restored.workflow.onboarding[hire.id].stage, 'draft')
  assert.deepEqual(restored.operations.balances[hire.id], { vacation: 40, sick: 24 })
  const partial = roundTrip(restored)
  delete partial.operations.balances[hire.id]
  assert.equal(validate(partial), false)
  const missingWorkflow = roundTrip(restored)
  delete missingWorkflow.workflow.onboarding[hire.id]
  assert.equal(validate(missingWorkflow), false)
})

test('talent, service desk, people records and their receipts round trip', () => {
  const state = initial()
  state.performance = performance.transitionPerformance(state.performance, avery, { type: 'update-goal-progress', goalId: state.performance.goals[0].id, progress: 40 }, fixture)
  const surveyId = state.surveys.surveys[0].id
  state.surveys = surveys.transitionSurveys(state.surveys, owner, { type: 'publish-survey', surveyId }, fixture)
  state.surveys = surveys.transitionSurveys(state.surveys, avery, { type: 'save-survey-response', surveyId, rating: 4, text: 'Fictional persisted feedback.' }, fixture)
  state.serviceDesk = desk.transitionHrServiceDesk(state.serviceDesk, avery, { type: 'create-request', category: 'equipment', title: 'Demo accessory', details: 'Fictional saved request.' }, fixture)
  state.operations = people.transitionPeopleOperations(state.operations, { type: 'request-pto', startDate: '2026-10-20', endDate: '2026-10-20', leaveType: 'vacation' }, avery, fixture)
  assert.equal(validate(roundTrip(state)), true)
})

test('missing and malformed nested objects fail closed before rendering', () => {
  const changes = [
    state => { state.workflow.onboarding['employee-002'].tasks = null },
    state => { state.operations.records.assets = 'invalid' },
    state => { state.serviceDesk.requests[0].activity = {} },
    state => { state.performance.goals[0].progress = NaN },
    state => { state.surveys.surveys[0].questions.ratingPrompt = {} },
    state => { state.workflow.payroll.inputs = [null] },
    state => { state.recruiting.candidates[0].activity = [null] },
    state => { delete state.workflow.profileEmails['employee-002'] },
    state => { state.managementRole = 'super-admin' },
    state => { state.completed = ['same', 'same'] },
  ]
  for (const change of changes) { const state = initial(); change(state); assert.equal(validate(state), false) }
  for (const value of [null, [], {}, 'bad', 1]) assert.equal(validate(value), false)
})

test('foreign identities, dangling relationships and duplicate IDs are rejected', () => {
  const changes = [
    state => { state.selectedEmployee = 'unknown-employee' },
    state => { state.workflow.timeEntries[0].employeeId = 'unknown-employee' },
    state => { state.performance.reviews[0].managerId = 'unknown-manager' },
    state => { state.recruiting.candidates[0].jobId = 'unknown-job' },
    state => { state.recruiting.candidates.push(structuredClone(state.recruiting.candidates[0])) },
    state => { state.recruiting.candidates[0].stage = 'hired'; state.recruiting.candidates[0].employeeId = 'unknown-hire' },
    state => { state.surveys.surveys[0].audienceIds.push('unknown-employee') },
    state => { state.operations.records.assets[0].employeeId = 'unknown-employee' },
    state => { state.workflow.payroll.inputs = [{ entryId: 'missing-entry', employeeId: 'employee-002', hours: 8, rateCents: 3000 }] },
  ]
  for (const change of changes) { const state = initial(); change(state); assert.equal(validate(state), false) }
})

test('sample timer accepts the restored hired employee fixture', () => {
  let state = initial()
  const candidate = state.recruiting.candidates[0]
  for (const event of [{ type: 'set-job-status', jobId: candidate.jobId, status: 'published' }, ...['screening', 'interview', 'offer', 'hired'].map(stage => ({ type: 'advance-candidate', candidateId: candidate.id, stage }))]) state = { ...state, ...linked.applyRecruitingToHr(state.recruiting, state.workflow, state.operations, owner, event, fixture) }
  const restored = roundTrip(state)
  const effective = linked.recruitingFixture(fixture, restored.recruiting)
  const actor = { role: 'employee', employeeId: restored.recruiting.hiredEmployees[0].id }
  const timer = workflow.startMockTimer(actor, '2026-10-15', 1000, effective)
  const event = workflow.stopMockTimer(timer, actor, 3601000, effective)
  assert.equal(event.hours, 1)
})
