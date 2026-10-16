import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

const source = await readFile(new URL('../../src/hr/components/HrPayrollControl.tsx', import.meta.url), 'utf8')
const helperSource = await readFile(new URL('../../src/hr/components/useHrFormDraft.ts', import.meta.url), 'utf8')
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText
const helperAst = ts.createSourceFile('useHrFormDraft.ts', helperSource, ts.ScriptTarget.Latest, true)
const helpers = new Function(helperAst.statements.filter(node => ts.isFunctionDeclaration(node) && ['createHrFormDraft', 'normalizeHrFormValue'].includes(node.name?.text)).map(node => compile(node.getText()).replace(/^export /gm, '')).join('\n') + '\nreturn {createHrFormDraft,normalizeHrFormValue}')()
const compiled = compile(source).replace(/^import .*;\n/gm, '').replace(/^export /gm, '')
const clone = value => structuredClone(value)
const original = { grossCents: 24000, illustrativeWithholdingCents: 4800, benefitDeductionCents: 2500, netCents: 16700 }
const proposed = { grossCents: 27000, illustrativeWithholdingCents: 5400, benefitDeductionCents: 2500, netCents: 19100 }
const delta = { grossCents: 3000, illustrativeWithholdingCents: 600, benefitDeductionCents: 0, netCents: 2400 }
const receipts = [{ receipt: 'MOCK-PAYROLL-0003', period: { start: '2026-10-01', end: '2026-10-15' }, employees: [{ employeeId: 'employee-002', original, cumulative: original }] }]
const writerView = { mode: 'writer', receipts, closures: [], adjustments: [] }
const closurePreview = { kind: 'close-period', period: { start: '2026-10-01', end: '2026-10-15' }, receiptIds: ['MOCK-PAYROLL-0003', 'MOCK-PAYROLL-0008'], entryCount: 3, pendingPayrollBecomesStale: true, recordedOn: '2026-10-16', reason: 'Close fictional period', effect: 'All employees in this date window are locked against new time and overlapping preparation.' }
const adjustmentPreview = { kind: 'adjust-receipt', originalReceipt: 'MOCK-PAYROLL-0003', employeeId: 'employee-002', period: { start: '2026-10-01', end: '2026-10-15' }, previousAdjustmentId: null, original, previous: original, proposed, delta, recordedOn: '2026-10-16', reason: 'Manual fictional correction', effect: 'Append one separate adjustment; original pay history is unchanged.' }

/** Actual component callbacks with deterministic hook slots and a narrow port
 * double. These tests make no DOM, browser-focus or domain-acceptance claim. */
