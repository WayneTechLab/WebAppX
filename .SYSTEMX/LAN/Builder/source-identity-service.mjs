import { realpathSync } from 'node:fs'
import { inspectSourcePath, isCanonicalSourcePath, sourcePolicyLimits } from './source-policy.mjs'
import { hashSourceRevision } from './source-revision.mjs'
import { identityDigest, validateIdentityMap, resolveIdentity } from './identity-core.mjs'
import { previewReconciliation, acceptReconciliation, exportIdentityMap } from './identity-reconciliation.mjs'
import { buildOwnership, inspectOwnership, planLiteralOperation, previewOwnershipChange, acceptOwnershipChange, exportOwnershipDiagnostics } from './source-ownership.mjs'
import { parseSourceIdentity } from './source-identity-adapter.mjs'
import { createIdentityExportIntegrity } from './source-identity-integrity.mjs'

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
  const result = refused(code, Number.isInteger(error?.statusCode) && error.statusCode >= 400 && error.statusCode <= 599 ? error.statusCode : 400)
  if (Array.isArray(error?.diagnostics) && error.diagnostics.length <= 1000) {
    result.diagnostics = error.diagnostics.filter(item => item && /^[A-Z][A-Z0-9_]{1,63}$/.test(item.code)
      && HASH.test(item.identityDigest) && Number.isInteger(item.count) && item.count >= 2 && item.count <= 1000)
      .map(({ code: diagnosticCode, identityDigest: identifierDigest, count }) => ({ code: diagnosticCode, identityDigest: identifierDigest, count }))
  }
  return result
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

function canonicalNodeId(map, node) {
  return `node_${identityDigest(node.anchor === null
    ? ['heuristic', map.documentId, node.parentId, node.tag, node.signature]
    : ['explicit', map.documentId, node.tag, node.anchor])}`
}

function allocationFor(map, previous, incoming = map) {
  const sourcePath = previous?.allocation?.sourcePath ?? previous?.map.sourcePath ?? map.sourcePath
  const documentId = `doc_${identityDigest(['document', map.workspaceId, sourcePath])}`
  if (map.documentId !== documentId || map.pageId !== `page_${identityDigest(['page', documentId])}`) throw refused('SOURCE_IDENTITY_ALLOCATION_INVALID')
  const replacements = []
  for (const node of map.nodes) {
    if (node.confidence === 'unresolved' || node.id === canonicalNodeId(map, node)) continue
    let proof = previous?.allocation?.replacements?.find(item => item.nodeId === node.id)
    if (!proof) {
      const candidate = incoming.nodes.find(item => item.source.start === node.source.start && item.source.end === node.source.end)
      if (!candidate) throw refused('SOURCE_IDENTITY_ALLOCATION_INVALID')
      for (const incomingId of new Set([candidate.id, canonicalNodeId(map, node)])) {
        for (let salt = 0; salt <= 1000; salt += 1) {
          const tuple = { kind: 'reviewed-replacement', documentId: map.documentId, incomingId,
            tag: node.tag, anchor: node.anchor, signature: node.signature, sourceRevision: map.sourceRevision, salt }
          if (node.id === `node_${identityDigest(tuple)}`) {
            proof = { nodeId: node.id, incomingId, tag: node.tag, anchor: node.anchor,
              signature: node.signature, parentId: node.parentId, sourceRevision: map.sourceRevision, salt }
            break
          }
        }
        if (proof) break
      }
    }
    if (!proof || proof.tag !== node.tag || proof.anchor !== node.anchor
      || (node.anchor === null && (proof.signature !== node.signature || proof.parentId !== node.parentId))) throw refused('SOURCE_IDENTITY_ALLOCATION_INVALID')
    replacements.push(boundedCopy(proof))
  }
  return { sourcePath, replacements }
}

