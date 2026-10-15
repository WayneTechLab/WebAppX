import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/hr/performance.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const performance = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const employee = { role: 'employee', employeeId: 'employee-002' }
const jordan = { role: 'employee', employeeId: 'employee-003' }
const manager = { role: 'manager', employeeId: 'employee-001' }
const owner = { role: 'employer-owner' }
const hr = { role: 'hr-admin' }
const change = (state, actor, event, data = fixture) => performance.transitionPerformance(state, actor, event, data)
const ownReview = (state, employeeId = employee.employeeId) => state.reviews.find(review => review.employeeId === employeeId)
const ownGoal = (state, employeeId = employee.employeeId) => state.goals.find(goal => goal.employeeId === employeeId)
const reviewEvent = (type, reviewId, extra = {}) => ({ type, reviewId, ...extra })

function selfSubmitted(data = fixture, employeeActor = employee) {
  let state = performance.createPerformanceState(data)
  const reviewId = ownReview(state, employeeActor.employeeId).id
  state = change(state, employeeActor, reviewEvent('save-self-review', reviewId, { comments: 'I completed the sample project and learned from the team.' }), data)
  return change(state, employeeActor, reviewEvent('submit-self-review', reviewId), data)
}

function published() {
  let state = selfSubmitted()
  const reviewId = ownReview(state).id
  state = change(state, manager, reviewEvent('save-manager-review', reviewId, { comments: 'The sample project met the agreed fictional goals.' }))
  return change(state, manager, reviewEvent('publish-review', reviewId))
}

test('performance state seeds the sample goal and reviews without mutating reusable fixtures or prior state', () => {
  const beforeFixture = structuredClone(fixture)
  const initial = performance.createPerformanceState(fixture)
  const before = structuredClone(initial)
  assert.ok(ownGoal(initial))
  assert.ok(ownReview(initial))
  assert.ok(ownReview(initial, jordan.employeeId))
  const next = change(initial, employee, { type: 'create-goal', employeeId: employee.employeeId, title: 'Practice the sample presentation' })
  assert.equal(next.goals.length, initial.goals.length + 1)
  assert.deepEqual(initial, before)
  assert.deepEqual(fixture, beforeFixture)
})

test('employees own goal progress while HR can assign goals and completion is terminal', () => {
  let state = performance.createPerformanceState(fixture)
  state = change(state, hr, { type: 'create-goal', employeeId: employee.employeeId, title: 'Complete the sample design goal' })
  const goalId = state.goals.at(-1).id
  assert.throws(() => change(state, owner, { type: 'update-goal-progress', goalId, progress: 50 }))
  assert.throws(() => change(state, manager, { type: 'update-goal-progress', goalId, progress: 50 }))
  assert.throws(() => change(state, jordan, { type: 'update-goal-progress', goalId, progress: 50 }))
  state = change(state, employee, { type: 'update-goal-progress', goalId, progress: 50 })
  assert.equal(state.goals.at(-1).progress, 50)
  assert.equal(state.goals.at(-1).status, 'active')
  state = change(state, employee, { type: 'update-goal-progress', goalId, progress: 100 })
  assert.equal(state.goals.at(-1).status, 'completed')
  assert.throws(() => change(state, employee, { type: 'update-goal-progress', goalId, progress: 80 }))
  state = change(state, manager, { type: 'create-goal', employeeId: manager.employeeId, title: 'Practice a sample management skill' })
  state = change(state, manager, { type: 'update-goal-progress', goalId: state.goals.at(-1).id, progress: 25 })
  assert.equal(state.goals.at(-1).employeeId, manager.employeeId)
  assert.equal(state.goals.at(-1).progress, 25)
})

test('a self review moves through manager publication and employee acknowledgment with independent receipts', () => {
  const initial = performance.createPerformanceState(fixture)
  let state = selfSubmitted()
  const reviewId = ownReview(state).id
  assert.equal(ownReview(initial).stage, 'draft')
  assert.equal(ownReview(state).stage, 'self-submitted')
  state = change(state, manager, reviewEvent('save-manager-review', reviewId, { comments: 'The fictional review is complete and ready to share.' }))
  assert.equal(ownReview(state).stage, 'manager-review')
  state = change(state, manager, reviewEvent('publish-review', reviewId))
  assert.equal(ownReview(state).stage, 'published')
  state = change(state, employee, reviewEvent('acknowledge-review', reviewId))
  assert.equal(ownReview(state).stage, 'acknowledged')
  const activity = ownReview(state).activity
  assert.ok(activity.length >= 5)
  assert.equal(new Set(activity.map(item => item.receipt)).size, activity.length)
  assert.throws(() => change(state, employee, reviewEvent('acknowledge-review', reviewId)))
  assert.throws(() => change(state, manager, reviewEvent('publish-review', reviewId)))
})

