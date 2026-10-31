import { realpathSync } from 'node:fs'
import { inspectSourcePath, isCanonicalSourcePath, sourcePolicyLimits } from './source-policy.mjs'
import { hashSourceRevision } from './source-revision.mjs'
import { validateIdentityMap, resolveIdentity } from './identity-core.mjs'
import { previewReconciliation, acceptReconciliation, exportIdentityMap } from './identity-reconciliation.mjs'
import { buildOwnership, inspectOwnership, planLiteralOperation, previewOwnershipChange, acceptOwnershipChange, exportOwnershipDiagnostics } from './source-ownership.mjs'
import { parseSourceIdentity } from './source-identity-adapter.mjs'

const RULE_VERSION = 'identity-v1'
const MAX_DOCUMENTS = 50
const MAX_PROPOSALS = 50
const MAX_JSON_BYTES = 400_000
const HASH = /^[a-f0-9]{64}$/

function refused(code, statusCode = 400) {
  const error = new Error('Source identity request refused. Reload the selected source and review the code.')
  error.code = code
  error.statusCode = statusCode
  return error
}

function contained(error, fallback = 'SOURCE_IDENTITY_FAILED') {
  if (error?.message === 'Source identity request refused. Reload the selected source and review the code.' && error?.code) return error
  const code = typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(error.code) ? error.code : fallback
  return refused(code, Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 400)
}

function boundedCopy(value, code = 'SOURCE_IDENTITY_LIMIT') {
  let serialized
  try { serialized = JSON.stringify(value) } catch { throw refused('SOURCE_IDENTITY_INVALID') }
  if (typeof serialized !== 'string' || Buffer.byteLength(serialized, 'utf8') > MAX_JSON_BYTES) throw refused(code, 413)
  return JSON.parse(serialized)
}

function identityPath(path) {
  if (!isCanonicalSourcePath(path)) throw refused('SOURCE_PATH_INVALID')
  return path
}

function selectedRecord(records, { documentId, path } = {}) {
  if (documentId === undefined && path === undefined) return null
  if (documentId !== undefined && (typeof documentId !== 'string' || !/^doc_[a-f0-9]{64}$/.test(documentId))) throw refused('SOURCE_IDENTITY_REFERENCE_INVALID')
  if (path !== undefined) identityPath(path)
  const byId = documentId === undefined ? null : records.get(documentId) ?? null
  const byPath = path === undefined ? null : [...records.values()].find(record => record.map.sourcePath === path) ?? null
  if (documentId !== undefined && path !== undefined && byId !== byPath) return null
  return byId ?? byPath
}

function cleanReopenMap(exported) {
  if (!exported || typeof exported !== 'object' || Array.isArray(exported) || !Array.isArray(exported.nodes)) throw refused('SOURCE_IDENTITY_EXPORT_INVALID')
  const nodes = exported.nodes.map(node => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) throw refused('SOURCE_IDENTITY_EXPORT_INVALID')
    return {
      id: node.id, parentId: node.parentId, tag: node.tag, anchor: node.anchor, signature: node.signature,
      label: '', confidence: node.confidence, source: node.source, fields: node.fields,
      opaque: node.opaque, external: node.external,
      ...(Object.hasOwn(node, 'definition') ? { definition: node.definition } : {}),
    }
  })
  return {
    schemaVersion: exported.schemaVersion, ruleVersion: exported.ruleVersion, workspaceId: exported.workspaceId,
    documentId: exported.documentId, pageId: exported.pageId, sourcePath: exported.sourcePath,
    sourceRevision: exported.sourceRevision, route: exported.route, label: '', nodes,
    aliases: exported.aliases ?? [], orphaned: exported.orphaned ?? [], warnings: [],
  }
}

function safeDiagnostics(diagnostics) {
  if (!Array.isArray(diagnostics) || diagnostics.length > 1000) throw refused('SOURCE_IDENTITY_DIAGNOSTIC_LIMIT', 413)
  return diagnostics.map(item => ({
    code: typeof item?.code === 'string' && /^[A-Z][A-Z0-9_]{1,63}$/.test(item.code) ? item.code : 'SOURCE_IDENTITY_DIAGNOSTIC',
    ...(item?.severity === 'error' || item?.severity === 'warning' || item?.severity === 'info' ? { severity: item.severity } : {}),
  }))
}

