import assert from 'node:assert/strict'
import { test } from 'node:test'
import { graphRevision, normalizeGraph, serializeGraph } from '../Builder/graph-core.mjs'
import { filterGraphFindings, graphStatistics, resolveGraphReference, validateGraph } from '../Builder/graph-validation.mjs'
import {
  applyGraphMigration, compareGraphs, exportGraphDocument, previewGraphMigration, reopenGraphDocument,
} from '../Builder/graph-evolution.mjs'
import { createGraphService } from '../Builder/graph-service.mjs'
import { dispatchGraphContract } from '../Builder/graph-http.mjs'
import { discoveryForClient, getContractRegistry, getOperationDescriptor } from '../Builder/api-contracts.mjs'
import { compareApiContracts, contractExamples, exportPublicContracts } from '../Builder/api-tools.mjs'

// These literals deliberately do not use the identity adapter or a graph builder. They
// are an independent check of the public graph shape and the read-only API boundary.
const workspaceId = 'a'.repeat(64)
const otherWorkspaceId = 'f'.repeat(64)
const sourceRevision = 'b'.repeat(64)
const fingerprint = 'c'.repeat(64)
const source = (start, end) => ({ path: 'src/pages/Home.tsx', sourceRevision, start, end, fingerprint })
const node = (id, parentId, childIds, extra = {}) => ({
  id, kind: 'element', parentId, childIds, label: id, ownership: 'source-owned',
  source: source(0, 8), opaqueReason: null, ...extra,
})

function literalGraph() {
  return {
    schemaVersion: 1, workspaceId, documentId: 'HomeDoc', sourceRevision,
    pages: [{ id: 'HomePage', rootId: 'Root', route: '/' }],
    // Collection insertion order differs from explicit sibling order on purpose.
    nodes: [
      node('First', 'Root', []),
      node('Root', null, ['Second', 'First', 'Opaque', 'CardUse']),
      node('CardRoot', null, [], { ownership: 'read-only', source: null }),
      node('Opaque', 'Root', [], {
        kind: 'opaque', label: 'Unsupported source region', ownership: 'read-only',
        source: source(8, 24), opaqueReason: 'Imported expression is not modeled',
      }),
      node('CardUse', 'Root', [], { kind: 'component-instance', ownership: 'read-only' }),
      node('Second', 'Root', []),
    ],
    references: [
      { id: 'CollectionRef', kind: 'collection', documentId: 'HomeDoc', targetId: 'Articles',
        expectedVersion: '2', expectedSchemaId: 'article-v2', required: true },
      { id: 'NodeRef', kind: 'node', documentId: 'HomeDoc', targetId: 'First',
        expectedVersion: null, expectedSchemaId: null, required: true },
      { id: 'ComponentRef', kind: 'component', documentId: 'HomeDoc', targetId: 'Card',
        expectedVersion: '1.0.0', expectedSchemaId: null, required: true },
    ],
    components: [{ id: 'Card', version: '1.0.0', rootId: 'CardRoot' }],
    collections: [{ id: 'Articles', schemaId: 'article-v2', version: '2' }],
    extensions: { 'org.webappx.readonly': { futureNote: 'retained for review', flags: [true, false] } },
  }
}

function legacyGraph() {
  const graph = {
    schemaVersion: 0, workspaceId, documentId: 'LegacyDoc', sourceRevision,
    page: { id: 'LegacyPage', rootId: 'LegacyRoot', route: '/legacy' },
    nodes: [
      node('LegacyRoot', null, []),
      node('Later', 'LegacyRoot', []),
      node('Earlier', 'LegacyRoot', []),
    ],
    references: [], components: [], collections: [], extensions: {},
  }
  for (const item of graph.nodes) delete item.childIds
  return graph
}

const command = (operation, payload, { version = '1.1', requestId = 'Cmd1', confirmation = '', expectedRevision = null } = {}) => ({
  apiVersion: version, requestId, kind: 'command', operation,
  capabilityId: getOperationDescriptor(operation, version).capabilityId,
  payload: { type: operation, ...payload }, confirmation, expectedRevision,
})
const query = (operation, payload = {}, { version = '1.1', requestId = 'Query1' } = {}) => ({
  apiVersion: version, requestId, kind: 'query', operation, payload: { type: operation, ...payload },
})
const dispatch = (service, body) => dispatchGraphContract({
  service, method: 'POST', url: `/api/contracts/${body.kind}`, body,
})
const successful = response => {
  assert.equal(response.statusCode, 200, JSON.stringify(response.result))
  assert.equal(response.result.ok, true)
  return response.result.result
}

