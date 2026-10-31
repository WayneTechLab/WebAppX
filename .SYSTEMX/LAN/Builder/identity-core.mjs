import { createHash } from 'node:crypto'
import { isCanonicalSourcePath } from './source-policy.mjs'

const HEX = /^[a-f0-9]{64}$/
const ANCHOR = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/
const ID = /^(?:doc|page|node|candidate)_[a-f0-9]{64}$/
const CONFIDENCE = new Set(['explicit', 'heuristic', 'unresolved', 'reviewed-migration'])
const MAX_NODES = 1000
const MAX_ALIASES = 256
const MAX_DIAGNOSTICS = 1000
// A map with 1000 full source spans can exceed the separate 400 kB
// proposal/export transport cap. The transport layer enforces that cap.
const MAX_DIGEST_BYTES = 2_000_000

function refuse(code) {
  const error = new Error(code)
  error.code = code
  throw error
}

function object(value, code = 'IDENTITY_INVALID') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) refuse(code)
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string')) refuse(code)
  // A caller's accessor must not execute while this pure metadata layer validates it.
  if (Object.values(Object.getOwnPropertyDescriptors(value)).some(descriptor => !Object.hasOwn(descriptor, 'value'))) refuse(code)
  return value
}

function keys(value, allowed, required, code = 'IDENTITY_INVALID') {
  object(value, code)
  if (Object.keys(value).some(key => !allowed.includes(key))
    || required.some(key => !Object.hasOwn(value, key))) refuse(code)
}

function string(value, max, code, { empty = false } = {}) {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.length)
    || /[\x00-\x1f\x7f]/.test(value)) refuse(code)
  return value
}

function hash(value, code) {
  if (typeof value !== 'string' || !HEX.test(value)) refuse(code)
  return value
}

function identifier(value, prefix, code) {
  if (typeof value !== 'string' || !ID.test(value) || !value.startsWith(`${prefix}_`)) refuse(code)
  return value
}

function sourcePath(value) {
  if (!isCanonicalSourcePath(value)) refuse('IDENTITY_SOURCE_PATH_INVALID')
  return value
}

function label(value) {
  if (typeof value !== 'string' || value.length > 120 || value.includes('\0')) refuse('IDENTITY_LABEL_INVALID')
  return value
}
function tag(value) { return string(value, 120, 'IDENTITY_TAG_INVALID') }

function span(value, path, revision, field = false) {
  const allowed = field ? ['start', 'end', 'fingerprint'] : ['path', 'start', 'end', 'sourceRevision', 'fingerprint']
  keys(value, allowed, allowed, 'IDENTITY_SPAN_INVALID')
  if (!field && (sourcePath(value.path) !== path || hash(value.sourceRevision, 'IDENTITY_SPAN_INVALID') !== revision)) refuse('IDENTITY_SPAN_INVALID')
  if (!Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end)
    || value.start < 0 || value.end < value.start || value.end > 500_000) refuse('IDENTITY_SPAN_INVALID')
  hash(value.fingerprint, 'IDENTITY_SPAN_INVALID')
  return field
    ? { start: value.start, end: value.end, fingerprint: value.fingerprint }
    : { path: value.path, start: value.start, end: value.end, sourceRevision: value.sourceRevision, fingerprint: value.fingerprint }
}

function fields(value, source) {
  keys(value, ['text'], [], 'IDENTITY_FIELDS_INVALID')
  if (!Object.hasOwn(value, 'text')) return {}
  const text = span(value.text, null, null, true)
  if (text.start < source.start || text.end > source.end) refuse('IDENTITY_FIELDS_INVALID')
  return { text }
}

function definition(value) {
  keys(value, ['name', 'sourcePath'], ['name'], 'IDENTITY_DEFINITION_INVALID')
  const copy = { name: string(value.name, 120, 'IDENTITY_DEFINITION_INVALID') }
  if (Object.hasOwn(value, 'sourcePath')) copy.sourcePath = sourcePath(value.sourcePath)
  return copy
}

