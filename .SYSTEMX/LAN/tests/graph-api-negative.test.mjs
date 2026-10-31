import assert from 'node:assert/strict'
import { test } from 'node:test'
import { GraphError, graphRevision } from '../Builder/graph-core.mjs'
import { validateGraph } from '../Builder/graph-validation.mjs'
import { applyGraphMigration, previewGraphMigration } from '../Builder/graph-evolution.mjs'
import { createGraphService } from '../Builder/graph-service.mjs'
import { dispatchGraphContract } from '../Builder/graph-http.mjs'
import { getOperationDescriptor } from '../Builder/api-contracts.mjs'
import { ApiContractError, apiErrorResult, validateApiRequest, validatePublicSchema } from '../Builder/api-validation.mjs'

const workspaceId = '1'.repeat(64)
const otherWorkspaceId = '2'.repeat(64)
const sourceRevision = '3'.repeat(64)
const sourceRef = { path: 'src/pages/Test.tsx', sourceRevision, start: 0, end: 4, fingerprint: '4'.repeat(64) }
const node = (id, parentId, childIds) => ({
  id, kind: 'element', parentId, childIds, label: id, ownership: 'source-owned',
  source: { ...sourceRef }, opaqueReason: null,
})
function graph() {
  return {
    schemaVersion: 1, workspaceId, documentId: 'TestDoc', sourceRevision,
    pages: [{ id: 'TestPage', rootId: 'Root', route: '/test' }],
    nodes: [node('Root', null, ['Left', 'Right']), node('Left', 'Root', []), node('Right', 'Root', [])],
    references: [], components: [], collections: [], extensions: {},
  }
}
const graphFailure = candidate => {
  let failure
  try { validateGraph(candidate) } catch (error) { failure = error }
  assert.ok(failure instanceof GraphError, `Expected GraphError, got ${failure}`)
  assert.ok(failure.findings.length <= 50)
  assert.ok(Number.isInteger(failure.omittedCount) && failure.omittedCount >= 0)
  return failure
}
const command = (operation, payload, overrides = {}) => ({
  apiVersion: '1.1', requestId: 'Cmd1', kind: 'command', operation,
  capabilityId: getOperationDescriptor(operation, '1.1').capabilityId,
  payload: { type: operation, ...payload }, confirmation: '', expectedRevision: null, ...overrides,
})
const query = (operation, payload = {}, overrides = {}) => ({
  apiVersion: '1.1', requestId: 'Query1', kind: 'query', operation,
  payload: { type: operation, ...payload }, ...overrides,
})
const apiFailure = (envelope, expectedCategory) => {
  let failure
  try { validateApiRequest(envelope, { kind: envelope.kind }) } catch (error) { failure = error }
  assert.ok(failure instanceof ApiContractError, `Expected ApiContractError, got ${failure}`)
  assert.equal(failure.category, expectedCategory)
  assert.ok(failure.findings.length <= 50)
  assert.ok(Number.isInteger(failure.omittedCount) && failure.omittedCount >= 0)
  return failure
}
const dispatch = (service, body, handlerOverrides) => dispatchGraphContract({
  service, method: 'POST', url: `/api/contracts/${body.kind}`, body, handlerOverrides,
})
const rejected = (result, category, requestId) => {
  assert.ok(result.statusCode >= 400, JSON.stringify(result.result))
  assert.equal(result.result.ok, false)
  assert.equal(result.result.requestId, requestId)
  assert.equal(result.result.error.category, category)
  assert.equal(typeof result.result.error.code, 'string')
  assert.ok(result.result.error.findings.length <= 50)
  assert.ok(Number.isInteger(result.result.error.omittedCount))
}
const rejectsGraph = async operation => assert.rejects(Promise.resolve().then(operation),
  error => error instanceof Error && typeof error.code === 'string')