test('literal graph preserves explicit ordering, opaque provenance, versioned references and read-only extensions', () => {
  const input = literalGraph()
  const before = structuredClone(input)
  const { graph, revision, findings, stats } = validateGraph(input)
  assert.deepEqual(input, before)
  assert.equal(graph.schemaVersion, 1)
  assert.deepEqual(graph.nodes.find(item => item.id === 'Root').childIds, ['Second', 'First', 'Opaque', 'CardUse'])
  assert.deepEqual(graph.nodes.find(item => item.id === 'Opaque').source, source(8, 24))
  assert.equal(graph.nodes.find(item => item.id === 'Opaque').ownership, 'read-only')
  assert.deepEqual(graph.extensions['org.webappx.readonly'], input.extensions['org.webappx.readonly'])
  assert.equal(findings.filter(item => item.severity === 'error').length, 0)
  assert.match(revision, /^[a-f0-9]{64}$/)
  assert.equal(stats.revision, revision)
  assert.equal(stats.pages, 1)
  assert.equal(stats.nodes, 6)
  assert.equal(stats.components, 1)
  assert.equal(stats.collections, 1)
  assert.equal(stats.references, 3)
  assert.equal(stats.opaqueNodes, 1)
  assert.equal(stats.unresolvedReferences, 0)
  assert.deepEqual(graphStatistics(graph), stats)
  assert.equal(resolveGraphReference(graph, { workspaceId, documentId: 'HomeDoc', id: 'Articles', kind: 'collection' }).id, 'Articles')
})

test('unresolved optional references remain visible through typed finding filters', () => {
  const candidate = literalGraph()
  const component = candidate.references.find(item => item.id === 'ComponentRef')
  component.expectedVersion = '9.0.0'
  component.required = false
  const { findings, stats } = validateGraph(candidate)
  assert.equal(stats.unresolvedReferences, 1)
  const selected = filterGraphFindings(findings, {
    severity: 'warning', objectId: 'ComponentRef', referenceType: 'component', offset: 0, limit: 20,
  })
  assert.equal(selected.total, 1)
  assert.equal(selected.items[0].objectId, 'ComponentRef')
  assert.equal(selected.items[0].referenceType, 'component')
  assert.equal(typeof selected.items[0].id, 'string')
  assert.ok(selected.items[0].id.length > 0)
  assert.equal(validateGraph(candidate).findings.find(item => item.objectId === 'ComponentRef').id, selected.items[0].id)
  assert.deepEqual(filterGraphFindings(findings, { severity: 'error', offset: 0, limit: 20 }).items, [])
})

test('canonical bytes ignore object and collection insertion order, but preserve sibling order and meaningful fields', () => {
  const first = literalGraph()
  const reorderedInput = structuredClone(first)
  reorderedInput.nodes.reverse()
  reorderedInput.references.reverse()
  reorderedInput.pages = reorderedInput.pages.map(({ route, rootId, id }) => ({ route, rootId, id }))
  assert.equal(serializeGraph(first), serializeGraph(reorderedInput))
  assert.equal(graphRevision(first), graphRevision(reorderedInput))
  assert.equal(serializeGraph(first), serializeGraph(first))
  assert.deepEqual(normalizeGraph(first), normalizeGraph(reorderedInput))
  const siblingChange = structuredClone(first)
  siblingChange.nodes.find(item => item.id === 'Root').childIds.reverse()
  assert.notEqual(graphRevision(siblingChange), graphRevision(first))
  const labelChange = structuredClone(first)
  labelChange.nodes.find(item => item.id === 'First').label = 'Changed label'
  assert.notEqual(graphRevision(labelChange), graphRevision(first))
  for (const forbidden of ['createdAt', 'processId', 'sessionToken']) assert.equal(serializeGraph(first).includes(forbidden), false)
})

test('export and reopen round trip repeatedly without changing bytes, source references or child order', () => {
  const graph = literalGraph()
  const original = structuredClone(graph)
  const first = exportGraphDocument(graph)
  assert.equal(first.format, 'webappx-graph')
  assert.equal(first.formatVersion, 1)
  assert.equal(first.revision, graphRevision(graph))
  const reopened = reopenGraphDocument(first)
  const second = exportGraphDocument(reopened)
  assert.deepEqual(second, first)
  assert.equal(serializeGraph(reopened), serializeGraph(graph))
  assert.deepEqual(reopened.nodes.find(item => item.id === 'Root').childIds, ['Second', 'First', 'Opaque', 'CardUse'])
  assert.deepEqual(graph, original)
})

