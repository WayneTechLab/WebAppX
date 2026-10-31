import test from 'node:test'
import assert from 'node:assert/strict'
import { GraphError } from '../Builder/graph-core.mjs'
import { filterGraphFindings, graphStatistics, resolveGraphReference, validateGraph } from '../Builder/graph-validation.mjs'

const WORKSPACE = 'a'.repeat(64)
const SOURCE_REVISION = 'b'.repeat(64)
const SOURCE = { path: 'src/App.tsx', sourceRevision: SOURCE_REVISION, start: 0, end: 10,
  fingerprint: 'c'.repeat(64) }

function graph() {
  return {
    schemaVersion: 1, workspaceId: WORKSPACE, documentId: 'Doc', sourceRevision: SOURCE_REVISION,
    pages: [{ id: 'Home', rootId: 'Root', route: '/' }],
    nodes: [
      { id: 'Root', kind: 'element', parentId: null, childIds: ['Opaque', 'Source'], label: 'main',
        ownership: 'read-only', source: null, opaqueReason: null },
      { id: 'Opaque', kind: 'opaque', parentId: 'Root', childIds: [], label: 'external region',
        ownership: 'read-only', source: SOURCE, opaqueReason: 'unsupported JSX region' },
      { id: 'Source', kind: 'element', parentId: 'Root', childIds: [], label: 'span',
        ownership: 'source-owned', source: SOURCE, opaqueReason: null },
      { id: 'ComponentRoot', kind: 'element', parentId: null, childIds: [], label: 'component',
        ownership: 'read-only', source: null, opaqueReason: null },
    ],
    references: [
      { id: 'NodeRef', kind: 'node', documentId: 'Doc', targetId: 'Source', expectedVersion: null,
        expectedSchemaId: null, required: true },
      { id: 'ComponentRef', kind: 'component', documentId: 'Doc', targetId: 'Widget', expectedVersion: '1',
        expectedSchemaId: null, required: true },
      { id: 'CollectionRef', kind: 'collection', documentId: 'Doc', targetId: 'Items', expectedVersion: '1',
        expectedSchemaId: 'Item', required: true },
    ],
    components: [{ id: 'Widget', version: '1', rootId: 'ComponentRoot' }],
    collections: [{ id: 'Items', schemaId: 'Item', version: '1' }], extensions: {},
  }
}

function failure(input) {
  try { validateGraph(input) } catch (error) {
    assert.ok(error instanceof GraphError)
    return error
  }
  assert.fail('Expected graph validation to refuse the fixture')
}

function has(error, code) {
  assert.ok(error.findings.some(item => item.code === code),
    `Expected ${code}; received ${error.findings.map(item => item.code).join(', ')}`)
}

test('valid graph preserves source ownership, sibling order and revision statistics without mutating input', () => {
  const input = graph()
  const original = structuredClone(input)
  const result = validateGraph(input)
  assert.deepEqual(input, original)
  assert.notStrictEqual(result.graph, input)
  assert.deepEqual(result.graph.nodes.find(node => node.id === 'Root').childIds, ['Opaque', 'Source'])
  assert.deepEqual(result.graph.nodes.find(node => node.id === 'Source').source, SOURCE)
  assert.deepEqual(result.stats, { revision: result.revision, pages: 1, nodes: 4, components: 1,
    collections: 1, references: 3, unresolvedReferences: 0, opaqueNodes: 1 })
  assert.deepEqual(graphStatistics(result.graph), result.stats)
  assert.deepEqual(result.findings.map(item => [item.code, item.severity, item.objectId]),
    [['OPAQUE_IMPORTED_REGION', 'info', 'Opaque']])
  assert.equal(result.omittedCount, 0)
  const reordered = graph()
  reordered.nodes.reverse()
  reordered.references.reverse()
  assert.equal(validateGraph(reordered).revision, result.revision)
  reordered.nodes.find(node => node.id === 'Root').childIds.reverse()
  assert.notEqual(validateGraph(reordered).revision, result.revision)
})

test('missing/reused roots and unreachable nodes refuse a graph with object-linked findings', () => {
  const missing = graph()
  missing.pages[0].rootId = 'OtherRoot'
  const error = failure(missing)
  has(error, 'GRAPH_ROOT_MISSING')
  assert.ok(error.findings.some(item => item.objectId === 'Home' && item.referenceType === 'page'))
  has(error, 'NODE_UNREACHABLE')

  const reused = graph()
  reused.components[0].rootId = 'Root'
  has(failure(reused), 'GRAPH_ROOT_REUSED')
})

test('cycles, reparenting and duplicate sibling membership refuse without repairing an earlier graph', () => {
  const accepted = validateGraph(graph())
  const cycle = graph()
  cycle.nodes.find(node => node.id === 'Opaque').childIds = ['Root']
  cycle.nodes.find(node => node.id === 'Root').parentId = 'Opaque'
  const cycleError = failure(cycle)
  has(cycleError, 'NODE_ANCESTRY_CYCLE')
  const path = cycleError.findings.find(item => item.code === 'NODE_ANCESTRY_CYCLE').message
  assert.match(path, /Root|Opaque/)
  assert.ok(path.length <= 400)

  const reparented = graph()
  reparented.nodes.find(node => node.id === 'Opaque').parentId = 'ComponentRoot'
  has(failure(reparented), 'NODE_PARENT_CHILD_MISMATCH')

  const duplicated = graph()
  duplicated.nodes.find(node => node.id === 'Root').childIds.push('Source')
  has(failure(duplicated), 'NODE_CHILD_DUPLICATE')
  assert.equal(graphStatistics(accepted.graph).revision, accepted.revision)
  assert.deepEqual(accepted.graph.nodes.find(node => node.id === 'Root').childIds, ['Opaque', 'Source'])
})

