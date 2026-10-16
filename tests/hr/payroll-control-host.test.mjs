import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { loadMockModel } from '../browser/model-loader.mjs'

const model = name => loadMockModel(new URL(`../../src/hr/${name}.ts`, import.meta.url))
const persistence = await model('persistence')
const { createPayrollControlHost } = await model('payroll-control-host')
const { createUnsavedWorkController } = await loadMockModel(new URL('../../src/portals/unsaved-work-core.ts', import.meta.url))
const fixture = JSON.parse(await readFile(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const owner = { role: 'employer-owner' }
const period = { start: '2026-10-01', end: '2026-10-15' }
const close = { kind: 'close-period', period, recordedOn: '2026-10-16', reason: 'Literal host closure review' }
const money = { grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 0, netCents: 19200 }
function original() {
  const state = persistence.createHrDemoState(fixture)
  state.workflow.timeEntries = [{ id: 'host-time', employeeId: 'employee-001', date: '2026-10-05', hours: 8, status: 'approved', source: 'manual', payrollReceipt: 'MOCK-PAYROLL-0001' }]
  const payroll = { stage: 'submitted', period: structuredClone(period), inputs: [{ entryId: 'host-time', employeeId: 'employee-001', date: '2026-10-05', hours: 8, rateCents: 3000, rateEffectiveFrom: '2026-10-01' }], benefitInputs: [], employeeTotals: [{ employeeId: 'employee-001', hours: 8, ...money }], hours: 8, ...money, receipt: 'MOCK-PAYROLL-0001' }
  state.workflow.payroll = structuredClone(payroll); state.workflow.payrollHistory = [payroll]; state.workflow.sequence = 2
  assert.equal(persistence.isHrDemoState(state, fixture), true)
  return state
}

// Run the actual native root callback bodies. Only the React storage dispatch
// is replaced by a synchronous counter; no representative domain adapter is used.
const workspaceText = await readFile(new URL('../../src/hr/components/HrWorkspace.tsx', import.meta.url), 'utf8')
const workspaceAst = ts.createSourceFile('HrWorkspace.tsx', workspaceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const workspace = workspaceAst.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'HrWorkspace')
const functions = ['setState', 'replacePayrollControlState'].map(name => {
  const declaration = workspace.body.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(declaration, `actual root callback ${name} exists`); return declaration.getText(workspaceAst)
})
const compiled = ts.transpileModule(`export function attach(setStoredState, isHrDemoState, hrFixture) { ${functions.join('\n')} return replacePayrollControlState }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText
const rootExports = {}; new Function('exports', compiled)(rootExports)
function harness({ state = original(), actor = owner, transition, visible = true } = {}) {
  let latest = state, accepted = 0, attempts = 0, active = visible
  const update = rootExports.attach(build => { attempts++; const candidate = build(latest); latest = candidate; accepted++ }, persistence.isHrDemoState, fixture)
  const unsaved = createUnsavedWorkController()
  const props = { state, actor, rawFixture: fixture, replacementEpoch: 0, active: true, readActive: () => active, onUpdate: update }
  const host = createPayrollControlHost(props, transition ?? unsaved.request)
  return { host, unsaved, props, latest: () => latest, accepted: () => accepted, attempts: () => attempts, external(value) { latest = value }, visible(value) { active = value } }
}
function preview(h) { const result = h.host.port.preview(close); assert.equal(result.ok, true); return result }
function confirm(h, pending) { return h.host.port.confirm({ kind: 'close-period', handle: pending.handle }) }
function participant(controller, id, portal = 'hr', initial = true) {
  let dirty = initial, discards = 0
  controller.register(() => ({ id, portal, label: `Literal ${id}`, isDirty: () => dirty, discard() { dirty = false; discards++ } }))
  return { set(value) { dirty = value }, dirty: () => dirty, discards: () => discards }
}

test('host exposes narrow writer DTO and stable ports without complete source or private updater', () => {
  const state = original(); state.acknowledgements.push('HOST_PRIVATE_SOURCE_MARKER')
  const h = harness({ state }), view = h.host.getSnapshot()
  assert.equal(view.mode, 'writer'); assert.deepEqual(Object.keys(h.host.port).sort(), ['cancel', 'confirm', 'preview', 'view'])
  assert.equal(JSON.stringify(view).includes('HOST_PRIVATE_SOURCE_MARKER'), false)
  assert.equal(JSON.stringify(view).includes('anchors'), false)
  const pending = preview(h); assert.equal(pending.preview.receiptIds[0], 'MOCK-PAYROLL-0001')
  assert.equal(h.accepted(), 0); assert.equal(Object.hasOwn(h.latest().workflow, 'payrollControl'), false)
  h.host.stop()
})

test('closure uses current live dirty scope and Keep preserves the same one-use preview', () => {
  const h = harness(), pending = preview(h), originalState = structuredClone(h.latest())
  const manual = participant(h.unsaved, 'hr:time:employee-001:manual')
  const timer = participant(h.unsaved, 'hr:time:employee-002:timer', 'hr', false)
  const own = participant(h.unsaved, 'hr:payroll-control:closure')
  const unrelatedHr = participant(h.unsaved, 'hr:benefit:employee-001')
  const unrelatedCms = participant(h.unsaved, 'cms:editor', 'cms')
  let result
  assert.equal(h.host.guardClosure(() => { result = confirm(h, pending) }), false)
  let choice = h.unsaved.getSnapshot(); assert.deepEqual(choice.participants.map(item => item.id), ['hr:time:employee-001:manual']); assert.equal(choice.canRetain, false)
  assert.equal(h.unsaved.resolve(choice.id, 'keep-editing'), true); assert.equal(result, undefined)
  assert.deepEqual(h.latest(), originalState); assert.equal(manual.dirty(), true)
  assert.equal(h.host.guardClosure(() => { result = confirm(h, pending) }), false)
  timer.set(true) // A timer became dirty after the decision opened.
  choice = h.unsaved.getSnapshot(); assert.equal(h.unsaved.resolve(choice.id, 'discard'), true)
  assert.equal(result.ok, true); assert.equal(h.accepted(), 1)
  assert.equal(manual.discards(), 1); assert.equal(timer.discards(), 1)
  for (const untouched of [own, unrelatedHr, unrelatedCms]) { assert.equal(untouched.dirty(), true); assert.equal(untouched.discards(), 0) }
  assert.equal(h.latest().workflow.payrollControl.events[0].kind, 'period-closed')
  assert.equal(confirm(h, pending).ok, false); assert.equal(h.accepted(), 1)
  h.host.stop()
})

test('conservative closure scope enumerates literal current native IDs and excludes own controls', () => {
  let observed
  const h = harness({ transition(options) { observed = options; return false } })
  assert.equal(h.host.guardClosure(() => assert.fail('queued callback must not execute')), false)
  const expected = ['hr:payroll:period', 'hr:payroll:rate']
  for (const id of ['employee-001', 'employee-002', 'employee-003']) expected.push(`hr:time:${id}:manual`, `hr:time:${id}:timer`)
  expected.push('hr:time:host-time:correction', 'hr:time:host-time:return')
  assert.deepEqual(observed.ids, expected); assert.equal(observed.retain, false); assert.equal(observed.portal, 'hr')
  assert.equal(observed.ids.includes('hr:payroll-control:closure'), false); assert.equal(observed.ids.includes('hr:payroll-control:correction'), false)
  h.host.stop()
})

test('invalid writer shape or bound identity receives no dirty decision or target projection', () => {
  let requested = 0
  for (const actor of [{ role: 'employer-owner', employeeId: 'unknown' }, { role: 'employer-owner', contractorId: 'contractor-001' }, { role: 'employer-owner', extra: true }, { role: 'hr-admin' }, { role: 'employee', employeeId: 'employee-001' }]) {
    const h = harness({ actor, transition() { requested++; return true } })
    assert.equal(h.host.guardClosure(() => assert.fail('invalid caller cannot commit')), false)
    assert.equal(h.host.port.preview(close).ok, false); assert.equal(h.host.getSnapshot().ok, false)
    assert.equal(h.accepted(), 0); h.host.stop()
  }
  assert.equal(requested, 0)
})

test('actual latest native callback refuses a source changed after preview without accepting a save', () => {
  const h = harness(), pending = preview(h)
  const changed = structuredClone(h.latest()); changed.managementRole = 'payroll-admin'; h.external(changed)
  const result = confirm(h, pending)
  assert.equal(result.ok, false); assert.equal(result.code, 'stale'); assert.equal(h.accepted(), 0); assert.equal(h.attempts(), 1)
  assert.deepEqual(h.latest(), changed); assert.equal(Object.hasOwn(h.latest().workflow, 'payrollControl'), false)
  assert.equal(confirm(h, pending).ok, false); h.host.stop()
})

test('authorized temporary discard stays explicit when final latest-source confirmation is stale', () => {
  const h = harness(), pending = preview(h), timer = participant(h.unsaved, 'hr:time:employee-001:timer')
  let result; h.host.guardClosure(() => { result = confirm(h, pending) })
  const changed = structuredClone(h.latest()); changed.managementRole = 'payroll-admin'; h.external(changed)
  const decision = h.unsaved.getSnapshot(); h.unsaved.resolve(decision.id, 'discard')
  assert.equal(timer.discards(), 1); assert.equal(timer.dirty(), false)
  assert.equal(result.ok, false); assert.equal(result.code, 'stale'); assert.equal(h.accepted(), 0); assert.deepEqual(h.latest(), changed)
  h.host.stop()
})

test('live route reads deny retained hidden commands without dropping the retained writer DTO', () => {
  const h = harness(), pending = preview(h), before = h.host.getSnapshot()
  h.visible(false)
  assert.equal(h.host.getSnapshot(), before); assert.equal(before.mode, 'writer')
  assert.equal(h.host.guardClosure(() => assert.fail('hidden route cannot commit')), false)
  assert.equal(h.host.port.preview(close).ok, false); assert.equal(confirm(h, pending).ok, false); assert.equal(h.accepted(), 0)
  h.visible(true); assert.equal(confirm(h, pending).ok, false, 'denied supplied handle was consumed')
  assert.equal(confirm(h, preview(h)).ok, true); h.host.stop()
})

test('updater/request callbacks preserve synchronous acceptance and avoid spurious store publications', () => {
  const h = harness(), pending = preview(h)
  let publications = 0; h.host.subscribe(() => publications++)
  h.host.setTransition((options, commit) => { commit(); return true }); assert.equal(publications, 0)
  assert.equal(confirm(h, pending).ok, true); assert.equal(publications, 1)
  h.host.sync(h.props) // Parent has not supplied the accepted state reference yet.
  assert.equal(h.host.getSnapshot().closures.length, 1); assert.equal(h.latest().workflow.payrollControl.events.length, 1)
  assert.equal(h.accepted(), 1); h.host.stop()
})

test('actor/epoch changes invalidate handles and accessor requests never invoke a getter', () => {
  const h = harness(), pending = preview(h)
  h.host.sync({ ...h.props, state: h.latest(), actor: { role: 'hr-admin' }, replacementEpoch: 1 })
  let reads = 0; const request = { kind: 'close-period', get handle() { reads++; return pending.handle } }
  assert.equal(h.host.port.confirm(request).ok, false); assert.equal(reads, 0)
  assert.equal(h.host.port.confirm({ kind: 'close-period', handle: pending.handle }).ok, false)
  h.host.sync({ ...h.props, state: h.latest(), replacementEpoch: 2 })
  assert.equal(confirm(h, pending).ok, false); assert.equal(h.accepted(), 0)
  h.host.stop()
})