// JSON's insertion order is not an identity rule. Reject non-JSON values and
// cycles before hashing; reading an accessor is never part of canonicalization.
function canonical(value, active, depth) {
  if (depth > 32) refuse('IDENTITY_DIGEST_LIMIT')
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value)
  if (typeof value !== 'object') refuse('IDENTITY_DIGEST_INVALID')
  if (active.has(value)) refuse('IDENTITY_DIGEST_CYCLE')
  active.add(value)
  let result
  if (Array.isArray(value)) {
    if (value.length > 10_000 || Object.keys(value).length !== value.length) refuse('IDENTITY_DIGEST_INVALID')
    result = `[${value.map(item => canonical(item, active, depth + 1)).join(',')}]`
  } else {
    object(value, 'IDENTITY_DIGEST_INVALID')
    const sorted = Object.keys(value).sort()
    if (sorted.length > 10_000) refuse('IDENTITY_DIGEST_LIMIT')
    result = `{${sorted.map(key => `${JSON.stringify(key)}:${canonical(value[key], active, depth + 1)}`).join(',')}}`
  }
  active.delete(value)
  return result
}

export function identityDigest(value) {
  const serialized = canonical(value, new Set(), 0)
  if (Buffer.byteLength(serialized) > MAX_DIGEST_BYTES) refuse('IDENTITY_DIGEST_LIMIT')
  return createHash('sha256').update(serialized).digest('hex')
}

function safeMetadata(value, depth = 0) {
  if (depth > 8) refuse('IDENTITY_METADATA_INVALID')
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return
  if (typeof value === 'string') {
    string(value, 512, 'IDENTITY_METADATA_INVALID', { empty: true })
    if (/^(?:\/(?:Users|Volumes|private|home|tmp|var)\/|[A-Za-z]:[\\/])/.test(value)) refuse('IDENTITY_METADATA_INVALID')
    return
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_DIAGNOSTICS) refuse('IDENTITY_METADATA_INVALID')
    for (const item of value) safeMetadata(item, depth + 1)
    return
  }
  object(value, 'IDENTITY_METADATA_INVALID')
  for (const key of Object.keys(value)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(key)
      || /(?:body|content|html|dom|token|secret|password|session|absolute|private|timestamp|createdAt|updatedAt|constructor|prototype)/i.test(key)) refuse('IDENTITY_METADATA_INVALID')
    safeMetadata(value[key], depth + 1)
  }
}

function mapNode(value, path, revision) {
  const required = ['id', 'parentId', 'tag', 'anchor', 'signature', 'confidence', 'source', 'fields', 'opaque', 'external']
  keys(value, [...required, 'label', 'definition'], required, 'IDENTITY_NODE_INVALID')
  if (typeof value.id !== 'string' || !ID.test(value.id)
    || !/^(?:node|candidate)_/.test(value.id)) refuse('IDENTITY_NODE_INVALID')
  if (value.parentId !== null && (typeof value.parentId !== 'string' || !ID.test(value.parentId))) refuse('IDENTITY_PARENT_INVALID')
  tag(value.tag)
  if (value.anchor !== null && (typeof value.anchor !== 'string' || !ANCHOR.test(value.anchor))) refuse('IDENTITY_ANCHOR_INVALID')
  hash(value.signature, 'IDENTITY_SIGNATURE_INVALID')
  if (!CONFIDENCE.has(value.confidence)) refuse('IDENTITY_CONFIDENCE_INVALID')
  if ((value.confidence === 'explicit' && value.anchor === null)
    || (['heuristic', 'unresolved'].includes(value.confidence) && value.anchor !== null)
    || (value.confidence === 'unresolved' && !value.id.startsWith('candidate_'))
    || (value.confidence !== 'unresolved' && value.id.startsWith('candidate_'))) refuse('IDENTITY_CONFIDENCE_INVALID')
  if (Object.hasOwn(value, 'label')) label(value.label)
  const source = span(value.source, path, revision)
  fields(value.fields, source)
  if (typeof value.opaque !== 'boolean' || typeof value.external !== 'boolean') refuse('IDENTITY_NODE_INVALID')
  if (Object.hasOwn(value, 'definition')) definition(value.definition)
}

