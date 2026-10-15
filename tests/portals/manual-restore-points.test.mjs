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
const { RESTORE_POINTS_KEY, RESTORE_POINTS_MAX, RESTORE_POINTS_LIMIT, RESTORE_POINT_LABEL_MAX,
  createRestorePoint, parseRestorePoints, loadRestorePoints, createManualRestorePoint,
  renameRestorePoint, previewManualRestorePoint, normalizeRestorePointLabel } = await load(new URL('../../src/portals/restore-points.ts', import.meta.url))
const { undoRestorePoint } = await load(new URL('../../src/portals/restore-workspaces.ts', import.meta.url))
const { previewRestoreBudget } = await load(new URL('../../src/portals/restore-budget.ts', import.meta.url))
const { createDemoWorkspaces, isDemoWorkspaces } = await load(new URL('../../src/portals/workspaces.ts', import.meta.url))
const { demoStorageKey } = await load(new URL('../../src/portals/persistence.ts', import.meta.url))
const timestamp = '2026-10-15T06:00:00.000Z'
const options = id => ({ id, createdAt: timestamp })
const clone = value => JSON.parse(JSON.stringify(value))
const rawHistory = points => JSON.stringify({ schemaVersion: 1, points })
const names = ['hr', 'cms', 'crm']
function memory() {
  const values = new Map(names.map(module => [demoStorageKey(module), `existing exact raw ${module}`]))
  values.set('unrelated-app', 'keep unrelated raw bytes')
  const actions = []
  return {
    values, actions,
    getItem(key) { actions.push(['get', key]); return values.get(key) ?? null },
    setItem(key, value) { actions.push(['set', key, value]); values.set(key, value) },
    removeItem(key) { actions.push(['remove', key]); values.delete(key) },
  }
}
function changed() {
  const current = createDemoWorkspaces()
  current.cms.entries[1].title = 'Handwritten named-point source'
  current.crm.opportunities[0].amountCents = 123400
  current.hr.role = 'auditor'
  assert.equal(isDemoWorkspaces(current), true)
  return current
}
function assertOnlyHistoryAccess(storage) {
  assert.ok(storage.actions.length)
  assert.ok(storage.actions.every(([, key]) => key === RESTORE_POINTS_KEY))
}
function assertOtherSlots(storage, before) {
  for (const [key, raw] of before) if (key !== RESTORE_POINTS_KEY) assert.equal(storage.values.get(key), raw)
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
function nearLimitHistory() {
  const point = createRestorePoint(large(), ['cms'], 'restore', undefined, options('near-0'))
  const points = [point, { ...clone(point), id: 'near-1' }, { ...clone(point), id: 'near-2' }]
  const target = RESTORE_POINTS_LIMIT - 5
  let extra = rawHistory(points).length - target
  assert.ok(extra > 0)
  for (const item of points) for (const entry of item.states.cms.entries) {
    if (!entry.id.startsWith('cms-entry-')) continue
    const amount = Math.min(extra, entry.body.length - 10)
    entry.body = entry.body.slice(0, entry.body.length - amount)
    extra -= amount
    if (extra === 0) break
  }
  assert.equal(rawHistory(points).length, target)
  assert.deepEqual(parseRestorePoints(rawHistory(points)), points)
  return points
}

test('manual capture writes only history and returns a detached literal selected-scope point', () => {
  const storage = memory()
  const before = new Map(storage.values)
  const current = changed()
  const expectedStates = { hr: clone(current.hr), cms: clone(current.cms) }
  const beforeCurrent = clone(current)
  const result = createManualRestorePoint(current, ['hr', 'cms'], '  Before review  ', storage, options('named-one'))
  assert.equal(result.ok, true)
  assert.deepEqual(result.point, { id: 'named-one', createdAt: timestamp, kind: 'manual',
    modules: ['hr', 'cms'], states: expectedStates, label: 'Before review' })
  assert.deepEqual(Object.keys(result).sort(), ['ok', 'point', 'points', 'status'])
  assert.deepEqual(current, beforeCurrent)
  assert.deepEqual(result.points, [result.point])
  assert.deepEqual(loadRestorePoints(storage).points, [result.point])
  assertOnlyHistoryAccess(storage)
  assert.deepEqual(storage.actions.filter(([action]) => action !== 'get').map(([, key]) => key), [RESTORE_POINTS_KEY])
  assertOtherSlots(storage, before)
  current.cms.entries[1].title = 'Later caller mutation'
  assert.equal(result.point.states.cms.entries[1].title, 'Handwritten named-point source')
  assert.equal(Object.hasOwn(result.point.states, 'crm'), false)
})

test('legacy unlabeled restore and undo records load without migration writes or byte changes', () => {
  const source = createRestorePoint(createDemoWorkspaces(), ['cms'], 'restore', undefined, options('legacy'))
  const undo = createRestorePoint(changed(), ['cms'], 'undo', source.id, options('legacy-undo'))
  const raw = JSON.stringify({ schemaVersion: 1, points: [undo, source] }, null, 3)
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, raw)
  assert.deepEqual(loadRestorePoints(storage).points, [undo, source])
  assert.equal(storage.values.get(RESTORE_POINTS_KEY), raw)
  assert.ok(storage.actions.every(([action]) => action === 'get'))
  assert.ok(loadRestorePoints(storage).points.every(point => !Object.hasOwn(point, 'label')))
})

