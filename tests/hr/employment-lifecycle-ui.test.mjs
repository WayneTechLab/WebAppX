import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../../src/hr/components/HrEmploymentLifecycle.tsx', import.meta.url), 'utf8')
const syntax = ts.createSourceFile('HrEmploymentLifecycle.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const helperSource = await readFile(new URL('../../src/hr/components/useHrFormDraft.ts', import.meta.url), 'utf8')
const helperSyntax = ts.createSourceFile('useHrFormDraft.ts', helperSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
function declaration(tree, name) {
  const result = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)
  assert.ok(result, `Actual component declaration ${name} must exist`)
  return result.getText(tree)
}
function javascript(text) { return ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText.replace(/^export /gm, '') }
const { createHrFormDraft, normalizeHrFormValue } = new Function(`${javascript(declaration(helperSyntax, 'normalizeHrFormValue'))}\n${javascript(declaration(helperSyntax, 'createHrFormDraft'))}\nreturn {createHrFormDraft,normalizeHrFormValue}`)()
const employee = { id: 'employee-002', firstName: 'Avery', lastName: 'Example', department: 'Design', jobTitle: 'Product Designer', managerId: 'employee-001', employmentStatus: 'active' }
const instance = { id: 'employment-employee-002-1', employeeId: employee.id, startDate: null, endDate: null, templateVersion: 'legacy-employee-002' }
function props(extra = {}) { return { state: { revision: 1, workflow: { onboarding: { 'employee-002': { stage: 'draft' } } } }, actor: { role: 'employer-owner' }, baseFixture: { employees: [employee] }, employee, instance, simulationDate: '2026-10-15', onAccepted() {}, ...extra } }

/** Run actual form callbacks with deterministic hook slots. This checks the UI
 * boundary independently of model transition tests; it does not claim DOM or
 * browser evidence. The parent action represents the synchronous latest-state
 * adapter that the component requires. */
function harness(options = {}) {
  const slots = [], groups = new Map(), confirmations = []
  let cursor = 0, tree, currentProps
  let accepted = 0
  const dependencies = {
    React: { createElement(type, props, ...children) { return { type, props: { ...props, children } } } },
    useRef: () => ({ current: null }),
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], update => { slots[index] = typeof update === 'function' ? update(slots[index]) : update }] },
    useHrFormDraft(config) {
      const index = cursor++, controller = slots[index] ??= createHrFormDraft(config.initial, config.normalize)
      groups.set(config.id, controller)
      return { id: config.id, value: controller.value(), setValue: update => controller.change(update), accept: (...args) => controller.accept(...args), discard: () => controller.discard(), dirty: config.enabled && controller.isDirty() }
    },
    effectiveHrFixture: (_state, base) => base,
    previewHrLifecycle: (_state, _actor, action) => ({ confirmation: 'fixture-reviewed-revision-1', action, policy: 'Fictional local policy' }),
    confirmHrLifecycle(state, actor, action, token) { confirmations.push({ state, actor, action, token }); if (state.revision !== 1) throw new Error('Reviewed source changed. Create a new preview.'); return { ...state, acceptedAction: action } },
    normalizeHrFormValue,
    groupId: (employeeId, instanceId, group) => `hr:lifecycle:${employeeId}:${instanceId}:${group}`,
    errorMessage: error => error instanceof Error ? error.message : 'Refused',
    focusLater() {},
    window: { requestAnimationFrame(callback) { callback() } },
    Panel: 'Panel', Preview: 'Preview', ManagerOptions: 'ManagerOptions', fieldClass: '', buttonClass: '', secondaryClass: '',
  }
  const run = new Function(...Object.keys(dependencies), `${javascript(declaration(syntax, 'EmployeeLifecycle'))}\nreturn EmployeeLifecycle`)(...Object.values(dependencies))
  function nodes(predicate) { const result = []; function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (predicate(node)) result.push(node); visit(node.props?.children) }; visit(tree); return result }
  function text(node) { if (Array.isArray(node)) return node.map(text).join(''); return node && typeof node === 'object' ? text(node.props?.children) : node == null || typeof node === 'boolean' ? '' : String(node) }
  function render(next = currentProps) { currentProps = next; cursor = 0; groups.clear(); tree = run({ ...next, onAccepted() { accepted++; next.onAccepted() } }); return tree }
  function field(label) { const wrapper = nodes(node => node.type === 'label' && text(node).startsWith(label))[0]; assert.ok(wrapper, label); let found; function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (['input', 'select', 'textarea'].includes(node.type)) found ??= node; visit(node.props?.children) }; visit(wrapper); return found }
  return { groups, confirmations, nodes, render, field, get accepted() { return accepted },
    change(label, value) { field(label).props.onChange({ target: { value } }); render() },
    submit(group) { const form = nodes(node => node.type === 'form' && node.props.id.endsWith(`:${group}`))[0]; assert.ok(form); form.props.onSubmit({ preventDefault() {} }); render() },
    preview: () => nodes(node => node.type === 'Preview')[0],
    alerts: () => nodes(node => node.props.role === 'alert').map(text),
    ...options,
  }
}
const transferId = 'hr:lifecycle:employee-002:employment-employee-002-1:transfer'
const transitionId = 'hr:lifecycle:employee-002:employment-employee-002-1:transition'

