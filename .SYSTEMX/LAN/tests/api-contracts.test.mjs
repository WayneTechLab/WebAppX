import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { createGraphService } from '../Builder/graph-service.mjs'
import { dispatchGraphContract } from '../Builder/graph-http.mjs'
import {
  API_VERSION, SUPPORTED_API_VERSIONS, contractLimits,
  getContractRegistry, getOperationDescriptor, discoveryForClient,
} from '../Builder/api-contracts.mjs'

const canonical = value => Array.isArray(value)
  ? '[' + value.map(canonical).join(',') + ']'
  : value !== null && typeof value === 'object'
    ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
    : JSON.stringify(value)

test('reviewed 1.0 remains executable as its own schema set', t => {
  assert.equal(API_VERSION, '1.1')
  assert.deepEqual(SUPPORTED_API_VERSIONS, ['1.0', '1.1'])
  const older = getContractRegistry('1.0')
  const current = getContractRegistry()
  assert.deepEqual(older.operations.map(d => d.id), [
    'graph.status', 'graph.document', 'graph.preview', 'graph.accept', 'graph.export',
    'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.export',
  ])
  assert.deepEqual(current.operations.map(d => d.id), [
    'graph.status', 'graph.document', 'graph.findings', 'graph.lookup', 'graph.compare', 'graph.export',
    'graph.preview', 'graph.accept', 'graph.reopen', 'graph.migrationPreview', 'graph.migrationApply',
    'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.compatibility', 'contracts.export',
  ])
  assert.equal(getOperationDescriptor('graph.findings', '1.0'), null)
  assert.equal(getOperationDescriptor('graph.findings', '1.1')?.implemented, true)
  assert.equal(getOperationDescriptor('graph.preview', '1.0')?.inputSchema.properties.apiVersion.const, '1.0')
  assert.equal(getOperationDescriptor('graph.preview', '1.1')?.inputSchema.properties.apiVersion.const, '1.1')
  assert.notEqual(older.schemaRevision, current.schemaRevision)
  for (const registry of [older, current]) {
    t.diagnostic('apiVersion=' + registry.apiVersion +
      ' schemaRevision=' + registry.schemaRevision +
      ' implementedOperations=' + registry.operations.filter(d => d.implemented).map(d => d.id).join(','))
  }
})

test('schema revisions bind exact fixed public bytes and exclude their own hash', () => {
  for (const version of SUPPORTED_API_VERSIONS) {
    const { schemaRevision, ...publicBytes } = getContractRegistry(version)
    assert.equal(schemaRevision, createHash('sha256').update(canonical(publicBytes)).digest('hex'))
    assert.match(schemaRevision, /^[a-f0-9]{64}$/)
  }
  assert.ok(Object.isFrozen(getContractRegistry().operations[0].inputSchema.properties.payload))
  assert.throws(() => { getContractRegistry().operations.push('mutated') }, TypeError)
})