function harness(name) {
  const slots = [], groups = new Map(), requests = [], focused = [], effects = new Map()
  let cursor = 0, tree, props
  const dependencies = {
    ...helpers,
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }] },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial } },
    useEffect(effect, deps) { const index = cursor++, previous = effects.get(index); if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) { previous?.cleanup?.(); effects.set(index, { deps, cleanup: effect() }) } },
    useUnsavedWork(group) { groups.set(group.id, group) },
    useUnsavedTransition: () => (options, commit) => { requests.push({ options, commit }); return false },
    focusHrForm: id => focused.push(id),
    document: { getElementById: id => ({ focus() { focused.push(id) } }) },
    React: { createElement(type, incoming, ...children) { return { type, props: { ...incoming, children } } } },
  }
  const component = new Function(...Object.keys(dependencies), `${compiled}\nreturn ${name}`)(...Object.values(dependencies))
  return {
    groups, requests, focused,
    render(next = props) { props = next; cursor = 0; groups.clear(); tree = component(props); return tree },
    unmount() { for (const { cleanup } of effects.values()) cleanup?.() },
    nodes(predicate) { const result = []; const visit = node => { if (Array.isArray(node)) return node.forEach(visit); if (!node || typeof node !== 'object') return; if (predicate(node)) result.push(node); visit(node.props?.children) }; visit(tree); return result },
  }
}
function text(node) { return Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : node == null || typeof node === 'boolean' ? '' : String(node) }
const control = (ui, id) => ui.nodes(node => ['input', 'select', 'textarea'].includes(node.type) && node.props.id === id)[0]
function change(ui, id, value) { const found = control(ui, id); assert.ok(found, id); found.props.onChange({ target: { value } }); ui.render() }
const submit = ui => { ui.nodes(node => node.type === 'form')[0].props.onSubmit({ preventDefault() {} }); ui.render() }
const preview = ui => ui.nodes(node => node.type?.name === 'PayrollPreview')[0]
const summary = ui => ui.nodes(node => node.type?.name === 'ErrorSummary')[0].props.issues
function api() {
  const calls = { preview: [], confirm: [], cancel: [] }
  let next = 0, failure = null, previewFailure = null, override = null
  const port = {
    preview(command) { calls.preview.push(clone(command)); return previewFailure ?? { ok: true, handle: `private-${++next}`, preview: clone(override ?? (command.kind === 'close-period' ? closurePreview : adjustmentPreview)) } },
    confirm(request) { calls.confirm.push(clone(request)); return failure ?? { ok: true, feedback: 'Accepted in memory. Browser save unavailable; export this workspace.', view: clone(writerView) } },
    cancel(handle) { calls.cancel.push(handle) },
  }
  return { port, calls, fail(value) { failure = value }, refusePreview(value) { previewFailure = value }, previewAs(value) { override = value } }
}
function setupCorrection() {
  const stub = api(), ui = harness('CorrectionForm'), props = { receipts: clone(receipts), port: stub.port }
  ui.render(props)
  change(ui, 'payroll-correction-receipt', 'MOCK-PAYROLL-0003'); ui.requests.at(-1).commit(); ui.render()
  change(ui, 'payroll-correction-employee', 'employee-002'); ui.requests.at(-1).commit(); ui.render()
  return { stub, ui, props }
}
function fillCorrection(ui) {
  change(ui, 'payroll-correction-date', '2026-10-16')
  change(ui, 'payroll-correction-reason', '  Manual fictional correction  ')
  change(ui, 'payroll-correction-gross', '270.00')
  change(ui, 'payroll-correction-withholding', '54.00')
}
function setupClosure() {
  const stub = api(), ui = harness('ClosureForm'), guarded = []
  const props = { receipts: clone(receipts), port: stub.port, guardClosure(commit) { guarded.push(commit); return false } }
  ui.render(props)
  change(ui, 'payroll-closure-period', 'MOCK-PAYROLL-0003'); ui.requests.at(-1).commit(); ui.render()
  change(ui, 'payroll-closure-date', '2026-10-16'); change(ui, 'payroll-closure-reason', '  Close fictional period  ')
  return { stub, ui, props, guarded }
}

test('correction custom summary reports every blank field in control order, links exact IDs, and requests first-invalid focus', () => {
  const ui = harness('CorrectionForm'), stub = api(); ui.render({ receipts: clone(receipts), port: stub.port }); submit(ui)
  assert.equal(ui.nodes(node => node.type === 'form')[0].props.noValidate, true)
  assert.deepEqual(summary(ui).map(issue => issue.field), ['payroll-correction-receipt', 'payroll-correction-employee', 'payroll-correction-date', 'payroll-correction-reason', 'payroll-correction-gross', 'payroll-correction-withholding', 'payroll-correction-benefits'])
  assert.deepEqual(ui.focused, ['payroll-correction-receipt']); assert.equal(stub.calls.preview.length, 0)
  assert.equal(control(ui, 'payroll-correction-receipt').props['aria-invalid'], true)
  assert.equal(control(ui, 'payroll-correction-receipt').props['aria-describedby'], 'payroll-correction-receipt-error')
  const errors = harness('ErrorSummary'); errors.render({ issues: summary(ui), label: 'Payroll correction field errors' })
  const links = errors.nodes(node => node.type === 'a'); assert.deepEqual(links.map(link => link.props.href), summary(ui).map(issue => `#${issue.field}`))
  links[2].props.onClick({ preventDefault() {} }); assert.deepEqual(errors.focused, ['payroll-correction-date'])
})

