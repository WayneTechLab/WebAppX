import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { after, test } from 'node:test'
import { createGraphService } from '../Builder/graph-service.mjs'
import { dispatchGraphContract } from '../Builder/graph-http.mjs'
import { getContractRegistry } from '../Builder/api-contracts.mjs'
import { validateApiRequest } from '../Builder/api-validation.mjs'

// Literal expectations are independent of registry enumeration. Only successful
// real dispatcher responses add an operation to the executed set below.
const EXPECTED_OPERATIONS = Object.freeze({
  '1.0': [
    'graph.status', 'graph.document', 'graph.preview', 'graph.accept', 'graph.export',
    'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.export',
  ],
  '1.1': [
    'graph.status', 'graph.document', 'graph.findings', 'graph.lookup', 'graph.compare', 'graph.export',
    'graph.preview', 'graph.accept', 'graph.reopen', 'graph.migrationPreview', 'graph.migrationApply',
    'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.compatibility', 'contracts.export',
  ],
})
const COMMANDS = new Set(['graph.preview', 'graph.accept', 'graph.reopen', 'graph.migrationPreview', 'graph.migrationApply'])
const PHRASES = Object.freeze({
  'graph.accept': 'ACCEPT GRAPH', 'graph.reopen': 'REOPEN GRAPH', 'graph.migrationApply': 'MIGRATE GRAPH COPY',
})
const WORKSPACE = '4f'.repeat(32)
const SOURCE_REVISION = '6a'.repeat(32)
const FINGERPRINT = '8c'.repeat(32)
const GRAPH_CANARY = 'graph-fixture-only-canary'
const HASH = /^[a-f0-9]{64}$/
const copy = value => JSON.parse(JSON.stringify(value))
const sha256 = value => createHash('sha256').update(value).digest('hex')
const inputFiles = [
  '../Builder/graph-core.mjs', '../Builder/graph-validation.mjs', '../Builder/graph-evolution.mjs',
  '../Builder/graph-identity-adapter.mjs', '../Builder/graph-service.mjs', '../Builder/graph-http.mjs',
  '../Builder/api-contracts.mjs', '../Builder/api-validation.mjs', '../Builder/api-tools.mjs',
  './graph-api-dispatch.test.mjs',
]
const inputHashes = () => Object.fromEntries(inputFiles.map(path => [path, sha256(readFileSync(new URL(path, import.meta.url)))]))
const beforeHashes = inputHashes()
const observed = new Map(Object.keys(EXPECTED_OPERATIONS).map(version => [version, {
  schemaRevision: getContractRegistry(version).schemaRevision,
  executed: new Set(), successes: [], refusals: [],
}]))

function literalGraph() {
  const source = { path: 'src/pages/DispatchFixture.tsx', sourceRevision: SOURCE_REVISION,
    start: 0, end: 8, fingerprint: FINGERPRINT }
  const element = (id, parentId, childIds) => ({ id, kind: 'element', parentId, childIds,
    label: id, ownership: 'source-owned', source: { ...source }, opaqueReason: null })
  return {
    schemaVersion: 1, workspaceId: WORKSPACE, documentId: 'DispatchDoc', sourceRevision: SOURCE_REVISION,
    pages: [{ id: 'DispatchPage', rootId: 'Root', route: '/dispatch' }],
    nodes: [
      element('First', 'Root', []),
      { id: 'Opaque', kind: 'opaque', parentId: 'Root', childIds: [], label: 'Opaque',
        ownership: 'read-only', source: { ...source }, opaqueReason: 'Unsupported imported region.' },
      element('Second', 'Root', []),
      element('Root', null, ['Second', 'First', 'Opaque']),
      { id: 'CardRoot', kind: 'element', parentId: null, childIds: [], label: 'Card',
        ownership: 'read-only', source: null, opaqueReason: null },
    ],
    references: [
      { id: 'FirstRef', kind: 'node', documentId: 'DispatchDoc', targetId: 'First',
        expectedVersion: null, expectedSchemaId: null, required: true },
      { id: 'CardRef', kind: 'component', documentId: 'DispatchDoc', targetId: 'Card',
        expectedVersion: '1.0.0', expectedSchemaId: null, required: true },
      { id: 'ArticlesRef', kind: 'collection', documentId: 'DispatchDoc', targetId: 'Articles',
        expectedVersion: '1', expectedSchemaId: 'article-v1', required: true },
    ],
    components: [{ id: 'Card', version: '1.0.0', rootId: 'CardRoot' }],
    collections: [{ id: 'Articles', schemaId: 'article-v1', version: '1' }],
    extensions: { 'org.webappx.readonly': { note: GRAPH_CANARY } },
  }
}

