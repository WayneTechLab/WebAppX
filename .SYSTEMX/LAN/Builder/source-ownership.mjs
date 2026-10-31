import { createHash } from 'node:crypto'
import { isCanonicalSourcePath } from './source-policy.mjs'
import { hashSourceRevision } from './source-revision.mjs'

const HEX = /^[a-f0-9]{64}$/
const DOCUMENT_ID = /^doc_[a-f0-9]{12,64}$/
const PAGE_ID = /^page_[a-f0-9]{12,64}$/
const NODE_ID = /^[A-Za-z][A-Za-z0-9_-]{0,127}$/
const MODES = new Set(['source-owned', 'document-owned', 'hybrid-controlled', 'unmapped'])
const CONFIDENCE = new Set(['explicit', 'heuristic', 'unresolved', 'reviewed-migration'])
const OPERATIONS = ['literal', 'style', 'structure', 'generated']
const MAX_NODES = 1_000
const MAX_CLAIMS = 1_000
const MAX_SOURCE_BYTES = 1_000_000
const MAX_PROPOSAL_BYTES = 400_000
const MAX_DIAGNOSTICS = 1_000
const proposals = new WeakMap()

function fail(code) {
  const error = new Error(code)
  error.code = code
  throw error
}

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

function assert(condition, code) { if (!condition) fail(code) }
function own(value, key) { return Object.hasOwn(value, key) ? value[key] : undefined }
function hex(value) { return typeof value === 'string' && HEX.test(value) }
function path(value) { return isCanonicalSourcePath(value) }
function eligiblePath(value) {
  return path(value) && (/^src\/pages\/[^/]+\.tsx$/.test(value)
    || /^src\/components\/(?:layout|navigation|shell)\/[^/]+\.tsx$/.test(value)
    || value === 'src/router.tsx')
}
function bounded(value, limit = 120) { return typeof value === 'string' && value.length <= limit }
function span(value) {
  return plain(value) && Number.isSafeInteger(value.start) && Number.isSafeInteger(value.end)
    && value.start >= 0 && value.end > value.start && value.end <= 500_000
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (plain(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return JSON.stringify(value)
  fail('OWNERSHIP_INVALID_JSON')
}

function digest(value) { return createHash('sha256').update(canonical(value)).digest('hex') }
function copy(value) { return JSON.parse(JSON.stringify(value)) }
function bytes(value) { return Buffer.byteLength(JSON.stringify(value), 'utf8') }

function validateSource(value, code = 'OWNERSHIP_INVALID_SOURCE') {
  assert(plain(value) && path(value.path) && span(value) && hex(value.sourceRevision) && hex(value.fingerprint), code)
  return { path: value.path, start: value.start, end: value.end, sourceRevision: value.sourceRevision, fingerprint: value.fingerprint }
}

function validateMap(map) {
  assert(plain(map) && map.schemaVersion === 1 && bounded(map.ruleVersion, 80), 'OWNERSHIP_INVALID_MAP')
  assert(hex(map.workspaceId) && DOCUMENT_ID.test(map.documentId) && PAGE_ID.test(map.pageId), 'OWNERSHIP_INVALID_MAP')
  assert(eligiblePath(map.sourcePath) && hex(map.sourceRevision) && bounded(map.route, 256) && map.route.startsWith('/'), 'OWNERSHIP_INVALID_MAP')
  assert(Array.isArray(map.nodes) && map.nodes.length <= MAX_NODES, 'OWNERSHIP_INVALID_MAP')
  const ids = new Set()
  for (const node of map.nodes) {
    assert(plain(node) && NODE_ID.test(node.id) && !ids.has(node.id), 'OWNERSHIP_INVALID_NODE')
    ids.add(node.id)
    assert(node.parentId === null || typeof node.parentId === 'string', 'OWNERSHIP_INVALID_NODE')
    assert(bounded(node.tag, 80) && CONFIDENCE.has(node.confidence), 'OWNERSHIP_INVALID_NODE')
    assert(node.anchor === null || bounded(node.anchor, 80), 'OWNERSHIP_INVALID_NODE')
    assert(hex(node.signature) && (node.label === undefined || bounded(node.label)), 'OWNERSHIP_INVALID_NODE')
    assert(typeof node.opaque === 'boolean' && typeof node.external === 'boolean', 'OWNERSHIP_INVALID_NODE')
    if (node.source !== null && node.source !== undefined) validateSource(node.source)
    assert(plain(node.fields), 'OWNERSHIP_INVALID_NODE')
    const text = own(node.fields, 'text')
    if (text !== undefined) {
      assert(span(text) && hex(text.fingerprint) && node.source && text.start >= node.source.start && text.end <= node.source.end, 'OWNERSHIP_INVALID_FIELD')
    }
    if (node.definition !== undefined) {
      assert(plain(node.definition) && bounded(node.definition.name), 'OWNERSHIP_INVALID_DEFINITION')
      if (node.definition.sourcePath !== undefined) assert(path(node.definition.sourcePath), 'OWNERSHIP_INVALID_DEFINITION')
    }
  }
  for (const node of map.nodes) {
    assert(node.parentId === null || ids.has(node.parentId), 'OWNERSHIP_INVALID_PARENT')
    const seen = new Set([node.id])
    let cursor = node
    while (cursor.parentId !== null) {
      assert(!seen.has(cursor.parentId), 'OWNERSHIP_INVALID_PARENT')
      seen.add(cursor.parentId)
      cursor = map.nodes.find(item => item.id === cursor.parentId)
    }
  }
  assert(Array.isArray(map.aliases) && map.aliases.length <= 256, 'OWNERSHIP_INVALID_ALIASES')
  const aliasIds = new Set()
  for (const alias of map.aliases) {
    assert(plain(alias) && NODE_ID.test(alias.from) && NODE_ID.test(alias.to) && alias.from !== alias.to
      && !aliasIds.has(alias.from) && !ids.has(alias.from), 'OWNERSHIP_INVALID_ALIASES')
    aliasIds.add(alias.from)
  }
  for (const alias of map.aliases) {
    const seen = new Set([alias.from])
    let target = alias.to
    while (!ids.has(target)) {
      assert(!seen.has(target), 'OWNERSHIP_INVALID_ALIASES')
      seen.add(target)
      const next = map.aliases.find(item => item.from === target)
      assert(next, 'OWNERSHIP_INVALID_ALIASES')
      target = next.to
    }
  }
  return map
}

function resolve(map, reference) {
  assert(plain(reference) && hex(reference.workspaceId) && DOCUMENT_ID.test(reference.documentId) && NODE_ID.test(reference.nodeId), 'OWNERSHIP_INVALID_REFERENCE')
  if (reference.workspaceId !== map.workspaceId) return { status: 'workspace-mismatch' }
  if (reference.documentId !== map.documentId) return { status: 'document-mismatch' }
  let nodeId = reference.nodeId
  const seen = new Set()
  for (let i = 0; i <= 256; i += 1) {
    const node = map.nodes.find(item => item.id === nodeId)
    if (node) return { status: 'resolved', node }
    if (seen.has(nodeId)) return { status: 'ambiguous' }
    seen.add(nodeId)
    const alias = map.aliases.find(item => item.from === nodeId)
    if (!alias) return { status: 'missing' }
    nodeId = alias.to
  }
  return { status: 'ambiguous' }
}

function provenance(value, map) {
  if (value === undefined) return undefined
  assert(plain(value), 'OWNERSHIP_INVALID_PROVENANCE')
  const result = {}
  if (value.documentId !== undefined) { assert(value.documentId === map.documentId, 'OWNERSHIP_INVALID_PROVENANCE'); result.documentId = value.documentId }
  if (value.generatorVersion !== undefined) { assert(bounded(value.generatorVersion, 80) && value.generatorVersion.length > 0, 'OWNERSHIP_INVALID_PROVENANCE'); result.generatorVersion = value.generatorVersion }
  if (value.outputPath !== undefined) { assert(path(value.outputPath), 'OWNERSHIP_INVALID_PROVENANCE'); result.outputPath = value.outputPath }
  if (value.outputRevision !== undefined) { assert(hex(value.outputRevision), 'OWNERSHIP_INVALID_PROVENANCE'); result.outputRevision = value.outputRevision }
  const boundary = own(value, 'generatedBoundary') ?? own(value, 'boundary')
  if (boundary !== undefined) {
    assert(plain(boundary) && path(boundary.path), 'OWNERSHIP_INVALID_PROVENANCE')
    if (boundary.start !== undefined || boundary.end !== undefined) assert(span(boundary), 'OWNERSHIP_INVALID_PROVENANCE')
    result.generatedBoundary = boundary.start === undefined ? { path: boundary.path } : { path: boundary.path, start: boundary.start, end: boundary.end }
  }
  return result
}

function hasGeneratedBoundary(value, map) {
  return value?.documentId === map.documentId && value.generatorVersion && value.outputPath
    && value.outputPath !== map.sourcePath && value.outputRevision && value.generatedBoundary
    && value.generatedBoundary.path === value.outputPath
}

function normalizeClaim(claim, map, index) {
  assert(plain(claim) && typeof claim.nodeId === 'string' && map.nodes.some(node => node.id === claim.nodeId), 'OWNERSHIP_UNKNOWN_NODE')
  assert(MODES.has(claim.mode) && claim.mode !== 'unmapped' && bounded(claim.adapterId, 80) && claim.adapterId.length > 0, 'OWNERSHIP_INVALID_CLAIM')
  const node = map.nodes.find(item => item.id === claim.nodeId)
  const fields = {}
  const inputFields = own(claim, 'fields')
  assert(inputFields === undefined || (plain(inputFields) && Object.keys(inputFields).length <= 16), 'OWNERSHIP_INVALID_CLAIM')
  if (inputFields !== undefined) for (const key of Object.keys(inputFields)) {
    assert(/^[a-z][a-z0-9_-]{0,39}$/.test(key), 'OWNERSHIP_INVALID_CLAIM')
    const field = inputFields[key]
    const owner = typeof field === 'string' ? field : plain(field) ? field.owner : undefined
    assert(owner === 'source' || owner === 'document', 'OWNERSHIP_INVALID_CLAIM')
    const supported = plain(field) && field.supported !== undefined ? field.supported : owner === 'source' && key === 'text'
    assert(typeof supported === 'boolean', 'OWNERSHIP_INVALID_CLAIM')
    fields[key] = { owner, supported }
  }
  if (inputFields === undefined && node.fields.text && claim.mode === 'source-owned') fields.text = { owner: 'source', supported: true }
  const source = claim.source === undefined ? node.source ? validateSource(node.source) : undefined : validateSource(claim.source)
  if (claim.source !== undefined && claim.mode !== 'document-owned') assert(eligiblePath(source.path), 'OWNERSHIP_INVALID_CLAIM_SOURCE')
  const normalized = { index, nodeId: claim.nodeId, mode: claim.mode, adapterId: claim.adapterId, fields }
  if (source) normalized.source = source
  const origin = provenance(claim.provenance, map)
  if (origin) normalized.provenance = origin
  return normalized
}

function readClaims(map, claims) {
  assert(Array.isArray(claims) && claims.length <= MAX_CLAIMS, 'OWNERSHIP_INVALID_CLAIMS')
  return claims.map((claim, index) => normalizeClaim(claim, map, index))
}

function sameSpan(a, b) { return a.path === b.path && a.start < b.end && b.start < a.end }
function textSource(node, claim) {
  if (!node.fields.text) return null
  if (claim && (claim.source?.path !== node.source?.path || claim.source?.sourceRevision !== node.source?.sourceRevision
    || claim.source?.start > node.fields.text.start || claim.source?.end < node.fields.text.end)) return null
  return { path: node.source.path, start: node.fields.text.start, end: node.fields.text.end }
}

function conflictIndices(map, claims) {
  const conflicts = new Map()
  const nodes = new Map(map.nodes.map(node => [node.id, node]))
  const add = (a, b) => {
    if (!conflicts.has(a)) conflicts.set(a, new Set())
    if (!conflicts.has(b)) conflicts.set(b, new Set())
    conflicts.get(a).add(b)
    conflicts.get(b).add(a)
  }
  for (let i = 0; i < claims.length; i += 1) for (let j = i + 1; j < claims.length; j += 1) {
    const a = claims[i], b = claims[j]
    if (a.nodeId === b.nodeId && (a.mode !== b.mode || Object.keys(a.fields).some(key => b.fields[key] && b.fields[key].owner !== a.fields[key].owner))) add(i, j)
    const an = nodes.get(a.nodeId), bn = nodes.get(b.nodeId)
    if (a.fields.text?.owner === 'source' && b.fields.text?.owner === 'source') {
      const as = textSource(an, a), bs = textSource(bn, b)
      if (as && bs && sameSpan(as, bs)) add(i, j)
    }
  }
  return conflicts
}

function shared(pathname) { return /^src\/components\/(?:layout|navigation|shell)\//.test(pathname) }
function unique(values) { return [...new Set(values)] }

export function buildOwnership(map, options = {}) {
  validateMap(map)
  assert(plain(options), 'OWNERSHIP_INVALID_OPTIONS')
  const { claims = [], currentRevision = map.sourceRevision } = options
  assert(hex(currentRevision), 'OWNERSHIP_INVALID_REVISION')
  const normalized = readClaims(map, claims)
  const conflicts = conflictIndices(map, normalized)
  const objects = map.nodes.map(node => {
    const ownClaims = normalized.filter(claim => claim.nodeId === node.id)
    const claim = ownClaims[0]
    const mode = claim?.mode ?? (node.source ? 'source-owned' : 'unmapped')
    const adapterId = claim?.adapterId ?? 'tsx-static-v1'
    const source = claim?.source ?? (node.source ? validateSource(node.source) : undefined)
    const reasons = []
    const add = code => { if (!reasons.includes(code)) reasons.push(code) }
    const conflict = ownClaims.some(item => conflicts.has(item.index))
    const stale = Boolean(source && (currentRevision !== map.sourceRevision || source.sourceRevision !== map.sourceRevision))
    if (!source) add('SOURCE_UNMAPPED')
    if (source && source.path !== map.sourcePath) add('SOURCE_OWNER_OUTSIDE_DOCUMENT')
    if (stale) add('SOURCE_REVISION_STALE')
    if (node.confidence === 'unresolved') add('IDENTITY_UNRESOLVED')
    if (node.opaque) add('OPAQUE_SOURCE_REGION')
    if (node.external) add('EXTERNAL_COMPONENT_INTERNALS')
    if (adapterId !== 'tsx-static-v1' && mode !== 'document-owned') add('ADAPTER_UNSUPPORTED')
    if (claim && claim.source && node.source && (claim.source.path !== node.source.path || claim.source.sourceRevision !== node.source.sourceRevision
      || node.fields.text && (claim.source.start > node.fields.text.start || claim.source.end < node.fields.text.end)
      || !node.fields.text && (claim.source.start >= node.source.end || claim.source.end <= node.source.start)
      || claim.source.start === node.source.start && claim.source.end === node.source.end
        && claim.source.fingerprint !== node.source.fingerprint)) add('SOURCE_CLAIM_MISMATCH')
    if (mode === 'document-owned' && !hasGeneratedBoundary(claim?.provenance, map)) add('GENERATED_BOUNDARY_REQUIRED')
    if (mode === 'hybrid-controlled' && (!claim || !Object.values(claim.fields).some(field => field.owner === 'source')
      || !Object.values(claim.fields).some(field => field.owner === 'document'))) add('HYBRID_BOUNDARY_REQUIRED')
    if (mode === 'source-owned' && Object.values(claim?.fields ?? {}).some(field => field.owner === 'document')
      || mode === 'document-owned' && Object.values(claim?.fields ?? {}).some(field => field.owner === 'source')) add('MODE_FIELD_BOUNDARY_MISMATCH')
    if (mode === 'unmapped') add('SOURCE_UNMAPPED')
    if (!node.fields.text) add('LITERAL_FIELD_UNAVAILABLE')
    if (claim && node.fields.text && !textSource(node, claim)) add('TEXT_SPAN_OUTSIDE_CLAIM')
    if (conflict) add('OWNER_CLAIM_CONFLICT')
    const textOwner = claim?.fields.text?.owner ?? (mode === 'source-owned' && node.fields.text ? 'source' : mode === 'document-owned' && node.fields.text ? 'document' : undefined)
    const writable = Boolean(node.fields.text && textOwner === 'source' && !conflict && !stale && !node.opaque && !node.external
      && node.confidence !== 'unresolved' && adapterId === 'tsx-static-v1' && source?.path === map.sourcePath
      && (!claim || claim.fields.text?.supported === true)
      && !reasons.includes('SOURCE_CLAIM_MISMATCH') && !reasons.includes('TEXT_SPAN_OUTSIDE_CLAIM')
      && !reasons.includes('MODE_FIELD_BOUNDARY_MISMATCH')
      && (mode === 'source-owned' || mode === 'hybrid-controlled' && !reasons.includes('HYBRID_BOUNDARY_REQUIRED')))
    const fields = {}
    if (node.fields.text) fields.text = { owner: textOwner ?? 'source', supported: writable }
    let status = !source || mode === 'unmapped' ? 'unmapped' : conflict ? 'conflict' : stale ? 'stale'
      : reasons.some(code => ['SOURCE_OWNER_OUTSIDE_DOCUMENT', 'IDENTITY_UNRESOLVED', 'OPAQUE_SOURCE_REGION', 'EXTERNAL_COMPONENT_INTERNALS',
        'ADAPTER_UNSUPPORTED', 'SOURCE_CLAIM_MISMATCH', 'GENERATED_BOUNDARY_REQUIRED', 'HYBRID_BOUNDARY_REQUIRED',
        'MODE_FIELD_BOUNDARY_MISMATCH', 'TEXT_SPAN_OUTSIDE_CLAIM'].includes(code)) ? 'partial' : 'mapped'
    if (status === 'mapped' && mode === 'document-owned' && !hasGeneratedBoundary(claim?.provenance, map)) status = 'partial'
    const object = { nodeId: node.id, mode, adapterId, status, fields,
      supportedOperations: writable ? ['literal'] : [], unsupportedOperations: writable ? OPERATIONS.slice(1) : [...OPERATIONS], reasons }
    if (source) object.source = source
    if (node.fields.text) object.fieldSpans = { text: { start: node.fields.text.start, end: node.fields.text.end,
      fingerprint: node.fields.text.fingerprint } }
    if (node.definition) {
      object.definition = { name: node.definition.name }
      if (node.definition.sourcePath) object.definition.sourcePath = node.definition.sourcePath
      object.instanceFields = node.fields.text ? ['text'] : []
      object.definitionFields = ['structure']
    }
    if (claim?.provenance) object.provenance = copy(claim.provenance)
    else if (source) object.provenance = { kind: 'authored-source', shared: shared(source.path) }
    return object
  })
  // Implicit imported source ownership is a claim too. Detect overlaps even when
  // only one of the affected objects has an explicit adapter claim.
  for (let i = 0; i < objects.length; i += 1) for (let j = i + 1; j < objects.length; j += 1) {
    const a = objects[i], b = objects[j]
    if (a.fields.text?.owner !== 'source' || b.fields.text?.owner !== 'source') continue
    const an = map.nodes[i], bn = map.nodes[j]
    const as = an.fields.text && an.source ? { path: an.source.path, start: an.fields.text.start, end: an.fields.text.end } : null
    const bs = bn.fields.text && bn.source ? { path: bn.source.path, start: bn.fields.text.start, end: bn.fields.text.end } : null
    if (!as || !bs || !sameSpan(as, bs)) continue
    for (const object of [a, b]) {
      object.status = 'conflict'
      object.fields.text.supported = false
      object.supportedOperations = []
      object.unsupportedOperations = [...OPERATIONS]
      if (!object.reasons.includes('OWNER_CLAIM_CONFLICT')) object.reasons.push('OWNER_CLAIM_CONFLICT')
    }
  }
  const coverage = { mapped: 0, partial: 0, stale: 0, unmapped: 0, conflict: 0, total: objects.length }
  for (const object of objects) coverage[object.status] += 1
  return { schemaVersion: 1, workspaceId: map.workspaceId, documentId: map.documentId, sourceRevision: currentRevision,
    objects, coverage, claims: normalized.map(claim => ({ ...claim, conflicts: [...(conflicts.get(claim.index) ?? [])] })) }
}

function checkedReport(map, report) {
  assert(plain(report) && report.schemaVersion === 1 && report.workspaceId === map.workspaceId && report.documentId === map.documentId,
    'OWNERSHIP_INVALID_REPORT')
  const rebuilt = buildOwnership(map, { claims: report.claims, currentRevision: report.sourceRevision })
  assert(canonical(rebuilt) === canonical(report), 'OWNERSHIP_INVALID_REPORT')
  return rebuilt
}

export function inspectOwnership(map, reference, options = {}) {
  validateMap(map)
  assert(plain(options), 'OWNERSHIP_INVALID_OPTIONS')
  const found = resolve(map, reference)
  if (found.status !== 'resolved') return { status: found.status, reference: copy(reference), object: null }
  const report = options.report ? checkedReport(map, options.report) : buildOwnership(map, options)
  const object = report.objects.find(item => item.nodeId === found.node.id)
  return { status: object.status, reference: { workspaceId: map.workspaceId, documentId: map.documentId, nodeId: found.node.id },
    confidence: found.node.confidence, provenance: object.provenance ?? null, object: copy(object) }
}

function refusal(code, impact = []) { return { allowed: false, code, impact } }

export function planLiteralOperation(map, report, operation = {}) {
  validateMap(map)
  checkedReport(map, report)
  assert(plain(operation), 'OWNERSHIP_INVALID_OPERATION')
  const { reference, expectedRevision, text, currentSource } = operation
  assert(hex(expectedRevision) && typeof text === 'string' && Buffer.byteLength(text, 'utf8') <= MAX_PROPOSAL_BYTES,
    'OWNERSHIP_INVALID_OPERATION')
  assert((typeof currentSource === 'string' || Buffer.isBuffer(currentSource)) && Buffer.byteLength(currentSource) <= MAX_SOURCE_BYTES,
    'OWNERSHIP_INVALID_OPERATION')
  const found = resolve(map, reference)
  if (found.status !== 'resolved') return refusal(`OWNERSHIP_${found.status.toUpperCase().replaceAll('-', '_')}`)
  const node = found.node
  const object = report.objects.find(item => item.nodeId === node.id)
  const source = Buffer.isBuffer(currentSource) ? currentSource.toString('utf8') : currentSource
  const impact = node.source ? [{ sourcePath: node.source.path, documentId: map.documentId, nodeId: node.id,
    scope: shared(node.source.path) ? 'shared' : 'route', route: shared(node.source.path) ? 'all-routes' : map.route }] : []
  if (!node.source || !node.fields.text || object.status === 'unmapped') return refusal('OWNERSHIP_LITERAL_UNMAPPED', impact)
  if (object.status === 'conflict') return refusal('OWNERSHIP_CLAIM_CONFLICT', impact)
  if (object.status === 'stale' || report.sourceRevision !== map.sourceRevision) return refusal('OWNERSHIP_MAPPING_STALE', impact)
  if (!object.supportedOperations.includes('literal')) return refusal('OWNERSHIP_LITERAL_UNSUPPORTED', impact)
  if (expectedRevision !== map.sourceRevision || hashSourceRevision(source) !== expectedRevision) return refusal('OWNERSHIP_REVISION_CONFLICT', impact)
  if (node.source.end > source.length || node.fields.text.end > source.length
    || hashSourceRevision(source.slice(node.source.start, node.source.end)) !== node.source.fingerprint
    || hashSourceRevision(source.slice(node.fields.text.start, node.fields.text.end)) !== node.fields.text.fingerprint) {
    return refusal('OWNERSHIP_SPAN_MISMATCH', impact)
  }
  for (const claim of report.claims.filter(item => item.nodeId === node.id && item.fields.text?.owner === 'source')) {
    if (claim.source && (claim.source.end > source.length
      || hashSourceRevision(source.slice(claim.source.start, claim.source.end)) !== claim.source.fingerprint)) {
      return refusal('OWNERSHIP_CLAIM_SPAN_MISMATCH', impact)
    }
  }
  if (/[<>{}\u0000]/.test(text)) return refusal('OWNERSHIP_LITERAL_SYNTAX', impact)
  const original = source.slice(node.fields.text.start, node.fields.text.end)
  if (original.length === 0) return refusal('OWNERSHIP_LITERAL_UNSUPPORTED', impact)
  const first = source.indexOf(original)
  if (first !== node.fields.text.start || source.indexOf(original, first + original.length) !== -1) return refusal('OWNERSHIP_LITERAL_AMBIGUOUS', impact)
  if (Buffer.byteLength(source, 'utf8') - Buffer.byteLength(original, 'utf8') + Buffer.byteLength(text, 'utf8') > MAX_SOURCE_BYTES) {
    return refusal('OWNERSHIP_SOURCE_LIMIT', impact)
  }
  const patch = { start: node.fields.text.start, end: node.fields.text.end, replacement: text }
  assert(bytes({ impact, patch }) <= MAX_PROPOSAL_BYTES, 'OWNERSHIP_PROPOSAL_LIMIT')
  return { allowed: true, code: 'OWNERSHIP_LITERAL_PROPOSAL', impact, patch }
}

export function previewOwnershipChange(map, report, changes) {
  validateMap(map)
  checkedReport(map, report)
  const list = Array.isArray(changes) ? changes : plain(changes) ? changes.claims : null
  assert(Array.isArray(list) && list.length > 0 && list.length <= MAX_CLAIMS, 'OWNERSHIP_INVALID_CHANGES')
  const reviewed = readClaims(map, list)
  for (const claim of reviewed) {
    if (claim.mode === 'document-owned') assert(hasGeneratedBoundary(claim.provenance, map), 'OWNERSHIP_GENERATED_BOUNDARY_REQUIRED')
    if (claim.mode === 'hybrid-controlled') assert(Object.values(claim.fields).some(field => field.owner === 'source')
      && Object.values(claim.fields).some(field => field.owner === 'document'), 'OWNERSHIP_HYBRID_BOUNDARY_REQUIRED')
  }
  const changedIds = new Set(reviewed.map(claim => claim.nodeId))
  const retained = report.claims.filter(claim => !changedIds.has(claim.nodeId))
  const next = buildOwnership(map, { claims: [...retained, ...reviewed], currentRevision: report.sourceRevision })
  const affected = [...changedIds].map(nodeId => {
    const before = report.objects.find(object => object.nodeId === nodeId)
    const after = next.objects.find(object => object.nodeId === nodeId)
    return { nodeId, before: { mode: before.mode, status: before.status, fields: before.fields, sourcePath: before.source?.path ?? null },
      after: { mode: after.mode, status: after.status, fields: after.fields, sourcePath: after.source?.path ?? null } }
  })
  const proposal = { schemaVersion: 1, changes: reviewed, affected, report: next, requiresReview: true }
  proposal.digest = digest(proposal)
  assert(bytes(proposal) <= MAX_PROPOSAL_BYTES, 'OWNERSHIP_PROPOSAL_LIMIT')
  proposals.set(proposal, { digest: proposal.digest, report: copy(next) })
  return proposal
}

export function acceptOwnershipChange(proposal, options = {}) {
  assert(plain(options), 'OWNERSHIP_INVALID_OPTIONS')
  const { digest: expectedDigest, confirmation } = options
  assert(plain(proposal) && proposal.schemaVersion === 1 && proposal.requiresReview === true && hex(proposal.digest),
    'OWNERSHIP_INVALID_PROPOSAL')
  assert(hex(expectedDigest) && expectedDigest === proposal.digest && digest(Object.fromEntries(Object.entries(proposal).filter(([key]) => key !== 'digest'))) === proposal.digest,
    'OWNERSHIP_DIGEST_MISMATCH')
  assert(confirmation === 'ACCEPT OWNERSHIP CHANGE', 'OWNERSHIP_CONFIRMATION_REQUIRED')
  const held = proposals.get(proposal)
  assert(held && held.digest === proposal.digest && canonical(held.report) === canonical(proposal.report), 'OWNERSHIP_INVALID_PROPOSAL')
  return copy(held.report)
}

export function exportOwnershipDiagnostics(map, report) {
  validateMap(map)
  const checked = checkedReport(map, report)
  const diagnostics = { schemaVersion: 1, kind: 'systemx-source-ownership-diagnostics', workspaceId: map.workspaceId,
    documentId: map.documentId, sourceRevision: checked.sourceRevision, coverage: checked.coverage,
    objects: checked.objects.map(object => ({ reference: { workspaceId: map.workspaceId, documentId: map.documentId, nodeId: object.nodeId },
      mode: object.mode, adapterId: object.adapterId, status: object.status, source: object.source, fields: object.fields,
      fieldSpans: object.fieldSpans,
      supportedOperations: object.supportedOperations, unsupportedOperations: object.unsupportedOperations, reasons: object.reasons,
      definition: object.definition, instanceFields: object.instanceFields, definitionFields: object.definitionFields,
      provenance: object.provenance })), claims: checked.claims, truncated: false }
  while ((diagnostics.objects.length + diagnostics.claims.length > MAX_DIAGNOSTICS || bytes(diagnostics) > MAX_PROPOSAL_BYTES)
    && (diagnostics.claims.length || diagnostics.objects.length)) {
    if (diagnostics.claims.length) diagnostics.claims.splice(Math.max(0, Math.floor(diagnostics.claims.length / 2)))
    else diagnostics.objects.splice(Math.max(0, Math.floor(diagnostics.objects.length / 2)))
    diagnostics.truncated = true
  }
  assert(bytes(diagnostics) <= MAX_PROPOSAL_BYTES, 'OWNERSHIP_DIAGNOSTICS_LIMIT')
  return diagnostics
}
