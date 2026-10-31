import {
  API_VERSION,
  SUPPORTED_API_VERSIONS,
  discoveryForClient,
  getContractRegistry,
  getOperationDescriptor,
} from './api-contracts.mjs'
import { graphRevision } from './graph-core.mjs'

const MAX_CHANGES = 50
const PUBLIC_DESCRIPTOR_FIELDS = [
  'id', 'version', 'kind', 'implemented', 'capabilityId', 'inputSchema',
  'resultSchema', 'effect', 'confirmation', 'revisionPrecondition',
  'pagination', 'deprecated', 'examples',
]
const TOOL_FIELDS = Object.freeze({
  'contracts.list': [],
  'contracts.describe': ['operation', 'version'],
  'contracts.examples': ['operation', 'version'],
  'contracts.compatibility': ['beforeVersion', 'afterVersion'],
  'contracts.export': [],
})
const HAS_OWN = (value, key) => Object.hasOwn(value, key)

/** A contained, machine-readable refusal for direct tool callers and the HTTP adapter. */
export class ApiToolError extends Error {
  constructor(code, category, message, statusCode = 400) {
    super(message)
    this.name = 'ApiToolError'
    this.code = code
    this.category = category
    this.statusCode = statusCode
    this.findings = []
    this.omittedCount = 0
  }
}

function supportedVersion(version) {
  if (typeof version !== 'string' || !SUPPORTED_API_VERSIONS.includes(version)) {
    throw new ApiToolError(
      'API_VERSION_UNSUPPORTED', 'incompatible-version',
      `API version is unsupported. Supported versions: ${SUPPORTED_API_VERSIONS.join(', ')}.`,
    )
  }
  return version
}

function missingOperation() {
  throw new ApiToolError('OPERATION_UNAVAILABLE', 'capability', 'Operation is unavailable in the selected API version.', 404)
}

function invalidPayload() {
  throw new ApiToolError('INVALID_TOOL_PAYLOAD', 'validation', 'Contract tool payload has missing, unknown, or invalid fields.')
}

function plainDataObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  return Reflect.ownKeys(value).every((key) =>
    typeof key === 'string' && HAS_OWN(Object.getOwnPropertyDescriptor(value, key), 'value'))
}

function exactToolPayload(operation, payload) {
  if (!plainDataObject(payload)) invalidPayload()
  const allowed = TOOL_FIELDS[operation]
  if (!allowed || Object.keys(payload).some((key) => !allowed.includes(key))) invalidPayload()
  const required = operation === 'contracts.describe' || operation === 'contracts.examples'
    ? ['operation']
    : operation === 'contracts.compatibility' ? ['beforeVersion', 'afterVersion'] : []
  if (required.some((key) => !HAS_OWN(payload, key) || typeof payload[key] !== 'string')) invalidPayload()
  if (HAS_OWN(payload, 'version') && typeof payload.version !== 'string') invalidPayload()
  if (HAS_OWN(payload, 'operation') && !/^[a-z][a-zA-Z0-9.]{0,95}$/.test(payload.operation)) invalidPayload()
  return payload
}

// Registry values are static public contract definitions. Copy only their reviewed fields.
function jsonCopy(value) {
  if (value === undefined) return undefined
  return JSON.parse(JSON.stringify(value))
}

function publicDescriptor(descriptor) {
  const result = {}
  for (const field of PUBLIC_DESCRIPTOR_FIELDS) {
    if (HAS_OWN(descriptor, field)) result[field] = jsonCopy(descriptor[field])
  }
  return result
}

