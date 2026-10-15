import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const compile = source => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const url = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const persistenceUrl = url(compile(readFileSync(new URL('../../src/portals/persistence.ts', import.meta.url), 'utf8')))
const { saveDemoState, loadDemoState, demoStorageKey, DEMO_STORAGE_LIMIT } = await import(persistenceUrl)
const source = compile(readFileSync(new URL('../../src/portals/import-state.ts', import.meta.url), 'utf8')).replace("'./persistence'", JSON.stringify(persistenceUrl))
const { replaceDemoState } = await import(url(source))
const create = () => ({ count: 0 })
const valid = value => Boolean(value && typeof value === 'object' && Object.keys(value).length === 1 && Number.isSafeInteger(value.count) && value.count >= 0)
function memory() {
  const values = new Map()
  const writes = []
  return { values, writes, getItem: key => values.get(key) ?? null, setItem: (key, value) => { writes.push(key); values.set(key, value) }, removeItem: key => values.delete(key) }
}

test('invalid snapshot is refused without any write and preserves all existing workspaces', () => {
  const storage = memory()
  for (const module of ['hr', 'cms', 'crm']) saveDemoState(module, { count: 7 }, storage)
  const before = [...storage.values]
  const writes = storage.writes.length
  for (const candidate of [null, [], {}, { count: -1 }, { count: 3, accessToken: 'not-a-domain-field' }]) {
    const result = replaceDemoState('cms', candidate, valid, storage)
    assert.equal(result.ok, false)
    assert.equal(Object.hasOwn(result, 'state'), false)
    assert.equal(result.status.kind, 'recovered')
    assert.match(result.status.message, /import was not applied/)
    assert.match(result.status.message, /previous workspace and browser save are preserved/)
  }
  assert.equal(storage.writes.length, writes)
  assert.deepEqual([...storage.values], before)
})

test('throwing validator refuses an import without propagating or writing', () => {
  const storage = memory()
  saveDemoState('hr', { count: 2 }, storage)
  const before = [...storage.values]
  const result = replaceDemoState('hr', { count: 9 }, () => { throw new Error('Malformed nested input') }, storage)
  assert.equal(result.ok, false)
  assert.equal(result.status.kind, 'recovered')
  assert.equal(storage.writes.length, 1)
  assert.deepEqual([...storage.values], before)
})

test('quota failure preserves the previous save and does not offer replacement state', () => {
  const storage = memory()
  saveDemoState('crm', { count: 2 }, storage)
  const before = storage.getItem(demoStorageKey('crm'))
  const unavailable = { ...storage, setItem() { throw new Error('QuotaExceededError') } }
  const result = replaceDemoState('crm', { count: 9 }, valid, unavailable)
  assert.equal(result.ok, false)
  assert.equal(Object.hasOwn(result, 'state'), false)
  assert.equal(result.status.kind, 'unavailable')
  assert.match(result.status.message, /import was not applied/)
  assert.match(result.status.message, /previous workspace and browser save are preserved/)
  assert.equal(storage.getItem(demoStorageKey('crm')), before)
  assert.equal(loadDemoState('crm', create, valid, storage).state.count, 2)
})

test('successful import synchronously saves only the selected portal and restores after refresh', () => {
  for (const module of ['hr', 'cms', 'crm']) {
    const storage = memory()
    for (const name of ['hr', 'cms', 'crm']) saveDemoState(name, { count: 2 }, storage)
    storage.setItem('unrelated', 'preserved')
    const before = new Map(storage.values)
    const writes = storage.writes.length
    let validations = 0
    const candidate = { count: 9 }
    const result = replaceDemoState(module, candidate, value => { validations += 1; return valid(value) }, storage)
    assert.equal(result.ok, true)
    assert.strictEqual(result.state, candidate)
    assert.equal(result.status.kind, 'saved')
    assert.match(result.status.message, /imported and saved/)
    assert.equal(validations, 1)
    assert.deepEqual(storage.writes.slice(writes), [demoStorageKey(module)])
    assert.equal(loadDemoState(module, create, valid, storage).state.count, 9)
    for (const [key, value] of before) if (key !== demoStorageKey(module)) assert.equal(storage.getItem(key), value)
  }
})

test('validation is repeated at apply time so a changed preview value cannot bypass refusal', () => {
  const storage = memory()
  const candidate = { count: 4 }
  assert.equal(valid(candidate), true)
  candidate.count = -4
  assert.equal(replaceDemoState('hr', candidate, valid, storage).ok, false)
  assert.equal(storage.writes.length, 0)
})

test('unavailable storage, circular values and oversized accepted values never replace a saved workspace', () => {
  const storage = memory()
  saveDemoState('hr', { count: 2 }, storage)
  const before = [...storage.values]
  const circular = {}; circular.self = circular
  for (const candidate of [circular, { body: 'x'.repeat(DEMO_STORAGE_LIMIT) }]) {
    const result = replaceDemoState('hr', candidate, () => true, storage)
    assert.equal(result.ok, false)
    assert.equal(result.status.kind, 'unavailable')
    assert.equal(Object.hasOwn(result, 'state'), false)
  }
  assert.deepEqual([...storage.values], before)
  assert.equal(storage.writes.length, 1)
  assert.equal(replaceDemoState('hr', { count: 9 }, valid, null).ok, false)
})