test('rename changes only one label and preserves identities, UTC timestamps, scopes and captured payloads exactly', () => {
  const current = changed()
  const automatic = createRestorePoint(current, ['cms', 'hr'], 'restore', undefined, options('original'))
  const manual = createRestorePoint(current, ['crm'], 'manual', undefined, { ...options('manual'), label: 'Original manual name' })
  const undo = createRestorePoint(current, ['cms'], 'undo', automatic.id, options('undo'))
  for (const source of [automatic, manual, undo]) {
    const storage = memory()
    const points = [automatic, manual, undo]
    storage.values.set(RESTORE_POINTS_KEY, rawHistory(points))
    const before = new Map(storage.values)
    const captureBytes = JSON.stringify({ id: source.id, createdAt: source.createdAt, kind: source.kind,
      modules: source.modules, states: source.states, ...(source.sourcePointId ? { sourcePointId: source.sourcePointId } : {}) })
    const result = renameRestorePoint(source.id, '  Renamed snapshot  ', storage)
    assert.equal(result.ok, true)
    assert.equal(result.point.label, 'Renamed snapshot')
    const { label, ...capture } = result.point
    assert.equal(label, 'Renamed snapshot')
    assert.equal(JSON.stringify(capture), captureBytes)
    assert.deepEqual(result.points, points.map(point => point.id === source.id ? { ...point, label: 'Renamed snapshot' } : point))
    assertOnlyHistoryAccess(storage)
    assertOtherSlots(storage, before)
    assert.deepEqual(points, [automatic, manual, undo])
  }
})

test('labels are bounded single-line text and strict parsing keeps manual/undo constraints', () => {
  const current = createDemoWorkspaces()
  const automatic = createRestorePoint(current, ['cms'], 'restore', undefined, options('old'))
  assert.equal(RESTORE_POINT_LABEL_MAX, 100)
  assert.equal(normalizeRestorePointLabel('  Café 🌙  '), 'Café 🌙')
  assert.equal(normalizeRestorePointLabel('x'.repeat(100)), 'x'.repeat(100))
  for (const label of ['', '   ', 'x'.repeat(101), 'a\nb', '\na', 'a\tb', '\u0000', 'a\u0085b', 'a\u2028b', 3, null, {}]) {
    assert.throws(() => normalizeRestorePointLabel(label), /1–100 characters/)
    assert.throws(() => parseRestorePoints(rawHistory([{ ...automatic, label }])), /history is damaged/)
  }
  for (const change of [{ kind: 'manual' }, { kind: 'manual', label: 'Valid', sourcePointId: 'other' },
    { kind: 'undo', label: 'Valid' }, { kind: 'undo', label: 'Valid', sourcePointId: 'old' }, { label: ' leading' }]) {
    assert.throws(() => parseRestorePoints(rawHistory([{ ...automatic, ...change }])), /history is damaged/)
  }
  const manual = { ...automatic, kind: 'manual', label: 'Named valid capture' }
  assert.deepEqual(parseRestorePoints(rawHistory([manual])), [manual])
})

