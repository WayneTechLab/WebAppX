import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import { loadMockModel } from '../browser/model-loader.mjs'

const source = await readFile(new URL('../../src/hr/components/HrDirectoryCorrections.tsx', import.meta.url), 'utf8')
const fixture = JSON.parse(await readFile(new URL('../../.SYSTEMX/GUSTO/mock/fixtures/demo-company.json', import.meta.url), 'utf8'))
const model = await loadMockModel(new URL('../../src/hr/model.ts', import.meta.url))
const persistence = await loadMockModel(new URL('../../src/hr/persistence.ts', import.meta.url))
const lifecycle = await loadMockModel(new URL('../../src/hr/lifecycle.ts', import.meta.url))
const helperSource = await readFile(new URL('../../src/hr/components/useHrFormDraft.ts', import.meta.url), 'utf8')
const helperAst = ts.createSourceFile('useHrFormDraft.ts', helperSource, ts.ScriptTarget.Latest, true)
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText
const helpers = new Function(helperAst.statements.filter(node => ts.isFunctionDeclaration(node) && ['createHrFormDraft', 'normalizeHrFormValue'].includes(node.name?.text)).map(node => compile(node.getText()).replace(/^export /gm, '')).join('\n') + '\nreturn {createHrFormDraft,normalizeHrFormValue}')()
const compiled = compile(source).replace(/^import .*;\n/gm, '').replace(/^export /gm, '')
const employee = { role: 'employee', employeeId: 'employee-002' }
const hr = { role: 'hr-admin' }
const clone = value => structuredClone(value)

/** Invoke actual component callbacks and hooks against the real pure models.
 * JSX data nodes are inspected; these tests make no DOM/browser-focus claim. */
