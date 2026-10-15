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
const { previewRestoreBudget } = await load(new URL('../../src/portals/restore-budget.ts', import.meta.url))
const { restoreWithCheckpoint, undoRestorePoint } = await load(new URL('../../src/portals/restore-workspaces.ts', import.meta.url))
const { createRestorePoint, prepareRestorePoints, RESTORE_POINTS_KEY, RESTORE_POINTS_LIMIT, loadRestorePoints } = await load(new URL('../../src/portals/restore-points.ts', import.meta.url))
const { createDemoWorkspaces, isDemoWorkspaces } = await load(new URL('../../src/portals/workspaces.ts', import.meta.url))
const { DEMO_STORAGE_LIMIT, demoStorageKey } = await load(new URL('../../src/portals/persistence.ts', import.meta.url))
const timestamp = '2026-10-15T06:00:00.000Z'
const options = id => ({ id, createdAt: timestamp })
const names = ['hr', 'cms', 'crm']
const clone = value => JSON.parse(JSON.stringify(value))
const rawHistory = points => JSON.stringify({ schemaVersion: 1, points })
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
function changed() {
  const states = createDemoWorkspaces()
  states.cms.entries[1].title = 'Fictional storage preview target'
  states.crm.opportunities[0].amountCents = 987600
  states.hr.role = 'auditor'
  assert.equal(isDemoWorkspaces(states), true)
  return states
}
function large(count = 80) {
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
function assertParity(preview, result, storage) {
  assert.equal(preview.ok, true)
  assert.equal(preview.canRestore, true)
  assert.equal(result.ok, true)
  assert.equal(preview.newPointCharacters, JSON.stringify(result.point).length)
  assert.equal(preview.projectedHistoryCharacters, storage.values.get(RESTORE_POINTS_KEY).length)
  assert.equal(preview.retainedPoints, result.points.length)
  assert.equal(preview.selectedCharacters, preview.selected.reduce((sum, item) => sum + item.characters, 0))
  for (const item of preview.selected) {
    assert.equal(item.characters, storage.values.get(demoStorageKey(item.module)).length)
    assert.equal(item.limit, DEMO_STORAGE_LIMIT)
  }
}

test('preview projects exact selected envelopes and history writes for one, several or all portals', () => {
  for (const selected of [['hr'], ['cms'], ['crm'], ['crm', 'hr'], names]) {
    const current = createDemoWorkspaces()
    const target = changed()
    const storage = memory()
    const preview = previewRestoreBudget(current, target, selected, [], options('new-point'))
    assert.deepEqual(preview.selected.map(item => item.module), selected)
    assert.equal(preview.currentHistoryCharacters, rawHistory([]).length)
    assert.equal(preview.prunedPoints, 0)
    const result = restoreWithCheckpoint(current, target, selected, storage, options('new-point'))
    assertParity(preview, result, storage)
    assert.deepEqual(storage.actions.filter(([action]) => action === 'set').map(([, key]) => key), [RESTORE_POINTS_KEY, ...selected.map(demoStorageKey)])
  }
})

test('preview is repeatable and neither touches browser storage nor mutates states, history or selections', () => {
  const current = createDemoWorkspaces()
  const target = changed()
  const selected = ['hr', 'cms']
  const history = [createRestorePoint(current, ['cms'], 'restore', undefined, options('old'))]
  const before = clone({ current, target, selected, history })
  const original = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, get() { throw new Error('No browser access allowed') } })
  try {
    const first = previewRestoreBudget(current, target, selected, history)
    assert.equal(first.ok, true)
    assert.deepEqual(previewRestoreBudget(current, target, selected, history), first)
  } finally {
    if (original) Object.defineProperty(globalThis, 'window', original)
    else delete globalThis.window
  }
  assert.deepEqual({ current, target, selected, history }, before)
})

