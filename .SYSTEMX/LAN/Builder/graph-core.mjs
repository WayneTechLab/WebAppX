import { createHash } from 'node:crypto'
import { types } from 'node:util'

/** Hard limits for the schema 1 metadata graph. `depth` bounds JSON nesting here;
 * node ancestry depth is checked by graph-validation. Bytes are UTF-8 JSON bytes. */
export const graphLimits = Object.freeze({
  bytes: 400_000, nodes: 1_000, pages: 50, references: 2_000,
  depth: 64, components: 200, collections: 200, findings: 50,
  label: 120, extensionDepth: 5, extensionBytes: 16_384, entries: 50_000,
})

const ID = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/
const HASH = /^[a-f0-9]{64}$/
const SOURCE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]*$/
const ROOT_FIELDS = ['schemaVersion', 'workspaceId', 'documentId', 'sourceRevision', 'pages', 'nodes', 'references', 'components', 'collections', 'extensions']
const PAGE_FIELDS = ['id', 'rootId', 'route']
const NODE_FIELDS = ['id', 'kind', 'parentId', 'childIds', 'label', 'ownership', 'source', 'opaqueReason']
const REF_FIELDS = ['id', 'kind', 'documentId', 'targetId', 'expectedVersion', 'expectedSchemaId', 'required']
const COMPONENT_FIELDS = ['id', 'version', 'rootId']
const COLLECTION_FIELDS = ['id', 'schemaId', 'version']
const SOURCE_FIELDS = ['path', 'sourceRevision', 'start', 'end', 'fingerprint']
const RUNTIME_NAMES = new Set([
  'runtime', 'dom', 'domhandle', 'elementhandle', 'liveelement', 'nodehandle',
  'pid', 'processid', 'process', 'session', 'sessionid', 'sessiontoken',
  'token', 'accesstoken', 'refreshtoken', 'secret', 'apikey', 'credential',
  'authorization', 'authheader', 'cookie', 'previewcoordinates', 'previewx',
  'previewy', 'screenx', 'screeny', 'timestamp', 'createdat', 'updatedat',
  'hostname', 'hostpath', 'cwd', 'absolutepath', 'localpath', 'sourcebody',
  'htmlbody', 'jsxbody', 'script', 'command', 'callback', 'handler',
  'executable', 'execute', 'eval', 'function', 'code', 'action', 'operation',
  'time', 'date', 'observedat', 'eventtime', 'machineid', 'host', 'port',
  'sourcetext', 'sourcecode', 'html', 'jsx', 'markup', 'body', 'content',
])

/** A contained, typed refusal. Diagnostics contain fixed messages, never input. */
export class GraphError extends Error {
  constructor(code, message, { category = 'validation', statusCode = 400, findings = [], omittedCount = 0 } = {}) {
    super(message)
    this.name = 'GraphError'
    this.code = code
    this.category = category
    this.statusCode = statusCode
    this.findings = findings.slice(0, graphLimits.findings)
    this.omittedCount = omittedCount + Math.max(0, findings.length - graphLimits.findings)
  }
}

function refuse(code, message, options = {}) {
  const finding = { id: `graph_${code.toLowerCase()}`, code, severity: 'error',
    objectId: null, referenceType: null, message }
  throw new GraphError(code, message, { ...options, findings: [finding] })
}

function byteLimit(bytes) {
  if (bytes > graphLimits.bytes) refuse('GRAPH_BYTE_LIMIT', 'Graph exceeds the 400000-byte JSON limit.', { statusCode: 413 })
}

/** Encode JSON with recursive UTF-16 key ordering, no implicit `toJSON`, accessors,
 * coercion, sparse arrays, prototype keys, or non-JSON values. Array order is kept.
 * This helper does not sort graph collections; `normalizeGraph` does that. */
