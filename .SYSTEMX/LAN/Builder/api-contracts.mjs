import { createHash } from 'node:crypto'

// The registry is a fixed public description of metadata-only operations. It has
// no service import, session state, source path, or dispatch mechanism.
export const API_VERSION = '1.1'
export const SUPPORTED_API_VERSIONS = Object.freeze(['1.0', '1.1'])
export const contractLimits = Object.freeze({
  requestBytes: 400000,
  responseBytes: 800000,
  findings: 50,
  requestIdLength: 64,
  paginationOffset: 10000,
  pageSize: 50,
})

const IDENTIFIER = '^[A-Za-z][A-Za-z0-9_-]{0,95}$'
const REQUEST_ID = '^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$'
const HASH = '^[a-f0-9]{64}$'
const OPERATION = '^(graph|contracts)\\.[A-Za-z][A-Za-z0-9]*$'
const S = (maxLength, minLength = 0, pattern) => ({ type: 'string', minLength, maxLength, ...(pattern ? { pattern } : {}) })
const N = (maximum, minimum = 0) => ({ type: 'integer', minimum, maximum })
const A = (items, maxItems, minItems = 0) => ({ type: 'array', items, minItems, maxItems })
const O = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false })
const nullable = schema => ({ ...schema, type: [schema.type, 'null'] })
const id = S(96, 1, IDENTIFIER)
const hash = S(64, 64, HASH)
const count = N(1000000)
const sourceOffset = N(Number.MAX_SAFE_INTEGER)
const graphDocumentPlaceholder = { type: 'object', additionalProperties: true }
const legacyDocumentPlaceholder = { type: 'object', additionalProperties: true }
const readonlyJson = { type: ['object', 'array', 'string', 'number', 'boolean', 'null'] }

const finding = O({
  id,
  code: S(96, 1, '^[A-Z][A-Z0-9_]*$'),
  severity: { type: 'string', enum: ['error', 'warning', 'info'] },
  objectId: nullable(id),
  referenceType: { type: ['string', 'null'], enum: ['node', 'component', 'collection', 'page', null] },
  message: S(500, 1),
})
const findings = A(finding, contractLimits.findings)
const stats = O({
  revision: hash,
  pages: count,
  nodes: count,
  components: count,
  collections: count,
  references: count,
  unresolvedReferences: count,
  opaqueNodes: count,
})
const sourceRef = O({ path: S(512, 1), sourceRevision: hash, start: sourceOffset, end: sourceOffset, fingerprint: hash })
const page = O({ id, rootId: id, route: nullable(S(512)) })
const node = O({
  id,
  kind: { type: 'string', enum: ['element', 'opaque', 'component-instance', 'document-root'] },
  parentId: nullable(id),
  childIds: A(id, 1000),
  label: S(120),
  ownership: { type: 'string', enum: ['source-owned', 'read-only'] },
  source: { oneOf: [sourceRef, { type: 'null' }] },
  opaqueReason: nullable(S(500)),
})
const reference = O({
  id,
  kind: { type: 'string', enum: ['node', 'component', 'collection'] },
  documentId: id,
  targetId: id,
  expectedVersion: nullable(S(96, 1)),
  expectedSchemaId: nullable(S(96, 1)),
  required: { type: 'boolean' },
})
const component = O({ id, version: S(96, 1), rootId: id })
const collection = O({ id, schemaId: id, version: S(96, 1) })
const graphDocument = O({
  schemaVersion: { const: 1 },
  workspaceId: hash,
  documentId: id,
  sourceRevision: nullable(hash),
  pages: A(page, 50),
  nodes: A(node, 1000),
  references: A(reference, 2000),
  components: A(component, 200),
  collections: A(collection, 200),
  extensions: { type: 'object', properties: { 'org.webappx.readonly': readonlyJson }, additionalProperties: false },
})
const exportedDocument = O({
  format: { const: 'webappx-graph' },
  formatVersion: { const: 1 },
  revision: hash,
  document: graphDocument,
})
const acceptedDocument = O({ document: graphDocument, revision: hash, stats, findings, omittedCount: count })
const preview = O({
  digest: hash,
  documentId: id,
  revision: hash,
  sourceRevision: nullable(hash),
  stats,
  findings,
  omittedCount: count,
  document: graphDocument,
})
const versionField = { type: 'string', enum: SUPPORTED_API_VERSIONS }
const offset = N(contractLimits.paginationOffset)
const limit = N(contractLimits.pageSize, 1)
const pagination = Object.freeze({
  mode: 'offset',
  defaultOffset: 0,
  defaultLimit: 20,
  maximumOffset: contractLimits.paginationOffset,
  maximumLimit: contractLimits.pageSize,
  totalScope: 'findings in the accepted document',
})

