import { createHash, randomBytes } from 'node:crypto'
import { types } from 'node:util'
import { createCommandProposal } from './command-proposal.mjs'
import { GraphError, publicDiagnosticId, checkGraphEditText } from './graph-core.mjs'
import { exportGraphDocument } from './graph-evolution.mjs'

const operations = new Map([
  ['page.setRoute', { kind: 'page', table: 'pages', field: 'route', capabilityId: 'lan.page.setRoute@1' }],
  ['node.setLabel', { kind: 'node', table: 'nodes', field: 'label', capabilityId: 'lan.node.setLabel@1' }],
  ['node.planSourceReplacement', { kind: 'node', table: 'nodes', field: 'source', capabilityId: 'lan.node.planSourceReplacement@1' }],
  ['component.setVersion', { kind: 'component', table: 'components', field: 'version', capabilityId: 'lan.component.setVersion@1' }],
])
const id = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/
const hash = /^[a-f0-9]{64}$/
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value)
const publicId = value => publicDiagnosticId(value) ?? 'redacted:' + createHash('sha256').update(value).digest('hex')
const editFields = ['operation', 'target', 'value']
const tables = { page: 'pages', node: 'nodes', component: 'components', collection: 'collections', reference: 'references' }
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

function command(input, available, keys = editFields) {
  if (!plain(input)) refuse('SCOPED_SHAPE', 'Use an explicit command for each target.')
  exact(input, [...keys, ...['capabilityId', 'expectedValue'].filter(field => Object.hasOwn(input, field))])
  exact(input.target, ['kind', 'id'])
  const op = operations.get(input.operation)
  if (!op) refuse('SCOPED_OPERATION', 'Choose a declared scoped operation.')
  if (input.capabilityId !== op.capabilityId) refuse('SCOPED_CAPABILITY', 'This operation requires ' + op.capabilityId + '.', 403)
  if (!available.has(op.capabilityId)) refuse('SCOPED_DISABLED', 'This LAN host has disabled ' + op.capabilityId + '. Choose an enabled operation or contact the local operator.', 403)
  if (input.target.kind !== op.kind) refuse('SCOPED_TARGET_KIND', 'This operation requires a ' + op.kind + ' target.')
  if (!matches(id, input.target.id)) refuse('SCOPED_TARGET_ID', 'Select a qualified target identifier.')
  if (Object.hasOwn(input, 'expectedValue') && input.expectedValue !== null &&
      (typeof input.expectedValue !== 'string' || input.expectedValue.length > 512)) refuse('SCOPED_PRECONDITION', 'Use the exact prior field value as the precondition.')
  return { operation: input.operation, capabilityId: op.capabilityId, target: { kind: op.kind, id: input.target.id }, value: input.value,
    ...(Object.hasOwn(input, 'expectedValue') && { expectedValue: input.expectedValue }) }
}

function atTarget(index, input, fn) {
  try { return fn() }
  catch (error) {
    if (error instanceof ScopedGraphCommandError && plain(input)) {
      const target = Object.getOwnPropertyDescriptor(input, 'target')?.value
      const kind = plain(target) && Object.getOwnPropertyDescriptor(target, 'kind')?.value
      const name = plain(target) && Object.getOwnPropertyDescriptor(target, 'id')?.value
      if (typeof kind === 'string' && (Object.hasOwn(tables, kind) || kind === 'document') && matches(id, name) && !error.details) {
        error.details = { editIndex: index, target: { kind, id: publicId(name) }, condition: error.code }
      }
    }
    throw error
  }
}
function readIntent(input, available) {
  const batch = input.action === 'reviewBatch'
  let edits
  if (batch) {
    exact(input, ['action', 'documentId', 'expectedRevision', 'edits'])
    const list = input.edits
    if (types.isProxy(list) || !Array.isArray(list) || !list.length || list.length > 16 ||
        Reflect.ownKeys(list).length !== list.length + 1) refuse('SCOPED_BATCH_LIMIT', 'Supply between 1 and 16 explicit targets in a dense list.')
    edits = []
    for (let i = 0; i < list.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(list, String(i))
      if (!descriptor || !Object.hasOwn(descriptor, 'value')) refuse('SCOPED_SHAPE', 'Use a plain list of explicit targets.')
      edits.push(atTarget(i, descriptor.value, () => command(descriptor.value, available)))
    }
  } else edits = [atTarget(0, input, () => command(input, available, ['action','documentId','expectedRevision',...editFields]))]
  if (!matches(id, input.documentId)) refuse('SCOPED_TARGET_ID', 'Select an accepted document identifier.')
  if (!matches(hash, input.expectedRevision)) refuse('SCOPED_REVISION', 'Supply the full accepted document revision.')
  return { batch, documentId: input.documentId, expectedRevision: input.expectedRevision, edits }
}

