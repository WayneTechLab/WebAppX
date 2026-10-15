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
const { replaceWorkspaceWithRecovery: replaceBound, previewWorkspaceReplacement: preview } = await load(new URL('../../src/portals/replacement-recovery.ts', import.meta.url))
const { createDemoWorkspaces, isDemoWorkspaces } = await load(new URL('../../src/portals/workspaces.ts', import.meta.url))
const { createRestorePoint, parseRestorePoints, loadRestorePoints, RESTORE_POINTS_KEY: historyKey } = await load(new URL('../../src/portals/restore-points.ts', import.meta.url))
const { RECOVERY_PREFERENCES_KEY: preferenceKey, parseRecoveryPreferences } = await load(new URL('../../src/portals/recovery-preferences.ts', import.meta.url))
const { demoStorageKey, loadDemoState } = await load(new URL('../../src/portals/persistence.ts', import.meta.url))
const { undoRestorePoint } = await load(new URL('../../src/portals/restore-workspaces.ts', import.meta.url))
const time = '2026-10-15T20:00:00.000Z'
const options = id => ({ id, createdAt: time })
const clone = value => JSON.parse(JSON.stringify(value))
const historyRaw = points => JSON.stringify({ schemaVersion: 1, points })
const preferences = (beforeImport, beforeReset) => JSON.stringify({ schemaVersion: 1, beforeImport, beforeReset })
function memory(beforeImport = true, beforeReset = true) {
  const values = new Map([['webappx.demo.hr', ' literal old hr '], ['webappx.demo.cms', '\n literal old cms \n'], ['webappx.demo.crm', ' literal old crm '], ['other-app', 'literal unrelated bytes'], [preferenceKey, preferences(beforeImport, beforeReset)]])
  const actions = []
  return { values, actions, getItem(key) { actions.push(['get', key]); return values.get(key) ?? null }, setItem(key, raw) { actions.push(['set', key]); values.set(key, raw) }, removeItem(key) { actions.push(['remove', key]); values.delete(key) } }
}
/** Set up the separate reviewed API call without adding storage observations to
 * the transaction fault fixtures. Dedicated stale-preview cases use replaceBound.
 */
function review(module, current, incoming, operation, storage) {
  try {
    const settings = { preferences: parseRecoveryPreferences(storage.values.get(preferenceKey) ?? null) }
    const required = operation === 'import' ? settings.preferences.beforeImport : settings.preferences.beforeReset
    const points = required && storage.values.has(historyKey) ? parseRestorePoints(storage.values.get(historyKey)) : []
    return preview(module, current, incoming, operation, settings, { points })
  } catch { return { ok: false, canReplace: false } }
}
function replace(module, current, incoming, operation, storage, options) {
  const reviewed = review(module, current, incoming, operation, storage)
  return replaceBound(module, current, incoming, operation, storage, options, reviewed.confirmation)
}
function changed() {
  const states = createDemoWorkspaces()
  states.cms.entries[1].title = 'Current accepted source before replacement'
  states.crm.opportunities[0].amountCents = 333300
  states.hr.role = 'auditor'
  assert.equal(isDemoWorkspaces(states), true)
  return states
}
function large(count = 85) {
  const states = createDemoWorkspaces()
  const sample = states.cms.entries[1]
  for (let index = 1; index <= count; index += 1) {
    const number = String(index).padStart(4, '0')
    const id = `cms-entry-${number}`
    states.cms.entries.push({ ...sample, id, title: `Fictional article ${index}`, slug: `fictional-article-${index}`, body: 'x'.repeat(8000) })
    states.cms.activity.push({ receipt: `MOCK-CMS-${number}`, entryId: id, revision: sample.revision, actorId: 'cms-author', action: 'Created draft' })
  }
  states.cms.sequence = count
  assert.equal(isDemoWorkspaces(states), true)
  return states
}
function writes(storage) { return storage.actions.filter(([action]) => action !== 'get') }
function unchangedOtherSlots(storage, before, selected = 'cms') {
  for (const [key, raw] of before) if (key !== historyKey && key !== demoStorageKey(selected)) assert.equal(storage.values.get(key), raw)
  assert.ok(storage.actions.every(([, key]) => [preferenceKey, historyKey, demoStorageKey(selected)].includes(key)))
}

