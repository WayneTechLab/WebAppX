import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { loadMockModel } from '../browser/model-loader.mjs'

const root = new URL('../../src/portals/', import.meta.url)
const modules = {}
for (const name of ['storage-presentation', 'registry', 'backup', 'combined-backup', 'workspace-summaries', 'restore-budget', 'restore-points', 'workspaces']) modules[`./${name}`] = await loadMockModel(new URL(`${name}.ts`, root))
const { createDemoWorkspaces } = modules['./workspaces']
const { createDemoBackup } = modules['./backup']
const { createCombinedBackup } = modules['./combined-backup']
const { previewRestoreBudget } = modules['./restore-budget']
const { createRestorePoint } = modules['./restore-points']
const boundary = 'Refresh starts fresh fictional records and keeps walkthrough mode on. Existing browser saves are untouched.'
const timestamp = '2026-10-15T06:00:00.000Z'
const jsx = (type, props) => ({ type, props: props ?? {} })
const compiled = new Map()
for (const name of ['DemoStorageNotice', 'DemoWorkspaceBackup', 'DemoWorkspaceReset', 'RecoveryCheckpointPreview', 'RestorePointControls', 'RestoreBudgetPreview', 'RestorePointHistory', 'CombinedWorkspaceBackup']) {
  const source = await readFile(new URL(`${name}.tsx`, root), 'utf8')
  compiled.set(name, ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText)
}

function nodes(root, predicate) {
  if (Array.isArray(root)) return root.flatMap(item => nodes(item, predicate))
  if (!root || typeof root !== 'object') return []
  return [...(predicate(root) ? [root] : []), ...nodes(root.props.children, predicate)]
}
function text(root) {
  if (Array.isArray(root)) return root.map(text).join('')
  if (root === null || root === undefined || typeof root === 'boolean') return ''
  return typeof root === 'object' ? text(root.props.children) : String(root)
}
function one(view, predicate, label) {
  const matching = nodes(view, predicate)
  assert.equal(matching.length, 1, label)
  return matching[0]
}
const button = (view, label) => one(view, node => node.type === 'button' && text(node) === label, label)
const paragraphs = view => nodes(view, node => node.type === 'p').map(text)
const fileInput = view => one(view, node => node.type === 'input' && node.props.type === 'file', 'file input')
const alerts = view => text(nodes(view, node => node.props.role === 'alert'))
const statuses = view => text(nodes(view, node => node.props.role === 'status'))

/** Actual component code and its callbacks. Only React scheduling, browser focus
 * effects and the provider port are deterministic boundaries. File parsers,
 * workspace validation, history projection and storage presentation are real.
 */
function harness(name, { mode = 'browser', bundle, props = {}, exported = name } = {}) {
  const slots = []
  let cursor = 0
  const useState = initial => {
    const index = cursor++
    if (!Object.hasOwn(slots, index)) slots[index] = typeof initial === 'function' ? initial() : initial
    return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next }]
  }
  const useRef = initial => {
    const index = cursor++
    if (!Object.hasOwn(slots, index)) slots[index] = { current: initial }
    return slots[index]
  }
  const useId = () => {
    const index = cursor++
    if (!Object.hasOwn(slots, index)) slots[index] = `presentation-id-${index}`
    return slots[index]
  }
  const child = () => null
  const dependencies = {
    ...modules,
    react: { useState, useRef, useId, useEffect() {} },
    'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'fragment' },
    './portal-runtime-context': { usePortalRuntime: () => ({ mode }) },
    './PortalWorkspaceProvider': { usePortalWorkspaceBundle: () => bundle },
    './RecoveryCheckpointPreview': { RecoveryCheckpointPreview: child },
    './RestoreBudgetPreview': { RestoreBudgetPreview: child },
    './WorkspaceInspection': { WorkspaceDifferencePreview: child, WorkspaceInspection: child },
    './RestorePointControls': { ManualRestorePoint: child, RestorePointLabel: child },
  }
  const exports = {}
  new Function('require', 'exports', compiled.get(name))(request => {
    assert.ok(Object.hasOwn(dependencies, request), `explicit component dependency ${request}`)
    return dependencies[request]
  }, exports)
  return { render() { cursor = 0; return exports[exported](props) } }
}