test('review lifecycle refuses skipped steps, empty comments and edits after submission or publication', () => {
  let state = performance.createPerformanceState(fixture)
  const reviewId = ownReview(state).id
  assert.throws(() => change(state, employee, reviewEvent('submit-self-review', reviewId)))
  assert.throws(() => change(state, manager, reviewEvent('save-manager-review', reviewId, { comments: 'Too early to review.' })))
  assert.throws(() => change(state, manager, reviewEvent('publish-review', reviewId)))
  assert.throws(() => change(state, employee, reviewEvent('acknowledge-review', reviewId)))
  state = selfSubmitted()
  assert.throws(() => change(state, employee, reviewEvent('save-self-review', reviewId, { comments: 'Changing an already submitted answer.' })))
  assert.throws(() => change(state, employee, reviewEvent('submit-self-review', reviewId)))
  assert.throws(() => change(state, manager, reviewEvent('publish-review', reviewId)))
  state = published()
  assert.throws(() => change(state, manager, reviewEvent('save-manager-review', reviewId, { comments: 'Changing an already published review.' })))
})

test('owner and HR cannot impersonate employees or assigned reviewers, and managers cannot approve themselves', () => {
  let state = selfSubmitted()
  const reviewId = ownReview(state).id
  for (const actor of [owner, hr, manager, jordan]) {
    assert.throws(() => change(performance.createPerformanceState(fixture), actor, reviewEvent('save-self-review', reviewId, { comments: 'A sample answer under the wrong identity.' })))
  }
  for (const actor of [owner, hr, employee, jordan, { role: 'manager', employeeId: 'employee-003' }]) {
    assert.throws(() => change(state, actor, reviewEvent('save-manager-review', reviewId, { comments: 'A sample review under the wrong identity.' })))
  }
  assert.throws(() => change(state, owner, { type: 'create-review', employeeId: manager.employeeId, title: 'Sample manager review' }))
  const managedManager = structuredClone(fixture)
  managedManager.employees.find(person => person.id === manager.employeeId).managerId = jordan.employeeId
  state = change(state, owner, { type: 'create-review', employeeId: manager.employeeId, title: 'Sample manager review' }, managedManager)
  const managerReviewId = state.reviews.at(-1).id
  state = change(state, manager, reviewEvent('save-self-review', managerReviewId, { comments: 'My sample manager self reflection.' }), managedManager)
  state = change(state, manager, reviewEvent('submit-self-review', managerReviewId), managedManager)
  assert.throws(() => change(state, manager, reviewEvent('save-manager-review', managerReviewId, { comments: 'I cannot review my own work.' }), managedManager))
  assert.throws(() => change(published(), manager, reviewEvent('acknowledge-review', reviewId)))
})

test('draft self and manager comments are private until their corresponding submission and publication', () => {
  let state = performance.createPerformanceState(fixture)
  const reviewId = ownReview(state).id
  state = change(state, employee, reviewEvent('save-self-review', reviewId, { comments: 'Private sample self reflection.' }))
  assert.equal(ownReview(performance.scopedPerformance(state, employee, fixture)).selfComments, 'Private sample self reflection.')
  for (const actor of [manager, owner, hr, { role: 'auditor' }]) {
    assert.equal(ownReview(performance.scopedPerformance(state, actor, fixture)).selfComments, undefined)
  }
  state = change(state, employee, reviewEvent('submit-self-review', reviewId))
  assert.equal(ownReview(performance.scopedPerformance(state, manager, fixture)).selfComments, 'Private sample self reflection.')
  state = change(state, manager, reviewEvent('save-manager-review', reviewId, { comments: 'Private sample manager notes.' }))
  assert.equal(ownReview(performance.scopedPerformance(state, manager, fixture)).managerComments, 'Private sample manager notes.')
  for (const actor of [employee, owner, hr, { role: 'auditor' }]) {
    assert.equal(ownReview(performance.scopedPerformance(state, actor, fixture)).managerComments, undefined)
  }
  state = change(state, manager, reviewEvent('publish-review', reviewId))
  for (const actor of [employee, owner, hr]) assert.equal(ownReview(performance.scopedPerformance(state, actor, fixture)).managerComments, 'Private sample manager notes.')
  const auditReview = ownReview(performance.scopedPerformance(state, { role: 'auditor' }, fixture))
  assert.equal(auditReview.selfComments, undefined)
  assert.equal(auditReview.managerComments, undefined)
})

test('performance projections follow current reporting lines and refuse unrelated roles or forged identities', () => {
  const state = published()
  assert.deepEqual(new Set(performance.scopedPerformance(state, employee, fixture).reviews.map(review => review.employeeId)), new Set([employee.employeeId]))
  assert.deepEqual(new Set(performance.scopedPerformance(state, manager, fixture).reviews.map(review => review.employeeId)), new Set([employee.employeeId, jordan.employeeId]))
  for (const actor of [{ role: 'payroll-admin' }, { role: 'contractor' }, { role: 'unknown' }, { role: 'employee' }, { role: 'employee', employeeId: 'foreign' }, { role: 'manager', employeeId: 'foreign' }]) {
    assert.deepEqual(performance.scopedPerformance(state, actor, fixture), { goals: [], reviews: [] })
  }
  const transferred = structuredClone(fixture)
  transferred.employees.find(person => person.id === employee.employeeId).managerId = null
  assert.equal(ownReview(performance.scopedPerformance(state, manager, transferred)), undefined)
  assert.throws(() => change(selfSubmitted(), manager, reviewEvent('save-manager-review', ownReview(state).id, { comments: 'Former reporting line cannot authorize this.' }), transferred))
})

