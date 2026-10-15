import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const urls = new Map()
async function load(file) {
  if (urls.has(file.href)) return import(urls.get(file.href))
  const source = readFileSync(file, 'utf8')
  let compiled = file.pathname.endsWith('.json') ? `export default ${JSON.stringify(JSON.parse(source))}` : ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText
  for (const match of [...compiled.matchAll(/from ['"](\.{1,2}\/[^'"]+)['"]/g)]) {
    const relative = match[1]
    const dependency = new URL(/\.(?:ts|json)$/.test(relative) ? relative : `${relative}.ts`, file)
    await load(dependency)
    compiled = compiled.replace(match[0], `from '${urls.get(dependency.href)}'`)
  }
  const url = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  urls.set(file.href, url)
  return import(url)
}
const { restoreDemoWorkspaces } = await load(new URL('../../src/portals/restore-workspaces.ts', import.meta.url))
const { createDemoWorkspaces, isDemoWorkspaces } = await load(new URL('../../src/portals/workspaces.ts', import.meta.url))
const { demoStorageKey, DEMO_STORAGE_VERSION } = await load(new URL('../../src/portals/persistence.ts', import.meta.url))
const names = ['hr', 'cms', 'crm']
const clone = value => JSON.parse(JSON.stringify(value))
const envelope = (module, data) => JSON.stringify({ schemaVersion: DEMO_STORAGE_VERSION, module, data })

function memory() {
  const values = new Map()
  const actions = []
  return {
    values, actions,
    getItem(key) { actions.push(['get', key]); return values.get(key) ?? null },
    setItem(key, value) { actions.push(['set', key, value]); values.set(key, value) },
    removeItem(key) { actions.push(['remove', key]); values.delete(key) },
  }
}
function imported() {
  const states = createDemoWorkspaces()
  states.cms.entries[1].title = 'Fictional combined restore sample'
  states.crm.opportunities[0].amountCents = 765400
  assert.equal(isDemoWorkspaces(states), true)
  return states
}
function seedStorage(storage) {
  for (const module of names) storage.values.set(demoStorageKey(module), `original raw ${module} save`)
  storage.values.set('unrelated-app', 'preserved exactly')
}
const writes = storage => storage.actions.filter(([type]) => type !== 'get')

test('selective restore writes exactly one selected portal and preserves unselected raw saves and unrelated keys', () => {
  for (const selected of names) {
    const storage = memory()
    seedStorage(storage)
    const before = new Map(storage.values)
    const states = imported()
    const snapshot = clone(states)
    const result = restoreDemoWorkspaces(states, [selected], storage)
    assert.equal(result.ok, true)
    assert.equal(result.status.kind, 'saved')
    assert.match(result.status.message, /restored and saved/)
    assert.deepEqual(writes(storage), [['set', demoStorageKey(selected), envelope(selected, states[selected])]])
    for (const [key, value] of before) if (key !== demoStorageKey(selected)) assert.equal(storage.values.get(key), value)
    assert.deepEqual(states, snapshot)
  }
})

test('multi-portal and complete restore use current per-portal envelopes after all original saves are read', () => {
  for (const selected of [['crm', 'hr'], names]) {
    const storage = memory()
    seedStorage(storage)
    const states = imported()
    assert.equal(restoreDemoWorkspaces(states, selected, storage).ok, true)
    assert.deepEqual(storage.actions.slice(0, selected.length), selected.map(module => ['get', demoStorageKey(module)]))
    assert.deepEqual(writes(storage), selected.map(module => ['set', demoStorageKey(module), envelope(module, states[module])]))
    for (const module of selected) assert.deepEqual(JSON.parse(storage.values.get(demoStorageKey(module))), { schemaVersion: DEMO_STORAGE_VERSION, module, data: states[module] })
    assert.equal(storage.values.get('unrelated-app'), 'preserved exactly')
  }
})

