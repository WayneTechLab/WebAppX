import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const asUrl = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
// A deterministic hook adapter exercises the hook's event-turn contract. Actual
// React remount/UI behavior belongs to the browser suite, not this adapter.
const react = asUrl(`
export function useState(initial) { return globalThis.__replacementHooks.state(initial) }
export function useRef(initial) { return globalThis.__replacementHooks.ref(initial) }
export function useCallback(callback) { return callback }
`)
const urls = new Map()
async function load(file) {
  if (urls.has(file.href)) return import(urls.get(file.href))
  let source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  source = source.replace(/from ['"]react['"]/g, `from '${react}'`)
  for (const match of [...source.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g)]) {
    const dependency = new URL(`${match[1]}.ts`, file)
    await load(dependency)
    source = source.replace(match[0], `from '${urls.get(dependency.href)}'`)
  }
  const url = asUrl(source)
  urls.set(file.href, url)
  return import(url)
}
const { useDemoPersistence } = await load(new URL('../../src/portals/useDemoPersistence.ts', import.meta.url))
function mount(t, replacement) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const cells = []
  let cursor = 0
  const values = new Map()
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, raw) => values.set(key, raw), removeItem: key => values.delete(key) }
  globalThis.__replacementHooks = {
    state(initial) { const index = cursor++; if (!(index in cells)) cells[index] = typeof initial === 'function' ? initial() : initial; return [cells[index], next => { cells[index] = typeof next === 'function' ? next(cells[index]) : next }] },
    ref(initial) { const index = cursor++; if (!(index in cells)) cells[index] = { current: initial }; return cells[index] },
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
  t.after(() => { delete globalThis.__replacementHooks; if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globalThis.window })
  const valid = value => !!value && typeof value === 'object' && Object.keys(value).length === 1 && Number.isSafeInteger(value.count) && value.count >= 0
  return { storage, values, render() { cursor = 0; return useDemoPersistence('cms', () => ({ count: 0 }), valid, replacement) } }
}

test('ordinary saves keep the epoch; accepted imports advance once and refused imports preserve it', t => {
  const fixture = mount(t)
  let handle = fixture.render()
  assert.equal(handle.replacementEpoch, 0)
  assert.equal(handle.recovery, undefined)
  handle.setState({ count: 4 })
  handle = fixture.render()
  assert.equal(handle.replacementEpoch, 0)
  assert.deepEqual(handle.state, { count: 4 })
  assert.equal(handle.importState({ count: 9 }).ok, true)
  handle = fixture.render()
  assert.equal(handle.replacementEpoch, 1)
  assert.deepEqual(handle.state, { count: 9 })
  const before = new Map(fixture.values)
  assert.equal(handle.importState({ count: -1 }).ok, false)
  handle = fixture.render()
  assert.equal(handle.replacementEpoch, 1)
  assert.deepEqual(handle.state, { count: 9 })
  assert.deepEqual(fixture.values, before)
})

test('default Reset returns ok for accepted seed even when removal fails and advances its epoch', t => {
  const fixture = mount(t)
  let handle = fixture.render()
  handle.setState({ count: 8 })
  fixture.storage.removeItem = () => { throw new Error('denied removal') }
  const result = handle.reset()
  assert.equal(result.ok, true)
  assert.equal(result.status.kind, 'unavailable')
  handle = fixture.render()
  assert.equal(handle.replacementEpoch, 1)
  assert.deepEqual(handle.state, { count: 0 })
  assert.equal(JSON.parse(fixture.values.get('webappx.demo.cms')).data.count, 8)
})

test('required-checkpoint refusal never accepts replacement or advances the epoch', t => {
  const failure = { ok: false, status: { kind: 'unavailable', message: 'Required checkpoint failed; destination unchanged.' } }
  const calls = []
  const fixture = mount(t, { importState(current, incoming) { calls.push(['import', current, incoming]); return failure }, reset(current, seed) { calls.push(['reset', current, seed]); return failure } })
  let handle = fixture.render()
  handle.setState({ count: 6 })
  assert.deepEqual(handle.importState({ count: 10 }), failure)
  handle = fixture.render()
  assert.deepEqual(handle.reset(), failure)
  handle = fixture.render()
  assert.equal(handle.replacementEpoch, 0)
  assert.deepEqual(handle.state, { count: 6 })
  assert.deepEqual(calls, [['import', { count: 6 }, { count: 10 }], ['reset', { count: 6 }, { count: 0 }]])
  assert.equal(JSON.parse(fixture.values.get('webappx.demo.cms')).data.count, 6)
})

test('accepted coordinated replacements each advance once without writing the already-saved slot again', t => {
  const fixture = mount(t)
  let handle = fixture.render()
  const status = { kind: 'saved', message: 'Coordinated replacement saved.' }
  handle.acceptStoredState({ count: 11 }, status)
  handle = fixture.render()
  assert.equal(handle.replacementEpoch, 1)
  assert.deepEqual(handle.state, { count: 11 })
  handle.acceptStoredState({ count: 12 }, status)
  handle = fixture.render()
  assert.equal(handle.replacementEpoch, 2)
  assert.deepEqual(handle.state, { count: 12 })
  assert.deepEqual([...fixture.values], [])
})

test('successful optional handlers accept state and advance one epoch per import/Reset', t => {
  const status = { kind: 'saved', message: 'History and selected slot committed.' }
  const fixture = mount(t, { importState(_current, incoming) { return { ok: true, state: incoming, status } }, reset(_current, seed) { return { ok: true, state: seed, status } } })
  let handle = fixture.render()
  assert.equal(handle.importState({ count: 3 }).ok, true)
  handle = fixture.render()
  assert.equal(handle.replacementEpoch, 1)
  assert.deepEqual(handle.state, { count: 3 })
  assert.equal(handle.reset().ok, true)
  handle = fixture.render()
  assert.equal(handle.replacementEpoch, 2)
  assert.deepEqual(handle.state, { count: 0 })
})

test('review confirmation passes unchanged through both replacement handlers and refusal retains the epoch', t => {
  const calls = []
  const status = { kind: 'recovered', message: 'Review changed; replacement refused.' }
  const fixture = mount(t, {
    importState(current, incoming, confirmation) { calls.push(['import', current, incoming, confirmation]); return { ok: false, status } },
    reset(current, seed, confirmation) { calls.push(['reset', current, seed, confirmation]); return { ok: false, status } },
  })
  let handle = fixture.render()
  handle.setState({ count: 5 })
  handle = fixture.render()
  handle.importState({ count: 8 }, 'literal import review facts')
  handle.reset('literal Reset review facts')
  handle = fixture.render()
  assert.deepEqual(calls, [['import', { count: 5 }, { count: 8 }, 'literal import review facts'], ['reset', { count: 5 }, { count: 0 }, 'literal Reset review facts']])
  assert.equal(handle.replacementEpoch, 0)
  assert.deepEqual(handle.state, { count: 5 })
})
