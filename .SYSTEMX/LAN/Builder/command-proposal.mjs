import { createHash } from 'node:crypto'
import { getOperationDescriptor } from './api-contracts.mjs'
import { canonicalJson, GraphError, publicDiagnosticId } from './graph-core.mjs'
import { compareGraphs, reopenGraphDocument } from './graph-evolution.mjs'
import { validateGraph } from './graph-validation.mjs'

const ACCEPT = getOperationDescriptor('graph.accept')
const tables = { page: 'pages', node: 'nodes', component: 'components', collection: 'collections', reference: 'references' }
const categories = ['added', 'removed', 'changed', 'reordered']
const sha256 = text => createHash('sha256').update(text).digest('hex')
const hex = /^[a-f0-9]{64}$/
const publicId = id => publicDiagnosticId(id) ?? `redacted:${sha256(id)}`

function refuse(code, message, statusCode = 400) {
  throw new GraphError(code, message, { statusCode, category: statusCode === 409 ? 'conflict' : 'validation' })
}

function indexGraph(graph) {
  const index = { document: new Map([[graph.documentId, graph]]) }
  for (const [kind, field] of Object.entries(tables)) index[kind] = new Map(graph[field].map(item => [item.id, item]))
  return index
}

function displayPath(path) {
  // Include ordinary code paths; retain a stable owner ID when a name is private.
  if (!path.startsWith('src/') || !/\.(?:[cm]?[jt]sx?|css|html)$/.test(path)) return null
  if (/(?:^|[^a-z])(?:keys?|tokens?|auth|secrets?)(?:[^a-z]|$)/i.test(path)) return null
  return path.split('/').every(part => part.split('.').every(word => publicDiagnosticId(word))) ? path : null
}

// Owners are mappings in this document. Source byte writes do not follow from
// reviewing a node or from accepting its metadata in the existing graph service.
function ownersFor(index, kind, item, childIds, owners, documentId) {
  if (!item) return []
  const ids = new Set()
  const visit = (node, descend) => {
    if (!node) return
    // An unmapped child may be part of a containing source-owned node.
    let owner = node
    while (!owner.source && owner.parentId) owner = index.node.get(owner.parentId)
    if (owner.source) {
      const id = `source:${sha256(owner.source.path)}`
      if (!owners.has(id)) owners.set(id, { id, kind: 'source', path: displayPath(owner.source.path) })
      ids.add(id)
    }
    if (descend) for (const child of node.childIds) visit(index.node.get(child), true)
  }
  if (kind === 'node') {
    visit(item, false)
    for (const id of childIds) visit(index.node.get(id), true)
  } else if (kind === 'page' || kind === 'component') visit(index.node.get(item.rootId), true)
  else if (kind === 'reference' && item.documentId === documentId) {
    const target = index[item.kind].get(item.targetId)
    if (item.kind === 'node') visit(target, true)
    if (item.kind === 'component' && target) visit(index.node.get(target.rootId), true)
  }
  if (!ids.size) {
    const id = 'document'
    owners.set(id, { id, kind: 'document', path: null })
    ids.add(id)
  }
  return [...ids].sort()
}

function changedFields(kind, before, after) {
  const keys = kind === 'document' ? ['extensions', 'sourceRevision'] : Object.keys(before)
  return keys.filter(key => canonicalJson(before[key]) !== canonicalJson(after[key])).sort()
}

function orderOfSurvivors(before, after) {
  const oldIds = new Set(before.childIds)
  const newIds = new Set(after.childIds)
  return [before.childIds.filter(id => newIds.has(id)), after.childIds.filter(id => oldIds.has(id))]
}

function effect(category, { kind, id }, oldIndex, newIndex, owners, documentId) {
  const before = oldIndex[kind].get(id)
  const after = newIndex[kind].get(id)
  const result = { kind, id: publicId(id) }
  let oldChildren = []
  let newChildren = []
  if (category === 'changed') {
    result.fields = changedFields(kind, before, after)
    if (kind === 'node' && result.fields.includes('ownership')) {
      result.ownership = { before: before.ownership, after: after.ownership }
    }
    if (kind === 'node' && before.source && after.source && result.fields.includes('source')) {
      result.sourceFields = changedFields('source', before.source, after.source)
    }
    if (kind === 'node' && result.fields.includes('childIds')) {
      const oldSet = new Set(before.childIds)
      const newSet = new Set(after.childIds)
      oldChildren = before.childIds.filter(child => !newSet.has(child))
      newChildren = after.childIds.filter(child => !oldSet.has(child))
      // Reorders have their own record. Include childIds here only for a membership change.
      if (!oldChildren.length && !newChildren.length) result.fields = result.fields.filter(key => key !== 'childIds')
    }
  }
  if (category === 'reordered') {
    const [oldOrder, newOrder] = orderOfSurvivors(before, after)
    result.beforeOrder = oldOrder.map(publicId)
    result.afterOrder = newOrder.map(publicId)
    oldChildren = oldOrder.filter((child, index) => child !== newOrder[index])
    newChildren = newOrder.filter((child, index) => child !== oldOrder[index])
  }
  result.ownersBefore = ownersFor(oldIndex, kind, before, oldChildren, owners, documentId)
  result.ownersAfter = ownersFor(newIndex, kind, after, newChildren, owners, documentId)
  return result
}

