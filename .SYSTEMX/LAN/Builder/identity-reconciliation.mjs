import { createHash } from 'node:crypto'
import { isCanonicalSourcePath } from './source-policy.mjs'

const HASH = /^[a-f0-9]{64}$/
const ANCHOR = /^[A-Za-z][A-Za-z0-9_-]{0,79}$/
const RULE = /^identity-[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const CONFIDENCE = new Set(['explicit', 'heuristic', 'unresolved', 'reviewed-migration'])
const MAX_BYTES = 400_000
const has = (object, key) => Object.hasOwn(object, key)
const MAP_KEYS = new Set(['schemaVersion', 'ruleVersion', 'workspaceId', 'documentId', 'pageId', 'sourcePath', 'sourceRevision', 'route', 'label', 'nodes', 'aliases', 'orphaned', 'warnings'])
const NODE_KEYS = new Set(['id', 'parentId', 'tag', 'anchor', 'signature', 'label', 'confidence', 'source', 'fields', 'opaque', 'external', 'definition'])
const SOURCE_KEYS = new Set(['path', 'start', 'end', 'sourceRevision', 'fingerprint'])
const PROPOSAL_KEYS = new Set(['schemaVersion', 'digest', 'map', 'counts', 'preserved', 'added', 'retired', 'ambiguous', 'orphans', 'rename', 'migration', 'requiresReview'])

function refuse(code) {
  const error = new Error(code)
  error.code = code
  throw error
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}

// Copy only JSON data. This also refuses accessors, prototype keys and cycles so
// proposal digests cannot be changed by a getter during acceptance.
function copy(value, depth = 0, seen = new Set()) {
  if (depth > 16) refuse('IDENTITY_INVALID')
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'object' || seen.has(value)) refuse('IDENTITY_INVALID')
  seen.add(value)
  let result
  if (Array.isArray(value)) {
    if (value.length > 1000) refuse('IDENTITY_LIMIT')
    for (let index = 0; index < value.length; index += 1) if (!has(value, index)) refuse('IDENTITY_INVALID')
    result = value.map((entry) => copy(entry, depth + 1, seen))
  } else if (record(value)) {
    result = {}
    for (const key of Object.keys(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) refuse('IDENTITY_INVALID')
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!has(descriptor, 'value')) refuse('IDENTITY_INVALID')
      Object.defineProperty(result, key, { value: copy(descriptor.value, depth + 1, seen), enumerable: true, writable: true, configurable: true })
    }
  } else refuse('IDENTITY_INVALID')
  seen.delete(value)
  return result
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (record(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function digest(value) {
  return createHash('sha256').update(canonical(value)).digest('hex')
}

function bounded(value) {
  if (Buffer.byteLength(JSON.stringify(value)) > MAX_BYTES) refuse('IDENTITY_LIMIT')
  return value
}

function onlyKeys(value, allowed) {
  if (!record(value) || Object.keys(value).some((key) => !allowed.has(key))) refuse('IDENTITY_INVALID')
}

function span(value, sourcePath, sourceRevision) {
  if (!record(value) || !Number.isSafeInteger(value.start) || !Number.isSafeInteger(value.end)
    || value.start < 0 || value.end < value.start || value.end > 500_000 || !HASH.test(value.fingerprint)) refuse('IDENTITY_INVALID')
  if (sourcePath !== undefined && (value.path !== sourcePath || value.sourceRevision !== sourceRevision)) refuse('IDENTITY_INVALID')
}

function validateMap(input) {
  const map = copy(input)
  onlyKeys(map, MAP_KEYS)
  if (!record(map) || map.schemaVersion !== 1 || !RULE.test(map.ruleVersion)
    || !HASH.test(map.workspaceId) || !HASH.test(map.sourceRevision)
    || !isCanonicalSourcePath(map.sourcePath)
    || typeof map.documentId !== 'string' || !/^doc_[a-f0-9]{16,64}$/.test(map.documentId)
    || typeof map.pageId !== 'string' || !/^page_[a-f0-9]{16,64}$/.test(map.pageId)
    || typeof map.route !== 'string' || map.route.length > 512 || !/^\/(?!Users\/|Volumes\/|private\/)[^\\\x00-\x1f\x7f]*$/.test(map.route)
    || typeof map.label !== 'string' || map.label.length > 120
    || !Array.isArray(map.nodes) || map.nodes.length > 1000
    || !Array.isArray(map.aliases) || map.aliases.length > 256
    || !Array.isArray(map.orphaned) || map.orphaned.length > 1000
    || !Array.isArray(map.warnings) || map.warnings.length > 1000) refuse('IDENTITY_INVALID')

  const ids = new Set(), anchors = new Set()
  for (const node of map.nodes) {
    onlyKeys(node, NODE_KEYS)
    if (typeof node.id !== 'string' || node.id.length > 100 || !/^[A-Za-z][A-Za-z0-9_-]+$/.test(node.id)
      || ids.has(node.id) || (node.parentId !== null && typeof node.parentId !== 'string')
      || typeof node.tag !== 'string' || node.tag.length > 120 || !/^[A-Za-z][A-Za-z0-9._:-]*$/.test(node.tag)
      || (node.anchor !== null && !ANCHOR.test(node.anchor))
      || (node.anchor !== null && anchors.has(node.anchor)) || !HASH.test(node.signature)
      || typeof node.label !== 'string' || node.label.length > 120 || !CONFIDENCE.has(node.confidence)
      || typeof node.opaque !== 'boolean' || typeof node.external !== 'boolean'
      || !record(node.source) || node.source.path !== map.sourcePath || node.source.sourceRevision !== map.sourceRevision
      || !record(node.fields)) refuse('IDENTITY_INVALID')
    onlyKeys(node.source, SOURCE_KEYS)
    onlyKeys(node.fields, new Set(['text']))
    span(node.source, map.sourcePath, map.sourceRevision)
    if (has(node.fields, 'text')) {
      onlyKeys(node.fields.text, new Set(['start', 'end', 'fingerprint']))
      span(node.fields.text)
    }
    if (has(node, 'definition')) onlyKeys(node.definition, new Set(['name', 'sourcePath']))
    if (has(node, 'definition') && (!record(node.definition) || typeof node.definition.name !== 'string'
      || node.definition.name.length > 120 || (has(node.definition, 'sourcePath') && !isCanonicalSourcePath(node.definition.sourcePath)))) refuse('IDENTITY_INVALID')
    ids.add(node.id)
    if (node.anchor !== null) anchors.add(node.anchor)
  }
  const byId = new Map(map.nodes.map((node) => [node.id, node]))
  for (const node of map.nodes) {
    if (node.parentId !== null && !ids.has(node.parentId)) refuse('IDENTITY_INVALID')
    let cursor = node, steps = 0
    while (cursor.parentId !== null) {
      cursor = byId.get(cursor.parentId)
      if (++steps > map.nodes.length) refuse('IDENTITY_INVALID')
    }
  }
  const aliasFrom = new Set()
  for (const alias of map.aliases) {
    onlyKeys(alias, new Set(['from', 'to', 'provenance']))
    if (!record(alias) || typeof alias.from !== 'string' || typeof alias.to !== 'string'
      || alias.from === alias.to || ids.has(alias.from) || !ids.has(alias.to) || aliasFrom.has(alias.from)
      || !validProvenance(alias.provenance)) refuse('IDENTITY_INVALID')
    aliasFrom.add(alias.from)
  }
  for (const orphan of map.orphaned) {
    onlyKeys(orphan, new Set(['reference', 'source', 'confidence', 'anchor', 'signature', 'provenance']))
    onlyKeys(orphan.reference, new Set(['workspaceId', 'documentId', 'nodeId']))
    if (!record(orphan) || !record(orphan.reference) || orphan.reference.workspaceId !== map.workspaceId
      || orphan.reference.documentId !== map.documentId || typeof orphan.reference.nodeId !== 'string'
      || ids.has(orphan.reference.nodeId) || aliasFrom.has(orphan.reference.nodeId)
      || !validProvenance(orphan.provenance)) refuse('IDENTITY_INVALID')
    if (has(orphan, 'source')) {
      onlyKeys(orphan.source, SOURCE_KEYS)
      if (!isCanonicalSourcePath(orphan.source.path) || !HASH.test(orphan.source.sourceRevision)) refuse('IDENTITY_INVALID')
      span(orphan.source)
    }
    if (has(orphan, 'confidence') && !CONFIDENCE.has(orphan.confidence)) refuse('IDENTITY_INVALID')
    if (has(orphan, 'anchor') && orphan.anchor !== null && !ANCHOR.test(orphan.anchor)) refuse('IDENTITY_INVALID')
    if (has(orphan, 'signature') && !HASH.test(orphan.signature)) refuse('IDENTITY_INVALID')
  }
  return bounded(map)
}

function validProvenance(value) {
  if (typeof value === 'string') return value.length > 0 && value.length <= 500 && !unsafeMetadata(value)
  if (!record(value)) return false
  return Buffer.byteLength(JSON.stringify(value)) <= 2000 && metadataSafe(value)
}

function unsafeMetadata(value) {
  return /(?:^|\s)(?:\/Users\/|\/Volumes\/|\/private\/|[A-Za-z]:\\)|sk_(?:live|test)_|-----BEGIN/i.test(value)
}

function metadataSafe(value, depth = 0) {
  if (depth > 6) return false
  if (value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return true
  if (typeof value === 'string') return value.length <= 500 && !unsafeMetadata(value)
  if (Array.isArray(value)) return value.length <= 20 && value.every((entry) => metadataSafe(entry, depth + 1))
  if (!record(value) || Object.keys(value).length > 20) return false
  return Object.entries(value).every(([key, entry]) => !/^(?:label|text|body|content|html|token|secret|credential|runtime|handle|session|root|absolutePath|privatePath)$/i.test(key)
    && metadataSafe(entry, depth + 1))
}

function qualifiedId(value, map) {
  if (typeof value === 'string') return value
  if (!record(value) || value.workspaceId !== map.workspaceId || value.documentId !== map.documentId
    || typeof value.nodeId !== 'string') refuse('IDENTITY_ALIAS_CROSS_DOCUMENT')
  return value.nodeId
}

function childrenByEvidence(nodes, parentId) {
  const groups = new Map()
  for (const node of nodes) {
    if (node.parentId !== parentId || node.anchor !== null) continue
    const key = `${node.tag}\0${node.signature}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(node)
  }
  return groups
}

function orphanFor(node, map) {
  return {
    reference: { workspaceId: map.workspaceId, documentId: map.documentId, nodeId: node.id },
    source: copy(node.source), confidence: node.confidence, anchor: node.anchor, signature: node.signature,
    provenance: { reason: 'retired', sourcePath: map.sourcePath, sourceRevision: map.sourceRevision, ruleVersion: map.ruleVersion },
  }
}

export function previewReconciliation(previous, incoming, options = {}) {
  if (!record(options)) refuse('IDENTITY_INVALID')
  options = copy(options)
  const next = validateMap(incoming)
  const prior = previous === null ? null : validateMap(previous)
  const { renameFrom = null, aliases = [], ruleVersion = 'identity-v1' } = options
  if (!RULE.test(ruleVersion) || !Array.isArray(aliases) || aliases.length > 256) refuse('IDENTITY_INVALID')
  if (prior && prior.ruleVersion !== next.ruleVersion && !has(options, 'ruleVersion')) refuse('IDENTITY_RULE_MIGRATION_REQUIRED')
  if (ruleVersion !== next.ruleVersion) refuse('IDENTITY_INVALID')

  let rename = null, migration = null
  if (prior) {
    if (prior.workspaceId !== next.workspaceId) refuse('IDENTITY_WORKSPACE_MISMATCH')
    if (prior.sourcePath !== next.sourcePath) {
      if (renameFrom !== prior.sourcePath) refuse('IDENTITY_RENAME_REQUIRED')
    } else if (renameFrom !== null) refuse('IDENTITY_RENAME_INVALID')
    if (prior.ruleVersion !== next.ruleVersion) {
      migration = { from: prior.ruleVersion, to: next.ruleVersion, evidence: 'explicit-rule-version', requiresReview: true }
    }
  } else if (renameFrom !== null) refuse('IDENTITY_RENAME_INVALID')

  const preserved = [], added = [], retired = [], ambiguous = []
  const oldToNew = new Map(), newToOld = new Map(), evidence = new Map()
  for (const parentId of new Set(next.nodes.map((node) => node.parentId))) {
    for (const group of childrenByEvidence(next.nodes, parentId).values()) {
      if (group.length > 1) for (const node of group) ambiguous.push({ id: node.id, candidates: [], reason: 'indistinguishable-siblings' })
    }
  }
  if (prior) {
    const oldAnchors = new Map(prior.nodes.filter((node) => node.anchor !== null).map((node) => [node.anchor, node]))
    for (const node of next.nodes) {
      if (node.anchor === null) continue
      const old = oldAnchors.get(node.anchor)
      if (old && old.tag === node.tag && old.confidence !== 'unresolved') {
        oldToNew.set(old.id, node.id)
        newToOld.set(node.id, old.id)
        evidence.set(node.id, 'explicit-anchor')
      }
    }
    // Parent qualification is essential: matching signatures in separate
    // subtrees never identify one another. Resolve each level before children.
    const queue = [[null, null], ...[...oldToNew].map(([oldId, newId]) => [oldId, newId])]
    const visited = new Set()
    while (queue.length) {
      const [oldParent, newParent] = queue.shift()
      const pair = `${oldParent ?? ''}\0${newParent ?? ''}`
      if (visited.has(pair)) continue
      visited.add(pair)
      const oldGroups = childrenByEvidence(prior.nodes, oldParent)
      const newGroups = childrenByEvidence(next.nodes, newParent)
      for (const [key, newGroup] of newGroups) {
        const oldGroup = oldGroups.get(key) ?? []
        if (oldGroup.length === 1 && newGroup.length === 1
          && oldGroup[0].confidence !== 'unresolved' && newGroup[0].confidence !== 'unresolved'
          && !oldToNew.has(oldGroup[0].id) && !newToOld.has(newGroup[0].id)) {
          oldToNew.set(oldGroup[0].id, newGroup[0].id)
          newToOld.set(newGroup[0].id, oldGroup[0].id)
          evidence.set(newGroup[0].id, 'unique-parent-signature')
          queue.push([oldGroup[0].id, newGroup[0].id])
        } else if (newGroup.length > 1 || oldGroup.length > 1) {
          for (const node of newGroup) {
            const entry = ambiguous.find((item) => item.id === node.id)
            if (entry) entry.candidates = oldGroup.map((candidate) => candidate.id)
            else ambiguous.push({ id: node.id, candidates: oldGroup.map((candidate) => candidate.id), reason: 'indistinguishable-siblings' })
          }
        }
      }
    }
  }

  const priorIds = new Set(prior ? [
    ...prior.nodes.map((node) => node.id), ...prior.aliases.map((alias) => alias.from),
    ...prior.orphaned.map((orphan) => orphan.reference.nodeId),
  ] : [])
  const remapped = new Map()
  const allocated = new Set()
  for (const node of next.nodes) {
    let id = newToOld.get(node.id) ?? node.id
    if (!newToOld.has(node.id) && priorIds.has(id)) {
      let salt = 0
      do {
        id = `node_${digest({ kind: 'reviewed-replacement', documentId: prior.documentId, incomingId: node.id,
          tag: node.tag, anchor: node.anchor, signature: node.signature, sourceRevision: next.sourceRevision, salt: salt++ })}`
      } while (priorIds.has(id) || allocated.has(id))
    }
    remapped.set(node.id, id)
    allocated.add(id)
  }
  const finalIds = new Set(remapped.values())
  if (finalIds.size !== next.nodes.length) refuse('IDENTITY_COLLISION')
  for (const node of next.nodes) {
    const originalId = node.id
    node.id = remapped.get(originalId)
    if (node.parentId !== null) node.parentId = remapped.get(node.parentId)
    const oldId = newToOld.get(originalId)
    if (oldId) {
      node.confidence = migration || prior.nodes.find((candidate) => candidate.id === oldId)?.confidence === 'reviewed-migration'
        ? 'reviewed-migration' : node.anchor !== null ? 'explicit' : 'heuristic'
      preserved.push({ from: oldId, to: node.id, incomingId: originalId, evidence: evidence.get(originalId) })
    } else if (ambiguous.some((entry) => entry.id === originalId) || node.confidence === 'unresolved') {
      node.confidence = 'unresolved'
      if (!ambiguous.some((entry) => entry.id === originalId)) ambiguous.push({ id: originalId, candidates: [], reason: 'unresolved-identity' })
    } else added.push({ id: node.id, confidence: node.confidence })
  }
  for (const entry of ambiguous) entry.id = remapped.get(entry.id)
  const retiredNodes = prior ? prior.nodes.filter((node) => !oldToNew.has(node.id)) : []
  for (const node of retiredNodes) retired.push({ id: node.id, confidence: node.confidence, reason: 'identity-evidence-changed' })

  if (prior && prior.sourcePath !== next.sourcePath) {
    const explicit = preserved.filter((entry) => entry.evidence === 'explicit-anchor').length
    const heuristic = preserved.filter((entry) => entry.evidence === 'unique-parent-signature').length
    if (((prior.nodes.length > 0 || next.nodes.length > 0) && explicit + heuristic === 0)
      || ambiguous.length > 0) refuse('IDENTITY_RENAME_AMBIGUOUS')
    rename = {
      from: prior.sourcePath, to: next.sourcePath,
      evidence: { sameSourceRevision: prior.sourceRevision === next.sourceRevision, explicitMatches: explicit, uniqueHeuristicMatches: heuristic },
    }
    next.documentId = prior.documentId
    next.pageId = prior.pageId
  } else if (prior) {
    if (prior.documentId !== next.documentId || prior.pageId !== next.pageId) {
      if (!migration) refuse('IDENTITY_DOCUMENT_MISMATCH')
      migration.documentIds = { from: prior.documentId, incoming: next.documentId, preserved: prior.documentId }
      migration.pageIds = { from: prior.pageId, incoming: next.pageId, preserved: prior.pageId }
      next.documentId = prior.documentId
      next.pageId = prior.pageId
    }
  }

  const carriedAliases = []
  const carriedOrphans = prior ? prior.orphaned.map((orphan) => copy(orphan)) : []
  if (prior) {
    for (const alias of prior.aliases) {
      if (finalIds.has(alias.from)) refuse('IDENTITY_ALIAS_CONFLICT')
      if (finalIds.has(alias.to)) carriedAliases.push(copy(alias))
      else carriedOrphans.push({ reference: { workspaceId: next.workspaceId, documentId: next.documentId, nodeId: alias.from }, provenance: { reason: 'alias-target-retired', previous: copy(alias.provenance) } })
    }
  }
  const retiredIds = new Set([...retired.map((entry) => entry.id), ...carriedOrphans.map((entry) => entry.reference.nodeId)])
  const seenAliases = new Set(carriedAliases.map((alias) => alias.from))
  for (const input of aliases) {
    if (!record(input) || !validProvenance(input.provenance)) refuse('IDENTITY_ALIAS_INVALID')
    const from = qualifiedId(input.from, prior ?? next)
    const rawTo = qualifiedId(input.to, next)
    const to = remapped.get(rawTo) ?? rawTo
    if (!retiredIds.has(from) || finalIds.has(from) || !finalIds.has(to) || from === to || seenAliases.has(from)) refuse('IDENTITY_ALIAS_INVALID')
    carriedAliases.push({ from, to, provenance: copy(input.provenance) })
    seenAliases.add(from)
  }
  if (carriedAliases.length > 256) refuse('IDENTITY_LIMIT')
  next.aliases = carriedAliases
  const aliased = new Set(carriedAliases.map((alias) => alias.from))
  const orphans = carriedOrphans.filter((orphan) => !aliased.has(orphan.reference.nodeId))
  for (const node of retiredNodes) if (!aliased.has(node.id)) orphans.push(orphanFor(node, prior))
  next.orphaned = orphans
  next.ruleVersion = ruleVersion
  validateMap(next)
  const proposal = {
    schemaVersion: 1, map: next,
    counts: { preserved: preserved.length, added: added.length, retired: retired.length, ambiguous: ambiguous.length },
    preserved, added, retired, ambiguous, orphans: copy(orphans), rename, migration, requiresReview: true,
  }
  return bounded({ ...proposal, digest: digest(proposal) })
}

export function acceptReconciliation(proposal, options = {}) {
  if (!record(options)) refuse('IDENTITY_INVALID')
  const { digest: expected, confirmation } = copy(options)
  if (confirmation !== 'ACCEPT IDENTITY MAP') refuse('IDENTITY_CONFIRMATION_REQUIRED')
  const candidate = copy(proposal)
  onlyKeys(candidate, PROPOSAL_KEYS)
  if (!record(candidate) || candidate.schemaVersion !== 1 || candidate.requiresReview !== true || !HASH.test(candidate.digest)
    || expected !== candidate.digest) refuse('IDENTITY_DIGEST_MISMATCH')
  const { digest: stated, ...unsigned } = candidate
  if (digest(unsigned) !== stated) refuse('IDENTITY_DIGEST_MISMATCH')
  bounded(candidate)
  if (!record(candidate.counts) || Object.keys(candidate.counts).some((key) => !['preserved', 'added', 'retired', 'ambiguous'].includes(key))
    || !Array.isArray(candidate.preserved) || !Array.isArray(candidate.added)
    || !Array.isArray(candidate.retired) || !Array.isArray(candidate.ambiguous) || !Array.isArray(candidate.orphans)
    || candidate.counts.preserved !== candidate.preserved.length || candidate.counts.added !== candidate.added.length
    || candidate.counts.retired !== candidate.retired.length || candidate.counts.ambiguous !== candidate.ambiguous.length
    || canonical(candidate.orphans) !== canonical(candidate.map.orphaned)
    || (candidate.rename !== null && !record(candidate.rename))
    || (candidate.migration !== null && !record(candidate.migration))) refuse('IDENTITY_INVALID')
  return validateMap(candidate.map)
}

export function exportIdentityMap(map) {
  const source = validateMap(map)
  const exported = {
    schemaVersion: 1, ruleVersion: source.ruleVersion, workspaceId: source.workspaceId,
    documentId: source.documentId, pageId: source.pageId, sourcePath: source.sourcePath,
    sourceRevision: source.sourceRevision, route: source.route, label: '',
    nodes: source.nodes.map((node) => ({
      id: node.id, parentId: node.parentId, tag: node.tag, anchor: node.anchor,
      signature: node.signature, label: '', confidence: node.confidence,
      source: { path: node.source.path, start: node.source.start, end: node.source.end,
        sourceRevision: node.source.sourceRevision, fingerprint: node.source.fingerprint },
      fields: has(node.fields, 'text') ? { text: { start: node.fields.text.start, end: node.fields.text.end, fingerprint: node.fields.text.fingerprint } } : {},
      opaque: node.opaque, external: node.external,
      ...(node.definition ? { definition: { name: node.definition.name, ...(node.definition.sourcePath ? { sourcePath: node.definition.sourcePath } : {}) } } : {}),
    })),
    aliases: copy(source.aliases), orphaned: copy(source.orphaned), warnings: [],
  }
  return validateMap(bounded(exported))
}