test('empty, duplicate, unknown and non-array selections fail before any browser access', () => {
  const storage = memory()
  seedStorage(storage)
  const before = [...storage.values]
  for (const selected of [[], ['hr', 'hr'], ['hr', 'cms', 'crm', 'hr'], ['other'], ['HR'], [null], null, undefined, 'hr', { 0: 'hr', length: 1 }]) {
    const result = restoreDemoWorkspaces(imported(), selected, storage)
    assert.equal(result.ok, false)
    assert.equal(result.status.kind, 'recovered')
    assert.match(result.status.message, /selection is invalid/)
  }
  assert.deepEqual(storage.actions, [])
  assert.deepEqual([...storage.values], before)
})

test('all three graphs are validated even when only one valid portal is selected', () => {
  for (const broken of names) {
    const storage = memory()
    seedStorage(storage)
    const states = imported()
    const current = clone(states)
    states[broken] = {}
    const result = restoreDemoWorkspaces(states, [broken === 'cms' ? 'hr' : 'cms'], storage)
    assert.equal(result.ok, false)
    assert.equal(result.status.kind, 'recovered')
    assert.deepEqual(storage.actions, [])
    assert.deepEqual(current, imported())
  }
  for (const states of [null, [], {}, { ...imported(), other: {} }]) assert.equal(restoreDemoWorkspaces(states, ['hr'], memory()).ok, false)
})

test('a read denial for any selected save prevents every write and keeps existing saves untouched', () => {
  const storage = memory()
  seedStorage(storage)
  const before = [...storage.values]
  const denied = { ...storage, getItem(key) { if (key === demoStorageKey('cms')) throw new Error('SecurityError'); return storage.getItem(key) } }
  const result = restoreDemoWorkspaces(imported(), names, denied)
  assert.equal(result.ok, false)
  assert.equal(result.status.kind, 'unavailable')
  assert.match(result.status.message, /could not read/)
  assert.deepEqual(writes(storage), [])
  assert.deepEqual([...storage.values], before)
  assert.equal(restoreDemoWorkspaces(imported(), names, null).ok, false)
})

test('every selected envelope must fit before even the first selected portal is written', () => {
  const states = imported()
  const sample = states.cms.entries[1]
  for (let index = 1; index <= 260; index += 1) {
    const number = String(index).padStart(4, '0')
    const id = `cms-entry-${number}`
    states.cms.entries.push({ ...sample, id, title: `Fictional article ${index}`, slug: `fictional-article-${index}`, body: 'x'.repeat(8000) })
    states.cms.activity.push({ receipt: `MOCK-CMS-${number}`, entryId: id, revision: sample.revision, actorId: 'cms-author', action: 'Created draft' })
  }
  states.cms.sequence = 260
  assert.equal(isDemoWorkspaces(states), true)
  const storage = memory()
  seedStorage(storage)
  const before = new Map(storage.values)
  const result = restoreDemoWorkspaces(states, ['hr', 'cms'], storage)
  assert.equal(result.ok, false)
  assert.equal(result.status.kind, 'recovered')
  assert.match(result.status.message, /could not fit or be serialized/)
  assert.deepEqual(storage.actions, [])
  assert.deepEqual(storage.values, before)
})

test('serialization failures or substitutions are refused before any current browser save is accessed', () => {
  for (const toJSON of [() => { throw new Error('Could not serialize') }, () => null]) {
    const states = imported()
    Object.defineProperty(states.cms, 'toJSON', { value: toJSON })
    assert.equal(isDemoWorkspaces(states), true)
    const storage = memory()
    const result = restoreDemoWorkspaces(states, ['hr', 'cms'], storage)
    assert.equal(result.ok, false)
    assert.equal(result.status.kind, 'recovered')
    assert.deepEqual(storage.actions, [])
  }
})

test('failure on the second write restores all attempted original raw saves and never touches later portals', () => {
  const storage = memory()
  seedStorage(storage)
  const before = new Map(storage.values)
  let count = 0
  const quota = { ...storage, setItem(key, value) { count += 1; if (count === 2) throw new Error('QuotaExceededError'); storage.setItem(key, value) } }
  const result = restoreDemoWorkspaces(imported(), names, quota)
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, undefined)
  assert.match(result.status.message, /browser saves are preserved/)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(writes(storage).map(([type, key]) => [type, key]), [['set', demoStorageKey('hr')], ['set', demoStorageKey('cms')], ['set', demoStorageKey('hr')]])
  assert.equal(count, 4)
})

