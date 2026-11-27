import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const asUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
// Exercise the actual hook and provider handlers. Only React scheduling is
// deterministic here; document lifetime, routing and UI copy belong to browsers.
const react = asUrl(`
export function useState(initial) { return globalThis.__walkthroughHooks.state(initial) }
export function useRef(initial) { return globalThis.__walkthroughHooks.ref(initial) }
export function useCallback(callback) { return callback }
export function createContext(initial) { const context = { current: initial }; context.Provider = { context }; return context }
export function useContext(context) { return context.current }
`)
const jsxRuntime = asUrl(`
export function jsx(type, props) { if (type.context) type.context.current = props.value; return { type, props } }
export const jsxs = jsx
`)
const urls = new Map()
async function load(file) {
  if (urls.has(file.href)) return import(urls.get(file.href))
  let compiled = file.pathname.endsWith('.json') ? `export default ${JSON.stringify(JSON.parse(readFileSync(file, 'utf8')))}` : ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText
  compiled = compiled.replace(/from ['"]react['"]/g, `from '${react}'`).replace(/from ['"]react\/jsx-runtime['"]/g, `from '${jsxRuntime}'`)
  for (const match of [...compiled.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g)]) {
    const relative = match[1]
    let dependency = new URL(/\.(?:tsx?|json)$/.test(relative) ? relative : `${relative}.ts`, file)
    if (!existsSync(dependency)) dependency = new URL(`${relative}.tsx`, file)
    await load(dependency)
    compiled = compiled.replace(match[0], `from '${urls.get(dependency.href)}'`)
  }
  const url = asUrl(compiled)
  urls.set(file.href, url)
  return import(url)
}
const source = path => new URL(`../../src/portals/${path}`, import.meta.url)
const { createPortalRuntime, createMemoryDemoStorage } = await load(source('portal-runtime.ts'))
const { ownedMockStorageDescriptors, isOwnedMockStorageKey } = await load(source('owned-mock-storage.ts'))
const { PortalRuntimeProvider, usePortalRuntime } = await load(source('portal-runtime-context.tsx'))
const initialRuntime = usePortalRuntime()
const { PortalWorkspaceProvider } = await load(source('PortalWorkspaceProvider.tsx'))
const { useDemoPersistence } = await load(source('useDemoPersistence.ts'))
const { createDemoWorkspaces, isDemoWorkspaces } = await load(source('workspaces.ts'))
const { RESTORE_POINTS_KEY, parseRestorePoints } = await load(source('restore-points.ts'))
const { RECOVERY_PREFERENCES_KEY } = await load(source('recovery-preferences.ts'))
const keys = ['webappx.demo.hr', 'webappx.demo.cms', 'webappx.demo.crm', 'webappx.demo.restore-points', 'webappx.demo.recovery-preferences']
const clone = value => JSON.parse(JSON.stringify(value))
const envelope = (module, data) => JSON.stringify({ schemaVersion: 1, module, data })

function hooks(t) {
  const cells = []
  let cursor = 0
  const previous = Object.getOwnPropertyDescriptor(globalThis, '__walkthroughHooks')
  const state = {
    state(initial) { const index = cursor++; if (!Object.hasOwn(cells, index)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], next => { cells[index] = typeof next === 'function' ? next(cells[index]) : next }] },
    ref(initial) { const index = cursor++; if (!Object.hasOwn(cells, index)) cells[index] = { current: initial }; return cells[index] },
  }
  t.after(() => { if (previous) Object.defineProperty(globalThis, '__walkthroughHooks', previous); else delete globalThis.__walkthroughHooks })
  return render => { globalThis.__walkthroughHooks = state; cursor = 0; return render() }
}
function browserBoundary(t, getStorage = () => { throw new Error('Browser storage must not be read') }) {
  let reads = 0
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { get localStorage() { reads += 1; return getStorage() } } })
  t.after(() => { if (previous) Object.defineProperty(globalThis, 'window', previous); else delete globalThis.window })
  return () => reads
}
function mount(t, runtime) {
  const render = hooks(t)
  return () => render(() => {
    PortalRuntimeProvider({ runtime, children: null })
    return PortalWorkspaceProvider({ children: null }).props.value
  })
}
function tracedStorage() {
  const memory = createMemoryDemoStorage()
  const calls = []
  let fail
  const storage = {
    getItem(key) { calls.push(['get', key]); if (fail?.('get', key)) throw new Error('Injected read refusal'); return memory.getItem(key) },
    setItem(key, raw) { calls.push(['set', key]); if (fail?.('set', key)) throw new Error('Injected write refusal'); memory.setItem(key, raw) },
    removeItem(key) { calls.push(['remove', key]); if (fail?.('remove', key)) throw new Error('Injected removal refusal'); memory.removeItem(key) },
  }
  return { memory, calls, storage, setFailure(next) { fail = next }, writes() { return calls.filter(([operation]) => operation !== 'get') }, resetCalls() { calls.length = 0 }, bytes() { return keys.map(key => [key, memory.getItem(key)]) } }
}