test('query and command envelopes expose exact discriminated fields before dispatch', () => {
  const requiredDescriptorKeys = [
    'id', 'version', 'kind', 'implemented', 'capabilityId', 'inputSchema', 'resultSchema',
    'effect', 'confirmation', 'revisionPrecondition', 'pagination', 'deprecated', 'examples',
  ]
  for (const version of SUPPORTED_API_VERSIONS) {
    for (const descriptor of getContractRegistry(version).operations) {
      assert.deepEqual(Object.keys(descriptor).sort(), requiredDescriptorKeys.sort())
      assert.equal(descriptor.implemented, true)
      assert.equal(descriptor.capabilityId, 'lan.' + descriptor.id + '@1')
      assert.equal(descriptor.inputSchema.additionalProperties, false)
      assert.deepEqual([...descriptor.inputSchema.required].sort(), Object.keys(descriptor.inputSchema.properties).sort())
      assert.equal(descriptor.inputSchema.properties.kind.const, descriptor.kind)
      assert.equal(descriptor.inputSchema.properties.operation.const, descriptor.id)
      assert.equal(descriptor.inputSchema.properties.apiVersion.const, version)
      if (descriptor.kind === 'command') {
        assert.equal(descriptor.inputSchema.properties.capabilityId.const, descriptor.capabilityId)
        assert.equal(descriptor.inputSchema.properties.expectedRevision.type.includes('null'), true)
        assert.equal(descriptor.revisionPrecondition.required, true)
        assert.equal(descriptor.confirmation.required, true)
      } else {
        assert.equal(Object.hasOwn(descriptor.inputSchema.properties, 'confirmation'), false)
        assert.equal(Object.hasOwn(descriptor.inputSchema.properties, 'expectedRevision'), false)
        assert.equal(Object.hasOwn(descriptor.inputSchema.properties, 'capabilityId'), false)
        assert.equal(descriptor.confirmation, null)
      }
    }
  }
  const preview = getOperationDescriptor('graph.preview')
  assert.equal(preview.inputSchema.properties.payload.oneOf.length, 2)
  assert.deepEqual(preview.inputSchema.properties.payload.oneOf.map(x => x.required), [
    ['type', 'document'], ['type', 'identityDocumentId'],
  ])
  assert.equal(preview.inputSchema.properties.payload.oneOf.every(x => x.additionalProperties === false), true)
  assert.equal(getOperationDescriptor('graph.accept').inputSchema.properties.confirmation.const, 'ACCEPT GRAPH')
  assert.equal(getOperationDescriptor('graph.reopen').inputSchema.properties.confirmation.const, 'REOPEN GRAPH')
  assert.equal(getOperationDescriptor('graph.migrationApply').inputSchema.properties.confirmation.const, 'MIGRATE GRAPH COPY')
})

test('bounded read schemas state nullable, absent, and pagination behavior', () => {
  const document = getOperationDescriptor('graph.document').inputSchema.properties.payload
  assert.deepEqual(document.required, ['type', 'documentId'])
  assert.equal(document.properties.revision.type, 'string')
  assert.equal(document.properties.revision.pattern, '^[a-f0-9]{64}$')
  const findings = getOperationDescriptor('graph.findings')
  assert.deepEqual(findings.pagination, {
    mode: 'offset', defaultOffset: 0, defaultLimit: 20,
    maximumOffset: 10000, maximumLimit: 50,
    totalScope: 'matching retained findings; upstream omissions are separately counted',
  })
  assert.equal(findings.inputSchema.properties.payload.properties.offset.type, 'integer')
  assert.equal(findings.inputSchema.properties.payload.properties.limit.minimum, 1)
  assert.equal(findings.inputSchema.properties.payload.properties.limit.maximum, 50)
  assert.equal(findings.resultSchema.properties.total.type, 'integer')
  assert.deepEqual(getOperationDescriptor('graph.status').inputSchema.properties.payload.required, ['type'])
  assert.deepEqual(getOperationDescriptor('graph.accept').inputSchema.properties.expectedRevision.type, ['string', 'null'])
  assert.equal(contractLimits.findings, 50)
})

test('discovery reports supported compatibility, deprecated 1.0, and unavailable effects', () => {
  const older = discoveryForClient('1.0')
  assert.equal(older.apiVersion, '1.1')
  assert.equal(older.compatibleVersion, '1.0')
  assert.equal(older.schemaRevision, getContractRegistry('1.0').schemaRevision)
  assert.ok(older.unavailableOperations.some(x => x.operation === 'graph.findings' && x.availableSince === '1.1'))
  assert.ok(older.unavailableOperations.some(x => x.operation === 'graph.sourceWrite'))
  assert.ok(older.unavailableOperations.some(x => x.operation === 'graph.editStructure'))
  assert.equal(older.deprecated.length, 9)
  assert.equal(older.deprecated[0].replacementVersion, '1.1')
  assert.equal(older.deprecated[0].removalDate, null)
  assert.equal(discoveryForClient('1.1').deprecated.length, 0)
  assert.equal(getOperationDescriptor('graph.sourceWrite'), null)
  assert.equal(getOperationDescriptor('__proto__'), null)
  assert.throws(() => getContractRegistry('2.0'), error => {
    assert.equal(error.code, 'API_VERSION_UNSUPPORTED')
    assert.equal(error.category, 'incompatible-version')
    assert.deepEqual(error.supportedVersions, ['1.0', '1.1'])
    assert.doesNotMatch(error.message, /2\.0/)
    return true
  })
})

