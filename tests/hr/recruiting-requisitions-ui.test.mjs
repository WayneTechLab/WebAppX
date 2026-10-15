import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../../src/hr/components/HrRecruitingRequisitions.tsx', import.meta.url), 'utf8')
const helpersSource = await readFile(new URL('../../src/hr/components/useHrFormDraft.ts', import.meta.url), 'utf8')
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText
const helperAst = ts.createSourceFile('useHrFormDraft.ts', helpersSource, ts.ScriptTarget.Latest, true)
const helpers = new Function(helperAst.statements.filter(node => ts.isFunctionDeclaration(node) && ['createHrFormDraft', 'normalizeHrFormValue'].includes(node.name?.text)).map(node => compile(node.getText()).replace(/^export /gm, '')).join('\n') + '\nreturn {createHrFormDraft,normalizeHrFormValue}')()
const compiled = compile(source).replace(/^import .*;\n/gm, '').replace(/^export /gm, '')
const clone = value => structuredClone(value)
const time = '2026-10-15T09:00:00.000Z'
const emptyView = { mode: 'management', jobs: [], requisitions: [], people: [], applications: [], interviews: [], submittedScorecards: [], publicActivity: [] }
const content = { department: 'Operations', ownerEmployeeId: 'employee-002', headcount: 2 }
const request = { id: 'rrequisition-0001', revision: 3, content, state: 'in-review', currentApprovalId: null, approvals: [] }
const job = { id: 'rjob-0001', title: 'Fictional specialist', department: 'Operations', managerEmployeeId: 'employee-001', state: 'draft', revision: 2, requisitionId: 'rrequisition-0001', publication: { kind: 'none' } }
const publicPreview = command => ({ kind: command.kind, recordedAt: command.recordedAt, changedPeople: [], changedApplications: [], requisition: clone(request), job: clone(job), conflict: null, interview: null, hire: null, warnings: [] })

// Actual component functions/hooks/callbacks, with a typed command-port double.
// These assertions do not claim DOM rendering, browser focus or core acceptance.
function harness(name) {
  const slots = [], groups = new Map(), focused = []
  let cursor = 0, tree
  const dependencies = {
    ...helpers,
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }] },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useUnsavedWork(group) { groups.set(group.id, group) }, focusHrForm: id => focused.push(id),
    React: { createElement(type, props, ...children) { const actual = { ...props, children: children.length === 1 ? children[0] : children }; return typeof type === 'function' && ['FormFields', 'ContentFields'].includes(type.name) ? type(actual) : { type, props: actual } } },
  }
  const component = new Function(...Object.keys(dependencies), `${compiled}\nreturn ${name}`)(...Object.values(dependencies))
  return {
    groups, focused,
    render(props) { cursor = 0; tree = component(props); return tree },
    nodes(predicate) { const result = []; const visit = node => { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (predicate(node)) result.push(node); visit(node.props?.children) }; visit(tree); return result },
  }
}
function text(node) { return Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : node == null || typeof node === 'boolean' ? '' : String(node) }
function control(ui, label) {
  const parent = ui.nodes(node => node.type === 'label' && text(node).startsWith(label))[0]
  assert.ok(parent, label)
  const visit = value => Array.isArray(value) ? value.flatMap(visit) : value && typeof value === 'object' ? ['input', 'select', 'textarea'].includes(value.type) ? [value] : visit(value.props?.children) : []
  return visit(parent.props.children)[0]
}
const change = (ui, label, value) => control(ui, label).props.onChange({ target: { value } })
const preview = ui => ui.nodes(node => node.type?.name === 'CommandPreview')[0]
const submit = ui => ui.nodes(node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} })
function portDouble() {
  const calls = { preview: [], confirm: [], cancel: [] }
  let count = 0, failure = null, response = null
  const port = {
    preview(command) { calls.preview.push(clone(command)); return response ?? { ok: true, handle: `opaque-${++count}`, preview: publicPreview(command) } },
    confirm(command) { calls.confirm.push(clone(command)); return failure ?? { ok: true, feedback: 'Fictional recruiting accepted in memory.', view: clone(emptyView) } },
    cancel(handle) { calls.cancel.push(handle) },
  }
  return { calls, port, fail(value) { failure = value }, respond(value) { response = value } }
}
function formProps(port) {
  return { id: 'hr:recruiting:requisition:create', label: 'Create sample requisition', initial: { department: '', recordedAt: '' }, port,
    makeCommand: values => ({ kind: 'create-requisition', content: { ...content, department: values.department }, recordedAt: values.recordedAt }),
    children: (values, changeValue) => ({ type: 'label', props: { children: ['Department', { type: 'input', props: { value: values.department, onChange: event => changeValue('department', event.target.value) } }] } }),
  }
}

