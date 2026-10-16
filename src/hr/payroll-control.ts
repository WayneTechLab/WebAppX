import type { HrActor, HrFixture } from './model'
import { validateTimeEntry } from './model'
import type { MockHrState, MockPayroll, MockPayrollEmployeeTotal, MockSamplePeriod } from './mock-workflows'
import type { HrDemoState } from './persistence'
import type { MockPayrollControlV1, PayrollAdjusted, PayrollControlCommand, PayrollControlEvent, PayrollControlPreview, PayrollControlServices, PayrollControlView, PayrollMoney, PayrollPeriodClosed, PayrollWriter } from './payroll-control-types'
import { canonicalPayrollJson, copyPayroll, payrollAssert as assert, payrollDate, payrollId, payrollInteger, payrollKeys, payrollPeriod, payrollReason } from './payroll-control-value'

type Workflow = MockHrState & { payrollControl?: MockPayrollControlV1 }
const moneyKeys = ['grossCents', 'illustrativeWithholdingCents', 'benefitDeductionCents', 'netCents'] as const
const equal = (left: unknown, right: unknown) => canonicalPayrollJson(left) === canonicalPayrollJson(right)
const overlaps = (left: MockSamplePeriod, right: MockSamplePeriod) => left.start <= right.end && right.start <= left.end
const samePeriod = (left: MockSamplePeriod, right: MockSamplePeriod) => left.start === right.start && left.end === right.end
const inside = (date: string, period: MockSamplePeriod) => date >= period.start && date <= period.end
const knownEmployees = (state: HrDemoState, raw: HrFixture) => new Set([...raw.employees, ...state.recruiting.hiredEmployees].map(employee => employee.id))
const canonicalReceipt = (receipt: string) => {
  const match = /^MOCK-PAYROLL-(\d{4,})$/.exec(receipt)
  if (!match) return false
  const value = Number(match[1])
  return Number.isSafeInteger(value) && value > 0 && receipt === `MOCK-PAYROLL-${String(value).padStart(4, '0')}`
}
function money(value: PayrollMoney): PayrollMoney { return { grossCents: value.grossCents, illustrativeWithholdingCents: value.illustrativeWithholdingCents, benefitDeductionCents: value.benefitDeductionCents, netCents: value.netCents } }
function checkMoney(value: unknown, signed = false, cap = Number.MAX_SAFE_INTEGER): asserts value is PayrollMoney {
  payrollKeys(value, moneyKeys)
  for (const key of moneyKeys) payrollInteger(value[key], signed ? -Number.MAX_SAFE_INTEGER : 0, cap)
  const checked = value as PayrollMoney
  assert(checked.netCents === checked.grossCents - checked.illustrativeWithholdingCents - checked.benefitDeductionCents)
}
function sumSafe(left: number, right: number): number { const result = left + right; payrollInteger(result); return result }
function assertNativeWriterShape(actor: HrActor): asserts actor is PayrollWriter {
  payrollKeys(actor, ['role'], ['employeeId'])
  assert(actor.role === 'employer-owner' || actor.role === 'payroll-admin', 'This sample payroll action is unavailable.')
  if (Object.hasOwn(actor, 'employeeId')) payrollId(actor.employeeId)
}
/** Role/shape authorization happens before looking up a receipt or exposing its existence. */
export function authorizePayrollControlActor(actor: HrActor): void { assertNativeWriterShape(actor) }
function writer(actor: HrActor, state: HrDemoState, raw: HrFixture): PayrollWriter {
  assertNativeWriterShape(actor)
  assert(!actor.employeeId || knownEmployees(state, raw).has(actor.employeeId), 'This sample payroll action is unavailable.')
  return copyPayroll(actor)
}
function assertInputOwnership(workflow: MockHrState) {
  const seen = new Set<string>()
  for (const history of workflow.payrollHistory) for (const input of history.inputs) {
    payrollId(input.entryId); assert(!seen.has(input.entryId), 'Submitted time is linked to more than one original receipt.'); seen.add(input.entryId)
  }
}
function assertSubmittedPointer(workflow: MockHrState) {
  if (workflow.payroll.stage !== 'submitted') return
  const matches = workflow.payrollHistory.filter(snapshot => snapshot.receipt === workflow.payroll.receipt)
  assert(typeof workflow.payroll.receipt === 'string' && matches.length === 1 && equal(workflow.payroll, matches[0]), 'The submitted pointer must agree with exactly one complete original history record.')
}
/** Qualification preserves complete native snapshots, including plain historical metadata and omissions. */
export function qualifyPayrollReceipt(state: HrDemoState, receipt: string, raw: HrFixture): MockPayroll {
  canonicalPayrollJson({ schemaVersion: 1, module: 'hr', data: state }); canonicalPayrollJson(raw)
  payrollId(receipt); assert(canonicalReceipt(receipt), 'This historical receipt is readable but cannot activate payroll controls.')
  const workflow = state.workflow, matches = workflow.payrollHistory.filter(item => item.receipt === receipt)
  assertSubmittedPointer(workflow)
  assert(matches.length === 1, 'Choose one uniquely recorded submitted original receipt.')
  const snapshot = matches[0], employees = knownEmployees(state, raw)
  assert(snapshot.stage === 'submitted' && snapshot.inputs.length > 0 && snapshot.inputs.length <= 10_000)
  if (Object.hasOwn(snapshot, 'period')) payrollPeriod(snapshot.period)
  const totals = new Map<string, MockPayrollEmployeeTotal>(), inputIds = new Set<string>(), participants = new Map<string, { hours: number; unrounded: number }>()
  let hours = 0
  for (const input of snapshot.inputs) {
    payrollId(input.entryId); payrollId(input.employeeId)
    assert(employees.has(input.employeeId) && !inputIds.has(input.entryId)); inputIds.add(input.entryId)
    assert(typeof input.hours === 'number' && !Object.is(input.hours, -0) && Number.isFinite(input.hours) && input.hours > 0 && input.hours <= 24)
    payrollInteger(input.rateCents, 1)
    const entries = workflow.timeEntries.filter(entry => entry.id === input.entryId)
    assert(entries.length === 1, 'An original receipt has an unavailable consumed time link.')
    const entry = entries[0]
    assert(entry.status === 'approved' && entry.payrollReceipt === receipt && entry.employeeId === input.employeeId && entry.hours === input.hours, 'An original receipt has a changed consumed time link.')
    payrollDate(entry.date)
    if (Object.hasOwn(input, 'date')) { payrollDate(input.date); assert(input.date === entry.date) }
    if (Object.hasOwn(input, 'rateEffectiveFrom')) { payrollDate(input.rateEffectiveFrom); assert(input.rateEffectiveFrom <= (input.date ?? entry.date)) }
    if (snapshot.period) assert(inside(entry.date, snapshot.period) && (!input.date || inside(input.date, snapshot.period)))
    const previous = participants.get(input.employeeId) ?? { hours: 0, unrounded: 0 }
    const product = input.hours * input.rateCents, unrounded = previous.unrounded + product
    assert(Number.isFinite(product) && product >= 0 && product <= Number.MAX_SAFE_INTEGER && Number.isFinite(unrounded) && unrounded >= 0 && unrounded <= Number.MAX_SAFE_INTEGER)
    const nextHours = previous.hours + input.hours; hours += input.hours
    assert(Number.isFinite(nextHours) && Number.isFinite(hours)); participants.set(input.employeeId, { hours: nextHours, unrounded })
  }
  assert(snapshot.employeeTotals.length === participants.size)
  for (const total of snapshot.employeeTotals) {
    payrollId(total.employeeId); assert(!totals.has(total.employeeId) && participants.has(total.employeeId)); totals.set(total.employeeId, total)
    checkMoney(money(total)); const inputs = participants.get(total.employeeId)!
    payrollInteger(Math.round(inputs.unrounded)); assert(total.hours === inputs.hours && total.grossCents === Math.round(inputs.unrounded), 'Original totals do not reconcile with frozen inputs.')
  }
  assert(snapshot.hours === hours)
  const aggregate: PayrollMoney = { grossCents: 0, illustrativeWithholdingCents: 0, benefitDeductionCents: 0, netCents: 0 }
  for (const total of snapshot.employeeTotals) for (const key of moneyKeys) aggregate[key] = sumSafe(aggregate[key], total[key])
  checkMoney(money(snapshot)); assert(equal(aggregate, money(snapshot)))
  // Frozen benefit rows are observations, not a request to recalculate current elections.
  for (const input of snapshot.benefitInputs) { payrollId(input.employeeId); payrollId(input.planId); assert(participants.has(input.employeeId)); payrollInteger(input.deductionCents) }
  assertInputOwnership(workflow)
  for (const entry of workflow.timeEntries.filter(entry => entry.payrollReceipt === receipt)) assert(inputIds.has(entry.id), 'An original receipt has an orphan consumed time link.')
  return copyPayroll(snapshot)
}
/** Descriptor-only presence probe, including rejection of an accessor root workflow. */
export function payrollControlPresence(state: unknown): boolean {
  assert(state && typeof state === 'object' && !Array.isArray(state))
  const workflow = Object.getOwnPropertyDescriptor(state, 'workflow')
  assert(workflow && 'value' in workflow && workflow.value && typeof workflow.value === 'object' && !Array.isArray(workflow.value))
  const descriptor = Object.getOwnPropertyDescriptor(workflow.value, 'payrollControl')
  if (!descriptor) return false
  assert('value' in descriptor)
  return true
}
function closureReceipts(state: HrDemoState, period: MockSamplePeriod, raw: HrFixture): string[] {
  payrollPeriod(period)
  const workflow = state.workflow, receipts: string[] = []
  for (const snapshot of workflow.payrollHistory) {
    if (snapshot.period) {
      payrollPeriod(snapshot.period)
      if (samePeriod(snapshot.period, period)) { assert(typeof snapshot.receipt === 'string'); receipts.push(snapshot.receipt) }
      else assert(!overlaps(snapshot.period, period), 'A different submitted window overlaps this sample period.')
    } else {
      // Missing historical fields remain missing; known frozen facts cannot be
      // hidden by moving the current consumed record outside the closing window.
      const inputIds = new Set<string>(), dates: string[] = []
      for (const input of snapshot.inputs) {
        payrollId(input.entryId); assert(!inputIds.has(input.entryId)); inputIds.add(input.entryId)
        const entries = workflow.timeEntries.filter(entry => entry.id === input.entryId)
        assert(entries.length === 1, 'A periodless historical receipt has an unavailable consumed time link.')
        const entry = entries[0]
        assert(entry.status === 'approved' && entry.payrollReceipt === snapshot.receipt && entry.employeeId === input.employeeId && entry.hours === input.hours && validateTimeEntry(entry.date, entry.hours).valid, 'A periodless historical receipt has an unsupported consumed time link.')
        dates.push(entry.date)
        if (Object.hasOwn(input, 'date')) {
          payrollDate(input.date); assert(input.date === entry.date, 'A periodless historical receipt has conflicting frozen and current work dates.'); dates.push(input.date)
        }
        if (Object.hasOwn(input, 'rateEffectiveFrom')) { payrollDate(input.rateEffectiveFrom); assert(input.rateEffectiveFrom <= (input.date ?? entry.date)) }
      }
      for (const entry of workflow.timeEntries.filter(entry => entry.payrollReceipt === snapshot.receipt)) assert(inputIds.has(entry.id), 'A periodless historical receipt has an orphan consumed time link.')
      assert(!dates.some(date => inside(date, period)), 'A periodless historical receipt has known consumed time in this window; its period remains unknown.')
    }
  }
  assert(receipts.length >= 1 && receipts.length <= 100 && new Set(receipts).size === receipts.length, 'Choose a period already recorded on submitted original receipts.')
  for (const receipt of receipts) qualifyPayrollReceipt(state, receipt, raw)
  for (const entry of workflow.timeEntries) if (typeof entry.date === 'string' && validateTimeEntry(entry.date, 1).valid && inside(entry.date, period)) {
    assert(entry.status === 'approved' && typeof entry.payrollReceipt === 'string' && receipts.includes(entry.payrollReceipt), 'Every time entry in this company window must be approved and included in its exact-period receipts before closure.')
    const input = workflow.payrollHistory.filter(snapshot => receipts.includes(snapshot.receipt!)).flatMap(snapshot => snapshot.inputs).filter(input => input.entryId === entry.id)
    assert(input.length === 1 && input[0].employeeId === entry.employeeId && input[0].hours === entry.hours && (!input[0].date || input[0].date === entry.date))
  }
  return receipts
}
function eventReceiptStrings(state: HrDemoState, events: PayrollControlEvent[]): string[] {
  return [state.workflow.payroll.receipt, ...state.workflow.payrollHistory.map(item => item.receipt), ...events.flatMap(event => [event.id, ...(event.kind === 'receipt-adjusted' ? [event.adjustmentReceipt] : [])])].filter((value): value is string => typeof value === 'string')
}
function normalizedCommand(command: PayrollControlCommand): PayrollControlCommand {
  const kindDescriptor = command && typeof command === 'object' ? Object.getOwnPropertyDescriptor(command, 'kind') : undefined
  assert(kindDescriptor && 'value' in kindDescriptor)
  assert(kindDescriptor.value === 'close-period' || kindDescriptor.value === 'adjust-receipt')
  if (command.kind === 'close-period') {
    payrollKeys(command, ['kind', 'period', 'recordedOn', 'reason']); payrollPeriod(command.period)
  } else {
    assert(kindDescriptor.value === 'adjust-receipt')
    payrollKeys(command, ['kind', 'originalReceipt', 'employeeId', 'recordedOn', 'reason', 'proposed']); payrollId(command.originalReceipt); payrollId(command.employeeId)
    payrollKeys(command.proposed, ['grossCents', 'illustrativeWithholdingCents', 'benefitDeductionCents'])
    for (const value of Object.values(command.proposed)) payrollInteger(value, 0, 1_000_000_000_000)
  }
  payrollDate(command.recordedOn); payrollReason(command.reason)
  return copyPayroll(command)
}
function nextEvent(state: HrDemoState, control: MockPayrollControlV1, actor: PayrollWriter, command: PayrollControlCommand, raw: HrFixture): { event: PayrollControlEvent; references: string[] } {
  const sequence = control.sequence, id = `payroll-control-${String(sequence).padStart(4, '0')}`
  payrollInteger(sequence, 1, 250)
  assert(command.recordedOn >= (control.events.at(-1)?.recordedOn ?? command.recordedOn), 'Sample control dates must stay in recorded order.')
  const strings = eventReceiptStrings(state, control.events)
  assert(!strings.includes(id), 'A generated sample control identity already exists.')
  const base = { id, sequence, actor: copyPayroll(actor), recordedOn: command.recordedOn, reason: command.reason }
  if (command.kind === 'close-period') {
    assert(control.events.filter(event => event.kind === 'period-closed').length < 50, 'This sample workspace has reached its closure limit.')
    assert(command.recordedOn >= command.period.end, 'Record closure on or after the sample period end.')
    assert(!control.events.some(event => event.kind === 'period-closed' && overlaps(event.period, command.period)), 'This sample window is already closed or overlaps a closed window.')
    const receiptIds = closureReceipts(state, command.period, raw)
    return { event: { ...base, kind: 'period-closed', period: copyPayroll(command.period), receiptIds }, references: receiptIds }
  }
  assert(control.events.filter(event => event.kind === 'receipt-adjusted').length < 200, 'This sample workspace has reached its correction limit.')
  const snapshot = qualifyPayrollReceipt(state, command.originalReceipt, raw)
  if (snapshot.period) assert(command.recordedOn >= snapshot.period.end, 'Record a correction on or after the original sample period end.')
  const original = snapshot.employeeTotals.find(total => total.employeeId === command.employeeId)
  assert(original, 'Choose a participating employee from this original receipt.')
  const prior = control.events.filter((event): event is PayrollAdjusted => event.kind === 'receipt-adjusted' && event.originalReceipt === command.originalReceipt && event.employeeId === command.employeeId).at(-1)
  const previous = money(prior?.proposed ?? original), proposed = { ...command.proposed, netCents: command.proposed.grossCents - command.proposed.illustrativeWithholdingCents - command.proposed.benefitDeductionCents }
  checkMoney(proposed, false, 1_000_000_000_000)
  const delta = Object.fromEntries(moneyKeys.map(key => [key, proposed[key] - previous[key]])) as PayrollMoney
  checkMoney(delta, true); assert(moneyKeys.some(key => delta[key] !== 0), 'This target already matches the cumulative sample balance; no correction was created.')
  const adjustmentReceipt = `MOCK-PAYROLL-ADJUSTMENT-${String(sequence).padStart(4, '0')}`
  assert(!strings.includes(adjustmentReceipt), 'A generated sample adjustment receipt already exists.')
  return { event: { ...base, kind: 'receipt-adjusted', adjustmentReceipt, originalReceipt: command.originalReceipt, employeeId: command.employeeId, previousAdjustmentId: prior?.id ?? null, previous, proposed, delta }, references: [command.originalReceipt] }
}
function validateEventShape(event: PayrollControlEvent) {
  const common = ['kind', 'id', 'sequence', 'actor', 'recordedOn', 'reason']
  assert(event && typeof event === 'object')
  if (event.kind === 'period-closed') {
    payrollKeys(event, [...common, 'period', 'receiptIds']); payrollPeriod(event.period)
    assert(Array.isArray(event.receiptIds) && event.receiptIds.length >= 1 && event.receiptIds.length <= 100 && new Set(event.receiptIds).size === event.receiptIds.length)
    event.receiptIds.forEach(payrollId)
  } else {
    assert(event.kind === 'receipt-adjusted')
    payrollKeys(event, [...common, 'adjustmentReceipt', 'originalReceipt', 'employeeId', 'previousAdjustmentId', 'previous', 'proposed', 'delta'])
    payrollId(event.adjustmentReceipt); payrollId(event.originalReceipt); payrollId(event.employeeId)
    if (event.previousAdjustmentId !== null) payrollId(event.previousAdjustmentId)
    checkMoney(event.previous); checkMoney(event.proposed, false, 1_000_000_000_000); checkMoney(event.delta, true)
  }
  payrollId(event.id); payrollInteger(event.sequence, 1, 250); payrollDate(event.recordedOn); payrollReason(event.reason); assertNativeWriterShape(event.actor)
}
/** Complete present-arm replay. Legacy absence is not materialized or strengthened. */
export function assertValidPayrollControl(state: HrDemoState, raw: HrFixture): MockPayrollControlV1 | undefined {
  if (!payrollControlPresence(state)) return undefined
  canonicalPayrollJson({ schemaVersion: 1, module: 'hr', data: state })
  canonicalPayrollJson(raw)
  assertSubmittedPointer(state.workflow)
  const control = (state.workflow as Workflow).payrollControl
  payrollKeys(control, ['schemaVersion', 'sequence', 'anchors', 'events']); assert(control.schemaVersion === 1)
  assert(Array.isArray(control.anchors) && control.anchors.length >= 1 && control.anchors.length <= 100 && Array.isArray(control.events) && control.events.length >= 1 && control.events.length <= 250)
  payrollInteger(control.sequence, 2, 251); assert(control.sequence === control.events.length + 1)
  const replay: MockPayrollControlV1 = { schemaVersion: 1, sequence: 1, anchors: [], events: [] }, expectedReferences: string[] = []
  for (const event of control.events) {
    validateEventShape(event)
    const actor = writer(event.actor, state, raw)
    const command: PayrollControlCommand = event.kind === 'period-closed'
      ? { kind: 'close-period', period: event.period, recordedOn: event.recordedOn, reason: event.reason }
      : { kind: 'adjust-receipt', originalReceipt: event.originalReceipt, employeeId: event.employeeId, recordedOn: event.recordedOn, reason: event.reason, proposed: { grossCents: event.proposed.grossCents, illustrativeWithholdingCents: event.proposed.illustrativeWithholdingCents, benefitDeductionCents: event.proposed.benefitDeductionCents } }
    const expected = nextEvent(state, replay, actor, command, raw)
    assert(equal(event, expected.event), 'The sample payroll event stream does not replay exactly.')
    for (const receipt of expected.references) if (!expectedReferences.includes(receipt)) expectedReferences.push(receipt)
    replay.events.push(expected.event); replay.sequence++
  }
  assert(control.anchors.length === expectedReferences.length)
  for (let index = 0; index < control.anchors.length; index++) {
    const anchor = control.anchors[index]
    payrollKeys(anchor, ['receipt', 'snapshot']); payrollId(anchor.receipt)
    assert(anchor.receipt === expectedReferences[index] && equal(anchor.snapshot, qualifyPayrollReceipt(state, anchor.receipt, raw)), 'An original receipt anchor changed or is out of first-use order.')
  }
  return control as MockPayrollControlV1
}
export function payrollControlClosedDateReason(workflow: MockHrState, date: string): string | null {
  const closure = (workflow as Workflow).payrollControl?.events.find((event): event is PayrollPeriodClosed => event.kind === 'period-closed' && inside(date, event.period))
  return closure ? `The company sample window ${closure.period.start} to ${closure.period.end} is closed. Its frozen receipts and time cannot change.` : null
}
export function payrollControlClosedPeriodReason(workflow: MockHrState, period: MockSamplePeriod): string | null {
  const closure = (workflow as Workflow).payrollControl?.events.find((event): event is PayrollPeriodClosed => event.kind === 'period-closed' && overlaps(period, event.period))
  return closure ? `The selected sample period overlaps the closed company window ${closure.period.start} to ${closure.period.end}. Choose a nonoverlapping open period.` : null
}
export function buildPayrollControlCandidate(state: HrDemoState, actor: HrActor, input: PayrollControlCommand, raw: HrFixture, services: PayrollControlServices): { next: HrDemoState; preview: PayrollControlPreview } {
  authorizePayrollControlActor(actor)
  canonicalPayrollJson({ schemaVersion: 1, module: 'hr', data: state }); canonicalPayrollJson(raw)
  const capturedActor = writer(actor, state, raw), command = normalizedCommand(input)
  assert(services.validateCandidate(state, raw), 'The sample HR workspace is invalid; no control change was accepted.')
  assertSubmittedPointer(state.workflow)
  canonicalPayrollJson({ schemaVersion: 1, module: 'hr', data: state })
  const existing = assertValidPayrollControl(state, raw), control = copyPayroll(existing ?? { schemaVersion: 1 as const, sequence: 1, anchors: [], events: [] })
  const { event, references } = nextEvent(state, control, capturedActor, command, raw)
  for (const receipt of references) if (!control.anchors.some(anchor => anchor.receipt === receipt)) { assert(control.anchors.length < 100, 'This sample workspace has reached its original receipt limit.'); control.anchors.push({ receipt, snapshot: qualifyPayrollReceipt(state, receipt, raw) }) }
  control.events.push(event); control.sequence++
  const next = copyPayroll(state); (next.workflow as Workflow).payrollControl = control
  assertValidPayrollControl(next, raw); assert(services.validateCandidate(next, raw), 'The proposed HR workspace is invalid; no control change was accepted.')
  let preview: PayrollControlPreview
  if (event.kind === 'period-closed') preview = { kind: 'close-period', period: copyPayroll(event.period), receiptIds: [...event.receiptIds], entryCount: state.workflow.timeEntries.filter(entry => inside(entry.date, event.period)).length, pendingPayrollBecomesStale: ['prepared', 'calculated', 'reviewed'].includes(state.workflow.payroll.stage) && Boolean(state.workflow.payroll.period && overlaps(state.workflow.payroll.period, event.period)), recordedOn: event.recordedOn, reason: event.reason, effect: 'Close this company-wide sample date window. New and changed time and overlapping ordinary payroll preparation will be refused; submitted history stays unchanged.' }
  else {
    const original = qualifyPayrollReceipt(state, event.originalReceipt, raw)
    preview = { kind: 'adjust-receipt', originalReceipt: event.originalReceipt, employeeId: event.employeeId, period: original.period ? copyPayroll(original.period) : null, previousAdjustmentId: event.previousAdjustmentId, original: money(original.employeeTotals.find(total => total.employeeId === event.employeeId)!), previous: copyPayroll(event.previous), proposed: copyPayroll(event.proposed), delta: copyPayroll(event.delta), recordedOn: event.recordedOn, reason: event.reason, effect: 'Record a separate fictional monetary adjustment linked to this original receipt. Original hours, rates, consumed time and submitted history stay unchanged.' }
  }
  return { next, preview }
}
export function projectPayrollControlView(state: HrDemoState, actor: HrActor, raw: HrFixture): PayrollControlView {
  // Authorize the allowed role and compact shape before validating or looking up targets.
  payrollKeys(actor, ['role'], ['employeeId'])
  assert(['employer-owner', 'payroll-admin', 'employee', 'auditor'].includes(actor.role), 'This sample payroll view is unavailable.')
  if (Object.hasOwn(actor, 'employeeId')) payrollId(actor.employeeId)
  canonicalPayrollJson({ schemaVersion: 1, module: 'hr', data: state }); canonicalPayrollJson(raw)
  const employees = knownEmployees(state, raw)
  assert(!actor.employeeId || employees.has(actor.employeeId), 'This sample payroll view is unavailable.')
  if (actor.role === 'employee') assert(actor.employeeId, 'This sample payroll view is unavailable.')
  const control = assertValidPayrollControl(state, raw)
  const closures = (control?.events ?? []).filter((event): event is PayrollPeriodClosed => event.kind === 'period-closed').map(event => ({ id: event.id, period: copyPayroll(event.period), receiptIds: [...event.receiptIds], recordedOn: event.recordedOn }))
  const events = (control?.events ?? []).filter((event): event is PayrollAdjusted => event.kind === 'receipt-adjusted')
  if (actor.role === 'auditor') return { mode: 'auditor', closures, adjustments: events.map(event => ({ id: event.id, adjustmentReceipt: event.adjustmentReceipt, originalReceipt: event.originalReceipt, employeeId: event.employeeId, recordedOn: event.recordedOn })), anchorCount: control?.anchors.length ?? 0, eventCount: control?.events.length ?? 0 }
  const adjustments = events.filter(event => actor.role !== 'employee' || event.employeeId === actor.employeeId).map(event => {
    const original = control!.anchors.find(anchor => anchor.receipt === event.originalReceipt)!.snapshot.employeeTotals.find(total => total.employeeId === event.employeeId)!
    return { id: event.id, adjustmentReceipt: event.adjustmentReceipt, originalReceipt: event.originalReceipt, employeeId: event.employeeId, recordedOn: event.recordedOn, previousAdjustmentId: event.previousAdjustmentId, original: money(original), previous: copyPayroll(event.previous), proposed: copyPayroll(event.proposed), delta: copyPayroll(event.delta), reason: event.reason }
  })
  if (actor.role === 'employee') return { mode: 'own', employeeId: actor.employeeId!, adjustments }
  writer(actor, state, raw)
  const receipts: Extract<PayrollControlView, { mode: 'writer' }>['receipts'] = []
  for (const snapshot of state.workflow.payrollHistory) {
    try {
      const qualified = qualifyPayrollReceipt(state, snapshot.receipt!, raw)
      receipts.push({ receipt: qualified.receipt!, period: qualified.period ? copyPayroll(qualified.period) : null, employees: qualified.employeeTotals.map(total => ({ employeeId: total.employeeId, original: money(total), cumulative: copyPayroll(events.filter(event => event.originalReceipt === qualified.receipt && event.employeeId === total.employeeId).at(-1)?.proposed ?? money(total)) })) })
    } catch { /* Unsupported legacy receipts stay in the ordinary statement path, not actionable choices. */ }
  }
  return { mode: 'writer', closures, adjustments, receipts }
}