for (const operation of ['import', 'reset']) {
  test(`${operation}: enabled checkpoint contains only the selected complete current snapshot before save write/removal`, () => {
    for (const module of ['hr', 'cms', 'crm']) {
      const storage = memory()
      const before = new Map(storage.values)
      const current = changed()
      const seed = createDemoWorkspaces()
      const currentBefore = clone(current)
      const result = replace(module, current, seed[module], operation, storage, options(`${operation}-${module}`))
      assert.equal(result.ok, true)
      assert.equal(result.checkpointRequired, true)
      const title = { hr: 'HR', cms: 'CMS', crm: 'CRM' }[module]
      const expected = { id: `${operation}-${module}`, createdAt: time, kind: operation, modules: [module], states: { [module]: currentBefore[module] }, label: `Before ${title} ${operation === 'import' ? 'individual import' : 'Reset'}` }
      assert.deepEqual(result.point, expected)
      assert.deepEqual(parseRestorePoints(storage.values.get(historyKey)), [expected])
      assert.deepEqual(writes(storage), [['set', historyKey], [operation === 'import' ? 'set' : 'remove', demoStorageKey(module)]])
      assert.deepEqual(result.state, seed[module])
      if (operation === 'import') assert.equal(storage.values.get(demoStorageKey(module)), JSON.stringify({ schemaVersion: 1, module, data: seed[module] }))
      else assert.equal(storage.values.has(demoStorageKey(module)), false)
      assert.deepEqual(current, currentBefore)
      unchangedOtherSlots(storage, before, module)
      const read = loadDemoState(module, () => seed[module], () => true, storage)
      assert.deepEqual(read.state, seed[module])
      current[module] = seed[module]
      assert.deepEqual(result.point, expected)
    }
  })

  test(`${operation}: default off touches no history and preserves the independent other preference`, () => {
    const storage = operation === 'import' ? memory(false, true) : memory(true, false)
    storage.values.set(historyKey, 'damaged history which default-off action must never read')
    const before = new Map(storage.values)
    const result = replace('cms', changed(), createDemoWorkspaces().cms, operation, storage)
    assert.equal(result.ok, true)
    assert.equal(result.checkpointRequired, false)
    assert.equal(result.point, undefined)
    assert.ok(storage.actions.every(([, key]) => key !== historyKey))
    assert.deepEqual(writes(storage), [[operation === 'import' ? 'set' : 'remove', demoStorageKey('cms')]])
    assert.equal(storage.values.get(historyKey), before.get(historyKey))
    unchangedOtherSlots(storage, before)
  })

  test(`${operation}: damaged or unreadable required history refuses before workspace-save reads/writes`, () => {
    for (const mode of ['damaged', 'unreadable']) {
      const storage = memory()
      storage.values.set(historyKey, 'damaged history')
      const before = new Map(storage.values)
      if (mode === 'unreadable') {
        const get = storage.getItem
        storage.getItem = key => { if (key === historyKey) throw new Error('denied history'); return get(key) }
      }
      const result = replace('cms', changed(), createDemoWorkspaces().cms, operation, storage)
      assert.equal(result.ok, false)
      assert.equal(Object.hasOwn(result, 'state'), false)
      assert.deepEqual(storage.values, before)
      assert.deepEqual(writes(storage), [])
      assert.ok(storage.actions.every(([, key]) => key !== demoStorageKey('cms')))
    }
  })

  for (const failure of ['history-throw', 'history-silent', 'replacement-throw', 'replacement-silent']) {
    test(`${operation}: ${failure} restores exact previous history and selected raw bytes without accepting state`, () => {
      for (const oldHistory of [null, ` \n${historyRaw([createRestorePoint(createDemoWorkspaces(), ['crm'], 'restore', undefined, options('older'))])}\n `]) {
        const storage = memory()
        if (oldHistory !== null) storage.values.set(historyKey, oldHistory)
        const before = new Map(storage.values)
        const key = failure.startsWith('history') ? historyKey : demoStorageKey('cms')
        const set = storage.setItem
        const remove = storage.removeItem
        let failed = false
        function fail(name) {
          if (name !== key || failed) return false
          failed = true
          storage.values.set(name, 'mutated before failure')
          if (failure.endsWith('throw')) throw new Error('storage failure')
          return true
        }
        storage.setItem = (name, raw) => { if (!fail(name)) set(name, raw) }
        storage.removeItem = name => { if (!fail(name)) remove(name) }
        const result = replace('cms', changed(), createDemoWorkspaces().cms, operation, storage, options('attempt'))
        assert.equal(result.ok, false)
        assert.equal(result.recoveryRequired, undefined)
        assert.equal(Object.hasOwn(result, 'state'), false)
        assert.deepEqual(storage.values, before)
        assert.match(result.status.message, /Exact previous history and selected save bytes were restored/)
        unchangedOtherSlots(storage, before)
        if (failure.startsWith('history')) assert.ok(writes(storage).every(([, name]) => name === historyKey))
      }
    })
  }

  test(`${operation}: uncertain rollback reports affected slots and never claims save preservation`, () => {
    const storage = memory()
    const key = demoStorageKey('cms')
    const set = storage.setItem
    storage.setItem = (name, raw) => { if (name === key) { storage.values.set(name, 'uncertain workspace'); throw new Error('mutation failed') } set(name, raw) }
    storage.removeItem = name => { storage.values.set(name, 'uncertain workspace'); throw new Error('remove failed') }
    const result = replace('cms', changed(), createDemoWorkspaces().cms, operation, storage, options('uncertain'))
    assert.equal(result.ok, false)
    assert.equal(result.recoveryRequired, true)
    assert.equal(Object.hasOwn(result, 'state'), false)
    assert.match(result.status.message, /rollback could not be confirmed/)
    assert.match(result.status.message, /CMS browser save/)
    assert.doesNotMatch(result.status.message, /Exact previous.*restored/)
  })
}

