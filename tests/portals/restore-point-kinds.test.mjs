import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const { createDemoWorkspaces } = await loadMockModel(new URL('../../src/portals/workspaces.ts', import.meta.url))
const { createRestorePoint, parseRestorePoints, prepareRestorePoints } = await loadMockModel(new URL('../../src/portals/restore-points.ts', import.meta.url))
const states = createDemoWorkspaces()
const snapshot = JSON.stringify(states)
const options = { id: 'point-operation', createdAt: '2026-10-15T20:00:00.000Z' }

test('opt-in individual import and Reset captures retain explicit operation identity and selected-only records', () => {
  for (const kind of ['import', 'reset']) {
    const point = createRestorePoint(states, ['cms'], kind, undefined, { ...options, label: `Before CMS ${kind}` })
    assert.deepEqual(point, { id: options.id, createdAt: options.createdAt, kind, modules: ['cms'], states: { cms: states.cms }, label: `Before CMS ${kind}` })
    assert.deepEqual(parseRestorePoints(prepareRestorePoints([], point).raw), [point])
    point.states.cms.entries[1].title = 'Detached snapshot edit'
    assert.equal(JSON.stringify(states), snapshot)
  }
})

test('new automatic capture kinds require valid labels and never acquire Undo source links', () => {
  for (const kind of ['import', 'reset']) {
    for (const label of [undefined, '', '   ', 'multiple\nlines']) {
      assert.throws(() => createRestorePoint(states, ['cms'], kind, undefined, { ...options, ...(label === undefined ? {} : { label }) }))
    }
    assert.throws(() => createRestorePoint(states, ['cms'], kind, 'source-point', { ...options, label: 'Before replacement' }))
  }
})

test('original unlabeled restore and Undo envelopes load with no migration or new fields', () => {
  const restore = createRestorePoint(states, ['crm'], 'restore', undefined, { ...options, id: 'old-restore' })
  const undo = createRestorePoint(states, ['hr'], 'undo', restore.id, { ...options, id: 'old-undo' })
  const raw = JSON.stringify({ schemaVersion: 1, points: [undo, restore] })
  assert.equal(JSON.stringify({ schemaVersion: 1, points: parseRestorePoints(raw) }), raw)
  assert.equal(Object.hasOwn(restore, 'label'), false)
  const invalid = JSON.parse(raw)
  invalid.points[1].kind = 'unrecognized-operation'
  assert.throws(() => parseRestorePoints(JSON.stringify(invalid)))
})