function recovery(overrides = {}) {
  return {
    settings: { preferences: { beforeImport: true, beforeReset: true } },
    previewImport: () => checkpoint,
    previewReset: () => checkpoint,
    setPreference() { throw new Error('unexpected setting action') },
    ...overrides,
  }
}
const checkpoint = {
  ok: true, required: true, canReplace: true, confirmation: 'exact-reviewed-input',
  message: 'A required HR-only checkpoint will save the current complete records before Reset.',
  newPointCharacters: 1200, projectedHistoryCharacters: 1300, retainedPoints: 1, prunedPoints: 0, historyLimit: 2000000,
}
async function upload(view, content, name) {
  await fileInput(view).props.onChange({ currentTarget: { files: [{ size: Buffer.byteLength(content), name, text: async () => content }], value: name } })
}

test('actual notice keeps default browser status/warning markup and changes walkthrough copy only', () => {
  const status = { kind: 'saved', message: "CRM sample saved in this browser. It will be restored after refresh. Reset removes only this portal's saved sample." }
  const browser = harness('DemoStorageNotice', { props: { status } }).render()
  assert.equal(browser.props.role, 'status')
  assert.equal(browser.props['aria-live'], 'polite')
  assert.equal(text(browser), `Browser save. ${status.message}`)
  assert.match(browser.props.className, /border-emerald-200/)
  const walkthrough = harness('DemoStorageNotice', { mode: 'walkthrough', props: { status } }).render()
  assert.equal(text(walkthrough), `Walkthrough memory. CRM sample saved in walkthrough memory. It stays only in walkthrough memory. Reset clears only this portal's walkthrough sample. ${boundary}`)
  assert.equal(walkthrough.props.className, browser.props.className)
  const failed = harness('DemoStorageNotice', { mode: 'walkthrough', props: { status: { kind: 'unavailable', message: 'This browser could not read restore-point history. Allow browser storage before restoring or undoing.' } } }).render()
  assert.match(failed.props.className, /border-amber-300/)
  assert.match(text(failed), /^Walkthrough memory needs attention\. The walkthrough memory store could not read restore-point history/)
})

test('actual checkpoint and budget views retain literal browser text and walkthrough limits/refusal reasons', () => {
  const states = createDemoWorkspaces()
  const budget = previewRestoreBudget(states, states, ['cms'], [])
  assert.equal(budget.ok, true)
  const browser = harness('RecoveryCheckpointPreview', { props: { preview: checkpoint } }).render()
  assert.ok(paragraphs(browser).includes('Preview writes nothing and does not reserve browser quota. Confirmation rechecks current records, settings, history and storage. Changed review facts refuse replacement and require a refreshed review. A required checkpoint must save before replacement.'))
  const walk = harness('RecoveryCheckpointPreview', { mode: 'walkthrough', props: { preview: checkpoint } }).render()
  assert.match(text(walk), /Preview writes nothing and reserves no memory capacity/)
  assert.match(text(walk), /required memory checkpoint must save before replacement/)
  assert.doesNotMatch(text(walk), /browser quota/)
  const b = harness('RestoreBudgetPreview', { props: { budget, onRefresh() {} } }).render()
  assert.equal(text(one(b, node => node.type === 'caption', 'budget caption')), 'Selected workspace browser saves')
  assert.ok(paragraphs(b).includes('Sizes count serialized characters, including save envelopes. Current history is measured as compact recovery data; projected history includes retention pruning. Browser quota and other site data are unknown. This preview writes or reserves nothing. Confirmation rechecks the records and saves a restore point before replacing selected portals.'))
  const reason = 'CMS exceeds the 2,000,000-character browser save limit. Reduce its mock workspace data before trying again.'
  const w = harness('RestoreBudgetPreview', { mode: 'walkthrough', props: { budget: { ...budget, canRestore: false, reason }, onRefresh() {} } }).render()
  assert.equal(text(one(w, node => node.type === 'caption', 'memory budget caption')), 'Selected workspace memory saves')
  assert.match(alerts(w), /^CMS exceeds the 2,000,000-character walkthrough memory save limit\. Reduce its mock workspace data before trying again\./)
  assert.match(alerts(w), /Restore is unavailable until the selected workspaces fit/)
  assert.match(text(w), /Existing template size and history limits still apply/)
  assert.doesNotMatch(text(w), /browser quota|browser save limit/)
})

