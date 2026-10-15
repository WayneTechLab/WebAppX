import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const workflowModel = await loadMockModel(new URL('../../src/hr/mock-workflows.ts', import.meta.url))
const peopleModel = await loadMockModel(new URL('../../src/hr/people-operations.ts', import.meta.url))
const linked = await loadMockModel(new URL('../../src/hr/linked-operations.ts', import.meta.url))
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const avery = { role: 'employee', employeeId: 'employee-002' }
const jordan = { role: 'employee', employeeId: 'employee-003' }
const manager = { role: 'manager', employeeId: 'employee-001' }
const create = (data = fixture) => ({ workflow: workflowModel.createMockHrState(data), operations: peopleModel.createPeopleOperations(data) })
const apply = (state, event, actor, data = fixture) => linked.applyLinkedPeopleOperation(state.workflow, state.operations, event, actor, data)

test('welcome policy acknowledgment completes the same employee assignment and pending onboarding policy exactly once', () => {
  const initial = create()
  const before = structuredClone(initial)
  const state = apply(initial, { type: 'acknowledge-policy', recordId: 'policy-001' }, avery)
  assert.equal(state.operations.records.policies.find(record => record.id === 'policy-001').status, 'acknowledged')
  assert.equal(state.operations.records.tasks.find(record => record.id === 'task-001').status, 'completed')
  assert.equal(state.workflow.onboarding[avery.employeeId].tasks.policy, true)
  assert.equal(state.workflow.onboarding[avery.employeeId].profileReviewed, false)
  assert.equal(state.workflow.onboarding[avery.employeeId].stage, 'draft')
  assert.deepEqual(state.operations.activity.map(activity => activity.action), ['acknowledge-policy', 'complete-task'])
  assert.deepEqual(initial, before)
  assert.throws(() => apply(state, { type: 'acknowledge-policy', recordId: 'policy-001' }, avery), /already been acknowledged/)
})

test('starter training completes its assigned task through the same manager permission without completing Jordan profile onboarding', () => {
  const initial = create()
  const state = apply(initial, { type: 'complete-training', recordId: 'training-002' }, manager)
  assert.equal(state.operations.records.training.find(record => record.id === 'training-002').status, 'completed')
  assert.equal(state.operations.records.tasks.find(record => record.id === 'task-002').status, 'completed')
  assert.deepEqual(state.workflow, initial.workflow)
  assert.equal(state.workflow.onboarding[jordan.employeeId].tasks.profile, false)
  assert.equal(state.operations.records.training.find(record => record.id === 'training-001').status, 'in-progress')
})

test('policy link preserves completed onboarding receipts and does not duplicate an already completed assignment', () => {
  let state = create()
  for (const event of [{ type: 'review-profile', employeeId: avery.employeeId }, { type: 'review-job', employeeId: avery.employeeId }, { type: 'check-task', employeeId: avery.employeeId, taskId: 'policy', complete: true }, { type: 'review-onboarding', employeeId: avery.employeeId }, { type: 'complete-onboarding', employeeId: avery.employeeId }]) state.workflow = workflowModel.transitionMockHr(state.workflow, avery, event, fixture)
  state.operations = peopleModel.transitionPeopleOperations(state.operations, { type: 'complete-task', recordId: 'task-001' }, avery, fixture)
  const completedWorkflow = structuredClone(state.workflow)
  state = apply(state, { type: 'acknowledge-policy', recordId: 'policy-001' }, avery)
  assert.deepEqual(state.workflow, completedWorkflow)
  assert.deepEqual(state.operations.activity.map(activity => activity.action), ['complete-task', 'acknowledge-policy'])
})

test('explicit fixture ownership and source IDs prevent cross-employee or title-based links', () => {
  const changedTask = structuredClone(fixture)
  changedTask.native.tasks.find(record => record.id === 'task-001').employeeId = jordan.employeeId
  let initial = create(changedTask)
  let state = apply(initial, { type: 'acknowledge-policy', recordId: 'policy-001' }, avery, changedTask)
  assert.equal(state.operations.records.tasks.find(record => record.id === 'task-001').status, 'pending')
  assert.deepEqual(state.workflow, initial.workflow)

  const renamedPolicy = structuredClone(fixture)
  renamedPolicy.native.policies[0].id = 'policy-999'
  initial = create(renamedPolicy)
  state = apply(initial, { type: 'acknowledge-policy', recordId: 'policy-999' }, avery, renamedPolicy)
  assert.equal(state.operations.records.tasks.find(record => record.id === 'task-001').status, 'pending')
  assert.deepEqual(state.workflow, initial.workflow)

  const changedSource = structuredClone(fixture)
  changedSource.native.policies[0].employeeId = jordan.employeeId
  initial = create(changedSource)
  state = apply(initial, { type: 'acknowledge-policy', recordId: 'policy-001' }, jordan, changedSource)
  assert.equal(state.operations.records.tasks.find(record => record.id === 'task-001').status, 'pending')
  assert.deepEqual(state.workflow, initial.workflow)
})

test('normalized per-employee assignments retain explicit fixture connections', () => {
  const data = structuredClone(fixture)
  for (const record of [data.native.policies[0], data.native.tasks[0]]) { delete record.employeeId; record.employeeIds = [avery.employeeId, jordan.employeeId] }
  const state = apply(create(data), { type: 'acknowledge-policy', recordId: `policy-001--${avery.employeeId}` }, avery, data)
  assert.equal(state.operations.records.tasks.find(record => record.id === `task-001--${avery.employeeId}`).status, 'completed')
  assert.equal(state.operations.records.tasks.find(record => record.id === `task-001--${jordan.employeeId}`).status, 'pending')
  assert.equal(state.workflow.onboarding[avery.employeeId].tasks.policy, true)
  assert.equal(state.workflow.onboarding[jordan.employeeId].tasks.profile, false)
})

test('runtime assignment IDs do not authorize links removed or reassigned in the fixture', () => {
  const initial = create()
  for (const module of ['policies', 'tasks']) {
    const data = structuredClone(fixture)
    data.native[module][0].employeeId = jordan.employeeId
    const state = apply(initial, { type: 'acknowledge-policy', recordId: 'policy-001' }, avery, data)
    assert.equal(state.operations.records.policies[0].status, 'acknowledged')
    assert.equal(state.operations.records.tasks[0].status, 'pending')
    assert.deepEqual(state.workflow, initial.workflow)
  }
  const data = structuredClone(fixture)
  data.native.tasks = data.native.tasks.filter(record => record.id !== 'task-001')
  const state = apply(initial, { type: 'acknowledge-policy', recordId: 'policy-001' }, avery, data)
  assert.equal(state.operations.records.tasks[0].status, 'pending')
  assert.deepEqual(state.workflow, initial.workflow)
})

test('unauthorized primary or linked transitions fail atomically without changing either input', () => {
  const initial = create()
  const before = structuredClone(initial)
  assert.throws(() => apply(initial, { type: 'acknowledge-policy', recordId: 'policy-001' }, manager), /cannot acknowledge/)
  // A manager-role self acknowledgment is valid in the people model, but that
  // same actor cannot change the native onboarding record; no partial commit.
  assert.throws(() => apply(initial, { type: 'acknowledge-policy', recordId: 'policy-001' }, { role: 'manager', employeeId: avery.employeeId }), /cannot change that employee onboarding/)
  assert.deepEqual(initial, before)
})