test('retention preview removes the oldest point at five and matches the next committed envelope', () => {
  const current = createDemoWorkspaces()
  const points = Array.from({ length: 5 }, (_, index) => createRestorePoint(current, ['cms'], 'restore', undefined, options(`old-${index}`)))
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, rawHistory(points))
  const preview = previewRestoreBudget(current, changed(), ['cms'], { points }, options('new'))
  assert.equal(preview.prunedPoints, 1)
  assert.equal(preview.retainedPoints, 5)
  assert.equal(preview.currentHistoryCharacters, rawHistory(points).length)
  const result = restoreWithCheckpoint(current, changed(), ['cms'], storage, options('new'))
  assertParity(preview, result, storage)
  assert.deepEqual(result.points.map(point => point.id), ['new', 'old-0', 'old-1', 'old-2', 'old-3'])
})

test('character-budget pruning is projected from the same retention plan as the actual restore', () => {
  const current = large()
  let points = []
  for (let index = 0; index < 5; index += 1) points = prepareRestorePoints(points, createRestorePoint(current, ['cms'], 'restore', undefined, options(`old-${index}`))).points
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, rawHistory(points))
  const preview = previewRestoreBudget(current, changed(), ['cms'], points, options('new'))
  assert.ok(preview.prunedPoints > 0)
  assert.ok(preview.retainedPoints < 5)
  assert.ok(preview.projectedHistoryCharacters <= RESTORE_POINTS_LIMIT)
  assertParity(preview, restoreWithCheckpoint(current, changed(), ['cms'], storage, options('new')), storage)
})

test('a combined automatic point over the history limit reports metrics and blocks the actual restore', () => {
  let current
  for (let count = 230; count < 250; count += 1) {
    const candidate = large(count)
    try {
      const point = createRestorePoint(candidate, names, 'restore', undefined, options('new'))
      if (rawHistory([point]).length > RESTORE_POINTS_LIMIT) { current = candidate; break }
    } catch { /* Keep individual workspace envelopes within their own limits. */ }
  }
  assert.ok(current)
  const history = [createRestorePoint(createDemoWorkspaces(), ['cms'], 'restore', undefined, options('old'))]
  const preview = previewRestoreBudget(current, changed(), names, history, options('new'))
  assert.equal(preview.ok, true)
  assert.equal(preview.canRestore, false)
  assert.match(preview.reason, /2,000,000-character history limit/)
  assert.ok(preview.projectedHistoryCharacters > preview.historyLimit)
  assert.ok(preview.newPointCharacters > preview.historyLimit - 32)
  assert.equal(preview.prunedPoints, 1)
  assert.equal(preview.retainedPoints, 1)
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, rawHistory(history))
  const before = new Map(storage.values)
  assert.equal(restoreWithCheckpoint(current, changed(), names, storage, options('new')).ok, false)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(storage.actions.filter(([action]) => action !== 'get'), [])
})

test('invalid selection, complete graphs and serialization failures are rejected without a budget', () => {
  for (const selected of [[], ['cms', 'cms'], ['other'], null, undefined, 'cms']) {
    assert.equal(previewRestoreBudget(createDemoWorkspaces(), changed(), selected, []).ok, false)
  }
  for (const module of names) {
    const invalid = changed()
    invalid[module] = {}
    assert.equal(previewRestoreBudget(createDemoWorkspaces(), invalid, ['cms'], []).ok, false)
    assert.equal(previewRestoreBudget(invalid, changed(), ['cms'], []).ok, false)
  }
  for (const toJSON of [() => { throw new Error('Serialization denied') }, () => null]) {
    const invalid = changed()
    Object.defineProperty(invalid.cms, 'toJSON', { value: toJSON })
    assert.equal(previewRestoreBudget(createDemoWorkspaces(), invalid, ['cms'], []).ok, false)
  }
})