test('exact monetary parsing refuses exponent, negative zero, fractions of cents, overbounds and negative net without any preview', () => {
  for (const value of ['1e2', '-0', '270.001', '10000000000.01', 'Infinity', '1.2junk']) {
    const { ui, stub } = setupCorrection(); fillCorrection(ui); change(ui, 'payroll-correction-gross', value); submit(ui)
    assert.ok(summary(ui).some(issue => issue.field === 'payroll-correction-gross'), value)
    assert.equal(stub.calls.preview.length, 0); assert.equal(control(ui, 'payroll-correction-gross').props.value, value)
    assert.equal(ui.groups.get('hr:payroll-control:correction').isDirty(), true)
  }
  const { ui, stub } = setupCorrection(); fillCorrection(ui); change(ui, 'payroll-correction-gross', '1.00'); submit(ui)
  assert.match(summary(ui).find(issue => issue.field === 'payroll-correction-withholding').message, /must not exceed/); assert.equal(stub.calls.preview.length, 0)
})

test('preview sends exact independent cents; cancel preserves raw text and dirty baseline while invalidating only that handle', () => {
  const { ui, stub } = setupCorrection(); fillCorrection(ui); submit(ui)
  assert.deepEqual(stub.calls.preview, [{ kind: 'adjust-receipt', originalReceipt: 'MOCK-PAYROLL-0003', employeeId: 'employee-002', recordedOn: '2026-10-16', reason: 'Manual fictional correction', proposed: { grossCents: 27000, illustrativeWithholdingCents: 5400, benefitDeductionCents: 2500 } }])
  assert.equal(stub.calls.confirm.length, 0)
  const staleConfirm = preview(ui).props.onConfirm
  preview(ui).props.onCancel(); ui.render(); staleConfirm(); ui.render()
  assert.deepEqual(stub.calls.cancel, ['private-1']); assert.equal(stub.calls.confirm.length, 0)
  assert.equal(control(ui, 'payroll-correction-reason').props.value, '  Manual fictional correction  ')
  assert.equal(ui.groups.get('hr:payroll-control:correction').isDirty(), true)
})

test('successful memory acceptance clears only its own baseline, reports save warning, and never retries on saved-state feedback', () => {
  const sibling = setupClosure()
  const { ui, stub } = setupCorrection(); fillCorrection(ui); submit(ui); const confirm = preview(ui).props.onConfirm
  confirm(); confirm(); ui.render()
  assert.deepEqual(stub.calls.confirm, [{ kind: 'adjust-receipt', handle: 'private-1' }])
  assert.equal(ui.groups.get('hr:payroll-control:correction').isDirty(), false)
  assert.equal(sibling.ui.groups.get('hr:payroll-control:closure').isDirty(), true)
  assert.equal(control(ui, 'payroll-correction-reason').props.value, '  Manual fictional correction  ')
  assert.match(text(ui.nodes(node => node.props?.role === 'status')), /Accepted in memory.*Browser save unavailable/)
  change(ui, 'payroll-correction-gross', '270'); change(ui, 'payroll-correction-reason', 'Manual fictional correction')
  assert.equal(ui.groups.get('hr:payroll-control:correction').isDirty(), false)
})

test('stale confirmation consumes the pending UI handle but retains exact inputs and dirty state until explicit re-preview', () => {
  const { ui, stub } = setupCorrection(); fillCorrection(ui); submit(ui)
  stub.fail({ ok: false, code: 'stale', message: 'Reviewed source changed. Preview again; no domain write occurred.' })
  preview(ui).props.onConfirm(); ui.render()
  assert.equal(preview(ui), undefined); assert.equal(stub.calls.confirm.length, 1)
  assert.equal(control(ui, 'payroll-correction-reason').props.value, '  Manual fictional correction  ')
  assert.equal(ui.groups.get('hr:payroll-control:correction').isDirty(), true)
  assert.match(text(ui.nodes(node => node.props?.role === 'alert')), /Reviewed source changed/)
  assert.equal(stub.calls.preview.length, 1)
})

