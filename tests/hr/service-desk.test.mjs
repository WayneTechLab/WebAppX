import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = readFileSync(new URL('../../src/hr/service-desk.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const desk = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const employee = { role: 'employee', employeeId: 'employee-002' }
const manager = { role: 'manager', employeeId: 'employee-001' }
const owner = { role: 'employer-owner' }
const createEvent = { type: 'create-request', category: 'equipment', title: 'Demo laptop stand', details: 'A fictional accessory request for the sample workstation.' }
const change = (state, actor, event, data = fixture) => desk.transitionHrServiceDesk(state, actor, event, data)
function created(actor = employee) { return change(desk.createHrServiceDesk(fixture), actor, createEvent) }

test('employee request moves through assignment, work, resolution and reopen with immutable activity receipts', () => {
  const initial = desk.createHrServiceDesk(fixture)
  let state = change(initial, employee, createEvent)
  const requestId = state.requests.at(-1).id
  assert.equal(initial.requests.length, fixture.native.cases.length)
  assert.equal(state.requests.at(-1).employeeId, employee.employeeId)
  assert.throws(() => change(state, manager, { type: 'set-request-status', requestId, status: 'in-progress' }), /Assign an owner/)
  state = change(state, manager, { type: 'assign-request', requestId, assigneeId: manager.employeeId })
  state = change(state, manager, { type: 'set-request-status', requestId, status: 'in-progress' })
  assert.throws(() => change(state, manager, { type: 'set-request-status', requestId, status: 'resolved', resolution: ' ' }), /resolution/)
  state = change(state, manager, { type: 'set-request-status', requestId, status: 'resolved', resolution: 'Sample accessory delivered.' })
  assert.equal(desk.scopedHrRequests(state, employee, fixture)[0].status, 'resolved')
  assert.throws(() => change(state, manager, { type: 'assign-request', requestId, assigneeId: 'hr-team' }), /Reopen/)
  state = change(state, owner, { type: 'set-request-status', requestId, status: 'open' })
  const request = state.requests.at(-1)
  assert.equal(request.resolution, undefined)
  assert.deepEqual(request.activity.map(activity => activity.action), ['created', 'assigned', 'started', 'resolved', 'reopened'])
  assert.equal(new Set(request.activity.map(activity => activity.receipt)).size, 5)
  assert.match(request.activity.at(-1).receipt, /^MOCK-HR-\d{4}$/)
})

test('service desk projections hide other employee and company cases and deny unrelated roles', () => {
  let state = created()
  state = change(state, { role: 'employee', employeeId: 'employee-003' }, createEvent)
  state = change(state, { role: 'employee', employeeId: manager.employeeId }, createEvent)
  assert.deepEqual(desk.scopedHrRequests(state, employee, fixture).map(request => request.employeeId), [employee.employeeId])
  assert.deepEqual(desk.scopedHrRequests(state, manager, fixture).map(request => request.employeeId), ['employee-002', 'employee-003'])
  for (const role of ['payroll-admin', 'contractor', 'unknown']) assert.deepEqual(desk.scopedHrRequests(state, { role }, fixture), [])
  for (const actor of [{ role: 'employee' }, { role: 'employee', employeeId: 'foreign' }, { role: 'manager', employeeId: 'foreign' }]) assert.deepEqual(desk.scopedHrRequests(state, actor, fixture), [])
  assert.equal(desk.scopedHrRequests(state, { role: 'auditor' }, fixture).length, state.requests.length)
})

test('manager cannot mutate own, company or foreign-team requests, while owner and HR can triage company cases', () => {
  let state = created({ role: 'employee', employeeId: manager.employeeId })
  const ownId = state.requests.at(-1).id
  const companyId = state.requests[0].id
  for (const requestId of [ownId, companyId]) assert.throws(() => change(state, manager, { type: 'assign-request', requestId, assigneeId: 'hr-team' }), /cannot manage/)
  const unrelated = structuredClone(fixture)
  unrelated.employees.find(person => person.id === 'employee-002').managerId = null
  const foreignState = created()
  assert.throws(() => change(foreignState, manager, { type: 'assign-request', requestId: foreignState.requests.at(-1).id, assigneeId: 'hr-team' }, unrelated), /cannot manage/)
  state = change(state, { role: 'hr-admin' }, { type: 'set-request-status', requestId: companyId, status: 'in-progress' })
  assert.equal(state.requests[0].status, 'in-progress')
})

test('auditor, employee and payroll administrator cannot change requests; assignment validates role and resources', () => {
  const state = created()
  const requestId = state.requests.at(-1).id
  for (const actor of [employee, { role: 'auditor' }, { role: 'payroll-admin' }, { role: 'contractor' }]) assert.throws(() => change(state, actor, { type: 'assign-request', requestId, assigneeId: 'hr-team' }), /cannot manage/)
  for (const assigneeId of ['foreign', 'employee-002', '__proto__', 'constructor']) assert.throws(() => change(state, owner, { type: 'assign-request', requestId, assigneeId }), /valid sample/)
  for (const requestId of ['foreign', '__proto__', 'constructor']) assert.throws(() => change(state, owner, { type: 'assign-request', requestId, assigneeId: 'hr-team' }), /not found/)
  assert.throws(() => change(state, owner, { type: 'set-request-status', requestId, status: 'resolved', resolution: 'Done' }), /Start work/)
  assert.throws(() => change(state, owner, { type: 'set-request-status', requestId, status: 'open' }), /Only a resolved/)
})

test('creation rejects invalid identities, categories, empty or excessive content and remains account free', () => {
  const initial = desk.createHrServiceDesk(fixture)
  for (const actor of [owner, manager, { role: 'employee' }, { role: 'employee', employeeId: 'foreign' }, { role: 'contractor' }]) assert.throws(() => change(initial, actor, createEvent), /valid employee/)
  for (const event of [{ ...createEvent, title: ' ' }, { ...createEvent, title: 'a'.repeat(101) }, { ...createEvent, details: '' }, { ...createEvent, details: 'a'.repeat(2001) }, { ...createEvent, title: 'abc\u0000' }, { ...createEvent, category: 'medical' }]) assert.throws(() => change(initial, employee, event))
  assert.deepEqual(initial, desk.createHrServiceDesk(fixture))
  const request = created().requests.at(-1)
  assert.equal(Object.keys(request.activity[0]).some(key => /date|path|token|secret/i.test(key)), false)
})
