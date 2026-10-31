import { createHash } from 'node:crypto'
import { GraphError, canonicalJson } from './graph-core.mjs'
import { validateGraph } from './graph-validation.mjs'

const HEX64 = /^[a-f0-9]{64}$/
const MAX_GRAPH_BYTES = 400000
const MAX_ENVELOPE_BYTES = 410000
const MAX_DEPTH = 64
const MAX_ENTRIES = 60000
const MAX_RESULTS_PER_KIND = 50
const COLLECTIONS = Object.freeze([
  ['page', 'pages'],
  ['node', 'nodes'],
  ['reference', 'references'],
  ['component', 'components'],
  ['collection', 'collections'],
])
const LEGACY_ROOT_FIELDS = Object.freeze(['schemaVersion', 'workspaceId', 'documentId', 'sourceRevision', 'page', 'nodes', 'references', 'components', 'collections', 'extensions'])
const LEGACY_PAGE_FIELDS = Object.freeze(['id', 'rootId', 'route'])
const LEGACY_NODE_FIELDS = Object.freeze(['id', 'kind', 'parentId', 'label', 'ownership', 'source', 'opaqueReason'])
const REFERENCE_FIELDS = Object.freeze(['id', 'kind', 'documentId', 'targetId', 'expectedVersion', 'expectedSchemaId', 'required'])
const COMPONENT_FIELDS = Object.freeze(['id', 'version', 'rootId'])
const COLLECTION_FIELDS = Object.freeze(['id', 'schemaId', 'version'])
const SOURCE_FIELDS = Object.freeze(['path', 'sourceRevision', 'start', 'end', 'fingerprint'])
const MIGRATION_STEPS = Object.freeze([
  Object.freeze({ order: 1, operation: 'page-list-conversion', description: 'Convert the legacy page to the one-item pages list.' }),
  Object.freeze({ order: 2, operation: 'child-order-derivation', description: 'Derive each node childIds list from legacy node-array order.' }),
  Object.freeze({ order: 3, operation: 'schema-version-0-to-1', description: 'Set schemaVersion to 1 in the isolated copy.' }),
  Object.freeze({ order: 4, operation: 'graph-validation', description: 'Validate the complete schema 1 graph before returning the copy.' }),
])

function refuse(code, message, category = 'validation', statusCode = 400, findings = [], omittedCount = 0) {
  throw new GraphError(code, message, { category, statusCode, findings, omittedCount })
}

function isRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