test('actual individual import retains raw Unicode filename/record summary and calls port with exact reviewed state', async () => {
  for (const mode of ['browser', 'walkthrough']) {
    const state = { literal: 'Saved actions survive refresh; record body' }
    const validate = value => typeof value?.literal === 'string'
    const filename = '名称 browser save — Saved actions survive refresh;.json'
    const calls = []
    const fixture = harness('DemoWorkspaceBackup', { mode, props: {
      module: 'hr', state, validate, summarize: value => value.literal, recovery: recovery(),
      onImport(value, confirmation) {
        calls.push([value, confirmation])
        return { ok: true, status: { kind: 'saved', message: 'HR workspace imported and saved. A required HR-only checkpoint was saved first. Other workspaces and unrelated browser data are unchanged.' } }
      },
    } })
    await upload(fixture.render(), createDemoBackup('hr', state, validate, timestamp), filename)
    let view = fixture.render()
    assert.ok(nodes(view, node => node.type === 'dd').map(text).includes(filename))
    assert.ok(nodes(view, node => node.type === 'dd').map(text).includes(state.literal))
    assert.ok(paragraphs(view).includes(mode === 'browser'
      ? 'This replaces the current HR mock workspace and its browser save. It does not merge records. Continue only if this is the backup you want to use.'
      : 'This replaces the current HR walkthrough workspace and its memory save. It does not merge records or change existing browser saves. Refresh starts fresh fictional records and keeps walkthrough mode on. Continue only if this is the backup you want to use.'))
    button(view, 'Replace HR workspace').props.onClick()
    assert.deepEqual(calls, [[state, 'exact-reviewed-input']])
    view = fixture.render()
    assert.equal(button(view, 'Import workspace').props.disabled, false)
    assert.match(statuses(view), mode === 'browser' ? /^HR workspace imported and saved\./ : /^HR workspace imported and saved in walkthrough memory\./)
    assert.equal(statuses(view).endsWith(boundary), mode === 'walkthrough')
  }
})

test('actual settings callbacks keep arguments/error role and malformed-file reasons remain verbatim', async () => {
  const calls = []
  const fixture = harness('DemoWorkspaceBackup', { mode: 'walkthrough', props: {
    module: 'cms', state: {}, validate: () => true, summarize: () => 'Fictional records', onImport() { throw new Error('must not import') },
    recovery: recovery({ setPreference(key, checked) {
      calls.push([key, checked])
      return { ok: false, status: { kind: 'unavailable', message: 'Recovery settings could not be saved or their rollback confirmed. Review settings after browser storage is available. Workspace saves and restore-point history were not changed.' } }
    } }),
  } })
  let view = fixture.render()
  assert.match(text(view), /Both settings start off and apply to this walkthrough only/)
  const checkboxes = nodes(view, node => node.type === 'input' && node.props.type === 'checkbox')
  checkboxes[1].props.onChange({ currentTarget: { checked: false } })
  assert.deepEqual(calls, [['beforeReset', false]])
  view = fixture.render()
  assert.equal(alerts(view), `Recovery settings could not be saved or their rollback confirmed. Review settings after walkthrough memory storage is available. Workspace saves and restore-point history were not changed. ${boundary}`)
  const failure = '名称 browser save — Saved actions survive refresh; file refused.'
  await fileInput(view).props.onChange({ currentTarget: { files: [{ name: 'bad.json', size: 12, text: async () => { throw new Error(failure) } }], value: '' } })
  assert.equal(alerts(fixture.render()), `${failure} Current workspace unchanged.`)
  assert.deepEqual(calls, [['beforeReset', false]])
})