test('editing, explicit discard and unmount cancel private previews; captured prior confirm callbacks cannot write', () => {
  const { ui, stub } = setupCorrection(); fillCorrection(ui); submit(ui)
  let old = preview(ui).props.onConfirm; change(ui, 'payroll-correction-reason', 'Another manual reason'); old(); ui.render()
  assert.equal(stub.calls.confirm.length, 0); assert.deepEqual(stub.calls.cancel, ['private-1'])
  submit(ui); old = preview(ui).props.onConfirm; ui.groups.get('hr:payroll-control:correction').discard(); old(); ui.render()
  assert.equal(stub.calls.confirm.length, 0); assert.equal(ui.groups.get('hr:payroll-control:correction').isDirty(), false)
  fillCorrection(ui); submit(ui); old = preview(ui).props.onConfirm; ui.unmount(); old()
  assert.equal(stub.calls.confirm.length, 0); assert.deepEqual(stub.calls.cancel, ['private-1', 'private-2', 'private-3'])
})

test('receipt and employee switches wait for the scoped dirty decision; Keep preserves target and Discard acceptance loads explicit chosen target', () => {
  const { ui, props } = setupCorrection(); fillCorrection(ui)
  const next = { ...props, receipts: [...props.receipts, { receipt: 'MOCK-PAYROLL-0009', period: null, employees: [{ employeeId: 'employee-003', original, cumulative: proposed }] }] }
  ui.render(next); change(ui, 'payroll-correction-receipt', 'MOCK-PAYROLL-0009')
  assert.equal(control(ui, 'payroll-correction-receipt').props.value, 'MOCK-PAYROLL-0003')
  assert.deepEqual(ui.requests.at(-1).options, { portal: 'hr', ids: ['hr:payroll-control:correction'], label: 'Change payroll correction target' })
  assert.equal(control(ui, 'payroll-correction-reason').props.value, '  Manual fictional correction  ')
  ui.groups.get('hr:payroll-control:correction').discard(); ui.requests.at(-1).commit(); ui.render()
  assert.equal(control(ui, 'payroll-correction-receipt').props.value, 'MOCK-PAYROLL-0009')
  assert.equal(control(ui, 'payroll-correction-employee').props.value, '')
  change(ui, 'payroll-correction-employee', 'employee-003'); ui.requests.at(-1).commit(); ui.render()
  assert.equal(control(ui, 'payroll-correction-gross').props.value, '270.00')
  assert.match(text(ui.nodes(node => node.type === 'p')), /Unknown.*periodless/)
})

test('removed source targets stay explicit and retain exact raw inputs; they never fall back to another receipt or employee', () => {
  const { ui, props, stub } = setupCorrection(); fillCorrection(ui)
  ui.render({ ...props, receipts: [{ receipt: 'MOCK-PAYROLL-0009', period: null, employees: [{ employeeId: 'employee-003', original, cumulative: original }] }] }); submit(ui)
  assert.equal(control(ui, 'payroll-correction-receipt').props.value, 'MOCK-PAYROLL-0003')
  assert.equal(control(ui, 'payroll-correction-employee').props.value, 'employee-002')
  assert.equal(control(ui, 'payroll-correction-reason').props.value, '  Manual fictional correction  ')
  assert.deepEqual(summary(ui).map(issue => issue.field), ['payroll-correction-receipt', 'payroll-correction-employee'])
  assert.equal(stub.calls.preview.length, 0)
})