export function canonicalJson(value) {
  const chunks = []
  const active = new WeakSet()
  let bytes = 0
  let entries = 0
  const append = part => { bytes += Buffer.byteLength(part, 'utf8'); byteLimit(bytes); chunks.push(part) }
  function write(item, depth) {
    if (depth > graphLimits.depth) refuse('GRAPH_DEPTH_LIMIT', 'JSON nesting exceeds the depth limit.', { statusCode: 413 })
    if (item === null) { append('null'); return }
    if (typeof item === 'string') { append(JSON.stringify(item)); return }
    if (typeof item === 'boolean') { append(item ? 'true' : 'false'); return }
    if (typeof item === 'number' && Number.isFinite(item)) { append(JSON.stringify(item)); return }
    if (typeof item !== 'object') refuse('GRAPH_JSON_INVALID', 'Graph contains a non-JSON value.')
    if (types.isProxy(item)) refuse('GRAPH_JSON_INVALID', 'Graph contains a proxy object.')
    if (active.has(item)) refuse('GRAPH_JSON_CYCLE', 'Graph JSON contains a cycle.')
    if (!Array.isArray(item) && ![Object.prototype, null].includes(Object.getPrototypeOf(item))) {
      refuse('GRAPH_JSON_INVALID', 'Graph contains a non-plain object.')
    }
    active.add(item)
    if (Array.isArray(item)) {
      if (item.length > graphLimits.entries) refuse('GRAPH_ENTRY_LIMIT', 'JSON array exceeds the entry limit.', { statusCode: 413 })
      const keys = Reflect.ownKeys(item)
      if (keys.length !== item.length + 1) refuse('GRAPH_JSON_INVALID', 'Graph contains a sparse or decorated array.')
      entries += item.length
      if (entries > graphLimits.entries) refuse('GRAPH_ENTRY_LIMIT', 'JSON exceeds the entry limit.', { statusCode: 413 })
      append('[')
      for (let index = 0; index < item.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item, String(index))
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
          refuse('GRAPH_JSON_INVALID', 'Graph contains a sparse or accessor array.')
        }
        if (index) append(',')
        write(descriptor.value, depth + 1)
      }
      append(']')
    } else {
      const keys = Reflect.ownKeys(item)
      if (keys.length > graphLimits.entries) refuse('GRAPH_ENTRY_LIMIT', 'JSON object exceeds the entry limit.', { statusCode: 413 })
      entries += keys.length
      if (entries > graphLimits.entries) refuse('GRAPH_ENTRY_LIMIT', 'JSON exceeds the entry limit.', { statusCode: 413 })
      if (keys.some(key => typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key))) {
        refuse('GRAPH_JSON_INVALID', 'Graph contains an unsafe object key.')
      }
      keys.sort()
      append('{')
      for (let index = 0; index < keys.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(item, keys[index])
        if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) {
          refuse('GRAPH_JSON_INVALID', 'Graph contains an accessor or hidden field.')
        }
        if (index) append(',')
        append(JSON.stringify(keys[index])); append(':')
        write(descriptor.value, depth + 1)
      }
      append('}')
    }
    active.delete(item)
  }
  write(value, 0)
  return chunks.join('')
}

function object(value, fields, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    refuse('GRAPH_SHAPE_INVALID', `${name} must be an object.`)
  }
  const keys = Object.keys(value)
  if (keys.length !== fields.length || fields.some(field => !Object.hasOwn(value, field))) {
    refuse('GRAPH_SHAPE_INVALID', `${name} has missing or unsupported fields.`)
  }
  return value
}

function array(value, limit, name) {
  if (!Array.isArray(value)) refuse('GRAPH_SHAPE_INVALID', `${name} must be an array.`)
  if (value.length > limit) refuse('GRAPH_COLLECTION_LIMIT', `${name} exceeds its ${limit}-item limit.`, { statusCode: 413 })
  return value
}

function identifier(value, name) {
  if (typeof value !== 'string' || !ID.test(value)) refuse('GRAPH_IDENTIFIER_INVALID', `${name} must be an ASCII identifier.`)
  return value
}

function hash(value, name) {
  if (typeof value !== 'string' || !HASH.test(value)) refuse('GRAPH_HASH_INVALID', `${name} must be a lowercase SHA-256 hex digest.`)
  return value
}

function boundedString(value, name, max, { nullable = false, empty = false } = {}) {
  if (nullable && value === null) return null
  if (typeof value !== 'string' || value.length > max || (!empty && !value.length) || /[\x00-\x1f\x7f]/.test(value)) {
    refuse('GRAPH_STRING_INVALID', `${name} must be a bounded plain string${nullable ? ' or null' : ''}.`)
  }
  return value
}

function sourcePath(value) {
  if (typeof value !== 'string' || !value.length || value.length > 512 || /[%\\:\x00-\x20\x7f]/.test(value)
    || value.startsWith('/') || !value.split('/').every(segment => segment !== '.' && segment !== '..' && SOURCE_SEGMENT.test(segment))) {
    refuse('GRAPH_SOURCE_PATH_INVALID', 'Source path must use canonical contained repository-relative syntax.')
  }
  return value
}