function literalLegacy() {
  const source = { path: 'src/pages/LegacyFixture.tsx', sourceRevision: SOURCE_REVISION,
    start: 0, end: 8, fingerprint: FINGERPRINT }
  return {
    schemaVersion: 0, workspaceId: WORKSPACE, documentId: 'DispatchLegacy', sourceRevision: SOURCE_REVISION,
    page: { id: 'LegacyPage', rootId: 'LegacyRoot', route: '/legacy' },
    nodes: [
      { id: 'LegacyRoot', kind: 'element', parentId: null, label: 'main', ownership: 'source-owned', source: { ...source }, opaqueReason: null },
      { id: 'Later', kind: 'element', parentId: 'LegacyRoot', label: 'p', ownership: 'source-owned', source: { ...source }, opaqueReason: null },
      { id: 'Earlier', kind: 'element', parentId: 'LegacyRoot', label: 'span', ownership: 'source-owned', source: { ...source }, opaqueReason: null },
    ],
    references: [], components: [], collections: [], extensions: {},
  }
}

function envelope(version, operation, payload = {}, overrides = {}) {
  const kind = COMMANDS.has(operation) || operation === 'graph.sourceWrite' || operation === 'graph.editStructure' ? 'command' : 'query'
  const result = {
    apiVersion: version, requestId: 'DispatchRequest', kind, operation,
    payload: { type: operation, ...payload },
  }
  if (kind === 'command') Object.assign(result, {
    capabilityId: `lan.${operation}@1`, confirmation: PHRASES[operation] ?? '', expectedRevision: null,
  })
  return { ...result, ...overrides }
}

function client(version) {
  const service = createGraphService({ workspaceId: WORKSPACE })
  let requestNumber = 0
  async function send(operation, payload = {}, overrides = {}) {
    // Match the real HTTP JSON boundary when a prior safe response uses
    // null-prototype data records. Prototypes are not JSON contract content.
    const request = copy(envelope(version, operation, payload, { requestId: `Request_${++requestNumber}`, ...overrides }))
    const originalRequest = copy(request)
    const response = await dispatchGraphContract({ service, method: 'POST', url: `/api/contracts/${request.kind}`, body: request })
    assert.deepEqual(request, originalRequest, 'dispatch may not mutate the request')
    return { response, request }
  }
  async function call(operation, payload = {}, overrides = {}) {
    const { response, request } = await send(operation, payload, overrides)
    assert.equal(response.statusCode, 200, `${version} ${operation}: ${JSON.stringify(response.result)}`)
    assert.deepEqual(Object.keys(response.result).sort(), ['apiVersion', 'ok', 'requestId', 'result'])
    assert.equal(response.result.ok, true)
    assert.equal(response.result.apiVersion, version)
    assert.equal(response.result.requestId, request.requestId)
    observed.get(version).executed.add(operation)
    observed.get(version).successes.push({ operation, requestId: request.requestId,
      requestSha256: sha256(JSON.stringify(request)), resultSha256: sha256(JSON.stringify(response.result)) })
    return response.result.result
  }
  return { service, send, call }
}

