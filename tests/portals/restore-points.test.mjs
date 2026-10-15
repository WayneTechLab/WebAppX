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
const history = await load(new URL('../../src/portals/restore-points.ts', import.meta.url))
const { restoreWithCheckpoint, undoRestorePoint } = await load(new URL('../../src/portals/restore-workspaces.ts', import.meta.url))
const { createDemoWorkspaces, isDemoWorkspaces } = await load(new URL('../../src/portals/workspaces.ts', import.meta.url))
const { demoStorageKey } = await load(new URL('../../src/portals/persistence.ts', import.meta.url))
const { RESTORE_POINTS_KEY, RESTORE_POINTS_MAX, RESTORE_POINTS_LIMIT, createRestorePoint, prepareRestorePoints, parseRestorePoints, loadRestorePoints, clearRestorePoints } = history
const timestamp = '2026-10-15T06:00:00.000Z'
const options = id => ({ id, createdAt: timestamp })
const clone = value => JSON.parse(JSON.stringify(value))
const rawHistory = points => JSON.stringify({ schemaVersion: 1, points })
const names = ['hr', 'cms', 'crm']
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
  states.cms.entries[1].title = 'Fictional checkpoint target'
  states.crm.opportunities[0].amountCents = 987600
  states.hr.role = 'auditor'
  assert.equal(isDemoWorkspaces(states), true)
  return states
}
function seed(storage) {
  for (const module of names) storage.values.set(demoStorageKey(module), `original raw ${module}`)
  storage.values.set('unrelated-app', 'keep exactly')
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

test('a checkpoint is a detached selected-only snapshot and persists before portal writes', () => {
  const storage = memory()
  seed(storage)
  const before = new Map(storage.values)
  const current = createDemoWorkspaces()
  const target = changed()
  const currentCopy = clone(current)
  const targetCopy = clone(target)
  const result = restoreWithCheckpoint(current, target, ['cms'], storage, options('point-one'))
  assert.equal(result.ok, true)
  assert.deepEqual(result.modules, ['cms'])
  assert.equal(result.point.kind, 'restore')
  assert.deepEqual(result.point.states, { cms: currentCopy.cms })
  assert.deepEqual(Object.keys(result.point.states), ['cms'])
  assert.deepEqual(result.states, { ...currentCopy, cms: targetCopy.cms })
  assert.deepEqual(current, currentCopy)
  assert.deepEqual(target, targetCopy)
  current.cms.entries[1].title = 'Changed caller after snapshot'
  target.cms.entries[1].title = 'Changed target after snapshot'
  assert.deepEqual(result.point.states.cms, currentCopy.cms)
  assert.deepEqual(result.states.cms, targetCopy.cms)
  assert.deepEqual(storage.actions.filter(([type]) => type !== 'get').map(([, key]) => key), [RESTORE_POINTS_KEY, demoStorageKey('cms')])
  for (const [key, value] of before) if (key !== demoStorageKey('cms')) assert.equal(storage.values.get(key), value)
  assert.deepEqual(loadRestorePoints(storage).points, result.points)
})

test('refresh reload exposes the same durable checkpoint and undo restores only its original modules', () => {
  const storage = memory()
  seed(storage)
  const initial = createDemoWorkspaces()
  const applied = restoreWithCheckpoint(initial, changed(), ['hr', 'cms'], storage, options('before-import'))
  assert.equal(applied.ok, true)
  const point = loadRestorePoints(storage).points[0]
  const later = clone(applied.states)
  later.cms.entries[1].title = 'Later saved CMS edit that undo replaces'
  later.crm.opportunities[0].amountCents = 111100
  const crmRaw = storage.values.get(demoStorageKey('crm'))
  const undo = undoRestorePoint(later, point.id, storage, options('before-undo'))
  assert.equal(undo.ok, true)
  assert.deepEqual(undo.states.hr, initial.hr)
  assert.deepEqual(undo.states.cms, initial.cms)
  assert.deepEqual(undo.states.crm, later.crm)
  assert.equal(storage.values.get(demoStorageKey('crm')), crmRaw)
  assert.equal(undo.point.kind, 'undo')
  assert.equal(undo.point.sourcePointId, point.id)
  assert.deepEqual(undo.point.states, { hr: later.hr, cms: later.cms })
  assert.equal(loadRestorePoints(storage).points.length, 2)
})

test('undo of undo restores the pre-undo state and retains a new recovery point', () => {
  const storage = memory()
  const initial = createDemoWorkspaces()
  const imported = restoreWithCheckpoint(initial, changed(), names, storage, options('import'))
  const undo = undoRestorePoint(imported.states, 'import', storage, options('undo'))
  const redo = undoRestorePoint(undo.states, 'undo', storage, options('undo-undo'))
  assert.equal(redo.ok, true)
  assert.deepEqual(redo.states, imported.states)
  assert.equal(redo.point.sourcePointId, 'undo')
  assert.deepEqual(redo.points.map(point => point.id), ['undo-undo', 'undo', 'import'])
})

test('retention keeps the newest five restore or undo points', () => {
  const storage = memory()
  let current = createDemoWorkspaces()
  for (let index = 1; index <= 7; index += 1) {
    const result = restoreWithCheckpoint(current, changed(), ['cms'], storage, options(`point-${index}`))
    assert.equal(result.ok, true)
    current = result.states
  }
  const loaded = loadRestorePoints(storage)
  assert.equal(loaded.points.length, RESTORE_POINTS_MAX)
  assert.deepEqual(loaded.points.map(point => point.id), ['point-7', 'point-6', 'point-5', 'point-4', 'point-3'])
  const before = new Map(storage.values)
  assert.equal(undoRestorePoint(current, 'point-1', storage).ok, false)
  assert.deepEqual(storage.values, before)
})

test('retention prunes oldest snapshots to the total character budget', () => {
  const states = large()
  let points = []
  for (let index = 0; index < 5; index += 1) points = prepareRestorePoints(points, createRestorePoint(states, ['cms'], 'restore', undefined, options(`large-${index}`))).points
  assert.ok(points.length < RESTORE_POINTS_MAX)
  assert.ok(points.length >= 2)
  assert.equal(points[0].id, 'large-4')
  assert.equal(points.at(-1).id, `large-${5 - points.length}`)
  assert.ok(rawHistory(points).length <= RESTORE_POINTS_LIMIT)
})

test('a newest checkpoint that cannot fit blocks restore without writing or pruning old history', () => {
  const storage = memory()
  seed(storage)
  const old = createRestorePoint(createDemoWorkspaces(), ['cms'], 'restore', undefined, options('keep-old'))
  storage.values.set(RESTORE_POINTS_KEY, rawHistory([old]))
  const before = new Map(storage.values)
  const result = restoreWithCheckpoint(large(260), changed(), ['cms'], storage, options('too-large'))
  assert.equal(result.ok, false)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(storage.actions.filter(([type]) => type !== 'get'), [])
})

test('valid individual saves whose combined checkpoint exceeds history budget are refused without writes', () => {
  let oversized
  for (let count = 230; count < 250; count += 1) {
    const states = large(count)
    try {
      const point = createRestorePoint(states, names, 'restore', undefined, options('whole-snapshot'))
      if (rawHistory([point]).length > RESTORE_POINTS_LIMIT) { oversized = states; break }
    } catch { /* Each individual portal must still fit its existing save limit. */ }
  }
  assert.ok(oversized, 'fixture reaches history limit while each portal save remains valid')
  const storage = memory()
  seed(storage)
  const before = new Map(storage.values)
  const result = restoreWithCheckpoint(oversized, changed(), names, storage, options('cannot-fit'))
  assert.equal(result.ok, false)
  assert.match(result.status.message, /2,000,000-character history limit/)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(storage.actions.filter(([type]) => type !== 'get'), [])
})

test('missing history is normal and explicit clear touches history alone', () => {
  const storage = memory()
  seed(storage)
  assert.deepEqual(loadRestorePoints(storage).points, [])
  assert.equal(loadRestorePoints(storage).error, undefined)
  storage.values.set(RESTORE_POINTS_KEY, 'damaged history')
  const saved = new Map(storage.values)
  const result = clearRestorePoints(storage)
  assert.equal(result.ok, true)
  assert.match(result.status, /workspace saves are unchanged/)
  assert.equal(storage.values.has(RESTORE_POINTS_KEY), false)
  for (const [key, value] of saved) if (key !== RESTORE_POINTS_KEY) assert.equal(storage.values.get(key), value)
})

test('damaged, incompatible and oversized history blocks future mutations until explicit clear', () => {
  for (const raw of ['not JSON', '{"schemaVersion":2,"points":[]}', ' '.repeat(RESTORE_POINTS_LIMIT + 1)]) {
    const storage = memory()
    seed(storage)
    storage.values.set(RESTORE_POINTS_KEY, raw)
    const before = new Map(storage.values)
    assert.match(loadRestorePoints(storage).error, /Clear restore points explicitly/)
    const result = restoreWithCheckpoint(createDemoWorkspaces(), changed(), ['cms'], storage)
    assert.equal(result.ok, false)
    assert.match(result.status.message, /Clear restore points explicitly/)
    assert.deepEqual(storage.values, before)
    assert.deepEqual(storage.actions.filter(([type]) => type !== 'get'), [])
    assert.equal(clearRestorePoints(storage).ok, true)
    assert.equal(restoreWithCheckpoint(createDemoWorkspaces(), changed(), ['cms'], storage).ok, true)
  }
})

test('strict history rejects invalid envelope fields, point identities, timestamps, selections and nested graphs', () => {
  const point = createRestorePoint(createDemoWorkspaces(), ['cms'], 'restore', undefined, options('valid'))
  const invalid = [
    { schemaVersion: 1, points: [], extra: true },
    { schemaVersion: 1, points: Array(6).fill(point) },
    { schemaVersion: 1, points: [point, point] },
  ]
  const changes = [
    { id: '' }, { id: 'id with space' }, { id: 'x'.repeat(101) },
    { createdAt: '2026-02-30T00:00:00.000Z' }, { createdAt: '2026-10-15T06:00:00Z' },
    { kind: 'other' }, { kind: 'undo' }, { kind: 'undo', sourcePointId: point.id },
    { sourcePointId: 'unexpected-on-restore' }, { extra: true },
    { modules: [] }, { modules: ['CMS'] }, { modules: ['cms', 'cms'] },
    { modules: ['hr'] }, { states: {} }, { states: { ...point.states, hr: createDemoWorkspaces().hr } },
    { states: { cms: {} } },
    { label: null }, { label: '' }, { label: 'x'.repeat(101) },
    { kind: 'manual' }, { kind: 'manual', label: 'Valid name', sourcePointId: 'unexpected' },
  ]
  for (const change of changes) invalid.push({ schemaVersion: 1, points: [{ ...point, ...change }] })
  for (const value of invalid) assert.throws(() => parseRestorePoints(JSON.stringify(value)), /history is damaged/)
  const reserved = rawHistory([point]).replace('"title":', '"__proto__":{},"title":')
  assert.throws(() => parseRestorePoints(reserved), /history is damaged/)
})

test('optional descriptive labels preserve legacy captures and round-trip beside old unlabeled points', () => {
  const states = createDemoWorkspaces()
  const old = createRestorePoint(states, ['cms'], 'restore', undefined, options('old-unlabeled'))
  const labeled = createRestorePoint(states, ['hr'], 'restore', undefined, { ...options('new-labeled'), label: '  Before HR edits  ' })
  assert.equal(Object.hasOwn(old, 'label'), false)
  assert.equal(labeled.label, 'Before HR edits')
  assert.deepEqual(parseRestorePoints(rawHistory([labeled, old])), [labeled, old])
})

test('history read and clear denials are explicit and never write portal data', () => {
  const denied = { getItem() { throw new Error('Denied') }, setItem() { throw new Error('Unexpected write') }, removeItem() { throw new Error('Denied') } }
  assert.match(loadRestorePoints(denied).error, /could not read/)
  assert.equal(clearRestorePoints(denied).ok, false)
  assert.equal(loadRestorePoints(null).points.length, 0)
  const result = restoreWithCheckpoint(createDemoWorkspaces(), changed(), ['cms'], denied)
  assert.equal(result.ok, false)
  assert.equal(result.status.kind, 'unavailable')
})

test('history write failure rolls back its prior bytes before any selected save is written', () => {
  for (const existing of [false, true]) {
    const storage = memory()
    seed(storage)
    if (existing) storage.values.set(RESTORE_POINTS_KEY, rawHistory([createRestorePoint(createDemoWorkspaces(), ['hr'], 'restore', undefined, options('old'))]))
    const before = new Map(storage.values)
    let first = true
    const failure = { ...storage, setItem(key, value) { storage.setItem(key, value); if (first) { first = false; throw new Error('Quota after write') } } }
    const result = restoreWithCheckpoint(createDemoWorkspaces(), changed(), names, failure, options('new'))
    assert.equal(result.ok, false)
    assert.equal(result.recoveryRequired, undefined)
    assert.deepEqual(storage.values, before)
    assert.deepEqual(storage.actions.filter(([type]) => type !== 'get').map(([, key]) => key), [RESTORE_POINTS_KEY, RESTORE_POINTS_KEY])
  }
})

test('partial portal failure reverses every attempted slot and history with exact raw restoration', () => {
  const storage = memory()
  seed(storage)
  const before = new Map(storage.values)
  let count = 0
  const failure = { ...storage, setItem(key, value) { count += 1; storage.setItem(key, value); if (count === 3) throw new Error('CMS quota after write') } }
  const result = restoreWithCheckpoint(createDemoWorkspaces(), changed(), names, failure, options('new'))
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, undefined)
  assert.deepEqual(storage.values, before)
  assert.deepEqual(storage.actions.filter(([type]) => type !== 'get').map(([type, key]) => [type, key]), [
    ['set', RESTORE_POINTS_KEY], ['set', demoStorageKey('hr')], ['set', demoStorageKey('cms')],
    ['set', demoStorageKey('cms')], ['set', demoStorageKey('hr')], ['remove', RESTORE_POINTS_KEY],
  ])
})