test('absent settings mean both off without creating preference/history keys', () => {
  const storage = memory()
  storage.values.delete(preferenceKey)
  assert.equal(replace('cms', changed(), createDemoWorkspaces().cms, 'import', storage).ok, true)
  assert.equal(storage.values.has(preferenceKey), false)
  assert.equal(storage.values.has(historyKey), false)
})

test('malformed import refuses before any preference/history/save read or capture', () => {
  for (const incoming of [null, {}, { ...createDemoWorkspaces().cms, entries: [] }]) {
    const storage = memory()
    const before = new Map(storage.values)
    assert.equal(replace('cms', changed(), incoming, 'import', storage).ok, false)
    assert.deepEqual(storage.values, before)
    assert.deepEqual(storage.actions, [])
  }
})

test('damaged or unreadable settings block replacement instead of silently using default off', () => {
  for (const operation of ['import', 'reset']) {
    const storage = memory()
    storage.values.set(preferenceKey, '{"schemaVersion":1,"beforeImport":false}')
    const before = new Map(storage.values)
    const result = replace('cms', changed(), createDemoWorkspaces().cms, operation, storage)
    assert.equal(result.ok, false)
    assert.match(result.status.message, /settings are damaged/)
    assert.deepEqual(storage.values, before)
    assert.deepEqual(storage.actions, [['get', preferenceKey]])
  }
  assert.equal(replace('cms', changed(), createDemoWorkspaces().cms, 'reset', null).ok, false)
})

test('default-off failed removal still accepts the original seed in memory with an unavailable status', () => {
  const storage = memory(false, false)
  const before = new Map(storage.values)
  storage.removeItem = () => { throw new Error('removal blocked') }
  const seed = createDemoWorkspaces().cms
  const result = replace('cms', changed(), seed, 'reset', storage)
  assert.equal(result.ok, true)
  assert.deepEqual(result.state, seed)
  assert.equal(result.status.kind, 'unavailable')
  assert.match(result.status.message, /reset in memory/)
  assert.deepEqual(storage.values, before)
})