const payloads = {
  'graph.status': O({ type: { const: 'graph.status' } }),
  'graph.document': O({ type: { const: 'graph.document' }, documentId: id, revision: hash }, ['type', 'documentId']),
  'graph.findings': O({
    type: { const: 'graph.findings' }, documentId: id,
    severity: { type: 'string', enum: ['error', 'warning', 'info'] },
    objectId: id, referenceType: { type: 'string', enum: ['node', 'component', 'collection', 'page'] },
    offset, limit,
  }, ['type', 'documentId']),
  'graph.lookup': O({
    type: { const: 'graph.lookup' }, workspaceId: hash, documentId: id, id,
    kind: { type: 'string', enum: ['page', 'node', 'component', 'collection', 'reference'] },
  }),
  'graph.compare': O({ type: { const: 'graph.compare' }, documentId: id, beforeRevision: hash, afterRevision: hash }),
  'graph.export': O({ type: { const: 'graph.export' }, documentId: id }),
  'graph.preview': {
    oneOf: [
      O({ type: { const: 'graph.preview' }, document: graphDocumentPlaceholder }),
      O({ type: { const: 'graph.preview' }, identityDocumentId: id }),
    ],
  },
  'graph.accept': O({ type: { const: 'graph.accept' }, digest: hash }),
  'graph.reopen': O({ type: { const: 'graph.reopen' }, document: exportedDocument }),
  'graph.migrationPreview': O({ type: { const: 'graph.migrationPreview' }, document: legacyDocumentPlaceholder, targetVersion: { const: 1 } }),
  'graph.migrationApply': O({ type: { const: 'graph.migrationApply' }, digest: hash }),
  'contracts.list': O({ type: { const: 'contracts.list' } }),
  'contracts.describe': O({ type: { const: 'contracts.describe' }, operation: S(64, 1, OPERATION), version: versionField }, ['type', 'operation']),
  'contracts.examples': O({ type: { const: 'contracts.examples' }, operation: S(64, 1, OPERATION), version: versionField }, ['type', 'operation']),
  'contracts.compatibility': O({ type: { const: 'contracts.compatibility' }, beforeVersion: versionField, afterVersion: versionField }),
  'contracts.export': O({ type: { const: 'contracts.export' } }),
}

const difference = O({ kind: { type: 'string', enum: ['page', 'node', 'reference', 'component', 'collection'] }, id })
const contractSchema = { type: 'object', additionalProperties: true }
const deprecation = O({
  since: { const: '1.1' },
  replacementVersion: { const: '1.1' },
  compatibilityWindow: { const: 'supported until an explicit removal release' },
  removalDate: { type: 'null' },
})
const descriptorSchema = O({
  id: S(64, 1, OPERATION),
  version: versionField,
  kind: { type: 'string', enum: ['query', 'command'] },
  implemented: { type: 'boolean' },
  capabilityId: S(96, 1, '^lan\\.(graph|contracts)\\.[A-Za-z][A-Za-z0-9]*@1$'),
  inputSchema: contractSchema,
  resultSchema: contractSchema,
  effect: S(80, 1),
  confirmation: { oneOf: [contractSchema, { type: 'null' }] },
  revisionPrecondition: { oneOf: [contractSchema, { type: 'null' }] },
  pagination: { oneOf: [contractSchema, { type: 'null' }] },
  deprecated: { oneOf: [deprecation, { type: 'null' }] },
  examples: contractSchema,
})
const registrySchema = O({
  apiVersion: versionField,
  supportedVersions: A(versionField, 2, 2),
  schemaRevision: hash,
  scope: contractSchema,
  limits: contractSchema,
  operations: A(descriptorSchema, 20),
})
const exportSchema = O({
  format: { const: 'webappx-public-contracts' },
  formatVersion: { const: 1 },
  apiVersion: versionField,
  supportedVersions: A(versionField, 2),
  schemaRevision: hash,
  scope: contractSchema,
  limits: contractSchema,
  operations: A(descriptorSchema, 20),
  capabilities: A(S(96, 1), 20),
}, ['apiVersion', 'schemaRevision', 'operations'])
const change = O({ operation: S(64, 1, OPERATION), detail: S(240, 1) })

