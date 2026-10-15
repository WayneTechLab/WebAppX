import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const modelUrl = moduleUrl(compile(readFileSync(new URL('../../src/hr/model.ts', import.meta.url), 'utf8')))
const source = compile(readFileSync(new URL('../../src/hr/people-operations.ts', import.meta.url), 'utf8')).replace(/from ['"]\.\/model['"]/, `from '${modelUrl}'`)
const ops = await import(moduleUrl(source))
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const avery = { role: 'employee', employeeId: 'employee-002' }
const jordan = { role: 'employee', employeeId: 'employee-003' }
const morgan = { role: 'manager', employeeId: 'employee-001' }
const owner = { role: 'employer-owner' }
const auditor = { role: 'auditor' }
const event = (type, recordId) => ({ type, recordId })
const change = (state, action, actor = avery, data = fixture) => ops.transitionPeopleOperations(state, action, actor, data)
const request = (startDate, endDate = startDate, leaveType = 'vacation') => ({ type: 'request-pto', startDate, endDate, leaveType })

test('sample PTO balances reserve pending hours and count weekdays without claiming accrual or holiday support', () => {
  const state = ops.createPeopleOperations(fixture)
  assert.deepEqual(ops.getPeopleBalance(state, avery.employeeId, 'vacation'), { total: 40, pending: 16, approved: 0, available: 24 })
  assert.equal(ops.peoplePtoHours('2026-10-16', '2026-10-19'), 16)
  for (const dates of [['2026-10-17', '2026-10-18'], ['2026-02-30', '2026-03-01'], ['2026-10-16', '2026-10-15'], ['2026-10-01', '2026-11-01']]) assert.throws(() => ops.peoplePtoHours(...dates))
})

test('PTO requests enforce own identity, overlap across leave types and remaining reserved balance', () => {
  let state = ops.createPeopleOperations(fixture)
  assert.throws(() => change(state, { ...request('2026-10-15'), employeeId: jordan.employeeId }), /bound employee/)
  assert.throws(() => change(state, request('2026-10-22', '2026-10-23', 'sick')), /overlaps/)
  assert.throws(() => change(state, request('2026-10-05', '2026-10-09')), /Only 24/)
  assert.throws(() => change(state, request('2026-10-15', '2026-10-15', 'unknown')), /vacation or sick/)
  state = change(state, request('2026-10-12', '2026-10-14', 'sick'), jordan)
  assert.equal(ops.getPeopleBalance(state, jordan.employeeId, 'sick').available, 0)
  assert.throws(() => change(state, request('2026-10-15', '2026-10-15', 'sick'), jordan), /Only 0/)
  assert.equal(state.ptoRequests.at(-1).employeeId, jordan.employeeId)
})

test('PTO approval, cancellation and rejection preserve reservation accounting and reject replay', () => {
  let state = ops.createPeopleOperations(fixture)
  const id = state.ptoRequests[0].id
  state = change(state, { type: 'approve-pto', requestId: id }, morgan)
  assert.deepEqual(ops.getPeopleBalance(state, avery.employeeId, 'vacation'), { total: 40, pending: 0, approved: 16, available: 24 })
  assert.throws(() => change(state, { type: 'approve-pto', requestId: id }, morgan), /Only pending/)
  state = change(state, { type: 'cancel-pto', requestId: id })
  assert.equal(ops.getPeopleBalance(state, avery.employeeId, 'vacation').available, 40)
  assert.throws(() => change(state, { type: 'cancel-pto', requestId: id }), /Only pending or approved/)
  state = change(state, request('2026-10-22', '2026-10-23'))
  const replacement = state.ptoRequests.at(-1).id
  state = change(state, { type: 'reject-pto', requestId: replacement, reason: 'Demo coverage review' }, morgan)
  assert.equal(ops.getPeopleBalance(state, avery.employeeId, 'vacation').available, 40)
  assert.equal(state.ptoRequests.at(-1).status, 'rejected')
  assert.equal(state.ptoRequests.at(-1).reason, 'Demo coverage review')
  assert.equal(new Set(state.activity.map(entry => entry.receipt)).size, 4)
})

test('manager leave decisions require a direct report and exclude self approval; auditors cannot write', () => {
  let state = ops.createPeopleOperations(fixture)
  state = change(state, request('2026-10-15'), morgan)
  const ownRequest = state.ptoRequests.at(-1)
  assert.throws(() => change(state, { type: 'approve-pto', requestId: ownRequest.id }, morgan), /self-approval/)
  assert.throws(() => change(state, { type: 'approve-pto', requestId: state.ptoRequests[0].id }, { role: 'manager', employeeId: jordan.employeeId }), /direct-report/)
  assert.throws(() => change(state, { type: 'approve-pto', requestId: ownRequest.id }, auditor), /read-only/)
  assert.throws(() => change(state, request('2026-10-15'), { role: 'unknown', employeeId: avery.employeeId }), /bound employee/)
  state = change(state, { type: 'approve-pto', requestId: ownRequest.id }, owner)
  assert.equal(state.ptoRequests.at(-1).status, 'approved')
})

test('multi-employee policy assignments have separate acknowledgments and cannot be signed by managers or HR', () => {
  const data = structuredClone(fixture)
  data.native.policies = [{ id: 'policy-shared', title: 'Shared demo policy', employeeIds: [avery.employeeId, jordan.employeeId], status: 'published', version: 'example-1' }]
  let state = ops.createPeopleOperations(data)
  assert.equal(state.records.policies.length, 2)
  const ownPolicy = ops.getPeopleRecords(state, 'policies', avery, data)[0]
  const otherPolicy = ops.getPeopleRecords(state, 'policies', jordan, data)[0]
  assert.equal(ownPolicy.sourceId, 'policy-shared')
  assert.notEqual(ownPolicy.id, otherPolicy.id)
  assert.throws(() => change(state, event('acknowledge-policy', ownPolicy.id), morgan, data), /Only the bound person/)
  assert.throws(() => change(state, event('acknowledge-policy', ownPolicy.id), owner, data), /Only the bound person/)
  state = change(state, event('acknowledge-policy', ownPolicy.id), avery, data)
  assert.equal(ops.getPeopleRecords(state, 'policies', avery, data)[0].status, 'acknowledged')
  assert.equal(ops.getPeopleRecords(state, 'policies', jordan, data)[0].status, 'published')
  assert.throws(() => change(state, event('acknowledge-policy', otherPolicy.id), avery, data), /cannot change/)
  assert.throws(() => change(state, event('acknowledge-policy', ownPolicy.id), avery, data), /already been acknowledged/)
})

test('assigned task and training completion respects self or direct-report scope and is idempotently guarded', () => {
  let state = ops.createPeopleOperations(fixture)
  assert.throws(() => change(state, event('complete-task', 'task-002')), /cannot change/)
  state = change(state, event('complete-task', 'task-001'))
  assert.equal(state.records.tasks.find(record => record.id === 'task-001').status, 'completed')
  assert.throws(() => change(state, event('complete-task', 'task-001')), /already complete/)
  state = change(state, event('complete-training', 'training-002'), morgan)
  assert.equal(state.records.training.find(record => record.id === 'training-002').status, 'completed')
  assert.throws(() => change(state, event('complete-training', 'training-001'), auditor), /read-only/)
  assert.throws(() => change(state, event('complete-training', 'training-001'), { role: 'manager', employeeId: jordan.employeeId }), /cannot change/)
  assert.throws(() => change(state, event('complete-task', 'task-002'), { role: 'unknown', employeeId: jordan.employeeId }), /cannot change/)
})

test('asset return requires a request and a separate scoped custodian confirmation', () => {
  let state = ops.createPeopleOperations(fixture)
  assert.throws(() => change(state, event('confirm-asset-return', 'asset-001'), morgan), /Request the sample/)
  state = change(state, event('acknowledge-asset', 'asset-001'))
  state = change(state, event('request-asset-return', 'asset-001'))
  assert.throws(() => change(state, event('confirm-asset-return', 'asset-001')), /requires HR/)
  assert.throws(() => change(state, event('confirm-asset-return', 'asset-001'), { role: 'manager', employeeId: jordan.employeeId }), /cannot change/)
  state = change(state, event('confirm-asset-return', 'asset-001'), morgan)
  assert.equal(state.records.assets.find(record => record.id === 'asset-001').status, 'returned')
  assert.throws(() => change(state, event('confirm-asset-return', 'asset-001'), morgan), /Request the sample/)
  assert.equal(state.activity.length, 3)
  assert.deepEqual(state.activity.map(entry => entry.actor.role), ['employee', 'employee', 'manager'])
})

test('only own non-tax documents can be acknowledged and tax placeholders never count as actionable work', () => {
  let state = ops.createPeopleOperations(fixture)
  const summary = ops.peopleOperationsSummary(state, avery, fixture)
  assert.equal(summary.documents, 1)
  assert.throws(() => change(state, event('acknowledge-document', 'document-002')), /Only non-tax/)
  assert.throws(() => change(state, event('acknowledge-document', 'document-001'), owner), /Only the bound person/)
  state = change(state, event('acknowledge-document', 'document-001'))
  const after = ops.peopleOperationsSummary(state, avery, fixture)
  assert.equal(after.documents, 0)
  assert.equal(after.openCount, summary.openCount - 1)
  assert.equal(state.records.documents.find(record => record.id === 'document-002').status, 'placeholder')
})

test('receipts and activity are deterministic, scoped and independent of fixture/source mutation', () => {
  const before = JSON.stringify(fixture)
  const initial = ops.createPeopleOperations(fixture)
  assert.equal(ops.canPeopleOperation(initial, event('complete-task', 'task-001'), avery, fixture), true)
  assert.equal(initial.sequence, 1)
  assert.equal(initial.activity.length, 0)
  const first = change(initial, event('complete-task', 'task-001'))
  const repeat = change(initial, event('complete-task', 'task-001'))
  assert.deepEqual(first, repeat)
  assert.equal(first.activity[0].receipt, 'MOCK-PEOPLE-0001')
  assert.equal(ops.getPeopleActivity(first, avery, fixture).length, 1)
  assert.equal(ops.getPeopleActivity(first, jordan, fixture).length, 0)
  assert.equal(ops.getPeopleActivity(first, morgan, fixture).length, 1)
  assert.equal(ops.getPeopleActivity(first, auditor, fixture).length, 1)
  assert.equal(ops.getPeopleActivity(first, { role: 'unknown' }, fixture).length, 0)
  assert.equal(JSON.stringify(fixture), before)
  assert.deepEqual(ops.createPeopleOperations(fixture), initial)
})
