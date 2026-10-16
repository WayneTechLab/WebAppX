import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const workflow = await loadMockModel(new URL('../../src/hr/mock-workflows.ts', import.meta.url))
const persistence = await loadMockModel(new URL('../../src/hr/persistence.ts', import.meta.url))
const recruiting = await loadMockModel(new URL('../../src/hr/recruiting-lifecycle.ts', import.meta.url))
const { recruitingCoreServices } = await loadMockModel(new URL('../../src/hr/recruiting-services.ts', import.meta.url))
const employment = await loadMockModel(new URL('../../src/hr/lifecycle.ts', import.meta.url))
const individual = await loadMockModel(new URL('../../src/portals/backup.ts', import.meta.url))
const combined = await loadMockModel(new URL('../../src/portals/combined-backup.ts', import.meta.url))
const storage = await loadMockModel(new URL('../../src/portals/persistence.ts', import.meta.url))
const imports = await loadMockModel(new URL('../../src/portals/import-state.ts', import.meta.url))
const restores = await loadMockModel(new URL('../../src/portals/restore-workspaces.ts', import.meta.url))
const points = await loadMockModel(new URL('../../src/portals/restore-points.ts', import.meta.url))
const base = JSON.parse(await readFile(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const seed = JSON.parse(await readFile(new URL('../browser/fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces
const owner = { role: 'employer-owner' }, manager = { role: 'manager', employeeId: 'employee-001' }, self = { role: 'employee', employeeId: 'employee-002' }
const period = { start: '2026-10-01', end: '2026-10-15' }, instant = '2026-10-15T12:00:00.000Z'
const clone = value => structuredClone(value)
const bytes = value => JSON.stringify(value)
const valid = state => persistence.isHrDemoState(state, base)
const change = (state, event, actor = owner) => workflow.transitionMockHr(state, actor, event, base)
function memory(initial = []) {
  const slots = new Map(initial), writes = []
  return { slots, writes, getItem: key => slots.get(key) ?? null, setItem(key, value) { writes.push([key, value]); slots.set(key, value) }, removeItem(key) { writes.push([key, null]); slots.delete(key) } }
}
function submitted({ withEmployment = false, withRecruiting = false } = {}) {
  let state = persistence.createHrDemoState(base)
  if (withEmployment) {
    const command = { type: 'set-simulation-date', simulationDate: '2026-10-15' }
    const preview = employment.previewHrLifecycle(state, owner, command, base)
    state = employment.confirmHrLifecycle(state, owner, command, preview.confirmation, base)
  }
  if (withRecruiting) state = recruiting.buildRecruitingCandidate(state, { mode: 'native', actor: owner }, { kind: 'adopt', recordedAt: instant }, base, recruitingCoreServices).next
  state.workflow = change(state.workflow, { type: 'delete-time', entryId: 'time-002', confirmed: true }, { role: 'employee', employeeId: 'employee-003' })
  state.workflow = change(state.workflow, { type: 'approve-time', entryId: 'time-001' }, manager)
  state.workflow = change(state.workflow, { type: 'set-sample-rate', employeeId: 'employee-002', hourlyRateCents: 3004, effectiveFrom: '2026-10-01' })
  state.workflow = change(state.workflow, { type: 'prepare-payroll', period })
  for (const type of ['calculate-payroll', 'review-payroll', 'submit-payroll']) state.workflow = change(state.workflow, { type })
  assert.equal(state.workflow.payroll.receipt, 'MOCK-PAYROLL-0001')
  assert.deepEqual(state.workflow.payroll.employeeTotals, [{ employeeId: 'employee-002', hours: 8, grossCents: 24032, illustrativeWithholdingCents: 4806, benefitDeductionCents: 0, netCents: 19226 }])
  return state
}
function closed(options) {
  const state = submitted(options)
  state.workflow.payrollControl = {
    schemaVersion: 1, sequence: 2,
    anchors: [{ receipt: 'MOCK-PAYROLL-0001', snapshot: clone(state.workflow.payrollHistory[0]) }],
    events: [{ id: 'payroll-control-0001', sequence: 1, kind: 'period-closed', actor: owner, recordedOn: '2026-10-15', reason: 'Fictional period reconciled.', period: clone(period), receiptIds: ['MOCK-PAYROLL-0001'] }],
  }
  return state
}
function corrected() {
  const state = submitted()
  state.workflow.payrollControl = {
    schemaVersion: 1, sequence: 2,
    anchors: [{ receipt: 'MOCK-PAYROLL-0001', snapshot: clone(state.workflow.payrollHistory[0]) }],
    events: [{ id: 'payroll-control-0001', sequence: 1, kind: 'receipt-adjusted', actor: owner, recordedOn: '2026-10-16', reason: 'Fictional monetary correction only.', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0001', originalReceipt: 'MOCK-PAYROLL-0001', employeeId: 'employee-002', previousAdjustmentId: null,
      previous: { grossCents: 24032, illustrativeWithholdingCents: 4806, benefitDeductionCents: 0, netCents: 19226 },
      proposed: { grossCents: 25000, illustrativeWithholdingCents: 5000, benefitDeductionCents: 0, netCents: 20000 },
      delta: { grossCents: 968, illustrativeWithholdingCents: 194, benefitDeductionCents: 0, netCents: 774 },
    }],
  }
  return state
}
function unchangedRefusal(state, event, actor = owner, expression = /closed/i) {
  const before = bytes(state)
  assert.throws(() => change(state, event, actor), expression)
  assert.equal(bytes(state), before, 'refusal preserves all records, control events and counters')
}

test('legacy seed and unsupported legacy receipt values remain readable without materializing payroll controls', () => {
  const before = bytes(seed.hr)
  assert.equal(valid(seed.hr), true)
  assert.deepEqual(persistence.createHrDemoState(base), seed.hr)
  assert.equal(Object.hasOwn(seed.hr.workflow, 'payrollControl'), false)
  assert.equal(bytes(seed.hr), before)
  const state = submitted(), receipt = state.workflow.payroll.receipt
  for (const label of ['LEGACY-PAYROLL-1', 'MOCK-PAYROLL-00001']) {
    const legacy = clone(state)
    legacy.workflow.payroll.receipt = label; legacy.workflow.payrollHistory[0].receipt = label
    legacy.workflow.timeEntries.find(entry => entry.payrollReceipt === receipt).payrollReceipt = label
    const raw = bytes(legacy)
    assert.equal(valid(legacy), true)
    assert.deepEqual(individual.parseDemoBackup(individual.createDemoBackup('hr', legacy, valid, instant), 'hr', valid).state, legacy)
    assert.equal(bytes(legacy), raw)
    legacy.workflow.payrollControl = clone(closed().workflow.payrollControl)
    legacy.workflow.payrollControl.anchors[0] = { receipt: label, snapshot: clone(legacy.workflow.payrollHistory[0]) }
    legacy.workflow.payrollControl.events[0].receiptIds = [label]
    assert.equal(valid(legacy), false, 'unsupported legacy receipt is not silently made canonical for control activation')
  }
})

test('all eight recruiting, employment and control presence combinations retain exact complete codec records', () => {
  for (const withRecruiting of [false, true]) for (const withEmployment of [false, true]) for (const withControl of [false, true]) {
    const state = withControl ? closed({ withRecruiting, withEmployment }) : submitted({ withRecruiting, withEmployment })
    const before = bytes(state), bundle = { ...clone(seed), hr: state }
    assert.equal(valid(state), true, `recruiting=${withRecruiting}, employment=${withEmployment}, controls=${withControl}`)
    assert.equal(Object.hasOwn(state.workflow, 'payrollControl'), withControl)
    assert.equal(Object.hasOwn(state.workflow, 'lifecycle'), withEmployment)
    assert.equal(Object.hasOwn(state.recruiting, 'lifecycle'), withRecruiting)
    assert.deepEqual(individual.parseDemoBackup(individual.createDemoBackup('hr', state, valid, instant), 'hr', valid).state, state)
    assert.deepEqual(combined.parseCombinedBackup(combined.createCombinedBackup(bundle, instant)).states, bundle)
    const local = memory()
    assert.equal(storage.saveDemoState('hr', state, local).kind, 'saved')
    const loaded = storage.loadDemoState('hr', () => persistence.createHrDemoState(base), valid, local)
    assert.equal(loaded.status.kind, 'restored'); assert.deepEqual(loaded.state, state)
    const result = imports.replaceDemoState('hr', clone(state), valid, local)
    assert.equal(result.ok, true); assert.deepEqual(result.state, state)
    const point = points.createRestorePoint(bundle, ['hr'], 'restore', undefined, { id: 'payroll-control-compatibility', createdAt: instant })
    assert.deepEqual(points.parseRestorePoints(bytes({ schemaVersion: 1, points: [point] }))[0].states.hr, state)
    assert.equal(restores.restoreDemoWorkspaces(bundle, ['hr'], local).ok, true)
    assert.equal(bytes(state), before)
  }
})

test('control-present saves preserve native extra JSON metadata and complete anchored snapshot extras without relaxing exact new structures', () => {
  const state = closed()
  state.nativeExtra = { note: 'Legacy supported JSON metadata' }
  state.workflow.timeEntries[0].legacyExtra = { note: 'Unrelated plain JSON metadata' }
  state.workflow.payroll.legacyExtra = { note: 'Captured historical metadata' }
  state.workflow.payrollHistory[0].legacyExtra = { note: 'Captured historical metadata' }
  state.workflow.payrollControl.anchors[0].snapshot.legacyExtra = { note: 'Captured historical metadata' }
  const before = bytes(state)
  assert.equal(valid(state), true)
  assert.deepEqual(individual.parseDemoBackup(individual.createDemoBackup('hr', state, valid, instant), 'hr', valid).state, state)
  assert.equal(bytes(state), before)
  for (const mutate of [
    value => { value.workflow.payrollControl.extra = true },
    value => { value.workflow.payrollControl.anchors[0].extra = true },
    value => { value.workflow.payrollControl.events[0].extra = true },
    value => { value.workflow.payrollControl.events[0].actor.extra = true },
    value => { value.workflow.payrollControl.anchors[0].snapshot.legacyExtra.note = 'Changed anchored metadata' },
  ]) { const malformed = clone(state); mutate(malformed); const raw = bytes(malformed); assert.equal(valid(malformed), false); assert.equal(bytes(malformed), raw) }
})

test('correction-only controls validate exact signed money without silently closing their original period', () => {
  const state = corrected(), before = bytes(state)
  assert.equal(valid(state), true)
  assert.deepEqual(individual.parseDemoBackup(individual.createDemoBackup('hr', state, valid, instant), 'hr', valid).state, state)
  const later = change(state.workflow, { type: 'add-time', date: '2026-10-10', hours: 1, source: 'manual' }, self)
  assert.equal(later.timeEntries.at(-1).id, 'MOCK-TIME-0002')
  assert.equal(later.timeEntries.at(-1).date, '2026-10-10')
  assert.deepEqual(later.payrollControl, state.workflow.payrollControl)
  assert.deepEqual(later.payrollHistory, state.workflow.payrollHistory)
  assert.equal(bytes(state), before)
  for (const mutate of [
    value => { value.workflow.payrollControl.events[0].previous.netCents++ },
    value => { value.workflow.payrollControl.events[0].delta.grossCents = '968' },
    value => { value.workflow.payrollControl.events[0].delta.netCents++ },
    value => { value.workflow.payrollControl.events[0].proposed.extra = true },
    value => { value.workflow.payrollControl.events[0].proposed.benefitDeductionCents = -0 },
  ]) { const malformed = clone(state); mutate(malformed); assert.equal(valid(malformed), false) }
})

test('descriptor-first optional presence refuses getters and non-JSON envelopes with recruiting absent, without reading or repairing them', () => {
  for (const extension of [undefined, null, false, {}, [], { schemaVersion: 2 }]) {
    const state = submitted(); state.workflow.payrollControl = extension
    assert.equal(valid(state), false)
  }
  let reads = 0
  const getterCases = [
    state => Object.defineProperty(state, 'workflow', { enumerable: true, get() { reads++; throw new Error('must not read root workflow') } }),
    state => Object.defineProperty(state.workflow, 'payrollControl', { enumerable: true, get() { reads++; throw new Error('must not read optional control') } }),
    state => Object.defineProperty(state.operations, 'balances', { enumerable: true, get() { reads++; throw new Error('must not read unrelated nested getter') } }),
    state => Object.defineProperty(state.workflow.payrollControl.events[0], 'reason', { enumerable: true, get() { reads++; throw new Error('must not read event getter') } }),
  ]
  for (const mutate of getterCases) { const state = closed(); mutate(state); assert.equal(valid(state), false); assert.equal(reads, 0) }
  for (const mutate of [
    state => { state[Symbol('hidden')] = true },
    state => Object.defineProperty(state.operations, 'hidden', { value: true }),
    state => { state.toJSON = () => { reads++; return {} } },
    state => { Object.setPrototypeOf(state.operations, { inherited: true }) },
    state => { state.operations.unsupported = undefined },
    state => { state.operations.unsupported = Infinity },
    state => { state.operations.unsupported = -0 },
    state => { state.operations.unsupported = new Array(1) },
    state => { state.operations.unsupported = state },
    state => { state.operations.unsupported = 'x'.repeat(2_000_000) },
  ]) { const state = closed(); mutate(state); assert.equal(valid(state), false); assert.equal(reads, 0) }
  const hostileArray = closed(), prototype = Object.create(Array.prototype)
  Object.defineProperty(prototype, 'every', { get() { reads++; throw new Error('must reject the inherited array accessor first') } })
  Object.setPrototypeOf(hostileArray.workflow.timeEntries, prototype)
  assert.equal(valid(hostileArray), false); assert.equal(reads, 0)
  const inherited = submitted(); Object.setPrototypeOf(inherited.workflow, { payrollControl: clone(closed().workflow.payrollControl) })
  assert.equal(valid(inherited), false)
})

test('malformed control import and selective restore refuse before any saved or current workspace replacement', () => {
  const current = { ...clone(seed), hr: closed({ withEmployment: true, withRecruiting: true }) }
  const local = memory([['unrelated', 'exact unrelated bytes']])
  for (const module of ['hr', 'cms', 'crm']) assert.equal(storage.saveDemoState(module, current[module], local).kind, 'saved')
  const currentBytes = bytes(current), savedBytes = [...local.slots]
  for (const mutate of [
    state => { state.workflow.payrollControl.sequence++ },
    state => { state.workflow.payrollControl.anchors[0].snapshot.netCents++ },
    state => { state.workflow.payrollControl.events[0].receiptIds = [] },
    state => { state.workflow.payrollControl.events[0].actor.role = 'hr-admin' },
    state => { state.workflow.timeEntries[0].hours = 7 },
  ]) {
    const target = clone(current); mutate(target.hr)
    const raw = bytes(target), writesBefore = local.writes.length
    const imported = imports.replaceDemoState('hr', target.hr, valid, local)
    if (imported.ok) current.hr = imported.state
    assert.equal(imported.ok, false)
    assert.equal(restores.restoreDemoWorkspaces(target, ['hr'], local).ok, false)
    assert.throws(() => individual.parseDemoBackup(bytes({ format: 'webappx-mock-workspace', schemaVersion: 1, module: 'hr', exportedAt: instant, data: target.hr }), 'hr', valid), /incomplete|incompatible/)
    assert.throws(() => combined.parseCombinedBackup(bytes({ format: 'webappx-mock-workspaces', schemaVersion: 1, exportedAt: instant, workspaces: target })), /incomplete|incompatible/)
    assert.equal(local.writes.length, writesBefore)
    assert.deepEqual([...local.slots], savedBytes)
    assert.equal(bytes(current), currentBytes)
    assert.equal(bytes(target), raw)
  }
})

test('manual add and timer stop cannot create a closed-date entry or consume a native sequence', () => {
  const state = closed().workflow
  for (const date of ['2026-10-01', '2026-10-09', '2026-10-15']) unchangedRefusal(state, { type: 'add-time', date, hours: 1, source: 'manual' }, self)
  const timer = workflow.startMockTimer(self, '2026-10-09', 1000, base), before = bytes(timer)
  const event = workflow.stopMockTimer(timer, self, 3601000, base)
  assert.deepEqual(event, { type: 'add-time', date: '2026-10-09', hours: 1, source: 'timer' })
  unchangedRefusal(state, event, self)
  assert.equal(bytes(timer), before, 'refused add leaves the running timer facts available for the UI to retain')
  assert.equal(state.sequence, 2)
  assert.deepEqual(state.timeEntries.map(entry => entry.id), ['time-001'])
})

test('moving a legitimate open draft into closure refuses while ordinary open-date time actions preserve all frozen facts', () => {
  const original = closed().workflow, frozen = bytes({ history: original.payrollHistory, paid: original.timeEntries[0], controls: original.payrollControl, rates: original.sampleRates })
  let state = change(original, { type: 'add-time', date: '2026-10-16', hours: 1, source: 'manual' }, self)
  unchangedRefusal(state, { type: 'edit-time', entryId: 'MOCK-TIME-0002', date: '2026-10-15', hours: 1 }, self)
  state = change(state, { type: 'edit-time', entryId: 'MOCK-TIME-0002', date: '2026-10-17', hours: 1.25 }, self)
  const draft = clone(state)
  state = change(state, { type: 'submit-time', entryIds: ['MOCK-TIME-0002'] }, self)
  const returned = change(state, { type: 'return-time', entryId: 'MOCK-TIME-0002', reason: 'Fictional open-date correction' }, manager)
  assert.equal(returned.timeEntries[1].status, 'draft')
  state = change(state, { type: 'approve-time', entryId: 'MOCK-TIME-0002' }, manager)
  assert.equal(state.timeEntries[1].status, 'approved')
  const deleted = change(draft, { type: 'delete-time', entryId: 'MOCK-TIME-0002', confirmed: true }, self)
  assert.equal(deleted.timeEntries.length, 1)
  for (const candidate of [state, returned, deleted]) assert.equal(bytes({ history: candidate.payrollHistory, paid: candidate.timeEntries[0], controls: candidate.payrollControl, rates: candidate.sampleRates }), frozen)
})

test('defensive native time guards refuse every action on a closed-date unpaid row even before any codec acceptance', () => {
  // No legitimate close can contain this unpaid row. These direct model probes
  // prove a caller cannot bypass the guards; the strict codec also rejects it.
  for (const [status, event, actor] of [
    ['draft', { type: 'submit-time', entryIds: ['unsafe-unpaid'] }, self],
    ['submitted', { type: 'approve-time', entryId: 'unsafe-unpaid' }, manager],
    ['submitted', { type: 'return-time', entryId: 'unsafe-unpaid', reason: 'Fictional correction' }, manager],
    ['draft', { type: 'edit-time', entryId: 'unsafe-unpaid', date: '2026-10-16', hours: 1 }, self],
    ['draft', { type: 'delete-time', entryId: 'unsafe-unpaid', confirmed: true }, self],
  ]) {
    const state = closed()
    state.workflow.timeEntries.push({ id: 'unsafe-unpaid', employeeId: 'employee-002', date: '2026-10-14', hours: 1, status, source: 'manual' })
    assert.equal(valid(state), false)
    unchangedRefusal(state.workflow, event, actor)
  }
})

test('whole overlapping preparations refuse before silently selecting only open rows, while a nonoverlapping period can prepare normally', () => {
  const complete = closed()
  let state = complete.workflow
  state = change(state, { type: 'add-time', date: '2026-10-16', hours: 1, source: 'manual' }, self)
  state = change(state, { type: 'submit-time', entryIds: ['MOCK-TIME-0002'] }, self)
  state = change(state, { type: 'approve-time', entryId: 'MOCK-TIME-0002' }, manager)
  for (const candidate of [period, { start: '2026-09-25', end: '2026-10-01' }, { start: '2026-10-15', end: '2026-10-31' }, { start: '2026-09-01', end: '2026-11-30' }]) unchangedRefusal(state, { type: 'prepare-payroll', period: candidate })
  const prepared = change(state, { type: 'prepare-payroll', period: { start: '2026-10-16', end: '2026-10-31' } })
  assert.deepEqual(prepared.payroll.inputs, [{ entryId: 'MOCK-TIME-0002', employeeId: 'employee-002', date: '2026-10-16', hours: 1, rateCents: 3004, rateEffectiveFrom: '2026-10-01' }])
  assert.equal(workflow.payrollFreshness(prepared, base).stale, false)
  assert.deepEqual(prepared.payrollControl, state.payrollControl)
  assert.deepEqual(prepared.payrollHistory, state.payrollHistory)
  let completed = prepared
  for (const type of ['calculate-payroll', 'review-payroll', 'submit-payroll']) completed = change(completed, { type })
  assert.equal(completed.payroll.receipt, 'MOCK-PAYROLL-0003')
  assert.equal(completed.payroll.grossCents, 3004)
  assert.equal(valid({ ...complete, workflow: completed }), true)
  assert.deepEqual(completed.payrollHistory[0], state.payrollHistory[0])
  assert.deepEqual(completed.payrollControl, state.payrollControl)
})

test('saved overlapping pending payroll remains byte-exact import-valid but explicitly stale and blocked at every continuation stage', () => {
  const submittedState = closed()
  assert.deepEqual(workflow.payrollFreshness(submittedState.workflow, base), { stale: false, reason: '' }, 'a frozen submitted receipt is not a pending preparation')
  for (const [stage, type] of [['prepared', 'calculate-payroll'], ['calculated', 'review-payroll'], ['reviewed', 'submit-payroll']]) {
    const state = clone(submittedState)
    state.workflow.payroll.stage = stage; delete state.workflow.payroll.receipt
    const before = bytes(state)
    assert.equal(valid(state), true, `${stage} remains a supported saved pending pointer`)
    const freshness = workflow.payrollFreshness(state.workflow, base)
    assert.equal(freshness.stale, true); assert.match(freshness.reason, /closed/i)
    unchangedRefusal(state.workflow, { type })
    assert.deepEqual(individual.parseDemoBackup(individual.createDemoBackup('hr', state, valid, instant), 'hr', valid).state, state)
    assert.equal(bytes(state), before)
  }
})