test('manual points remain valid Undo sources and Undo retains captured scope and the manual label', () => {
  const storage = memory()
  const saved = changed()
  const captured = createManualRestorePoint(saved, ['cms', 'hr'], 'Before edits', storage, options('manual-source'))
  assert.equal(captured.ok, true)
  const current = createDemoWorkspaces()
  const crmBefore = clone(current.crm)
  const result = undoRestorePoint(current, captured.point.id, storage, options('before-manual-undo'))
  assert.equal(result.ok, true)
  assert.deepEqual(result.states.cms, saved.cms)
  assert.deepEqual(result.states.hr, saved.hr)
  assert.deepEqual(result.states.crm, crmBefore)
  assert.equal(result.point.kind, 'undo')
  assert.equal(result.point.sourcePointId, 'manual-source')
  assert.equal(loadRestorePoints(storage).points.find(point => point.id === 'manual-source').label, 'Before edits')
  assert.equal(previewRestoreBudget(current, current, [], captured.points, { ...options('preview-undo'), sourcePointId: 'manual-source' }).ok, true)
})

test('pure preview is repeatable and default identity/time lengths match an actual new capture', () => {
  const current = changed()
  const selection = ['cms', 'hr']
  const points = [createRestorePoint(current, ['crm'], 'restore', undefined, options('old'))]
  const before = clone({ current, selection, points })
  const first = previewManualRestorePoint(current, selection, 'Named sample', points)
  assert.equal(first.ok, true)
  assert.equal(first.canCreate, true)
  assert.deepEqual(previewManualRestorePoint(current, selection, 'Named sample', points), first)
  assert.deepEqual({ current, selection, points }, before)
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, rawHistory(points))
  const result = createManualRestorePoint(current, selection, 'Named sample', storage)
  assert.equal(result.ok, true)
  assert.equal(first.newPointCharacters, JSON.stringify(result.point).length)
  assert.equal(first.projectedHistoryCharacters, storage.values.get(RESTORE_POINTS_KEY).length)
  assert.equal(first.retainedPoints, result.points.length)
  assert.equal(first.prunedPoints, 0)
})

test('pure preview rejects malformed options without storage, randomness, accessors or live clock use', () => {
  const current = createDemoWorkspaces()
  const realDate = globalThis.Date
  const descriptors = ['window', 'crypto'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  const random = Math.random
  let liveDates = 0
  let uuidCalls = 0
  let getterCalls = 0
  class ObservedDate extends realDate {
    constructor(...args) { if (args.length === 0) liveDates += 1; super(...args) }
    static now() { liveDates += 1; return realDate.now() }
  }
  const getterOptions = Object.defineProperty({}, 'id', { enumerable: true, get() { getterCalls += 1; return null } })
  Object.defineProperty(globalThis, 'window', { configurable: true, get() { throw new Error('Storage access forbidden') } })
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID() { uuidCalls += 1; return '00000000-0000-4000-8000-000000000000' } } })
  globalThis.Date = ObservedDate
  Math.random = () => { throw new Error('Randomness forbidden') }
  try {
    for (const config of [{ id: null }, { createdAt: null }, { id: 3 }, { createdAt: false },
      { id: 'bad id' }, { createdAt: 'bad' }, { extra: true }, { label: 'not-an-option' },
      { [Symbol('hidden')]: true }, getterOptions, [], null, Object.create({ id: 'inherited' })]) {
      assert.equal(previewManualRestorePoint(current, ['cms'], 'Sample point', [], config).ok, false)
    }
    const preview = previewManualRestorePoint(current, ['cms'], 'Sample point', [])
    assert.equal(preview.ok, true)
    assert.equal(preview.point.id.length, 36)
    assert.equal(preview.point.createdAt, '2000-01-01T00:00:00.000Z')
    for (const config of [{ id: null }, { createdAt: null }]) {
      assert.throws(() => createRestorePoint(current, ['cms'], 'restore', undefined, config), /options are invalid/)
    }
  } finally {
    globalThis.Date = realDate
    Math.random = random
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
  assert.equal(liveDates, 0)
  assert.equal(uuidCalls, 0)
  assert.equal(getterCalls, 0)
})