test('stale settings/history/save observations refuse before transaction writes', () => {
  for (const changedKey of [preferenceKey, historyKey, demoStorageKey('cms')]) {
    const storage = memory()
    const get = storage.getItem
    let reads = 0
    storage.getItem = key => { const value = get(key); if (key === changedKey && ++reads === 2) return 'changed by another tab'; return value }
    const result = replace('cms', changed(), createDemoWorkspaces().cms, 'import', storage, options('stale'))
    assert.equal(result.ok, false)
    assert.match(result.status.message, /changed/)
    assert.deepEqual(writes(storage), [])
  }
})

test('pure preview projects the exact committed retention budget and five-point pruning without storage, clock or randomness', () => {
  const current = changed()
  const incoming = createDemoWorkspaces().cms
  const points = Array.from({ length: 5 }, (_, index) => createRestorePoint(current, ['cms'], 'restore', undefined, options(`old-${index}`)))
  const settings = { preferences: { beforeImport: true, beforeReset: true } }
  const history = { points }
  const before = clone({ current, incoming, history, settings })
  const oldCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  const originalDate = globalThis.Date
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID() { throw new Error('preview must not use random') } } })
    globalThis.Date = class extends originalDate { constructor(...args) { if (!args.length) throw new Error('preview must not read clock'); super(...args) } }
    for (const operation of ['import', 'reset']) {
      const projection = preview('cms', current, incoming, operation, settings, history)
      assert.equal(projection.ok, true)
      assert.equal(projection.canReplace, true)
      assert.equal(projection.retainedPoints, 5)
      assert.equal(projection.prunedPoints, 1)
      const storage = memory()
      storage.values.set(historyKey, historyRaw(points))
      const result = replace('cms', current, incoming, operation, storage, options('00000000-0000-4000-8000-123456789012'))
      assert.equal(result.ok, true)
      assert.equal(projection.projectedHistoryCharacters, storage.values.get(historyKey).length)
      assert.equal(projection.newPointCharacters, JSON.stringify(result.point).length)
    }
  } finally {
    globalThis.Date = originalDate
    if (oldCrypto) Object.defineProperty(globalThis, 'crypto', oldCrypto)
    else delete globalThis.crypto
  }
  assert.deepEqual({ current, incoming, history, settings }, before)
})

test('required import/Reset points remain compatible with Undo and recover only the captured portal', () => {
  for (const operation of ['import', 'reset']) {
    const storage = memory()
    const current = changed()
    const original = clone(current)
    const result = replace('cms', current, createDemoWorkspaces().cms, operation, storage, options(`before-${operation}`))
    const after = { ...current, cms: result.state }
    const recovered = undoRestorePoint(after, result.point.id, storage, options(`undo-${operation}`))
    assert.equal(recovered.ok, true)
    assert.deepEqual(recovered.states, original)
    assert.deepEqual(recovered.point.states, { cms: result.state })
    assert.equal(storage.values.get('webappx.demo.hr'), ' literal old hr ')
    assert.equal(storage.values.get('webappx.demo.crm'), ' literal old crm ')
    assert.equal(loadRestorePoints(storage).points.length, 2)
  }
})

test('character-budget retention previews and commits prune the same oldest points', () => {
  const current = large()
  const points = Array.from({ length: 2 }, (_, index) => createRestorePoint(current, ['cms'], 'restore', undefined, options(`large-old-${index}`)))
  assert.ok(historyRaw(points).length < 2_000_000)
  const settings = { preferences: { beforeImport: true, beforeReset: true } }
  for (const operation of ['import', 'reset']) {
    const projection = preview('cms', current, createDemoWorkspaces().cms, operation, settings, { points })
    assert.equal(projection.ok, true)
    assert.equal(projection.canReplace, true)
    assert.equal(projection.prunedPoints, 1)
    assert.equal(projection.retainedPoints, 2)
    const storage = memory()
    storage.values.set(historyKey, historyRaw(points))
    const result = replace('cms', current, createDemoWorkspaces().cms, operation, storage, options('00000000-0000-4000-8000-123456789012'))
    assert.equal(result.ok, true)
    assert.deepEqual(result.points.map(point => point.id), ['00000000-0000-4000-8000-123456789012', 'large-old-0'])
    assert.equal(storage.values.get(historyKey).length, projection.projectedHistoryCharacters)
  }
})

