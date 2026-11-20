import assert from 'node:assert/strict'
import test from 'node:test'
import { createNavigatorBookmarks, navigatorBookmarkLimit } from '../Website/preview-navigator-bookmarks.js'

const workspace = 'a'.repeat(64), foreign = 'b'.repeat(64)
const documentId = 'doc_' + 'c'.repeat(64)
const nodeId = index => 'node_' + index.toString(16).padStart(64, '0')
const namespace = 'systemx.lan.navigator-bookmarks.v1.' + workspace

function fixture(options = {}) {
  const values = new Map(), mutations = [], reveals = []
  const storage = {
    getItem(key) { return values.get(key) ?? null },
    setItem(key, data) { mutations.push(key); values.set(key, data) },
    removeItem(key) { mutations.push(key); values.delete(key) },
  }
  const state = { workspaceId: workspace, route: '/private-route', root: {}, limited: false, rows: [], selected: null }
  let onInspect = null, scans = 0
  function target(index) {
    return { element: { label: 'PRIVATE_CUSTOMER_DATA' }, nodeId: nodeId(index), key: 'private-source-path:' + index }
  }
  function setRows(...rows) { state.rows = rows; state.selected = rows[0]?.element ?? null }
  function inspect() {
    onInspect?.(++scans)
    return { workspaceId: state.workspaceId, route: state.route, snapshot: { root: state.root, rangeLimited: state.limited },
      selected: state.selected, identities: new Map(state.rows.map(row => [row.element,
        { documentId, nodeId: row.nodeId, key: row.key, workspaceId: state.workspaceId, route: state.route }])) }
  }
  function open() {
    return createNavigatorBookmarks({ getWorkspace: () => state.workspaceId, inspect,
      reveal: (element, snapshot) => { assert.equal(snapshot.root, state.root); reveals.push(element); return true },
      storage: () => storage, withWriteLock: (_key, operation) => operation(), ...options })
  }
  return { open, target, setRows, state, values, mutations, reveals, storage, beforeScan(callback) { onInspect = callback; scans = 0 } }
}

test('bookmarks persist only typed IDs and require an explicit fresh resolve even after reload and remount', async () => {
  const f = fixture(), initial = f.target(1), other = f.target(2)
  f.setRows(initial, other)
  const first = f.open()
  assert.equal(first.read().bookmarks.length, 0)
  const saved = await first.save(workspace)
  assert.equal(saved.ok, true)
  assert.deepEqual(Object.keys(saved.bookmark).sort(), ['documentId', 'nodeId', 'scopeId'])
  assert.match(saved.bookmark.scopeId, /^scope_[a-f0-9]{64}$/)
  const raw = f.values.get(namespace)
  assert.deepEqual(JSON.parse(raw), { version: 1, bookmarks: [saved.bookmark] })
  assert.doesNotMatch(raw, /private|PRIVATE|src\/|route|anchor|label|textContent|timestamp/)
  assert.equal((await first.save(workspace)).ok, true)
  assert.equal(f.mutations.length, 1)
  const next = f.open(), replacement = f.target(1)
  f.setRows(other, replacement)
  assert.deepEqual(next.read().bookmarks, [saved.bookmark])
  assert.deepEqual(f.reveals, [])
  const result = await next.resolve(workspace, saved.bookmark)
  assert.equal(result.ok, true)
  assert.match(result.message, /reveal progress/)
  assert.deepEqual(f.reveals, [replacement.element])
  assert.equal(f.state.selected, other.element)
  assert.equal(f.values.get(namespace), raw)
})

test('missing, stale, duplicate, truncated and cross-scope targets preserve stored data and never reveal another row', async () => {
  const f = fixture(), row = f.target(3), stranger = f.target(8)
  f.setRows(row)
  const bookmarks = f.open()
  const { bookmark } = await bookmarks.save(workspace)
  const raw = f.values.get(namespace)
  for (const rows of [[stranger], [], [row, { ...row, element: {} }]]) {
    f.setRows(...rows)
    const selected = f.state.selected
    const result = await bookmarks.resolve(workspace, bookmark)
    assert.equal(result.ok, false)
    assert.match(result.message, /missing, ambiguous, stale/)
    assert.equal(f.state.selected, selected)
  }
  f.setRows(row); f.state.limited = true
  assert.match((await bookmarks.resolve(workspace, bookmark)).message, /truncated range/)
  assert.equal((await bookmarks.save(workspace)).ok, false)
  f.state.limited = false; f.state.route = '/elsewhere'
  assert.match((await bookmarks.resolve(workspace, bookmark)).message, /another route/)
  f.state.workspaceId = foreign
  assert.equal(bookmarks.read().bookmarks.length, 0)
  assert.equal((await bookmarks.resolve(workspace, bookmark)).ok, false)
  assert.equal((await bookmarks.remove(workspace, bookmark)).ok, false)
  assert.equal(f.values.get(namespace), raw)
  assert.deepEqual(f.reveals, [])
})

