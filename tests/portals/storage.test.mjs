import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const compiled = ts.transpileModule(readFileSync(new URL('../../src/portals/persistence.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { loadDemoState, saveDemoState, clearDemoState, demoStorageKey, DEMO_STORAGE_LIMIT } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const create = () => ({ count: 0 })
const valid = value => Boolean(value && Number.isSafeInteger(value.count) && value.count >= 0)
function memory() {
  const values = new Map()
  return { values, getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }
}

test('fresh portal load does not write fixtures or unrelated browser data', () => {
  const storage = memory()
  storage.setItem('unrelated', 'preserved')
  const result = loadDemoState('hr', create, valid, storage)
  assert.deepEqual(result.state, create())
  assert.equal(result.status.kind, 'ready')
  assert.deepEqual([...storage.values], [['unrelated', 'preserved']])
})

test('saved actions roundtrip in independent versioned portal envelopes', () => {
  const storage = memory()
  for (const [index, module] of ['hr', 'cms', 'crm'].entries()) {
    assert.equal(saveDemoState(module, { count: index + 1 }, storage).kind, 'saved')
    const envelope = JSON.parse(storage.getItem(demoStorageKey(module)))
    assert.equal(envelope.schemaVersion, 1)
    assert.equal(envelope.module, module)
    const restored = loadDemoState(module, create, valid, storage)
    assert.equal(restored.status.kind, 'restored')
    assert.deepEqual(restored.state, { count: index + 1 })
  }
})

test('reset removes only its portal save and does not recreate the seed', () => {
  const storage = memory()
  for (const module of ['hr', 'cms', 'crm']) saveDemoState(module, { count: 7 }, storage)
  storage.setItem('unrelated', 'keep')
  assert.equal(clearDemoState('cms', storage).kind, 'reset')
  assert.equal(storage.getItem(demoStorageKey('cms')), null)
  assert.equal(loadDemoState('cms', create, valid, storage).state.count, 0)
  assert.equal(storage.getItem(demoStorageKey('cms')), null)
  assert.equal(loadDemoState('hr', create, valid, storage).state.count, 7)
  assert.equal(loadDemoState('crm', create, valid, storage).state.count, 7)
  assert.equal(storage.getItem('unrelated'), 'keep')
})

test('damaged, incompatible and wrong-module saves recover without trusting payloads', () => {
  for (const raw of ['{', 'null', '[]', '{}', JSON.stringify({ schemaVersion: 2, module: 'hr', data: { count: 8 } }), JSON.stringify({ schemaVersion: 1, module: 'cms', data: { count: 8 } }), JSON.stringify({ schemaVersion: 1, module: 'hr', data: { count: -1 } }), 'x'.repeat(DEMO_STORAGE_LIMIT + 1)]) {
    const storage = memory()
    storage.setItem(demoStorageKey('hr'), raw)
    const result = loadDemoState('hr', create, valid, storage)
    assert.equal(result.status.kind, 'recovered')
    assert.deepEqual(result.state, create())
    assert.equal(storage.getItem(demoStorageKey('hr')), raw)
  }
})

test('storage denial, quota errors and reset failures keep usable in-memory data with honest status', () => {
  const denied = { getItem() { throw new Error('denied') }, setItem() { throw new Error('quota') }, removeItem() { throw new Error('denied') } }
  assert.equal(loadDemoState('hr', create, valid, denied).status.kind, 'unavailable')
  assert.equal(saveDemoState('cms', { count: 2 }, denied).kind, 'unavailable')
  assert.equal(clearDemoState('crm', denied).kind, 'unavailable')
  assert.match(clearDemoState('crm', denied).message, /may return after refresh/)
  assert.equal(loadDemoState('hr', create, valid, null).status.kind, 'unavailable')
})

test('serialization failures and oversized saves do not replace an existing good save', () => {
  const storage = memory()
  saveDemoState('hr', { count: 3 }, storage)
  const circular = {}; circular.self = circular
  assert.equal(saveDemoState('hr', circular, storage).kind, 'unavailable')
  assert.equal(saveDemoState('hr', { text: 'x'.repeat(DEMO_STORAGE_LIMIT) }, storage).kind, 'unavailable')
  assert.equal(loadDemoState('hr', create, valid, storage).state.count, 3)
})

test('a successful later action replaces an invalid save and restores normally', () => {
  const storage = memory()
  storage.setItem(demoStorageKey('crm'), '{broken')
  assert.equal(loadDemoState('crm', create, valid, storage).status.kind, 'recovered')
  assert.equal(saveDemoState('crm', { count: 9 }, storage).kind, 'saved')
  assert.equal(loadDemoState('crm', create, valid, storage).state.count, 9)
})