const results = {
  'graph.status': O({
    workspaceId: hash,
    documents: A(O({ documentId: id, revision: hash, sourceRevision: nullable(hash), stats }), 50),
    limits: contractSchema,
  }),
  'graph.document': acceptedDocument,
  'graph.findings': O({ items: findings, total: count, offset, limit, omittedCount: count }),
  'graph.lookup': { oneOf: [page, node, reference, component, collection] },
  'graph.compare': O({
    beforeRevision: hash, afterRevision: hash,
    added: A(difference, 4000), removed: A(difference, 4000), changed: A(difference, 4000),
    reordered: A(difference, 4000), omittedCount: count,
  }),
  'graph.export': exportedDocument,
  'graph.preview': preview,
  'graph.accept': acceptedDocument,
  'graph.reopen': acceptedDocument,
  'graph.migrationPreview': O({
    digest: hash, fromVersion: { const: 0 }, toVersion: { const: 1 },
    steps: A(S(240, 1), 20, 1), unsupportedFields: A(S(240, 1), 50), document: graphDocument,
  }),
  'graph.migrationApply': O({ document: graphDocument, revision: hash, isolatedCopy: { const: true } }),
  'contracts.list': registrySchema,
  'contracts.describe': { oneOf: [descriptorSchema, { type: 'null' }] },
  'contracts.examples': O({
    operation: S(64, 1, OPERATION), version: versionField,
    valid: contractSchema, invalid: contractSchema,
  }),
  'contracts.compatibility': O({
    beforeVersion: versionField, afterVersion: versionField,
    beforeSchemaRevision: hash, afterSchemaRevision: hash,
    additions: A(change, 20), breakingChanges: A(change, 20),
    omittedCount: count,
  }),
  'contracts.export': exportSchema,
}

const currentOperations = [
  'graph.status', 'graph.document', 'graph.findings', 'graph.lookup', 'graph.compare', 'graph.export',
  'graph.preview', 'graph.accept', 'graph.reopen', 'graph.migrationPreview', 'graph.migrationApply',
  'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.compatibility', 'contracts.export',
]
const olderOperations = [
  'graph.status', 'graph.document', 'graph.preview', 'graph.accept', 'graph.export',
  'contracts.list', 'contracts.describe', 'contracts.examples', 'contracts.export',
]
const commands = new Set(['graph.preview', 'graph.accept', 'graph.reopen', 'graph.migrationPreview', 'graph.migrationApply'])
const confirmations = Object.freeze({ 'graph.accept': 'ACCEPT GRAPH', 'graph.reopen': 'REOPEN GRAPH', 'graph.migrationApply': 'MIGRATE GRAPH COPY' })
const operationSuffix = operation => operation.slice(operation.indexOf('.') + 1)
const scope = Object.freeze({
  data: 'local-memory-graph-metadata',
  sourceWrites: false,
  structuralEditing: false,
  providerAccess: false,
})
const unavailablePermanent = Object.freeze([
  { operation: 'graph.sourceWrite', reason: 'Source writes are unavailable through the graph API.' },
  { operation: 'graph.editStructure', reason: 'Structural editing is unavailable through the graph API.' },
])

function envelopeSchema(operation, version, kind) {
  const properties = {
    apiVersion: { const: version }, requestId: S(64, 1, REQUEST_ID), kind: { const: kind },
    operation: { const: operation }, payload: payloads[operation],
  }
  if (kind === 'command') {
    properties.capabilityId = { const: 'lan.graph.' + operationSuffix(operation) + '@1' }
    properties.confirmation = confirmations[operation]
      ? { const: confirmations[operation] }
      : S(64)
    properties.expectedRevision = nullable(hash)
  }
  return O(properties)
}

