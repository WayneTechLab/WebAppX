import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createIdentityMap } from '../Builder/identity-core.mjs'
import { graphFromIdentity } from '../Builder/graph-identity-adapter.mjs'
import { createGraphService } from '../Builder/graph-service.mjs'
import { dispatchGraphContract } from '../Builder/graph-http.mjs'
import { getOperationDescriptor } from '../Builder/api-contracts.mjs'

const WORKSPACE = 'a'.repeat(64)
const OTHER_WORKSPACE = 'b'.repeat(64)
const SOURCE = 'c'.repeat(64)
const FINGERPRINT = 'd'.repeat(64)
const hash = value => createHash('sha256').update(value).digest('hex')

function graph(label = 'Page', workspaceId = WORKSPACE) {
  return { schemaVersion: 1, workspaceId, documentId: 'Document', sourceRevision: SOURCE,
    pages: [{ id: 'Page', rootId: 'Root', route: '/' }],
    nodes: [{ id: 'Root', kind: 'document-root', parentId: null, childIds: ['Child'], label,
      ownership: 'read-only', source: null, opaqueReason: null },
    { id: 'Child', kind: 'element', parentId: 'Root', childIds: [], label: 'div',
      ownership: 'source-owned', source: { path: 'src/pages/HomePage.tsx', sourceRevision: SOURCE,
        start: 0, end: 5, fingerprint: FINGERPRINT }, opaqueReason: null }],
    references: [], components: [], collections: [], extensions: {} }
}

function identityRecord() {
  const source = (start, end) => ({ path: 'src/pages/HomePage.tsx', sourceRevision: SOURCE,
    start, end, fingerprint: FINGERPRINT })
  const map = createIdentityMap({ workspaceId: WORKSPACE, sourcePath: 'src/pages/HomePage.tsx',
    sourceRevision: SOURCE, route: '/home', nodes: [
      { key: 'first', parentKey: null, tag: 'main', anchor: 'main', signature: hash('main'),
        label: 'Private authored headline', source: source(0, 20), fields: {}, opaque: false, external: false },
      { key: 'external', parentKey: 'first', tag: 'Widget', anchor: 'widget', signature: hash('widget'),
        label: 'Private component body', source: source(5, 15), fields: {}, opaque: true, external: true,
        definition: { name: 'Widget' } },
      { key: 'second', parentKey: null, tag: 'aside', anchor: 'aside', signature: hash('aside'),
        label: 'Second authored root', source: source(21, 30), fields: {}, opaque: false, external: false },
    ] })
  return { map, stale: false, currentRevision: SOURCE }
}

test('identity adaptation keeps source spans and every ordered root, without authored labels', () => {
  const record = identityRecord()
  const adapted = graphFromIdentity(record)
  const wrapper = adapted.nodes.find(node => node.kind === 'document-root')
  assert.deepEqual(wrapper.childIds, [record.map.nodes[0].id, record.map.nodes[2].id])
  assert.equal(adapted.nodes.find(node => node.id === record.map.nodes[1].id).parentId, record.map.nodes[0].id)
  for (const identityNode of record.map.nodes) {
    assert.deepEqual(adapted.nodes.find(node => node.id === identityNode.id).source, identityNode.source)
  }
  assert.equal(adapted.references[0].required, false)
  assert.ok(!JSON.stringify(adapted).includes('Private authored'))
  assert.ok(!JSON.stringify(adapted).includes('component body'))
  const accessor = {}
  Object.defineProperty(accessor, 'map', { get() { throw new Error('getter executed') } })
  assert.throws(() => graphFromIdentity(accessor), { code: 'GRAPH_IDENTITY_INVALID' })
})