test('oversized newest capture refuses both operations without pruning old history or touching workspace saves', () => {
  const current = large(260)
  const seed = createDemoWorkspaces()
  const settings = { preferences: { beforeImport: true, beforeReset: true } }
  const points = [createRestorePoint(seed, ['crm'], 'restore', undefined, options('keep-old'))]
  for (const operation of ['import', 'reset']) {
    const projection = preview('cms', current, seed.cms, operation, settings, { points })
    assert.equal(projection.canReplace, false)
    const storage = memory()
    storage.values.set(historyKey, historyRaw(points))
    const before = new Map(storage.values)
    const result = replace('cms', current, seed.cms, operation, storage, options(`oversized-${operation}`))
    assert.equal(result.ok, false)
    assert.deepEqual(storage.values, before)
    assert.deepEqual(writes(storage), [])
    assert.ok(storage.actions.every(([, key]) => key !== demoStorageKey('cms')))
  }
})

test('absent previous workspace slots stay absent after a failed required replacement', () => {
  for (const operation of ['import', 'reset']) {
    const storage = memory()
    const key = demoStorageKey('cms')
    storage.values.delete(key)
    const before = new Map(storage.values)
    const baseSet = storage.setItem
    const baseRemove = storage.removeItem
    let failed = false
    const mutate = name => { if (name === key && !failed) { failed = true; storage.values.set(name, 'mutated absence'); throw new Error('first replacement fails') } }
    storage.setItem = (name, raw) => { mutate(name); baseSet(name, raw) }
    storage.removeItem = name => { mutate(name); baseRemove(name) }
    const result = replace('cms', changed(), createDemoWorkspaces().cms, operation, storage, options(`absent-${operation}`))
    assert.equal(result.ok, false)
    assert.equal(result.recoveryRequired, undefined)
    assert.deepEqual(storage.values, before)
  }
})

test('malformed checkpoint options cannot read clock/random or accept a replacement', () => {
  let getters = 0
  const malformed = [null, [], { extra: true }, { id: null }, { id: 7 }, { createdAt: null }, { createdAt: 'bad-date' }, { label: 'injected label' }, { sourcePointId: 'invented' }, { get id() { getters += 1; return 'getter' } }]
  const oldCrypto = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  const originalDate = globalThis.Date
  let random = 0
  let clocks = 0
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID() { random += 1; return 'generated' } } })
    globalThis.Date = class extends originalDate { constructor(...args) { if (!args.length) clocks += 1; super(...args) } }
    for (const operation of ['import', 'reset']) for (const value of malformed) {
      const storage = memory()
      const before = new Map(storage.values)
      assert.equal(replace('cms', changed(), createDemoWorkspaces().cms, operation, storage, value).ok, false)
      assert.deepEqual(storage.values, before)
      assert.deepEqual(writes(storage), [])
    }
  } finally {
    globalThis.Date = originalDate
    if (oldCrypto) Object.defineProperty(globalThis, 'crypto', oldCrypto)
    else delete globalThis.crypto
  }
  assert.equal(random, 0)
  assert.equal(clocks, 0)
  assert.equal(getters, 0)
})