/** Review the existing graph.accept operation. This deliberately has no session,
 * storage, filesystem or service callbacks and cannot create an acceptance token. */
function buildReview({ baseline, candidate, expectedRevision }, savedCandidateRevision) {
  if (typeof expectedRevision !== 'string' || !hex.test(expectedRevision)) {
    refuse('COMMAND_EXPECTED_REVISION', 'Supply the complete lowercase revision from the accepted graph export.')
  }
  const original = reopenGraphDocument(baseline)
  // The export digest is verified by reopenGraphDocument. Read the digest from
  // the canonical copy so no subsequent access to caller-owned objects is needed.
  const targetRevision = sha256(canonicalJson(original))
  if (targetRevision !== expectedRevision) {
    refuse('COMMAND_BASELINE_STALE', 'The accepted graph revision changed. Export the current graph and review a new proposal.', 409)
  }
  const proposed = validateGraph(candidate)
  const graph = proposed.graph
  if (original.workspaceId !== graph.workspaceId || original.documentId !== graph.documentId) {
    refuse('COMMAND_TARGET_MISMATCH', 'Select a candidate for the same workspace and document as the accepted graph.', 409)
  }
  if (original.sourceRevision !== graph.sourceRevision) {
    refuse('COMMAND_SOURCE_CHANGED', 'The candidate targets another source revision. Reconcile the source and export the current graph.', 409)
  }
  if (savedCandidateRevision !== undefined && savedCandidateRevision !== proposed.revision) {
    refuse('COMMAND_CANDIDATE_REPLACED', 'The candidate graph changed. Review a fresh proposal before continuing.', 409)
  }
  if (proposed.revision === targetRevision) refuse('COMMAND_NO_EFFECT', 'The candidate has no semantic changes to review.')
  const diff = compareGraphs(original, graph)
  if (diff.omittedCount) refuse('COMMAND_EFFECT_LIMIT', 'The complete change set exceeds the review limit. Review smaller edits.', 413)
  const oldIndex = indexGraph(original)
  const newIndex = indexGraph(graph)
  const owners = new Map()
  const effects = Object.fromEntries(categories.map(category => [
    category, diff[category].map(item => effect(category, item, oldIndex, newIndex, owners, original.documentId)),
  ]))
  const review = { schemaVersion: 1, operation: ACCEPT.id, capabilityId: ACCEPT.capabilityId,
    domainEffect: ACCEPT.effect, sourceWrites: false, workspaceId: original.workspaceId, documentId: publicId(original.documentId),
    targetRevision, candidateRevision: proposed.revision, sourceRevision: original.sourceRevision, effects,
    owners: [...owners.keys()].sort().map(id => owners.get(id)) }
  let serialized
  try { serialized = canonicalJson(review) } catch { refuse('COMMAND_EFFECT_LIMIT', 'The complete impact report exceeds the review limit. Review smaller edits.', 413) }
  if (Buffer.byteLength(serialized) > 128_000) {
    refuse('COMMAND_EFFECT_LIMIT', 'The complete impact report exceeds 128000 bytes. Review smaller edits.', 413)
  }
  return { ...review, proposalId: sha256(serialized) }
}

export function createCommandProposal(input) {
  return buildReview(input)
}

/** Rebuild from the supplied current baseline, then verify the entire saved review. */
export function inspectCommandProposal({ baseline, candidate, proposal }) {
  let saved
  try {
    const json = canonicalJson(proposal)
    if (Buffer.byteLength(json) <= 129_000) saved = JSON.parse(json)
  } catch { /* Convert invalid saved reports to one actionable refusal. */ }
  if (!saved || saved.operation !== ACCEPT.id || saved.schemaVersion !== 1 ||
      typeof saved.proposalId !== 'string' || !hex.test(saved.proposalId)) {
    refuse('COMMAND_PROPOSAL_INVALID', 'Select an intact version 1 graph.accept proposal or create a new review.')
  }
  const actual = buildReview({ baseline, candidate, expectedRevision: saved.targetRevision }, saved.candidateRevision)
  if (canonicalJson(saved) !== canonicalJson(actual)) {
    refuse('COMMAND_PROPOSAL_MISMATCH', 'The saved effects or command identity differ from the current review. Create a new proposal.', 409)
  }
  return actual
}
