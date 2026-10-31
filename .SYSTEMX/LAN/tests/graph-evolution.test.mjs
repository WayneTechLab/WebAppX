import test from 'node:test'
import assert from 'node:assert/strict'
import {
  compareGraphs,
  previewGraphMigration,
  applyGraphMigration,
  exportGraphDocument,
  reopenGraphDocument,
} from '../Builder/graph-evolution.mjs'
import { graphRevision } from '../Builder/graph-core.mjs'

const WORKSPACE = 'a'.repeat(64)
const SOURCE_REVISION = 'b'.repeat(64)
const clone = value => JSON.parse(JSON.stringify(value))

function node(id, parentId, childIds = [], label = id) {
  return { id, kind: parentId === null ? 'document-root' : 'element', parentId, childIds, label,
    ownership: 'read-only', source: null, opaqueReason: null }
}

function graph() {
  return {
    schemaVersion: 1,
    workspaceId: WORKSPACE,
    documentId: 'DocA',
    sourceRevision: SOURCE_REVISION,
    pages: [{ id: 'PageA', rootId: 'Root', route: '/' }],
    nodes: [node('Root', null, ['First', 'Second']), node('First', 'Root'), node('Second', 'Root')],
    references: [],
    components: [],
    collections: [],
    extensions: {},
  }
}

function legacyGraph() {
  const current = graph()
  const { pages, ...legacy } = current
  legacy.schemaVersion = 0
  legacy.page = pages[0]
  legacy.nodes = legacy.nodes.map(({ childIds, ...item }) => item)
  return legacy
}

test('comparison is revision based, bounded, deterministic and leaves both graphs unchanged', () => {
  const before = graph()
  const after = clone(before)
  after.nodes.reverse() // Collection insertion order is insignificant.
  const beforeBytes = JSON.stringify(before)
  const afterBytes = JSON.stringify(after)
  const same = compareGraphs(before, after)
  assert.equal(same.beforeRevision, same.afterRevision)
  assert.deepEqual([same.added, same.removed, same.changed, same.reordered], [[], [], [], []])
  assert.deepEqual(same.totals, { added: 0, removed: 0, changed: 0, reordered: 0 })
  assert.equal(same.omittedCount, 0)
  assert.equal(JSON.stringify(before), beforeBytes)
  assert.equal(JSON.stringify(after), afterBytes)

  after.nodes.find(item => item.id === 'Root').childIds.reverse()
  const reordered = compareGraphs(before, after)
  assert.notEqual(reordered.beforeRevision, reordered.afterRevision)
  assert.deepEqual(reordered.reordered, [{ kind: 'node', id: 'Root' }])
  assert.deepEqual(reordered.changed, [])
  assert.equal(JSON.stringify(before), beforeBytes)
})

test('comparison distinguishes additions, removals, field changes and document metadata', () => {
  const before = graph()
  const after = clone(before)
  after.sourceRevision = 'c'.repeat(64)
  after.nodes.find(item => item.id === 'First').label = 'Renamed'
  after.nodes.find(item => item.id === 'Root').childIds = ['First', 'Third']
  after.nodes = after.nodes.filter(item => item.id !== 'Second')
  after.nodes.push(node('Third', 'Root'))
  const result = compareGraphs(before, after)
  assert.deepEqual(result.added, [{ kind: 'node', id: 'Third' }])
  assert.deepEqual(result.removed, [{ kind: 'node', id: 'Second' }])
  assert.deepEqual(result.changed, [
    { kind: 'document', id: 'DocA' },
    { kind: 'node', id: 'First' },
    { kind: 'node', id: 'Root' },
  ])
  assert.deepEqual(result.reordered, [])
  assert.equal(result.beforeRevision, graphRevision(before))
  assert.equal(result.afterRevision, graphRevision(after))
})

test('comparison refuses invalid or unrelated documents without accepting partial changes', () => {
  const before = graph()
  const unrelated = graph()
  unrelated.documentId = 'OtherDoc'
  assert.throws(() => compareGraphs(before, unrelated), { code: 'GRAPH_COMPARISON_IDENTITY' })
  const cyclic = graph()
  cyclic.nodes.find(item => item.id === 'Root').parentId = 'First'
  cyclic.nodes.find(item => item.id === 'First').childIds.push('Root')
  assert.throws(() => compareGraphs(before, cyclic))
  assert.deepEqual(before, graph())
})