test('comparison classifies additions, changes and sibling reorder without mutating either graph', () => {
  const before = literalGraph()
  const after = structuredClone(before)
  after.nodes.find(item => item.id === 'Root').childIds = ['First', 'Second', 'Opaque', 'CardUse', 'Added']
  after.nodes.find(item => item.id === 'Second').label = 'Edited label'
  after.nodes.push(node('Added', 'Root', []))
  const savedBefore = structuredClone(before)
  const savedAfter = structuredClone(after)
  const difference = compareGraphs(before, after)
  assert.equal(difference.beforeRevision, graphRevision(before))
  assert.equal(difference.afterRevision, graphRevision(after))
  assert.ok(difference.added.some(item => item.kind === 'node' && item.id === 'Added'))
  assert.ok(difference.changed.some(item => item.kind === 'node' && item.id === 'Second'))
  assert.ok(difference.reordered.some(item => item.kind === 'node' && item.id === 'Root'))
  assert.deepEqual(before, savedBefore)
  assert.deepEqual(after, savedAfter)
})

test('legacy 0 to 1 migration is reviewed, ordered and isolated from its source', () => {
  const legacy = legacyGraph()
  const before = structuredClone(legacy)
  const preview = previewGraphMigration(legacy, { targetVersion: 1 })
  assert.equal(preview.fromVersion, 0)
  assert.equal(preview.toVersion, 1)
  assert.match(preview.digest, /^[a-f0-9]{64}$/)
  assert.ok(preview.steps.length >= 4)
  assert.deepEqual(preview.unsupportedFields, [])
  const migrated = applyGraphMigration(preview, { digest: preview.digest, confirmation: 'MIGRATE GRAPH COPY' })
  assert.equal(migrated.schemaVersion, 1)
  assert.equal(migrated.pages[0].id, 'LegacyPage')
  assert.deepEqual(migrated.nodes.find(item => item.id === 'LegacyRoot').childIds, ['Later', 'Earlier'])
  assert.deepEqual(migrated.nodes.find(item => item.id === 'Later').source, legacy.nodes[1].source)
  assert.equal(validateGraph(migrated).revision, graphRevision(migrated))
  assert.deepEqual(legacy, before)
})