/** Reopening metadata cannot turn an arbitrary substring into an editable JSX node. */
function validateReopenedEvidence(map, content, allocation) {
  if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)
    || Object.keys(allocation).some(key => !['sourcePath', 'replacements'].includes(key))
    || !isCanonicalSourcePath(allocation.sourcePath) || !Array.isArray(allocation.replacements)
    || allocation.replacements.length > 1000) throw refused('SOURCE_IDENTITY_ALLOCATION_INVALID')
  const parsed = parseSourceIdentity({ path: allocation.sourcePath, content, sourceRevision: map.sourceRevision,
    workspaceId: map.workspaceId, route: map.route, label: '' }).map
  if (parsed.documentId !== map.documentId || parsed.pageId !== map.pageId || parsed.nodes.length !== map.nodes.length) throw refused('SOURCE_IDENTITY_ALLOCATION_INVALID')
  const nodesBySpan = new Map(parsed.nodes.map(node => [`${node.source.start}:${node.source.end}`, node]))
  const exportedById = new Map(map.nodes.map(node => [node.id, node]))
  const parsedById = new Map(parsed.nodes.map(node => [node.id, node]))
  const seenSpans = new Set()
  for (const node of map.nodes) {
    const key = `${node.source.start}:${node.source.end}`
    const actual = nodesBySpan.get(key)
    if (!actual || seenSpans.has(key)) throw refused('SOURCE_IDENTITY_SEMANTICS_INVALID')
    seenSpans.add(key)
    for (const field of ['tag', 'anchor', 'signature', 'fields', 'opaque', 'external', 'definition']) {
      const expected = field === 'definition' && actual.definition?.sourcePath === allocation.sourcePath
        ? { ...actual.definition, sourcePath: map.sourcePath } : actual[field]
      if (identityDigest(node[field] ?? null) !== identityDigest(expected ?? null)) throw refused('SOURCE_IDENTITY_SEMANTICS_INVALID')
    }
    const parent = node.parentId === null ? null : exportedById.get(node.parentId)
    const actualParent = actual.parentId === null ? null : parsedById.get(actual.parentId)
    if (Boolean(parent) !== Boolean(actualParent) || parent && (parent.source.start !== actualParent.source.start || parent.source.end !== actualParent.source.end)) {
      throw refused('SOURCE_IDENTITY_SEMANTICS_INVALID')
    }
    if ((actual.confidence === 'unresolved') !== (node.confidence === 'unresolved')) throw refused('SOURCE_IDENTITY_SEMANTICS_INVALID')
    if (node.confidence === 'unresolved' || node.id === canonicalNodeId(map, node)) continue
    const proof = allocation.replacements.find(item => item?.nodeId === node.id)
    const allowed = ['nodeId', 'incomingId', 'tag', 'anchor', 'signature', 'parentId', 'sourceRevision', 'salt']
    if (!proof || typeof proof !== 'object' || Array.isArray(proof) || Object.keys(proof).some(k => !allowed.includes(k))
      || !/^node_[a-f0-9]{64}$/.test(proof.incomingId) || !HASH.test(proof.signature) || !HASH.test(proof.sourceRevision)
      || !Number.isInteger(proof.salt) || proof.salt < 0 || proof.salt > 1000 || proof.tag !== node.tag || proof.anchor !== node.anchor
      || node.anchor === null && (proof.signature !== node.signature || proof.parentId !== node.parentId)
      || node.id !== `node_${identityDigest({ kind: 'reviewed-replacement', documentId: map.documentId, incomingId: proof.incomingId,
        tag: proof.tag, anchor: proof.anchor, signature: proof.signature, sourceRevision: proof.sourceRevision, salt: proof.salt })}`) throw refused('SOURCE_IDENTITY_ALLOCATION_INVALID')
  }
  return boundedCopy(allocation)
}

function retiredOwnership(claim, map) {
  return { workspaceId: map.workspaceId, documentId: map.documentId, nodeId: claim.nodeId,
    sourcePath: claim.source?.path ?? map.sourcePath, sourceRevision: claim.source?.sourceRevision ?? map.sourceRevision,
    claimDigest: identityDigest(claim), reason: 'OWNERSHIP_TARGET_RETIRED' }
}

function retainedRetirements(value, map) {
  if (!Array.isArray(value) || value.length > 1000) throw refused('SOURCE_IDENTITY_DIAGNOSTIC_LIMIT')
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)
      || Object.keys(item).some(key => !['workspaceId', 'documentId', 'nodeId', 'sourcePath', 'sourceRevision', 'claimDigest', 'reason'].includes(key))
      || item.workspaceId !== map.workspaceId || item.documentId !== map.documentId || !/^node_[a-f0-9]{64}$/.test(item.nodeId)
      || !isCanonicalSourcePath(item.sourcePath) || !HASH.test(item.sourceRevision) || !HASH.test(item.claimDigest)
      || item.reason !== 'OWNERSHIP_TARGET_RETIRED') throw refused('SOURCE_IDENTITY_DIAGNOSTIC_INVALID')
  }
  return boundedCopy(value)
}