test('comparison reports exact totals when changed-object details are bounded', () => {
  const before = graph()
  const after = clone(before)
  for (let index = 0; index < 60; index++) {
    const id = `Added${index}`
    after.nodes[0].childIds.push(id)
    after.nodes.push(node(id, 'Root'))
  }
  const result = compareGraphs(before, after)
  assert.equal(result.totals.added, 60)
  assert.equal(result.added.length, 50)
  assert.equal(result.omittedCount, 10)
  assert.deepEqual(result.changed, [{ kind: 'node', id: 'Root' }])
})

test('export and reopen retain canonical revision and explicit sibling order', () => {
  const original = graph()
  const before = JSON.stringify(original)
  const exported = exportGraphDocument(original)
  assert.deepEqual(Object.keys(exported), ['format', 'formatVersion', 'revision', 'document'])
  assert.equal(exported.format, 'webappx-graph')
  assert.equal(exported.formatVersion, 1)
  assert.equal(exported.revision, graphRevision(original))
  const reopened = reopenGraphDocument(exported)
  assert.equal(graphRevision(reopened), exported.revision)
  assert.deepEqual(reopened.nodes.find(item => item.id === 'Root').childIds, ['First', 'Second'])
  assert.equal(exportGraphDocument(reopened).revision, exported.revision)
  reopened.nodes.find(item => item.id === 'Root').childIds.reverse()
  assert.deepEqual(original.nodes[0].childIds, ['First', 'Second'])
  assert.equal(JSON.stringify(original), before)
})

test('reviewed readonly extension metadata survives migration and export/reopen', () => {
  const legacy = legacyGraph()
  legacy.extensions['org.webappx.readonly'] = { provenance: { note: 'Reviewed metadata' } }
  const preview = previewGraphMigration(legacy)
  const migrated = applyGraphMigration(preview, { digest: preview.digest, confirmation: 'MIGRATE GRAPH COPY' })
  const exported = exportGraphDocument(migrated)
  const reopened = reopenGraphDocument(exported)
  assert.deepEqual(reopened.extensions, legacy.extensions)
  assert.deepEqual(legacy.extensions['org.webappx.readonly'], { provenance: { note: 'Reviewed metadata' } })
})

test('reopen refuses tampered revisions, unreviewed formats and envelope fields', () => {
  const exported = exportGraphDocument(graph())
  assert.throws(() => reopenGraphDocument({ ...exported, revision: '0'.repeat(64) }), { code: 'GRAPH_EXPORT_REVISION_MISMATCH' })
  assert.throws(() => reopenGraphDocument({ ...exported, formatVersion: 2 }), { code: 'GRAPH_EXPORT_FORMAT' })
  assert.throws(() => reopenGraphDocument({ ...exported, sessionToken: 'private' }), { code: 'GRAPH_FIELD_UNSUPPORTED' })
  assert.equal(reopenGraphDocument(exported).documentId, 'DocA')
})

test('migration preview derives ordered children and applies only to a separate confirmed copy', () => {
  const legacy = legacyGraph()
  legacy.nodes = [legacy.nodes[0], legacy.nodes[2], legacy.nodes[1]]
  const before = JSON.stringify(legacy)
  const preview = previewGraphMigration(legacy)
  assert.equal(preview.fromVersion, 0)
  assert.equal(preview.toVersion, 1)
  assert.deepEqual(preview.steps.map(step => step.operation), [
    'page-list-conversion', 'child-order-derivation', 'schema-version-0-to-1', 'graph-validation',
  ])
  assert.deepEqual(preview.unsupportedFields, [])
  assert.equal(preview.digest.length, 64)
  assert.equal(preview.document.schemaVersion, 1)
  assert.deepEqual(preview.document.nodes.find(item => item.id === 'Root').childIds, ['Second', 'First'])
  const applied = applyGraphMigration(preview, { digest: preview.digest, confirmation: 'MIGRATE GRAPH COPY' })
  assert.equal(graphRevision(applied), graphRevision(preview.document))
  applied.nodes.find(item => item.id === 'Root').childIds.reverse()
  assert.deepEqual(preview.document.nodes.find(item => item.id === 'Root').childIds, ['Second', 'First'])
  assert.equal(JSON.stringify(legacy), before)
  assert.equal(previewGraphMigration(legacy).digest, preview.digest)
})