test('rollback uncertainty names history and the affected portal without claiming preservation', () => {
  const storage = memory()
  seed(storage)
  let count = 0
  const failure = { ...storage, setItem(key, value) { count += 1; storage.setItem(key, value); if ([3, 4].includes(count)) throw new Error('Write/rollback failed') }, removeItem(key) { if (key === RESTORE_POINTS_KEY) throw new Error('History rollback failed'); storage.removeItem(key) } }
  const current = createDemoWorkspaces()
  const before = clone(current)
  const result = restoreWithCheckpoint(current, changed(), names, failure, options('new'))
  assert.equal(result.ok, false)
  assert.equal(result.recoveryRequired, true)
  assert.match(result.status.message, /CMS save, restore-point history/)
  assert.match(result.status.message, /Keep this tab open and export/)
  assert.deepEqual(current, before)
  assert.equal(storage.values.get(demoStorageKey('crm')), 'original raw crm')
  assert.equal(storage.values.get('unrelated-app'), 'keep exactly')
})

test('invalid current/target data, empty selection and invalid options cannot overwrite saves', () => {
  for (const [current, target, selected, config] of [
    [{}, changed(), ['cms'], options('valid')],
    [createDemoWorkspaces(), {}, ['cms'], options('valid')],
    [createDemoWorkspaces(), changed(), [], options('valid')],
    [createDemoWorkspaces(), changed(), ['cms'], options('invalid id')],
    [createDemoWorkspaces(), changed(), ['cms'], { id: 'valid', createdAt: 'bad-date' }],
  ]) {
    const storage = memory()
    seed(storage)
    const before = new Map(storage.values)
    assert.equal(restoreWithCheckpoint(current, target, selected, storage, config).ok, false)
    assert.deepEqual(storage.values, before)
    assert.deepEqual(storage.actions.filter(([type]) => type !== 'get'), [])
  }
})

test('current in-memory state is snapshotted even when prior raw saves differ or are absent', () => {
  const storage = memory()
  const current = changed()
  storage.values.set(demoStorageKey('cms'), 'older raw save')
  const result = restoreWithCheckpoint(current, createDemoWorkspaces(), ['cms', 'crm'], storage, options('capture-live'))
  assert.equal(result.ok, true)
  assert.deepEqual(result.point.states, { cms: current.cms, crm: current.crm })
  assert.deepEqual(loadRestorePoints(storage).points[0].states, result.point.states)
})

test('duplicate checkpoint identifiers and missing undo points never mutate saves', () => {
  const storage = memory()
  const states = createDemoWorkspaces()
  assert.equal(restoreWithCheckpoint(states, changed(), ['cms'], storage, options('existing')).ok, true)
  const before = new Map(storage.values)
  assert.equal(restoreWithCheckpoint(states, changed(), ['cms'], storage, options('existing')).ok, false)
  assert.equal(undoRestorePoint(states, 'missing', storage).ok, false)
  assert.equal(undoRestorePoint(states, '', storage).ok, false)
  assert.deepEqual(storage.values, before)
})
