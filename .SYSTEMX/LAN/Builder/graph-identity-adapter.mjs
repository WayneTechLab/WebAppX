import { createHash } from 'node:crypto'
import { types } from 'node:util'
import { validateIdentityMap } from './identity-core.mjs'
import { GraphError } from './graph-core.mjs'
import { validateGraph } from './graph-validation.mjs'

const ID = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/
const SAFE_TAG = /^[A-Za-z][A-Za-z0-9._:-]{0,119}$/

function refuse(code, message, options) { throw new GraphError(code, message, options) }
function digest(value) { return createHash('sha256').update(value).digest('hex') }
function field(record, key) {
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (descriptor && !Object.hasOwn(descriptor, 'value')) {
    refuse('GRAPH_IDENTITY_INVALID', 'The selected identity document must use data properties.')
  }
  return descriptor?.value
}

function identityData(value, depth = 0, seen = new Set(), budget = { entries: 0 }) {
  if (value === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof value)) return
  if (typeof value !== 'object' || types.isProxy(value) || depth > 64 || seen.has(value)
    || ![Object.prototype, Array.prototype, null].includes(Object.getPrototypeOf(value))) {
    refuse('GRAPH_IDENTITY_INVALID', 'The selected identity document must be bounded plain data.')
  }
  seen.add(value)
  const descriptors = Object.getOwnPropertyDescriptors(value)
  const keys = Reflect.ownKeys(descriptors)
  budget.entries += keys.length
  if (budget.entries > 50_000) refuse('GRAPH_IDENTITY_LIMIT', 'The identity metadata exceeds the graph import budget.', { statusCode: 413 })
  for (const key of keys) {
    const descriptor = descriptors[key]
    if (typeof key !== 'string' || !Object.hasOwn(descriptor, 'value')) {
      refuse('GRAPH_IDENTITY_INVALID', 'The selected identity document must use data properties.')
    }
    identityData(descriptor.value, depth + 1, seen, budget)
  }
  seen.delete(value)
}

/**
 * Adapt an accepted F003 identity read result to a descriptive graph. The
 * identity map remains the only authority for its source spans and ownership;
 * this graph never grants an edit or source-save capability.
 */
export function graphFromIdentity(record) {
  if (!record || typeof record !== 'object' || types.isProxy(record) || Array.isArray(record)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(record))) {
    refuse('GRAPH_IDENTITY_MISSING', 'Select an accepted identity document.', { category: 'missing-target', statusCode: 404 })
  }
  const imported = field(record, 'map')
  if (field(record, 'missing') === true || !imported) {
    refuse('GRAPH_IDENTITY_MISSING', 'Select an accepted identity document.', { category: 'missing-target', statusCode: 404 })
  }
  if (field(record, 'stale') === true || field(record, 'sourceErrorCode')) {
    refuse('GRAPH_IDENTITY_STALE', 'Reconcile the current source identity before importing a graph.',
      { category: 'conflict', statusCode: 409 })
  }
  let map
  try { identityData(imported); map = validateIdentityMap(imported) }
  catch (error) {
    if (error instanceof GraphError) throw error
    refuse('GRAPH_IDENTITY_INVALID', 'The selected identity document is invalid. Keep the previous accepted graph.')
  }

  // F003's node array is in source order. Use that order for every child list.
  const children = new Map(map.nodes.map(node => [node.id, []]))
  const roots = []
  for (const node of map.nodes) {
    if (node.parentId === null) roots.push(node.id)
    else children.get(node.parentId).push(node.id)
  }
  const nodes = map.nodes.map(node => ({
    id: node.id,
    kind: node.external ? 'component-instance' : node.opaque || node.confidence === 'unresolved' ? 'opaque' : 'element',
    parentId: node.parentId,
    childIds: children.get(node.id),
    label: SAFE_TAG.test(node.tag) ? node.tag : 'Element',
    ownership: node.external || node.opaque || node.confidence === 'unresolved' ? 'read-only' : 'source-owned',
    source: { path: node.source.path, sourceRevision: node.source.sourceRevision,
      start: node.source.start, end: node.source.end, fingerprint: node.source.fingerprint },
    opaqueReason: node.external ? 'External component structure is unresolved.'
      : node.confidence === 'unresolved' ? 'Source identity is unresolved.'
        : node.opaque ? 'Unsupported source region.' : null,
  }))

  // One identity source file can contain several JSX roots. Preserve every
  // root beneath one descriptive page wrapper, including an empty source file.
  let pageRootId = roots[0]
  if (roots.length !== 1) {
    pageRootId = `root_${digest(JSON.stringify([map.workspaceId, map.documentId, map.pageId]))}`
    if (!ID.test(pageRootId) || children.has(pageRootId)) {
      refuse('GRAPH_IDENTITY_ROOT_COLLISION', 'The imported root identifier conflicts with an identity node.')
    }
    for (const node of nodes) if (node.parentId === null) node.parentId = pageRootId
    nodes.push({ id: pageRootId, kind: 'document-root', parentId: null, childIds: roots,
      label: 'Document', ownership: 'read-only', source: null, opaqueReason: null })
  }

  // An imported uppercase or dotted JSX tag names an external dependency. It
  // does not create an internal component definition or editable structure.
  const references = map.nodes.filter(node => node.external).map(node => ({
    id: `ref_${digest(JSON.stringify([map.documentId, node.id, node.tag]))}`,
    kind: 'component', documentId: map.documentId,
    targetId: `component_${digest(node.tag)}`,
    expectedVersion: null, expectedSchemaId: null, required: false,
  }))
  const graph = {
    schemaVersion: 1, workspaceId: map.workspaceId, documentId: map.documentId,
    sourceRevision: map.sourceRevision,
    pages: [{ id: map.pageId, rootId: pageRootId, route: map.route }],
    nodes, references, components: [], collections: [], extensions: {},
  }
  return validateGraph(graph).graph
}
