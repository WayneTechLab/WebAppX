import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import ts from 'typescript'

const root = fileURLToPath(new URL('../../', import.meta.url))
const urls = new Map()
async function load(name) {
  name = posix.normalize(name)
  if (urls.has(name)) return import(urls.get(name))
  const path = resolve(root, 'src', name + '.ts')
  let code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  code = code.replace(/import (\w+) from ['"]([^'"]+\.json)['"];?/g, (_, variable, file) => `const ${variable} = ${readFileSync(resolve(dirname(path), file), 'utf8')};`)
  for (const match of code.matchAll(/from ['"](\.[^'"]+)['"]/g)) await load(posix.join(posix.dirname(name), match[1]))
  code = code.replace(/from ['"](\.[^'"]+)['"]/g, (_, file) => `from '${urls.get(posix.normalize(posix.join(posix.dirname(name), file)))}'`)
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  urls.set(name, url)
  return import(url)
}
const model = await load('hr/mock-workflows')
const persistence = await load('hr/persistence')
const single = await load('portals/backup')
const combined = await load('portals/combined-backup')
const points = await load('portals/restore-points')
const fixture = JSON.parse(readFileSync(resolve(root, '.SYSTEMX/GUSTO/mock/fixtures/demo-company.json'), 'utf8'))
const seed = JSON.parse(readFileSync(resolve(root, 'tests/browser/fixtures/portal-smoke-v1.json'), 'utf8')).workspaces
const owner = { role: 'employer-owner' }, manager = { role: 'manager', employeeId: 'employee-001' }
const period = { start: '2026-10-01', end: '2026-10-15' }
const change = (state, event, actor = owner) => model.transitionMockHr(state, actor, event, fixture)
const rate = (state, employeeId = 'employee-002', hourlyRateCents = 2500, effectiveFrom = '2026-10-01') => change(state, { type: 'set-sample-rate', employeeId, hourlyRateCents, effectiveFrom })
function ready() { return rate(change(model.createMockHrState(fixture), { type: 'approve-time', entryId: 'time-001' }, manager)) }
const prepare = state => change(state, { type: 'prepare-payroll', period })
function complete(state) {
  state = prepare(state)
  for (const type of ['calculate-payroll', 'review-payroll', 'submit-payroll']) state = change(state, { type })
  return state
}

test('initial and named legacy saves remain exact and require no inferred rate migration', () => {
  assert.deepEqual(persistence.createHrDemoState(fixture), seed.hr)
  assert.equal(persistence.isHrDemoState(structuredClone(seed.hr), fixture), true)
  assert.equal(Object.hasOwn(model.createMockHrState(fixture), 'sampleRates'), false)
  assert.equal(model.sampleRateFor(model.createMockHrState(fixture), 'employee-002', '2026-10-09'), undefined)
})

test('preparation requires an explicit valid chosen period rather than the legacy fixed default', () => {
  const state = ready()
  for (const value of [undefined, null, {}, { start: '2026-02-30', end: '2026-03-02' }, { start: '2026-10-15', end: '2026-10-01' }, { start: '2026-01-01', end: '2027-01-02' }]) {
    assert.throws(() => change(state, { type: 'prepare-payroll', period: value }), /valid sample payroll period/)
  }
  assert.deepEqual(prepare(state).payroll.period, { start: '2026-10-01', end: '2026-10-15' })
  assert.equal(model.validMockPeriod({ start: '2028-02-29', end: '2028-02-29' }), true)
})

test('every otherwise eligible employee needs an explicit rate and old compensation never supplies it', () => {
  const state = change(model.createMockHrState(fixture), { type: 'approve-time', entryId: 'time-001' }, manager)
  assert.throws(() => prepare(state), /explicit fictional hourly rate.*employee-002/)
  assert.equal(model.payrollEligibility(state, fixture, period)[0].baseEligible, true)
  assert.equal(model.payrollEligibility(state, fixture, period)[0].included, false)
  assert.match(model.payrollEligibility(state, fixture, period)[0].reasons.join(), /No explicit fictional hourly rate/)
  assert.equal(fixture.employees.find(employee => employee.id === 'employee-002').payCents, 6800000)
})