function makeDescriptor(operation, version) {
  const kind = commands.has(operation) ? 'command' : 'query'
  const confirmation = kind === 'command'
    ? { required: true, exact: confirmations[operation] ?? null, mayBeEmpty: !confirmations[operation] }
    : null
  const revisionPrecondition = kind === 'command'
    ? { required: true, nullable: true, semantics: operation === 'graph.accept' || operation === 'graph.reopen'
      ? 'Must match the currently accepted revision; null means no accepted document.'
      : 'Null is permitted for a metadata-only proposal or isolated copy.' }
    : null
  const effect = kind === 'query' ? 'read-local-memory'
    : operation === 'graph.preview' || operation === 'graph.migrationPreview' ? 'preview-local-memory'
      : operation === 'graph.migrationApply' ? 'isolated-copy-local-memory' : 'accept-local-memory'
  return {
    id: operation,
    version,
    kind,
    implemented: true,
    capabilityId: 'lan.' + operation + '@1',
    inputSchema: envelopeSchema(operation, version, kind),
    resultSchema: results[operation],
    effect,
    confirmation,
    revisionPrecondition,
    pagination: operation === 'graph.findings' ? pagination : null,
    deprecated: version === '1.0' ? {
      since: '1.1', replacementVersion: '1.1',
      compatibilityWindow: 'supported until an explicit removal release', removalDate: null,
    } : null,
    examples: { operation: 'contracts.examples', synthetic: true, dispatches: false },
  }
}

function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value !== null && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}'
  }
  return JSON.stringify(value)
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child)
    Object.freeze(value)
  }
  return value
}

function buildRegistry(version, operations) {
  const publicBytes = {
    apiVersion: version, supportedVersions: SUPPORTED_API_VERSIONS, scope, limits: contractLimits,
    operations: operations.map(operation => makeDescriptor(operation, version)),
  }
  const schemaRevision = createHash('sha256').update(canonical(publicBytes)).digest('hex')
  return deepFreeze({ ...publicBytes, schemaRevision })
}

const registries = new Map([
  ['1.0', buildRegistry('1.0', olderOperations)],
  ['1.1', buildRegistry('1.1', currentOperations)],
])
const descriptorMaps = new Map([...registries].map(([version, registry]) => [
  version, new Map(registry.operations.map(descriptor => [descriptor.id, descriptor])),
]))

function requireVersion(version) {
  if (typeof version !== 'string' || !registries.has(version)) {
    const error = new Error('Unsupported graph API version. Use 1.0 or 1.1.')
    error.name = 'ApiVersionError'
    error.code = 'API_VERSION_UNSUPPORTED'
    error.category = 'incompatible-version'
    error.statusCode = 400
    error.supportedVersions = SUPPORTED_API_VERSIONS
    throw error
  }
  return version
}

/** Fixed, immutable public contract set for an exact API version. */
export function getContractRegistry(version = API_VERSION) {
  return registries.get(requireVersion(version))
}

/** Unknown operations return null; unsupported versions are a typed refusal. */
export function getOperationDescriptor(operation, version = API_VERSION) {
  requireVersion(version)
  return typeof operation === 'string' ? (descriptorMaps.get(version).get(operation) ?? null) : null
}

/** Discovery is metadata only and never resolves a workspace or sends a request. */
export function discoveryForClient(clientVersion = API_VERSION) {
  const registry = getContractRegistry(clientVersion)
  const available = new Set(registry.operations.map(descriptor => descriptor.id))
  const unavailableOperations = [
    ...currentOperations.filter(operation => !available.has(operation)).map(operation => ({
      operation, implemented: false, kind: commands.has(operation) ? 'command' : 'query',
      capabilityId: 'lan.' + operation + '@1',
      reason: 'Available in API 1.1; unavailable in this client contract.', availableSince: '1.1',
    })),
    ...unavailablePermanent.map(item => ({
      ...item, implemented: false, kind: 'command', capabilityId: 'lan.' + item.operation + '@1',
    })),
  ]
  return deepFreeze({
    apiVersion: API_VERSION,
    clientVersion,
    compatibleVersion: clientVersion,
    supportedVersions: SUPPORTED_API_VERSIONS,
    schemaRevision: registry.schemaRevision,
    scope,
    limits: contractLimits,
    operations: registry.operations,
    unavailableOperations,
    deprecated: registry.operations.filter(descriptor => descriptor.deprecated !== null).map(descriptor => ({
      operation: descriptor.id, ...descriptor.deprecated,
    })),
  })
}