test('preview/cancel preserve typed inputs; edit/discard invalidate handles and captured old confirm callbacks', () => {
  const api = portDouble(), ui = harness('RequisitionCommandForm'), props = formProps(api.port)
  const render = () => ui.render(props); render()
  change(ui, 'Department', '  Fictional Research  '); change(ui, 'Recorded sample time', time); render(); submit(ui); render()
  assert.deepEqual(api.calls.preview, [{ kind: 'create-requisition', content: { ...content, department: '  Fictional Research  ' }, recordedAt: time }])
  const old = preview(ui).props.onConfirm
  preview(ui).props.onCancel(); render()
  assert.deepEqual(api.calls.cancel, ['opaque-1']); assert.deepEqual(api.calls.confirm, [])
  assert.equal(control(ui, 'Department').props.value, '  Fictional Research  ')
  assert.equal(ui.groups.get(props.id).isDirty(), true)
  submit(ui); render(); const second = preview(ui).props.onConfirm
  ui.groups.get(props.id).discard(); old(); second(); render()
  assert.deepEqual(api.calls.confirm, []); assert.deepEqual(api.calls.cancel, ['opaque-1', 'opaque-2'])
  assert.equal(preview(ui), undefined); assert.equal(ui.groups.get(props.id).isDirty(), false)
})

test('stale confirmation retains a dirty baseline; successful re-preview cleans only this form and replay clicks do nothing', () => {
  const api = portDouble(), ui = harness('RequisitionCommandForm'), props = formProps(api.port)
  const render = () => ui.render(props); render()
  change(ui, 'Department', 'Research'); change(ui, 'Recorded sample time', time); render(); submit(ui); render()
  api.fail({ ok: false, code: 'stale', message: 'Current revision changed. Preview again.' })
  preview(ui).props.onConfirm(); render()
  assert.equal(control(ui, 'Department').props.value, 'Research'); assert.equal(ui.groups.get(props.id).isDirty(), true)
  assert.match(text(ui.nodes(node => node.props?.role === 'alert')), /Current revision changed/)
  assert.equal(preview(ui), undefined)
  api.fail(null); submit(ui); render(); const confirm = preview(ui).props.onConfirm; confirm(); confirm(); render()
  assert.deepEqual(api.calls.confirm, [{ kind: 'create-requisition', handle: 'opaque-1' }, { kind: 'create-requisition', handle: 'opaque-2' }])
  assert.equal(ui.groups.get(props.id).isDirty(), false)
  assert.match(text(ui.nodes(node => node.props?.role === 'status')), /accepted in memory/)
  assert.deepEqual(ui.focused, [props.id])
  change(ui, 'Department', ' Research '); render(); assert.equal(ui.groups.get(props.id).isDirty(), false)
})

test('an old detached callback cannot confirm a newer preview handle', () => {
  const api = portDouble(), ui = harness('RequisitionCommandForm'), props = formProps(api.port)
  const render = () => ui.render(props); render(); change(ui, 'Department', 'Operations'); change(ui, 'Recorded sample time', time); render(); submit(ui); render()
  const old = preview(ui).props.onConfirm
  change(ui, 'Department', 'Research'); render(); submit(ui); render(); old()
  assert.deepEqual(api.calls.confirm, [])
  preview(ui).props.onConfirm(); render()
  assert.deepEqual(api.calls.confirm, [{ kind: 'create-requisition', handle: 'opaque-2' }])
})

test('retained inputs cannot silently use a newer DTO revision; explicit discard loads current values', () => {
  const api = portDouble(), ui = harness('RequisitionCommandForm'), props = formProps(api.port)
  props.sourceRevision = 3
  props.initial = { department: 'Original Operations', recordedAt: '' }
  props.makeCommand = values => ({ kind: 'edit-requisition', requisitionId: 'rrequisition-0001', revision: 3, content: { ...content, department: values.department }, recordedAt: values.recordedAt })
  const render = () => ui.render(props); render()
  change(ui, 'Department', 'My retained revision 3 draft'); change(ui, 'Recorded sample time', time); render(); submit(ui); render()
  const oldConfirm = preview(ui).props.onConfirm
  props.sourceRevision = 4
  props.initial = { department: 'New saved Research', recordedAt: '' }
  props.makeCommand = values => ({ kind: 'edit-requisition', requisitionId: 'rrequisition-0001', revision: 4, content: { ...content, department: values.department }, recordedAt: values.recordedAt })
  render(); submit(ui); oldConfirm(); render()
  assert.equal(api.calls.preview.length, 1); assert.deepEqual(api.calls.confirm, []); assert.deepEqual(api.calls.cancel, ['opaque-1'])
  assert.equal(control(ui, 'Department').props.value, 'My retained revision 3 draft')
  assert.equal(ui.groups.get(props.id).isDirty(), true)
  assert.match(text(ui.nodes(node => node.props?.role === 'alert')), /record revision changed.*inputs are kept.*Discard this form draft/)
  ui.groups.get(props.id).discard(); render()
  assert.equal(control(ui, 'Department').props.value, 'New saved Research')
  assert.equal(ui.groups.get(props.id).isDirty(), false)
  change(ui, 'Department', 'Reviewed revision 4 change'); change(ui, 'Recorded sample time', time); render(); submit(ui); render()
  assert.deepEqual(api.calls.preview[1], { kind: 'edit-requisition', requisitionId: 'rrequisition-0001', revision: 4, content: { ...content, department: 'Reviewed revision 4 change' }, recordedAt: time })
  assert.ok(preview(ui))
})

