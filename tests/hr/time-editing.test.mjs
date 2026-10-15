import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'
const workflow = await loadMockModel(new URL('../../src/hr/mock-workflows.ts', import.meta.url))
const fixture = JSON.parse(readFileSync(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const avery = { role: 'employee', employeeId: 'employee-002' }, manager = { role: 'manager', employeeId: 'employee-001' }, owner = { role: 'employer-owner' }
const change = (state, event, actor = avery) => workflow.transitionMockHr(state, actor, event, fixture)
const initial = () => workflow.createMockHrState(fixture)
function returned() { return change(initial(), { type: 'return-time', entryId: 'time-001', reason: 'Correct the fictional hours before approval.' }, manager) }

test('scoped manager returns submitted time to draft with visible reason and no payroll eligibility', () => {
  const state = initial(), before = structuredClone(state)
  const result = returned()
  assert.deepEqual(result.timeEntries[0], { id: 'time-001', employeeId: 'employee-002', date: '2026-10-09', hours: 8, status: 'draft', source: 'fixture', returnReason: 'Correct the fictional hours before approval.', returnedBy: 'employee-001' })
  const eligibility = workflow.payrollEligibility(result, fixture, { start: '2026-10-01', end: '2026-10-15' })[0]
  assert.equal(eligibility.included, false)
  assert.match(eligibility.reasons.join(), /Returned draft/)
  assert.deepEqual(state, before)
})

test('return requires a bounded nonempty reason, direct-report submitted scope and separate manager', () => {
  for (const reason of ['', ' ', 'x'.repeat(501), 'two\nlines']) assert.throws(() => change(initial(), { type: 'return-time', entryId: 'time-001', reason }, manager), /return reason/)
  for (const actor of [avery, owner, { role: 'manager', employeeId: 'employee-002' }, { role: 'manager', employeeId: 'foreign' }]) assert.throws(() => change(initial(), { type: 'return-time', entryId: 'time-001', reason: 'Correction required' }, actor), /different scoped manager/)
  assert.throws(() => change(initial(), { type: 'return-time', entryId: 'time-002', reason: 'Correction required' }, manager), /submitted unpaid/)
})

test('returned owner edits and resubmits; reason persists and only subsequent manager approval makes it eligible', () => {
  let state = change(returned(), { type: 'edit-time', entryId: 'time-001', date: '2026-10-10', hours: 7.5 })
  assert.equal(state.timeEntries[0].hours, 7.5)
  assert.equal(state.timeEntries[0].returnReason, 'Correct the fictional hours before approval.')
  state = change(state, { type: 'submit-time', entryIds: ['time-001'] })
  assert.equal(state.timeEntries[0].status, 'submitted')
  state = change(state, { type: 'approve-time', entryId: 'time-001' }, manager)
  assert.equal(state.timeEntries[0].status, 'approved')
})

test('draft edit validates calendar dates, hours and the entire destination employee/day aggregate', () => {
  const state = returned()
  state.timeEntries.push({ id: 'other-day-hours', employeeId: 'employee-002', date: '2026-10-10', hours: 20, status: 'approved', source: 'manual' })
  for (const [date, hours] of [['2026-02-30', 1], ['2026-10-10', 4.01], ['2026-10-09', 0], ['2026-10-09', NaN], ['2026-10-09', 25]]) {
    const before = structuredClone(state)
    assert.throws(() => change(state, { type: 'edit-time', entryId: 'time-001', date, hours }))
    assert.deepEqual(state, before)
  }
  const result = change(state, { type: 'edit-time', entryId: 'time-001', date: '2026-10-10', hours: 4 })
  assert.equal(result.timeEntries[0].hours, 4)
  assert.equal(result.timeEntries[1].hours, 6)
  assert.deepEqual(result.timeEntries[2], state.timeEntries[2])
  assert.equal(change(returned(), { type: 'edit-time', entryId: 'time-001', date: '2026-10-09', hours: 24 }).timeEntries[0].hours, 24)
})

test('draft edit and delete deny another owner, submitted/approved and consumed entries', () => {
  for (const status of ['draft', 'submitted', 'approved']) {
    const state = returned(); state.timeEntries[0].status = status
    for (const type of ['edit-time', 'delete-time']) {
      const event = { type, entryId: 'time-001', date: '2026-10-09', hours: 1, confirmed: true }
      assert.throws(() => change(state, event, manager), /own unpaid draft/)
      if (status !== 'draft') assert.throws(() => change(state, event), /own unpaid draft/)
      state.timeEntries[0].payrollReceipt = 'FROZEN-RECEIPT'
      assert.throws(() => change(state, event), /own unpaid draft/)
    }
  }
})

test('deletion requires explicit confirmation and preserves all submitted, approved and paid records/history', () => {
  const state = returned()
  state.timeEntries.push({ id: 'submitted', employeeId: 'employee-002', date: '2026-10-11', hours: 2, status: 'submitted', source: 'manual' })
  state.timeEntries.push({ id: 'paid', employeeId: 'employee-002', date: '2026-10-12', hours: 3, status: 'approved', source: 'manual', payrollReceipt: 'FROZEN-RECEIPT' })
  const before = structuredClone(state)
  for (const confirmed of [false, undefined, 'true', 1]) assert.throws(() => change(state, { type: 'delete-time', entryId: 'time-001', confirmed }), /Confirm deletion/)
  assert.deepEqual(state, before)
  const result = change(state, { type: 'delete-time', entryId: 'time-001', confirmed: true })
  assert.deepEqual(result.timeEntries, before.timeEntries.slice(1))
  assert.deepEqual(result.payrollHistory, before.payrollHistory)
  assert.equal(result.sequence, before.sequence)
})