for (const operation of ['import', 'reset']) {
  test(`${operation}: changing the enabled setting after review refuses instead of bypassing its promised checkpoint`, () => {
    const storage = memory()
    const current = changed()
    const incoming = createDemoWorkspaces().cms
    const reviewed = review('cms', current, incoming, operation, storage)
    assert.equal(reviewed.required, true)
    storage.values.set(preferenceKey, operation === 'import' ? preferences(false, true) : preferences(true, false))
    const before = new Map(storage.values)
    const result = replaceBound('cms', current, incoming, operation, storage, options('setting-changed'), reviewed.confirmation)
    assert.equal(result.ok, false)
    assert.equal(result.refreshPreview, true)
    assert.match(result.status.message, /preview changed/)
    assert.deepEqual(storage.values, before)
    assert.deepEqual(writes(storage), [])
    assert.equal(review('cms', current, incoming, operation, storage).required, false)
  })

  test(`${operation}: reviewed history rename, added capture or changed payload requires new review without pruning/writes`, () => {
    for (const modification of ['rename', 'add', 'payload', 'remove']) {
      const storage = memory()
      const current = changed()
      const incoming = createDemoWorkspaces().cms
      const old = createRestorePoint(current, ['crm'], 'manual', undefined, { ...options('prior'), label: 'Prior label' })
      storage.values.set(historyKey, historyRaw([old]))
      const reviewed = review('cms', current, incoming, operation, storage)
      const changedPoint = clone(old)
      if (modification === 'rename') changedPoint.label = 'Other label'
      if (modification === 'payload') changedPoint.states.crm.opportunities[0].amountCents += 100
      const next = modification === 'remove' ? [] : modification === 'add' ? [createRestorePoint(current, ['cms'], 'restore', undefined, options('other-tab')), changedPoint] : [changedPoint]
      storage.values.set(historyKey, historyRaw(next))
      const before = new Map(storage.values)
      const result = replaceBound('cms', current, incoming, operation, storage, options('history-changed'), reviewed.confirmation)
      assert.equal(result.ok, false, modification)
      assert.equal(result.refreshPreview, true)
      assert.deepEqual(storage.values, before)
      assert.deepEqual(writes(storage), [])
      assert.notEqual(review('cms', current, incoming, operation, storage).confirmation, reviewed.confirmation)
    }
  })

  test(`${operation}: selected current records and target changes between preview/apply refuse, while unrelated portal changes do not`, () => {
    for (const changedFact of ['current', 'target', 'unselected']) {
      const storage = memory()
      const current = changed()
      const incoming = createDemoWorkspaces().cms
      const reviewed = review('cms', current, incoming, operation, storage)
      if (changedFact === 'current') current.cms.entries[1].title = 'Later accepted current CMS edit'
      if (changedFact === 'target') incoming.entries[1].title = 'Changed incoming CMS target'
      if (changedFact === 'unselected') current.crm.opportunities[0].amountCents += 100
      const before = new Map(storage.values)
      const result = replaceBound('cms', current, incoming, operation, storage, options(`changed-${changedFact}`), reviewed.confirmation)
      assert.equal(result.ok, changedFact === 'unselected')
      if (changedFact !== 'unselected') {
        assert.equal(result.refreshPreview, true)
        assert.deepEqual(storage.values, before)
        assert.deepEqual(writes(storage), [])
      }
    }
  })
}

test('default-off individual import still binds its reviewed setting/current/target and refuses missing confirmation', () => {
  const storage = memory(false, false)
  const current = changed()
  const incoming = createDemoWorkspaces().cms
  const reviewed = review('cms', current, incoming, 'import', storage)
  assert.equal(reviewed.required, false)
  assert.equal(replaceBound('cms', current, incoming, 'import', storage).ok, false)
  assert.deepEqual(writes(storage), [])
  storage.values.set(preferenceKey, preferences(true, false))
  const before = new Map(storage.values)
  assert.equal(replaceBound('cms', current, incoming, 'import', storage, options('newly-enabled'), reviewed.confirmation).ok, false)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(writes(storage), [])
  const refreshed = review('cms', current, incoming, 'import', storage)
  assert.equal(refreshed.required, true)
  assert.equal(replaceBound('cms', current, incoming, 'import', storage, options('reviewed-again'), refreshed.confirmation).ok, true)
})

test('confirmation cannot be reused for another module or operation; one-click known-off Reset stays compatible', () => {
  const storage = memory()
  const current = changed()
  const seed = createDemoWorkspaces()
  const reviewed = review('cms', current, seed.cms, 'import', storage)
  assert.equal(replaceBound('cms', current, seed.cms, 'reset', storage, options('wrong-operation'), reviewed.confirmation).ok, false)
  assert.equal(replaceBound('crm', current, seed.crm, 'import', storage, options('wrong-module'), reviewed.confirmation).ok, false)
  assert.deepEqual(writes(storage), [])
  const off = memory(false, false)
  assert.equal(replaceBound('cms', current, seed.cms, 'reset', off).ok, true)
  assert.deepEqual(writes(off), [['remove', demoStorageKey('cms')]])
})