for (const version of ['1.0', '1.1']) test(`API ${version} executes its entire supported operation set through the real service`, async t => {
  const { service, call } = client(version)
  const original = literalGraph()
  const inputBytes = JSON.stringify(original)
  let initial
  let currentRevision
  let exported
  let migration

  await t.test('graph.status', async () => {
    const result = await call('graph.status')
    assert.equal(result.workspaceId, WORKSPACE)
    assert.deepEqual(result.documents, [])
  })
  await t.test('graph.preview', async () => {
    initial = await call('graph.preview', { document: original })
    assert.match(initial.digest, HASH)
    assert.equal(initial.documentId, 'DispatchDoc')
    assert.equal(initial.stats.nodes, 5)
    assert.equal(initial.stats.references, 3)
    assert.equal(initial.stats.opaqueNodes, 1)
    assert.deepEqual(service.status().documents, [], 'preview must not accept a graph')
  })
  await t.test('graph.accept', async () => {
    const result = await call('graph.accept', { digest: initial.digest })
    currentRevision = result.revision
    assert.equal(currentRevision, initial.revision)
    assert.equal(result.stats.revision, result.revision)
    assert.deepEqual(result.document.nodes.find(node => node.id === 'Root').childIds, ['Second', 'First', 'Opaque'])
  })
  await t.test('graph.document', async () => {
    const result = await call('graph.document', { documentId: 'DispatchDoc' })
    assert.equal(result.revision, currentRevision)
    assert.deepEqual(copy(result.document.nodes.find(node => node.id === 'First').source),
      original.nodes.find(node => node.id === 'First').source)
  })
  await t.test('graph.export', async () => {
    const before = service.status()
    exported = await call('graph.export', { documentId: 'DispatchDoc' })
    assert.equal(exported.format, 'webappx-graph')
    assert.equal(exported.revision, currentRevision)
    assert.deepEqual(exported.document.nodes.find(node => node.id === 'Root').childIds, ['Second', 'First', 'Opaque'])
    assert.deepEqual(service.status(), before)
  })
  await t.test('contracts.list', async () => {
    const result = await call('contracts.list')
    assert.equal(result.apiVersion, version)
    assert.equal(result.schemaRevision, observed.get(version).schemaRevision)
    assert.deepEqual(result.operations.map(item => item.id).sort(), [...EXPECTED_OPERATIONS[version]].sort())
  })
  await t.test('contracts.describe', async () => {
    const result = await call('contracts.describe', { operation: 'graph.preview', version })
    assert.equal(result.id, 'graph.preview')
    assert.equal(result.version, version)
    assert.equal(result.capabilityId, 'lan.graph.preview@1')
    assert.equal(result.kind, 'command')
    assert.equal(result.implemented, true)
  })
  await t.test('contracts.examples', async () => {
    const before = service.status()
    const result = await call('contracts.examples', { operation: 'graph.status', version })
    assert.equal(result.apiVersion, version)
    assert.equal(result.schemaRevision, observed.get(version).schemaRevision)
    assert.equal(result.validRequest.operation, 'graph.status')
    assert.equal(validateApiRequest(result.validRequest).envelope.apiVersion, version)
    assert.throws(() => validateApiRequest(result.invalidRequest), { category: 'validation' })
    assert.deepEqual(service.status(), before, 'viewing examples must not execute the examples')
  })
  await t.test('contracts.export', async () => {
    const before = service.status()
    const result = await call('contracts.export')
    assert.equal(result.format, 'webappx-api-contracts')
    assert.equal(result.apiVersion, version)
    assert.equal(result.schemaRevision, observed.get(version).schemaRevision)
    assert.deepEqual(result.operations.map(item => item.id).sort(), [...EXPECTED_OPERATIONS[version]].sort())
    assert.ok(result.capabilities.every(item => item.implemented === true))
    assert.equal(JSON.stringify(result).includes(GRAPH_CANARY), false)
    assert.equal(JSON.stringify(result).includes(WORKSPACE), false)
    assert.deepEqual(service.status(), before)
  })

  if (version === '1.1') {
    await t.test('graph.findings', async () => {
      const result = await call('graph.findings', { documentId: 'DispatchDoc', severity: 'info', offset: 0, limit: 1 })
      assert.equal(result.totalScope, 'retained-findings')
      assert.equal(result.revision, currentRevision)
      assert.equal(result.total, 1)
      assert.equal(result.items[0].code, 'OPAQUE_IMPORTED_REGION')
      assert.equal(result.upstreamOmittedCount, 0)
    })
    await t.test('graph.lookup includes every concrete result union kind', async () => {
      for (const [kind, id] of [['page', 'DispatchPage'], ['node', 'Root'], ['component', 'Card'], ['collection', 'Articles'], ['reference', 'CardRef']]) {
        const result = await call('graph.lookup', { workspaceId: WORKSPACE, documentId: 'DispatchDoc', kind, id })
        assert.equal(result.id, id)
      }
    })
    await t.test('graph.compare includes document changes, sibling reorder and complete totals', async () => {
      const changed = copy(original)
      changed.nodes.find(node => node.id === 'First').label = 'Changed label'
      changed.nodes.find(node => node.id === 'Root').childIds = ['First', 'Second', 'Opaque']
      changed.extensions['org.webappx.readonly'].note = 'changed-fixture-note'
      const preview = await call('graph.preview', { document: changed })
      const accepted = await call('graph.accept', { digest: preview.digest }, { expectedRevision: currentRevision })
      const result = await call('graph.compare', { documentId: 'DispatchDoc', beforeRevision: currentRevision, afterRevision: accepted.revision })
      assert.equal(result.beforeRevision, currentRevision)
      assert.equal(result.afterRevision, accepted.revision)
      assert.ok(result.changed.some(item => item.kind === 'document' && item.id === 'DispatchDoc'))
      assert.ok(result.changed.some(item => item.kind === 'node' && item.id === 'First'))
      assert.ok(result.reordered.some(item => item.kind === 'node' && item.id === 'Root'))
      for (const key of ['added', 'removed', 'changed', 'reordered']) assert.equal(result.totals[key], result[key].length)
      currentRevision = accepted.revision
    })
    await t.test('graph.reopen restores the reviewed export using the current revision', async () => {
      const result = await call('graph.reopen', { document: exported }, { expectedRevision: currentRevision })
      assert.equal(result.revision, initial.revision)
      assert.deepEqual(result.document, exported.document)
      currentRevision = result.revision
    })
    await t.test('graph.migrationPreview returns the four real ordered transformation objects', async () => {
      const legacy = literalLegacy()
      const originalBytes = JSON.stringify(legacy)
      const before = service.status()
      migration = await call('graph.migrationPreview', { document: legacy, targetVersion: 1 })
      assert.equal(migration.fromVersion, 0)
      assert.equal(migration.toVersion, 1)
      assert.deepEqual(migration.steps.map(step => step.order), [1, 2, 3, 4])
      assert.deepEqual(migration.steps.map(step => step.operation), [
        'page-list-conversion', 'child-order-derivation', 'schema-version-0-to-1', 'graph-validation',
      ])
      assert.ok(migration.steps.every(step => typeof step.description === 'string' && step.description.length > 0))
      assert.deepEqual(migration.unsupportedFields, [])
      assert.equal(JSON.stringify(legacy), originalBytes)
      assert.deepEqual(service.status(), before)
    })
    await t.test('graph.migrationApply remains isolated until a separate preview and accept', async () => {
      const before = service.status()
      const result = await call('graph.migrationApply', { digest: migration.digest })
      assert.equal(result.isolatedCopy, true)
      assert.equal(result.document.schemaVersion, 1)
      assert.equal(result.document.documentId, 'DispatchLegacy')
      assert.deepEqual(result.document.nodes.find(node => node.id === 'LegacyRoot').childIds, ['Later', 'Earlier'])
      assert.deepEqual(service.status(), before)
      const preview = await call('graph.preview', { document: result.document })
      const accepted = await call('graph.accept', { digest: preview.digest })
      assert.equal(accepted.revision, result.revision)
      assert.equal(service.status().documents.length, before.documents.length + 1)
    })
    await t.test('contracts.compatibility executes both reviewed directions', async () => {
      const before = service.status()
      const forward = await call('contracts.compatibility', { beforeVersion: '1.0', afterVersion: '1.1' })
      assert.equal(forward.beforeSchemaRevision, observed.get('1.0').schemaRevision)
      assert.equal(forward.afterSchemaRevision, observed.get('1.1').schemaRevision)
      assert.ok(forward.additionCount > 0)
      assert.ok(forward.additions.some(item => item.operation === 'graph.findings'))
      const reverse = await call('contracts.compatibility', { beforeVersion: '1.1', afterVersion: '1.0' })
      assert.ok(reverse.breakingCount > 0)
      assert.ok(reverse.breakingChanges.some(item => item.operation === 'graph.findings'))
      assert.deepEqual(service.status(), before)
    })
  }
  assert.equal(JSON.stringify(original), inputBytes, 'all operations preserve the literal source fixture')
  assert.deepEqual([...observed.get(version).executed].sort(), [...EXPECTED_OPERATIONS[version]].sort())
})