test('accepted transfer uses the parent latest-state updater and rebases only the accepted form', () => {
  const ui = harness()
  let latest = props().state, updates = 0
  ui.render(props({ onAction(update) { latest = update(latest); updates++; return true } }))
  ui.change('Transfer department', 'Research')
  ui.change('Transfer effective date', '2026-10-15')
  ui.change('Sample transition reason', 'Independent unsaved leave reason')
  ui.submit('transfer')
  ui.preview().props.onConfirm(); ui.render()
  assert.equal(updates, 1)
  assert.equal(latest.acceptedAction.department, 'Research')
  assert.equal(ui.groups.get(transferId).isDirty(), false)
  assert.equal(ui.groups.get(transitionId).isDirty(), true)
  assert.equal(ui.field('Sample transition reason').props.value, 'Independent unsaved leave reason')
  assert.equal(ui.accepted, 1)
})

test('changed accepted state refuses confirmation without resetting any typed fields or accepted baseline', () => {
  const ui = harness()
  const current = props({ onAction(update) { try { update({ ...current.state, revision: 2 }); return true } catch { return false } } })
  ui.render(current)
  ui.change('Transfer department', 'Research')
  ui.change('Transfer effective date', '2026-10-15')
  ui.submit('transfer')
  ui.preview().props.onConfirm(); ui.render()
  assert.deepEqual(ui.confirmations.map(item => item.state.revision), [1, 2])
  assert.equal(ui.groups.get(transferId).isDirty(), true)
  assert.equal(ui.field('Transfer department').props.value, 'Research')
  assert.equal(ui.preview(), undefined)
  assert.match(ui.alerts().join(' '), /refused/)
  assert.equal(ui.accepted, 0)
})

test('external unsaved-work Discard invalidates an old preview before it can apply its former values', () => {
  const ui = harness()
  let updates = 0
  ui.render(props({ onAction() { updates++; return true } }))
  ui.change('Transfer department', 'Research')
  ui.change('Transfer effective date', '2026-10-15')
  ui.submit('transfer')
  ui.groups.get(transferId).discard(); ui.render()
  assert.equal(ui.preview().props.canConfirm, false)
  ui.preview().props.onConfirm(); ui.render()
  assert.equal(updates, 0)
  assert.equal(ui.confirmations.length, 0)
  assert.equal(ui.field('Transfer department').props.value, 'Design')
  assert.match(ui.alerts().join(' '), /temporary fields or simulation date changed/)
})

test('rehire refuses to discard a retained sibling draft and read-only roles cannot submit through callbacks', () => {
  const ui = harness()
  let updates = 0
  const initial = props({ onAction() { updates++; return true } })
  ui.render(initial)
  ui.change('Transfer department', 'Retained draft')
  ui.render({ ...initial, employee: { ...employee, employmentStatus: 'terminated' } })
  ui.change('Rehire start date', '2026-10-15')
  ui.submit('rehire')
  ui.preview().props.onConfirm(); ui.render()
  assert.equal(updates, 0)
  assert.equal(ui.groups.get(transferId).isDirty(), true)
  assert.match(ui.alerts().join(' '), /explicitly discard/)
  const readonly = harness()
  readonly.render(props({ actor: { role: 'payroll-admin' }, onAction() { assert.fail('Read-only role must not invoke update') } }))
  assert.equal(readonly.field('Transfer department').props.disabled, true)
  readonly.submit('transfer')
  assert.equal(readonly.preview(), undefined)
  assert.match(readonly.alerts().join(' '), /read-only/)
})