test('closure confirms only inside final trusted dirty-decision callback; Keep/queue do not consume or clean its preview', () => {
  const { ui, stub, guarded } = setupClosure(); submit(ui)
  assert.deepEqual(stub.calls.preview[0], { kind: 'close-period', period: { start: '2026-10-01', end: '2026-10-15' }, recordedOn: '2026-10-16', reason: 'Close fictional period' })
  preview(ui).props.onConfirm(); ui.render()
  assert.equal(guarded.length, 1); assert.equal(stub.calls.confirm.length, 0); assert.equal(stub.calls.cancel.length, 0)
  assert.equal(ui.groups.get('hr:payroll-control:closure').isDirty(), true); assert.ok(preview(ui))
  // Keep means the first commit is never invoked. Every explicit later Confirm rechecks the guard.
  preview(ui).props.onConfirm(); assert.equal(guarded.length, 2); guarded[1](); ui.render()
  assert.deepEqual(stub.calls.confirm, [{ kind: 'close-period', handle: 'private-1' }]); assert.equal(ui.groups.get('hr:payroll-control:closure').isDirty(), false)
})

test('queued closure discard then stale confirmation preserves closure text; editing after queue prevents the captured confirmation', () => {
  const { ui, stub, guarded } = setupClosure(); submit(ui); preview(ui).props.onConfirm()
  stub.fail({ ok: false, code: 'stale', message: 'Current source changed after explicitly discarding listed time drafts.' })
  guarded[0](); ui.render()
  assert.equal(control(ui, 'payroll-closure-reason').props.value, '  Close fictional period  ')
  assert.equal(ui.groups.get('hr:payroll-control:closure').isDirty(), true)
  submit(ui); preview(ui).props.onConfirm(); change(ui, 'payroll-closure-reason', 'Changed closure reason'); guarded[1](); ui.render()
  assert.equal(stub.calls.confirm.length, 1); assert.deepEqual(stub.calls.cancel, ['private-2'])
})

test('unresolved or overlapping closure refusal preserves every field without dirty-guard or confirm side effects', () => {
  const { ui, stub, guarded } = setupClosure()
  stub.refusePreview({ ok: false, code: 'invalid', message: 'An unpaid entry prevents company-window closure.' }); submit(ui)
  assert.equal(preview(ui), undefined); assert.equal(guarded.length, 0); assert.equal(stub.calls.confirm.length, 0); assert.equal(stub.calls.cancel.length, 0)
  assert.equal(control(ui, 'payroll-closure-date').props.value, '2026-10-16')
  assert.equal(control(ui, 'payroll-closure-reason').props.value, '  Close fictional period  ')
  assert.equal(ui.groups.get('hr:payroll-control:closure').isDirty(), true)
  assert.match(text(ui.nodes(node => node.props?.role === 'alert')), /unpaid entry/)
})

test('periodless correction keeps the original period unknown and sends only the explicit entered date without a fabricated period', () => {
  const { ui, stub, props } = setupCorrection()
  ui.render({ ...props, receipts: [{ ...props.receipts[0], period: null }] }); fillCorrection(ui); change(ui, 'payroll-correction-date', '2026-01-01')
  stub.previewAs({ ...adjustmentPreview, period: null, recordedOn: '2026-01-01' }); submit(ui)
  assert.equal(stub.calls.preview[0].recordedOn, '2026-01-01'); assert.equal(Object.hasOwn(stub.calls.preview[0], 'period'), false)
  assert.equal(preview(ui).props.preview.period, null); assert.equal(summary(ui).length, 0)
  assert.match(text(ui.nodes(node => node.type === 'p')), /Unknown.*periodless/)
})