function validateSourceSpans(map, content) {
  if (map.sourceRevision === undefined || !HASH.test(map.sourceRevision) || !Array.isArray(map.nodes)) throw refused('SOURCE_IDENTITY_SPAN_INVALID')
  const validSpan = span => span && span.path === map.sourcePath && span.sourceRevision === map.sourceRevision
    && Number.isInteger(span.start) && Number.isInteger(span.end) && span.start >= 0 && span.end >= span.start
    && span.end <= content.length && typeof span.fingerprint === 'string' && HASH.test(span.fingerprint)
    && hashSourceRevision(content.slice(span.start, span.end)) === span.fingerprint
  for (const node of map.nodes) {
    if (!validSpan(node.source)) throw refused('SOURCE_IDENTITY_SPAN_INVALID', 409)
    if (node.definition?.sourcePath !== undefined && !isCanonicalSourcePath(node.definition.sourcePath)) throw refused('SOURCE_IDENTITY_SPAN_INVALID', 409)
    if (Object.hasOwn(node.fields ?? {}, 'text') && !validSpan({ ...node.fields.text, path: map.sourcePath, sourceRevision: map.sourceRevision })) {
      throw refused('SOURCE_IDENTITY_SPAN_INVALID', 409)
    }
  }
  return map
}

/** In-memory, one-workspace authority for explicit source identity acceptance. */
export function createSourceIdentityService(root, { readSource, workspaceId } = {}) {
  if (typeof root !== 'string' || !root || (readSource !== undefined && typeof readSource !== 'function')) throw refused('SOURCE_IDENTITY_CONFIGURATION_INVALID')
  let rootIdentity
  try { rootIdentity = hashSourceRevision(`systemx-workspace\0${realpathSync(root)}`) } catch { throw refused('SOURCE_IDENTITY_WORKSPACE_INVALID') }
  if (workspaceId !== undefined && (typeof workspaceId !== 'string' || !HASH.test(workspaceId) || workspaceId !== rootIdentity)) throw refused('SOURCE_IDENTITY_WORKSPACE_INVALID')
  let activeWorkspaceId = workspaceId ?? rootIdentity
  const accepted = new Map()
  const proposals = new Map()
  const ownershipProposals = new Map()

  function currentWorkspace() {
    let current
    try { current = hashSourceRevision(`systemx-workspace\0${realpathSync(root)}`) } catch { throw refused('SOURCE_IDENTITY_WORKSPACE_INVALID') }
    if (current !== rootIdentity) {
      rootIdentity = current
      activeWorkspaceId = current
      accepted.clear()
      proposals.clear()
      ownershipProposals.clear()
      throw refused('SOURCE_IDENTITY_WORKSPACE_CHANGED', 409)
    }
    return activeWorkspaceId
  }

  function readEligible(path, { forWrite = false } = {}) {
    identityPath(path)
    const inspected = inspectSourcePath(root, path, { read: true, forWrite })
    if (inspected.error) throw refused(inspected.code, inspected.statusCode)
    if (inspected.metadata.extension !== '.tsx') throw refused('SOURCE_IDENTITY_ADAPTER_UNSUPPORTED', 415)
    let source
    try {
      source = readSource ? readSource(path) : {
        content: inspected.content,
        revision: hashSourceRevision(inspected.bytes),
      }
    } catch (error) { throw contained(error, 'SOURCE_IDENTITY_READ_FAILED') }
    if (!source || typeof source.content !== 'string' || typeof source.revision !== 'string' || !HASH.test(source.revision)
      || source.content.includes('\0') || source.content.length > sourcePolicyLimits.maxTextUnits
      || Buffer.byteLength(source.content, 'utf8') > sourcePolicyLimits.maxBytes) throw refused('SOURCE_IDENTITY_SOURCE_INVALID')
    currentWorkspace()
    return { content: source.content, revision: source.revision, metadata: inspected.metadata }
  }

  function reportFor(record, revision) {
    return boundedCopy(buildOwnership(record.map, { claims: record.claims, currentRevision: revision }))
  }

  function observed(record) {
    try {
      const source = readEligible(record.map.sourcePath)
      return { revision: source.revision, content: source.content, sourceErrorCode: null }
    } catch (error) {
      if (error.code === 'SOURCE_IDENTITY_WORKSPACE_CHANGED' || error.code === 'SOURCE_IDENTITY_WORKSPACE_INVALID') throw error
      return { revision: '0'.repeat(64), content: null, sourceErrorCode: contained(error).code }
    }
  }

  function requireRecord(selector) {
    const record = selectedRecord(accepted, selector)
    if (!record) throw refused('SOURCE_IDENTITY_DOCUMENT_MISSING', 404)
    return record
  }

  function ensureRevision(record) {
    const source = readEligible(record.map.sourcePath)
    if (source.revision !== record.map.sourceRevision) throw refused('SOURCE_IDENTITY_STALE', 409)
    return source
  }

  function lookupReference(reference) {
    const workspace = currentWorkspace()
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) throw refused('SOURCE_IDENTITY_REFERENCE_INVALID')
    if (reference.workspaceId !== workspace) return { status: 'workspace-mismatch' }
    if (typeof reference.documentId !== 'string') throw refused('SOURCE_IDENTITY_REFERENCE_INVALID')
    const record = accepted.get(reference.documentId)
    if (!record) return { status: 'missing' }
    return boundedCopy(resolveIdentity(record.map, reference))
  }

  return {
    preview({ path, route = '/', label = '', renameFrom = null, aliases = [], ruleVersion = RULE_VERSION } = {}) {
      try {
        const workspace = currentWorkspace()
        if (typeof route !== 'string' || route.length > 512 || !route.startsWith('/') || /[\\\x00-\x1f\x7f]/.test(route)
          || typeof label !== 'string' || label.length > 120
          || !Array.isArray(aliases) || aliases.length > 256 || typeof ruleVersion !== 'string' || ruleVersion.length > 80) throw refused('SOURCE_IDENTITY_INPUT_INVALID')
        const source = readEligible(path)
        const previous = renameFrom === null ? selectedRecord(accepted, { path }) : (() => {
          identityPath(renameFrom)
          if (renameFrom === path) throw refused('SOURCE_IDENTITY_RENAME_INVALID')
          const record = selectedRecord(accepted, { path: renameFrom })
          if (!record || selectedRecord(accepted, { path })) throw refused('SOURCE_IDENTITY_RENAME_INVALID', 409)
          return record
        })()
        if (!previous && accepted.size >= MAX_DOCUMENTS) throw refused('SOURCE_IDENTITY_DOCUMENT_LIMIT', 413)
        const parsed = parseSourceIdentity({ path, content: source.content, sourceRevision: source.revision, workspaceId: workspace, route, label })
        const incoming = validateSourceSpans(validateIdentityMap(parsed.map, { workspaceId: workspace, sourcePath: path }), source.content)
        const proposal = boundedCopy(previewReconciliation(previous?.map ?? null, incoming, { renameFrom, aliases: boundedCopy(aliases), ruleVersion }))
        const map = validateSourceSpans(validateIdentityMap(proposal.map, { workspaceId: workspace, sourcePath: path }), source.content)
        if (previous && map.documentId !== previous.map.documentId) throw refused('SOURCE_IDENTITY_DOCUMENT_REPLACED', 409)
        if (!previous && accepted.has(map.documentId)) throw refused('SOURCE_IDENTITY_DOCUMENT_COLLISION', 409)
        const ownership = buildOwnership(map, { currentRevision: source.revision })
        const response = boundedCopy({ proposal, ownership, workspaceId: workspace,
          adapter: { id: 'tsx-static-v1', version: 1, supportedOperations: ['literal'], unsupportedOperations: ['style', 'structure', 'generated'] },
          diagnostics: safeDiagnostics(parsed.diagnostics), shared: parsed.shared === true })
        if (!proposals.has(map.documentId) && proposals.size >= MAX_PROPOSALS) throw refused('SOURCE_IDENTITY_PROPOSAL_LIMIT', 413)
        currentWorkspace()
        proposals.set(map.documentId, { proposal: boundedCopy(proposal), sourcePath: path, revision: source.revision, previousId: previous?.map.documentId ?? null, workspaceId: workspace })
        return response
      } catch (error) { throw contained(error) }
    },

    accept({ digest, confirmation } = {}) {
      try {
        const workspace = currentWorkspace()
        if (typeof digest !== 'string' || !HASH.test(digest)) throw refused('SOURCE_IDENTITY_DIGEST_INVALID')
        const pending = [...proposals.values()].find(item => item.proposal.digest === digest)
        if (!pending) throw refused('SOURCE_IDENTITY_PROPOSAL_MISSING', 409)
        if (pending.workspaceId !== workspace) throw refused('SOURCE_IDENTITY_WORKSPACE_MISMATCH', 409)
        const source = readEligible(pending.sourcePath)
        if (source.revision !== pending.revision) throw refused('SOURCE_IDENTITY_STALE', 409)
        const map = validateSourceSpans(validateIdentityMap(acceptReconciliation(boundedCopy(pending.proposal), { digest, confirmation }), { workspaceId: workspace, sourcePath: pending.sourcePath }), source.content)
        if (map.sourceRevision !== source.revision) throw refused('SOURCE_IDENTITY_STALE', 409)
        const old = pending.previousId === null ? null : accepted.get(pending.previousId)
        if (pending.previousId !== null && (!old || (map.documentId !== old.map.documentId))) throw refused('SOURCE_IDENTITY_PREVIOUS_CHANGED', 409)
        if (!old && accepted.has(map.documentId)) throw refused('SOURCE_IDENTITY_DOCUMENT_COLLISION', 409)
        if (!old && accepted.size >= MAX_DOCUMENTS) throw refused('SOURCE_IDENTITY_DOCUMENT_LIMIT', 413)
        const claims = old?.claims ?? []
        const ownership = boundedCopy(buildOwnership(map, { claims, currentRevision: source.revision }))
        const storedMap = boundedCopy(map)
        const response = boundedCopy({ map: storedMap, ownership, accepted: true })
        if (readEligible(pending.sourcePath).revision !== pending.revision) throw refused('SOURCE_IDENTITY_STALE', 409)
        currentWorkspace()
        accepted.set(map.documentId, { map: storedMap, claims: boundedCopy(claims) })
        proposals.delete(map.documentId)
        ownershipProposals.delete(map.documentId)
        return response
      } catch (error) { throw contained(error) }
    },

    read(selector = {}) {
      try {
        currentWorkspace()
        const record = selectedRecord(accepted, selector)
        if (!record) return { missing: true, code: 'SOURCE_IDENTITY_DOCUMENT_MISSING' }
        const source = observed(record)
        const ownership = reportFor(record, source.revision)
        return boundedCopy({ map: record.map, ownership, currentRevision: source.sourceErrorCode ? null : source.revision,
          stale: source.revision !== record.map.sourceRevision, ...(source.sourceErrorCode ? { sourceErrorCode: source.sourceErrorCode } : {}) })
      } catch (error) { throw contained(error) }
    },

    lookup(reference) {
      try { return lookupReference(reference) } catch (error) { throw contained(error) }
    },

    inspect(reference) {
      try {
        const found = lookupReference(reference)
        if (found.status !== 'resolved') return found
        const record = requireRecord({ documentId: reference.documentId })
        const source = observed(record)
        return boundedCopy(inspectOwnership(record.map, reference, { claims: record.claims, currentRevision: source.revision }))
      } catch (error) { throw contained(error) }
    },

    export({ documentId } = {}) {
      try {
        const workspace = currentWorkspace()
        const record = requireRecord({ documentId })
        const source = observed(record)
        const report = reportFor(record, source.revision)
        return boundedCopy({ schemaVersion: 1, kind: 'systemx-source-document', workspaceId: workspace,
          map: exportIdentityMap(record.map), ownership: exportOwnershipDiagnostics(record.map, report) })
      } catch (error) { throw contained(error) }
    },

    reopen({ document, confirmation } = {}) {
      try {
        const workspace = currentWorkspace()
        if (confirmation !== 'REOPEN IDENTITY DOCUMENT') throw refused('SOURCE_IDENTITY_CONFIRMATION_REQUIRED')
        const exported = boundedCopy(document, 'SOURCE_IDENTITY_EXPORT_LIMIT')
        if (exported?.schemaVersion !== 1 || exported.kind !== 'systemx-source-document'
          || exported.workspaceId !== workspace || exported.map?.workspaceId !== workspace) throw refused('SOURCE_IDENTITY_EXPORT_INVALID')
        const map = validateIdentityMap(cleanReopenMap(exported.map), { workspaceId: workspace, sourcePath: exported.map.sourcePath })
        const source = readEligible(map.sourcePath)
        if (source.revision !== map.sourceRevision) throw refused('SOURCE_IDENTITY_STALE', 409)
        validateSourceSpans(map, source.content)
        const collision = selectedRecord(accepted, { path: map.sourcePath })
        if (collision && collision.map.documentId !== map.documentId) throw refused('SOURCE_IDENTITY_DOCUMENT_COLLISION', 409)
        if (accepted.has(map.documentId) && accepted.get(map.documentId).map.sourcePath !== map.sourcePath) throw refused('SOURCE_IDENTITY_DOCUMENT_COLLISION', 409)
        if (!accepted.has(map.documentId) && accepted.size >= MAX_DOCUMENTS) throw refused('SOURCE_IDENTITY_DOCUMENT_LIMIT', 413)
        if (!exported.ownership || typeof exported.ownership !== 'object' || Array.isArray(exported.ownership)
          || (Object.hasOwn(exported.ownership, 'claims') && !Array.isArray(exported.ownership.claims))
          || (exported.ownership.workspaceId !== undefined && exported.ownership.workspaceId !== workspace)
          || (exported.ownership.documentId !== undefined && exported.ownership.documentId !== map.documentId)) throw refused('SOURCE_IDENTITY_EXPORT_INVALID')
        const claims = exported.ownership.claims ?? []
        const ownership = boundedCopy(buildOwnership(map, { claims, currentRevision: source.revision }))
        const storedMap = boundedCopy(map)
        const response = boundedCopy({ map: storedMap, ownership, accepted: true })
        if (readEligible(map.sourcePath).revision !== map.sourceRevision) throw refused('SOURCE_IDENTITY_STALE', 409)
        currentWorkspace()
        accepted.set(map.documentId, { map: storedMap, claims: boundedCopy(claims) })
        proposals.delete(map.documentId)
        ownershipProposals.delete(map.documentId)
        return response
      } catch (error) { throw contained(error) }
    },

    ownershipPreview({ documentId, changes } = {}) {
      try {
        const workspace = currentWorkspace()
        const record = requireRecord({ documentId })
        const source = ensureRevision(record)
        if (!Array.isArray(changes) || changes.length > 1000) throw refused('SOURCE_IDENTITY_CHANGES_INVALID')
        const report = reportFor(record, source.revision)
        const proposal = boundedCopy(previewOwnershipChange(record.map, report, boundedCopy(changes)))
        const response = boundedCopy({ proposal, workspaceId: workspace })
        if (!ownershipProposals.has(documentId) && ownershipProposals.size >= MAX_PROPOSALS) throw refused('SOURCE_IDENTITY_PROPOSAL_LIMIT', 413)
        currentWorkspace()
        ownershipProposals.set(documentId, { proposal: boundedCopy(proposal), revision: source.revision, workspaceId: workspace })
        return response
      } catch (error) { throw contained(error) }
    },

    ownershipAccept({ digest, confirmation } = {}) {
      try {
        const workspace = currentWorkspace()
        if (typeof digest !== 'string' || !HASH.test(digest)) throw refused('SOURCE_IDENTITY_DIGEST_INVALID')
        const entry = [...ownershipProposals.entries()].find(([, item]) => item.proposal.digest === digest)
        if (!entry) throw refused('SOURCE_IDENTITY_PROPOSAL_MISSING', 409)
        const [documentId, pending] = entry
        if (pending.workspaceId !== workspace) throw refused('SOURCE_IDENTITY_WORKSPACE_MISMATCH', 409)
        const record = requireRecord({ documentId })
        const source = ensureRevision(record)
        if (source.revision !== pending.revision) throw refused('SOURCE_IDENTITY_STALE', 409)
        const report = boundedCopy(acceptOwnershipChange(boundedCopy(pending.proposal), { digest, confirmation }))
        const claims = boundedCopy(report.claims ?? [])
        buildOwnership(record.map, { claims, currentRevision: source.revision })
        const response = boundedCopy({ report, accepted: true })
        if (readEligible(record.map.sourcePath).revision !== source.revision) throw refused('SOURCE_IDENTITY_STALE', 409)
        currentWorkspace()
        accepted.set(documentId, { map: record.map, claims })
        ownershipProposals.delete(documentId)
        return response
      } catch (error) { throw contained(error) }
    },

    operation({ documentId, reference, expectedRevision, text } = {}) {
      try {
        currentWorkspace()
        const record = requireRecord({ documentId })
        if (!reference || reference.workspaceId !== activeWorkspaceId || reference.documentId !== documentId) throw refused('SOURCE_IDENTITY_REFERENCE_INVALID')
        if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > MAX_JSON_BYTES) throw refused('SOURCE_IDENTITY_TEXT_INVALID')
        const source = readEligible(record.map.sourcePath, { forWrite: true })
        const report = reportFor(record, source.revision)
        return boundedCopy(planLiteralOperation(record.map, report, { reference, expectedRevision, text, currentSource: source.content }))
      } catch (error) { throw contained(error) }
    },

    status() {
      try {
        const workspace = currentWorkspace()
        return { workspaceId: workspace, documents: [...accepted.values()].map(({ map }) => ({
          documentId: map.documentId, pageId: map.pageId, sourcePath: map.sourcePath,
          sourceRevision: map.sourceRevision, ruleVersion: map.ruleVersion, nodeCount: map.nodes.length,
        })), ruleVersion: RULE_VERSION }
      } catch (error) { throw contained(error) }
    },
  }
}