test('a change during route qualification or write admission refuses the old action', async () => {
  let release
  const f = fixture({ withWriteLock: (_name, run) => new Promise(resolve => { release = () => resolve(run()) }) })
  const a = f.target(1), b = f.target(2)
  f.setRows(a, b)
  const bookmarks = f.open()
  const pending = bookmarks.save(workspace)
  f.state.selected = b.element
  release()
  assert.equal((await pending).ok, false)
  assert.deepEqual(f.mutations, [])
  const second = bookmarks.save(workspace)
  release()
  const saved = await second
  for (const change of [
    () => { f.state.root = {} },
    () => { f.state.selected = a.element },
    () => { f.state.rows = [a, { ...b, element: {} }] },
    () => { f.state.rows = [a, { ...b, key: 'changed declaration' }] },
  ]) {
    f.setRows(b, a)
    f.beforeScan(n => { if (n === 2) change() })
    const result = await bookmarks.resolve(workspace, saved.bookmark)
    assert.equal(result.ok, false)
    assert.deepEqual(f.reveals, [])
  }
})

test('bounded slots refuse overflow and explicit deletion targets identity after another tab removes an earlier slot', async () => {
  const f = fixture(), bookmarks = f.open()
  for (let i = 1; i <= navigatorBookmarkLimit; i++) {
    f.setRows(f.target(i))
    assert.equal((await bookmarks.save(workspace)).ok, true)
  }
  const entries = bookmarks.read().bookmarks
  f.setRows(f.target(100))
  assert.match((await bookmarks.save(workspace)).message, /All 12 bookmark slots/)
  const otherTab = f.open()
  assert.equal((await otherTab.remove(workspace, entries[0])).ok, true)
  assert.equal((await bookmarks.remove(workspace, entries[4])).ok, true)
  assert.equal((await otherTab.remove(workspace, entries[0])).ok, false)
  assert.deepEqual(bookmarks.read().bookmarks, entries.filter((_, i) => i !== 0 && i !== 4))
  assert.equal((await bookmarks.save(workspace)).ok, true)
  for (const entry of bookmarks.read().bookmarks) assert.equal((await bookmarks.remove(workspace, entry)).ok, true)
  assert.equal(f.values.has(namespace), false)
})

test('malformed, oversized and unexpected stored fields remain untouched until the exact invalid record is explicitly deleted', async () => {
  const f = fixture(), bookmarks = f.open()
  f.setRows(f.target(1))
  const sample = (await bookmarks.save(workspace)).bookmark
  const target = { version: 1, bookmarks: [sample] }
  for (const raw of ['{', 'x'.repeat(4097), JSON.stringify({ ...target, secret: 'PRIVATE_METADATA' }),
    JSON.stringify({ ...target, bookmarks: [sample, sample] }), JSON.stringify({ ...target, bookmarks: [{ ...sample, label: 'PRIVATE' }] }),
    JSON.stringify({ ...target, bookmarks: [{ ...sample, scopeId: null }] })]) {
    f.values.set(namespace, raw)
    const before = f.mutations.length
    assert.equal(bookmarks.read().status, 'invalid')
    assert.equal((await bookmarks.save(workspace)).ok, false)
    assert.equal((await bookmarks.resolve(workspace, sample)).ok, false)
    assert.equal(f.mutations.length, before)
    assert.equal(f.values.get(namespace), raw)
    f.values.set(namespace, raw + 'changed')
    assert.equal((await bookmarks.remove(workspace, null, raw)).ok, false)
    assert.equal((await bookmarks.remove(workspace, null, raw + 'changed')).ok, true)
    assert.equal(f.values.has(namespace), false)
  }
  assert.deepEqual(f.reveals, [])
})

test('storage quota, permission failure, invalid workspace, and unsupported selection give actionable outcomes', async () => {
  const f = fixture(), bookmarks = f.open()
  const row = f.target(9)
  f.setRows(row)
  f.state.selected = {}
  assert.match((await bookmarks.save(workspace)).message, /Select a unique/)
  f.state.selected = row.element
  const saved = await bookmarks.save(workspace)
  const before = f.values.get(namespace)
  f.storage.setItem = () => { throw Error('private quota error') }
  f.setRows(f.target(10))
  const refused = await bookmarks.save(workspace)
  assert.equal(refused.ok, false)
  assert.match(refused.message, /quota/)
  assert.equal(f.values.get(namespace), before)
  f.storage.getItem = () => { throw Error('private permission error') }
  assert.equal(bookmarks.read().status, 'unavailable')
  f.setRows(row)
  assert.equal((await bookmarks.resolve(workspace, saved.bookmark)).ok, false)
  f.state.workspaceId = 'private unsupported workspace'
  assert.equal(bookmarks.read().status, 'no-workspace')
  assert.equal((await bookmarks.save(f.state.workspaceId)).ok, false)
  assert.deepEqual(f.reveals, [])
})