test('unsupported version and operation variants refuse without changing real service state', async () => {
  const older = client('1.0')
  const newerOnly = [
    ['graph.findings', { documentId: 'DispatchDoc' }],
    ['graph.lookup', { workspaceId: WORKSPACE, documentId: 'DispatchDoc', id: 'Root', kind: 'node' }],
    ['graph.compare', { documentId: 'DispatchDoc', beforeRevision: SOURCE_REVISION, afterRevision: SOURCE_REVISION }],
    ['graph.reopen', { document: {} }],
    ['graph.migrationPreview', { document: literalLegacy(), targetVersion: 1 }],
    ['graph.migrationApply', { digest: SOURCE_REVISION }],
    ['contracts.compatibility', { beforeVersion: '1.0', afterVersion: '1.1' }],
  ]
  const initial = copy(older.service.status())
  for (const [operation, payload] of newerOnly) {
    const { response, request } = await older.send(operation, payload)
    assert.equal(response.result.ok, false)
    assert.equal(response.result.error.category, 'capability', JSON.stringify(response.result))
    assert.equal(response.result.requestId, request.requestId)
    observed.get('1.0').refusals.push({ operation, category: response.result.error.category })
    assert.deepEqual(older.service.status(), initial)
  }
  const current = client('1.1')
  for (const operation of ['graph.sourceWrite', 'graph.editStructure']) {
    const { response } = await current.send(operation)
    assert.equal(response.result.ok, false)
    assert.equal(response.result.error.category, 'capability')
    observed.get('1.1').refusals.push({ operation, category: response.result.error.category })
    assert.deepEqual(current.service.status().documents, [])
  }
  const future = await current.send('graph.status', {}, { apiVersion: '2.0' })
  assert.equal(future.response.result.error.category, 'incompatible-version')
  assert.match(future.response.result.error.message, /1\.0.*1\.1/)
  assert.deepEqual(current.service.status().documents, [])
})

