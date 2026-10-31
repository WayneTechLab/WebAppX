/**
 * Relational validation for the metadata-only graph read model.
 * Shape, copy, byte budgets and canonical ordering belong to graph-core.mjs.
 * This module never reads source files or grants source editing authority.
 */
import { createHash } from 'node:crypto'
import { types } from 'node:util'
import { GraphError, graphLimits, graphRevision, normalizeGraph } from './graph-core.mjs'

const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/
const HEX64 = /^[a-f0-9]{64}$/
const KINDS = ['page', 'node', 'component', 'collection', 'reference']
const REFERENCE_TYPES = ['page', 'node', 'component', 'collection']
const SEVERITIES = ['error', 'warning', 'info']
const MAX_FINDINGS = Math.min(50, graphLimits.findings ?? 50)
const MAX_DEPTH = Math.min(64, graphLimits.depth ?? 64)

function fail(code, message, category = 'validation', statusCode = 400) {
  throw new GraphError(code, message, { category, statusCode })
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && !types.isProxy(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function exact(value, keys) {
  if (!plain(value)) return false
  const descriptors = Object.getOwnPropertyDescriptors(value)
  return Reflect.ownKeys(descriptors).length === keys.length && keys.every(key =>
    Object.hasOwn(descriptors, key) && Object.hasOwn(descriptors[key], 'value'))
}

function compareAscii(a, b) { return a < b ? -1 : a > b ? 1 : 0 }

function indexById(items, type, add) {
  const byId = new Map()
  for (const item of items) {
    if (byId.has(item.id)) add(`DUPLICATE_${type.toUpperCase()}_ID`, 'error', item.id,
      type === 'reference' ? null : type,
      `Duplicate ${type} identifier.`)
    else byId.set(item.id, item)
  }
  return byId
}

function issueCollector() {
  const issues = new Map()
  function add(code, severity, objectId, referenceType, message, detail = '') {
    const key = `${code}\0${severity}\0${referenceType ?? ''}\0${objectId ?? ''}\0${detail}`
    if (issues.has(key)) return
    const id = `F_${createHash('sha256').update(key).digest('hex').slice(0, 24)}`
    issues.set(key, { id, code, severity, objectId, referenceType, message })
  }
  function finish() {
    const sorted = [...issues.values()].sort((a, b) =>
      SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)
      || compareAscii(a.objectId ?? '', b.objectId ?? '')
      || compareAscii(a.code, b.code) || compareAscii(a.id, b.id))
    return { findings: sorted.slice(0, MAX_FINDINGS), omittedCount: Math.max(0, sorted.length - MAX_FINDINGS),
      hasErrors: sorted.some(item => item.severity === 'error') }
  }
  return { add, finish }
}

function cycleMessage(path) {
  // Identifiers are core-validated ASCII. Keep a useful path without echoing
  // arbitrary labels, source paths or a potentially thousand-node ancestry.
  const shown = path.length <= 4 ? path : [...path.slice(0, 3), '…', path.at(-1)]
  const message = `Node ancestry cycle: ${shown.join(' -> ')}.`
  return message.length <= 400 ? message : `${message.slice(0, 397)}...`
}

function reportCycle(path, add) {
  const members = path.at(-1) === path[0] ? path.slice(0, -1) : path
  const canonicalMembers = [...new Set(members)].sort()
  if (canonicalMembers.length === 0) return
  add('NODE_ANCESTRY_CYCLE', 'error', canonicalMembers[0], 'node', cycleMessage(path),
    canonicalMembers.join(','))
}

function childCycles(nodesById, roots, add) {
  const color = new Map()
  const candidates = [...new Set([...roots, ...nodesById.keys()])]
  for (const start of candidates) {
    if (!nodesById.has(start) || color.has(start)) continue
    const stack = [{ id: start, index: 0 }]
    const path = [start]
    const inPath = new Map([[start, 0]])
    color.set(start, 1)
    while (stack.length) {
      const frame = stack.at(-1)
      const children = nodesById.get(frame.id).childIds
      if (frame.index >= children.length) {
        color.set(frame.id, 2)
        inPath.delete(frame.id)
        stack.pop()
        path.pop()
        continue
      }
      const childId = children[frame.index++]
      if (!nodesById.has(childId)) continue
      if (color.get(childId) === 1) {
        const offset = inPath.get(childId)
        reportCycle([...path.slice(offset), childId], add)
      } else if (!color.has(childId)) {
        color.set(childId, 1)
        inPath.set(childId, path.length)
        stack.push({ id: childId, index: 0 })
        path.push(childId)
      }
    }
  }
}

function parentCyclesAndDepth(nodesById, add) {
  for (const node of nodesById.values()) {
    const path = []
    const seen = new Map()
    let cursor = node
    while (cursor) {
      if (seen.has(cursor.id)) {
        reportCycle([...path.slice(seen.get(cursor.id)), cursor.id], add)
        break
      }
      seen.set(cursor.id, path.length)
      path.push(cursor.id)
      if (path.length === MAX_DEPTH + 1) {
        add('NODE_DEPTH_LIMIT', 'error', node.id, 'node', `Node ancestry exceeds the depth limit of ${MAX_DEPTH}.`)
      }
      cursor = cursor.parentId === null ? null : nodesById.get(cursor.parentId)
    }
  }
}

function reachableNodes(nodesById, roots) {
  const reachable = new Set()
  const pending = [...roots]
  while (pending.length) {
    const id = pending.pop()
    if (!nodesById.has(id) || reachable.has(id)) continue
    reachable.add(id)
    for (const childId of nodesById.get(id).childIds) pending.push(childId)
  }
  return reachable
}

function inspectReferences(graph, nodesById, componentsById, collectionsById, add) {
  let unresolvedReferences = 0
  for (const ref of graph.references) {
    const soft = ref.kind !== 'node' && !ref.required
    const severity = soft ? 'warning' : 'error'
    const problem = (code, message) => {
      unresolvedReferences += 1
      add(code, severity, ref.id, ref.kind, message)
    }
    if (ref.documentId !== graph.documentId) {
      problem('REFERENCE_DOCUMENT_MISMATCH', 'Reference targets a different document.')
      continue
    }
    if (ref.kind === 'node') {
      if (ref.expectedVersion !== null || ref.expectedSchemaId !== null) {
        add('NODE_REFERENCE_EXPECTATION_INVALID', 'error', ref.id, 'node',
          'Node references cannot declare component or collection expectations.')
      }
      if (!nodesById.has(ref.targetId)) problem('NODE_REFERENCE_MISSING', 'Node reference target is missing.')
      continue
    }
    if (ref.kind === 'component') {
      if (ref.expectedSchemaId !== null) {
        add('COMPONENT_REFERENCE_SCHEMA_UNEXPECTED', 'error', ref.id, 'component',
          'Component reference cannot declare a collection schema.')
      }
      const component = componentsById.get(ref.targetId)
      if (ref.expectedVersion === null) problem('COMPONENT_REFERENCE_VERSION_REQUIRED', 'Component version expectation is required.')
      else if (!component) problem('COMPONENT_REFERENCE_MISSING', 'Component definition is unresolved.')
      else if (component.version !== ref.expectedVersion) {
        problem('COMPONENT_REFERENCE_VERSION_MISMATCH', 'Component definition version is incompatible.')
      } else if (!nodesById.has(component.rootId) || nodesById.get(component.rootId).parentId !== null) {
        problem('COMPONENT_REFERENCE_ROOT_INVALID', 'Component definition root is invalid.')
      }
      continue
    }
    if (ref.kind === 'collection') {
      if (ref.expectedVersion === null || ref.expectedSchemaId === null) {
        problem('COLLECTION_REFERENCE_EXPECTATION_REQUIRED', 'Collection schema identity and version are required.')
        continue
      }
      const collection = collectionsById.get(ref.targetId)
      if (!collection) problem('COLLECTION_REFERENCE_MISSING', 'Collection definition is unresolved.')
      else if (collection.schemaId !== ref.expectedSchemaId || collection.version !== ref.expectedVersion) {
        problem('COLLECTION_REFERENCE_INCOMPATIBLE', 'Collection schema identity or version is incompatible.')
      }
    }
  }
  return unresolvedReferences
}

function statistics(graph, revision, unresolvedReferences) {
  return { revision, pages: graph.pages.length, nodes: graph.nodes.length,
    components: graph.components.length, collections: graph.collections.length,
    references: graph.references.length, unresolvedReferences,
    opaqueNodes: graph.nodes.filter(node => node.kind === 'opaque').length }
}

/** Validate all graph relationships and return an isolated canonical graph copy. */
export function validateGraph(input) {
  const graph = normalizeGraph(input)
  const { add, finish } = issueCollector()
  indexById(graph.pages, 'page', add)
  const nodesById = indexById(graph.nodes, 'node', add)
  indexById(graph.references, 'reference', add)
  const componentsById = indexById(graph.components, 'component', add)
  const collectionsById = indexById(graph.collections, 'collection', add)

  for (const node of graph.nodes) if (node.kind === 'opaque') {
    add('OPAQUE_IMPORTED_REGION', 'info', node.id, 'node',
      'Imported region has no supported structure operations.')
    if (node.ownership !== 'read-only') add('OPAQUE_OWNERSHIP_INVALID', 'error', node.id, 'node',
      'Opaque imported regions must be read-only.')
  }

  const roots = []
  const rootOwners = new Map()
  function root(id, ownerId, type) {
    roots.push(id)
    const node = nodesById.get(id)
    if (!node) add('GRAPH_ROOT_MISSING', 'error', ownerId, type, 'Declared root node is missing.')
    else if (node.parentId !== null) add('GRAPH_ROOT_HAS_PARENT', 'error', ownerId, type,
      'Declared root node must have no parent.')
    if (rootOwners.has(id)) add('GRAPH_ROOT_REUSED', 'error', ownerId, type,
      'A root node is declared by more than one page or component.')
    else rootOwners.set(id, { ownerId, type })
  }
  for (const page of graph.pages) root(page.rootId, page.id, 'page')
  for (const component of graph.components) root(component.rootId, component.id, 'component')

  const membership = new Map()
  for (const parent of graph.nodes) {
    const localChildren = new Set()
    for (const childId of parent.childIds) {
      if (localChildren.has(childId)) add('NODE_CHILD_DUPLICATE', 'error', parent.id, 'node',
        'A child is listed more than once in sibling order.', childId)
      else localChildren.add(childId)
      const child = nodesById.get(childId)
      if (!child) {
        add('NODE_CHILD_MISSING', 'error', parent.id, 'node', 'Declared child node is missing.', childId)
        continue
      }
      if (membership.has(childId) && membership.get(childId) !== parent.id) {
        add('NODE_CHILD_MULTIPLE_PARENTS', 'error', childId, 'node',
          'A child belongs to more than one parent.')
      } else membership.set(childId, parent.id)
      if (child.parentId !== parent.id) add('NODE_PARENT_CHILD_MISMATCH', 'error', childId, 'node',
        'Child parent identifier disagrees with its parent child list.', parent.id)
    }
  }
  for (const node of graph.nodes) {
    if (node.parentId === null) continue
    const parent = nodesById.get(node.parentId)
    if (!parent) add('NODE_PARENT_MISSING', 'error', node.id, 'node', 'Declared parent node is missing.')
    else if (!parent.childIds.includes(node.id)) add('NODE_PARENT_CHILD_MISMATCH', 'error', node.id, 'node',
      'Parent child list does not contain its declared child.', parent.id)
  }

  childCycles(nodesById, roots, add)
  parentCyclesAndDepth(nodesById, add)
  const reachable = reachableNodes(nodesById, roots)
  for (const node of graph.nodes) if (!reachable.has(node.id)) {
    add('NODE_UNREACHABLE', 'error', node.id, 'node', 'Node is not reachable from a declared page or component root.')
  }
  const unresolvedReferences = inspectReferences(graph, nodesById, componentsById, collectionsById, add)
  const { findings, omittedCount, hasErrors } = finish()
  if (hasErrors) throw new GraphError('GRAPH_VALIDATION_FAILED', 'Graph relationships are invalid.',
    { category: 'validation', statusCode: 400, findings, omittedCount })
  const revision = graphRevision(graph)
  return { graph, revision, findings, omittedCount, stats: statistics(graph, revision, unresolvedReferences) }
}

/** Compute statistics against the exact canonical revision being inspected. */
export function graphStatistics(graph) {
  return validateGraph(graph).stats
}

/** Resolve one object using a complete workspace/document/kind qualified key. */
export function resolveGraphReference(graph, reference) {
  if (!exact(reference, ['workspaceId', 'documentId', 'id', 'kind'])
    || typeof reference.workspaceId !== 'string' || !HEX64.test(reference.workspaceId)
    || typeof reference.documentId !== 'string' || !IDENTIFIER.test(reference.documentId)
    || typeof reference.id !== 'string' || !IDENTIFIER.test(reference.id)
    || !KINDS.includes(reference.kind)) {
    fail('GRAPH_LOOKUP_INVALID', 'Graph lookup requires workspaceId, documentId, id and kind.')
  }
  const checked = validateGraph(graph).graph
  if (reference.workspaceId !== checked.workspaceId || reference.documentId !== checked.documentId) {
    fail('GRAPH_LOOKUP_DOCUMENT_MISMATCH', 'Graph lookup targets a different workspace or document.', 'missing-target', 404)
  }
  const collections = { page: checked.pages, node: checked.nodes, component: checked.components,
    collection: checked.collections, reference: checked.references }
  const found = collections[reference.kind].find(item => item.id === reference.id)
  if (found) return found
  if (KINDS.some(kind => kind !== reference.kind && collections[kind].some(item => item.id === reference.id))) {
    fail('GRAPH_LOOKUP_WRONG_KIND', 'Graph object exists under a different kind.', 'missing-target', 404)
  }
  fail('GRAPH_LOOKUP_MISSING', 'Graph object is missing.', 'missing-target', 404)
}

/** Filter bounded findings without coercing filter types or mutating the input. */
export function filterGraphFindings(findings, options = {}) {
  if (!Array.isArray(findings) || types.isProxy(findings) || Object.getPrototypeOf(findings) !== Array.prototype
    || findings.length > MAX_FINDINGS) {
    fail('GRAPH_FINDINGS_INVALID', 'Findings must be a bounded array.')
  }
  const findingDescriptors = Object.getOwnPropertyDescriptors(findings)
  if (Reflect.ownKeys(findingDescriptors).length !== findings.length + 1
    || Array.from({ length: findings.length }, (_, index) => index).some(index =>
      !Object.hasOwn(findingDescriptors, index) || !Object.hasOwn(findingDescriptors[index], 'value'))) {
    fail('GRAPH_FINDINGS_INVALID', 'Findings must be a dense data array.')
  }
  const allowed = ['severity', 'objectId', 'referenceType', 'offset', 'limit']
  if (!plain(options)) fail('GRAPH_FINDING_FILTER_INVALID', 'Finding filter contains invalid fields.')
  const descriptors = Object.getOwnPropertyDescriptors(options)
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' || !allowed.includes(key)
    || !Object.hasOwn(descriptors[key], 'value'))) {
    fail('GRAPH_FINDING_FILTER_INVALID', 'Finding filter contains invalid fields.')
  }
  const severity = descriptors.severity?.value
  const objectId = descriptors.objectId?.value
  const referenceType = descriptors.referenceType?.value
  const offset = Object.hasOwn(descriptors, 'offset') ? descriptors.offset.value : 0
  const limit = Object.hasOwn(descriptors, 'limit') ? descriptors.limit.value : 20
  if (Object.hasOwn(descriptors, 'severity') && !SEVERITIES.includes(severity)
    || Object.hasOwn(descriptors, 'objectId') && objectId !== null
      && (typeof objectId !== 'string' || !IDENTIFIER.test(objectId))
    || Object.hasOwn(descriptors, 'referenceType') && referenceType !== null
      && !REFERENCE_TYPES.includes(referenceType)
    || !Number.isInteger(offset) || offset < 0 || offset > 10000
    || !Number.isInteger(limit) || limit < 1 || limit > MAX_FINDINGS) {
    fail('GRAPH_FINDING_FILTER_INVALID', 'Finding filter values are invalid.')
  }
  for (const item of findings) {
    if (!exact(item, ['id', 'code', 'severity', 'objectId', 'referenceType', 'message'])
      || typeof item.id !== 'string' || !IDENTIFIER.test(item.id)
      || typeof item.code !== 'string' || !IDENTIFIER.test(item.code)
      || !SEVERITIES.includes(item.severity)
      || item.objectId !== null && (typeof item.objectId !== 'string' || !IDENTIFIER.test(item.objectId))
      || item.referenceType !== null && !REFERENCE_TYPES.includes(item.referenceType)
      || typeof item.message !== 'string' || item.message.length > 400) {
      fail('GRAPH_FINDINGS_INVALID', 'Finding has an invalid shape.')
    }
  }
  const matched = findings.filter(item => (severity === undefined || item.severity === severity)
    && (objectId === undefined || item.objectId === objectId)
    && (referenceType === undefined || item.referenceType === referenceType))
  const items = matched.slice(offset, offset + limit).map(item => ({ ...item }))
  return { items, total: matched.length, offset, limit, omittedCount: matched.length - items.length }
}