function publicRegistry(version) {
  const registry = getContractRegistry(supportedVersion(version))
  return {
    apiVersion: registry.apiVersion,
    supportedVersions: jsonCopy(registry.supportedVersions),
    schemaRevision: registry.schemaRevision,
    scope: jsonCopy(registry.scope),
    limits: jsonCopy(registry.limits),
    operations: registry.operations.map(publicDescriptor),
  }
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function comparableSchema(value, version) {
  if (Array.isArray(value)) return value.map((item) => comparableSchema(item, version))
  if (!value || typeof value !== 'object') return value
  const result = Object.create(null)
  for (const key of Object.keys(value)) {
    const item = value[key]
    result[key] = key === 'apiVersion' && plainDataObject(item) && item.const === version
      ? { ...item, const: '<selected-version>' }
      : comparableSchema(item, version)
  }
  return result
}

/** Return discovery for the exact selected contract. An unsupported version never falls forward. */
export function negotiateApiVersion(clientVersion = API_VERSION) {
  supportedVersion(clientVersion)
  return jsonCopy(discoveryForClient(clientVersion))
}

function changeCollector() {
  const additions = []
  const breakingChanges = []
  let additionCount = 0
  let breakingCount = 0
  return {
    add(operation, path, change) {
      additionCount += 1
      if (additions.length + breakingChanges.length < MAX_CHANGES) additions.push({ operation, path, change })
    },
    break(operation, path, change) {
      breakingCount += 1
      if (additions.length + breakingChanges.length < MAX_CHANGES) breakingChanges.push({ operation, path, change })
    },
    result() {
      return {
        additions, breakingChanges, additionCount, breakingCount,
        omittedCount: additionCount + breakingCount - additions.length - breakingChanges.length,
      }
    },
  }
}

function valuesOf(value) {
  if (value === undefined) return []
  return Array.isArray(value) ? value.map(canonical) : [canonical(value)]
}

function setDifference(before, after) {
  return before.filter((item) => !after.includes(item))
}

function diffSet(before, after, operation, path, input, changes) {
  const oldSet = valuesOf(before), newSet = valuesOf(after)
  if (setDifference(oldSet, newSet).length) {
    (input ? changes.break : changes.add)(operation, path, 'Previously permitted schema value removed')
  }
  if (setDifference(newSet, oldSet).length) {
    (input ? changes.add : changes.break)(operation, path, 'New schema value permitted')
  }
}

function diffBound(before, after, operation, path, input, lower, changes) {
  if (before === after) return
  if (before === undefined || after === undefined) {
    const tightens = before === undefined
    const breaking = input ? tightens : !tightens
    (breaking ? changes.break : changes.add)(operation, path, tightens ? 'Bound added' : 'Bound removed')
    return
  }
  const tightens = lower ? after > before : after < before
  const breaking = input ? tightens : !tightens
  (breaking ? changes.break : changes.add)(operation, path, tightens ? 'Bound tightened' : 'Bound relaxed')
}

function diffSchema(before, after, operation, path, input, changes, beforeVersion, afterVersion, depth = 0) {
  if (canonical(comparableSchema(before, beforeVersion)) === canonical(comparableSchema(after, afterVersion))) return
  if (path.endsWith('.apiVersion') && plainDataObject(before) && plainDataObject(after)
      && before.const === beforeVersion && after.const === afterVersion
      && canonical({ ...before, const: '<selected-version>' }) === canonical({ ...after, const: '<selected-version>' })) return
  if (depth > 16 || !plainDataObject(before) || !plainDataObject(after)) {
    changes.break(operation, path, 'Schema shape changed')
    return
  }
  const countBefore = changes.result().additionCount + changes.result().breakingCount
  diffSet(before.type, after.type, operation, `${path}.type`, input, changes)
  diffSet(before.enum, after.enum, operation, `${path}.enum`, input, changes)
  if (canonical(before.const) !== canonical(after.const)) {
    if (!(path.endsWith('.apiVersion') && before.const === beforeVersion && after.const === afterVersion)) {
      changes.break(operation, `${path}.const`, 'Constant changed')
    }
  }
  for (const [key, lower] of [
    ['minimum', true], ['maximum', false], ['minLength', true], ['maxLength', false],
    ['minItems', true], ['maxItems', false],
  ]) diffBound(before[key], after[key], operation, `${path}.${key}`, input, lower, changes)
  if (canonical(before.pattern) !== canonical(after.pattern)) changes.break(operation, `${path}.pattern`, 'Pattern changed')
  if (before.additionalProperties !== after.additionalProperties) {
    const wasOpen = before.additionalProperties !== false
    const nowOpen = after.additionalProperties !== false
    const additive = input ? !wasOpen && nowOpen : wasOpen && !nowOpen
    (additive ? changes.add : changes.break)(operation, `${path}.additionalProperties`, 'Additional property rule changed')
  }
  const oldRequired = new Set(before.required || []), newRequired = new Set(after.required || [])
  const oldProps = before.properties || {}, newProps = after.properties || {}
  for (const key of Object.keys(oldProps).sort()) {
    if (!HAS_OWN(newProps, key)) {
      changes.break(operation, `${path}.properties.${key}`, 'Property removed')
    } else {
      if (oldRequired.has(key) !== newRequired.has(key)) {
        const requiredNow = newRequired.has(key)
        (input === requiredNow ? changes.break : changes.add)(operation, `${path}.required.${key}`, requiredNow ? 'Property now required' : 'Property now optional')
      }
      diffSchema(oldProps[key], newProps[key], operation, `${path}.properties.${key}`, input, changes, beforeVersion, afterVersion, depth + 1)
    }
  }
  for (const key of Object.keys(newProps).sort()) {
    if (!HAS_OWN(oldProps, key)) {
      const breaks = input && newRequired.has(key)
      (breaks ? changes.break : changes.add)(operation, `${path}.properties.${key}`, breaks ? 'New required input property' : 'Property added')
    }
  }
  if (before.items || after.items) {
    diffSchema(before.items, after.items, operation, `${path}.items`, input, changes, beforeVersion, afterVersion, depth + 1)
  }
  const oldAlternatives = valuesOf(before.oneOf), newAlternatives = valuesOf(after.oneOf)
  if (setDifference(oldAlternatives, newAlternatives).length) {
    (input ? changes.break : changes.add)(operation, `${path}.oneOf`, 'Schema alternative removed')
  }
  if (setDifference(newAlternatives, oldAlternatives).length) {
    (input ? changes.add : changes.break)(operation, `${path}.oneOf`, 'Schema alternative added')
  }
  if (changes.result().additionCount + changes.result().breakingCount === countBefore) {
    changes.break(operation, path, 'Schema changed')
  }
}

/** Compare reviewed public contract schemas; omission counts are for findings, never hidden changes. */
export function compareApiContracts(beforeVersion, afterVersion) {
  const before = publicRegistry(beforeVersion), after = publicRegistry(afterVersion)
  const changes = changeCollector()
  const oldOperations = new Map(before.operations.map((entry) => [entry.id, entry]))
  const newOperations = new Map(after.operations.map((entry) => [entry.id, entry]))
  for (const id of [...oldOperations.keys()].sort()) {
    if (!newOperations.has(id)) {
      changes.break(id, 'operation', 'Operation removed')
      continue
    }
    const oldEntry = oldOperations.get(id), newEntry = newOperations.get(id)
    if (oldEntry.implemented && !newEntry.implemented) changes.break(id, 'implemented', 'Operation became unavailable')
    if (!oldEntry.implemented && newEntry.implemented) changes.add(id, 'implemented', 'Operation became available')
    if (!oldEntry.implemented || !newEntry.implemented) continue
    for (const field of ['kind', 'capabilityId', 'effect', 'confirmation', 'revisionPrecondition', 'pagination']) {
      if (canonical(oldEntry[field]) !== canonical(newEntry[field])) changes.break(id, field, 'Operation contract changed')
    }
    diffSchema(oldEntry.inputSchema, newEntry.inputSchema, id, 'inputSchema', true, changes, beforeVersion, afterVersion)
    diffSchema(oldEntry.resultSchema, newEntry.resultSchema, id, 'resultSchema', false, changes, beforeVersion, afterVersion)
  }
  for (const id of [...newOperations.keys()].sort()) {
    if (!oldOperations.has(id)) changes.add(id, 'operation', 'Operation added')
  }
  return {
    beforeVersion, afterVersion,
    beforeSchemaRevision: before.schemaRevision, afterSchemaRevision: after.schemaRevision,
    ...changes.result(),
  }
}

function exampleGraph() {
  return {
    schemaVersion: 1, workspaceId: 'a'.repeat(64), documentId: 'ExampleDocument', sourceRevision: null,
    pages: [{ id: 'ExamplePage', rootId: 'ExampleRoot', route: '/example' }],
    nodes: [{
      id: 'ExampleRoot', kind: 'element', parentId: null, childIds: [], label: 'Example',
      ownership: 'read-only', source: null, opaqueReason: null,
    }],
    references: [], components: [], collections: [], extensions: {},
  }
}

function examplePayload(operation) {
  const type = operation
  switch (operation) {
    case 'graph.status': return { type }
    case 'graph.document':
    case 'graph.export': return { type, documentId: 'ExampleDocument' }
    case 'graph.findings': return { type, documentId: 'ExampleDocument', offset: 0, limit: 20 }
    case 'graph.lookup': return { type, workspaceId: 'a'.repeat(64), documentId: 'ExampleDocument', id: 'ExampleRoot', kind: 'node' }
    case 'graph.compare': return { type, documentId: 'ExampleDocument', beforeRevision: 'a'.repeat(64), afterRevision: 'b'.repeat(64) }
    case 'graph.preview': return { type, identityDocumentId: 'ExampleDocument' }
    case 'graph.accept':
    case 'graph.migrationApply': return { type, digest: 'a'.repeat(64) }
    case 'graph.reopen': {
      const graph = exampleGraph()
      return { type, document: { format: 'webappx-graph', formatVersion: 1, revision: graphRevision(graph), document: graph } }
    }
    case 'graph.migrationPreview': {
      const { pages, nodes, ...rest } = exampleGraph()
      return { type, targetVersion: 1, document: {
        ...rest, schemaVersion: 0, page: pages[0], nodes: nodes.map(({ childIds, ...node }) => node),
      } }
    }
    case 'contracts.list':
    case 'contracts.export': return { type }
    case 'contracts.describe':
    case 'contracts.examples': return { type, operation: 'graph.status' }
    case 'contracts.compatibility': return { type, beforeVersion: '1.0', afterVersion: '1.1' }
    default: return missingOperation()
  }
}

/** Show schema-valid synthetic envelopes; neither example is sent or persisted. */
export function contractExamples(options = {}) {
  if (!plainDataObject(options) || Object.keys(options).some((key) => !['operation', 'version'].includes(key))) invalidPayload()
  const operation = options.operation
  const version = HAS_OWN(options, 'version') ? options.version : API_VERSION
  supportedVersion(version)
  if (typeof operation !== 'string') invalidPayload()
  const descriptor = getOperationDescriptor(operation, version)
  if (!descriptor || !descriptor.implemented) missingOperation()
  const payload = examplePayload(operation)
  const validRequest = descriptor.kind === 'query'
    ? { apiVersion: version, requestId: 'example-request', kind: 'query', operation, payload }
    : {
        apiVersion: version, requestId: 'example-request', kind: 'command', operation,
        capabilityId: descriptor.capabilityId, payload,
        confirmation: ({ 'graph.accept': 'ACCEPT GRAPH', 'graph.reopen': 'REOPEN GRAPH',
          'graph.migrationApply': 'MIGRATE GRAPH COPY' })[operation] || '',
        expectedRevision: null,
      }
  const invalidRequest = jsonCopy(validRequest)
  invalidRequest.payload.unexpectedField = true
  return { apiVersion: version, schemaRevision: getContractRegistry(version).schemaRevision, operation, validRequest, invalidRequest }
}

/** A deterministic archive of reviewed public metadata only. */
export function exportPublicContracts(version = API_VERSION) {
  const registry = publicRegistry(version)
  return {
    format: 'webappx-api-contracts', formatVersion: 1, ...registry,
    capabilities: registry.operations.filter((entry) => entry.capabilityId).map((entry) => ({
      id: entry.capabilityId, operation: entry.id, kind: entry.kind, implemented: entry.implemented,
    })),
  }
}

/** Explicit local query dispatch. The HTTP validator has already removed payload.type. */
export function dispatchContractTool(operation, payload, version = API_VERSION) {
  supportedVersion(version)
  if (typeof operation !== 'string' || !HAS_OWN(TOOL_FIELDS, operation)) missingOperation()
  const descriptor = getOperationDescriptor(operation, version)
  if (!descriptor || !descriptor.implemented || descriptor.kind !== 'query') missingOperation()
  exactToolPayload(operation, payload)
  switch (operation) {
    case 'contracts.list': return publicRegistry(version)
    case 'contracts.describe': {
      const selected = HAS_OWN(payload, 'version') ? payload.version : version
      supportedVersion(selected)
      const target = getOperationDescriptor(payload.operation, selected)
      if (!target) missingOperation()
      return publicDescriptor(target)
    }
    case 'contracts.examples': return contractExamples({ operation: payload.operation, version: HAS_OWN(payload, 'version') ? payload.version : version })
    case 'contracts.compatibility': return compareApiContracts(payload.beforeVersion, payload.afterVersion)
    case 'contracts.export': return exportPublicContracts(version)
    default: return missingOperation()
  }
}