// Copy first: no caller-owned objects, custom prototypes, accessors, sparse arrays,
// functions or non-JSON values are allowed into migration/export envelopes.
function boundedJsonCopy(input, maxBytes = MAX_ENVELOPE_BYTES) {
  const ancestors = new WeakSet()
  let entries = 0
  let bytes = 0
  function count(serializedBytes) {
    bytes += serializedBytes
    if (bytes > maxBytes) refuse('GRAPH_INPUT_LIMIT', 'Graph input exceeds its byte limit.')
  }
  function visit(value, depth) {
    if (depth > MAX_DEPTH || ++entries > MAX_ENTRIES) refuse('GRAPH_INPUT_LIMIT', 'Graph input exceeds its depth or entry limit.')
    if (value === null || typeof value === 'boolean') {
      count(value === null ? 4 : value ? 4 : 5)
      return value
    }
    if (typeof value === 'string') {
      if (Buffer.byteLength(value, 'utf8') > maxBytes) refuse('GRAPH_INPUT_LIMIT', 'Graph input exceeds its byte limit.')
      count(Buffer.byteLength(JSON.stringify(value), 'utf8'))
      return value
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      count(Buffer.byteLength(JSON.stringify(value), 'utf8'))
      return value
    }
    if (typeof value !== 'object') refuse('GRAPH_INPUT_INVALID', 'Graph input must contain only JSON values.')
    if (ancestors.has(value)) refuse('GRAPH_INPUT_CYCLE', 'Graph input contains a cycle.')
    ancestors.add(value)
    count(2)
    let result
    if (Array.isArray(value)) {
      if (value.length > MAX_ENTRIES) refuse('GRAPH_INPUT_LIMIT', 'Graph input exceeds its entry limit.')
      result = []
      const keys = Reflect.ownKeys(value)
      if (keys.some(key => key !== 'length' && (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) {
        refuse('GRAPH_INPUT_INVALID', 'Graph arrays may contain only indexed JSON values.')
      }
      for (let index = 0; index < value.length; index++) {
        if (index) count(1)
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor || !Object.hasOwn(descriptor, 'value')) refuse('GRAPH_INPUT_INVALID', 'Graph arrays must be dense data arrays.')
        result.push(visit(descriptor.value, depth + 1))
      }
    } else {
      if (!isRecord(value)) refuse('GRAPH_INPUT_INVALID', 'Graph input must use plain JSON objects.')
      result = {}
      let fieldIndex = 0
      for (const key of Reflect.ownKeys(value)) {
        if (typeof key !== 'string' || key === '__proto__' || key === 'prototype' || key === 'constructor') {
          refuse('GRAPH_INPUT_INVALID', 'Graph input contains an unsafe object key.')
        }
        if (Buffer.byteLength(key, 'utf8') > maxBytes) refuse('GRAPH_INPUT_LIMIT', 'Graph input exceeds its byte limit.')
        const descriptor = Object.getOwnPropertyDescriptor(value, key)
        if (!descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) refuse('GRAPH_INPUT_INVALID', 'Graph input must contain only enumerable data fields.')
        count((fieldIndex++ ? 1 : 0) + Buffer.byteLength(JSON.stringify(key), 'utf8') + 1)
        result[key] = visit(descriptor.value, depth + 1)
      }
    }
    ancestors.delete(value)
    return result
  }
  const copy = visit(input, 0)
  return copy
}

function exactFields(value, fields, location, unsupported, shapeCode = 'GRAPH_LEGACY_SHAPE') {
  if (!isRecord(value)) refuse(shapeCode, `${location} must be an object.`)
  const allowed = new Set(fields)
  for (const field of Object.keys(value)) {
    if (allowed.has(field)) continue
    const safeField = /^[A-Za-z][A-Za-z0-9_-]{0,59}$/.test(field) ? field : '<unrecognized>'
    unsupported.push(`${location}.${safeField}`)
  }
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) refuse(shapeCode, `${location} is missing required field ${field}.`)
  }
}

function requireExactFields(value, fields, location) {
  const unsupported = []
  exactFields(value, fields, location, unsupported, 'GRAPH_ENVELOPE_SHAPE')
  if (unsupported.length) refuse('GRAPH_FIELD_UNSUPPORTED', `${location} contains an unsupported field.`)
}

function legacyShape(input) {
  const unsupported = []
  exactFields(input, LEGACY_ROOT_FIELDS, 'document', unsupported)
  exactFields(input.page, LEGACY_PAGE_FIELDS, 'page', unsupported)
  if (!Array.isArray(input.nodes) || !Array.isArray(input.references) || !Array.isArray(input.components) || !Array.isArray(input.collections)) {
    refuse('GRAPH_LEGACY_SHAPE', 'Legacy graph collections must be arrays.')
  }
  if (input.nodes.length > 1000 || input.references.length > 2000 || input.components.length > 200 || input.collections.length > 200) {
    refuse('GRAPH_INPUT_LIMIT', 'Legacy graph exceeds a declared collection limit.')
  }
  input.nodes.forEach((node, index) => {
    exactFields(node, LEGACY_NODE_FIELDS, `nodes[${index}]`, unsupported)
    if (node.source !== null) exactFields(node.source, SOURCE_FIELDS, `nodes[${index}].source`, unsupported)
  })
  input.references.forEach((reference, index) => exactFields(reference, REFERENCE_FIELDS, `references[${index}]`, unsupported))
  input.components.forEach((component, index) => exactFields(component, COMPONENT_FIELDS, `components[${index}]`, unsupported))
  input.collections.forEach((collection, index) => exactFields(collection, COLLECTION_FIELDS, `collections[${index}]`, unsupported))
  if (unsupported.length) {
    unsupported.sort()
    const findings = unsupported.slice(0, MAX_RESULTS_PER_KIND).map((field, index) => ({
      id: `unsupported-${index + 1}`, code: 'GRAPH_LEGACY_FIELD_UNSUPPORTED', severity: 'error',
      objectId: null, referenceType: null, message: `Unsupported legacy field ${field}.`,
    }))
    refuse('GRAPH_LEGACY_FIELD_UNSUPPORTED', 'Legacy graph has unsupported fields; no migration copy was produced.', 'validation', 400, findings, unsupported.length - findings.length)
  }
}