test('rollback removes a previously absent save including a failing key that changed before throwing', () => {
  const storage = memory()
  storage.values.set(demoStorageKey('crm'), 'unselected crm')
  storage.values.set('unrelated-app', 'preserved')
  const before = new Map(storage.values)
  let count = 0
  const failsAfterWriting = { ...storage, setItem(key, value) { count += 1; storage.setItem(key, value); if (count === 2) throw new Error('Write changed before failure') } }
  const result = restoreDemoWorkspaces(imported(), ['hr', 'cms'], failsAfterWriting)
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, undefined)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(writes(storage).map(([type, key]) => [type, key]), [['set', demoStorageKey('hr')], ['set', demoStorageKey('cms')], ['remove', demoStorageKey('cms')], ['remove', demoStorageKey('hr')]])
})

test('first-write failure is rolled back too, with no attempts to write other selected saves', () => {
  const storage = memory()
  seedStorage(storage)
  const before = new Map(storage.values)
  let first = true
  const failure = { ...storage, setItem(key, value) { storage.setItem(key, value); if (first) { first = false; throw new Error('Write threw after changing its key') } } }
  const result = restoreDemoWorkspaces(imported(), names, failure)
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, undefined)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(writes(storage).map(([type, key]) => [type, key]), [['set', demoStorageKey('hr')], ['set', demoStorageKey('hr')]])
})

test('rollback continues after a failure and reports exactly the save requiring recovery', () => {
  const storage = memory()
  seedStorage(storage)
  const before = new Map(storage.values)
  let count = 0
  const failure = { ...storage, setItem(key, value) {
    count += 1
    if (count === 2 || count === 4) throw new Error('Quota and rollback failure')
    storage.setItem(key, value)
  } }
  const states = imported()
  const snapshot = clone(states)
  const result = restoreDemoWorkspaces(states, names, failure)
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, true)
  assert.match(result.status.message, /could not roll back the HR save\./)
  assert.match(result.status.message, /may differ/)
  assert.match(result.status.message, /Keep this tab open and export/)
  assert.equal(storage.values.get(demoStorageKey('cms')), before.get(demoStorageKey('cms')))
  assert.equal(storage.values.get(demoStorageKey('crm')), before.get(demoStorageKey('crm')))
  assert.equal(storage.values.get('unrelated-app'), before.get('unrelated-app'))
  assert.deepEqual(states, snapshot)
})

test('failed removal of an initially empty slot reports recovery without touching unselected data', () => {
  const storage = memory()
  storage.values.set(demoStorageKey('crm'), 'keep crm exactly')
  const failure = { ...storage, setItem(key, value) { storage.setItem(key, value); if (key === demoStorageKey('cms')) throw new Error('Quota') }, removeItem(key) { if (key === demoStorageKey('cms')) throw new Error('Storage denied'); storage.removeItem(key) } }
  const result = restoreDemoWorkspaces(imported(), ['hr', 'cms'], failure)
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, true)
  assert.match(result.status.message, /could not roll back the CMS save\./)
  assert.equal(storage.values.has(demoStorageKey('hr')), false)
  assert.equal(storage.values.has(demoStorageKey('cms')), true)
  assert.equal(storage.values.get(demoStorageKey('crm')), 'keep crm exactly')
})

test('a changed backup graph is revalidated at restore time and never changes the snapshot or storage', () => {
  const states = imported()
  assert.equal(isDemoWorkspaces(states), true)
  states.crm.contacts[0].companyId = 'missing-company'
  const before = clone(states)
  const storage = memory()
  assert.equal(restoreDemoWorkspaces(states, ['hr', 'cms'], storage).ok, false)
  assert.deepEqual(states, before)
  assert.deepEqual(storage.actions, [])
})