function validateAliases(aliases, nodeIds) {
  if (!Array.isArray(aliases) || aliases.length > MAX_ALIASES) refuse('IDENTITY_ALIAS_LIMIT')
  const targets = new Map()
  for (const alias of aliases) {
    keys(alias, ['from', 'to', 'provenance'], ['from', 'to', 'provenance'], 'IDENTITY_ALIAS_INVALID')
    if (typeof alias.from !== 'string' || !ID.test(alias.from) || !alias.from.startsWith('node_')
      || typeof alias.to !== 'string' || !ID.test(alias.to) || !alias.to.startsWith('node_')
      || nodeIds.has(alias.from) || targets.has(alias.from)) refuse('IDENTITY_ALIAS_INVALID')
    safeMetadata(alias.provenance)
    targets.set(alias.from, alias.to)
  }
  for (const from of targets.keys()) {
    const seen = new Set()
    let current = from
    for (let hops = 0; hops <= MAX_ALIASES; hops += 1) {
      if (nodeIds.has(current)) break
      if (seen.has(current)) refuse('IDENTITY_ALIAS_CYCLE')
      seen.add(current)
      current = targets.get(current)
      if (!current) refuse('IDENTITY_ALIAS_TARGET_INVALID')
      if (hops === MAX_ALIASES) refuse('IDENTITY_ALIAS_LIMIT')
    }
  }
}