function migrationDigest(preview) {
  const reviewed = {
    fromVersion: preview.fromVersion,
    toVersion: preview.toVersion,
    steps: preview.steps,
    unsupportedFields: preview.unsupportedFields,
    document: preview.document,
  }
  return createHash('sha256').update(canonicalJson(reviewed)).digest('hex')
}

function listChanges(before, after) {
  const result = { added: [], removed: [], changed: [], reordered: [] }
  if (canonicalJson({ schemaVersion: before.schemaVersion, workspaceId: before.workspaceId, documentId: before.documentId, sourceRevision: before.sourceRevision, extensions: before.extensions }) !==
      canonicalJson({ schemaVersion: after.schemaVersion, workspaceId: after.workspaceId, documentId: after.documentId, sourceRevision: after.sourceRevision, extensions: after.extensions })) {
    result.changed.push({ kind: 'document', id: before.documentId })
  }
  for (const [kind, field] of COLLECTIONS) {
    const oldItems = new Map(before[field].map(item => [item.id, item]))
    const newItems = new Map(after[field].map(item => [item.id, item]))
    for (const [id, oldItem] of oldItems) {
      const newItem = newItems.get(id)
      if (!newItem) {
        result.removed.push({ kind, id })
        continue
      }
      if (kind !== 'node') {
        if (canonicalJson(oldItem) !== canonicalJson(newItem)) result.changed.push({ kind, id })
        continue
      }
      const { childIds: oldChildren, ...oldRest } = oldItem
      const { childIds: newChildren, ...newRest } = newItem
      const oldSorted = [...oldChildren].sort()
      const newSorted = [...newChildren].sort()
      const sameMembership = oldSorted.length === newSorted.length &&
        oldSorted.every((child, index) => child === newSorted[index])
      if (canonicalJson(oldRest) !== canonicalJson(newRest) || !sameMembership) result.changed.push({ kind, id })
      if (sameMembership && canonicalJson(oldChildren) !== canonicalJson(newChildren)) result.reordered.push({ kind, id })
    }
    for (const id of newItems.keys()) if (!oldItems.has(id)) result.added.push({ kind, id })
  }
  const asciiOrder = (left, right) => left < right ? -1 : left > right ? 1 : 0
  for (const items of Object.values(result)) items.sort((left, right) => asciiOrder(left.kind, right.kind) || asciiOrder(left.id, right.id))
  return result
}

/** Compare two fully valid revisions of the same document without changing either input. */
export function compareGraphs(before, after) {
  const oldState = validateGraph(before)
  const newState = validateGraph(after)
  const oldGraph = oldState.graph
  const newGraph = newState.graph
  if (oldGraph.workspaceId !== newGraph.workspaceId || oldGraph.documentId !== newGraph.documentId) {
    refuse('GRAPH_COMPARISON_IDENTITY', 'Graph comparisons require the same workspace and document.', 'conflict', 409)
  }
  const changes = listChanges(oldGraph, newGraph)
  const totals = Object.fromEntries(Object.entries(changes).map(([kind, items]) => [kind, items.length]))
  const omittedCount = Object.values(changes).reduce((total, items) => total + Math.max(0, items.length - MAX_RESULTS_PER_KIND), 0)
  return {
    beforeRevision: oldState.revision,
    afterRevision: newState.revision,
    ...Object.fromEntries(Object.entries(changes).map(([kind, items]) => [kind, items.slice(0, MAX_RESULTS_PER_KIND)])),
    totals,
    omittedCount,
  }
}