test('read-denied and corrupt history fail closed rather than treating recovery data as empty', () => {
  const current = createDemoWorkspaces()
  const point = createRestorePoint(current, ['cms'], 'restore', undefined, options('point'))
  for (const history of [null, {}, { points: [point, point] }, { points: [{ ...point, states: {} }] }, { points: 'wrong' }]) {
    assert.equal(previewRestoreBudget(current, changed(), ['cms'], history).ok, false)
  }
  const blocked = previewRestoreBudget(current, changed(), ['cms'], { points: [], error: 'History read denied' })
  assert.deepEqual(blocked, { ok: false, message: 'History read denied' })
  const denied = { getItem() { throw new Error('No storage') } }
  assert.match(previewRestoreBudget(current, changed(), ['cms'], loadRestorePoints(denied)).message, /could not read/)
  const circular = []
  circular.push(circular)
  assert.equal(previewRestoreBudget(current, changed(), ['cms'], circular).ok, false)
})

test('default placeholder IDs avoid existing collisions and use the exact runtime UUID length', () => {
  const current = createDemoWorkspaces()
  const points = Array.from({ length: 5 }, (_, index) => createRestorePoint(current, ['cms'], 'restore', undefined, options(`00000000-0000-4000-8000-${String(index).padStart(12, '0')}`)))
  const preview = previewRestoreBudget(current, changed(), ['cms'], points)
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, rawHistory(points))
  const result = restoreWithCheckpoint(current, changed(), ['cms'], storage)
  assert.equal(result.point.id.length, 36)
  assertParity(preview, result, storage)
})

test('fallback generated IDs preserve runtime and preview size parity without crypto.randomUUID', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto')
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined })
  try {
    const current = createDemoWorkspaces()
    const storage = memory()
    const result = restoreWithCheckpoint(current, changed(), ['cms'], storage)
    assert.match(result.point.id, /^[a-f0-9-]{36}$/)
    assertParity(previewRestoreBudget(current, changed(), ['cms'], []), result, storage)
  } finally {
    if (original) Object.defineProperty(globalThis, 'crypto', original)
    else delete globalThis.crypto
  }
})

test('undo projection resolves the saved scope and includes its source point identity in exact history size', () => {
  const source = createRestorePoint(createDemoWorkspaces(), ['hr', 'cms'], 'restore', undefined, options('source'))
  const current = changed()
  const preview = previewRestoreBudget(current, current, [], [source], { ...options('undo'), sourcePointId: source.id })
  assert.deepEqual(preview.selected.map(item => item.module), ['hr', 'cms'])
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, rawHistory([source]))
  assertParity(preview, undoRestorePoint(current, source.id, storage, options('undo')), storage)
  assert.equal(previewRestoreBudget(current, current, [], [source], { sourcePointId: 'missing' }).ok, false)
})

test('real storage write failures remain authoritative after a successful preview and restore old raw saves', () => {
  const current = createDemoWorkspaces()
  const storage = memory()
  storage.values.set(demoStorageKey('cms'), 'prior raw CMS save')
  const before = new Map(storage.values)
  const preview = previewRestoreBudget(current, changed(), ['cms'], [], options('point'))
  assert.equal(preview.canRestore, true)
  let failed = false
  const denied = { ...storage, setItem(key, value) { storage.setItem(key, value); if (!failed) { failed = true; throw new Error('Browser quota') } } }
  const result = restoreWithCheckpoint(current, changed(), ['cms'], denied, options('point'))
  assert.equal(result.ok, false)
  assert.deepEqual(storage.values, before)
})

test('oversized individual snapshots and invalid point options cannot receive a usable preview', () => {
  const current = createDemoWorkspaces()
  assert.equal(previewRestoreBudget(current, large(260), ['cms'], []).ok, false)
  assert.equal(previewRestoreBudget(large(260), current, ['cms'], []).ok, false)
  for (const config of [{ id: 'bad id' }, { createdAt: 'not a timestamp' }]) {
    assert.equal(previewRestoreBudget(current, changed(), ['cms'], [], config).ok, false)
  }
})
