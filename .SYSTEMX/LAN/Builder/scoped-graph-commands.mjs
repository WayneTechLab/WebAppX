import { createHash, randomBytes } from 'node:crypto'
import { types } from 'node:util'
import { createCommandProposal } from './command-proposal.mjs'
import { GraphError, publicDiagnosticId } from './graph-core.mjs'
import { exportGraphDocument } from './graph-evolution.mjs'

const operations = new Map([
  ['page.setRoute', { kind: 'page', table: 'pages', field: 'route', capabilityId: 'lan.page.setRoute@1' }],
  ['node.setLabel', { kind: 'node', table: 'nodes', field: 'label', capabilityId: 'lan.node.setLabel@1' }],
  ['component.setVersion', { kind: 'component', table: 'components', field: 'version', capabilityId: 'lan.component.setVersion@1' }],
])
const id = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/
const hash = /^[a-f0-9]{64}$/
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value)
const publicId = value => publicDiagnosticId(value) ?? 'redacted:' + createHash('sha256').update(value).digest('hex')
const reviewFields = ['action', 'documentId', 'expectedRevision', 'operation', 'target', 'value']
const decisionFields = ['action', 'proposalId', 'expectedRevision']
const lifetimeMs = 5 * 60_000

// All public error messages are authored here; submitted IDs, values and
// lower-level error messages never become HTTP refusal text.
export class ScopedGraphCommandError extends Error {
  constructor(code, message, status = 400) { super(message); this.code = code; this.status = status }
}
function refuse(code, message, status) { throw new ScopedGraphCommandError(code, message, status) }

function plain(record) {
  return record !== null && typeof record === 'object' && !types.isProxy(record) && !Array.isArray(record) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(record))
}
function exact(record, keys) {
  if (!plain(record) || Reflect.ownKeys(record).length !== keys.length || !keys.every(key => {
    const descriptor = Object.getOwnPropertyDescriptor(record, key)
    return descriptor?.enumerable && Object.hasOwn(descriptor, 'value')
  })) refuse('SCOPED_SHAPE', 'Use the declared fields for this action, with a qualified page, node or component target.')
}

// An absent setting enables installed operations. An empty or malformed
// operator allowlist enables none. The request cannot supply this policy.
function enabledCapabilities(setting) {
  const installed = new Set([...operations.values()].map(op => op.capabilityId))
  if (setting === undefined) return installed
  if (typeof setting !== 'string' || setting.length > 256) return new Set()
  const selected = setting.split(',').map(id => id.trim())
  return selected.every(id => installed.has(id)) ? new Set(selected) : new Set()
}

function command(input, available) {
  exact(input, Object.hasOwn(input, 'capabilityId') ? [...reviewFields, 'capabilityId'] : reviewFields)
  exact(input.target, ['kind', 'id'])
  const op = operations.get(input.operation)
  if (!op) refuse('SCOPED_OPERATION', 'Choose page.setRoute, node.setLabel or component.setVersion.')
  if (!Object.hasOwn(input, 'capabilityId') || input.capabilityId !== op.capabilityId) refuse('SCOPED_CAPABILITY', 'This operation requires ' + op.capabilityId + '.', 403)
  if (!available.has(op.capabilityId)) refuse('SCOPED_DISABLED', 'This LAN host has disabled ' + op.capabilityId + '. Choose an enabled operation or contact the local operator.', 403)
  if (input.target.kind !== op.kind) refuse('SCOPED_TARGET_KIND', 'This operation requires a ' + op.kind + ' target.')
  if (!matches(id, input.target.id) || !matches(id, input.documentId)) refuse('SCOPED_TARGET_ID', 'Select a qualified document and target identifier.')
  if (!matches(hash, input.expectedRevision)) refuse('SCOPED_REVISION', 'Supply the full accepted document revision.')
  return { operation: input.operation, capabilityId: op.capabilityId, documentId: input.documentId,
    target: { kind: op.kind, id: input.target.id }, expectedRevision: input.expectedRevision, value: input.value }
}

function editable(node, graph) {
  return node?.kind !== 'opaque' && node?.ownership === 'source-owned' &&
    node.source !== null && graph.sourceRevision !== null && node.source.sourceRevision === graph.sourceRevision
}
function checkOwner(op, target, graph) {
  let owned = false
  if (op.kind === 'node') owned = editable(target, graph)
  else {
    // A page/component is a metadata container. A mapped editable node in
    // its own tree supplies ownership evidence; sibling trees cannot lend it.
    const nodes = new Map(graph.nodes.map(node => [node.id, node]))
    const stack = [target.rootId]
    while (stack.length && !owned) {
      const node = nodes.get(stack.pop())
      owned = editable(node, graph)
      stack.push(...node.childIds)
    }
  }
  if (!owned) refuse('SCOPED_OWNER_REQUIRED', 'Select a target with a source-owned editable mapping at the accepted source revision.', 403)
}