/** Preview the one reviewed schema transition; the result is an isolated copy. */
export function previewGraphMigration(input, options = {}) {
  const copiedOptions = boundedJsonCopy(options, 1024)
  if (!isRecord(copiedOptions) || Object.keys(copiedOptions).some(key => key !== 'targetVersion')) {
    refuse('GRAPH_MIGRATION_OPTIONS', 'Migration preview accepts only targetVersion.')
  }
  const targetVersion = Object.hasOwn(copiedOptions, 'targetVersion') ? copiedOptions.targetVersion : 1
  if (targetVersion !== 1) refuse('GRAPH_MIGRATION_TARGET', 'Only graph schema version 1 is a reviewed migration target.', 'incompatible-version')
  const legacy = boundedJsonCopy(input, MAX_GRAPH_BYTES)
  if (!isRecord(legacy) || legacy.schemaVersion !== 0) refuse('GRAPH_MIGRATION_SOURCE', 'Only legacy graph schema version 0 can be migrated to version 1.', 'incompatible-version')
  legacyShape(legacy)
  const { page, ...document } = legacy
  document.schemaVersion = 1
  document.pages = [page]
  const children = new Map()
  for (const node of document.nodes) {
    if (node.parentId === null) continue
    if (!children.has(node.parentId)) children.set(node.parentId, [])
    children.get(node.parentId).push(node.id)
  }
  document.nodes = document.nodes.map(node => ({ ...node, childIds: children.get(node.id) ?? [] }))
  const validated = validateGraph(document)
  const preview = {
    fromVersion: 0,
    toVersion: 1,
    steps: MIGRATION_STEPS.map(step => ({ ...step })),
    unsupportedFields: [],
    document: validated.graph,
  }
  return { digest: migrationDigest(preview), ...preview }
}

/** Require the exact reviewed preview and typed confirmation before returning a fresh graph copy. */
export function applyGraphMigration(preview, options = {}) {
  const copiedOptions = boundedJsonCopy(options, 1024)
  if (!isRecord(copiedOptions) || Object.keys(copiedOptions).some(key => key !== 'digest' && key !== 'confirmation')) {
    refuse('GRAPH_MIGRATION_OPTIONS', 'Migration apply accepts only digest and confirmation.')
  }
  const { digest, confirmation } = copiedOptions
  if (confirmation !== 'MIGRATE GRAPH COPY') refuse('GRAPH_MIGRATION_CONFIRMATION', 'Type MIGRATE GRAPH COPY to apply the reviewed migration copy.', 'confirmation')
  const copy = boundedJsonCopy(preview)
  requireExactFields(copy, ['digest', 'fromVersion', 'toVersion', 'steps', 'unsupportedFields', 'document'], 'migration preview')
  if (copy.fromVersion !== 0 || copy.toVersion !== 1 || !Array.isArray(copy.steps) || !Array.isArray(copy.unsupportedFields) || copy.unsupportedFields.length !== 0 ||
      canonicalJson(copy.steps) !== canonicalJson(MIGRATION_STEPS) || !HEX64.test(copy.digest) || !HEX64.test(digest ?? '')) {
    refuse('GRAPH_MIGRATION_PREVIEW', 'Migration preview is not the reviewed schema 0 to 1 transition.')
  }
  if (digest !== copy.digest || migrationDigest(copy) !== digest) refuse('GRAPH_MIGRATION_DIGEST', 'Migration preview digest does not match the reviewed copy.', 'conflict', 409)
  return validateGraph(copy.document).graph
}

/** Produce a portable metadata-only envelope with a canonical document revision. */
export function exportGraphDocument(graph) {
  const validated = validateGraph(graph)
  return { format: 'webappx-graph', formatVersion: 1, revision: validated.revision, document: validated.graph }
}

/** Revalidate a portable export; workspace adoption and source authority stay with the service. */
export function reopenGraphDocument(exported) {
  const copy = boundedJsonCopy(exported)
  requireExactFields(copy, ['format', 'formatVersion', 'revision', 'document'], 'graph export')
  if (copy.format !== 'webappx-graph' || copy.formatVersion !== 1) refuse('GRAPH_EXPORT_FORMAT', 'Unsupported graph export format or version.', 'incompatible-version')
  if (!HEX64.test(copy.revision)) refuse('GRAPH_EXPORT_REVISION', 'Graph export revision must be a lowercase SHA-256 digest.')
  const validated = validateGraph(copy.document)
  if (validated.revision !== copy.revision) refuse('GRAPH_EXPORT_REVISION_MISMATCH', 'Graph export revision does not match its document.', 'conflict', 409)
  return validated.graph
}