test('service accepts explicit previews, retains revision history and reopens an exported graph', async () => {
  const service = createGraphService({ workspaceId })
  const sourceGraph = literalGraph()
  const preview = await service.preview({ document: sourceGraph })
  assert.equal(preview.revision, graphRevision(sourceGraph))
  assert.equal((await service.status()).documents.length, 0)
  const accepted = await service.accept({ digest: preview.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  assert.equal(accepted.revision, preview.revision)
  const firstRead = await service.read({ documentId: 'HomeDoc' })
  assert.equal(firstRead.revision, accepted.revision)
  assert.equal(firstRead.stats.opaqueNodes, 1)
  const exportResult = await service.export({ documentId: 'HomeDoc' })
  assert.equal(exportResult.revision, accepted.revision)
  const reopened = await service.reopen({ document: exportResult, expectedRevision: accepted.revision, confirmation: 'REOPEN GRAPH' })
  assert.equal(reopened.revision, accepted.revision)
  assert.equal((await service.read({ documentId: 'HomeDoc' })).revision, accepted.revision)
  assert.deepEqual(sourceGraph, literalGraph())
})

test('repeated import, filtered findings and accepted-history comparison use the selected revision', async () => {
  const service = createGraphService({ workspaceId })
  const initial = literalGraph()
  const first = await service.preview({ document: initial })
  const accepted = await service.accept({ digest: first.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  const repeated = await service.preview({ document: structuredClone(initial) })
  assert.equal(repeated.revision, accepted.revision)
  await service.accept({ digest: repeated.digest, expectedRevision: accepted.revision, confirmation: 'ACCEPT GRAPH' })
  assert.equal((await service.read({ documentId: 'HomeDoc' })).revision, accepted.revision)
  const filtered = await service.findings({ documentId: 'HomeDoc', severity: 'warning', offset: 0, limit: 20 })
  assert.deepEqual(filtered.items, [])
  assert.equal(filtered.total, 0)
  const changed = structuredClone(initial)
  changed.nodes.find(item => item.id === 'First').label = 'Edited label'
  const next = await service.preview({ document: changed })
  const second = await service.accept({ digest: next.digest, expectedRevision: accepted.revision, confirmation: 'ACCEPT GRAPH' })
  const comparison = await service.compare({ documentId: 'HomeDoc', beforeRevision: accepted.revision,
    afterRevision: second.revision })
  assert.ok(comparison.changed.some(item => item.kind === 'node' && item.id === 'First'))
  assert.equal((await service.read({ documentId: 'HomeDoc', revision: accepted.revision })).revision, accepted.revision)
  assert.equal((await service.status()).documents[0].revision, second.revision)
})

test('service migration apply returns an isolated copy that requires normal preview and acceptance', async () => {
  const service = createGraphService({ workspaceId })
  const legacy = legacyGraph()
  const before = structuredClone(legacy)
  const preview = await service.migrationPreview({ document: legacy, targetVersion: 1 })
  const applied = await service.migrationApply({ digest: preview.digest, confirmation: 'MIGRATE GRAPH COPY' })
  assert.equal(applied.isolatedCopy, true)
  assert.equal(applied.document.schemaVersion, 1)
  assert.equal(applied.revision, graphRevision(applied.document))
  assert.deepEqual((await service.status()).documents, [])
  const normalPreview = await service.preview({ document: applied.document })
  const accepted = await service.accept({ digest: normalPreview.digest, expectedRevision: null,
    confirmation: 'ACCEPT GRAPH' })
  assert.equal(accepted.revision, applied.revision)
  assert.deepEqual(legacy, before)
})

test('supported 1.0 executes through its own descriptors; 1.1 executes a newer query', async () => {
  const service = createGraphService({ workspaceId })
  const old = getContractRegistry('1.0')
  const current = getContractRegistry('1.1')
  assert.match(old.schemaRevision, /^[a-f0-9]{64}$/)
  assert.match(current.schemaRevision, /^[a-f0-9]{64}$/)
  assert.equal(getContractRegistry('1.0').schemaRevision, old.schemaRevision)
  assert.equal(getOperationDescriptor('graph.findings', '1.0'), null)
  assert.ok(getOperationDescriptor('graph.findings', '1.1'))
  assert.ok(JSON.stringify(discoveryForClient('1.0')).includes('graph.findings'))

  const discovered = await dispatchGraphContract({ service, method: 'GET',
    url: '/api/contracts/discovery?clientVersion=1.0' })
  assert.equal(discovered.statusCode, 200, JSON.stringify(discovered.result))
  assert.equal(discovered.result.ok, true)
  assert.ok(JSON.stringify(discovered.result.result).includes('1.0'))

  const oldStatus = successful(await dispatch(service, query('graph.status', {}, { version: '1.0', requestId: 'OldStatus' })))
  assert.equal(oldStatus.workspaceId, workspaceId)
  const oldList = successful(await dispatch(service, query('contracts.list', {}, { version: '1.0', requestId: 'OldList' })))
  assert.ok(JSON.stringify(oldList).includes('graph.status'))
  const preview = successful(await dispatch(service, command('graph.preview', { document: literalGraph() }, {
    version: '1.0', requestId: 'OldPreview', expectedRevision: null,
  })))
  assert.equal(preview.documentId, 'HomeDoc')
  const accepted = successful(await dispatch(service, command('graph.accept', { digest: preview.digest }, {
    version: '1.0', requestId: 'OldAccept', confirmation: 'ACCEPT GRAPH', expectedRevision: null,
  })))
  assert.equal(accepted.revision, preview.revision)
  const oldRead = successful(await dispatch(service, query('graph.document', { documentId: 'HomeDoc' }, {
    version: '1.0', requestId: 'OldRead',
  })))
  assert.equal(oldRead.revision, accepted.revision)
  const lookup = successful(await dispatch(service, query('graph.lookup', {
    workspaceId, documentId: 'HomeDoc', id: 'Root', kind: 'node',
  }, { requestId: 'CurrentLookup' })))
  assert.equal(lookup.id, 'Root')
  const findings = successful(await dispatch(service, query('graph.findings', {
    documentId: 'HomeDoc', severity: 'warning', offset: 0, limit: 20,
  }, { requestId: 'CurrentFindings' })))
  assert.equal(findings.total, 0)
})

test('public contracts expose reviewed additions, examples and a stable schema revision without runtime data', () => {
  const comparison = compareApiContracts('1.0', '1.1')
  assert.ok(JSON.stringify(comparison).includes('graph.findings'))
  const examples = contractExamples({ operation: 'graph.status', version: '1.1' })
  const exampleBytes = JSON.stringify(examples)
  assert.ok(exampleBytes.includes('graph.status'))
  assert.ok(exampleBytes.includes('valid'))
  assert.ok(exampleBytes.includes('invalid'))
  const exported = exportPublicContracts('1.1')
  const bytes = JSON.stringify(exported)
  assert.ok(bytes.includes(getContractRegistry('1.1').schemaRevision))
  assert.ok(bytes.includes('lan.graph.'))
  for (const privateField of ['sessionToken', 'processId', 'providerConfig', otherWorkspaceId]) {
    assert.equal(bytes.includes(privateField), false)
  }
})