test('manual retention preview and save keep the newest five and include the full label length', () => {
  const current = createDemoWorkspaces()
  const points = Array.from({ length: RESTORE_POINTS_MAX }, (_, index) => createRestorePoint(current, ['cms'], 'restore', undefined, options(`old-${index}`)))
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, rawHistory(points))
  const label = 'x'.repeat(100)
  const preview = previewManualRestorePoint(current, ['hr'], label, points, options('newest'))
  assert.equal(preview.ok, true)
  assert.equal(preview.prunedPoints, 1)
  const result = createManualRestorePoint(current, ['hr'], label, storage, options('newest'))
  assert.equal(result.ok, true)
  assert.deepEqual(result.points.map(point => point.id), ['newest', 'old-0', 'old-1', 'old-2', 'old-3'])
  assert.equal(preview.newPointCharacters, JSON.stringify(result.point).length)
  assert.equal(preview.projectedHistoryCharacters, storage.values.get(RESTORE_POINTS_KEY).length)
  assert.equal(preview.retainedPoints, result.points.length)
  assertOnlyHistoryAccess(storage)
})

test('renaming near the character cap refuses label growth without evicting any point', () => {
  const points = nearLimitHistory()
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, rawHistory(points))
  const before = new Map(storage.values)
  const result = renameRestorePoint('near-1', 'x'.repeat(100), storage)
  assert.equal(result.ok, false)
  assert.match(result.status.message, /label would exceed the 2,000,000-character/)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(storage.actions.filter(([action]) => action !== 'get'), [])
})

test('manual character-budget retention projects and commits the same removed oldest points', () => {
  const points = nearLimitHistory()
  const current = createDemoWorkspaces()
  const storage = memory()
  storage.values.set(RESTORE_POINTS_KEY, rawHistory(points))
  const preview = previewManualRestorePoint(current, ['cms'], 'New capture', points, options('budget-new'))
  assert.equal(preview.ok, true)
  assert.ok(preview.prunedPoints > 0)
  const result = createManualRestorePoint(current, ['cms'], 'New capture', storage, options('budget-new'))
  assert.equal(result.ok, true)
  assert.equal(result.points[0].id, 'budget-new')
  assert.equal(result.points.length, preview.retainedPoints)
  assert.equal(storage.values.get(RESTORE_POINTS_KEY).length, preview.projectedHistoryCharacters)
})

test('oversized newest named capture has a measurable blocked preview and cannot prune or write history', () => {
  let current
  for (let count = 230; count < 250; count += 1) {
    const candidate = large(count)
    try {
      const point = createRestorePoint(candidate, names, 'manual', undefined, { ...options('oversized'), label: 'x'.repeat(100) })
      if (rawHistory([point]).length > RESTORE_POINTS_LIMIT) { current = candidate; break }
    } catch { /* Keep each portal within its existing individual-save limit. */ }
  }
  assert.ok(current)
  const storage = memory()
  const old = createRestorePoint(createDemoWorkspaces(), ['cms'], 'restore', undefined, options('old'))
  storage.values.set(RESTORE_POINTS_KEY, rawHistory([old]))
  const before = new Map(storage.values)
  const preview = previewManualRestorePoint(current, names, 'x'.repeat(100), [old], options('oversized'))
  assert.equal(preview.ok, true)
  assert.equal(preview.canCreate, false)
  assert.ok(preview.projectedHistoryCharacters > RESTORE_POINTS_LIMIT)
  assert.equal(preview.prunedPoints, 1)
  const result = createManualRestorePoint(current, names, 'x'.repeat(100), storage, options('oversized'))
  assert.equal(result.ok, false)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(storage.actions.filter(([action]) => action !== 'get'), [])
})

test('invalid labels, selections, current graphs, identifiers and unreadable history cannot write', () => {
  const current = createDemoWorkspaces()
  const storage = memory()
  const point = createRestorePoint(current, ['cms'], 'restore', undefined, options('present'))
  storage.values.set(RESTORE_POINTS_KEY, rawHistory([point]))
  const before = new Map(storage.values)
  for (const label of ['', ' ', 'x'.repeat(101), '\ninvalid']) {
    assert.equal(createManualRestorePoint(current, ['cms'], label, storage).ok, false)
    assert.equal(renameRestorePoint('present', label, storage).ok, false)
  }
  for (const selected of [[], ['cms', 'cms'], ['other'], null]) assert.equal(createManualRestorePoint(current, selected, 'Valid', storage).ok, false)
  assert.equal(createManualRestorePoint({}, ['cms'], 'Valid', storage).ok, false)
  assert.equal(createManualRestorePoint(current, ['cms'], 'Valid', storage, options('present')).ok, false)
  for (const config of [null, { id: null }, { createdAt: null }, { unknown: true }]) {
    assert.equal(createManualRestorePoint(current, ['cms'], 'Valid', storage, config).ok, false)
  }
  assert.equal(renameRestorePoint('missing', 'Valid', storage).ok, false)
  assert.equal(renameRestorePoint('', 'Valid', storage).ok, false)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(storage.actions.filter(([action]) => action !== 'get'), [])
  for (const input of [null, {}, { points: [], error: 'History read unavailable' }, { points: [point, point] }]) {
    assert.equal(previewManualRestorePoint(current, ['cms'], 'Valid', input).ok, false)
  }
})

