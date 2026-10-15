import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMockModel } from '../browser/model-loader.mjs'

const points = await loadMockModel(new URL('../../src/portals/restore-points.ts', import.meta.url))
const restore = await loadMockModel(new URL('../../src/portals/restore-workspaces.ts', import.meta.url))
const { createDemoWorkspaces } = await loadMockModel(new URL('../../src/portals/workspaces.ts', import.meta.url))
const timestamp = '2026-10-15T18:00:00.000Z'
const raw = point => JSON.stringify({ schemaVersion: 1, points: [point] })

function fixture() {
  const current = createDemoWorkspaces()
  const previewed = points.createRestorePoint(current, ['cms'], 'manual', undefined, { id: 'previewed-point', createdAt: timestamp, label: 'Reviewed capture' })
  const values = new Map([[points.RESTORE_POINTS_KEY, raw(previewed)], ['webappx.demo.hr', 'keep-hr'], ['webappx.demo.cms', 'keep-cms'], ['webappx.demo.crm', 'keep-crm'], ['unrelated', 'keep-other']])
  const writes = []
  const storage = { getItem: key => values.get(key) ?? null, setItem(key, value) { writes.push(key); values.set(key, value) }, removeItem(key) { writes.push(key); values.delete(key) } }
  return { current, previewed, values, writes, storage }
}

for (const change of ['capture', 'scope', 'label', 'missing']) test(`Undo refuses a ${change} change after preview before any save or history write`, () => {
  const f = fixture()
  const latest = structuredClone(f.previewed)
  if (change === 'capture') latest.states.cms.entries[1].title = 'A different valid current capture'
  if (change === 'scope') { latest.modules = ['crm']; latest.states = { crm: f.current.crm } }
  if (change === 'label') latest.label = 'Changed after review'
  f.values.set(points.RESTORE_POINTS_KEY, change === 'missing' ? JSON.stringify({ schemaVersion: 1, points: [] }) : raw(latest))
  const before = structuredClone(f.current), saved = [...f.values]
  const result = restore.undoRestorePoint(f.current, f.previewed.id, f.storage, { id: 'new-point', createdAt: timestamp }, f.previewed)
  assert.equal(result.ok, false)
  assert.match(result.status.message, /changed after its preview/)
  assert.deepEqual(f.writes, [])
  assert.deepEqual([...f.values], saved)
  assert.deepEqual(f.current, before)
})

test('unchanged preview recovers the exact selected snapshot and leaves other saves intact', () => {
  const f = fixture()
  f.current.cms.entries[1].title = 'A later saved fictional title'
  const expectedCapture = structuredClone(f.previewed)
  const result = restore.undoRestorePoint(f.current, f.previewed.id, f.storage, { id: 'new-point', createdAt: timestamp }, f.previewed)
  assert.equal(result.ok, true)
  assert.deepEqual(result.states.cms, expectedCapture.states.cms)
  assert.deepEqual(f.previewed, expectedCapture)
  assert.deepEqual(f.writes, [points.RESTORE_POINTS_KEY, 'webappx.demo.cms'])
  assert.equal(f.values.get('webappx.demo.hr'), 'keep-hr')
  assert.equal(f.values.get('webappx.demo.crm'), 'keep-crm')
  assert.equal(f.values.get('unrelated'), 'keep-other')
})