test('chosen periods exclude draft, inactive, paid and outside dates with an explanation for every row', () => {
  const state = ready()
  state.timeEntries.push({ id: 'outside', employeeId: 'employee-002', date: '2026-10-16', hours: 2, status: 'approved', source: 'manual' })
  state.timeEntries.push({ id: 'paid', employeeId: 'employee-002', date: '2026-10-10', hours: 1, status: 'approved', source: 'manual', payrollReceipt: 'OLD-RECEIPT' })
  const rows = model.payrollEligibility(state, fixture, period)
  assert.equal(rows.length, 4)
  assert.deepEqual(rows.map(row => [row.entryId, row.included]), [['time-001', true], ['time-002', false], ['outside', false], ['paid', false]])
  assert.match(rows[1].reasons.join(), /draft.*not active/)
  assert.match(rows[2].reasons.join(), /outside/)
  assert.match(rows[3].reasons.join(), /Already consumed/)
  assert.deepEqual(prepare(state).payroll.inputs, [{ entryId: 'time-001', employeeId: 'employee-002', date: '2026-10-09', hours: 8, rateCents: 2500, rateEffectiveFrom: '2026-10-01' }])
})

test('per-employee effective rates freeze beside hours and reconcile independent totals', () => {
  const state = rate(ready(), 'employee-001', 4000)
  state.timeEntries.push({ id: 'manager-approved', employeeId: 'employee-001', date: '2026-10-10', hours: 2, status: 'approved', source: 'manual' })
  const result = complete(state)
  assert.deepEqual(result.payroll.inputs.map(input => [input.employeeId, input.hours, input.rateCents]), [['employee-002', 8, 2500], ['employee-001', 2, 4000]])
  assert.equal(result.payroll.grossCents, 28000)
  assert.equal(result.payroll.illustrativeWithholdingCents, 5600)
  assert.equal(result.payroll.netCents, 22400)
  assert.equal(result.payroll.receipt, 'MOCK-PAYROLL-0001')
})

test('effective-dated rate changes choose the work-date rate and preserve submitted receipts exactly', () => {
  let state = complete(ready())
  const receipt = structuredClone(state.payrollHistory[0])
  state = rate(state, 'employee-002', 3500, '2026-11-01')
  assert.deepEqual(state.payrollHistory[0], receipt)
  assert.deepEqual(state.payroll, receipt)
  assert.equal(model.sampleRateFor(state, 'employee-002', '2026-10-31').hourlyRateCents, 2500)
  assert.equal(model.sampleRateFor(state, 'employee-002', '2026-11-01').hourlyRateCents, 3500)
  assert.throws(() => rate(state, 'employee-002', 3000, '2026-10-15'), /later effective date/)
})

test('rate timeline validates role, identity, actual date, whole positive cents and safe bounds', () => {
  const state = ready()
  for (const value of [0, -1, 1.5, '2500', NaN, Infinity, 1000001]) assert.throws(() => rate(state, 'employee-001', value), /explicit fictional hourly rate/)
  assert.throws(() => rate(state, 'foreign'), /known fictional employee/)
  assert.throws(() => rate(state, 'employee-001', 2500, '2026-02-29'), /valid sample rate effective date/)
  assert.throws(() => change(state, { type: 'set-sample-rate', employeeId: 'employee-002', effectiveFrom: '2026-11-01', hourlyRateCents: 3500 }, manager), /Only the employer/)
})

test('newly approved hours mark preparation stale and block every next stage until intentional reprepare', () => {
  let state = prepare(ready())
  const frozen = structuredClone(state.payroll)
  state.timeEntries.push({ id: 'new-approved', employeeId: 'employee-002', date: '2026-10-14', hours: 1.25, status: 'approved', source: 'manual' })
  assert.deepEqual(state.payroll, frozen)
  assert.equal(model.payrollFreshness(state, fixture).stale, true)
  assert.throws(() => change(state, { type: 'calculate-payroll' }), /stale/)
  for (const [stage, type] of [['calculated', 'review-payroll'], ['reviewed', 'submit-payroll']]) {
    const forgedStage = structuredClone(state); forgedStage.payroll.stage = stage
    assert.throws(() => change(forgedStage, { type }), /stale/)
  }
  state = complete(state)
  assert.equal(state.payroll.hours, 9.25)
  assert.equal(state.payroll.grossCents, 23125)
  assert.equal(state.payroll.illustrativeWithholdingCents, 4625)
  assert.equal(state.payroll.netCents, 18500)
})

test('in-period rate and eligible status changes stale preparation while unrelated future rates do not', () => {
  const state = prepare(ready())
  assert.equal(model.payrollFreshness(rate(state, 'employee-002', 3500, '2026-11-01'), fixture).stale, false)
  assert.equal(model.payrollFreshness(rate(state, 'employee-002', 3500, '2026-10-05'), fixture).stale, true)
  const inactive = structuredClone(state); inactive.employeeStatuses['employee-002'] = 'inactive'
  assert.equal(model.payrollFreshness(inactive, fixture).stale, true)
})