test('typed refusals preserve every valid digit and underscore request identity', async () => {
  for (const version of ['1.0', '1.1']) {
    const { service } = client(version)
    for (const requestId of ['7Digit', '_Underscore', '-Dash', '_'.repeat(64)]) {
      const response = await dispatchGraphContract({ service, method: 'POST', url: '/api/contracts/query',
        body: envelope(version, 'graph.document', { documentId: 'NotAccepted' }, { requestId }) })
      assert.equal(response.result.ok, false)
      assert.equal(response.result.error.category, 'missing-target')
      assert.equal(response.result.requestId, requestId)
      assert.equal(response.result.apiVersion, version)
      assert.deepEqual(service.status().documents, [])
    }
  }
})

after(() => {
  const afterHashes = inputHashes()
  const receipt = {
    format: 'webappx-real-dispatch-composition', formatVersion: 1,
    inputHashes: beforeHashes, inputDrift: Object.keys(beforeHashes).filter(path => beforeHashes[path] !== afterHashes[path]),
    versions: Object.fromEntries([...observed].map(([version, data]) => [version, {
      schemaRevision: data.schemaRevision, expectedOperations: EXPECTED_OPERATIONS[version],
      executedOperations: [...data.executed].sort(), successfulRequests: data.successes, refusals: data.refusals,
    }])),
  }
  console.log(`GRAPH_API_DISPATCH_RECEIPT ${JSON.stringify(receipt)}`)
  assert.deepEqual(afterHashes, beforeHashes, 'tested production inputs must remain unchanged during this run')
  for (const [version, data] of observed) {
    assert.match(data.schemaRevision, HASH)
    assert.deepEqual([...data.executed].sort(), [...EXPECTED_OPERATIONS[version]].sort(), `all ${version} supported operations must execute successfully`)
  }
})
