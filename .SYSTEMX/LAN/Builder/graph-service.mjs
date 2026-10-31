import { createHash } from 'node:crypto'
import { types } from 'node:util'
import { GraphError } from './graph-core.mjs'
import { validateGraph, resolveGraphReference, filterGraphFindings } from './graph-validation.mjs'
import { compareGraphs, previewGraphMigration, applyGraphMigration,
  exportGraphDocument, reopenGraphDocument } from './graph-evolution.mjs'
import { graphFromIdentity } from './graph-identity-adapter.mjs'

const HASH = /^[a-f0-9]{64}$/
const IDENTIFIER = /^[A-Za-z][A-Za-z0-9_-]{0,95}$/
const LIMITS = Object.freeze({ acceptedDocuments: 50, pendingProposals: 50, revisionsPerDocument: 10 })

function refuse(code, message, { category = 'validation', statusCode = 400, findings = [], omittedCount = 0 } = {}) {
  throw new GraphError(code, message, { category, statusCode, findings, omittedCount })
}
function copy(value) { return JSON.parse(JSON.stringify(value)) }
function digest(value) { return createHash('sha256').update(value).digest('hex') }
function options(value, keys) {
  if (value === undefined) return {}
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    refuse('GRAPH_ARGUMENT_INVALID', 'Use an object with the declared graph fields.')
  }
  const descriptors = Object.getOwnPropertyDescriptors(value)
  if (Reflect.ownKeys(value).some(key => typeof key !== 'string' || !keys.includes(key)
    || !Object.hasOwn(descriptors[key], 'value'))) {
    refuse('GRAPH_ARGUMENT_INVALID', 'Use only the declared graph fields as data properties.')
  }
  return value
}
function documentId(value) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) refuse('GRAPH_DOCUMENT_ID_INVALID', 'Choose a valid document identifier.')
  return value
}
function revision(value) {
  if (typeof value !== 'string' || !HASH.test(value)) refuse('GRAPH_REVISION_INVALID', 'Choose an exact graph revision.')
  return value
}
function expectedRevision(value, exists, current) {
  if (value === undefined || value !== (exists ? current : null)) {
    refuse('GRAPH_REVISION_CONFLICT', 'The accepted graph changed. Reload it and preview again.', { category: 'conflict', statusCode: 409 })
  }
}
function attemptedRevision(value) {
  if (!value || typeof value !== 'object' || types.isProxy(value) || Array.isArray(value)) return null
  const d = Object.getOwnPropertyDescriptor(value, 'sourceRevision')
  return d && Object.hasOwn(d, 'value') && typeof d.value === 'string' && HASH.test(d.value) ? d.value : null
}
function recordField(record, key) {
  if (!record || typeof record !== 'object' || types.isProxy(record) || Array.isArray(record)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(record))) return undefined
  const descriptor = Object.getOwnPropertyDescriptor(record, key)
  if (descriptor && !Object.hasOwn(descriptor, 'value')) {
    refuse('GRAPH_IDENTITY_INVALID', 'The identity read result must use data properties.')
  }
  return descriptor?.value
}
function previewFailure(error, sourceRevision) {
  const known = error instanceof GraphError
  const code = known ? error.code : typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code)
    ? error.code : 'GRAPH_PREVIEW_FAILED'
  const findingLimit = sourceRevision ? 49 : 50
  const findings = known && Array.isArray(error.findings) ? error.findings.slice(0, findingLimit) : []
  const omittedCount = (known && Number.isSafeInteger(error.omittedCount) ? error.omittedCount : 0)
    + (known && Array.isArray(error.findings) && error.findings.length > findingLimit ? error.findings.length - findingLimit : 0)
  if (sourceRevision) findings.push({ id: `finding_${digest(`graph-import:${sourceRevision}`)}`,
    code: 'GRAPH_SOURCE_REVISION_REFUSED', severity: 'error', objectId: null, referenceType: null,
    message: `Source revision ${sourceRevision} could not be imported; the previous accepted graph remains available.` })
  return new GraphError(code, known ? error.message : 'Graph preview failed; the previous accepted graph remains available.',
    { category: known ? error.category : 'validation', statusCode: known ? error.statusCode : 400, findings, omittedCount })
}

