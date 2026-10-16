/** Independent literals for the payroll-control browser slice.
 * No application reducer, qualifier, arithmetic helper, codec, controller,
 * projection or product export supplies these expected answers. */
export const avery = 'employee-002'
export const jordan = 'employee-003'
export const period = Object.freeze({ start: '2026-10-01', end: '2026-10-15' })
export const date = '2026-10-16'
export const originalA = Object.freeze({
  stage: 'submitted',
  inputs: [{ entryId: 'time-001', employeeId: avery, date: '2026-10-09', hours: 8, rateCents: 3000, rateEffectiveFrom: '2026-10-01' }],
  period,
  benefitInputs: [{ employeeId: avery, planId: 'benefit-001', deductionCents: 2500 }],
  employeeTotals: [{ employeeId: avery, hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 2500, netCents: 16700 }],
  hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 2500, netCents: 16700, receipt: 'MOCK-PAYROLL-0002',
})
export const originalF = Object.freeze({
  stage: 'submitted', period,
  inputs: [
    { entryId: 'time-001', employeeId: avery, date: '2026-10-09', hours: 0.125, rateCents: 3004, rateEffectiveFrom: '2026-10-01' },
    { entryId: 'MOCK-TIME-0001', employeeId: avery, date: '2026-10-10', hours: 0.125, rateCents: 3004, rateEffectiveFrom: '2026-10-01' },
  ], benefitInputs: [],
  employeeTotals: [{ employeeId: avery, hours: 0.25, grossCents: 751, illustrativeWithholdingCents: 150, benefitDeductionCents: 0, netCents: 601 }],
  hours: 0.25, grossCents: 751, illustrativeWithholdingCents: 150, benefitDeductionCents: 0, netCents: 601, receipt: 'MOCK-PAYROLL-0002',
})
export const originalM = Object.freeze({
  stage: 'submitted', period,
  inputs: [
    { entryId: 'time-001', employeeId: avery, date: '2026-10-09', hours: 8, rateCents: 3000, rateEffectiveFrom: '2026-10-01' },
    { entryId: 'time-002', employeeId: jordan, date: '2026-10-09', hours: 6, rateCents: 4000, rateEffectiveFrom: '2026-10-01' },
  ], benefitInputs: [{ employeeId: avery, planId: 'benefit-001', deductionCents: 2500 }],
  employeeTotals: [
    { employeeId: avery, hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 2500, netCents: 16700 },
    { employeeId: jordan, hours: 6, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 0, netCents: 19200 },
  ], hours: 14, grossCents: 48000, illustrativeWithholdingCents: 9600, benefitDeductionCents: 2500, netCents: 35900, receipt: 'MOCK-PAYROLL-0003',
})
const copy = value => structuredClone(value)
const money = (grossCents, illustrativeWithholdingCents, benefitDeductionCents, netCents) => ({ grossCents, illustrativeWithholdingCents, benefitDeductionCents, netCents })
export const originalMoneyA = Object.freeze(money(24000, 4800, 2500, 16700))
export const correctedMoney = Object.freeze([
  money(27000, 5400, 2500, 19100), money(25500, 5100, 2500, 17900), money(25500, 5100, 2000, 18400), money(26000, 4000, 2000, 20000),
])
export const correctionReasons = Object.freeze(['Fictional positive adjustment', 'Fictional downward adjustment', 'Fictional benefits-only adjustment', 'Manual fictional withholding choice'])
export const correctionRaw = Object.freeze([['270.00', '54.00', '25.00'], ['255.00', '51.00', '25.00'], ['255.00', '51.00', '20.00'], ['260.00', '40.00', '20.00']])
export const closureA = Object.freeze({ id: 'payroll-control-0001', sequence: 1, actor: { role: 'employer-owner' }, recordedOn: date, reason: 'Freeze first October sample period', kind: 'period-closed', period, receiptIds: ['MOCK-PAYROLL-0002'] })
export const correctionsA = Object.freeze([
  { id: 'payroll-control-0002', sequence: 2, actor: { role: 'employer-owner' }, recordedOn: date, reason: correctionReasons[0], kind: 'receipt-adjusted', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0002', originalReceipt: 'MOCK-PAYROLL-0002', employeeId: avery, previousAdjustmentId: null, previous: originalMoneyA, proposed: correctedMoney[0], delta: money(3000, 600, 0, 2400) },
  { id: 'payroll-control-0003', sequence: 3, actor: { role: 'employer-owner' }, recordedOn: date, reason: correctionReasons[1], kind: 'receipt-adjusted', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0003', originalReceipt: 'MOCK-PAYROLL-0002', employeeId: avery, previousAdjustmentId: 'payroll-control-0002', previous: correctedMoney[0], proposed: correctedMoney[1], delta: money(-1500, -300, 0, -1200) },
  { id: 'payroll-control-0004', sequence: 4, actor: { role: 'employer-owner' }, recordedOn: date, reason: correctionReasons[2], kind: 'receipt-adjusted', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0004', originalReceipt: 'MOCK-PAYROLL-0002', employeeId: avery, previousAdjustmentId: 'payroll-control-0003', previous: correctedMoney[1], proposed: correctedMoney[2], delta: money(0, 0, -500, 500) },
  { id: 'payroll-control-0005', sequence: 5, actor: { role: 'employer-owner' }, recordedOn: date, reason: correctionReasons[3], kind: 'receipt-adjusted', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0005', originalReceipt: 'MOCK-PAYROLL-0002', employeeId: avery, previousAdjustmentId: 'payroll-control-0004', previous: correctedMoney[2], proposed: correctedMoney[3], delta: money(500, -1100, 0, 1600) },
])
export const openCorrection = Object.freeze({ ...copy(correctionsA[0]), id: 'payroll-control-0001', sequence: 1, adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0001' })
export const correctionsM = Object.freeze([
  { id: 'payroll-control-0001', sequence: 1, actor: { role: 'employer-owner' }, recordedOn: date, reason: 'Avery-only correction witness', kind: 'receipt-adjusted', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0001', originalReceipt: 'MOCK-PAYROLL-0003', employeeId: avery, previousAdjustmentId: null, previous: money(24000, 4800, 2500, 16700), proposed: money(27000, 5000, 2000, 20000), delta: money(3000, 200, -500, 3300) },
  { id: 'payroll-control-0002', sequence: 2, actor: { role: 'employer-owner' }, recordedOn: date, reason: 'Jordan-only correction witness', kind: 'receipt-adjusted', adjustmentReceipt: 'MOCK-PAYROLL-ADJUSTMENT-0002', originalReceipt: 'MOCK-PAYROLL-0003', employeeId: jordan, previousAdjustmentId: null, previous: money(24000, 4800, 0, 19200), proposed: money(26000, 3000, 0, 23000), delta: money(2000, -1800, 0, 3800) },
])

function submitted(workspaces, original) {
  workspaces.hr.workflow.payroll = copy(original); workspaces.hr.workflow.payrollHistory = [copy(original)]
  return workspaces
}
/** These expected changes describe known native UI actions; absence remains
 * absence, and none of the helpers rewrites a named browser fixture. */
export function fixtureA(seed, { unresolvedJordan = false } = {}) {
  const expected = copy(seed), workflow = expected.hr.workflow
  expected.hr.selectedEmployee = avery
  workflow.timeEntries = [{ id: 'time-001', employeeId: avery, date: '2026-10-09', hours: 8, status: 'approved', source: 'fixture', payrollReceipt: 'MOCK-PAYROLL-0002' }, ...(unresolvedJordan ? [{ id: 'time-002', employeeId: jordan, date: '2026-10-09', hours: 6, status: 'draft', source: 'fixture' }] : [])]
  workflow.benefitElections = [{ employeeId: avery, planId: 'benefit-001', election: 'enroll', stage: 'confirmed', receipt: 'MOCK-BENEFIT-0001' }]
  workflow.sampleRates = { [avery]: [{ effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }] }; workflow.sequence = 3
  return submitted(expected, originalA)
}
export function fixtureF(seed) {
  const expected = copy(seed), workflow = expected.hr.workflow
  expected.hr.selectedEmployee = avery
  workflow.timeEntries = [
    { id: 'time-001', employeeId: avery, date: '2026-10-09', hours: 0.125, status: 'approved', source: 'fixture', returnReason: 'Fractional fixture review', returnedBy: 'employee-001', payrollReceipt: 'MOCK-PAYROLL-0002' },
    { id: 'MOCK-TIME-0001', employeeId: avery, date: '2026-10-10', hours: 0.125, status: 'approved', source: 'manual', payrollReceipt: 'MOCK-PAYROLL-0002' },
  ]; workflow.sampleRates = { [avery]: [{ effectiveFrom: '2026-10-01', hourlyRateCents: 3004 }] }; workflow.sequence = 3
  return submitted(expected, originalF)
}
export function fixtureM(seed) {
  const expected = copy(seed), workflow = expected.hr.workflow
  expected.hr.selectedEmployee = avery
  workflow.onboarding[jordan] = { profileReviewed: true, jobReviewed: true, tasks: { profile: true }, stage: 'complete', receipt: 'MOCK-ONBOARDING-0001' }; workflow.employeeStatuses[jordan] = 'active'
  workflow.timeEntries = [
    { id: 'time-001', employeeId: avery, date: '2026-10-09', hours: 8, status: 'approved', source: 'fixture', payrollReceipt: 'MOCK-PAYROLL-0003' },
    { id: 'time-002', employeeId: jordan, date: '2026-10-09', hours: 6, status: 'approved', source: 'fixture', payrollReceipt: 'MOCK-PAYROLL-0003' },
  ]; workflow.benefitElections = [{ employeeId: avery, planId: 'benefit-001', election: 'enroll', stage: 'confirmed', receipt: 'MOCK-BENEFIT-0002' }]
  workflow.sampleRates = { [avery]: [{ effectiveFrom: '2026-10-01', hourlyRateCents: 3000 }], [jordan]: [{ effectiveFrom: '2026-10-01', hourlyRateCents: 4000 }] }; workflow.sequence = 4
  return submitted(expected, originalM)
}
function control(expected, anchors, events, sequence) { expected.hr.workflow.payrollControl = { schemaVersion: 1, sequence, anchors: copy(anchors), events: copy(events) }; return expected }
export function closedA(expected) { return control(expected, [{ receipt: 'MOCK-PAYROLL-0002', snapshot: originalA }], [closureA], 2) }
export function correctedA(expected, count = 4) {
  if (![1, 2, 3, 4].includes(count)) throw new Error('Expected fixture accepts only its four literal correction stages')
  return control(expected, [{ receipt: 'MOCK-PAYROLL-0002', snapshot: originalA }], [closureA, ...correctionsA.slice(0, count)], [0, 3, 4, 5, 6][count])
}
export function correctedOpenA(expected, recordedOn = date) {
  return control(expected, [{ receipt: 'MOCK-PAYROLL-0002', snapshot: expected.hr.workflow.payrollHistory[0] }], [{ ...copy(openCorrection), recordedOn }], 2)
}
export function correctedM(expected, count = 2) {
  if (![1, 2].includes(count)) throw new Error('Expected M fixture accepts only its two literal corrections')
  return control(expected, [{ receipt: 'MOCK-PAYROLL-0003', snapshot: originalM }], correctionsM.slice(0, count), count === 1 ? 2 : 3)
}
export function correctedF(expected) {
  return control(expected, [{ receipt: 'MOCK-PAYROLL-0002', snapshot: originalF }], [
    { ...copy(closureA), reason: 'Freeze fractional sample period' },
    { ...copy(correctionsA[0]), reason: 'Fractional manual correction', previous: money(751, 150, 0, 601), proposed: money(1000, 100, 0, 900), delta: money(249, -50, 0, 299) },
  ], 3)
}
export function periodlessA(seed, { unknownWorkDate = false, receipt = 'MOCK-PAYROLL-0002' } = {}) {
  const expected = fixtureA(seed), workflow = expected.hr.workflow
  for (const original of [workflow.payroll, workflow.payrollHistory[0]]) {
    delete original.period; delete original.inputs[0].date; delete original.inputs[0].rateEffectiveFrom; original.receipt = receipt
  }
  workflow.timeEntries[0].payrollReceipt = receipt
  if (unknownWorkDate) workflow.timeEntries[0].date = 'legacy-work-date-unknown'
  return expected
}
export function futureRate(expected) {
  expected.hr.workflow.sampleRates[avery].push({ effectiveFrom: '2026-11-01', hourlyRateCents: 3500 }); return expected
}
export function lateTime(expected, { stage = 'approved', workDate = '2026-10-16', hours = 1 } = {}) {
  expected.hr.workflow.timeEntries.push({ id: 'MOCK-TIME-0003', employeeId: avery, date: workDate, hours, source: 'manual', status: stage }); expected.hr.workflow.sequence = 4
  return expected
}
export function pendingWider(expected) {
  lateTime(expected)
  expected.hr.workflow.payroll = { period: { start: '2026-10-01', end: '2026-10-16' }, stage: 'prepared', inputs: [{ entryId: 'MOCK-TIME-0003', employeeId: avery, date: '2026-10-16', hours: 1, rateCents: 3000, rateEffectiveFrom: '2026-10-01' }], benefitInputs: [{ employeeId: avery, planId: 'benefit-001', deductionCents: 2500 }], employeeTotals: [], hours: 1, grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: 0 }
  return expected
}
export function secondReceipt(expected, { samePeriod = false, receipt = 'MOCK-PAYROLL-0004', periodless = false } = {}) {
  const workflow = expected.hr.workflow, workDate = samePeriod ? '2026-10-10' : '2026-10-16'
  lateTime(expected, { workDate, hours: 2 }); workflow.timeEntries.at(-1).payrollReceipt = receipt
  const second = { stage: 'submitted', period: samePeriod ? copy(period) : { start: '2026-10-10', end: '2026-10-20' }, inputs: [{ entryId: 'MOCK-TIME-0003', employeeId: avery, date: workDate, hours: 2, rateCents: 3000, rateEffectiveFrom: '2026-10-01' }], benefitInputs: [{ employeeId: avery, planId: 'benefit-001', deductionCents: 2500 }], employeeTotals: [{ employeeId: avery, hours: 2, grossCents: 6000, illustrativeWithholdingCents: 1200, benefitDeductionCents: 2500, netCents: 2300 }], hours: 2, grossCents: 6000, illustrativeWithholdingCents: 1200, benefitDeductionCents: 2500, netCents: 2300, receipt }
  if (periodless) { delete second.period; delete second.inputs[0].date; delete second.inputs[0].rateEffectiveFrom }
  workflow.payroll = copy(second); workflow.payrollHistory.push(copy(second)); workflow.sequence = 5
  return expected
}
export function closedTwoExact(expected) {
  return control(expected, [{ receipt: 'MOCK-PAYROLL-0002', snapshot: originalA }, { receipt: 'MOCK-PAYROLL-0004', snapshot: expected.hr.workflow.payrollHistory[1] }], [{ ...copy(closureA), receiptIds: ['MOCK-PAYROLL-0002', 'MOCK-PAYROLL-0004'] }], 2)
}
