import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const { inspectWorkspaces, compareWorkspaces } = await loadMockModel(new URL('../../src/portals/workspace-inspection.ts', import.meta.url))
const seed = JSON.parse(await readFile(new URL('../browser/fixtures/portal-smoke-v1.json', import.meta.url), 'utf8')).workspaces
const clone = value => structuredClone(value)
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const row = (report, key) => report.modules[0].collections.find(item => item.key === `workflow.payrollControl.${key}`)
const controlRows = report => report.modules[0].collections.filter(item => item.key.startsWith('workflow.payrollControl.'))
const privateAbsent = report => assert.doesNotMatch(JSON.stringify(report), /PRIVATE|fixture\.invalid|"reason"|"grossCents"|"netCents"|"proposed"|"previous"|"delta"|"snapshot"|fingerprint/)
const originalMoney = { grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 0, netCents: 19200 }

// Handwritten inspection facts are independent of domain reducers. Invalid
// mutations below exercise defensive previews, never saved-state acceptance.
function captured() {
  const states = clone(seed), workflow = states.hr.workflow
  for (const entry of workflow.timeEntries) { entry.status = 'approved'; entry.payrollReceipt = 'MOCK-PAYROLL-0001' }
  const submitted = {
    stage: 'submitted', period: { start: '2026-10-01', end: '2026-10-15' }, receipt: 'MOCK-PAYROLL-0001',
    inputs: [
      { entryId: 'time-001', employeeId: 'employee-002', date: '2026-10-09', hours: 8, rateCents: 3000, rateEffectiveFrom: '2026-10-01' },
      { entryId: 'time-002', employeeId: 'employee-003', date: '2026-10-09', hours: 6, rateCents: 3200, rateEffectiveFrom: '2026-10-01' },
    ], benefitInputs: [],
    employeeTotals: [{ employeeId: 'employee-002', hours: 8, ...originalMoney }, { employeeId: 'employee-003', hours: 6, grossCents: 19200, illustrativeWithholdingCents: 3840, benefitDeductionCents: 0, netCents: 15360 }],
    hours: 14, grossCents: 43200, illustrativeWithholdingCents: 8640, benefitDeductionCents: 0, netCents: 34560,
  }
  workflow.payroll = clone(submitted); workflow.payrollHistory = [clone(submitted)]
  workflow.payrollControl = {
    schemaVersion: 1, sequence: 4, anchors: [{ receipt: submitted.receipt, snapshot: clone(submitted) }],
    events: [
      { id: 'payroll-control-0001', sequence: 1, kind: 'period-closed', actor: { role: 'employer-owner' }, recordedOn: '2026-10-15', reason: 'PRIVATE closure reason', period: clone(submitted.period), receiptIds: [submitted.receipt] },
      { id: 'payroll-control-0002', sequence: 2, kind: 'receipt-adjusted', actor: { role: 'payroll-admin', employeeId: 'employee-001' }, recordedOn: '2026-10-16', reason: 'PRIVATE correction reason', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0002', originalReceipt: submitted.receipt, employeeId: 'employee-002', previousAdjustmentId: null, previous: clone(originalMoney), proposed: { grossCents: 25000, illustrativeWithholdingCents: 5000, benefitDeductionCents: 0, netCents: 20000 }, delta: { grossCents: 1000, illustrativeWithholdingCents: 200, benefitDeductionCents: 0, netCents: 800 } },
      { id: 'payroll-control-0003', sequence: 3, kind: 'receipt-adjusted', actor: { role: 'employer-owner' }, recordedOn: '2026-10-17', reason: 'PRIVATE later correction', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0003', originalReceipt: submitted.receipt, employeeId: 'employee-002', previousAdjustmentId: 'payroll-control-0002', previous: { grossCents: 25000, illustrativeWithholdingCents: 5000, benefitDeductionCents: 0, netCents: 20000 }, proposed: { grossCents: 24500, illustrativeWithholdingCents: 4900, benefitDeductionCents: 0, netCents: 19600 }, delta: { grossCents: -500, illustrativeWithholdingCents: -100, benefitDeductionCents: 0, netCents: -400 } },
    ],
  }
  return states
}

test('control absence preserves exact legacy inspection and comparison output hashes', () => {
  const before = JSON.stringify(seed)
  assert.equal(digest(inspectWorkspaces(seed, ['hr', 'cms', 'crm'])), 'a25f693114389cd54db404f1bdfb9de00eab4e70159d94c3de94185ccf6c21dd')
  assert.equal(digest(compareWorkspaces(seed, seed, ['hr', 'cms', 'crm'])), '1e73a0979d83028abcecc5df3c98290143c53bc346bced3205cf767ea404ecc8')
  assert.equal(JSON.stringify(seed), before)
  assert.equal(Object.hasOwn(seed.hr.workflow, 'payrollControl'), false)
})

test('three authoritative events and one metadata row do not count captured payrolls twice', () => {
  const states = captured(), before = JSON.stringify(states), report = inspectWorkspaces(states, ['hr'])
  assert.deepEqual(controlRows(report).map(item => [item.key, item.kind, item.count]), [
    ['workflow.payrollControl.events', 'primary', 3], ['workflow.payrollControl.metadata', 'metadata', 1],
  ])
  assert.equal(report.modules[0].primaryRecordCount, 39)
  assert.deepEqual(row(report, 'events').identifiers, ['payroll-control-0001', 'payroll-control-0002', 'payroll-control-0003'])
  assert.deepEqual(row(report, 'metadata').identifiers, ['extension'])
  assert.equal(report.modules[0].collections.find(item => item.key === 'workflow.payrollHistory').count, 1)
  assert.equal(JSON.stringify(states), before)
  privateAbsent(report)
})

test('optional union is directional with bounded safe event metadata and no monetary or reason details', () => {
  const target = captured(), current = clone(target); delete current.hr.workflow.payrollControl
  const forward = compareWorkspaces(current, target, ['hr']), reverse = compareWorkspaces(target, current, ['hr'])
  assert.deepEqual([forward.modules[0].added, forward.modules[0].removed, forward.modules[0].changed], [3, 0, 0])
  assert.deepEqual([reverse.modules[0].added, reverse.modules[0].removed, reverse.modules[0].changed], [0, 3, 0])
  assert.deepEqual(controlRows(forward).map(item => item.key), controlRows(reverse).map(item => item.key))
  assert.deepEqual(row(forward, 'events').recordDetails.added[0], { identifier: 'payroll-control-0001', before: null, after: { sequence: 1, eventKind: 'period-closed', recordedOn: '2026-10-15', actorRole: 'employer-owner', actorEmployeeId: null, periodStart: '2026-10-01', periodEnd: '2026-10-15', receiptCount: 1 } })
  assert.deepEqual(row(forward, 'events').recordDetails.added[1].after, { sequence: 2, eventKind: 'receipt-adjusted', recordedOn: '2026-10-16', actorRole: 'payroll-admin', actorEmployeeId: 'employee-001', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0002', originalReceipt: 'MOCK-PAYROLL-0001', employeeId: 'employee-002', previousAdjustmentId: null })
  assert.deepEqual(row(forward, 'metadata').recordDetails.added[0], { identifier: 'extension', before: null, after: { schemaVersion: 1, sequence: 4, anchorCount: 1 } })
  privateAbsent(forward); privateAbsent(reverse)
})

test('same-count hidden monetary, reason and anchor changes participate without exposing their values', () => {
  const current = captured(), target = clone(current), control = target.hr.workflow.payrollControl
  control.events[1].proposed.grossCents = 25123
  control.events[2].reason += ' changed'
  control.anchors[0].snapshot.inputs[0].hours = 7.75
  const before = JSON.stringify([current, target]), report = compareWorkspaces(current, target, ['hr'])
  assert.deepEqual([row(report, 'events').changed, row(report, 'metadata').changed], [2, 1])
  assert.deepEqual(row(report, 'events').identifiers.changed, ['payroll-control-0002', 'payroll-control-0003'])
  assert.equal(row(report, 'events').recordDetails.changed[0].before.employeeId, 'employee-002')
  assert.equal(row(report, 'events').recordDetails.changed[0].after.employeeId, 'employee-002')
  assert.equal(JSON.stringify([current, target]), before)
  privateAbsent(report)
})

test('stable event IDs ignore collection order and omission counts bound every output list', () => {
  const current = captured(), target = clone(current)
  target.hr.workflow.payrollControl.events.reverse()
  assert.equal(compareWorkspaces(current, target, ['hr']).modules[0].hasChanges, false)
  const legacy = clone(current); delete legacy.hr.workflow.payrollControl
  const inspection = inspectWorkspaces(current, ['hr'], { identifierLimit: 1 })
  assert.deepEqual([row(inspection, 'events').count, row(inspection, 'events').identifiers, row(inspection, 'events').omittedIdentifiers], [3, ['payroll-control-0001'], 2])
  const report = compareWorkspaces(legacy, current, ['hr'], { identifierLimit: 1 })
  assert.deepEqual([row(report, 'events').added, row(report, 'events').recordDetails.added.length, row(report, 'events').omittedIdentifiers.added], [3, 1, 2])
  privateAbsent(report)
})

test('malformed, duplicate and over-limit control collections fail closed without invoking accessors', () => {
  const mutations = [
    state => { state.hr.workflow.payrollControl = null }, state => { state.hr.workflow.payrollControl = undefined },
    state => { state.hr.workflow.payrollControl.schemaVersion = 2 }, state => { delete state.hr.workflow.payrollControl.events },
    state => { state.hr.workflow.payrollControl.extra = 'PRIVATE' }, state => { state.hr.workflow.payrollControl.sequence = '4' },
    state => { state.hr.workflow.payrollControl.events = [] }, state => { state.hr.workflow.payrollControl.anchors = [] },
    state => { state.hr.workflow.payrollControl.events[1].id = 'payroll-control-0001' },
    state => { state.hr.workflow.payrollControl.anchors.push(clone(state.hr.workflow.payrollControl.anchors[0])) },
    state => { state.hr.workflow.payrollControl.events[0].receiptIds.push('MOCK-PAYROLL-0001') },
    state => { state.hr.workflow.payrollControl.events[0].actor.role = 'hr-admin' },
    state => { state.hr.workflow.payrollControl.events[1].employeeId = 'private@fixture.invalid' },
    state => { state.hr.workflow.payrollControl.events[1].recordedOn = '2026-02-30' },
    state => { state.hr.workflow.payrollControl.events[1].kind = 'PRIVATE unsupported kind' },
    state => { const control = state.hr.workflow.payrollControl; control.events = Array.from({ length: 251 }, () => clone(control.events[0])); control.sequence = 252 },
    state => { const control = state.hr.workflow.payrollControl; control.anchors = Array.from({ length: 101 }, (_, index) => ({ receipt: `MOCK-PAYROLL-${index + 1}`, snapshot: clone(control.anchors[0].snapshot) })) },
  ]
  for (const mutate of mutations) {
    const state = captured(); mutate(state)
    assert.throws(() => inspectWorkspaces(state, ['hr']), error => { privateAbsent(error.message); return /Workspace inspection unavailable/.test(error.message) })
  }
  let reads = 0; const state = captured()
  Object.defineProperty(state.hr.workflow.payrollControl.events[0], 'reason', { enumerable: true, get() { reads++; throw new Error('PRIVATE') } })
  assert.throws(() => inspectWorkspaces(state, ['hr']), /accessor or hidden property/)
  assert.equal(reads, 0)
  assert.deepEqual(inspectWorkspaces(state, ['cms']), inspectWorkspaces(seed, ['cms']), 'unselected HR is never inspected')
})
