import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import * as expected from './payroll-control-expected.mjs'
import { assertHistoryAppend, assertPayrollWitnessBounds, malformedPayrollImports } from './payroll-control.mjs'
import { payrollStatusInventory, payrollStatusFamilies } from './payroll-control-status-inventory.mjs'

const bytes = readFileSync(new URL('./fixtures/portal-smoke-v1.json', import.meta.url))
const seed = JSON.parse(bytes).workspaces
const hash = value => createHash('sha256').update(value).digest('hex')

test('native A expectation uses the exact eight-hour literal and preserves every unrelated full workspace', () => {
  assert.equal(hash(bytes), 'ab8633ff7bbb705d2ca164fb950740f8573afb50a536b8348ef7c0f07d032d02')
  const actual = expected.fixtureA(seed)
  assert.deepEqual(actual.cms, seed.cms); assert.deepEqual(actual.crm, seed.crm)
  assert.deepEqual(actual.hr.workflow.payroll.employeeTotals, [{ employeeId: 'employee-002', hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 2500, netCents: 16700 }])
  assert.deepEqual(actual.hr.workflow.timeEntries, [{ id: 'time-001', employeeId: 'employee-002', date: '2026-10-09', hours: 8, status: 'approved', source: 'fixture', payrollReceipt: 'MOCK-PAYROLL-0002' }])
  assert.equal(actual.hr.workflow.sequence, 3)
  for (const key of ['lifecycle', 'payrollControl']) assert.equal(Object.hasOwn(actual.hr.workflow, key), false)
  assert.equal(Object.hasOwn(actual.hr.recruiting, 'lifecycle'), false)
  assert.equal(Object.hasOwn(actual.hr, 'selectedManager'), false)
  for (const key of ['operations', 'serviceDesk', 'recruiting', 'performance', 'surveys', 'completed', 'acknowledgements']) assert.deepEqual(actual.hr[key], seed.hr[key])
  assert.notEqual(actual.hr.workflow.payroll, actual.hr.workflow.payrollHistory[0])
})

test('literal cumulative chain keeps ordinary originals detached and uses the shared event suffix with exact downward/manual deltas', () => {
  const actual = expected.correctedA(expected.fixtureA(seed)), control = actual.hr.workflow.payrollControl
  assert.equal(control.sequence, 6); assert.equal(control.events.length, 5); assert.equal(control.anchors.length, 1)
  assert.deepEqual(control.events.map(event => event.id), ['payroll-control-0001', 'payroll-control-0002', 'payroll-control-0003', 'payroll-control-0004', 'payroll-control-0005'])
  assert.deepEqual(control.events.slice(1).map(event => event.adjustmentReceipt), ['MOCK-PAYROLL-ADJUSTMENT-0002', 'MOCK-PAYROLL-ADJUSTMENT-0003', 'MOCK-PAYROLL-ADJUSTMENT-0004', 'MOCK-PAYROLL-ADJUSTMENT-0005'])
  assert.deepEqual(control.events.slice(1).map(event => event.previousAdjustmentId), [null, 'payroll-control-0002', 'payroll-control-0003', 'payroll-control-0004'])
  assert.deepEqual(control.events[2].delta, { grossCents: -1500, illustrativeWithholdingCents: -300, benefitDeductionCents: 0, netCents: -1200 })
  assert.deepEqual(control.events[3].delta, { grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: -500, netCents: 500 })
  assert.deepEqual(control.events[4].proposed, { grossCents: 26000, illustrativeWithholdingCents: 4000, benefitDeductionCents: 2000, netCents: 20000 })
  assert.notEqual(control.events[4].proposed.illustrativeWithholdingCents, control.events[4].proposed.grossCents / 5)
  assert.deepEqual(actual.hr.workflow.payrollHistory, [expected.originalA]); assert.equal(actual.hr.workflow.sequence, 3)
  assert.deepEqual(control.anchors[0].snapshot, expected.originalA)
  assert.notEqual(control.anchors[0].snapshot, actual.hr.workflow.payrollHistory[0])
})

test('native fractional fixture explicitly expects one sum rounding to 751 cents and manual correction 900 net', () => {
  const actual = expected.correctedF(expected.fixtureF(seed)), original = actual.hr.workflow.payrollHistory[0]
  assert.deepEqual(original.inputs.map(input => [input.hours, input.rateCents]), [[0.125, 3004], [0.125, 3004]])
  assert.equal(original.hours, 0.25); assert.equal(original.grossCents, 751); assert.equal(original.illustrativeWithholdingCents, 150); assert.equal(original.netCents, 601)
  assert.deepEqual(actual.hr.workflow.payrollControl.events[1].delta, { grossCents: 249, illustrativeWithholdingCents: -50, benefitDeductionCents: 0, netCents: 299 })
  assert.deepEqual(actual.hr.workflow.benefitElections, []); assert.equal(actual.hr.workflow.sequence, 3)
})

