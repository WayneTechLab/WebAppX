import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const source = name => new URL(`../../src/hr/${name}.ts`, import.meta.url)
const persistence = await loadMockModel(source('persistence'))
const core = await loadMockModel(source('payroll-control'))
const { createPayrollControlController } = await loadMockModel(source('payroll-control-controller'))
const { canonicalPayrollJson } = await loadMockModel(source('payroll-control-value'))
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }, payrollAdmin = { role: 'payroll-admin' }
const period = { start: '2026-10-01', end: '2026-10-15' }
const originalMoney = { grossCents: 751, illustrativeWithholdingCents: 150, benefitDeductionCents: 1, netCents: 600 }
const target = { grossCents: 1000, illustrativeWithholdingCents: 200, benefitDeductionCents: 50 }
const close = { kind: 'close-period', period, recordedOn: '2026-10-15', reason: 'Fictional period checked' }
const adjust = { kind: 'adjust-receipt', originalReceipt: 'MOCK-PAYROLL-0001', employeeId: 'employee-001', recordedOn: '2026-10-15', reason: 'Fictional target correction', proposed: target }
const services = { validateCandidate: persistence.isHrDemoState }
// Independent literal native payroll: round(375.5+375.5)=751, not round(375.5)*2=752.
function submitted({ legacy = false, receipt = 'MOCK-PAYROLL-0001' } = {}) {
  const state = persistence.createHrDemoState(fixture)
  state.workflow.timeEntries = [
    { id: 'time-a', employeeId: 'employee-001', date: '2026-10-05', hours: 0.125, status: 'approved', source: 'manual', payrollReceipt: receipt },
    { id: 'time-b', employeeId: 'employee-001', date: '2026-10-06', hours: 0.125, status: 'approved', source: 'manual', payrollReceipt: receipt },
  ]
  const snapshot = {
    stage: 'submitted', inputs: [
      { entryId: 'time-a', employeeId: 'employee-001', hours: 0.125, rateCents: 3004, ...(!legacy ? { date: '2026-10-05', rateEffectiveFrom: '2026-10-01' } : {}) },
      { entryId: 'time-b', employeeId: 'employee-001', hours: 0.125, rateCents: 3004, ...(!legacy ? { date: '2026-10-06', rateEffectiveFrom: '2026-10-01' } : {}) },
    ], ...(!legacy ? { period: structuredClone(period) } : {}), benefitInputs: [],
    employeeTotals: [{ employeeId: 'employee-001', hours: 0.25, ...originalMoney }],
    hours: 0.25, ...originalMoney, receipt,
  }
  state.workflow.payroll = structuredClone(snapshot); state.workflow.payrollHistory = [snapshot]; state.workflow.sequence = 2
  assert.equal(persistence.isHrDemoState(state, fixture), true)
  return state
}
function build(state, command, actor = owner) { return core.buildPayrollControlCandidate(state, actor, command, fixture, services) }
function unchangedExceptControl(before, after) { const expected = structuredClone(before); expected.workflow.payrollControl = after.workflow.payrollControl; assert.deepEqual(after, expected) }
function invalidCandidate(state, command) { const before = structuredClone(state); assert.throws(() => build(state, command)); assert.deepEqual(state, before) }
function validControl(state) { return core.assertValidPayrollControl(state, fixture) }
function closureEvent() { return { id: 'payroll-control-0001', sequence: 1, actor: owner, recordedOn: '2026-10-15', reason: 'Fictional period checked', kind: 'period-closed', period, receiptIds: ['MOCK-PAYROLL-0001'] } }

test('absence/read/projection/preview do not materialize; close accepts exactly one atomic extension', () => {
  const before = submitted(), literal = structuredClone(before)
  assert.equal(validControl(before), undefined)
  assert.deepEqual(core.projectPayrollControlView(before, owner, fixture), { mode: 'writer', closures: [], adjustments: [], receipts: [{ receipt: 'MOCK-PAYROLL-0001', period, employees: [{ employeeId: 'employee-001', original: originalMoney, cumulative: originalMoney }] }] })
  assert.deepEqual(before, literal)
  const { next, preview } = build(before, close)
  assert.deepEqual(before, literal)
  assert.deepEqual(next.workflow.payrollControl, { schemaVersion: 1, sequence: 2, anchors: [{ receipt: 'MOCK-PAYROLL-0001', snapshot: literal.workflow.payrollHistory[0] }], events: [closureEvent()] })
  assert.equal(preview.kind, 'close-period'); assert.equal(preview.entryCount, 2); assert.equal(preview.pendingPayrollBecomesStale, false)
  unchangedExceptControl(before, next); assert.equal(persistence.isHrDemoState(next, fixture), true)
  assert.match(core.payrollControlClosedDateReason(next.workflow, '2026-10-01'), /is closed/)
  assert.match(core.payrollControlClosedDateReason(next.workflow, '2026-10-15'), /is closed/)
  assert.equal(core.payrollControlClosedDateReason(next.workflow, '2026-10-16'), null)
  assert.match(core.payrollControlClosedPeriodReason(next.workflow, { start: '2026-09-30', end: '2026-10-01' }), /overlaps/)
  assert.equal(core.payrollControlClosedPeriodReason(next.workflow, { start: '2026-10-16', end: '2026-10-17' }), null)
})