test('unexpected private preview variants are cancelled and raw thrown errors are never displayed', () => {
  const api = portDouble(), ui = harness('RequisitionCommandForm'), props = formProps(api.port)
  api.respond({ ok: true, handle: 'private-handle', preview: { kind: 'save-scorecard', content: { comments: 'PRIVATE-COMMENT' } } })
  ui.render(props); submit(ui); const tree = ui.render(props)
  assert.deepEqual(api.calls.cancel, ['private-handle']); assert.equal(preview(ui), undefined)
  assert.doesNotMatch(text(tree), /PRIVATE-COMMENT|private-handle/)
  props.port = { ...api.port, preview() { throw new Error('PRIVATE-SOURCE-ERROR') } }
  ui.render(props); submit(ui); assert.doesNotMatch(text(ui.render(props)), /PRIVATE-SOURCE-ERROR/)
})

test('management composition exposes all eight literal command families with DTO revisions and no state/updater prop', () => {
  const api = portDouble(), ui = harness('HrRecruitingRequisitions')
  const view = { requisitions: [clone(request), { ...clone(request), id: 'rrequisition-0002', state: 'draft' }], jobs: [clone(job), { ...clone(job), id: 'legacy-published', state: 'published', requisitionId: null, publication: { kind: 'legacy-unrecorded' } }, { ...clone(job), id: 'legacy-closed', state: 'closed' }] }
  Object.defineProperty(view, 'people', { get() { throw new Error('Unneeded DTO must not be read') } })
  const props = { view, port: api.port, ownerChoices: [{ id: 'employee-002', label: 'Avery Sample' }], managerChoices: [{ id: 'employee-001', label: 'Morgan Sample' }] }
  const tree = ui.render(props)
  const forms = ui.nodes(node => node.type?.name === 'RequisitionCommandForm')
  const values = { department: 'Research', ownerEmployeeId: 'employee-002', headcount: '4', recordedAt: time, outcome: 'rejected', reason: 'Fictional review reason', title: 'Fictional engineer', managerEmployeeId: 'employee-001', requisitionId: 'rrequisition-0001' }
  const commands = forms.map(form => form.props.makeCommand(values))
  assert.deepEqual([...new Set(commands.map(command => command.kind))].sort(), ['bind-job-requisition', 'close-job', 'create-job', 'create-requisition', 'edit-requisition', 'publish-job', 'request-requisition-review', 'review-requisition'])
  assert.deepEqual(commands.find(command => command.kind === 'review-requisition'), { kind: 'review-requisition', requisitionId: 'rrequisition-0001', revision: 3, outcome: 'rejected', reason: 'Fictional review reason', recordedAt: time })
  assert.deepEqual(commands.find(command => command.kind === 'create-job'), { kind: 'create-job', title: 'Fictional engineer', department: 'Research', managerEmployeeId: 'employee-001', requisitionId: 'rrequisition-0001', recordedAt: time })
  assert.deepEqual(commands.find(command => command.kind === 'publish-job'), { kind: 'publish-job', jobId: 'rjob-0001', revision: 2, recordedAt: time })
  assert.deepEqual(commands.find(command => command.kind === 'close-job'), { kind: 'close-job', jobId: 'legacy-published', revision: 2, recordedAt: time })
  for (const form of forms) {
    assert.equal(Object.hasOwn(form.props, 'state'), false); assert.equal(Object.hasOwn(form.props, 'onAction'), false)
    assert.equal(Object.hasOwn(form.props, 'adapter'), false); assert.equal(form.props.port, api.port)
    const command = form.props.makeCommand(values)
    assert.equal(form.props.sourceRevision, 'revision' in command ? command.revision : undefined)
  }
  assert.match(text(tree), /Legacy publication; no recorded approval/)
  assert.doesNotMatch(text(tree), /legacy-closed.*Preview publish/)
})

test('preview presents approved content and job manager independently without exposing the opaque handle', () => {
  const ui = harness('CommandPreview')
  const command = { kind: 'review-requisition', requisitionId: request.id, revision: 3, outcome: 'approved', reason: 'Fictional owner checked', recordedAt: time }
  const tree = ui.render({ pending: { kind: command.kind, handle: 'OPAQUE-DO-NOT-RENDER', preview: publicPreview(command), command }, onConfirm() {}, onCancel() {} })
  assert.match(text(tree), /Requisition owner IDemployee-002/)
  assert.match(text(tree), /Hiring manager IDemployee-001/)
  assert.match(text(tree), /Planning headcount2/)
  assert.match(text(tree), /Fictional owner checked/)
  assert.match(text(tree), /does not consume a hiring quota/)
  assert.doesNotMatch(text(tree), /OPAQUE-DO-NOT-RENDER/)
  assert.deepEqual(ui.nodes(node => node.type === 'button').map(node => text(node)), ['Confirm fictional recruiting action', 'Cancel recruiting action preview'])
})