test('valid imported JSON key ordering alone does not stale a prepared snapshot', () => {
  const state = prepare(ready())
  state.payroll.inputs = state.payroll.inputs.map(input => Object.fromEntries(Object.entries(input).reverse()))
  assert.equal(model.payrollFreshness(state, fixture).stale, false)
})

test('deleting a later unpaid draft preserves the complete submitted receipt and its paid rows', () => {
  let state = complete(ready())
  const history = structuredClone(state.payrollHistory), paid = structuredClone(state.timeEntries[0])
  state = change(state, { type: 'add-time', date: '2026-10-12', hours: 1, source: 'manual' }, { role: 'employee', employeeId: 'employee-002' })
  state = change(state, { type: 'delete-time', entryId: 'MOCK-TIME-0002', confirmed: true }, { role: 'employee', employeeId: 'employee-002' })
  assert.deepEqual(state.payrollHistory, history)
  assert.deepEqual(state.timeEntries[0], paid)
  assert.equal(state.timeEntries.some(entry => entry.id === 'MOCK-TIME-0002'), false)
})

test('legacy submitted receipts and unfinished preparations decode unchanged with separate continuation rules', () => {
  const snapshot = structuredClone(seed.hr)
  const run = { stage: 'submitted', inputs: [{ entryId: 'time-001', employeeId: 'employee-002', hours: 8, rateCents: 3000 }], benefitInputs: [], employeeTotals: [{ employeeId: 'employee-002', hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 0, netCents: 19200 }], hours: 8, grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 0, netCents: 19200, receipt: 'LEGACY-PAYROLL-1' }
  snapshot.workflow.timeEntries[0].status = 'approved'; snapshot.workflow.timeEntries[0].payrollReceipt = run.receipt
  snapshot.workflow.payroll = structuredClone(run); snapshot.workflow.payrollHistory = [structuredClone(run)]
  const before = structuredClone(snapshot)
  assert.equal(persistence.isHrDemoState(snapshot, fixture), true)
  const later = rate(snapshot.workflow, 'employee-002', 2700)
  assert.deepEqual(later.payrollHistory[0], run)
  assert.deepEqual(snapshot, before)
  const pending = structuredClone(seed.hr); pending.workflow.payroll = { ...run, stage: 'prepared' }; delete pending.workflow.payroll.receipt
  assert.equal(persistence.isHrDemoState(pending, fixture), true)
  assert.equal(model.payrollFreshness(pending.workflow, fixture).stale, true)
  assert.throws(() => change(pending.workflow, { type: 'calculate-payroll' }), /stale/)
})

test('optional extension corruption refuses without mutating old or new saved workspaces', () => {
  const valid = structuredClone(seed.hr); valid.workflow = complete(ready())
  assert.equal(persistence.isHrDemoState(valid, fixture), true)
  for (const mutate of [
    value => { value.workflow.sampleRates['foreign'] = [{ effectiveFrom: '2026-10-01', hourlyRateCents: 2500 }] },
    value => { value.workflow.sampleRates['employee-002'][0].hourlyRateCents = '2500' },
    value => { value.workflow.sampleRates['employee-002'].push(value.workflow.sampleRates['employee-002'][0]) },
    value => { value.workflow.payroll.period.end = '2026-02-30' },
    value => { delete value.workflow.payroll.inputs[0].date },
    value => { value.workflow.timeEntries[0].returnReason = '' },
  ]) { const malformed = structuredClone(valid); mutate(malformed); assert.equal(persistence.isHrDemoState(malformed, fixture), false) }
})

test('legacy and extended workspaces survive actual single/combined/history codecs without migration', () => {
  const validate = value => persistence.isHrDemoState(value, fixture)
  for (const value of [structuredClone(seed.hr), { ...structuredClone(seed.hr), workflow: complete(ready()) }]) {
    const original = JSON.stringify(value)
    const exported = single.createDemoBackup('hr', value, validate, '2026-10-15T12:00:00.000Z')
    assert.deepEqual(single.parseDemoBackup(exported, 'hr', validate).state, value)
    const bundle = { ...structuredClone(seed), hr: value }
    assert.deepEqual(combined.parseCombinedBackup(combined.createCombinedBackup(bundle, '2026-10-15T12:00:00.000Z')).states.hr, value)
    const point = points.createRestorePoint(bundle, ['hr'], 'restore', undefined, { id: 'compatibility-point', createdAt: '2026-10-15T12:00:00.000Z' })
    assert.deepEqual(points.parseRestorePoints(JSON.stringify({ schemaVersion: 1, points: [point] }))[0].states.hr, value)
    assert.equal(JSON.stringify(value), original)
  }
})