test('closure summary refuses missing period, impossible dates, early chronology and invalid reason before calling the port', () => {
  const ui = harness('ClosureForm'), stub = api(); ui.render({ receipts: clone(receipts), port: stub.port, guardClosure: () => assert.fail('Invalid form cannot guard/confirm') }); submit(ui)
  assert.deepEqual(summary(ui).map(issue => issue.field), ['payroll-closure-period', 'payroll-closure-date', 'payroll-closure-reason'])
  change(ui, 'payroll-closure-period', 'MOCK-PAYROLL-0003'); ui.requests.at(-1).commit(); ui.render()
  change(ui, 'payroll-closure-date', '2026-02-30'); change(ui, 'payroll-closure-reason', 'Line\nbreak'); submit(ui)
  assert.deepEqual(summary(ui).map(issue => issue.field), ['payroll-closure-date', 'payroll-closure-reason'])
  change(ui, 'payroll-closure-date', '2026-10-14'); change(ui, 'payroll-closure-reason', ''); submit(ui)
  assert.deepEqual(summary(ui).map(issue => issue.field), ['payroll-closure-date', 'payroll-closure-reason'])
  assert.equal(ui.focused.at(-1), 'payroll-closure-date')
  assert.match(summary(ui)[0].message, /on or after/); assert.equal(stub.calls.preview.length, 0)
})

test('Cancel restores the real preview opener callback; malformed preview families are cancelled without confirmation', () => {
  const { ui, stub } = setupCorrection(); fillCorrection(ui); submit(ui)
  const opener = ui.nodes(node => node.type === 'button' && node.props.type === 'submit')[0]
  opener.props.ref.current = { focus() { ui.focused.push('correction-preview-opener') } }
  preview(ui).props.onCancel(); ui.render()
  assert.equal(ui.focused.at(-1), 'correction-preview-opener')
  stub.previewAs(closurePreview); submit(ui)
  assert.equal(preview(ui), undefined); assert.deepEqual(stub.calls.cancel, ['private-1', 'private-2'])
  assert.equal(stub.calls.confirm.length, 0); assert.equal(ui.groups.get('hr:payroll-control:correction').isDirty(), true)
})

test('public previews disclose complete closure scope and distinct literal original, previous, delta and target monetary groups', () => {
  const ui = harness('PayrollPreview'); ui.render({ preview: clone(closurePreview), onConfirm() {}, onCancel() {} })
  assert.match(text(ui.nodes(() => true)), /MOCK-PAYROLL-0003, MOCK-PAYROLL-0008/)
  assert.match(text(ui.nodes(() => true)), /Preserved unchanged; becomes stale/)
  ui.render({ preview: clone(adjustmentPreview), onConfirm() {}, onCancel() {} })
  assert.deepEqual(ui.nodes(node => node.type?.name === 'MoneyDetails').map(node => [node.props.title, node.props.value]), [['Immutable original statement', original], ['Previous cumulative balance', original], ['Separate signed adjustment', delta], ['Proposed cumulative balance', proposed]])
  assert.equal(ui.nodes(node => node.type?.name === 'MoneyDetails' && node.props.title === 'Separate signed adjustment')[0].props.signed, true)
  assert.doesNotMatch(text(ui.nodes(() => true)), /private-/)
})

test('writer-only boundary receives no complete state; denied runtime view renders no child form, money or port call', () => {
  const ui = harness('HrPayrollControl'), forbidden = () => assert.fail('Rendering a denied view cannot call any command port')
  const tree = ui.render({ view: { mode: 'auditor', closures: [], adjustments: [], anchorCount: 0, eventCount: 0 }, port: { preview: forbidden, confirm: forbidden, cancel: forbidden }, guardClosure: forbidden })
  assert.match(text(tree), /unavailable/); assert.equal(ui.nodes(node => node.type?.name?.endsWith('Form')).length, 0)
  const ast = ts.createSourceFile('HrPayrollControl.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const imports = ast.statements.filter(ts.isImportDeclaration)
  assert.ok(imports.every(node => !/persistence|mock-workflows|controller|backend|fixture/.test(node.moduleSpecifier.text)))
  assert.ok(imports.find(node => node.moduleSpecifier.text === '../payroll-control-types').importClause.isTypeOnly)
})