function propose(service, edit) {
  let baseline
  try { baseline = service.export({ documentId: edit.documentId }) }
  catch (error) {
    if (error instanceof GraphError && error.code === 'GRAPH_DOCUMENT_MISSING') refuse('SCOPED_DOCUMENT_MISSING', 'Select an accepted graph document.', 404)
    throw error
  }
  if (baseline.revision !== edit.expectedRevision) refuse('SCOPED_STALE', 'The accepted graph changed. Read its current revision and review again.', 409)
  const graph = structuredClone(baseline.document)
  const op = operations.get(edit.operation)
  const target = graph[op.table].find(item => item.id === edit.target.id)
  if (!target) {
    if (['pages', 'nodes', 'components', 'references', 'collections'].some(table => graph[table].some(item => item.id === edit.target.id))) {
      refuse('SCOPED_TARGET_KIND', 'The selected identifier does not resolve to a ' + op.kind + ' in this document.')
    }
    refuse('SCOPED_TARGET_MISSING', 'The selected target is absent from the accepted document.', 404)
  }
  checkOwner(op, target, graph)
  const value = edit.value
  if (typeof value !== 'string' || !value.length || value.length > (op.kind === 'page' ? 512 : 120) || /[\x00-\x1f\x7f]/.test(value)) {
    refuse('SCOPED_VALUE', 'Use a nonempty bounded text value for the selected field.')
  }
  if (op.kind === 'page' && !/^\/(?:[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)?$/.test(value)) refuse('SCOPED_ROUTE', 'Use a local route beginning with / and simple path segments.')
  if (op.kind === 'page' && graph.pages.some(page => page.id !== target.id && page.route === value)) refuse('SCOPED_ROUTE_USED', 'Another page already has that route.', 409)
  if (target[op.field] === value) refuse('SCOPED_NO_EFFECT', 'The target already has this value; select a change to review.')
  if (op.kind === 'component') {
    for (const ref of graph.references) {
      if (ref.kind === 'component' && ref.documentId === graph.documentId && ref.targetId === target.id && ref.expectedVersion === target.version) ref.expectedVersion = value
    }
  }
  target[op.field] = value
  try {
    const review = createCommandProposal({ baseline, candidate: graph, expectedRevision: edit.expectedRevision })
    return { graph, review }
  } catch (error) {
    if (!(error instanceof GraphError)) throw error
    if (error.code === 'COMMAND_EFFECT_LIMIT') refuse('SCOPED_EFFECT_LIMIT', 'This change exceeds the complete semantic review limit.', 413)
    refuse('SCOPED_VALUE', 'The selected value or its references cannot form a valid canonical graph.')
  }
}

// One authority per running LAN graph service. A document-level reservation is
// required because the underlying commit compares and stores a complete graph.
export function createScopedGraphCommands(service, { now = Date.now, capabilitySetting } = {}) {
  const available = enabledCapabilities(capabilitySetting)
  const pending = new Map()
  function run(input) {
    for (const [key, saved] of pending) if (now() >= saved.expiresAt) pending.delete(key)
    const action = plain(input) && Object.getOwnPropertyDescriptor(input, 'action')?.value
    if (action === 'review') {
      const edit = command(input, available)
      const { review } = propose(service, edit)
      for (const [key, saved] of pending) {
        if (saved.edit.documentId !== edit.documentId) continue
        if (saved.edit.expectedRevision === edit.expectedRevision) refuse('SCOPED_OVERLAP', 'Another proposal holds this document revision. Cancel it or wait for it to expire.', 409)
        pending.delete(key) // The new review already verified current head.
      }
      if (pending.size >= 50) refuse('SCOPED_CAPACITY', 'The session has 50 pending proposals. Cancel one or wait for expiry.', 429)
      const proposalId = randomBytes(32).toString('hex')
      const confirmationText = 'APPLY ' + edit.operation + ' ' + proposalId + ' AT ' + edit.expectedRevision
      const expiresAt = now() + lifetimeMs
      pending.set(proposalId, { edit, expiresAt, confirmationText, candidateRevision: review.candidateRevision })
      return { proposalId, confirmationText, expiresAt, operation: edit.operation, capabilityId: edit.capabilityId,
        documentId: publicId(edit.documentId), target: { kind: edit.target.kind, id: publicId(edit.target.id) },
        targetRevision: review.targetRevision, candidateRevision: review.candidateRevision, sourceRevision: review.sourceRevision,
        domainEffect: 'accept-local-memory', sourceWrites: false, effects: review.effects, owners: review.owners }
    }
    if (action !== 'cancel' && action !== 'confirm') refuse('SCOPED_ACTION', 'Choose review, cancel or confirm.')
    exact(input, action === 'confirm' && Object.hasOwn(input, 'confirmation') ? [...decisionFields, 'confirmation'] : decisionFields)
    const saved = typeof input.proposalId === 'string' && pending.get(input.proposalId)
    if (!saved) refuse('SCOPED_PROPOSAL_MISSING', 'This proposal was canceled, expired or already completed. Review the draft again.', 404)
    const { edit } = saved
    if (input.expectedRevision !== edit.expectedRevision) refuse('SCOPED_REVISION', 'Use the exact target revision shown in this proposal.', 409)
    const result = { documentId: publicId(edit.documentId), proposalId: input.proposalId }
    if (action === 'cancel') {
      pending.delete(input.proposalId)
      return { ...result, canceled: true, targetRevision: edit.expectedRevision }
    }
    if (!Object.hasOwn(input, 'confirmation') || input.confirmation !== saved.confirmationText) refuse('SCOPED_CONFIRMATION', 'Enter the complete confirmation shown for this operation, proposal and revision.', 409)
    // Re-resolve the live target, ownership and preconditions at commit time.
    // All graph service methods used in this transaction are synchronous.
    const { graph, review } = propose(service, edit)
    if (review.candidateRevision !== saved.candidateRevision) refuse('SCOPED_STALE', 'The candidate changed. Cancel and review the current graph.', 409)
    const receipt = service.reopen({ document: exportGraphDocument(graph),
      expectedRevision: edit.expectedRevision, confirmation: 'REOPEN GRAPH' })
    pending.delete(input.proposalId)
    return { ...result, revision: receipt.revision }
  }
  return { run }
}