test('migration refuses missing confirmation, stale digest and modified preview', () => {
  const preview = previewGraphMigration(legacyGraph())
  assert.throws(() => applyGraphMigration(preview, { digest: preview.digest, confirmation: '' }), { code: 'GRAPH_MIGRATION_CONFIRMATION' })
  assert.throws(() => applyGraphMigration(preview, { digest: '0'.repeat(64), confirmation: 'MIGRATE GRAPH COPY' }), { code: 'GRAPH_MIGRATION_DIGEST' })
  const modified = clone(preview)
  modified.document.nodes.find(item => item.id === 'First').label = 'Unreviewed'
  assert.throws(() => applyGraphMigration(modified, { digest: preview.digest, confirmation: 'MIGRATE GRAPH COPY' }), { code: 'GRAPH_MIGRATION_DIGEST' })
  const extra = { ...preview, runtime: { pid: 1234 } }
  assert.throws(() => applyGraphMigration(extra, { digest: preview.digest, confirmation: 'MIGRATE GRAPH COPY' }), { code: 'GRAPH_FIELD_UNSUPPORTED' })
})

test('migration refuses unsupported versions and fields with bounded diagnostics', () => {
  const legacy = legacyGraph()
  assert.throws(() => previewGraphMigration(graph()), { code: 'GRAPH_MIGRATION_SOURCE' })
  assert.throws(() => previewGraphMigration({ ...legacy, schemaVersion: 2 }), { code: 'GRAPH_MIGRATION_SOURCE' })
  assert.throws(() => previewGraphMigration(legacy, { targetVersion: 2 }), { code: 'GRAPH_MIGRATION_TARGET' })
  assert.throws(() => previewGraphMigration(legacy, { targetVersion: null }), { code: 'GRAPH_MIGRATION_TARGET' })
  assert.throws(() => previewGraphMigration(legacy, { targetVersion: 1, autoAccept: true }), { code: 'GRAPH_MIGRATION_OPTIONS' })
  legacy.nodes[0].childIds = []
  assert.throws(() => previewGraphMigration(legacy), error => {
    assert.equal(error.code, 'GRAPH_LEGACY_FIELD_UNSUPPORTED')
    assert.ok(error.findings.some(finding => finding.message.includes('childIds')))
    return true
  })
})

test('migration rejects cycles and oversized or unsafe inputs before producing a copy', () => {
  const legacy = legacyGraph()
  legacy.nodes[0].parentId = 'First'
  assert.throws(() => previewGraphMigration(legacy))
  const oversized = legacyGraph()
  oversized.nodes[0].label = 'x'.repeat(400001)
  assert.throws(() => previewGraphMigration(oversized), { code: 'GRAPH_INPUT_LIMIT' })
  const unsafe = JSON.parse(JSON.stringify(legacyGraph()).replace('"schemaVersion":0', '"__proto__":{},"schemaVersion":0'))
  assert.throws(() => previewGraphMigration(unsafe), { code: 'GRAPH_INPUT_INVALID' })
  const circular = legacyGraph()
  circular.extensions['org.webappx.readonly'] = circular
  assert.throws(() => previewGraphMigration(circular), { code: 'GRAPH_INPUT_CYCLE' })
})

test('comparison reports surviving sibling reorders alongside additions and removals', () => {
  const before = graph()
  const after = clone(before)
  after.nodes[0].childIds = ['Second', 'Third', 'First']
  after.nodes.push(node('Third', 'Root'))
  const compared = compareGraphs(before, after)
  assert.deepEqual(compared.added, [{ kind: 'node', id: 'Third' }])
  assert.deepEqual(compared.changed, [{ kind: 'node', id: 'Root' }])
  assert.deepEqual(compared.reordered, [{ kind: 'node', id: 'Root' }])
  const restored = compareGraphs(after, before)
  assert.deepEqual(restored.removed, [{ kind: 'node', id: 'Third' }])
  assert.deepEqual(restored.reordered, [{ kind: 'node', id: 'Root' }])
  const inserted = clone(before)
  inserted.nodes[0].childIds = ['Third', 'First', 'Second']
  inserted.nodes.push(node('Third', 'Root'))
  assert.deepEqual(compareGraphs(before, inserted).reordered, [])
})

test('migration refuses proxy object behavior before invoking its traps', () => {
  let calls = 0
  const input = new Proxy(legacyGraph(), { ownKeys(target) { calls++; return Reflect.ownKeys(target) } })
  assert.throws(() => previewGraphMigration(input), { code: 'GRAPH_INPUT_INVALID' })
  assert.equal(calls, 0)
})