test('accepted history survives invalid reimport and stale or superseded acceptance', async () => {
  const service = createGraphService({ workspaceId: WORKSPACE })
  const first = await service.preview({ document: graph() })
  assert.equal(service.status().documents.length, 0)
  assert.throws(() => service.accept({ digest: first.digest, expectedRevision: null, confirmation: 'yes' }),
    { code: 'GRAPH_CONFIRMATION_REQUIRED' })
  const accepted = service.accept({ digest: first.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  assert.equal(accepted.revision, first.revision)
  const second = await service.preview({ document: graph('Changed') })
  const superseding = await service.preview({ document: graph('Changed again') })
  assert.throws(() => service.accept({ digest: second.digest, expectedRevision: first.revision,
    confirmation: 'ACCEPT GRAPH' }), { code: 'GRAPH_PROPOSAL_MISSING' })
  assert.throws(() => service.accept({ digest: superseding.digest, expectedRevision: null,
    confirmation: 'ACCEPT GRAPH' }), { code: 'GRAPH_REVISION_CONFLICT' })
  const next = service.accept({ digest: superseding.digest, expectedRevision: first.revision,
    confirmation: 'ACCEPT GRAPH' })
  assert.deepEqual(service.read({ documentId: 'Document', revision: first.revision }).document, graph())
  assert.equal(service.compare({ documentId: 'Document', beforeRevision: first.revision,
    afterRevision: next.revision }).changed.some(item => item.id === 'Root'), true)

  const invalid = graph('Broken')
  invalid.nodes[1].parentId = 'Missing'
  await assert.rejects(service.preview({ document: invalid }), { code: /./ })
  assert.equal(service.read({ documentId: 'Document' }).revision, next.revision)
  assert.equal(service.status().documents[0].stats.revision, next.revision)
})

test('identity read is workspace scoped, and stale source leaves the accepted graph', async () => {
  const record = identityRecord()
  let current = record
  const service = createGraphService({ workspaceId: WORKSPACE,
    readIdentityStatus: () => ({ workspaceId: WORKSPACE, documents: [{ documentId: record.map.documentId }] }),
    readIdentityDocument: () => current })
  const proposal = await service.preview({ identityDocumentId: record.map.documentId })
  service.accept({ digest: proposal.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  current = { ...record, stale: true, currentRevision: 'e'.repeat(64) }
  await assert.rejects(service.preview({ identityDocumentId: record.map.documentId }), error => {
    assert.equal(error.code, 'GRAPH_IDENTITY_STALE')
    assert.ok(error.findings.some(item => item.message.includes('e'.repeat(64))))
    return true
  })
  assert.equal(service.status().documents.length, 1)
  await assert.rejects(service.preview({ document: graph('Wrong', OTHER_WORKSPACE) }),
    { code: 'GRAPH_WORKSPACE_MISMATCH' })
})

test('graph export reopens only into the same workspace with an exact revision guard', async () => {
  const service = createGraphService({ workspaceId: WORKSPACE })
  const preview = await service.preview({ document: graph() })
  service.accept({ digest: preview.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  const exported = service.export({ documentId: 'Document' })
  assert.equal(exported.format, 'webappx-graph')
  assert.deepEqual(service.reopen({ document: exported, expectedRevision: preview.revision,
    confirmation: 'REOPEN GRAPH' }).document.nodes[0].childIds, ['Child'])
  assert.throws(() => createGraphService({ workspaceId: OTHER_WORKSPACE }).reopen({ document: exported,
    expectedRevision: null, confirmation: 'REOPEN GRAPH' }), { code: 'GRAPH_WORKSPACE_MISMATCH' })
  assert.throws(() => service.read({ documentId: 'Document', revision: null }), { code: 'GRAPH_REVISION_INVALID' })
})

test('migration stays isolated until a separate graph preview and acceptance', async () => {
  const service = createGraphService({ workspaceId: WORKSPACE })
  const legacy = graph()
  legacy.schemaVersion = 0
  legacy.page = legacy.pages[0]
  delete legacy.pages
  for (const node of legacy.nodes) delete node.childIds
  const inputBytes = JSON.stringify(legacy)
  const first = service.migrationPreview({ document: legacy, targetVersion: 1 })
  const second = service.migrationPreview({ document: legacy, targetVersion: 1 })
  assert.notEqual(first.digest, second.digest)
  assert.throws(() => service.migrationApply({ digest: first.digest,
    confirmation: 'MIGRATE GRAPH COPY' }), { code: 'GRAPH_PROPOSAL_MISSING' })
  assert.throws(() => service.migrationApply({ digest: second.digest,
    confirmation: 'yes' }), { code: /./ })
  const isolated = service.migrationApply({ digest: second.digest, confirmation: 'MIGRATE GRAPH COPY' })
  assert.equal(isolated.isolatedCopy, true)
  assert.equal(service.status().documents.length, 0)
  assert.equal(JSON.stringify(legacy), inputBytes)
  const proposal = await service.preview({ document: isolated.document })
  service.accept({ digest: proposal.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  assert.equal(service.status().documents.length, 1)
})

test('accepted history retains only the latest ten distinct revisions', async () => {
  const service = createGraphService({ workspaceId: WORKSPACE })
  const revisions = []
  for (let index = 0; index < 11; index += 1) {
    const proposal = await service.preview({ document: graph(`Version ${index}`) })
    service.accept({ digest: proposal.digest, expectedRevision: revisions.at(-1) ?? null,
      confirmation: 'ACCEPT GRAPH' })
    revisions.push(proposal.revision)
  }
  assert.equal(service.read({ documentId: 'Document' }).revision, revisions[10])
  assert.throws(() => service.read({ documentId: 'Document', revision: revisions[0] }),
    { code: 'GRAPH_REVISION_MISSING' })
  assert.equal(service.read({ documentId: 'Document', revision: revisions[1] }).revision, revisions[1])
})

test('HTTP dispatch validates envelopes and result shapes before exposing success', async () => {
  const service = createGraphService({ workspaceId: WORKSPACE })
  const url = new URL('http://localhost/api/contracts/query')
  const body = { apiVersion: '1.1', requestId: 'request_1', kind: 'query', operation: 'graph.status',
    payload: { type: 'graph.status' } }
  const valid = await dispatchGraphContract({ service, method: 'POST', url, body })
  assert.equal(valid.statusCode, 200)
  assert.equal(valid.result.ok, true)
  assert.equal(valid.result.result.workspaceId, WORKSPACE)
  const older = await dispatchGraphContract({ service, method: 'POST', url,
    body: { ...body, apiVersion: '1.0', requestId: 'request_old' } })
  assert.equal(older.result.ok, true)
  assert.equal(older.result.apiVersion, '1.0')
  const future = await dispatchGraphContract({ service, method: 'POST', url,
    body: { ...body, apiVersion: '2.0', requestId: 'request_future' } })
  assert.equal(future.result.ok, false)
  assert.equal(future.result.error.category, 'incompatible-version')
  const malformed = await dispatchGraphContract({ service, method: 'POST', url, body,
    handlerOverrides: { 'graph.status': () => ({ invented: true }) } })
  assert.equal(malformed.result.ok, false)
  assert.equal(malformed.result.error.code, 'RESPONSE_CONTRACT_INVALID')
  const invalid = await dispatchGraphContract({ service, method: 'POST', url, body: { ...body,
    payload: { type: 'graph.status', mutate: true } } })
  assert.equal(invalid.result.ok, false)
  assert.equal(service.status().documents.length, 0)

  const descriptor = getOperationDescriptor('graph.preview', '1.1')
  const command = await dispatchGraphContract({ service, method: 'POST',
    url: new URL('http://localhost/api/contracts/command'), body: {
      apiVersion: '1.1', requestId: 'request_2', kind: 'command', operation: 'graph.preview',
      capabilityId: descriptor.capabilityId, payload: { type: 'graph.preview', document: graph() },
      confirmation: '', expectedRevision: null,
    } })
  assert.equal(command.result.ok, true)
  assert.equal(service.status().documents.length, 0)
})