test('correction is independent of closure, cumulative targets chain with exact integer deltas', () => {
  const before = submitted(), first = build(before, adjust).next
  unchangedExceptControl(before, first)
  assert.deepEqual(first.workflow.payrollControl, { schemaVersion: 1, sequence: 2, anchors: [{ receipt: 'MOCK-PAYROLL-0001', snapshot: before.workflow.payrollHistory[0] }], events: [{ id: 'payroll-control-0001', sequence: 1, actor: owner, recordedOn: '2026-10-15', reason: 'Fictional target correction', kind: 'receipt-adjusted', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0001', originalReceipt: 'MOCK-PAYROLL-0001', employeeId: 'employee-001', previousAdjustmentId: null, previous: originalMoney, proposed: { ...target, netCents: 750 }, delta: { grossCents: 249, illustrativeWithholdingCents: 50, benefitDeductionCents: 49, netCents: 150 } }] })
  const second = build(first, { ...adjust, recordedOn: '2026-10-16', proposed: { grossCents: 900, illustrativeWithholdingCents: 100, benefitDeductionCents: 20 } }, payrollAdmin).next
  assert.deepEqual(second.workflow.payrollControl.events[1], { id: 'payroll-control-0002', sequence: 2, actor: payrollAdmin, recordedOn: '2026-10-16', reason: 'Fictional target correction', kind: 'receipt-adjusted', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0002', originalReceipt: 'MOCK-PAYROLL-0001', employeeId: 'employee-001', previousAdjustmentId: 'payroll-control-0001', previous: { ...target, netCents: 750 }, proposed: { grossCents: 900, illustrativeWithholdingCents: 100, benefitDeductionCents: 20, netCents: 780 }, delta: { grossCents: -100, illustrativeWithholdingCents: -100, benefitDeductionCents: -30, netCents: 30 } })
  assert.deepEqual(second.workflow.payrollControl.anchors, first.workflow.payrollControl.anchors)
  const view = core.projectPayrollControlView(second, owner, fixture)
  assert.deepEqual(view.receipts[0].employees[0].cumulative, { grossCents: 900, illustrativeWithholdingCents: 100, benefitDeductionCents: 20, netCents: 780 })
  unchangedExceptControl(before, second); validControl(second)
  invalidCandidate(second, { ...adjust, recordedOn: '2026-10-16', proposed: { grossCents: 900, illustrativeWithholdingCents: 100, benefitDeductionCents: 20 } })
})

test('closure consumes control event clock; following correction references the unchanged original', () => {
  const before = submitted(), closed = build(before, close).next, corrected = build(closed, adjust).next
  assert.equal(corrected.workflow.payrollControl.events[1].adjustmentReceipt, 'MOCK-PAYROLL-ADJUSTMENT-0002')
  assert.equal(corrected.workflow.payrollControl.events[1].originalReceipt, 'MOCK-PAYROLL-0001')
  assert.deepEqual(corrected.workflow.payrollHistory, before.workflow.payrollHistory)
  assert.equal(corrected.workflow.sequence, 2)
  invalidCandidate(corrected, { ...close, recordedOn: '2026-10-16' })
  invalidCandidate(corrected, { ...close, period: { start: '2026-10-14', end: '2026-10-20' }, recordedOn: '2026-10-20' })
})

test('periodless known consumed dates qualify monetary correction without inventing historical fields', () => {
  const before = submitted({ legacy: true }), next = build(before, { ...adjust, recordedOn: '2000-01-01' }).next
  assert.equal(Object.hasOwn(next.workflow.payrollControl.anchors[0].snapshot, 'period'), false)
  for (const input of next.workflow.payrollControl.anchors[0].snapshot.inputs) { assert.equal(Object.hasOwn(input, 'date'), false); assert.equal(Object.hasOwn(input, 'rateEffectiveFrom'), false) }
  assert.equal(core.projectPayrollControlView(next, owner, fixture).receipts[0].period, null)
  unchangedExceptControl(before, next); validControl(next)
  invalidCandidate(next, close)
})

test('legacy observations retain arbitrary historical withholding and native metadata', () => {
  const before = submitted({ legacy: true })
  for (const snapshot of [before.workflow.payroll, before.workflow.payrollHistory[0]]) {
    snapshot.illustrativeWithholdingCents = 7; snapshot.netCents = 743
    snapshot.employeeTotals[0].illustrativeWithholdingCents = 7; snapshot.employeeTotals[0].netCents = 743
    snapshot.historicalNote = { version: 'legacy-opaque', fields: [1, false] }
  }
  const next = build(before, adjust).next
  assert.equal(next.workflow.payrollControl.events[0].previous.illustrativeWithholdingCents, 7)
  assert.deepEqual(next.workflow.payrollControl.anchors[0].snapshot, before.workflow.payrollHistory[0])
  next.workflow.payrollControl.events[0] = Object.fromEntries(Object.entries(next.workflow.payrollControl.events[0]).reverse())
  validControl(next)
})

for (const [name, mutate] of [
  ['per-row rounding', state => { for (const snapshot of [state.workflow.payroll, state.workflow.payrollHistory[0]]) { snapshot.grossCents = 752; snapshot.netCents = 601; snapshot.employeeTotals[0].grossCents = 752; snapshot.employeeTotals[0].netCents = 601 } }],
  ['duplicate employee total', state => { state.workflow.payrollHistory[0].employeeTotals.push(structuredClone(state.workflow.payrollHistory[0].employeeTotals[0])) }],
  ['orphan consumed link', state => { state.workflow.timeEntries.push({ id: 'orphan', employeeId: 'employee-001', date: '2026-10-05', hours: 1, status: 'approved', source: 'manual', payrollReceipt: 'MOCK-PAYROLL-0001' }) }],
  ['unknown consumed date', state => { state.workflow.timeEntries[0].date = 'unknown historical date' }],
  ['changed consumed hours', state => { state.workflow.timeEntries[0].hours = 0.5 }],
  ['changed consumed employee', state => { state.workflow.timeEntries[0].employeeId = 'employee-002' }],
  ['duplicate history ownership', state => { const second = structuredClone(state.workflow.payrollHistory[0]); second.receipt = 'MOCK-PAYROLL-0002'; state.workflow.payrollHistory.push(second) }],
  ['changed submitted pointer', state => { state.workflow.payroll.netCents++ }],
  ['unsupported canonical receipt', state => { state.workflow.payrollHistory[0].receipt = 'MOCK-PAYROLL-00001'; state.workflow.payroll.receipt = 'MOCK-PAYROLL-00001'; state.workflow.timeEntries.forEach(entry => { entry.payrollReceipt = 'MOCK-PAYROLL-00001' }) }],
  ['nonfinite product', state => { state.workflow.payrollHistory[0].inputs[0].rateCents = Number.MAX_SAFE_INTEGER }],
]) test(`unsupported original refuses ${name} without changing any source`, () => { const state = submitted(); mutate(state); invalidCandidate(state, adjust) })

for (const [name, change] of [
  ['negative cents', { grossCents: -1, illustrativeWithholdingCents: 0, benefitDeductionCents: 0 }],
  ['fractional cents', { grossCents: 1000.1, illustrativeWithholdingCents: 0, benefitDeductionCents: 0 }],
  ['over target cap', { grossCents: 1_000_000_000_001, illustrativeWithholdingCents: 0, benefitDeductionCents: 0 }],
  ['negative zero', { grossCents: 1000, illustrativeWithholdingCents: -0, benefitDeductionCents: 0 }],
  ['deductions exceed gross', { grossCents: 1, illustrativeWithholdingCents: 1, benefitDeductionCents: 1 }],
  ['extra target field', { ...target, taxes: 1 }],
]) test(`target refuses ${name}`, () => invalidCandidate(submitted(), { ...adjust, proposed: change }))

test('closing includes every exact-period original in history order and rejects unpaid/overlap/legacy smuggling', () => {
  const state = submitted(), second = structuredClone(state.workflow.payrollHistory[0])
  second.receipt = 'MOCK-PAYROLL-0002'; second.inputs.forEach(input => { input.entryId += '-second' })
  state.workflow.payrollHistory.push(second)
  state.workflow.timeEntries.push(...state.workflow.timeEntries.map(entry => ({ ...entry, id: entry.id + '-second', payrollReceipt: 'MOCK-PAYROLL-0002' })))
  const closed = build(state, close).next
  assert.deepEqual(closed.workflow.payrollControl.events[0].receiptIds, ['MOCK-PAYROLL-0001', 'MOCK-PAYROLL-0002'])
  assert.deepEqual(closed.workflow.payrollControl.anchors.map(anchor => anchor.receipt), ['MOCK-PAYROLL-0001', 'MOCK-PAYROLL-0002'])
  for (const mutate of [
    next => { next.workflow.timeEntries.push({ id: 'unpaid', employeeId: 'employee-001', date: '2026-10-15', hours: 1, status: 'draft', source: 'manual' }) },
    next => { next.workflow.payrollHistory[1].period = { start: '2026-10-02', end: '2026-10-15' } },
    next => { delete next.workflow.payrollHistory[1].period; next.workflow.payrollHistory[1].inputs.forEach(input => { delete input.date; delete input.rateEffectiveFrom }) },
  ]) { const next = structuredClone(state); mutate(next); invalidCandidate(next, close) }
  const appended = structuredClone(closed); appended.workflow.payrollHistory.push(structuredClone(second))
  assert.throws(() => validControl(appended), 'an extra unanchored same-period receipt cannot become valid after closure')
})

test('pending overlapping payroll remains exact and becomes stale only through derived closure guard', () => {
  const before = submitted(); before.workflow.payroll = { ...structuredClone(before.workflow.payroll), stage: 'prepared' }; delete before.workflow.payroll.receipt
  const result = build(before, close)
  assert.equal(result.preview.pendingPayrollBecomesStale, true)
  assert.deepEqual(result.next.workflow.payroll, before.workflow.payroll); validControl(result.next)
})

function appendUnrelatedOriginal(state, { periodless = false } = {}) {
  const snapshot = structuredClone(state.workflow.payrollHistory[0])
  snapshot.receipt = 'MOCK-PAYROLL-0002'
  if (periodless) delete snapshot.period
  else snapshot.period = { start: '2026-11-01', end: '2026-11-15' }
  snapshot.inputs = [
    { entryId: 'time-unrelated-a', employeeId: 'employee-001', hours: 0.125, rateCents: 3004, date: '2026-11-05', rateEffectiveFrom: '2026-10-01' },
    { entryId: 'time-unrelated-b', employeeId: 'employee-001', hours: 0.125, rateCents: 3004, date: '2026-11-06', rateEffectiveFrom: '2026-10-01' },
  ]
  state.workflow.payrollHistory.push(snapshot)
  state.workflow.timeEntries.push(
    { id: 'time-unrelated-a', employeeId: 'employee-001', date: '2026-11-05', hours: 0.125, status: 'approved', source: 'manual', payrollReceipt: 'MOCK-PAYROLL-0002' },
    { id: 'time-unrelated-b', employeeId: 'employee-001', date: '2026-11-06', hours: 0.125, status: 'approved', source: 'manual', payrollReceipt: 'MOCK-PAYROLL-0002' },
  )
  return snapshot
}
test('control activation and import replay require globally unique complete submitted-pointer history', () => {
  const closed = build(submitted(), close).next
  for (const mutate of [
    state => { state.workflow.payroll.receipt = 'MOCK-PAYROLL-9999' },
    state => { state.workflow.payroll = structuredClone(appendUnrelatedOriginal(state)); state.workflow.payroll.unmatchedHistoricalMetadata = 'pointer disagrees with its unrelated receipt' },
  ]) {
    const absent = submitted(); mutate(absent)
    assert.equal(persistence.isHrDemoState(absent, fixture), true, 'permissive legacy absence remains readable')
    assert.equal(validControl(absent), undefined)
    invalidCandidate(absent, close); invalidCandidate(absent, adjust)
    const present = structuredClone(closed); mutate(present)
    const exact = structuredClone(present)
    assert.throws(() => validControl(present)); assert.equal(persistence.isHrDemoState(present, fixture), false)
    assert.deepEqual(present, exact, 'import validation does not repair an unrelated submitted pointer')
  }
  const matchingUnrelated = submitted(); matchingUnrelated.workflow.payroll = structuredClone(appendUnrelatedOriginal(matchingUnrelated))
  const accepted = build(matchingUnrelated, close).next
  assert.deepEqual(accepted.workflow.payroll, matchingUnrelated.workflow.payroll); validControl(accepted)
})

test('periodless closure inventory preserves omitted dates but refuses known frozen/current date conflicts', () => {
  const closed = build(submitted(), close).next
  for (const mutate of [
    state => { state.workflow.payrollHistory[1].inputs[0].date = '2026-10-05' },
    state => { state.workflow.timeEntries.find(entry => entry.id === 'time-unrelated-a').date = '2026-10-05' },
  ]) {
    const absent = submitted(); appendUnrelatedOriginal(absent, { periodless: true }); mutate(absent)
    assert.equal(persistence.isHrDemoState(absent, fixture), true, 'legacy date conflicts remain readable without controls')
    assert.equal(validControl(absent), undefined); invalidCandidate(absent, close)
    const present = structuredClone(closed); appendUnrelatedOriginal(present, { periodless: true }); mutate(present)
    const exact = structuredClone(present)
    assert.throws(() => validControl(present)); assert.equal(persistence.isHrDemoState(present, fixture), false)
    assert.deepEqual(present, exact, 'replay never fills omitted fields or moves a conflicting date')
  }
  const outside = submitted(); const legacy = appendUnrelatedOriginal(outside, { periodless: true })
  const acceptedKnown = build(outside, close).next
  assert.deepEqual(acceptedKnown.workflow.payrollHistory[1], legacy); validControl(acceptedKnown)
  delete legacy.inputs[0].date; delete legacy.inputs[0].rateEffectiveFrom
  delete legacy.inputs[1].date; delete legacy.inputs[1].rateEffectiveFrom
  const acceptedOmitted = build(outside, close).next
  assert.deepEqual(acceptedOmitted.workflow.payrollHistory[1], legacy)
  assert.equal(Object.hasOwn(acceptedOmitted.workflow.payrollHistory[1], 'period'), false)
  assert.equal(Object.hasOwn(acceptedOmitted.workflow.payrollHistory[1].inputs[0], 'date'), false)
  validControl(acceptedOmitted)
})

test('strict present replay refuses forged authority and preserves first-use anchor order', () => {
  const good = build(build(submitted(), close).next, adjust).next
  for (const mutate of [
    state => { state.workflow.payrollControl.sequence++ },
    state => { state.workflow.payrollControl.schemaVersion = 2 },
    state => { state.workflow.payrollControl.events = [] },
    state => { state.workflow.payrollControl.events[0].extra = true },
    state => { state.workflow.payrollControl.events[0].actor.contractorId = 'contractor-001' },
    state => { state.workflow.payrollControl.events[0].actor.employeeId = 'unknown' },
    state => { state.workflow.payrollControl.events[1].delta.netCents++ },
    state => { state.workflow.payrollControl.events[1].previousAdjustmentId = 'payroll-control-0001' },
    state => { state.workflow.payrollControl.events[1].originalReceipt = 'MOCK-PAYROLL-ADJUSTMENT-0001' },
    state => { state.workflow.payrollControl.events[1].adjustmentReceipt = 'MOCK-PAYROLL-ADJUSTMENT-0001' },
    state => { state.workflow.payrollControl.events[1].recordedOn = '2026-10-14' },
    state => { state.workflow.payrollControl.anchors[0].snapshot.historicalNote = 'forged' },
    state => { state.workflow.payrollControl.anchors.push(structuredClone(state.workflow.payrollControl.anchors[0])) },
    state => { state.workflow.timeEntries.push({ id: 'post-close', employeeId: 'employee-002', date: '2026-10-14', hours: 1, status: 'draft', source: 'manual' }) },
  ]) { const state = structuredClone(good); mutate(state); assert.throws(() => validControl(state)) }
})

test('present strict envelope rejects descriptors without getter execution; absence retains legacy extras', () => {
  let reads = 0
  const getterRoot = {}; Object.defineProperty(getterRoot, 'workflow', { enumerable: true, get() { reads++; return {} } })
  assert.throws(() => core.payrollControlPresence(getterRoot)); assert.equal(reads, 0)
  const getterArm = submitted(); Object.defineProperty(getterArm.workflow, 'payrollControl', { enumerable: true, get() { reads++; return {} } })
  assert.throws(() => validControl(getterArm)); assert.equal(reads, 0)
  const good = build(submitted(), adjust).next
  for (const mutate of [
    state => { state.workflow.payrollControl = undefined },
    state => { state.unrelated = undefined },
    state => { state.unrelated = -0 },
    state => { state.unrelated = NaN },
    state => { state.unrelated = new Date() },
    state => { state.unrelated = state },
    state => { state.unrelated = Array(2) },
    state => { Object.defineProperty(state, 'hidden', { value: true }) },
    state => { state[Symbol('hidden')] = true },
    state => { Object.defineProperty(state, 'unrelated', { enumerable: true, get() { reads++; return 'hidden' } }) },
  ]) { const state = structuredClone(good); mutate(state); assert.throws(() => validControl(state)) }
  assert.equal(reads, 0)
  const absent = submitted(); absent.unrelated = undefined; assert.equal(validControl(absent), undefined)
  const withExtra = structuredClone(good); withExtra.unrelated = { safeLegacyMetadata: [1, 'retained'] }; validControl(withExtra)
})

test('writer/own/auditor DTOs disclose only the permitted adjustment surface', () => {
  const next = build(submitted(), adjust).next
  const own = core.projectPayrollControlView(next, { role: 'employee', employeeId: 'employee-001' }, fixture)
  assert.equal(own.mode, 'own'); assert.equal(own.adjustments.length, 1); assert.equal(Object.hasOwn(own, 'receipts'), false)
  assert.deepEqual(core.projectPayrollControlView(next, { role: 'employee', employeeId: 'employee-002' }, fixture), { mode: 'own', employeeId: 'employee-002', adjustments: [] })
  const audit = core.projectPayrollControlView(next, { role: 'auditor' }, fixture)
  assert.deepEqual(audit, { mode: 'auditor', closures: [], adjustments: [{ id: 'payroll-control-0001', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0001', originalReceipt: 'MOCK-PAYROLL-0001', employeeId: 'employee-001', recordedOn: '2026-10-15' }], anchorCount: 1, eventCount: 1 })
  for (const secret of ['grossCents', 'Fictional target', 'previous', 'proposed', 'delta', 'snapshot', 'reason']) assert.equal(JSON.stringify(audit).includes(secret), false)
  for (const actor of [{ role: 'hr-admin' }, { role: 'manager', employeeId: 'employee-002' }, { role: 'employee' }, { role: 'employee', employeeId: 'unknown' }]) assert.throws(() => core.projectPayrollControlView(next, actor, fixture))
})

function controllerHarness(initial = submitted(), options = {}) {
  const harness = { state: initial, raw: structuredClone(fixture), actor: owner, epoch: 0, generation: 0, time: 1, random: 0, reads: 0, commits: 0, beforeReplace: null }
  harness.controller = createPayrollControlController({
    readCurrent() { harness.reads++; return harness.state }, readRawFixture: () => harness.raw, readActor: () => harness.actor,
    readEpoch: () => harness.epoch, readModeGeneration: () => harness.generation, monotonicNow: () => harness.time,
    randomBytes(length) { const value = ++harness.random; return Uint8Array.from({ length }, (_, index) => (value >>> (index % 4 * 8)) & 255) },
    replaceCurrent(update) { harness.beforeReplace?.(); const next = update(harness.state); assert.equal(persistence.isHrDemoState(next, harness.raw), true); harness.state = next; harness.commits++; return true },
    services, ...options,
  })
  return harness
}
function preview(harness, command = adjust) { const result = harness.controller.preview(command); assert.equal(result.ok, true, JSON.stringify(result)); assert.match(result.handle, /^[0-9a-f]{64}$/); return result }
function confirm(harness, result, kind = result.preview.kind) { return harness.controller.confirm({ kind, handle: result.handle }) }

test('controller preview/cancel/refusal never write; one latest callback accepts once and replay stales', () => {
  const harness = controllerHarness(), before = structuredClone(harness.state), canceled = preview(harness)
  assert.deepEqual(harness.state, before); assert.equal(harness.commits, 0)
  harness.controller.cancel(canceled.handle); assert.equal(confirm(harness, canceled).code, 'stale')
  const accepted = preview(harness), result = confirm(harness, accepted)
  assert.equal(result.ok, true); assert.equal(harness.commits, 1); unchangedExceptControl(before, harness.state)
  assert.equal(result.feedback, 'Fictional payroll control accepted in memory. Check the browser storage notice before refreshing.')
  assert.equal(confirm(harness, accepted).code, 'stale'); assert.equal(harness.commits, 1)
})

for (const [name, mutate] of [
  ['same sequence source content', harness => { harness.state.workflow.profileEmails['employee-001'] = 'changed@example.invalid' }],
  ['raw fixture content', harness => { harness.raw.company.name = 'Another fictional company' }],
  ['replacement epoch', harness => { harness.epoch++ }],
  ['mode generation', harness => { harness.generation++ }],
  ['actor', harness => { harness.actor = payrollAdmin }],
  ['expiry at ten minutes', harness => { harness.time += 600_000 }],
]) test(`controller refuses latest ${name} without domain/save side effects`, () => {
  const harness = controllerHarness(), result = preview(harness)
  harness.beforeReplace = () => mutate(harness)
  const response = confirm(harness, result)
  assert.equal(response.ok, false); assert.equal(response.code, 'stale'); assert.equal(harness.commits, 0); assert.equal(Object.hasOwn(harness.state.workflow, 'payrollControl'), false)
  assert.equal(confirm(harness, result).ok, false)
})

test('denied roles are refused before source read; malformed own handles consume without getters', () => {
  const harness = controllerHarness()
  for (const actor of [{ role: 'employee', employeeId: 'employee-001' }, { role: 'manager', employeeId: 'employee-002' }, { role: 'auditor' }, { role: 'employer-owner', employeeId: undefined }]) {
    harness.actor = actor; const before = harness.reads
    assert.equal(harness.controller.preview(adjust).ok, false); assert.equal(harness.reads, before)
  }
  harness.actor = owner
  for (const malformed of [handle => ({ kind: 'wrong-family', handle }), handle => ({ kind: 'adjust-receipt', handle, extra: true }), (handle, onRead) => { const value = { handle }; Object.defineProperty(value, 'kind', { enumerable: true, get() { onRead(); return 'adjust-receipt' } }); return value }]) {
    const result = preview(harness); let reads = 0; const request = malformed(result.handle, () => reads++)
    assert.equal(harness.controller.confirm(request).ok, false); assert.equal(reads, 0); assert.equal(confirm(harness, result).code, 'stale')
  }
  assert.equal(harness.commits, 0)
})

test('controller evicts oldest at eight live; canceled handles never reissue and random/time failures are safe', () => {
  const harness = controllerHarness(), results = Array.from({ length: 9 }, () => preview(harness))
  assert.equal(confirm(harness, results[0]).code, 'stale')
  assert.equal(confirm(harness, results[8]).ok, true); assert.equal(harness.commits, 1)
  const noRandom = controllerHarness(submitted(), { randomBytes() { throw new Error('unavailable') } })
  assert.equal(noRandom.controller.preview(adjust).code, 'unavailable'); assert.equal(noRandom.commits, 0)
  const clock = controllerHarness(), result = preview(clock); clock.time = 0
  assert.equal(confirm(clock, result).code, 'unavailable'); assert.equal(clock.commits, 0)
  const fixed = controllerHarness(submitted(), { randomBytes: length => new Uint8Array(length).fill(1) })
  const first = preview(fixed); fixed.controller.cancel(first.handle)
  assert.equal(fixed.controller.preview(adjust).code, 'unavailable'); assert.equal(fixed.commits, 0)
})

test('complete snapshot character cap and issued lifetime limit are bounded with no preview writes', () => {
  const harness = controllerHarness()
  for (let index = 0; index < 4096; index++) { const result = preview(harness); harness.controller.cancel(result.handle) }
  assert.equal(harness.controller.preview(adjust).code, 'limit'); assert.equal(harness.commits, 0)
  const tooLarge = submitted(); tooLarge.extra = 'x'.repeat(2_000_000)
  assert.throws(() => canonicalPayrollJson(tooLarge))
})

test('aggregate captured-source limit evicts oldest before four large valid snapshots; newest commits once', () => {
  const state = submitted(); state.acceptedLegacyMetadata = 'x'.repeat(1_100_000)
  assert.equal(persistence.isHrDemoState(state, fixture), true)
  const characters = canonicalPayrollJson(state).length + canonicalPayrollJson(fixture).length
  assert(characters * 3 <= 4_000_000 && characters * 4 > 4_000_000)
  const harness = controllerHarness(state), results = Array.from({ length: 4 }, () => preview(harness))
  assert.equal(harness.commits, 0); assert.equal(confirm(harness, results[0]).code, 'stale')
  assert.equal(confirm(harness, results[3]).ok, true); assert.equal(harness.commits, 1)
  assert.equal(harness.state.acceptedLegacyMetadata, state.acceptedLegacyMetadata)
  assert.equal(confirm(harness, results[3]).code, 'stale'); assert.equal(harness.commits, 1)
})

test('canonical receipt grammar and generated identity collisions refuse without consuming sequence', () => {
  for (const receipt of ['MOCK-PAYROLL-0000', 'MOCK-PAYROLL-1', 'MOCK-PAYROLL-00001', 'MOCK-PAYROLL-1.0', 'legacy-readable']) {
    const state = submitted({ legacy: true, receipt })
    assert.equal(core.projectPayrollControlView(state, owner, fixture).receipts.length, 0)
    invalidCandidate(state, { ...adjust, originalReceipt: receipt })
  }
  for (const receipt of ['MOCK-PAYROLL-0001', 'MOCK-PAYROLL-10000']) {
    const state = submitted({ legacy: true, receipt })
    assert.equal(build(state, { ...adjust, originalReceipt: receipt }).next.workflow.payrollControl.sequence, 2)
  }
  for (const collision of ['payroll-control-0001', 'MOCK-PAYROLL-ADJUSTMENT-0001']) {
    const state = submitted(); state.workflow.payroll = { stage: 'idle', inputs: [], benefitInputs: [], employeeTotals: [], hours: 0, grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: 0, receipt: collision }
    assert.equal(persistence.isHrDemoState(state, fixture), true); invalidCandidate(state, adjust)
  }
})

// Independent bounded saved histories exercise strict replay limits, never application-derived expectations.
function manyOriginals(count) {
  const state = submitted(); state.workflow.timeEntries = []; state.workflow.payrollHistory = []
  for (let index = 1; index <= count; index++) {
    const receipt = `MOCK-PAYROLL-${String(index).padStart(4, '0')}`, date = new Date(Date.UTC(2026, 0, index)).toISOString().slice(0, 10)
    const entryId = `time-${index}`
    state.workflow.timeEntries.push({ id: entryId, employeeId: 'employee-001', date, hours: 0.25, status: 'approved', source: 'manual', payrollReceipt: receipt })
    state.workflow.payrollHistory.push({ stage: 'submitted', inputs: [{ entryId, employeeId: 'employee-001', date, rateEffectiveFrom: '2026-01-01', hours: 0.25, rateCents: 3004 }], period: { start: date, end: date }, benefitInputs: [], employeeTotals: [{ employeeId: 'employee-001', hours: 0.25, ...originalMoney }], hours: 0.25, ...originalMoney, receipt })
  }
  state.workflow.payroll = structuredClone(state.workflow.payrollHistory.at(-1)); state.workflow.sequence = count + 1
  return state
}
function literalAdjustment(sequence, { originalReceipt = 'MOCK-PAYROLL-0001', previousAdjustmentId = null, previous = originalMoney, proposed = { ...target, netCents: 750 }, delta = { grossCents: 249, illustrativeWithholdingCents: 50, benefitDeductionCents: 49, netCents: 150 } } = {}) {
  return { id: `payroll-control-${String(sequence).padStart(4, '0')}`, sequence, actor: owner, recordedOn: '2026-12-31', reason: 'Bounded fictional correction', kind: 'receipt-adjusted', adjustmentReceipt: `MOCK-PAYROLL-ADJUSTMENT-${String(sequence).padStart(4, '0')}`, originalReceipt, employeeId: 'employee-001', previousAdjustmentId, previous, proposed, delta }
}
test('fifty closures, two hundred adjustments and two hundred fifty combined events replay at exact bounds', () => {
  const state = manyOriginals(51), anchors = state.workflow.payrollHistory.slice(0, 50).map(snapshot => ({ receipt: snapshot.receipt, snapshot: structuredClone(snapshot) }))
  const closures = anchors.map((anchor, index) => ({ id: `payroll-control-${String(index + 1).padStart(4, '0')}`, sequence: index + 1, actor: owner, recordedOn: '2026-12-31', reason: 'Bounded fictional closure', kind: 'period-closed', period: anchor.snapshot.period, receiptIds: [anchor.receipt] }))
  state.workflow.payrollControl = { schemaVersion: 1, sequence: 51, anchors, events: closures }
  assert.equal(persistence.isHrDemoState(state, fixture), true)
  invalidCandidate(state, { ...close, recordedOn: '2026-12-31', period: state.workflow.payrollHistory[50].period })
  const corrections = []
  for (let index = 0; index < 200; index++) {
    const sequence = index + 51, odd = index % 2 === 1
    corrections.push(literalAdjustment(sequence, index === 0 ? {} : {
      previousAdjustmentId: `payroll-control-${String(sequence - 1).padStart(4, '0')}`,
      previous: { grossCents: odd ? 1000 : 1001, illustrativeWithholdingCents: 200, benefitDeductionCents: 50, netCents: odd ? 750 : 751 },
      proposed: { grossCents: odd ? 1001 : 1000, illustrativeWithholdingCents: 200, benefitDeductionCents: 50, netCents: odd ? 751 : 750 },
      delta: { grossCents: odd ? 1 : -1, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: odd ? 1 : -1 },
    }))
  }
  state.workflow.payrollControl = { schemaVersion: 1, sequence: 251, anchors, events: [...closures, ...corrections] }
  assert.equal(persistence.isHrDemoState(state, fixture), true); validControl(state)
  invalidCandidate(state, { ...adjust, recordedOn: '2026-12-31', proposed: { ...target, grossCents: 1010 } })
  const correctionOnly = structuredClone(state)
  correctionOnly.workflow.payrollControl = { schemaVersion: 1, sequence: 201, anchors: [anchors[0]], events: corrections.map((event, index) => ({ ...event, id: `payroll-control-${String(index + 1).padStart(4, '0')}`, sequence: index + 1, adjustmentReceipt: `MOCK-PAYROLL-ADJUSTMENT-${String(index + 1).padStart(4, '0')}`, previousAdjustmentId: index === 0 ? null : `payroll-control-${String(index).padStart(4, '0')}` })) }
  assert.equal(persistence.isHrDemoState(correctionOnly, fixture), true)
  invalidCandidate(correctionOnly, { ...adjust, recordedOn: '2026-12-31', proposed: { ...target, grossCents: 1010 } })
})

test('one hundred first-use anchors are accepted; the one hundred first distinct original refuses atomically', () => {
  const state = manyOriginals(101)
  state.workflow.payrollControl = {
    schemaVersion: 1, sequence: 101,
    anchors: state.workflow.payrollHistory.slice(0, 100).map(snapshot => ({ receipt: snapshot.receipt, snapshot: structuredClone(snapshot) })),
    events: Array.from({ length: 100 }, (_, index) => literalAdjustment(index + 1, { originalReceipt: `MOCK-PAYROLL-${String(index + 1).padStart(4, '0')}` })),
  }
  assert.equal(persistence.isHrDemoState(state, fixture), true); validControl(state)
  invalidCandidate(state, { ...adjust, originalReceipt: 'MOCK-PAYROLL-0101', recordedOn: '2026-12-31' })
  const reordered = structuredClone(state); reordered.workflow.payrollControl.anchors.reverse(); assert.throws(() => validControl(reordered))
})