test('actual Reset confirms exact preview token, preserves failure details and Cancel does not call Reset', () => {
  for (const mode of ['browser', 'walkthrough']) {
    const calls = []
    const fixture = harness('DemoWorkspaceReset', { mode, props: { module: 'hr', recovery: recovery(), onReset(confirmation) {
      calls.push(confirmation)
      return { ok: false, status: { kind: 'unavailable', message: 'The required checkpoint and Reset could not both be saved. Exact previous history and selected save bytes were restored. The current in-memory workspace remains open; no replacement was accepted.' } }
    } } })
    button(fixture.render(), 'Reset HR demo').props.onClick()
    let view = fixture.render()
    assert.match(text(view), mode === 'browser' ? /removes only its browser save\./ : /removes only its walkthrough memory save; existing browser saves are untouched/)
    button(view, 'Keep HR workspace').props.onClick()
    assert.deepEqual(calls, [])
    assert.equal(statuses(fixture.render()), mode === 'browser' ? 'Reset canceled. Workspace saves and history are unchanged.' : 'Reset canceled. Walkthrough memory saves and history are unchanged. Existing browser saves are untouched.')
    button(fixture.render(), 'Reset HR demo').props.onClick()
    button(fixture.render(), 'Confirm Reset HR').props.onClick()
    view = fixture.render()
    assert.deepEqual(calls, ['exact-reviewed-input'])
    assert.match(alerts(view), /Exact previous history and selected save bytes were restored/)
    assert.match(alerts(view), /no replacement was accepted/)
    assert.equal(alerts(view).endsWith(boundary), mode === 'walkthrough')
    assert.equal(nodes(view, node => node.props['aria-label'] === 'HR Reset confirmation').length, 1, 'failed operation keeps confirmation open')
  }
})

test('actual named capture preserves raw label/selection and browser default availability wording', () => {
  for (const mode of ['browser', 'walkthrough']) {
    const states = createDemoWorkspaces()
    const calls = [], results = []
    const result = { ok: true, status: { kind: 'saved', message: 'Named restore point saved in this browser. Current workspaces and browser saves are unchanged.' } }
    const fixture = harness('RestorePointControls', { mode, exported: 'ManualRestorePoint', props: {
      states, history: { points: [] }, onCreate(selected, label) { calls.push([selected, label]); return result }, onResult: value => results.push(value),
    } })
    let view = fixture.render()
    const name = 'Saved actions survive refresh; 名称'
    one(view, node => node.type === 'input' && node.props.type !== 'checkbox', 'point label').props.onChange({ target: { value: name } })
    nodes(view, node => node.type === 'input' && node.props.type === 'checkbox')[2].props.onChange({ target: { checked: true } })
    view = fixture.render()
    assert.match(text(view), mode === 'browser' ? /Browser storage availability is checked when saving\./ : /Walkthrough memory storage is checked when saving\./)
    assert.equal(button(view, 'Create named restore point').props.disabled, false)
    one(view, node => node.type === 'form', 'capture form').props.onSubmit({ preventDefault() {} })
    assert.deepEqual(calls, [[['crm'], name]])
    assert.equal(results[0], result, 'child callback preserves exact result for provider/parent')
    assert.equal(one(fixture.render(), node => node.type === 'input' && node.props.type !== 'checkbox', 'cleared label').props.value, '')
  }
})

test('actual history Undo/rename/clear callbacks retain point labels, exact preview binding and uncertainty guidance', () => {
  const states = createDemoWorkspaces()
  const point = createRestorePoint(states, ['cms'], 'manual', undefined, { id: 'named-point', createdAt: timestamp, label: 'Saved actions survive refresh; 名称' })
  for (const mode of ['browser', 'walkthrough']) {
    const calls = []
    const bundle = {
      states, history: { points: [point] }, refreshHistory() {}, createPoint() {},
      undo(id, expected) { calls.push(['undo', id, expected]); return { ok: false, recoveryRequired: true, status: { kind: 'unavailable', message: 'Restore failed and this browser could not roll back: CMS save. Those browser slots may differ from their previous values. The current in-memory workspaces remain open. Keep this tab open and export the current workspaces before refreshing. Allow browser storage or free space, then recover the selected saves. Unselected workspace saves and unrelated browser data were not changed.' } } },
      renamePoint(id, label) { calls.push(['rename', id, label]); return { ok: true, status: { kind: 'saved', message: 'Restore-point label saved. Its captured records, scope and creation time are unchanged. Current workspaces and browser saves are unchanged.' } } },
      clearHistory() { calls.push(['clear']); return { ok: true, status: 'Restore points cleared. HR, CMS and CRM workspace saves are unchanged.' } },
    }
    const fixture = harness('RestorePointHistory', { mode, bundle })
    let view = fixture.render()
    assert.match(text(view), /Saved actions survive refresh; 名称 · CMS/)
    assert.match(text(view), mode === 'browser' ? /Restore points survive refresh at this browser address\./ : /Restore points stay only in walkthrough memory\./)
    const rename = one(view, node => typeof node.type === 'function' && typeof node.props.onSave === 'function', 'rename port')
    rename.props.onSave('browser save — new 名称')
    assert.deepEqual(calls.shift(), ['rename', 'named-point', 'browser save — new 名称'])
    view = fixture.render()
    assert.match(statuses(view), /^Restore-point label saved\. Its captured records, scope and creation time are unchanged/)
    button(view, 'Undo…').props.onClick({ currentTarget: {} })
    button(fixture.render(), 'Confirm undo').props.onClick()
    view = fixture.render()
    assert.equal(calls[0][0], 'undo')
    assert.equal(calls[0][1], 'named-point')
    assert.equal(calls[0][2], point, 'exact displayed source point remains the confirmation binding')
    assert.match(alerts(view), /CMS save/)
    assert.match(alerts(view), /Keep this page open and export all (?:current )?workspaces before refreshing/)
    if (mode === 'walkthrough') {
      assert.match(alerts(view), /Walkthrough memory saves or history may need recovery/)
      assert.match(alerts(view), /Refresh discards this session’s records and history; existing browser saves are untouched/)
    }
    button(view, 'Clear restore points').props.onClick({ currentTarget: {} })
    view = fixture.render()
    assert.match(text(view), mode === 'browser' ? /This removes only the restore history at this browser address\./ : /This removes only this walkthrough’s memory history\./)
    button(view, 'Confirm clear restore points').props.onClick()
    assert.deepEqual(calls.at(-1), ['clear'])
    assert.match(statuses(fixture.render()), /^Restore points cleared\. HR, CMS and CRM workspace saves are unchanged\./)
  }
})