test('depth limit is enforced on a literal 65-node ancestry', () => {
  const input = graph()
  input.pages = [{ id: 'Home', rootId: 'N0', route: '/' }]
  input.nodes = Array.from({ length: 65 }, (_, index) => ({
    id: `N${index}`, kind: 'element', parentId: index === 0 ? null : `N${index - 1}`,
    childIds: index === 64 ? [] : [`N${index + 1}`], label: 'item', ownership: 'read-only',
    source: null, opaqueReason: null,
  }))
  input.components = []
  input.references = []
  has(failure(input), 'NODE_DEPTH_LIMIT')
})

test('required incompatible references fail; optional component and collection dependencies remain explicit', () => {
  const required = graph()
  required.references.find(ref => ref.id === 'ComponentRef').expectedVersion = '2'
  required.references.find(ref => ref.id === 'CollectionRef').expectedSchemaId = 'Other'
  const error = failure(required)
  has(error, 'COMPONENT_REFERENCE_VERSION_MISMATCH')
  has(error, 'COLLECTION_REFERENCE_INCOMPATIBLE')
  const optional = graph()
  optional.references.find(ref => ref.id === 'ComponentRef').required = false
  optional.references.find(ref => ref.id === 'ComponentRef').targetId = 'ExternalWidget'
  optional.references.find(ref => ref.id === 'CollectionRef').required = false
  optional.references.find(ref => ref.id === 'CollectionRef').expectedVersion = '2'
  const checked = validateGraph(optional)
  assert.equal(checked.stats.unresolvedReferences, 2)
  assert.deepEqual(checked.findings.map(item => item.severity), ['warning', 'warning', 'info'])
  assert.ok(checked.findings.some(item => item.objectId === 'ComponentRef'
    && item.referenceType === 'component'))
  assert.ok(checked.findings.some(item => item.objectId === 'CollectionRef'
    && item.referenceType === 'collection'))

  const crossDocument = graph()
  crossDocument.references.find(ref => ref.id === 'NodeRef').documentId = 'OtherDoc'
  has(failure(crossDocument), 'REFERENCE_DOCUMENT_MISMATCH')

  const editableOpaque = graph()
  editableOpaque.nodes.find(node => node.id === 'Opaque').ownership = 'source-owned'
  has(failure(editableOpaque), 'OPAQUE_OWNERSHIP_INVALID')
})

test('qualified lookup returns one compatible copy and typed errors for wrong kind, scope and target', () => {
  const input = graph()
  const key = { workspaceId: WORKSPACE, documentId: 'Doc', id: 'Source', kind: 'node' }
  assert.equal(resolveGraphReference(input, key).id, 'Source')
  assert.equal(resolveGraphReference(input, { ...key, id: 'ComponentRef', kind: 'reference' }).kind, 'component')
  assert.throws(() => resolveGraphReference(input, { ...key, kind: 'page' }),
    error => error instanceof GraphError && error.code === 'GRAPH_LOOKUP_WRONG_KIND')
  assert.throws(() => resolveGraphReference(input, { ...key, id: 'Absent' }),
    error => error instanceof GraphError && error.code === 'GRAPH_LOOKUP_MISSING')
  assert.throws(() => resolveGraphReference(input, { ...key, workspaceId: 'f'.repeat(64) }),
    error => error instanceof GraphError && error.code === 'GRAPH_LOOKUP_DOCUMENT_MISMATCH')
  assert.throws(() => resolveGraphReference(input, { id: 'Source', kind: 'node' }),
    error => error instanceof GraphError && error.code === 'GRAPH_LOOKUP_INVALID')
})

test('findings are deterministic, bounded, filterable and reject coercion or unsafe shapes', () => {
  const input = graph()
  input.nodes.push(...Array.from({ length: 70 }, (_, index) => ({
    id: `Loose${index}`, kind: 'element', parentId: null, childIds: [], label: 'loose',
    ownership: 'read-only', source: null, opaqueReason: null,
  })))
  const first = failure(input)
  const second = failure(input)
  assert.equal(first.findings.length, 50)
  assert.ok(first.omittedCount >= 20)
  assert.deepEqual(first.findings, second.findings)
  const subset = filterGraphFindings(first.findings,
    { severity: 'error', referenceType: 'node', offset: 1, limit: 2 })
  assert.equal(subset.total, 50)
  assert.equal(subset.items.length, 2)
  assert.equal(subset.omittedCount, 48)
  const byObject = filterGraphFindings(first.findings, { objectId: subset.items[0].objectId })
  assert.equal(byObject.total, 1)
  assert.notStrictEqual(byObject.items[0], first.findings[1])
  assert.equal(filterGraphFindings(first.findings, { objectId: null }).total, 0)
  for (const filter of [{ offset: '1' }, { offset: null }, { limit: 0 }, { severity: 'fatal' },
    { referenceType: 'reference' }, { unknown: true }]) {
    assert.throws(() => filterGraphFindings(first.findings, filter), GraphError)
  }
  assert.throws(() => filterGraphFindings([{ ...first.findings[0], privateToken: 'secret' }]), GraphError)
})

test('lookup and finding filters refuse proxy behavior without invoking traps', () => {
  let calls = 0
  const guarded = target => new Proxy(target, { getPrototypeOf(value) { calls++; return Reflect.getPrototypeOf(value) } })
  assert.throws(() => resolveGraphReference(graph(), guarded({ workspaceId: WORKSPACE, documentId: 'Doc', id: 'Source', kind: 'node' })), GraphError)
  assert.throws(() => filterGraphFindings([], guarded({})), GraphError)
  assert.throws(() => filterGraphFindings(guarded([])), GraphError)
  assert.equal(calls, 0)
})