test('public registry contains no runtime or private machine value', () => {
  const serialized = JSON.stringify(discoveryForClient('1.0')) + JSON.stringify(discoveryForClient('1.1'))
  assert.doesNotMatch(serialized, /\/Users\/|\/private\/|file:\/\/|localhost|127\.0\.0\.1|firebase|api[_-]?key/i)
  assert.equal(getContractRegistry().scope.sourceWrites, false)
  assert.equal(getContractRegistry().scope.structuralEditing, false)
  for (const descriptor of getContractRegistry().operations) {
    assert.ok(descriptor.resultSchema.properties || descriptor.resultSchema.oneOf)
    assert.notDeepEqual(descriptor.resultSchema, { type: 'object', additionalProperties: true })
  }
})

test('public request types refuse newer-only operations under the older version', () => {
  const sourceName = ts.normalizePath(fileURLToPath(new URL('../Builder/contracts/graph-contract-version-check.mts', import.meta.url)))
  const declarations = fileURLToPath(new URL('../Builder/contracts/graph-api.types.d.ts', import.meta.url))
  const source = `import type { GraphApiRequest, GraphExport, ContractExamplesResult, PublicContractExport } from ${JSON.stringify(declarations)};
const oldQuery: GraphApiRequest = { apiVersion:'1.0', requestId:'type-check', kind:'query', operation:'graph.status', payload:{type:'graph.status'} };
const currentQuery: GraphApiRequest = { apiVersion:'1.1', requestId:'type-check', kind:'query', operation:'graph.findings', payload:{type:'graph.findings',documentId:'Document1'} };
// @ts-expect-error API 1.0 does not implement graph.findings.
const wrongQuery: GraphApiRequest = { apiVersion:'1.0', requestId:'type-check', kind:'query', operation:'graph.findings', payload:{type:'graph.findings',documentId:'Document1'} };
declare const validExport: GraphExport;
// @ts-expect-error API 1.0 does not implement graph.reopen.
const wrongCommand: GraphApiRequest = { apiVersion:'1.0', requestId:'type-check', kind:'command', operation:'graph.reopen', capabilityId:'lan.graph.reopen@1', payload:{type:'graph.reopen',document:validExport}, confirmation:'REOPEN GRAPH', expectedRevision:null };
declare const examples: ContractExamplesResult;
const exampleRequest: GraphApiRequest = examples.validRequest;
declare const exported: PublicContractExport;
const capabilityId: string = exported.capabilities[0].id;
void oldQuery; void currentQuery; void exampleRequest; void capabilityId;
`
  const options = { noEmit: true, strict: true, target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
    allowImportingTsExtensions: true, types: [] }
  const host = ts.createCompilerHost(options)
  const originalGetSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (name, ...args) => name === sourceName
    ? ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true)
    : originalGetSourceFile(name, ...args)
  const program = ts.createProgram([sourceName], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  assert.deepEqual(diagnostics.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')), [])
})

const comparisonWorkspace = 'a'.repeat(64)
function comparisonGraph(ids) {
  const element = (id, parentId, childIds = []) => ({ id, parentId, childIds,
    kind: 'element', label: id, ownership: 'read-only', source: null, opaqueReason: null })
  return {
    schemaVersion: 1, workspaceId: comparisonWorkspace, documentId: 'ComparisonDocument', sourceRevision: null,
    pages: [{ id: 'ComparisonPage', rootId: 'Root', route: '/comparison' }],
    nodes: [element('Root', null, ids), ...ids.map(id => element(id, 'Root'))],
    references: [], components: [], collections: [], extensions: {},
  }
}
async function comparisonRequest(service, operation, payload, options = {}) {
  const descriptor = getOperationDescriptor(operation, '1.1')
  const body = { apiVersion: '1.1', requestId: 'comparison_test', kind: descriptor.kind,
    operation, payload: { type: operation, ...payload } }
  if (descriptor.kind === 'command') Object.assign(body, { capabilityId: descriptor.capabilityId,
    confirmation: options.confirmation ?? '', expectedRevision: options.expectedRevision ?? null })
  return dispatchGraphContract({ service, method: 'POST', url: `/api/contracts/${body.kind}`,
    body, ...(options.handlerOverrides ? { handlerOverrides: options.handlerOverrides } : {}) })
}
async function acceptComparisonGraph(service, graph, expectedRevision = null) {
  const preview = await comparisonRequest(service, 'graph.preview', { document: graph })
  assert.equal(preview.statusCode, 200, JSON.stringify(preview.result))
  const accepted = await comparisonRequest(service, 'graph.accept', { digest: preview.result.result.digest },
    { confirmation: 'ACCEPT GRAPH', expectedRevision })
  assert.equal(accepted.statusCode, 200, JSON.stringify(accepted.result))
  return accepted.result.result
}

test('real accepted graph history compares through strict HTTP response validation', async () => {
  const service = createGraphService({ workspaceId: comparisonWorkspace })
  const before = comparisonGraph(['Alpha', 'Beta', 'Removed'])
  const after = comparisonGraph(['Beta', 'Alpha', 'Added'])
  after.nodes.find(item => item.id === 'Alpha').label = 'Changed Alpha'
  const originals = JSON.stringify({ before, after })
  const first = await acceptComparisonGraph(service, before)
  const second = await acceptComparisonGraph(service, after, first.revision)
  const beforeQuery = JSON.stringify(service.status())
  const payload = { documentId: before.documentId, beforeRevision: first.revision, afterRevision: second.revision }
  const response = await comparisonRequest(service, 'graph.compare', payload)
  assert.equal(response.statusCode, 200, JSON.stringify(response.result))
  assert.equal(response.result.ok, true)
  const difference = response.result.result
  assert.equal(difference.beforeRevision, first.revision)
  assert.equal(difference.afterRevision, second.revision)
  assert.deepEqual({ ...difference.totals }, { added: 1, removed: 1, changed: 2, reordered: 1 })
  assert.deepEqual(difference.added.map(item => item.id), ['Added'])
  assert.deepEqual(difference.removed.map(item => item.id), ['Removed'])
  assert.deepEqual(difference.changed.map(item => item.id), ['Alpha', 'Root'])
  assert.deepEqual(difference.reordered.map(item => item.id), ['Root'])
  assert.equal(difference.omittedCount, 0)
  assert.equal(JSON.stringify({ before, after }), originals)
  assert.equal(JSON.stringify(service.status()), beforeQuery)
  for (const malformedTotals of [{ ...difference.totals, unexpected: 1 }, { ...difference.totals, added: '1' }]) {
    const refused = await comparisonRequest(service, 'graph.compare', payload, {
      handlerOverrides: { 'graph.compare': () => ({ ...difference, totals: malformedTotals }) },
    })
    assert.equal(refused.statusCode, 500)
    assert.equal(refused.result.ok, false)
    assert.equal(refused.result.error.code, 'RESPONSE_CONTRACT_INVALID')
    assert.equal(JSON.stringify(service.status()), beforeQuery)
  }
})

test('real HTTP comparison preserves untruncated totals while bounding each result list', async () => {
  const service = createGraphService({ workspaceId: comparisonWorkspace })
  const ids = Array.from({ length: 70 }, (_, index) => `Child${String(index).padStart(2, '0')}`)
  const before = comparisonGraph(ids)
  const after = comparisonGraph([...ids].reverse())
  for (const node of after.nodes) if (node.id !== 'Root') node.label = `Updated ${node.id}`
  const first = await acceptComparisonGraph(service, before)
  const second = await acceptComparisonGraph(service, after, first.revision)
  const response = await comparisonRequest(service, 'graph.compare', {
    documentId: before.documentId, beforeRevision: first.revision, afterRevision: second.revision,
  })
  assert.equal(response.statusCode, 200, JSON.stringify(response.result))
  const difference = response.result.result
  assert.equal(difference.totals.changed, 70)
  assert.equal(difference.changed.length, 50)
  assert.equal(difference.totals.reordered, 1)
  assert.equal(difference.reordered.length, 1)
  assert.equal(difference.omittedCount, 20)
  for (const key of ['added', 'removed', 'changed', 'reordered']) assert.ok(difference[key].length <= 50)
})

test('real HTTP comparison includes document-only source and extension changes', async () => {
  const service = createGraphService({ workspaceId: comparisonWorkspace })
  const before = comparisonGraph(['Alpha'])
  const sourceChanged = structuredClone(before)
  sourceChanged.sourceRevision = 'b'.repeat(64)
  const extensionChanged = structuredClone(sourceChanged)
  extensionChanged.extensions = { 'org.webappx.readonly': { futureNote: 'Reviewed public metadata' } }
  const first = await acceptComparisonGraph(service, before)
  const second = await acceptComparisonGraph(service, sourceChanged, first.revision)
  const third = await acceptComparisonGraph(service, extensionChanged, second.revision)
  for (const [earlier, later] of [[first, second], [second, third]]) {
    const response = await comparisonRequest(service, 'graph.compare', {
      documentId: before.documentId, beforeRevision: earlier.revision, afterRevision: later.revision,
    })
    assert.equal(response.statusCode, 200, JSON.stringify(response.result))
    assert.deepEqual(JSON.parse(JSON.stringify(response.result.result.changed)), [{ kind: 'document', id: before.documentId }])
    assert.deepEqual({ ...response.result.result.totals }, { added: 0, removed: 0, changed: 1, reordered: 0 })
  }
})

test('real HTTP migration preserves ordered steps and accepted state until explicit graph acceptance', async () => {
  const service = createGraphService({ workspaceId: comparisonWorkspace })
  const baseline = comparisonGraph(['Alpha', 'Beta'])
  const accepted = await acceptComparisonGraph(service, baseline)
  const { pages, nodes, ...root } = structuredClone(baseline)
  const legacy = { ...root, schemaVersion: 0, page: pages[0], nodes: nodes.map(({ childIds, ...node }) => node) }
  legacy.nodes.find(node => node.id === 'Alpha').label = 'Migrated Alpha'
  const originalLegacy = JSON.stringify(legacy)
  const statusBefore = JSON.stringify(service.status())
  const previewResponse = await comparisonRequest(service, 'graph.migrationPreview', { document: legacy, targetVersion: 1 })
  assert.equal(previewResponse.statusCode, 200, JSON.stringify(previewResponse.result))
  const preview = previewResponse.result.result
  assert.deepEqual(preview.steps.map(step => step.order), [1, 2, 3, 4])
  assert.deepEqual(preview.steps.map(step => step.operation), [
    'page-list-conversion', 'child-order-derivation', 'schema-version-0-to-1', 'graph-validation',
  ])
  assert.ok(preview.steps.every(step => typeof step.description === 'string' && step.description.length > 0))
  const malformed = await comparisonRequest(service, 'graph.migrationPreview', { document: legacy, targetVersion: 1 }, {
    handlerOverrides: { 'graph.migrationPreview': () => ({ ...preview, steps: ['untyped transformation'] }) },
  })
  assert.equal(malformed.statusCode, 500)
  assert.equal(malformed.result.error.code, 'RESPONSE_CONTRACT_INVALID')
  assert.equal(JSON.stringify(service.status()), statusBefore)
  const copyResponse = await comparisonRequest(service, 'graph.migrationApply', { digest: preview.digest },
    { confirmation: 'MIGRATE GRAPH COPY' })
  assert.equal(copyResponse.statusCode, 200, JSON.stringify(copyResponse.result))
  const isolated = copyResponse.result.result
  assert.equal(isolated.isolatedCopy, true)
  assert.equal(isolated.document.schemaVersion, 1)
  assert.equal(JSON.stringify(service.status()), statusBefore)
  assert.equal(service.read({ documentId: baseline.documentId }).revision, accepted.revision)
  assert.equal(JSON.stringify(legacy), originalLegacy)
  const promoted = await acceptComparisonGraph(service, isolated.document, accepted.revision)
  assert.equal(promoted.revision, isolated.revision)
  assert.notEqual(promoted.revision, accepted.revision)
  assert.equal(service.read({ documentId: baseline.documentId }).revision, promoted.revision)
})