function sourcePolicyReport(report, metadata) {
  if (metadata?.writable !== false) return report
  const copy = boundedCopy(report)
  copy.sourcePolicy = { writable: false, origin: metadata.origin, reasonCode: metadata.reasonCode ?? 'SOURCE_READ_ONLY' }
  for (const object of copy.objects) {
    object.supportedOperations = []
    object.unsupportedOperations = ['literal', 'style', 'structure', 'generated']
    for (const field of Object.values(object.fields)) field.supported = false
    if (!object.reasons.includes(copy.sourcePolicy.reasonCode)) object.reasons.push(copy.sourcePolicy.reasonCode)
    if (object.status === 'mapped') object.status = 'partial'
  }
  copy.coverage.partial += copy.coverage.mapped
  copy.coverage.mapped = 0
  return copy
}

/** In-memory, one-workspace authority for explicit source identity acceptance. */
export function createSourceIdentityService(root, { readSource, workspaceId } = {}) {
  if (typeof root !== 'string' || !root || (readSource !== undefined && typeof readSource !== 'function')) throw refused('SOURCE_IDENTITY_CONFIGURATION_INVALID')
  let rootIdentity
  try { rootIdentity = hashSourceRevision(`systemx-workspace\0${realpathSync(root)}`) } catch { throw refused('SOURCE_IDENTITY_WORKSPACE_INVALID') }
  if (workspaceId !== undefined && (typeof workspaceId !== 'string' || !HASH.test(workspaceId) || workspaceId !== rootIdentity)) throw refused('SOURCE_IDENTITY_WORKSPACE_INVALID')
  let activeWorkspaceId = workspaceId ?? rootIdentity
  let exportIntegrity = createIdentityExportIntegrity(root, activeWorkspaceId)
  const accepted = new Map()
  const proposals = new Map()
  const ownershipProposals = new Map()

  function currentWorkspace() {
    let current
    try { current = hashSourceRevision(`systemx-workspace\0${realpathSync(root)}`) } catch { throw refused('SOURCE_IDENTITY_WORKSPACE_INVALID') }
    if (current !== rootIdentity) {
      rootIdentity = current
      activeWorkspaceId = current
      exportIntegrity = createIdentityExportIntegrity(root, activeWorkspaceId)
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

  function reportFor(record, revision, metadata) {
    return boundedCopy(sourcePolicyReport(buildOwnership(record.map, { claims: record.claims, currentRevision: revision }), metadata))
  }

  function observed(record) {
    try {
      const source = readEligible(record.map.sourcePath)
      return { revision: source.revision, content: source.content, metadata: source.metadata, sourceErrorCode: null }
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
    preview({ path, route, label = '', renameFrom = null, aliases = [], ruleVersion = RULE_VERSION } = {}) {
      try {
        const workspace = currentWorkspace()
        if (route !== undefined && (typeof route !== 'string' || route.length > 512 || !route.startsWith('/') || /[\\\x00-\x1f\x7f]/.test(route))
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
        const parsed = parseSourceIdentity({ path, content: source.content, sourceRevision: source.revision, workspaceId: workspace, route: route ?? previous?.map.route ?? '/', label })
        const incoming = validateSourceSpans(validateIdentityMap(parsed.map, { workspaceId: workspace, sourcePath: path }), source.content)
        const proposal = boundedCopy(previewReconciliation(previous?.map ?? null, incoming, { renameFrom, aliases: boundedCopy(aliases), ruleVersion }))
        const map = validateSourceSpans(validateIdentityMap(proposal.map, { workspaceId: workspace, sourcePath: path }), source.content)
        if (previous && map.documentId !== previous.map.documentId) throw refused('SOURCE_IDENTITY_DOCUMENT_REPLACED', 409)
        if (!previous && accepted.has(map.documentId)) throw refused('SOURCE_IDENTITY_DOCUMENT_COLLISION', 409)
        const nodeIds = new Set(map.nodes.map(node => node.id))
        const claims = previous?.claims.filter(claim => nodeIds.has(claim.nodeId)) ?? []
        const ownershipRetirements = previous?.claims.filter(claim => !nodeIds.has(claim.nodeId)).map(claim => retiredOwnership(claim, previous.map)) ?? []
        const ownership = sourcePolicyReport(buildOwnership(map, { claims, currentRevision: source.revision }), source.metadata)
        const allocation = allocationFor(map, previous, incoming)
        const response = boundedCopy({ proposal, ownership, workspaceId: workspace,
          adapter: { id: 'tsx-static-v1', version: 1, supportedOperations: ['literal'], unsupportedOperations: ['style', 'structure', 'generated'] },
          ownershipRetirements, diagnostics: safeDiagnostics(parsed.diagnostics), shared: parsed.shared === true })
        if (!proposals.has(map.documentId) && proposals.size >= MAX_PROPOSALS) throw refused('SOURCE_IDENTITY_PROPOSAL_LIMIT', 413)
        currentWorkspace()
        proposals.set(map.documentId, { proposal: boundedCopy(proposal), sourcePath: path, revision: source.revision,
          previousId: previous?.map.documentId ?? null, workspaceId: workspace, allocation,
          previousAuthority: previous ? identityDigest(previous) : null, claims: boundedCopy(claims), ownershipRetirements })
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
        if ((old ? identityDigest(old) : null) !== pending.previousAuthority) throw refused('SOURCE_IDENTITY_AUTHORITY_STALE', 409)
        if (!old && accepted.has(map.documentId)) throw refused('SOURCE_IDENTITY_DOCUMENT_COLLISION', 409)
        if (!old && accepted.size >= MAX_DOCUMENTS) throw refused('SOURCE_IDENTITY_DOCUMENT_LIMIT', 413)
        const claims = pending.claims
        const retiredOwnershipClaims = retainedRetirements([...(old?.retiredOwnershipClaims ?? []), ...pending.ownershipRetirements], map)
        const ownership = boundedCopy(sourcePolicyReport(buildOwnership(map, { claims, currentRevision: source.revision }), source.metadata))
        const storedMap = boundedCopy(map)
        const response = boundedCopy({ map: storedMap, ownership, retiredOwnershipClaims, accepted: true })
        if (readEligible(pending.sourcePath).revision !== pending.revision) throw refused('SOURCE_IDENTITY_STALE', 409)
        currentWorkspace()
        accepted.set(map.documentId, { map: storedMap, claims: boundedCopy(claims), allocation: pending.allocation, retiredOwnershipClaims })
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
        const ownership = reportFor(record, source.revision, source.metadata)
        return boundedCopy({ map: record.map, ownership, retiredOwnershipClaims: record.retiredOwnershipClaims ?? [], currentRevision: source.sourceErrorCode ? null : source.revision,
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
        const result = inspectOwnership(record.map, reference, { claims: record.claims, currentRevision: source.revision })
        if (result.object && source.metadata?.writable === false) {
          result.object = reportFor(record, source.revision, source.metadata).objects.find(object => object.nodeId === result.object.nodeId)
          result.status = result.object.status
        }
        return boundedCopy(result)
      } catch (error) { throw contained(error) }
    },

    export({ documentId } = {}) {
      try {
        const workspace = currentWorkspace()
        const record = requireRecord({ documentId })
        const source = observed(record)
        const exportReport = buildOwnership(record.map, { claims: record.claims, currentRevision: source.revision })
        const payload = boundedCopy({ schemaVersion: 1, kind: 'systemx-source-document', workspaceId: workspace,
          map: exportIdentityMap(record.map), ownership: sourcePolicyReport(exportOwnershipDiagnostics(record.map, exportReport), source.metadata),
          allocation: record.allocation, retiredOwnershipClaims: record.retiredOwnershipClaims ?? [] })
        return boundedCopy(exportIntegrity.seal(payload))
      } catch (error) { throw contained(error) }
    },

    reopen({ document, confirmation } = {}) {
      try {
        const workspace = currentWorkspace()
        if (confirmation !== 'REOPEN IDENTITY DOCUMENT') throw refused('SOURCE_IDENTITY_CONFIRMATION_REQUIRED')
        const exported = boundedCopy(document, 'SOURCE_IDENTITY_EXPORT_LIMIT')
        if (exported?.schemaVersion !== 1 || exported.kind !== 'systemx-source-document'
          || exported.workspaceId !== workspace || exported.map?.workspaceId !== workspace) throw refused('SOURCE_IDENTITY_EXPORT_INVALID')
        exportIntegrity.verify(exported)
        const map = validateIdentityMap(cleanReopenMap(exported.map), { workspaceId: workspace, sourcePath: exported.map.sourcePath })
        const source = readEligible(map.sourcePath)
        if (source.revision !== map.sourceRevision) throw refused('SOURCE_IDENTITY_STALE', 409)
        validateSourceSpans(map, source.content)
        const allocation = validateReopenedEvidence(map, source.content, exported.allocation ?? { sourcePath: map.sourcePath, replacements: [] })
        const retiredOwnershipClaims = retainedRetirements(exported.retiredOwnershipClaims ?? [], map)
        const collision = selectedRecord(accepted, { path: map.sourcePath })
        if (collision && collision.map.documentId !== map.documentId) throw refused('SOURCE_IDENTITY_DOCUMENT_COLLISION', 409)
        if (accepted.has(map.documentId) && accepted.get(map.documentId).map.sourcePath !== map.sourcePath) throw refused('SOURCE_IDENTITY_DOCUMENT_COLLISION', 409)
        const current = accepted.get(map.documentId)
        if (current && identityDigest(exportIdentityMap(current.map)) !== identityDigest(exportIdentityMap(map))) {
          throw refused('SOURCE_IDENTITY_RECONCILIATION_REQUIRED', 409)
        }
        if (!accepted.has(map.documentId) && accepted.size >= MAX_DOCUMENTS) throw refused('SOURCE_IDENTITY_DOCUMENT_LIMIT', 413)
        if (!exported.ownership || typeof exported.ownership !== 'object' || Array.isArray(exported.ownership)
          || (Object.hasOwn(exported.ownership, 'claims') && !Array.isArray(exported.ownership.claims))
          || (exported.ownership.workspaceId !== undefined && exported.ownership.workspaceId !== workspace)
          || (exported.ownership.documentId !== undefined && exported.ownership.documentId !== map.documentId)) throw refused('SOURCE_IDENTITY_EXPORT_INVALID')
        const claims = exported.ownership.claims ?? []
        const ownership = boundedCopy(sourcePolicyReport(buildOwnership(map, { claims, currentRevision: source.revision }), source.metadata))
        const storedMap = boundedCopy(map)
        const response = boundedCopy({ map: storedMap, ownership, retiredOwnershipClaims, accepted: true })
        if (readEligible(map.sourcePath).revision !== map.sourceRevision) throw refused('SOURCE_IDENTITY_STALE', 409)
        currentWorkspace()
        accepted.set(map.documentId, { map: storedMap, claims: boundedCopy(claims), allocation, retiredOwnershipClaims })
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
        if (source.metadata?.writable === false) throw refused(source.metadata.reasonCode ?? 'SOURCE_READ_ONLY', 403)
        if (!Array.isArray(changes) || changes.length > 1000) throw refused('SOURCE_IDENTITY_CHANGES_INVALID')
        const report = reportFor(record, source.revision)
        // Keep the module's original sealed proposal private. A JSON response
        // is only a review copy and cannot become acceptance authority.
        const proposal = previewOwnershipChange(record.map, report, boundedCopy(changes))
        const response = boundedCopy({ proposal, workspaceId: workspace })
        if (!ownershipProposals.has(documentId) && ownershipProposals.size >= MAX_PROPOSALS) throw refused('SOURCE_IDENTITY_PROPOSAL_LIMIT', 413)
        currentWorkspace()
        ownershipProposals.set(documentId, { proposal, revision: source.revision, workspaceId: workspace, previousAuthority: identityDigest(record) })
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
        if (identityDigest(record) !== pending.previousAuthority) throw refused('SOURCE_IDENTITY_AUTHORITY_STALE', 409)
        const source = ensureRevision(record)
        if (source.revision !== pending.revision) throw refused('SOURCE_IDENTITY_STALE', 409)
        const report = boundedCopy(acceptOwnershipChange(pending.proposal, { digest, confirmation }))
        const claims = boundedCopy(report.claims ?? [])
        buildOwnership(record.map, { claims, currentRevision: source.revision })
        const response = boundedCopy({ report, accepted: true })
        if (readEligible(record.map.sourcePath).revision !== source.revision) throw refused('SOURCE_IDENTITY_STALE', 409)
        currentWorkspace()
        accepted.set(documentId, { ...record, claims })
        proposals.delete(documentId)
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