function harness(name) {
  const slots = [], groups = new Map(), requests = [], focused = []
  let cursor = 0, tree
  const dependencies = {
    ...model, ...lifecycle, ...helpers,
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }] },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useUnsavedWork(group) { groups.set(group.id, group) },
    useUnsavedTransition: () => (options, commit) => { requests.push({ options, commit }); return false },
    focusHrForm: id => focused.push(id),
    window: { requestAnimationFrame: () => {} },
    React: { createElement(type, props, ...children) { return { type, props: { ...props, children } } } },
  }
  const component = new Function(...Object.keys(dependencies), `${compiled}\nreturn ${name}`)(...Object.values(dependencies))
  return {
    groups, requests, focused,
    render(props) { cursor = 0; groups.clear(); tree = component(props); return tree },
    nodes(predicate) { const result = []; const visit = node => { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (predicate(node)) result.push(node); visit(node.props?.children) }; visit(tree); return result },
  }
}
function text(node) { return Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : node == null || typeof node === 'boolean' ? '' : String(node) }
function input(ui, label) {
  const parent = ui.nodes(node => node.type === 'label' && text(node).startsWith(label))[0]
  assert.ok(parent, label)
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value && typeof value === 'object' ? ['input', 'select', 'textarea'].includes(value.type) ? [value] : visit(value.props?.children) : []
  return visit(parent.props.children)[0]
}
const change = (ui, label, value) => input(ui, label).props.onChange({ target: { value } })
const submit = ui => ui.nodes(node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
const preview = ui => ui.nodes(node => typeof node.type === 'function' && node.type.name === 'DirectoryPreview')[0]
function workspace(actor = employee) {
  let state = persistence.createHrDemoState(fixture), accepted = 0
  return {
    get state() { return state }, get accepted() { return accepted },
    replace(next) { state = next },
    props(extra = {}) { return { state, actor, baseFixture: fixture, onAction(update) { try { state = update(state); accepted++; return true } catch { return false } }, ...extra } },
  }
}
function requestState(employeeId = 'employee-002', workEmail = 'Corrected@sample.invalid') {
  const state = persistence.createHrDemoState(fixture), actor = { role: 'employee', employeeId }
  const action = { type: 'request-correction', employeeId, workEmail, simulationDate: '2026-10-15' }
  return lifecycle.confirmHrLifecycle(state, actor, action, lifecycle.previewHrLifecycle(state, actor, action, fixture).confirmation, fixture)
}

test('request preview/cancel preserves exact unsaved text and every workspace byte; discard invalidates its companion preview', () => {
  const work = workspace(), ui = harness('EmailCorrectionForm'), subject = fixture.employees.find(person => person.id === employee.employeeId)
  const render = () => ui.render(work.props({ employee: subject, mode: 'request', simulationDate: '' }))
  const original = clone(work.state); render()
  change(ui, 'Proposed work email', 'Wrong@example.com'); render(); change(ui, 'Simulation date', '2026-10-15'); render(); submit(ui); render()
  assert.equal(preview(ui), undefined); assert.match(text(ui.nodes(node => node.props?.role === 'alert')), /\.invalid/); assert.equal(work.accepted, 0)
  change(ui, 'Proposed work email', '  Corrected@sample.invalid  '); render(); submit(ui); render()
  assert.equal(preview(ui).props.preview.previous, subject.workEmail); assert.equal(preview(ui).props.preview.proposed, 'Corrected@sample.invalid')
  assert.deepEqual(work.state, original); assert.equal(work.accepted, 0)
  preview(ui).props.onCancel(); render(); assert.equal(input(ui, 'Proposed work email').props.value, '  Corrected@sample.invalid  ')
  assert.equal(ui.groups.get('hr:directory:request:employee-002').isDirty(), true)
  submit(ui); render(); const oldConfirm = preview(ui).props.onConfirm
  ui.groups.get('hr:directory:request:employee-002').discard(); oldConfirm(); render()
  assert.equal(preview(ui), undefined); assert.equal(work.accepted, 0); assert.deepEqual(work.state, original)
  assert.equal(ui.groups.get('hr:directory:request:employee-002').isDirty(), false)
  assert.deepEqual(ui.focused, ['hr:directory:request:employee-002'])
})

test('confirmation uses current source; stale refusal retains inputs and successful re-preview records one own request', () => {
  const work = workspace(), ui = harness('EmailCorrectionForm'), subject = fixture.employees.find(person => person.id === employee.employeeId)
  const render = () => ui.render(work.props({ employee: subject, mode: 'request', simulationDate: '' })); render()
  change(ui, 'Proposed work email', '  Corrected@sample.invalid  '); render(); change(ui, 'Simulation date', '2026-10-15'); render(); submit(ui); render()
  work.replace({ ...work.state, selectedEmployee: 'employee-003' }); const before = clone(work.state)
  preview(ui).props.onConfirm(); render(); assert.deepEqual(work.state, before); assert.equal(work.accepted, 0)
  assert.equal(input(ui, 'Proposed work email').props.value, '  Corrected@sample.invalid  '); assert.equal(preview(ui), undefined)
  submit(ui); render(); preview(ui).props.onConfirm(); render()
  assert.equal(work.accepted, 1); assert.equal(work.state.workflow.profileEmails['employee-002'], subject.workEmail)
  assert.deepEqual(work.state.workflow.lifecycle.corrections, [{ id: 'correction-1', sequence: 1, employeeId: 'employee-002', instanceId: 'employment-employee-002-1', field: 'workEmail', oldValue: subject.workEmail, proposedValue: 'Corrected@sample.invalid', actor: employee, status: 'pending' }])
  assert.deepEqual(work.state.workflow.lifecycle.directoryHistory, []); assert.deepEqual(work.state.operations, before.operations)
  assert.equal(ui.groups.get('hr:directory:request:employee-002').isDirty(), false)
})

test('direct edit keeps email case, treats surrounding whitespace as clean and records one exact old/new history row', () => {
  const work = workspace(hr), ui = harness('EmailCorrectionForm'), subject = fixture.employees.find(person => person.id === 'employee-002')
  const render = () => ui.render(work.props({ employee: subject, mode: 'edit', simulationDate: '2026-10-15' })); render()
  change(ui, 'New directory work email', `  ${subject.workEmail}  `); render()
  assert.equal(ui.groups.get('hr:directory:edit:employee-002').isDirty(), false)
  change(ui, 'New directory work email', '  ChangedCase@sample.invalid  '); render(); submit(ui); render()
  assert.equal(work.accepted, 0); assert.equal(work.state.workflow.profileEmails['employee-002'], subject.workEmail)
  preview(ui).props.onConfirm(); render()
  assert.equal(work.accepted, 1); assert.equal(work.state.workflow.profileEmails['employee-002'], 'ChangedCase@sample.invalid')
  assert.deepEqual(work.state.workflow.lifecycle.directoryHistory, [{ id: 'directory-1', sequence: 1, employeeId: 'employee-002', field: 'workEmail', oldValue: subject.workEmail, newValue: 'ChangedCase@sample.invalid', actor: hr, origin: 'direct' }])
  assert.equal(ui.groups.get('hr:directory:edit:employee-002').isDirty(), false)
})

for (const outcome of ['accepted', 'rejected']) test(`HR ${outcome} outcome commits its exact reason/actor/sequence and only acceptance changes email`, () => {
  const work = workspace(hr); work.replace(requestState())
  const before = clone(work.state), ui = harness('CorrectionReviewForm'), correction = work.state.workflow.lifecycle.corrections[0]
  const render = () => ui.render(work.props({ correction, simulationDate: '2026-10-15' })); render()
  change(ui, 'Correction outcome', outcome); render(); change(ui, 'Correction outcome reason', '  Fictional mailbox checked  '); render(); submit(ui); render()
  assert.deepEqual(work.state, before); assert.equal(work.accepted, 0)
  assert.equal(preview(ui).props.preview.action.outcome, outcome); preview(ui).props.onConfirm(); render()
  assert.equal(work.accepted, 1)
  assert.deepEqual(work.state.workflow.lifecycle.corrections[0].outcome, { sequence: outcome === 'accepted' ? 3 : 2, actor: hr, reason: 'Fictional mailbox checked' })
  assert.equal(work.state.workflow.lifecycle.corrections[0].status, outcome)
  assert.equal(work.state.workflow.profileEmails['employee-002'], outcome === 'accepted' ? 'Corrected@sample.invalid' : before.workflow.profileEmails['employee-002'])
  assert.deepEqual(work.state.workflow.lifecycle.directoryHistory, outcome === 'accepted' ? [{ id: 'directory-2', sequence: 2, employeeId: 'employee-002', field: 'workEmail', oldValue: before.workflow.profileEmails['employee-002'], newValue: 'Corrected@sample.invalid', actor: hr, origin: 'correction', correctionId: 'correction-1' }] : [])
  assert.deepEqual(work.state.recruiting, before.recruiting); assert.deepEqual(work.state.performance, before.performance)
  assert.equal(ui.groups.get('hr:directory:review:correction-1').isDirty(), false)
})

test('bound page scope never falls back to another employee; auditors are read-only and managers can propose only their own email', () => {
  const state = requestState(), ui = harness('HrDirectoryCorrections')
  const base = { state, baseFixture: fixture, onAction() { throw new Error('Read rendering cannot write') } }
  let tree = ui.render({ ...base, actor: employee, employeeId: 'employee-003' })
  assert.match(text(tree), /No authorized employee/); assert.doesNotMatch(text(tree), /Corrected@sample\.invalid/)
  assert.equal(ui.nodes(node => typeof node.type === 'function' && /Form$/.test(node.type.name)).length, 0)
  tree = ui.render({ ...base, actor: { role: 'auditor' }, employeeId: 'employee-002' })
  assert.match(text(tree), /Corrected@sample\.invalid/); assert.equal(ui.nodes(node => typeof node.type === 'function' && /Form$/.test(node.type.name)).length, 0)
  tree = ui.render({ ...base, actor: hr, employeeId: 'missing-employee' }); assert.match(text(tree), /No authorized employee/)
  assert.equal(ui.nodes(node => typeof node.type === 'function' && /Form$/.test(node.type.name)).length, 0)
  ui.render({ ...base, actor: { role: 'manager', employeeId: 'employee-001' } })
  const forms = ui.nodes(node => typeof node.type === 'function' && /Form$/.test(node.type.name))
  assert.equal(forms.length, 1); assert.equal(forms[0].props.mode, 'request'); assert.equal(forms[0].props.employee.id, 'employee-001')
})

test('unbound HR employee switching queues exactly its direct-edit group before changing target', () => {
  const ui = harness('HrDirectoryCorrections'), state = persistence.createHrDemoState(fixture)
  const props = { state, actor: hr, baseFixture: fixture, onAction: () => false }
  ui.render(props); const target = () => ui.nodes(node => typeof node.type === 'function' && node.type.name === 'EmailCorrectionForm')[0].props.employee.id
  assert.equal(target(), 'employee-001'); change(ui, 'Directory employee', 'employee-002'); ui.render(props)
  assert.equal(target(), 'employee-001'); assert.deepEqual(ui.requests[0].options.ids, ['hr:directory:edit:employee-001'])
  ui.requests[0].commit(); ui.render(props); assert.equal(target(), 'employee-002')
})