test('cycle, missing page root, broken reciprocity and duplicate child membership are refused with bounded findings', () => {
  const cycle = graph()
  cycle.nodes[0].parentId = 'Left'
  cycle.nodes[1].childIds = ['Root']
  const cycleError = graphFailure(cycle)
  assert.match(JSON.stringify({ message: cycleError.message, findings: cycleError.findings }), /cycl/i)

  const missingRoot = graph()
  missingRoot.pages[0].rootId = 'MissingRoot'
  graphFailure(missingRoot)

  const reparented = graph()
  reparented.nodes[1].parentId = 'Right'
  graphFailure(reparented)
  assert.equal(reparented.nodes[1].parentId, 'Right')

  const duplicate = graph()
  duplicate.nodes[0].childIds.push('Left')
  graphFailure(duplicate)
})

test('future schema, oversized node count, references and depth refuse rather than truncate a document', () => {
  const future = graph()
  future.schemaVersion = 2
  graphFailure(future)
  assert.equal(future.schemaVersion, 2)

  const manyNodes = graph()
  manyNodes.nodes.push(...Array.from({ length: 1000 }, (_, index) => node(`Extra${index}`, 'Root', [])))
  graphFailure(manyNodes)
  assert.equal(manyNodes.nodes.length, 1003)

  const manyReferences = graph()
  manyReferences.references = Array.from({ length: 2001 }, (_, index) => ({
    id: `Ref${index}`, kind: 'node', documentId: 'TestDoc', targetId: 'Left',
    expectedVersion: null, expectedSchemaId: null, required: true,
  }))
  graphFailure(manyReferences)
  assert.equal(manyReferences.references.length, 2001)

  const deep = graph()
  deep.nodes = [node('Root', null, ['Depth0'])]
  for (let index = 0; index < 65; index += 1) {
    deep.nodes.push(node(`Depth${index}`, index === 0 ? 'Root' : `Depth${index - 1}`,
      index === 64 ? [] : [`Depth${index + 1}`]))
  }
  graphFailure(deep)
})

test('required component and collection incompatibilities fail; optional unresolved references remain explicit warnings', () => {
  const withComponent = graph()
  withComponent.nodes.push(node('CardRoot', null, []))
  withComponent.components.push({ id: 'Card', version: '1.0.0', rootId: 'CardRoot' })
  withComponent.references.push({ id: 'CompRef', kind: 'component', documentId: 'TestDoc', targetId: 'Card',
    expectedVersion: '2.0.0', expectedSchemaId: null, required: true })
  graphFailure(withComponent)
  withComponent.references[0].required = false
  const componentWarning = validateGraph(withComponent)
  assert.ok(componentWarning.findings.some(item => item.severity === 'warning' && item.objectId === 'CompRef'))
  assert.ok(componentWarning.stats.unresolvedReferences >= 1)

  const withCollection = graph()
  withCollection.collections.push({ id: 'Articles', schemaId: 'article-v1', version: '1' })
  withCollection.references.push({ id: 'CollectionRef', kind: 'collection', documentId: 'TestDoc', targetId: 'Articles',
    expectedVersion: '2', expectedSchemaId: 'article-v2', required: true })
  graphFailure(withCollection)
  withCollection.references[0].required = false
  const collectionWarning = validateGraph(withCollection)
  assert.ok(collectionWarning.findings.some(item => item.severity === 'warning' && item.objectId === 'CollectionRef'))
  assert.ok(collectionWarning.stats.unresolvedReferences >= 1)

  const foreign = graph()
  foreign.references.push({ id: 'ForeignNode', kind: 'node', documentId: 'OtherDoc', targetId: 'Left',
    expectedVersion: null, expectedSchemaId: null, required: true })
  graphFailure(foreign)
})