test('nonempty two-employee M has independent first corrections and one exact shared original anchor', () => {
  const actual = expected.correctedM(expected.fixtureM(seed)), control = actual.hr.workflow.payrollControl
  assert.equal(actual.hr.workflow.payroll.receipt, 'MOCK-PAYROLL-0003')
  assert.equal(actual.hr.workflow.payroll.hours, 14); assert.equal(actual.hr.workflow.payroll.netCents, 35900)
  assert.equal(control.sequence, 3); assert.equal(control.anchors.length, 1)
  assert.deepEqual(control.events.map(event => [event.employeeId, event.previousAdjustmentId, event.proposed.netCents]), [['employee-002', null, 20000], ['employee-003', null, 23000]])
  assert.deepEqual(control.events[1].delta, { grossCents: 2000, illustrativeWithholdingCents: -1800, benefitDeductionCents: 0, netCents: 3800 })
  assert.equal(actual.hr.workflow.onboarding['employee-003'].receipt, 'MOCK-ONBOARDING-0001')
  assert.equal(actual.hr.workflow.sequence, 4); assert.equal(Object.hasOwn(actual.hr.workflow, 'lifecycle'), false)
})

test('declared periodless and unknown-date imports preserve omissions instead of creating native historical facts', () => {
  for (const unknownWorkDate of [false, true]) {
    const actual = expected.periodlessA(seed, { unknownWorkDate })
    for (const original of [actual.hr.workflow.payroll, actual.hr.workflow.payrollHistory[0]]) {
      assert.equal(Object.hasOwn(original, 'period'), false)
      assert.equal(Object.hasOwn(original.inputs[0], 'date'), false); assert.equal(Object.hasOwn(original.inputs[0], 'rateEffectiveFrom'), false)
    }
    assert.equal(actual.hr.workflow.timeEntries[0].date, unknownWorkDate ? 'legacy-work-date-unknown' : '2026-10-09')
    assert.equal(Object.hasOwn(actual.hr.workflow, 'payrollControl'), false)
  }
  const corrected = expected.correctedOpenA(expected.periodlessA(seed), '2026-09-30')
  assert.equal(corrected.hr.workflow.payrollControl.events[0].recordedOn, '2026-09-30')
  assert.equal(Object.hasOwn(corrected.hr.workflow.payrollControl.anchors[0].snapshot, 'period'), false)
})

test('wider pending and multiple exact-window expectations retain original A without inventing submitted stages', () => {
  const pending = expected.closedA(expected.pendingWider(expected.fixtureA(seed)))
  assert.equal(pending.hr.workflow.payroll.stage, 'prepared'); assert.equal(pending.hr.workflow.payroll.hours, 1)
  assert.deepEqual(pending.hr.workflow.payroll.period, { start: '2026-10-01', end: '2026-10-16' })
  assert.deepEqual(pending.hr.workflow.payrollHistory, [expected.originalA]); assert.equal(pending.hr.workflow.sequence, 4)
  const two = expected.closedTwoExact(expected.secondReceipt(expected.fixtureA(seed), { samePeriod: true }))
  assert.deepEqual(two.hr.workflow.payrollControl.events[0].receiptIds, ['MOCK-PAYROLL-0002', 'MOCK-PAYROLL-0004'])
  assert.equal(two.hr.workflow.payrollHistory[1].netCents, 2300)
  assert.deepEqual(two.hr.workflow.payrollControl.anchors.map(anchor => anchor.snapshot), two.hr.workflow.payrollHistory)
})