test('history read failure and damaged history preserve all existing raw slots', () => {
  const current = createDemoWorkspaces()
  for (const operation of [storage => createManualRestorePoint(current, ['cms'], 'Valid', storage),
    storage => renameRestorePoint('point', 'Valid', storage)]) {
    const storage = memory()
    const before = new Map(storage.values)
    const denied = { ...storage, getItem() { throw new Error('Denied') } }
    assert.equal(operation(denied).ok, false)
    assert.deepEqual(storage.values, before)
    storage.values.set(RESTORE_POINTS_KEY, '{"schemaVersion":2,"points":[]}')
    const damagedBefore = new Map(storage.values)
    assert.equal(operation(storage).ok, false)
    assert.deepEqual(storage.values, damagedBefore)
    assert.deepEqual(storage.actions.filter(([action]) => action !== 'get'), [])
  }
})

test('history-only writes that mutate then throw restore exact previous raw bytes, including absence', () => {
  for (const existing of [false, true]) {
    const current = createDemoWorkspaces()
    const storage = memory()
    if (existing) storage.values.set(RESTORE_POINTS_KEY, JSON.stringify({ schemaVersion: 1,
      points: [createRestorePoint(current, ['cms'], 'restore', undefined, options('existing'))] }, null, 2))
    const before = new Map(storage.values)
    let first = true
    const failed = { ...storage, setItem(key, value) { storage.setItem(key, value); if (first) { first = false; throw new Error('After write') } } }
    const result = existing ? renameRestorePoint('existing', 'Renamed', failed)
      : createManualRestorePoint(current, ['cms'], 'Named', failed, options('new'))
    assert.equal(result.ok, false)
    assert.equal(result.recoveryRequired, undefined)
    assert.deepEqual(storage.values, before)
    assertOnlyHistoryAccess(storage)
  }
})

test('unconfirmed writes and rollback failure report failure without accepting live state', () => {
  const current = changed()
  const beforeCurrent = clone(current)
  const storage = memory()
  const before = new Map(storage.values)
  const ignored = { ...storage, setItem() {} }
  const noWrite = createManualRestorePoint(current, ['cms'], 'Not durable', ignored, options('ignored'))
  assert.equal(noWrite.ok, false)
  assert.equal(noWrite.recoveryRequired, undefined)
  assert.deepEqual(storage.values, before)
  const uncertain = { ...storage, setItem(key, value) { storage.setItem(key, value); throw new Error('Write failed') }, removeItem() { throw new Error('Rollback denied') } }
  const result = createManualRestorePoint(current, ['cms'], 'Uncertain history', uncertain, options('uncertain'))
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, true)
  assert.match(result.status.message, /History may differ/)
  assert.match(result.status.message, /Current workspaces and their saves were not changed/)
  assert.equal(Object.hasOwn(result, 'states'), false)
  assert.deepEqual(current, beforeCurrent)
  assertOtherSlots(storage, before)
})

test('a history change between initial read and commit is preserved and refuses a stale action', () => {
  const current = createDemoWorkspaces()
  const storage = memory()
  const old = createRestorePoint(current, ['cms'], 'restore', undefined, options('old'))
  const concurrent = createRestorePoint(current, ['hr'], 'restore', undefined, options('concurrent'))
  storage.values.set(RESTORE_POINTS_KEY, rawHistory([old]))
  let count = 0
  const raced = { ...storage, getItem(key) { count += 1; if (count === 2) storage.values.set(RESTORE_POINTS_KEY, rawHistory([concurrent])); return storage.getItem(key) } }
  const result = renameRestorePoint('old', 'Stale rename', raced)
  assert.equal(result.ok, false)
  assert.match(result.status.message, /history changed/)
  assert.equal(storage.values.get(RESTORE_POINTS_KEY), rawHistory([concurrent]))
  assert.deepEqual(storage.actions.filter(([action]) => action !== 'get'), [])
})