test('owned inventory is a frozen, exact five-key effect preview without browser access', t => {
  const reads = browserBoundary(t)
  assert.deepEqual(ownedMockStorageDescriptors.map(({ key, kind }) => [key, kind]), keys.map((key, index) => [key, index < 3 ? 'workspace' : index === 3 ? 'history' : 'preferences']))
  assert.ok(Object.isFrozen(ownedMockStorageDescriptors))
  for (const descriptor of ownedMockStorageDescriptors) {
    assert.ok(Object.isFrozen(descriptor))
    assert.deepEqual(Object.keys(descriptor), ['key', 'label', 'kind', 'nextLoadEffect', 'preserved'])
    assert.equal(isOwnedMockStorageKey(descriptor.key), true)
    assert.match(descriptor.nextLoadEffect, /next /)
    assert.match(descriptor.preserved, /remain/)
  }
  assert.match(ownedMockStorageDescriptors[3].nextLoadEffect, /current portal records do not change/)
  assert.match(ownedMockStorageDescriptors[4].nextLoadEffect, /both.*off/)
  for (const key of ['webappx.demo.other', 'sfwa-wtl:accessibility-preferences', 'wsg.demo.accountLevel', '__proto__']) assert.equal(isOwnedMockStorageKey(key), false)
  assert.equal(reads(), 0)
})

test('runtime construction is inert and each walkthrough has an isolated five-key string store', t => {
  const reads = browserBoundary(t)
  assert.deepEqual(createPortalRuntime(), { mode: 'browser', storage: undefined })
  assert.equal(Object.isFrozen(createPortalRuntime()), true)
  const first = createPortalRuntime('walkthrough')
  const second = createPortalRuntime('walkthrough')
  assert.equal(Object.isFrozen(first.storage), true)
  for (const key of keys) {
    assert.equal(first.storage.getItem(key), null)
    first.storage.setItem(key, '  exact serialized bytes\n')
    assert.equal(first.storage.getItem(key), '  exact serialized bytes\n')
    assert.equal(second.storage.getItem(key), null)
    first.storage.removeItem(key)
    assert.equal(first.storage.getItem(key), null)
  }
  for (const operation of ['getItem', 'setItem', 'removeItem']) assert.throws(() => first.storage[operation]('unowned.key', 'private value'), /only WebAppX/)
  assert.throws(() => first.storage.setItem(keys[0], null), /serialized strings/)
  assert.throws(() => createPortalRuntime('unexpected'), /Unknown/)
  assert.equal(reads(), 0)
})

