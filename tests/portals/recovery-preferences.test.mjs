import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const source = ts.transpileModule(readFileSync(new URL('../../src/portals/recovery-preferences.ts', import.meta.url), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
const { RECOVERY_PREFERENCES_KEY: key, parseRecoveryPreferences, loadRecoveryPreferences, saveRecoveryPreferences } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
function memory() {
  const values = new Map([['webappx.demo.cms', 'literal workspace bytes'], ['webappx.demo.restore-points', 'literal history bytes'], ['other-app', 'unchanged']])
  const actions = []
  return { values, actions, getItem(name) { actions.push(['get', name]); return values.get(name) ?? null }, setItem(name, raw) { actions.push(['set', name]); values.set(name, raw) }, removeItem(name) { actions.push(['remove', name]); values.delete(name) } }
}

test('missing preference is independently default off and reading never creates a save', () => {
  const storage = memory()
  const before = new Map(storage.values)
  assert.deepEqual(loadRecoveryPreferences(storage), { preferences: { beforeImport: false, beforeReset: false } })
  assert.deepEqual(storage.actions, [['get', key]])
  assert.deepEqual(storage.values, before)
})

test('both independent booleans persist literally in only their own origin key', () => {
  for (const beforeImport of [false, true]) for (const beforeReset of [false, true]) {
    const storage = memory()
    const before = new Map(storage.values)
    const result = saveRecoveryPreferences({ beforeImport, beforeReset }, storage)
    assert.equal(result.ok, true)
    assert.equal(storage.values.get(key), `{"schemaVersion":1,"beforeImport":${beforeImport},"beforeReset":${beforeReset}}`)
    assert.deepEqual(loadRecoveryPreferences(storage), { preferences: { beforeImport, beforeReset } })
    for (const [name, raw] of before) assert.equal(storage.values.get(name), raw)
    assert.ok(storage.actions.every(([, name]) => name === key))
  }
})

test('invalid preference shape/type/version/size never silently opts out of a checkpoint', () => {
  for (const raw of ['not json', '{}', '[]', '{"schemaVersion":2,"beforeImport":true,"beforeReset":true}', '{"schemaVersion":1,"beforeImport":"false","beforeReset":false}', '{"schemaVersion":1,"beforeImport":true,"beforeReset":false,"extra":0}', ' '.repeat(4097)]) {
    assert.throws(() => parseRecoveryPreferences(raw), /damaged or incompatible/)
    const storage = memory()
    storage.values.set(key, raw)
    const before = new Map(storage.values)
    assert.match(loadRecoveryPreferences(storage).error, /damaged or incompatible/)
    assert.deepEqual(storage.values, before)
    assert.ok(storage.actions.every(([action]) => action === 'get'))
  }
})

test('malformed new preference values refuse without writes', () => {
  for (const value of [null, [], {}, { beforeImport: false }, { beforeImport: 0, beforeReset: false }, { beforeImport: false, beforeReset: false, extra: 1 }]) {
    const storage = memory()
    const before = new Map(storage.values)
    assert.equal(saveRecoveryPreferences(value, storage).ok, false)
    assert.deepEqual(storage.values, before)
    assert.deepEqual(storage.actions, [])
  }
})

test('an explicit valid preference save can replace damaged settings without touching rejected history', () => {
  const storage = memory()
  storage.values.set(key, 'damaged old settings')
  assert.equal(saveRecoveryPreferences({ beforeImport: true, beforeReset: true }, storage).ok, true)
  assert.equal(storage.values.get('webappx.demo.restore-points'), 'literal history bytes')
})

test('mutate-then-throw and silent preference writes roll back exact prior bytes or absence', () => {
  for (const original of [null, ' {"schemaVersion":1,"beforeImport":true,"beforeReset":false} ']) for (const mode of ['throw', 'silent']) {
    const storage = memory()
    if (original !== null) storage.values.set(key, original)
    const before = new Map(storage.values)
    const baseSet = storage.setItem
    let first = true
    storage.setItem = (name, raw) => {
      if (first) { first = false; baseSet(name, 'changed before failure'); if (mode === 'throw') throw new Error('quota'); return }
      baseSet(name, raw)
    }
    const result = saveRecoveryPreferences({ beforeImport: false, beforeReset: true }, storage)
    assert.equal(result.ok, false)
    assert.equal(result.recoveryRequired, undefined)
    assert.deepEqual(storage.values, before)
  }
})

test('uncertain preference rollback is reported without claiming preservation', () => {
  const storage = memory()
  storage.values.set(key, 'previous settings')
  storage.setItem = (name, raw) => { storage.values.set(name, raw); throw new Error('write/readback failure') }
  storage.getItem = () => { throw new Error('read unavailable') }
  assert.equal(saveRecoveryPreferences({ beforeImport: true, beforeReset: true }, storage).ok, false)
  storage.getItem = name => storage.values.get(name) ?? null
  storage.setItem = (name, raw) => { storage.values.set(name, raw); throw new Error('write failure') }
  const result = saveRecoveryPreferences({ beforeImport: true, beforeReset: true }, storage)
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, true)
  assert.match(result.status.message, /rollback confirmed/)
})

test('unavailable preference storage reports a blocking error and writes nothing', () => {
  assert.match(loadRecoveryPreferences(null).error, /could not read/)
  assert.equal(saveRecoveryPreferences({ beforeImport: false, beforeReset: false }, null).ok, false)
})

test('preference save rejects accessor/prototype options without invoking property code', () => {
  let reads = 0
  const accessor = { get beforeImport() { reads += 1; return true }, beforeReset: false }
  const inherited = Object.assign(Object.create({ foreign: true }), { beforeImport: true, beforeReset: true })
  for (const value of [accessor, inherited]) {
    const storage = memory()
    assert.equal(saveRecoveryPreferences(value, storage).ok, false)
    assert.deepEqual(storage.actions, [])
  }
  assert.equal(reads, 0)
})