test('performance mutations validate identifiers, text and progress without accepting dangerous property names', () => {
  const state = performance.createPerformanceState(fixture)
  const goalId = ownGoal(state).id
  const reviewId = ownReview(state).id
  for (const employeeId of ['foreign', '__proto__', 'constructor']) {
    assert.throws(() => change(state, owner, { type: 'create-goal', employeeId, title: 'Valid sample title' }))
    assert.throws(() => change(state, owner, { type: 'create-review', employeeId, title: 'Valid sample title' }))
  }
  for (const title of ['', '  ', 'ab', 'a'.repeat(101), 'Bad\u0000title']) assert.throws(() => change(state, employee, { type: 'create-goal', employeeId: employee.employeeId, title }))
  for (const progress of [-1, 101, NaN, Infinity, '50']) assert.throws(() => change(state, employee, { type: 'update-goal-progress', goalId, progress }))
  for (const comments of ['', '  ', 'ab', 'a'.repeat(2001), 'Bad\u0000notes']) assert.throws(() => change(state, employee, reviewEvent('save-self-review', reviewId, { comments })))
  for (const id of ['foreign', '__proto__', 'constructor']) {
    assert.throws(() => change(state, employee, { type: 'update-goal-progress', goalId: id, progress: 25 }))
    assert.throws(() => change(state, employee, reviewEvent('save-self-review', id, { comments: 'Valid sample answer.' })))
  }
  for (const actor of [{ role: 'auditor' }, { role: 'payroll-admin' }, { role: 'contractor' }, { role: 'employee', employeeId: 'foreign' }]) assert.throws(() => change(state, actor, { type: 'create-goal', employeeId: employee.employeeId, title: 'Valid sample title' }))
})

test('review creation permits a new cycle only after acknowledgment and handles newly hired sample employees', () => {
  let state = performance.createPerformanceState(fixture)
  assert.throws(() => change(state, owner, { type: 'create-review', employeeId: employee.employeeId, title: 'Duplicate open cycle' }))
  state = published()
  state = change(state, employee, reviewEvent('acknowledge-review', ownReview(state).id))
  state = change(state, hr, { type: 'create-review', employeeId: employee.employeeId, title: 'Next sample review cycle' })
  assert.equal(state.reviews.at(-1).stage, 'draft')
  const extended = structuredClone(fixture)
  extended.employees.push({ ...structuredClone(fixture.employees[1]), id: 'employee-hired-001', firstName: 'New', lastName: 'Sample', workEmail: 'new@example.invalid' })
  const newEmployee = { role: 'employee', employeeId: 'employee-hired-001' }
  state = change(state, owner, { type: 'create-goal', employeeId: newEmployee.employeeId, title: 'Complete the new hire sample goal' }, extended)
  state = change(state, owner, { type: 'create-review', employeeId: newEmployee.employeeId, title: 'New hire sample review' }, extended)
  const own = performance.scopedPerformance(state, newEmployee, extended)
  assert.equal(own.goals.length, 1)
  assert.equal(own.reviews.length, 1)
  assert.equal(own.reviews[0].managerId, manager.employeeId)
})

test('dashboard summary counts only role-visible goals and actionable review stages', () => {
  const initial = performance.createPerformanceState(fixture)
  assert.equal(performance.performanceSummary(initial, employee, fixture).selfReviewsDue, 1)
  assert.equal(performance.performanceSummary(initial, manager, fixture).managerReviewsDue, 0)
  let state = selfSubmitted()
  assert.equal(performance.performanceSummary(state, employee, fixture).selfReviewsDue, 0)
  assert.equal(performance.performanceSummary(state, manager, fixture).managerReviewsDue, 1)
  state = published()
  assert.equal(performance.performanceSummary(state, manager, fixture).managerReviewsDue, 0)
  assert.equal(performance.performanceSummary(state, employee, fixture).acknowledgmentsDue, 1)
  assert.equal(performance.performanceSummary(state, jordan, fixture).acknowledgmentsDue, 0)
  const reviewId = ownReview(state).id
  state = change(state, employee, reviewEvent('acknowledge-review', reviewId))
  assert.equal(performance.performanceSummary(state, employee, fixture).acknowledgmentsDue, 0)
  assert.equal(performance.performanceSummary(state, { role: 'payroll-admin' }, fixture).goals, 0)
})