export function validateIdentityMap(map, options = {}) {
  keys(options, ['workspaceId', 'sourcePath'], [], 'IDENTITY_VALIDATION_OPTIONS_INVALID')
  const { workspaceId, sourcePath: expectedPath } = options
  const required = ['schemaVersion', 'ruleVersion', 'workspaceId', 'documentId', 'pageId', 'sourcePath', 'sourceRevision', 'route', 'nodes', 'aliases', 'orphaned', 'warnings']
  keys(map, [...required, 'label'], required, 'IDENTITY_MAP_INVALID')
  if (map.schemaVersion !== 1 || map.ruleVersion !== 'identity-v1') refuse('IDENTITY_VERSION_UNSUPPORTED')
  hash(map.workspaceId, 'IDENTITY_WORKSPACE_INVALID')
  identifier(map.documentId, 'doc', 'IDENTITY_DOCUMENT_INVALID')
  identifier(map.pageId, 'page', 'IDENTITY_PAGE_INVALID')
  sourcePath(map.sourcePath)
  hash(map.sourceRevision, 'IDENTITY_SOURCE_REVISION_INVALID')
  if (workspaceId !== undefined && map.workspaceId !== hash(workspaceId, 'IDENTITY_WORKSPACE_INVALID')) refuse('IDENTITY_WORKSPACE_MISMATCH')
  if (expectedPath !== undefined && map.sourcePath !== sourcePath(expectedPath)) refuse('IDENTITY_DOCUMENT_MISMATCH')
  if (typeof map.route !== 'string' || !map.route.startsWith('/') || map.route.length > 512
    || /[\x00-\x1f\x7f]/.test(map.route)
    || /^\/(?:Users|Volumes|private|home|tmp|var)\//.test(map.route)) refuse('IDENTITY_ROUTE_INVALID')
  if (Object.hasOwn(map, 'label')) label(map.label)
  if (!Array.isArray(map.nodes) || map.nodes.length > MAX_NODES) refuse('IDENTITY_NODE_LIMIT')
  const nodes = new Map(), anchors = new Set()
  for (const node of map.nodes) {
    mapNode(node, map.sourcePath, map.sourceRevision)
    if (nodes.has(node.id)) refuse('IDENTITY_DUPLICATE_NODE')
    nodes.set(node.id, node)
    if (node.anchor !== null) {
      if (anchors.has(node.anchor)) refuse('IDENTITY_DUPLICATE_ANCHOR')
      anchors.add(node.anchor)
    }
  }
  for (const node of nodes.values()) {
    if (node.parentId !== null && !nodes.has(node.parentId)) refuse('IDENTITY_PARENT_INVALID')
    const seen = new Set()
    let current = node
    while (current) {
      if (seen.has(current.id)) refuse('IDENTITY_GRAPH_CYCLE')
      seen.add(current.id)
      current = current.parentId === null ? null : nodes.get(current.parentId)
    }
  }
  const fallbackCounts = new Map()
  for (const node of nodes.values()) {
    if (node.anchor !== null) continue
    const key = JSON.stringify([node.parentId, node.tag, node.signature])
    fallbackCounts.set(key, (fallbackCounts.get(key) ?? 0) + 1)
  }
  for (const node of nodes.values()) {
    if (node.confidence !== 'heuristic') continue
    const key = JSON.stringify([node.parentId, node.tag, node.signature])
    if (fallbackCounts.get(key) !== 1 || (node.parentId !== null && nodes.get(node.parentId).confidence === 'unresolved')) refuse('IDENTITY_AMBIGUOUS_FALLBACK')
  }
  validateAliases(map.aliases, nodes)
  if (!Array.isArray(map.orphaned) || map.orphaned.length > MAX_DIAGNOSTICS
    || !Array.isArray(map.warnings) || map.warnings.length > MAX_DIAGNOSTICS) refuse('IDENTITY_DIAGNOSTIC_LIMIT')
  for (const item of [...map.orphaned, ...map.warnings]) safeMetadata(item)
  identityDigest(map) // enforces bounded JSON-only metadata without mutating it
  return map
}

function rawNode(value, path, revision) {
  const required = ['key', 'parentKey', 'tag', 'anchor', 'signature', 'label', 'source', 'fields', 'opaque', 'external']
  keys(value, [...required, 'definition'], required, 'IDENTITY_NODE_INVALID')
  const key = string(value.key, 120, 'IDENTITY_KEY_INVALID')
  const parentKey = value.parentKey === null ? null : string(value.parentKey, 120, 'IDENTITY_PARENT_INVALID')
  const nodeTag = tag(value.tag)
  if (value.anchor !== null && (typeof value.anchor !== 'string' || !ANCHOR.test(value.anchor))) refuse('IDENTITY_ANCHOR_INVALID')
  hash(value.signature, 'IDENTITY_SIGNATURE_INVALID')
  const nodeLabel = label(value.label)
  const source = span(value.source, path, revision)
  const nodeFields = fields(value.fields, source)
  if (typeof value.opaque !== 'boolean' || typeof value.external !== 'boolean') refuse('IDENTITY_NODE_INVALID')
  return {
    key, parentKey, tag: nodeTag, anchor: value.anchor, signature: value.signature, label: nodeLabel,
    source, fields: nodeFields, opaque: value.opaque, external: value.external,
    ...(Object.hasOwn(value, 'definition') ? { definition: definition(value.definition) } : {}),
  }
}

export function createIdentityMap(input) {
  keys(input, ['workspaceId', 'sourcePath', 'sourceRevision', 'route', 'label', 'nodes', 'ruleVersion'],
    ['workspaceId', 'sourcePath', 'sourceRevision', 'nodes'], 'IDENTITY_INPUT_INVALID')
  const { workspaceId, sourcePath: path, sourceRevision, route = '/', label: documentLabel = '', nodes, ruleVersion = 'identity-v1' } = input
  hash(workspaceId, 'IDENTITY_WORKSPACE_INVALID')
  sourcePath(path)
  hash(sourceRevision, 'IDENTITY_SOURCE_REVISION_INVALID')
  if (ruleVersion !== 'identity-v1') refuse('IDENTITY_VERSION_UNSUPPORTED')
  if (typeof route !== 'string' || !route.startsWith('/') || route.length > 512
    || /[\x00-\x1f\x7f]/.test(route) || /^\/(?:Users|Volumes|private|home|tmp|var)\//.test(route)) refuse('IDENTITY_ROUTE_INVALID')
  label(documentLabel)
  if (!Array.isArray(nodes) || nodes.length > MAX_NODES) refuse('IDENTITY_NODE_LIMIT')
  const documentId = `doc_${identityDigest(['document', workspaceId, path])}`
  const pageId = `page_${identityDigest(['page', documentId])}`
  const raw = new Map(), anchors = new Set(), siblingSignatures = new Map()
  for (const input of nodes) {
    const node = rawNode(input, path, sourceRevision)
    if (raw.has(node.key)) refuse('IDENTITY_DUPLICATE_KEY')
    raw.set(node.key, node)
    if (node.anchor !== null) {
      if (anchors.has(node.anchor)) refuse('IDENTITY_DUPLICATE_ANCHOR')
      anchors.add(node.anchor)
    }
    if (node.anchor === null) {
      const siblingKey = JSON.stringify([node.parentKey, node.tag, node.signature])
      siblingSignatures.set(siblingKey, (siblingSignatures.get(siblingKey) ?? 0) + 1)
    }
  }
  for (const node of raw.values()) if (node.parentKey !== null && !raw.has(node.parentKey)) refuse('IDENTITY_PARENT_INVALID')
  const states = new Map(), allocated = new Map(), warnings = []
  function allocate(key) {
    if (states.get(key) === 1) refuse('IDENTITY_GRAPH_CYCLE')
    if (states.get(key) === 2) return allocated.get(key)
    states.set(key, 1)
    const node = raw.get(key)
    const parent = node.parentKey === null ? null : allocate(node.parentKey)
    const siblingKey = JSON.stringify([node.parentKey, node.tag, node.signature])
    const unique = siblingSignatures.get(siblingKey) === 1
    const confidence = node.anchor !== null ? 'explicit'
      : unique && (parent === null || parent.confidence !== 'unresolved') ? 'heuristic' : 'unresolved'
    const id = confidence === 'unresolved'
      ? `candidate_${identityDigest(['candidate', documentId, sourceRevision, key, node.source.start, node.source.end])}`
      : node.anchor !== null
        ? `node_${identityDigest(['explicit', documentId, node.tag, node.anchor])}`
        : `node_${identityDigest(['heuristic', documentId, parent?.id ?? null, node.tag, node.signature])}`
    const result = {
      id, parentId: parent?.id ?? null, tag: node.tag, anchor: node.anchor, signature: node.signature,
      label: node.label, confidence, source: node.source, fields: node.fields,
      opaque: node.opaque, external: node.external,
      ...(node.definition ? { definition: node.definition } : {}),
    }
    if (confidence === 'unresolved') warnings.push({ code: unique ? 'UNRESOLVED_PARENT' : 'AMBIGUOUS_FALLBACK', nodeId: id })
    states.set(key, 2)
    allocated.set(key, result)
    return result
  }
  for (const key of raw.keys()) allocate(key)
  const map = {
    schemaVersion: 1, ruleVersion, workspaceId, documentId, pageId, sourcePath: path, sourceRevision,
    route, label: documentLabel, nodes: [...raw.keys()].map(key => allocated.get(key)),
    aliases: [], orphaned: [], warnings,
  }
  return validateIdentityMap(map)
}

export function resolveIdentity(map, reference) {
  validateIdentityMap(map)
  keys(reference, ['workspaceId', 'documentId', 'nodeId'], ['workspaceId', 'documentId', 'nodeId'], 'IDENTITY_REFERENCE_INVALID')
  hash(reference.workspaceId, 'IDENTITY_REFERENCE_INVALID')
  identifier(reference.documentId, 'doc', 'IDENTITY_REFERENCE_INVALID')
  string(reference.nodeId, 160, 'IDENTITY_REFERENCE_INVALID')
  if (reference.workspaceId !== map.workspaceId) return { status: 'workspace-mismatch' }
  if (reference.documentId !== map.documentId) return { status: 'document-mismatch' }
  const nodes = new Map(map.nodes.map(node => [node.id, node]))
  const aliases = new Map(map.aliases.map(alias => [alias.from, alias.to]))
  let id = reference.nodeId
  for (let hops = 0; hops <= MAX_ALIASES; hops += 1) {
    const node = nodes.get(id)
    if (node) return node.confidence === 'unresolved' ? { status: 'ambiguous' } : { status: 'resolved', node }
    const next = aliases.get(id)
    if (!next) return { status: 'missing' }
    id = next
  }
  refuse('IDENTITY_ALIAS_LIMIT')
}