function candidatePlan(service, intent, readSource) {
  let baseline
  try { baseline = service.export({ documentId: intent.documentId }) }
  catch (error) {
    if (error instanceof GraphError && error.code === 'GRAPH_DOCUMENT_MISSING') refuse('SCOPED_DOCUMENT_MISSING', 'Select an accepted graph document.', 404)
    throw error
  }
  if (baseline.revision !== intent.expectedRevision) refuse('SCOPED_STALE', 'The accepted graph changed. Read its current revision and review again.', 409)
  const graph = baseline.document
  const indices = Object.fromEntries(Object.entries(tables).map(([kind, table]) => [kind, new Map(graph[table].map(item => [item.id, item]))]))
  const patches = [], docWrites = new Map(), sourceWrites = [], witnesses = new Map()
  function conflict(message, kind, previous, index, details) {
    const target = i => ({ kind: intent.edits[i].target.kind, id: publicId(intent.edits[i].target.id) })
    const error = new ScopedGraphCommandError('SCOPED_WRITE_CONFLICT', message, 409)
    error.conflict = { kind, firstEditIndex: previous, secondEditIndex: index, firstTarget: target(previous),
      secondTarget: target(index), ...details }
    throw error
  }
  function patch(kind, item, field, value, index) {
    const slot = [kind, item.id, field].join(':')
    if (docWrites.has(slot)) conflict('Two effects write the same document field. Split or remove the conflicting edit.',
      'document', docWrites.get(slot), index, { field })
    docWrites.set(slot, index)
    patches.push({ kind, item, field, value, index })
  }
  function sourceOf(node) {
    const mapping = node.source
    if (!witnesses.has(mapping.path)) {
      if (witnesses.size >= 32) refuse('SCOPED_EFFECT_LIMIT', 'Review at most 32 affected source files in one batch.', 413)
      const live = readSource?.(mapping.path)
      if (!live || !matches(hash, live.revision) || typeof live.stamp !== 'string' || !Number.isSafeInteger(live.length)) {
        refuse('SCOPED_SOURCE_UNAVAILABLE', 'A mapped source file is missing or unavailable. Restore it and review again.', 409)
      }
      witnesses.set(mapping.path, live)
    }
    const live = witnesses.get(mapping.path)
    if (live.revision !== mapping.sourceRevision || mapping.end > live.length) {
      refuse('SCOPED_SOURCE_STALE', 'A mapped source revision or span changed. Refresh the graph mapping and review again.', 409)
    }
    return live
  }
  function check(edit, index) {
    const op = operations.get(edit.operation)
    const target = indices[op.kind].get(edit.target.id)
    if (!target) {
      if (Object.values(indices).some(items => items.has(edit.target.id))) refuse('SCOPED_TARGET_KIND', 'The selected identifier does not resolve to a ' + op.kind + ' in this document.')
      refuse('SCOPED_TARGET_MISSING', 'The selected target is absent from the accepted document.', 404)
    }
    const stack = [op.kind === 'node' ? target : indices.node.get(target.rootId)]
    const mappings = []
    let owned = false
    while (stack.length) {
      const node = stack.pop()
      if (node.source) mappings.push(node)
      if (node.kind !== 'opaque' && node.ownership === 'source-owned' && node.source && graph.sourceRevision && node.source.sourceRevision === graph.sourceRevision) owned = true
      if (op.kind !== 'node') for (const child of node.childIds) stack.push(indices.node.get(child))
    }
    if (!owned) refuse('SCOPED_OWNER_REQUIRED', 'Select a target with a source-owned editable mapping at the accepted source revision.', 403)
    for (const mapped of mappings) sourceOf(mapped)
    const { value } = edit
    if (typeof value !== 'string' || !value.length || value.length > (op.kind === 'page' ? 512 : 120) || /[\x00-\x1f\x7f]/.test(value)) {
      refuse('SCOPED_VALUE', 'Use a nonempty bounded text value for the selected field.')
    }
    if (edit.operation === 'node.planSourceReplacement') {
      if (Object.hasOwn(edit, 'expectedValue')) refuse('SCOPED_PRECONDITION', 'Source range plans bind the source revision and mapped span.')
      const { path, start, end } = target.source
      if (!witnesses.get(path).writable) refuse('SCOPED_OWNER_REQUIRED', 'Select a writable authored source mapping for a replacement plan.', 403)
      const overlaps = sourceWrites.find(other => other.path === path && (start === end || other.start === other.end
        ? start <= other.end && other.start <= end : start < other.end && other.start < end))
      if (overlaps) conflict('Source replacements overlap on the same mapped file. Select disjoint ranges.', 'source', overlaps.index, index, {
        ownerId: 'source:' + createHash('sha256').update(path).digest('hex'),
        firstRange: { start: overlaps.start, end: overlaps.end }, secondRange: { start, end },
      })
      sourceWrites.push({ path, start, end, index })
      return
    }
    try { checkGraphEditText(value, op.table, op.field) }
    catch (error) {
      if (!(error instanceof GraphError)) throw error
      refuse('SCOPED_VALUE', 'The proposed field contains unsupported metadata.')
    }
    if (Object.hasOwn(edit, 'expectedValue') && edit.expectedValue !== target[op.field]) refuse('SCOPED_PRECONDITION', 'The target field differs from its declared prior value.', 409)
    if (op.kind === 'page' && !/^\/(?:[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*)?$/.test(value)) refuse('SCOPED_ROUTE', 'Use a local route beginning with / and simple path segments.')
    if (target[op.field] === value) refuse('SCOPED_NO_EFFECT', 'The target already has this value; select a change to review.')
    patch(op.kind, target, op.field, value, index)
    if (op.kind === 'component') {
      for (const ref of graph.references) {
        if (ref.kind === 'component' && ref.documentId === graph.documentId && ref.targetId === target.id && ref.expectedVersion === target.version) {
          patch('reference', ref, 'expectedVersion', value, index)
        }
      }
    }
  }
  intent.edits.forEach((edit, i) => atTarget(i, edit, () => check(edit, i)))
  if (sourceWrites.length) {
    const { index } = sourceWrites[0]
    atTarget(index, intent.edits[index], () => refuse('SCOPED_SOURCE_PROMOTION_UNAVAILABLE', 'Source write ranges are checked for conflicts. This service commits graph metadata only.'))
  }
  // Route constraints are checked on the final set, so swapping routes is atomic
  // and an edit cannot win simply because it was first in the request.
  const routes = new Map(patches.filter(p => p.kind === 'page').map(p => [p.item.id, p]))
  for (const patch of routes.values()) {
    if (graph.pages.some(other => other.id !== patch.item.id && (routes.get(other.id)?.value ?? other.route) === patch.value)) {
      atTarget(patch.index, intent.edits[patch.index], () => refuse('SCOPED_ROUTE_USED', 'Two pages would share this route. Choose distinct routes.', 409))
    }
  }
  const candidate = structuredClone(graph)
  const next = Object.fromEntries(Object.entries(tables).map(([kind, table]) => [kind, new Map(candidate[table].map(item => [item.id, item]))]))
  for (const p of patches) next[p.kind].get(p.item.id)[p.field] = p.value
  let review
  try { review = createCommandProposal({ baseline, candidate, expectedRevision: intent.expectedRevision }) }
  catch (error) {
    if (!(error instanceof GraphError)) throw error
    if (error.code === 'COMMAND_EFFECT_LIMIT') refuse('SCOPED_EFFECT_LIMIT', 'This change exceeds the complete semantic review limit.', 413)
    refuse('SCOPED_VALUE', 'The proposed values or their references cannot form a valid canonical graph.')
  }
  const affected = review.effects.changed.map(({kind, id}) => ({kind, id}))
  const unaffected = Object.fromEntries(Object.entries(tables).map(([kind, field]) => [field, graph[field].length - affected.filter(row => row.kind === kind).length]))
  const sources = [...witnesses].map(([path, live]) => [path, live.revision, live.stamp])
  return { candidate, review, sources, scope: { affected, unaffected, outsideSelection: 'all-other-objects-and-documents-unchanged', sourceWrites: false } }
}

export function createScopedGraphCommands(service, { now = Date.now, capabilitySetting, readSource } = {}) {
  const available = enabledCapabilities(capabilitySetting)
  const pending = new Map()
  // Keep only the reason for a bounded interval after retirement, never the draft.
  const closed = new Map()
  function retire(key, reason) {
    pending.delete(key)
    if (closed.size >= 100) closed.delete(closed.keys().next().value)
    closed.set(key, { reason, until: now() + lifetimeMs })
  }
  function run(input) {
    for (const [key, entry] of closed) if (now() >= entry.until) closed.delete(key)
    for (const [key, saved] of pending) if (now() >= saved.expiresAt) retire(key, 'expired')
    const action = plain(input) && Object.getOwnPropertyDescriptor(input, 'action')?.value
    if (action === 'review' || action === 'reviewBatch') {
      const intent = readIntent(input, available)
      const document = { target: { kind: 'document', id: intent.documentId } }
      const { review, sources, scope } = atTarget(null, document, () => candidatePlan(service, intent, readSource))
      const generation = service.headGeneration(intent.documentId)
      for (const [key, saved] of pending) {
        if (saved.intent.documentId !== intent.documentId) continue
        if (saved.generation === generation && saved.intent.expectedRevision === intent.expectedRevision &&
            saved.sources.every(([path, revision, stamp]) => {
              const live = readSource?.(path)
              return live?.revision === revision && live.stamp === stamp
            })) refuse('SCOPED_OVERLAP', 'Another proposal holds this document revision. Cancel it or wait for it to expire.', 409)
        retire(key, saved.generation !== generation ? 'document-changed' : 'source-changed')
      }
      if (pending.size >= 50) refuse('SCOPED_CAPACITY', 'The session has 50 pending proposals. Cancel one or wait for expiry.', 429)
      const proposalId = randomBytes(32).toString('hex'), documentId = publicId(intent.documentId)
      const targets = intent.edits.map(({ target }) => ({ kind: target.kind, id: publicId(target.id) }))
      const operation = intent.batch ? 'graph.batch' : intent.edits[0].operation
      const capabilityId = intent.batch ? 'lan.graph.batch@1' : intent.edits[0].capabilityId
      const confirmationText = 'APPLY ' + operation + ' ' + proposalId + ' AT ' + intent.expectedRevision
      const expiresAt = now() + lifetimeMs
      pending.set(proposalId, { intent, generation, sources, expiresAt, confirmationText, candidateRevision: review.candidateRevision })
      return { proposalId, confirmationText, expiresAt, operation, capabilityId, documentId,
        target: intent.batch ? { kind: 'document', id: documentId } : targets[0],
        ...(intent.batch && { targets, scope,
          sourceChecks: sources.map(([path, revision]) => ({ ownerId: 'source:' + createHash('sha256').update(path).digest('hex'), revision })),
          preconditions: intent.edits.map((edit, i) => ({ target: targets[i], capabilityId: edit.capabilityId,
            expectedValueChecked: Object.hasOwn(edit, 'expectedValue') })),
        }),
        targetRevision: review.targetRevision, candidateRevision: review.candidateRevision, sourceRevision: review.sourceRevision,
        domainEffect: 'accept-local-memory', sourceWrites: false, effects: review.effects, owners: review.owners }
    }
    if (action !== 'cancel' && action !== 'confirm') refuse('SCOPED_ACTION', 'Choose review, reviewBatch, cancel or confirm.')
    exact(input, action === 'confirm' && Object.hasOwn(input, 'confirmation') ? [...decisionFields, 'confirmation'] : decisionFields)
    const saved = typeof input.proposalId === 'string' && pending.get(input.proposalId)
    if (!saved) {
      const error = new ScopedGraphCommandError('SCOPED_PROPOSAL_MISSING', 'The proposal is no longer active. Review the draft again.', 404)
      error.reason = closed.get(input.proposalId)?.reason
      throw error
    }
    const { intent } = saved
    if (input.expectedRevision !== intent.expectedRevision) refuse('SCOPED_REVISION', 'Use the exact target revision shown in this proposal.', 409)
    const result = { documentId: publicId(intent.documentId), proposalId: input.proposalId }
    if (action === 'cancel') {
      retire(input.proposalId, 'canceled')
      return { ...result, canceled: true, targetRevision: intent.expectedRevision }
    }
    if (!Object.hasOwn(input, 'confirmation') || input.confirmation !== saved.confirmationText) refuse('SCOPED_CONFIRMATION', 'Enter the complete confirmation shown for this operation, proposal and revision.', 409)
    try {
      if (service.headGeneration(intent.documentId) !== saved.generation) refuse('SCOPED_STALE', 'The document revision changed after review. Review the current graph again.', 409)
      const plan = candidatePlan(service, intent, readSource)
      if (JSON.stringify(plan.sources) !== JSON.stringify(saved.sources)) refuse('SCOPED_SOURCE_STALE', 'A source file changed after review. Refresh its mapping and review again.', 409)
      if (plan.review.candidateRevision !== saved.candidateRevision) refuse('SCOPED_STALE', 'The candidate changed. Review the current graph again.', 409)
      const exported = exportGraphDocument(plan.candidate)
      for (const [path, revision, stamp] of saved.sources) {
        const live = readSource?.(path)
        if (live?.revision !== revision || live.stamp !== stamp) refuse('SCOPED_SOURCE_STALE', 'A mapped file changed during confirmation. Review its current source again.', 409)
      }
      const receipt = service.reopen({ document: exported, expectedRevision: intent.expectedRevision, confirmation: 'REOPEN GRAPH' })
      retire(input.proposalId, 'confirmed')
      return { ...result, revision: receipt.revision }
    } catch (error) {
      if (error instanceof ScopedGraphCommandError && !error.details) {
        error.details = { editIndex: null, target: { kind: 'document', id: result.documentId }, condition: error.code }
      }
      let reason = 'precondition-failed'
      if (error?.code === 'SCOPED_STALE') reason = 'document-changed'
      if (error?.code === 'SCOPED_SOURCE_STALE' || error?.code === 'SCOPED_SOURCE_UNAVAILABLE') reason = 'source-changed'
      retire(input.proposalId, reason)
      throw error
    }
  }
  return { run }
}