test('all expected helpers preserve the immutable named fixture bytes and contain no product oracle imports', () => {
  assert.equal(hash(readFileSync(new URL('./fixtures/portal-smoke-v1.json', import.meta.url))), 'ab8633ff7bbb705d2ca164fb950740f8573afb50a536b8348ef7c0f07d032d02')
  const source = readFileSync(new URL('./payroll-control-expected.mjs', import.meta.url), 'utf8')
  assert.equal(/from ['"][^'"]*src\//.test(source), false)
  assert.equal(/transitionMockHr|qualifyPayroll|createPayrollControl|projectPayroll|loadMockModel/.test(source), false)
})

test('browser composition retains the original eight-check regression bytes and binds the actual runner', () => {
  assert.equal(hash(readFileSync(new URL('./payroll-lifecycle.mjs', import.meta.url))), '2ff6f6e0aa4bf2bd9bc6fea2aa14a23827b40a38727138378c6ab6072e2f2ca9')
  const runner = readFileSync(new URL('../../scripts/browser-payroll.mjs', import.meta.url), 'utf8')
  assert.match(runner, /runChecks: runPayrollSuite/)
  const harness = readFileSync(new URL('./payroll-control.mjs', import.meta.url), 'utf8')
  assert.match(harness, /runPayrollLifecycle\(\{ browser, origin, artifactDir: legacyDirectory, seed \}\)/)
  assert.equal(/from ['"][^'"]*src\//.test(harness), false)
  assert.equal(Object.values(payrollStatusInventory).flatMap(Object.keys).length, 35)
  assert.deepEqual(Object.keys(payrollStatusFamilies), ['closure', 'correction', 'ordinary', 'scoped', 'recovery'])
})

test('malformed-import witnesses actually target fifteen distinct invariant breaks, including the otherwise valid forgotten exact-window receipt', () => {
  const cases = new Map(malformedPayrollImports(seed))
  assert.equal(cases.size, 15)
  assert.equal(cases.get('null-present-extension').workflow.payrollControl, null)
  assert.equal(cases.get('forged-signed-delta').workflow.payrollControl.events[1].delta.grossCents, 3001)
  assert.equal(cases.get('forged-predecessor').workflow.payrollControl.events[2].previousAdjustmentId, null)
  const forgotten = cases.get('unanchored-same-window-original').workflow
  assert.deepEqual(forgotten.payrollHistory.map(row => row.receipt), ['MOCK-PAYROLL-0002', 'MOCK-PAYROLL-0004'])
  assert.deepEqual(forgotten.payrollControl.events[0].receiptIds, ['MOCK-PAYROLL-0002'])
  assert.equal(forgotten.timeEntries[1].payrollReceipt, 'MOCK-PAYROLL-0004')
  assert.equal(forgotten.payrollHistory[1].netCents, 2300)
  assert.equal(cases.get('event-bound-breach').workflow.payrollControl.events.length, 251)
  assert.equal(Object.hasOwn(cases.get('partial-frozen-date-pair').workflow.payroll.inputs[0], 'date'), true)
  assert.equal(Object.hasOwn(cases.get('partial-frozen-date-pair').workflow.payroll.inputs[0], 'rateEffectiveFrom'), false)
})

test('restore/Undo proof refuses changed old history, incorrect complete pre-state and incorrect source-point linkage', () => {
  const original = { id: 'seed-point', createdAt: '2026-10-15T12:00:00.000Z', kind: 'restore', modules: ['hr', 'cms', 'crm'], states: structuredClone(seed) }
  const restore = { id: 'restore-point', createdAt: '2026-10-16T12:00:00.000Z', kind: 'restore', modules: ['hr'], states: { hr: expected.correctedA(expected.fixtureA(seed)).hr } }
  const before = JSON.stringify({ schemaVersion: 1, points: [original] })
  const after = JSON.stringify({ schemaVersion: 1, points: [restore, original] })
  assert.equal(assertHistoryAppend(before, after, { kind: 'restore', hr: restore.states.hr }).id, 'restore-point')
  const changed = JSON.parse(after); changed.points[1].states.cms.sequence = 999
  assert.throws(() => assertHistoryAppend(before, JSON.stringify(changed), { kind: 'restore', hr: restore.states.hr }), /prior full history/)
  assert.throws(() => assertHistoryAppend(before, after, { kind: 'restore', hr: seed.hr }), /complete independently expected/)
  const undo = { id: 'undo-point', createdAt: '2026-10-16T12:01:00.000Z', kind: 'undo', modules: ['hr'], states: { hr: expected.fixtureA(seed).hr }, sourcePointId: 'other-point' }
  const undone = JSON.stringify({ schemaVersion: 1, points: [undo, restore, original] })
  assert.throws(() => assertHistoryAppend(after, undone, { kind: 'undo', hr: undo.states.hr, sourcePointId: 'restore-point' }))
})

test('the real560px scoped-heading regression cannot pass because its three interior samples happen to be visible', () => {
  const observed = { x: -85, y: 404.921875, width: 560, height: 35 }
  assert.deepEqual([0.2, 0.5, 0.8].map(fraction => observed.x + observed.width * fraction), [27, 195, 363])
  assert.throws(() => assertPayrollWitnessBounds(observed, 390), /complete status witness must fit/)
  assert.doesNotThrow(() => assertPayrollWitnessBounds({ x: 46, y: 404, width: 298, height: 76 }, 390))
})