test('canonical provider uses the same memory adapter for three saves, preferences, points, import, required Reset, restore and Undo', t => {
  const reads = browserBoundary(t)
  const fixture = tracedStorage()
  const runtime = Object.freeze({ mode: 'walkthrough', storage: fixture.storage })
  const render = mount(t, runtime)
  const seed = createDemoWorkspaces()
  const edited = clone(seed)
  edited.hr.role = 'auditor'
  edited.cms.entries[1].title = 'Fictional memory article'
  edited.crm.opportunities[0].amountCents = 333300
  assert.equal(isDemoWorkspaces(edited), true)
  let handles = render()
  assert.deepEqual(handles.bundle.states, seed)
  assert.equal(handles.bundle.mode, 'walkthrough')
  for (const module of ['hr', 'cms', 'crm']) {
    assert.equal(handles[module].mode, 'walkthrough')
    handles[module].setState(edited[module])
    assert.equal(fixture.memory.getItem(`webappx.demo.${module}`), envelope(module, edited[module]))
  }
  handles = render()
  assert.deepEqual(handles.bundle.states, edited)
  assert.equal(handles.cms.recovery.setPreference('beforeImport', true).ok, true)
  handles = render()
  assert.equal(handles.cms.recovery.setPreference('beforeReset', true).ok, true)
  handles = render()
  assert.equal(fixture.memory.getItem(RECOVERY_PREFERENCES_KEY), '{"schemaVersion":1,"beforeImport":true,"beforeReset":true}')
  assert.deepEqual(handles.hr.recovery.settings, { preferences: { beforeImport: true, beforeReset: true } })
  fixture.resetCalls()
  const manual = handles.bundle.createPoint(['cms', 'crm'], 'Before memory changes')
  assert.equal(manual.ok, true)
  assert.deepEqual(fixture.writes(), [['set', RESTORE_POINTS_KEY]])
  handles = render()
  const first = handles.bundle.history.points[0]
  assert.deepEqual(first, { id: first.id, createdAt: first.createdAt, kind: 'manual', modules: ['cms', 'crm'], states: { cms: edited.cms, crm: edited.crm }, label: 'Before memory changes' })
  assert.equal(handles.bundle.renamePoint(first.id, 'Reviewed memory checkpoint').ok, true)
  handles = render()
  assert.equal(handles.bundle.history.points[0].label, 'Reviewed memory checkpoint')
  handles.bundle.refreshHistory()
  handles = render()
  assert.deepEqual(handles.bundle.history.points, parseRestorePoints(fixture.memory.getItem(RESTORE_POINTS_KEY)))
  const imported = clone(seed.cms)
  imported.entries[1].title = 'Imported fictional memory article'
  const preview = handles.cms.recovery.previewImport(imported)
  assert.equal(preview.required, true)
  fixture.resetCalls()
  assert.equal(handles.cms.importState(imported, preview.confirmation).ok, true)
  assert.deepEqual(fixture.writes(), [['set', RESTORE_POINTS_KEY], ['set', 'webappx.demo.cms']])
  handles = render()
  assert.deepEqual(handles.bundle.states, { hr: edited.hr, cms: imported, crm: edited.crm })
  assert.deepEqual(handles.bundle.history.points[0].states, { cms: edited.cms })
  const resetPreview = handles.crm.recovery.previewReset()
  fixture.resetCalls()
  assert.equal(handles.crm.reset(resetPreview.confirmation).ok, true)
  assert.deepEqual(fixture.writes(), [['set', RESTORE_POINTS_KEY], ['remove', 'webappx.demo.crm']])
  handles = render()
  assert.deepEqual(handles.bundle.states, { hr: edited.hr, cms: imported, crm: seed.crm })
  assert.deepEqual(handles.bundle.history.points[0].states, { crm: edited.crm })
  fixture.resetCalls()
  const restored = handles.bundle.restore(seed, ['cms', 'hr'])
  assert.equal(restored.ok, true)
  assert.deepEqual(fixture.writes(), [['set', RESTORE_POINTS_KEY], ['set', 'webappx.demo.cms'], ['set', 'webappx.demo.hr']])
  handles = render()
  assert.deepEqual(handles.bundle.states, seed)
  assert.deepEqual(handles.bundle.revisions, { hr: 1, cms: 1, crm: 0 })
  assert.deepEqual(restored.point.states, { hr: edited.hr, cms: imported })
  fixture.resetCalls()
  assert.equal(handles.bundle.undo(restored.point.id, restored.point).ok, true)
  assert.deepEqual(fixture.writes(), [['set', RESTORE_POINTS_KEY], ['set', 'webappx.demo.cms'], ['set', 'webappx.demo.hr']])
  handles = render()
  assert.deepEqual(handles.bundle.states, { hr: edited.hr, cms: imported, crm: seed.crm })
  assert.deepEqual(handles.bundle.revisions, { hr: 2, cms: 2, crm: 0 })
  const savedBytes = fixture.bytes().slice(0, 3)
  fixture.resetCalls()
  assert.equal(handles.bundle.clearHistory().ok, true)
  assert.deepEqual(fixture.writes(), [['remove', RESTORE_POINTS_KEY]])
  handles = render()
  assert.deepEqual(handles.bundle.history.points, [])
  assert.deepEqual(fixture.bytes().slice(0, 3), savedBytes)
  assert.equal(reads(), 0)
})

test('one document runtime survives provider remounts; a new document runtime starts fresh without browser access', t => {
  const reads = browserBoundary(t)
  const runtime = createPortalRuntime('walkthrough')
  let render = mount(t, runtime)
  const seed = createDemoWorkspaces()
  const edited = clone(seed.cms)
  edited.entries[1].title = 'Memory survives route remount'
  render().cms.setState(edited)
  render().cms.recovery.setPreference('beforeReset', true)
  render = mount(t, runtime)
  let handles = render()
  assert.deepEqual(handles.cms.state, edited)
  assert.deepEqual(handles.cms.recovery.settings.preferences, { beforeImport: false, beforeReset: true })
  render = mount(t, createPortalRuntime('walkthrough'))
  handles = render()
  assert.deepEqual(handles.bundle.states, seed)
  assert.deepEqual(handles.bundle.history.points, [])
  assert.deepEqual(handles.cms.recovery.settings.preferences, { beforeImport: false, beforeReset: false })
  assert.equal(reads(), 0)
})