function sourceRef(value) {
  if (value === null) return null
  object(value, SOURCE_FIELDS, 'Source reference')
  sourcePath(value.path)
  hash(value.sourceRevision, 'Source revision')
  hash(value.fingerprint, 'Source fingerprint')
  if (!Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end)
    || value.start < 0 || value.end < value.start) {
    refuse('GRAPH_SOURCE_SPAN_INVALID', 'Source span must use nonnegative UTF-16 offsets with an exclusive end.')
  }
  return { ...value }
}

function rejectPrivate(value, depth = 0) {
  if (typeof value === 'string') {
    if (/(?:^|[\s='"(])\/(?:Users|home|private|Volumes|var|tmp|etc|root|mnt|opt)(?:\/|\b)/i.test(value)
      || /(?:^|[\s='"(])[A-Za-z]:[\\/]/.test(value) || /\\\\[^\\\s]+\\/.test(value)
      || /file:\/\//i.test(value) || /\bBearer\s+\S+/i.test(value)
      || /\bsk-[A-Za-z0-9_-]{8,}\b/.test(value)
      || /\bgh[pousr]_[A-Za-z0-9]{20,}\b/.test(value)
      || /\bAIza[0-9A-Za-z_-]{20,}\b/.test(value)
      || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value)
      || /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(value)
      || /\b(?:javascript|data:text\/html):/i.test(value) || /<script\b/i.test(value)) {
      refuse('GRAPH_PRIVATE_FIELD', 'Graph contains private, runtime, or executable metadata.')
    }
    return
  }
  if (value === null || typeof value !== 'object') return
  if (depth > graphLimits.depth) refuse('GRAPH_DEPTH_LIMIT', 'JSON nesting exceeds the depth limit.', { statusCode: 413 })
  if (Array.isArray(value)) { for (const item of value) rejectPrivate(item, depth + 1); return }
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.replace(/[^A-Za-z0-9]/g, '').toLowerCase()
    if (RUNTIME_NAMES.has(normalized) || /^(?:runtime|dom|process|session|token|secret|credential|preview|temporary|ephemeral)/.test(normalized)
      || /^on[A-Z]/.test(key)) {
      refuse('GRAPH_RUNTIME_FIELD', 'Graph contains a runtime or executable field.')
    }
    rejectPrivate(item, depth + 1)
  }
}

function extensionValue(value, depth = 0) {
  if (depth > graphLimits.extensionDepth) {
    refuse('GRAPH_EXTENSION_DEPTH', 'Reviewed extension metadata exceeds depth 5.', { statusCode: 413 })
  }
  if (value && typeof value === 'object') {
    for (const item of Array.isArray(value) ? value : Object.values(value)) extensionValue(item, depth + 1)
  }
}

function sortById(records) {
  return records.sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1
    : canonicalJson(left) < canonicalJson(right) ? -1 : canonicalJson(left) > canonicalJson(right) ? 1 : 0)
}

/** Strictly validate and copy the independent graph read model. Collections sort
 * by ID, while `childIds` retain their declared sibling order. This layer never
 * repairs relationships or accepts state; graph-validation owns those checks. */
export function normalizeGraph(input) {
  // Serialize first to reject accessors, cycles, prototypes, huge input and
  // non-JSON data without invoking caller-defined code or mutating the caller.
  const graph = JSON.parse(canonicalJson(input))
  rejectPrivate(graph)
  object(graph, ROOT_FIELDS, 'Graph')
  if (graph.schemaVersion !== 1) {
    refuse('GRAPH_SCHEMA_UNSUPPORTED', 'Only graph schema version 1 is supported; use a reviewed migration for another version.',
      { category: 'incompatible-version' })
  }
  hash(graph.workspaceId, 'Workspace ID')
  identifier(graph.documentId, 'Document ID')
  if (graph.sourceRevision !== null) hash(graph.sourceRevision, 'Source revision')
  const pages = array(graph.pages, graphLimits.pages, 'Pages').map(page => {
    object(page, PAGE_FIELDS, 'Page')
    return { id: identifier(page.id, 'Page ID'), rootId: identifier(page.rootId, 'Page root ID'),
      route: boundedString(page.route, 'Page route', 512, { nullable: true, empty: true }) }
  })
  const nodes = array(graph.nodes, graphLimits.nodes, 'Nodes').map(node => {
    object(node, NODE_FIELDS, 'Node')
    if (!['element', 'opaque', 'component-instance', 'document-root'].includes(node.kind)) {
      refuse('GRAPH_NODE_KIND_INVALID', 'Node kind is unsupported.')
    }
    if (!['source-owned', 'read-only'].includes(node.ownership)) {
      refuse('GRAPH_OWNERSHIP_INVALID', 'Node ownership is unsupported.')
    }
    if (node.kind === 'document-root' && (node.source !== null || node.ownership !== 'read-only')) {
      refuse('GRAPH_DOCUMENT_ROOT_INVALID', 'A document-root wrapper must be read-only with no source span.')
    }
    const childIds = array(node.childIds, graphLimits.nodes, 'Child IDs').map(id => identifier(id, 'Child ID'))
    return { id: identifier(node.id, 'Node ID'), kind: node.kind,
      parentId: node.parentId === null ? null : identifier(node.parentId, 'Parent ID'),
      childIds, label: boundedString(node.label, 'Node label', graphLimits.label, { empty: true }),
      ownership: node.ownership, source: sourceRef(node.source),
      opaqueReason: boundedString(node.opaqueReason, 'Opaque reason', 512, { nullable: true, empty: true }) }
  })
  const references = array(graph.references, graphLimits.references, 'References').map(reference => {
    object(reference, REF_FIELDS, 'Reference')
    if (!['node', 'component', 'collection'].includes(reference.kind)) {
      refuse('GRAPH_REFERENCE_KIND_INVALID', 'Reference kind is unsupported.')
    }
    if (typeof reference.required !== 'boolean') refuse('GRAPH_SHAPE_INVALID', 'Reference required must be boolean.')
    return { id: identifier(reference.id, 'Reference ID'), kind: reference.kind,
      documentId: identifier(reference.documentId, 'Reference document ID'),
      targetId: identifier(reference.targetId, 'Reference target ID'),
      expectedVersion: boundedString(reference.expectedVersion, 'Expected version', 120, { nullable: true }),
      expectedSchemaId: boundedString(reference.expectedSchemaId, 'Expected schema ID', 512, { nullable: true }),
      required: reference.required }
  })
  const components = array(graph.components, graphLimits.components, 'Components').map(component => {
    object(component, COMPONENT_FIELDS, 'Component')
    return { id: identifier(component.id, 'Component ID'),
      version: boundedString(component.version, 'Component version', 120),
      rootId: identifier(component.rootId, 'Component root ID') }
  })
  const collections = array(graph.collections, graphLimits.collections, 'Collections').map(collection => {
    object(collection, COLLECTION_FIELDS, 'Collection')
    return { id: identifier(collection.id, 'Collection ID'),
      schemaId: boundedString(collection.schemaId, 'Collection schema ID', 512),
      version: boundedString(collection.version, 'Collection version', 120) }
  })
  if (graph.extensions === null || typeof graph.extensions !== 'object' || Array.isArray(graph.extensions)) {
    refuse('GRAPH_EXTENSION_INVALID', 'Extensions must be an object.')
  }
  const extensionNames = Object.keys(graph.extensions)
  if (extensionNames.some(name => name !== 'org.webappx.readonly')) {
    refuse('GRAPH_EXTENSION_NAMESPACE_UNSUPPORTED', 'Extension namespace is not reviewed for read-only graph metadata.')
  }
  if (extensionNames.length) {
    extensionValue(graph.extensions['org.webappx.readonly'])
    if (Buffer.byteLength(canonicalJson(graph.extensions['org.webappx.readonly']), 'utf8') > graphLimits.extensionBytes) {
      refuse('GRAPH_EXTENSION_BYTE_LIMIT', 'Reviewed extension metadata exceeds 16384 bytes.', { statusCode: 413 })
    }
  }
  const normalized = { schemaVersion: 1, workspaceId: graph.workspaceId,
    documentId: graph.documentId, sourceRevision: graph.sourceRevision,
    pages: sortById(pages), nodes: sortById(nodes), references: sortById(references),
    components: sortById(components), collections: sortById(collections),
    extensions: graph.extensions }
  byteLimit(Buffer.byteLength(canonicalJson(normalized), 'utf8'))
  return normalized
}

/** Deterministic schema 1 JSON bytes, with no time or machine fields. */
export function serializeGraph(input) { return canonicalJson(normalizeGraph(input)) }

/** SHA-256 of the canonical serialized graph, without a prefix. */
export function graphRevision(input) { return createHash('sha256').update(serializeGraph(input)).digest('hex') }