test('actual combined upload/select/restore preserves file labels, exact module selection and uncertain-memory advice', async () => {
  for (const mode of ['browser', 'walkthrough']) {
    const states = createDemoWorkspaces()
    const target = structuredClone(states)
    target.cms.entries[1].title = 'Saved actions survive refresh; literal CMS title'
    const before = JSON.stringify({ states, target })
    const calls = []
    const fixture = harness('CombinedWorkspaceBackup', { mode, bundle: {
      states, history: { points: [] }, refreshHistory() {},
      restore(value, modules) { calls.push([value, modules]); return { ok: false, recoveryRequired: true, status: { kind: 'unavailable', message: 'Restore failed and this browser could not roll back: CMS save, restore-point history. Those browser slots may differ from their previous values. The current in-memory workspaces remain open. Keep this tab open and export the current workspaces before refreshing. Allow browser storage or free space, then recover the selected saves. Unselected workspace saves and unrelated browser data were not changed.' } } },
    } })
    const filename = '名称 browser save — Saved actions survive refresh;.json'
    await upload(fixture.render(), createCombinedBackup(target, timestamp), filename)
    let view = fixture.render()
    assert.ok(nodes(view, node => node.type === 'dd').map(text).includes(filename))
    assert.equal(button(view, 'Restore selected workspaces').props.disabled, true)
    nodes(view, node => node.type === 'input' && node.props.type === 'checkbox')[1].props.onChange({ target: { checked: true } })
    view = fixture.render()
    assert.match(text(view), mode === 'browser' ? /CMS will be replaced and saved after an automatic restore point is saved\./ : /CMS will be replaced and saved only in walkthrough memory after a memory restore point is saved\./)
    assert.equal(button(view, 'Restore selected workspaces').props.disabled, false)
    button(view, 'Restore selected workspaces').props.onClick()
    assert.deepEqual(calls, [[target, ['cms']]])
    view = fixture.render()
    assert.match(alerts(view), /CMS save, restore-point history/)
    assert.match(alerts(view), /current in-memory workspaces remain open/)
    assert.match(alerts(view), /Keep this page open and export all (?:current )?workspaces before refreshing/)
    if (mode === 'walkthrough') {
      assert.match(alerts(view), /Walkthrough memory saves may have changed/)
      assert.match(alerts(view), /Refresh discards walkthrough records and history; existing browser saves are untouched/)
      assert.doesNotMatch(alerts(view), /when browser storage is available/)
    }
    assert.equal(JSON.stringify({ states, target }), before)
    button(view, 'Cancel combined restore').props.onClick()
    assert.equal(statuses(fixture.render()), 'Combined restore canceled. Current workspaces unchanged.')
    assert.equal(calls.length, 1)
  }
})
