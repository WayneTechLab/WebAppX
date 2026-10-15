import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const workflow = await loadMockModel(new URL('../../src/hr/mock-workflows.ts', import.meta.url))
const insights = await loadMockModel(new URL('../../src/hr/insights.ts', import.meta.url))
const fixture = JSON.parse(await readFile(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }
const employee = { role: 'employee', employeeId: 'employee-002' }
const period = { start: '2026-10-16', end: '2026-10-31' }
const change = (state, actor, event) => workflow.transitionMockHr(state, actor, event, fixture)

function prepared() {
  let state = workflow.createMockHrState(fixture)
  state = change(state, owner, { type: 'set-sample-rate', employeeId: employee.employeeId, effectiveFrom: '2026-10-01', hourlyRateCents: 2500 })
  state = change(state, owner, { type: 'set-sample-rate', employeeId: employee.employeeId, effectiveFrom: '2026-10-16', hourlyRateCents: 3500 })
  state = change(state, owner, { type: 'approve-time', entryId: 'time-001' })
  state = change(state, employee, { type: 'add-time', date: '2026-10-20', hours: 2, source: 'manual' })
  state = change(state, employee, { type: 'submit-time', entryIds: ['MOCK-TIME-0001'] })
  state = change(state, owner, { type: 'approve-time', entryId: 'MOCK-TIME-0001' })
  return change(state, owner, { type: 'prepare-payroll', period })
}

test('dashboard readiness uses the chosen run period and explicit effective rate eligibility', () => {
  let state = workflow.createMockHrState(fixture)
  state = change(state, owner, { type: 'approve-time', entryId: 'time-001' })
  assert.equal(insights.projectHrInsights({ actor: owner, fixture, state }).time.readyForPayroll, 0, 'Missing explicit rates must not count as ready')
  state = prepared()
  const report = insights.projectHrInsights({ actor: owner, fixture, state })
  assert.equal(report.time.readyForPayroll, 1)
  assert.equal(report.time.readyHours, 2, 'The eight approved October 9 hours are outside the chosen period')
})

test('self-service statements retain the chosen period, work date and rate after future compensation changes', () => {
  let state = prepared()
  for (const type of ['calculate-payroll', 'review-payroll', 'submit-payroll']) state = change(state, owner, { type })
  const [statement] = insights.projectEmployeePayStatements(employee, fixture, state)
  assert.equal(statement.periodStart, '2026-10-16')
  assert.equal(statement.periodEnd, '2026-10-31')
  assert.equal(statement.hours, 2)
  assert.equal(statement.grossCents, 7000)
  assert.equal(statement.illustrativeWithholdingCents, 1400)
  assert.equal(statement.netCents, 5600)
  assert.deepEqual(statement.entries, [{ id: 'MOCK-TIME-0001', date: '2026-10-20', hours: 2, rateCents: 3500 }])
  const history = structuredClone(state.payrollHistory)
  state = change(state, owner, { type: 'set-sample-rate', employeeId: employee.employeeId, effectiveFrom: '2026-11-01', hourlyRateCents: 5000 })
  assert.deepEqual(state.payrollHistory, history)
  assert.deepEqual(insights.projectEmployeePayStatements(employee, fixture, state), [statement])
  assert.deepEqual(insights.projectEmployeePayStatements({ role: 'employee', employeeId: 'employee-003' }, fixture, state), [])
})

test('genuine legacy-shaped submitted receipts retain their historical default period without migration', () => {
  const state = workflow.createMockHrState(fixture)
  state.timeEntries[0].status = 'approved'
  state.timeEntries[0].payrollReceipt = 'MOCK-PAYROLL-LEGACY'
  state.payrollHistory = [{
    stage: 'submitted', receipt: 'MOCK-PAYROLL-LEGACY', hours: 8,
    inputs: [{ entryId: 'time-001', employeeId: 'employee-002', hours: 8, rateCents: 3000 }],
    benefitInputs: [], grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 0, netCents: 19200,
    employeeTotals: [{ employeeId: 'employee-002', hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 0, netCents: 19200 }],
  }]
  const before = structuredClone(state)
  const [statement] = insights.projectEmployeePayStatements(employee, fixture, state)
  assert.equal(statement.periodStart, '2026-10-01')
  assert.equal(statement.periodEnd, '2026-10-15')
  assert.deepEqual(statement.entries, [{ id: 'time-001', date: '2026-10-09', hours: 8, rateCents: 3000 }])
  assert.deepEqual(state, before)
})