test('runtime fields, unreviewed extensions and private values never enter canonical graph data', () => {
  const runtime = graph()
  runtime.sessionToken = 'synthetic-session-canary'
  graphFailure(runtime)
  const namespace = graph()
  namespace.extensions['com.unknown.commands'] = { action: 'execute' }
  graphFailure(namespace)
  const secret = graph()
  secret.extensions['org.webappx.readonly'] = { apiKey: 'sk_live_SYNTHETIC_PRIVATE_CANARY' }
  const failure = graphFailure(secret)
  assert.equal(JSON.stringify(failure).includes('sk_live_SYNTHETIC_PRIVATE_CANARY'), false)
  const path = graph()
  path.nodes[0].source.path = '/home/private-fixture/Test.tsx'
  const pathFailure = graphFailure(path)
  assert.equal(JSON.stringify(pathFailure).includes('/home/private-fixture'), false)
})

test('bad reimport and stale proposal preserve the accepted graph and source revision', async () => {
  const service = createGraphService({ workspaceId })
  const initial = graph()
  const firstPreview = await service.preview({ document: initial })
  const accepted = await service.accept({ digest: firstPreview.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  const bad = graph()
  bad.sourceRevision = '5'.repeat(64)
  for (const item of bad.nodes) item.source.sourceRevision = bad.sourceRevision
  bad.pages[0].rootId = 'MissingRoot'
  await rejectsGraph(() => service.preview({ document: bad }))
  const readAfterFailure = await service.read({ documentId: 'TestDoc' })
  assert.equal(readAfterFailure.revision, accepted.revision)
  assert.equal(readAfterFailure.document.sourceRevision, sourceRevision)

  const earlier = graph()
  earlier.nodes[1].label = 'Earlier proposal'
  const firstPending = await service.preview({ document: earlier })
  const later = graph()
  later.nodes[1].label = 'Latest proposal'
  const latestPending = await service.preview({ document: later })
  await rejectsGraph(() => service.accept({ digest: firstPending.digest, expectedRevision: accepted.revision,
    confirmation: 'ACCEPT GRAPH' }))
  await rejectsGraph(() => service.accept({ digest: latestPending.digest, expectedRevision: null,
    confirmation: 'ACCEPT GRAPH' }))
  assert.equal((await service.read({ documentId: 'TestDoc' })).revision, accepted.revision)
  const latestAccepted = await service.accept({ digest: latestPending.digest, expectedRevision: accepted.revision,
    confirmation: 'ACCEPT GRAPH' })
  assert.equal(latestAccepted.revision, graphRevision(later))
})

test('reopen refuses a different workspace and leaves the current accepted revision intact', async () => {
  const service = createGraphService({ workspaceId })
  const preview = await service.preview({ document: graph() })
  const accepted = await service.accept({ digest: preview.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  const exported = await service.export({ documentId: 'TestDoc' })
  const foreign = structuredClone(exported)
  foreign.document.workspaceId = otherWorkspaceId
  foreign.revision = graphRevision(foreign.document)
  await rejectsGraph(() => service.reopen({ document: foreign, expectedRevision: accepted.revision,
    confirmation: 'REOPEN GRAPH' }))
  assert.equal((await service.read({ documentId: 'TestDoc' })).revision, accepted.revision)
})

test('qualified lookups and explicit null revision refuse incompatible or ambiguous targets', async () => {
  const service = createGraphService({ workspaceId })
  const preview = await service.preview({ document: graph() })
  await service.accept({ digest: preview.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  assert.equal((await service.lookup({ workspaceId, documentId: 'TestDoc', id: 'Left', kind: 'node' })).id, 'Left')
  await rejectsGraph(() => service.lookup({ workspaceId: otherWorkspaceId, documentId: 'TestDoc', id: 'Left', kind: 'node' }))
  await rejectsGraph(() => service.lookup({ workspaceId, documentId: 'TestDoc', id: 'Left', kind: 'collection' }))
  await rejectsGraph(() => service.lookup({ workspaceId, documentId: 'TestDoc', id: 'Missing', kind: 'node' }))
  await rejectsGraph(() => service.read({ documentId: 'TestDoc', revision: null }))
  assert.equal((await service.read({ documentId: 'TestDoc' })).revision, preview.revision)
})

test('migration refuses unknown fields, a wrong digest and missing typed confirmation without changing input', () => {
  const legacy = graph()
  legacy.schemaVersion = 0
  legacy.page = legacy.pages[0]
  delete legacy.pages
  for (const item of legacy.nodes) delete item.childIds
  const before = structuredClone(legacy)
  const unknown = structuredClone(legacy)
  unknown.runtimeHandle = 'synthetic-runtime-canary'
  graphFailure(unknown)
  assert.throws(() => previewGraphMigration(unknown, { targetVersion: 1 }), error => error instanceof GraphError)
  const preview = previewGraphMigration(legacy, { targetVersion: 1 })
  assert.throws(() => applyGraphMigration(preview, { digest: '0'.repeat(64), confirmation: 'MIGRATE GRAPH COPY' }),
    error => error instanceof GraphError)
  assert.throws(() => applyGraphMigration(preview, { digest: preview.digest, confirmation: '' }),
    error => error instanceof GraphError)
  assert.deepEqual(legacy, before)
})

test('strict query and command validation rejects unknown fields, hidden effects and wrong discriminators', () => {
  apiFailure(query('graph.status', { mutate: true }), 'validation')
  apiFailure({ ...query('graph.status'), hidden: 'effect' }, 'validation')
  apiFailure(query('graph.document', { documentId: 'TestDoc', revision: null }), 'validation')
  apiFailure(query('graph.lookup', { workspaceId, documentId: 'TestDoc', id: 'Root', kind: 'collection' }, {
    kind: 'command', capabilityId: 'lan.graph.lookup@1', confirmation: '', expectedRevision: null,
  }), 'validation')
  apiFailure(command('graph.preview', { document: graph(), type: 'graph.accept' }), 'validation')
  apiFailure({ ...command('graph.preview', { document: graph() }), unexpected: true }, 'validation')
  apiFailure(command('graph.preview', { document: graph() }, { expectedRevision: undefined }), 'validation')
  apiFailure(command('graph.preview', { document: graph() }, { expectedRevision: '' }), 'validation')
})

test('pagination and absent versus explicit null follow the declared query and command schemas', () => {
  for (const offset of ['1', -1, 1.5, 10001]) apiFailure(query('graph.findings', { documentId: 'TestDoc', offset }), 'validation')
  for (const limit of [0, '10', 51, null]) apiFailure(query('graph.findings', { documentId: 'TestDoc', limit }), 'validation')
  assert.equal(validateApiRequest(query('graph.findings', { documentId: 'TestDoc', offset: 0, limit: 50 })).payload.limit, 50)
  assert.equal(validateApiRequest(query('graph.document', { documentId: 'TestDoc' })).payload.revision, undefined)
  apiFailure(query('graph.document', { documentId: 'TestDoc', revision: null }), 'validation')
  assert.equal(validateApiRequest(command('graph.preview', { document: graph() })).envelope.expectedRevision, null)
  apiFailure(command('graph.preview', { document: graph() }, { expectedRevision: undefined }), 'validation')
})

test('version, capability and confirmation refusals occur before service handler resolution', async () => {
  let calls = 0
  const service = {
    status() { calls += 1; return { workspaceId, documents: [], limits: {} } },
    preview() { calls += 1; return { bogus: true } },
  }
  rejected(await dispatch(service, query('graph.status', {}, { apiVersion: '2.0', requestId: 'Future' })),
    'incompatible-version', 'Future')
  const oldAddition = await dispatch(service, query('graph.findings', { documentId: 'TestDoc' }, {
    apiVersion: '1.0', requestId: 'OldAddition',
  }))
  assert.ok(['capability', 'incompatible-version'].includes(oldAddition.result.error.category))
  assert.equal(oldAddition.result.requestId, 'OldAddition')
  assert.equal(oldAddition.result.ok, false)
  rejected(await dispatch(service, command('graph.preview', { document: graph() }, {
    capabilityId: 'lan.graph.wrong@1', requestId: 'WrongCapability',
  })), 'capability', 'WrongCapability')
  rejected(await dispatch(service, command('graph.accept', { digest: 'a'.repeat(64) }, {
    confirmation: 'YES', requestId: 'WrongConfirmation',
  })), 'confirmation', 'WrongConfirmation')
  rejected(await dispatch(service, command('graph.preview', { document: graph(), type: 'graph.accept' }, {
    requestId: 'WrongVariant',
  })), 'validation', 'WrongVariant')
  const canary = await dispatch(service, query('graph.status', { unknownField: 'sk_live_SYNTHETIC_PRIVATE_CANARY' }, {
    requestId: 'PrivateCanary',
  }))
  rejected(canary, 'validation', 'PrivateCanary')
  assert.equal(JSON.stringify(canary).includes('sk_live_SYNTHETIC_PRIVATE_CANARY'), false)
  assert.equal(calls, 0)
})

test('missing targets and stale acceptance return typed errors while preserving the accepted graph', async () => {
  const service = createGraphService({ workspaceId })
  const missing = await dispatch(service, query('graph.document', { documentId: 'AbsentDoc' }, { requestId: 'MissingDoc' }))
  rejected(missing, 'missing-target', 'MissingDoc')
  const preview = await service.preview({ document: graph() })
  const accepted = await service.accept({ digest: preview.digest, expectedRevision: null, confirmation: 'ACCEPT GRAPH' })
  const changed = graph()
  changed.nodes[1].label = 'new label'
  const next = await service.preview({ document: changed })
  const stale = await dispatch(service, command('graph.accept', { digest: next.digest }, {
    requestId: 'StaleAccept', confirmation: 'ACCEPT GRAPH', expectedRevision: 'a'.repeat(64),
  }))
  rejected(stale, 'conflict', 'StaleAccept')
  assert.equal((await service.read({ documentId: 'TestDoc' })).revision, accepted.revision)
})

test('a malformed development handler response is an internal refusal, never successful fabricated data', async () => {
  const service = createGraphService({ workspaceId })
  const result = await dispatch(service, query('graph.status', {}, { requestId: 'BadResponse' }), {
    'graph.status': () => 42,
  })
  rejected(result, 'internal', 'BadResponse')
  assert.equal(result.result.error.code, 'RESPONSE_CONTRACT_INVALID')
  assert.match(result.result.error.message, /graph\.status|\/api\/contracts\/query/)
})

test('public diagnostics remain bounded and count omitted errors truthfully', () => {
  const properties = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`Field${index}`, { type: 'string' }]))
  const value = Object.fromEntries(Array.from({ length: 80 }, (_, index) => [`Field${index}`, index]))
  const checked = validatePublicSchema({ type: 'object', properties, required: Object.keys(properties),
    additionalProperties: false }, value)
  assert.equal(checked.valid, false)
  assert.equal(checked.findings.length, 50)
  assert.equal(checked.omittedCount, 30)
  assert.equal(JSON.stringify(checked).includes('Field79: 79'), false)
})

test('typed errors preserve request identity and category while unknown errors hide canaries', () => {
  for (const [category, statusCode] of [
    ['validation', 400], ['missing-target', 404], ['conflict', 409],
    ['capability', 403], ['confirmation', 400], ['incompatible-version', 400],
  ]) {
    const error = new GraphError('SYNTHETIC_TYPED', 'Review the selected graph', { category, statusCode })
    const result = apiErrorResult(error, { apiVersion: '1.1', requestId: 'TypedError' })
    rejected(result, category, 'TypedError')
  }
  const unknown = apiErrorResult(new Error('sk_live_SYNTHETIC_PRIVATE_CANARY /home/private-fixture'), {
    apiVersion: '1.1', requestId: 'InternalError',
  })
  rejected(unknown, 'internal', 'InternalError')
  assert.equal(JSON.stringify(unknown).includes('sk_live_SYNTHETIC_PRIVATE_CANARY'), false)
  assert.equal(JSON.stringify(unknown).includes('/home/private-fixture'), false)
})