test('explicit null and throwing adapters refuse through the existing boundaries without a browser fallback', t => {
  const reads = browserBoundary(t)
  let render = mount(t, Object.freeze({ mode: 'browser', storage: null }))
  let handles = render()
  assert.equal(handles.cms.status.kind, 'unavailable')
  assert.ok(handles.bundle.history.error)
  assert.ok(handles.cms.recovery.settings.error)
  assert.equal(handles.cms.recovery.setPreference('beforeImport', true).ok, false)
  assert.equal(handles.bundle.createPoint(['cms'], 'Unavailable').ok, false)
  assert.equal(handles.bundle.clearHistory().ok, false)
  assert.equal(handles.bundle.restore(createDemoWorkspaces(), ['cms']).ok, false)
  assert.equal(handles.cms.importState(createDemoWorkspaces().cms).ok, false)
  const fixture = tracedStorage()
  fixture.setFailure(() => true)
  render = mount(t, Object.freeze({ mode: 'walkthrough', storage: fixture.storage }))
  handles = render()
  const changed = clone(handles.cms.state)
  changed.entries[1].title = 'Accepted only in current memory after refusal'
  handles.cms.setState(changed)
  handles = render()
  assert.deepEqual(handles.cms.state, changed)
  assert.equal(handles.cms.status.kind, 'unavailable')
  assert.equal(handles.cms.reset().ok, false)
  assert.equal(reads(), 0)
})

test('required replacement write refusal rolls back only the selected adapter and keeps the accepted workspace and epoch', t => {
  const reads = browserBoundary(t)
  const fixture = tracedStorage()
  const render = mount(t, Object.freeze({ mode: 'walkthrough', storage: fixture.storage }))
  let handles = render()
  const edited = clone(handles.cms.state)
  edited.entries[1].title = 'Retain this accepted state after storage refusal'
  handles.cms.setState(edited)
  handles = render()
  assert.equal(handles.cms.recovery.setPreference('beforeImport', true).ok, true)
  handles = render()
  const preview = handles.cms.recovery.previewImport(createDemoWorkspaces().cms)
  const before = fixture.bytes()
  let refused = false
  fixture.setFailure((operation, key) => operation === 'set' && key === 'webappx.demo.cms' && !refused && (refused = true))
  fixture.resetCalls()
  const result = handles.cms.importState(createDemoWorkspaces().cms, preview.confirmation)
  assert.equal(result.ok, false)
  assert.equal(result.status.kind, 'unavailable')
  assert.deepEqual(fixture.writes(), [['set', RESTORE_POINTS_KEY], ['set', 'webappx.demo.cms'], ['set', 'webappx.demo.cms'], ['remove', RESTORE_POINTS_KEY]])
  assert.deepEqual(fixture.bytes(), before)
  handles = render()
  assert.deepEqual(handles.cms.state, edited)
  assert.equal(handles.cms.replacementEpoch, 0)
  assert.deepEqual(handles.bundle.history.points, [])
  assert.equal(reads(), 0)
})

test('the hook retains dynamic undefined access, explicit null refusal and no-write coordinated acceptance', t => {
  const first = tracedStorage()
  const second = tracedStorage()
  let currentStorage = first.storage
  const reads = browserBoundary(t, () => currentStorage)
  const run = hooks(t)
  const valid = value => !!value && typeof value === 'object' && Object.keys(value).length === 1 && Number.isSafeInteger(value.count) && value.count >= 0
  const create = () => ({ count: 0 })
  const render = () => run(() => useDemoPersistence('cms', create, valid))
  let handle = render()
  assert.equal(reads(), 1)
  currentStorage = second.storage
  handle.setState({ count: 4 })
  assert.equal(first.memory.getItem('webappx.demo.cms'), null)
  assert.equal(second.memory.getItem('webappx.demo.cms'), envelope('cms', { count: 4 }))
  handle = render()
  assert.equal(reads(), 2)
  second.resetCalls()
  handle.acceptStoredState({ count: 7 }, { kind: 'saved', message: 'Already committed.' })
  handle = render()
  assert.deepEqual(handle.state, { count: 7 })
  assert.equal(handle.replacementEpoch, 1)
  assert.deepEqual(second.calls, [])
  const nullRun = hooks(t)
  let refused = nullRun(() => useDemoPersistence('cms', create, valid, undefined, null))
  assert.equal(refused.status.kind, 'unavailable')
  refused.setState({ count: 9 })
  assert.equal(refused.reset().ok, true)
  refused = nullRun(() => useDemoPersistence('cms', create, valid, undefined, null))
  assert.deepEqual(refused.state, { count: 0 })
  assert.equal(refused.status.kind, 'unavailable')
  assert.equal(refused.importState({ count: 10 }).ok, false)
  assert.equal(reads(), 2)
})

test('the context has an inert browser default for custom shells without a runtime provider', () => {
  assert.deepEqual(initialRuntime, { mode: 'browser', storage: undefined })
})