/** One-workspace, memory-only accepted graph and proposal store. */
export function createGraphService({ workspaceId, readIdentityDocument, readIdentityStatus } = {}) {
  if (typeof workspaceId !== 'string' || !HASH.test(workspaceId)
    || readIdentityDocument !== undefined && typeof readIdentityDocument !== 'function'
    || readIdentityStatus !== undefined && typeof readIdentityStatus !== 'function') {
    refuse('GRAPH_CONFIGURATION_INVALID', 'Configure one valid workspace and identity read callbacks.')
  }
  const accepted = new Map()
  const pending = new Map()
  const previewRequests = new Map()
  let activePreviews = 0
  let sequence = 0

  // Request generations fence asynchronous identity reads. A later preview or
  // accepted store cannot be replaced by an earlier read finishing late.
  // Entries exist only while requests are in flight, so refused document IDs
  // cannot grow an unbounded long-lived generation map.
  function beginPreview(id) {
    if (activePreviews >= LIMITS.pendingProposals) {
      refuse('GRAPH_PREVIEW_LIMIT', 'The concurrent graph preview limit is reached.', { statusCode: 413 })
    }
    const record = previewRequests.get(id) ?? { latest: 0, active: 0 }
    const generation = ++sequence
    record.latest = generation
    record.active += 1
    activePreviews += 1
    previewRequests.set(id, record)
    return { id, generation }
  }
  function finishPreview(ticket) {
    const record = previewRequests.get(ticket.id)
    record.active -= 1
    activePreviews -= 1
    if (record.active === 0) previewRequests.delete(ticket.id)
  }
  function checkPreview(ticket) {
    if (previewRequests.get(ticket.id)?.latest !== ticket.generation) {
      refuse('GRAPH_PREVIEW_SUPERSEDED', 'A newer graph request superseded this preview. Review the latest request.',
        { category: 'conflict', statusCode: 409 })
    }
  }
  function fencePreview(id) {
    const record = previewRequests.get(id)
    if (record) record.latest = ++sequence
  }

  function current(id) {
    const record = accepted.get(documentId(id))
    if (!record) refuse('GRAPH_DOCUMENT_MISSING', 'The accepted graph document was not found.',
      { category: 'missing-target', statusCode: 404 })
    return record
  }
  function snapshotAt(id, requestedRevision) {
    const record = current(id)
    const selected = requestedRevision === undefined ? record.current : revision(requestedRevision)
    const snapshot = record.history.get(selected)
    if (!snapshot) refuse('GRAPH_REVISION_MISSING', 'The accepted graph revision is no longer in history.',
      { category: 'missing-target', statusCode: 404 })
    return snapshot
  }
  function publicSnapshot(snapshot) {
    return copy({ document: snapshot.document, revision: snapshot.revision,
      stats: snapshot.stats, findings: snapshot.findings, omittedCount: snapshot.omittedCount })
  }
  function discardPending(id) {
    for (const [key, proposal] of pending) if (proposal.documentId === id) pending.delete(key)
  }
  function hold(id, kind, proposal, proposedDigest) {
    const existing = [...pending.values()].filter(item => item.documentId === id).length
    if (!existing && pending.size >= LIMITS.pendingProposals) {
      refuse('GRAPH_PROPOSAL_LIMIT', 'The pending graph proposal limit is reached.', { statusCode: 413 })
    }
    discardPending(id)
    pending.set(proposedDigest, { kind, documentId: id, proposal })
  }
  function store(validated) {
    const id = documentId(validated.graph.documentId)
    let record = accepted.get(id)
    if (!record && accepted.size >= LIMITS.acceptedDocuments) {
      refuse('GRAPH_DOCUMENT_LIMIT', 'The accepted graph document limit is reached.', { statusCode: 413 })
    }
    const snapshot = copy({ document: validated.graph, revision: validated.revision,
      stats: validated.stats, findings: validated.findings, omittedCount: validated.omittedCount })
    if (!record) { record = { current: validated.revision, history: new Map() }; accepted.set(id, record) }
    record.history.delete(validated.revision)
    record.history.set(validated.revision, snapshot)
    while (record.history.size > LIMITS.revisionsPerDocument) record.history.delete(record.history.keys().next().value)
    record.current = validated.revision
    fencePreview(id)
    discardPending(id)
    return publicSnapshot(snapshot)
  }

  return {
    status() {
      return { workspaceId, documents: [...accepted.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([id, record]) => {
        const snapshot = record.history.get(record.current)
        return copy({ documentId: id, revision: snapshot.revision,
          sourceRevision: snapshot.document.sourceRevision, stats: snapshot.stats })
      }), limits: { ...LIMITS } }
    },

    async preview(input) {
      const args = options(input, ['document', 'identityDocumentId'])
      const hasDocument = Object.hasOwn(args, 'document')
      const hasIdentity = Object.hasOwn(args, 'identityDocumentId')
      if (hasDocument === hasIdentity) refuse('GRAPH_PREVIEW_INPUT_INVALID', 'Select exactly one graph document or identity document.')
      const selectedId = documentId(hasIdentity ? args.identityDocumentId : recordField(args.document, 'documentId'))
      const ticket = beginPreview(selectedId)
      let sourceRevision = hasDocument ? attemptedRevision(args.document) : null
      let graph
      try {
        if (hasIdentity) {
          const id = documentId(args.identityDocumentId)
          if (!readIdentityDocument) refuse('GRAPH_IDENTITY_UNAVAILABLE', 'Identity document reading is unavailable.',
            { category: 'capability', statusCode: 400 })
          if (readIdentityStatus) {
            const status = await readIdentityStatus()
            const documents = recordField(status, 'documents')
            if (recordField(status, 'workspaceId') !== workspaceId || !Array.isArray(documents)
              || !documents.some(item => recordField(item, 'documentId') === id)) {
              refuse('GRAPH_IDENTITY_MISSING', 'The identity document is not accepted in this workspace.',
                { category: 'missing-target', statusCode: 404 })
            }
          }
          const identity = await readIdentityDocument({ documentId: id })
          sourceRevision = attemptedRevision(recordField(identity, 'map')) ?? attemptedRevision(identity)
          if (recordField(identity, 'stale') === true) {
            sourceRevision = attemptedRevision({ sourceRevision: recordField(identity, 'currentRevision') }) ?? sourceRevision
            refuse('GRAPH_IDENTITY_STALE', 'The identity source changed. Reconcile it before graph import.',
              { category: 'conflict', statusCode: 409 })
          }
          graph = graphFromIdentity(identity)
          if (graph.documentId !== id || graph.workspaceId !== workspaceId) {
            refuse('GRAPH_WORKSPACE_MISMATCH', 'The identity document belongs to another workspace.',
              { category: 'conflict', statusCode: 409 })
          }
        } else graph = args.document
        const validated = validateGraph(graph)
        if (validated.graph.workspaceId !== workspaceId) refuse('GRAPH_WORKSPACE_MISMATCH',
          'The graph document belongs to another workspace.', { category: 'conflict', statusCode: 409 })
        const id = documentId(validated.graph.documentId)
        if (id !== ticket.id) refuse('GRAPH_DOCUMENT_ID_INVALID', 'The preview document identity changed while it was read.')
        checkPreview(ticket)
        const proposalDigest = digest(JSON.stringify(['graph-preview', workspaceId, id, validated.revision, ++sequence]))
        hold(id, 'graph', validated, proposalDigest)
        return copy({ digest: proposalDigest, documentId: id, revision: validated.revision,
          sourceRevision: validated.graph.sourceRevision, stats: validated.stats,
          findings: validated.findings, omittedCount: validated.omittedCount, document: validated.graph })
      } catch (error) { throw previewFailure(error, sourceRevision) }
      finally { finishPreview(ticket) }
    },

    accept(input) {
      const args = options(input, ['digest', 'expectedRevision', 'confirmation'])
      if (args.confirmation !== 'ACCEPT GRAPH') refuse('GRAPH_CONFIRMATION_REQUIRED', 'Type ACCEPT GRAPH to accept the preview.',
        { category: 'confirmation' })
      if (typeof args.digest !== 'string' || !HASH.test(args.digest)) refuse('GRAPH_DIGEST_INVALID', 'Select an exact graph preview digest.')
      const entry = pending.get(args.digest)
      if (!entry || entry.kind !== 'graph') refuse('GRAPH_PROPOSAL_MISSING', 'The graph preview is missing or superseded.',
        { category: 'missing-target', statusCode: 404 })
      const record = accepted.get(entry.documentId)
      expectedRevision(args.expectedRevision, Boolean(record), record?.current)
      return store(entry.proposal)
    },

    read(input) {
      const args = options(input, ['documentId', 'revision'])
      return publicSnapshot(snapshotAt(args.documentId,
        Object.hasOwn(args, 'revision') ? revision(args.revision) : undefined))
    },

    findings(input) {
      const args = options(input, ['documentId', 'severity', 'objectId', 'referenceType', 'offset', 'limit'])
      const snapshot = snapshotAt(args.documentId)
      const { documentId: _documentId, ...filters } = args
      const filtered = filterGraphFindings(snapshot.findings, filters)
      return copy({ ...filtered, revision: snapshot.revision, totalScope: 'retained-findings',
        upstreamOmittedCount: snapshot.omittedCount,
        omittedCount: filtered.omittedCount + snapshot.omittedCount })
    },

    lookup(input) {
      const args = options(input, ['workspaceId', 'documentId', 'id', 'kind'])
      if (args.workspaceId !== workspaceId) refuse('GRAPH_WORKSPACE_MISMATCH', 'The graph reference belongs to another workspace.',
        { category: 'missing-target', statusCode: 404 })
      const snapshot = snapshotAt(args.documentId)
      return copy(resolveGraphReference(snapshot.document, args))
    },

    compare(input) {
      const args = options(input, ['documentId', 'beforeRevision', 'afterRevision'])
      const before = snapshotAt(args.documentId, revision(args.beforeRevision))
      const after = snapshotAt(args.documentId, revision(args.afterRevision))
      return copy(compareGraphs(before.document, after.document))
    },

    export(input) {
      const args = options(input, ['documentId'])
      return copy(exportGraphDocument(snapshotAt(args.documentId).document))
    },

    reopen(input) {
      const args = options(input, ['document', 'expectedRevision', 'confirmation'])
      if (args.confirmation !== 'REOPEN GRAPH') refuse('GRAPH_CONFIRMATION_REQUIRED', 'Type REOPEN GRAPH to reopen this graph.',
        { category: 'confirmation' })
      const graph = reopenGraphDocument(args.document)
      if (graph.workspaceId !== workspaceId) refuse('GRAPH_WORKSPACE_MISMATCH', 'The graph export belongs to another workspace.',
        { category: 'conflict', statusCode: 409 })
      const record = accepted.get(documentId(graph.documentId))
      expectedRevision(args.expectedRevision, Boolean(record), record?.current)
      return store(validateGraph(graph))
    },

    migrationPreview(input) {
      const args = options(input, ['document', 'targetVersion'])
      const preview = previewGraphMigration(args.document, { targetVersion: Object.hasOwn(args, 'targetVersion') ? args.targetVersion : 1 })
      if (preview.document.workspaceId !== workspaceId) refuse('GRAPH_WORKSPACE_MISMATCH',
        'The migrated graph belongs to another workspace.', { category: 'conflict', statusCode: 409 })
      const id = documentId(preview.document.documentId)
      fencePreview(id)
      const proposalDigest = digest(JSON.stringify(['graph-migration-preview', workspaceId, id, preview.digest, ++sequence]))
      hold(id, 'migration', preview, proposalDigest)
      return copy({ ...preview, digest: proposalDigest })
    },

    migrationApply(input) {
      const args = options(input, ['digest', 'confirmation'])
      if (typeof args.digest !== 'string' || !HASH.test(args.digest)) refuse('GRAPH_DIGEST_INVALID', 'Select an exact migration preview digest.')
      const entry = pending.get(args.digest)
      if (!entry || entry.kind !== 'migration') refuse('GRAPH_PROPOSAL_MISSING', 'The migration preview is missing or superseded.',
        { category: 'missing-target', statusCode: 404 })
      const graph = applyGraphMigration(entry.proposal, { digest: entry.proposal.digest, confirmation: args.confirmation })
      const validated = validateGraph(graph)
      pending.delete(args.digest)
      return copy({ document: validated.graph, revision: validated.revision, isolatedCopy: true })
    },
  }
}
