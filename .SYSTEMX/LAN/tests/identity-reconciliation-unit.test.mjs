import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { acceptReconciliation, exportIdentityMap, previewReconciliation } from '../Builder/identity-reconciliation.mjs'

const sha = (value) => createHash('sha256').update(value).digest('hex')
const WORKSPACE = sha('temporary-workspace-a')
const PATH = 'src/pages/Example.tsx'
const REVISION = sha('source-v1')
const nodeId = (value) => `node_${sha(value)}`

function node(key, { path = PATH, revision = REVISION, parentId = null, tag = 'div', anchor = null,
  signature = sha(key), label = key, confidence = anchor ? 'explicit' : 'heuristic' } = {}) {
  return {
    id: confidence === 'unresolved' ? `candidate_${sha(`${path}:${key}`)}` : nodeId(`${path}:${key}`), parentId, tag, anchor, signature, label, confidence,
    source: { path, start: 0, end: 20, sourceRevision: revision, fingerprint: sha(`${key}:source`) },
    fields: { text: { start: 1, end: 5, fingerprint: sha(`${key}:text`) } },
    opaque: false, external: false,
  }
}

function map(nodes, { path = PATH, revision = REVISION, workspaceId = WORKSPACE, ruleVersion = 'identity-v1',
  documentId = `doc_${sha(`${workspaceId}:${path}`)}`, pageId = `page_${sha(`${workspaceId}:${path}`)}` } = {}) {
  return {
    schemaVersion: 1, ruleVersion, workspaceId, documentId, pageId, sourcePath: path,
    sourceRevision: revision, route: '/example', label: 'Private page title', nodes,
    aliases: [], orphaned: [], warnings: [],
  }
}

function assertCode(operation, code) {
  assert.throws(operation, (error) => error instanceof Error && error.code === code)
}

test('explicit anchors and unique parent-qualified heuristics survive a sibling reorder', () => {
  const root = node('root', { anchor: 'page-root' })
  const first = node('first', { parentId: root.id, signature: sha('literal-one'), label: 'Same label' })
  const second = node('second', { parentId: root.id, signature: sha('literal-two'), label: 'Same label' })
  const previous = map([root, first, second])
  const changedRevision = sha('source-v2')
  const incomingRoot = node('new-root-key', { anchor: 'page-root', revision: changedRevision, signature: sha('changed props') })
  const incomingFirst = node('new-first-key', { parentId: incomingRoot.id, revision: changedRevision,
    signature: first.signature, label: 'Renamed label' })
  const incomingSecond = node('new-second-key', { parentId: incomingRoot.id, revision: changedRevision,
    signature: second.signature, label: 'Renamed label' })
  const incoming = map([incomingSecond, incomingRoot, incomingFirst], { revision: changedRevision })
  const priorBytes = JSON.stringify(previous), incomingBytes = JSON.stringify(incoming)

  const proposal = previewReconciliation(previous, incoming)
  assert.deepEqual(proposal.counts, { preserved: 3, added: 0, retired: 0, ambiguous: 0 })
  assert.deepEqual(proposal.map.nodes.map((item) => item.id), [second.id, root.id, first.id])
  assert.equal(proposal.map.nodes[0].parentId, root.id)
  assert.equal(proposal.map.nodes[2].parentId, root.id)
  assert.equal(proposal.map.nodes[1].confidence, 'explicit')
  assert.equal(proposal.map.nodes[2].confidence, 'heuristic')
  assert.equal(JSON.stringify(previous), priorBytes)
  assert.equal(JSON.stringify(incoming), incomingBytes)
})

test('changed tags and anchors retire old IDs and leave orphan provenance', () => {
  const oldTag = node('old-tag', { anchor: 'stable-tag', tag: 'button' })
  const oldAnchor = node('old-anchor', { anchor: 'old-anchor', tag: 'span' })
  const previous = map([oldTag, oldAnchor])
  const replacementTag = node('replacement-tag', { anchor: 'stable-tag', tag: 'a' })
  const replacementAnchor = node('replacement-anchor', { anchor: 'new-anchor', tag: 'span' })
  const proposal = previewReconciliation(previous, map([replacementTag, replacementAnchor]))

  assert.deepEqual(proposal.counts, { preserved: 0, added: 2, retired: 2, ambiguous: 0 })
  assert.deepEqual(new Set(proposal.retired.map((entry) => entry.id)), new Set([oldTag.id, oldAnchor.id]))
  assert.deepEqual(new Set(proposal.orphans.map((entry) => entry.reference.nodeId)), new Set([oldTag.id, oldAnchor.id]))
  assert.equal(proposal.orphans[0].provenance.sourcePath, PATH)
  assert.equal(proposal.map.nodes.some((item) => item.id === oldTag.id), false)
})

test('a replacement remains distinct even when an adapter reuses its incoming anchor ID', () => {
  const old = node('stable-key', { anchor: 'same-anchor', tag: 'button' })
  const replacement = node('stable-key', { anchor: 'same-anchor', tag: 'a' })
  assert.equal(old.id, replacement.id)
  const proposal = previewReconciliation(map([old]), map([replacement]))
  assert.deepEqual(proposal.counts, { preserved: 0, added: 1, retired: 1, ambiguous: 0 })
  assert.notEqual(proposal.map.nodes[0].id, old.id)
  assert.equal(proposal.orphans[0].reference.nodeId, old.id)
  assert.equal(previewReconciliation(map([old]), map([replacement])).map.nodes[0].id, proposal.map.nodes[0].id)
})

test('indistinguishable unanchored siblings remain unresolved and are never assigned previous IDs', () => {
  const signature = sha('same structural evidence')
  const previous = map([node('old-1', { signature, confidence: 'unresolved' }), node('old-2', { signature, confidence: 'unresolved' })])
  const incoming = map([node('new-1', { signature, confidence: 'unresolved' }), node('new-2', { signature, confidence: 'unresolved' })])
  const proposal = previewReconciliation(previous, incoming)

  assert.deepEqual(proposal.counts, { preserved: 0, added: 0, retired: 2, ambiguous: 2 })
  assert.ok(proposal.map.nodes.every((item) => item.confidence === 'unresolved'))
  assert.deepEqual(new Set(proposal.map.nodes.map((item) => item.id)), new Set(incoming.nodes.map((item) => item.id)))
  assert.ok(proposal.ambiguous.every((entry) => entry.candidates.length === 2))
})

test('a first import also leaves repeated unanchored siblings unresolved', () => {
  const signature = sha('same structural evidence')
  const incoming = map([node('first', { signature, confidence: 'unresolved' }), node('second', { signature, confidence: 'unresolved' })])
  const proposal = previewReconciliation(null, incoming)
  assert.deepEqual(proposal.counts, { preserved: 0, added: 0, retired: 0, ambiguous: 2 })
  assert.ok(proposal.map.nodes.every((item) => item.confidence === 'unresolved'))
})

test('a rename needs explicit exact review, explains evidence, and accepts only its digest', () => {
  const previous = map([node('root', { anchor: 'root' })])
  const newPath = 'src/pages/Renamed.tsx'
  const incoming = map([node('new-root', { path: newPath, anchor: 'root' })], { path: newPath })
  assertCode(() => previewReconciliation(previous, incoming), 'IDENTITY_RENAME_REQUIRED')
  assertCode(() => previewReconciliation(previous, incoming, { renameFrom: 'src/pages/Other.tsx' }), 'IDENTITY_RENAME_REQUIRED')

  const proposal = previewReconciliation(previous, incoming, { renameFrom: PATH })
  assert.deepEqual(proposal.rename, {
    from: PATH, to: newPath, evidence: { sameSourceRevision: true, explicitMatches: 1, uniqueHeuristicMatches: 0 },
  })
  assert.equal(proposal.map.documentId, previous.documentId)
  assert.equal(proposal.map.pageId, previous.pageId)
  assert.equal(proposal.map.nodes[0].id, previous.nodes[0].id)
  assertCode(() => acceptReconciliation(proposal, { digest: proposal.digest, confirmation: 'NO' }), 'IDENTITY_CONFIRMATION_REQUIRED')
  assertCode(() => acceptReconciliation(proposal, null), 'IDENTITY_INVALID')
  assertCode(() => acceptReconciliation(proposal, { digest: sha('wrong'), confirmation: 'ACCEPT IDENTITY MAP' }), 'IDENTITY_DIGEST_MISMATCH')
  const accepted = acceptReconciliation(proposal, { digest: proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  accepted.nodes[0].label = 'mutated copy'
  assert.notEqual(proposal.map.nodes[0].label, accepted.nodes[0].label)
  const tampered = structuredClone(proposal)
  tampered.map.nodes[0].id = nodeId('tamper')
  assertCode(() => acceptReconciliation(tampered, { digest: proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' }), 'IDENTITY_DIGEST_MISMATCH')
})

test('ambiguous rename refuses to transfer reviewed document references', () => {
  const signature = sha('duplicate')
  const previous = map([node('old-1', { signature, confidence: 'unresolved' }), node('old-2', { signature, confidence: 'unresolved' })])
  const newPath = 'src/pages/New.tsx'
  const incoming = map([node('new-1', { path: newPath, signature, confidence: 'unresolved' }), node('new-2', { path: newPath, signature, confidence: 'unresolved' })], { path: newPath })
  assertCode(() => previewReconciliation(previous, incoming, { renameFrom: PATH }), 'IDENTITY_RENAME_AMBIGUOUS')
  const noMatch = map([node('unrelated', { path: newPath, anchor: 'new' })], { path: newPath })
  assertCode(() => previewReconciliation(map([node('original', { anchor: 'old' })]), noMatch, { renameFrom: PATH }), 'IDENTITY_RENAME_AMBIGUOUS')
})

test('reviewed aliases resolve only retired IDs within the selected document; orphans retain origin', () => {
  const old = node('old', { anchor: 'old' })
  const replacement = node('replacement', { anchor: 'replacement' })
  const previous = map([old])
  const incoming = map([replacement])
  const alias = { from: old.id, to: replacement.id, provenance: { reason: 'reviewed replacement' } }
  const proposal = previewReconciliation(previous, incoming, { aliases: [alias] })
  assert.deepEqual(proposal.map.aliases, [alias])
  assert.equal(proposal.orphans.length, 0)

  const unaliased = previewReconciliation(previous, incoming)
  const next = previewReconciliation(unaliased.map, incoming)
  assert.equal(next.orphans.length, 1)
  assert.deepEqual(next.orphans[0].provenance, unaliased.orphans[0].provenance)
  const qualifiedWrong = { workspaceId: WORKSPACE, documentId: `doc_${sha('another-doc')}`, nodeId: replacement.id }
  assertCode(() => previewReconciliation(previous, incoming, { aliases: [{ ...alias, to: qualifiedWrong }] }), 'IDENTITY_ALIAS_CROSS_DOCUMENT')
  assertCode(() => previewReconciliation(previous, incoming, { aliases: [{ ...alias, to: old.id }] }), 'IDENTITY_ALIAS_INVALID')
  assertCode(() => previewReconciliation(previous, incoming, { aliases: [alias, alias] }), 'IDENTITY_ALIAS_INVALID')
  assertCode(() => previewReconciliation(previous, incoming, { aliases: [
    { from: old.id, to: old.id, provenance: 'loop' },
  ] }), 'IDENTITY_ALIAS_INVALID')
})

test('rule versions are declared and an unavailable migration cannot silently reinterpret existing maps', () => {
  const old = node('root', { anchor: 'root' })
  const previous = map([old], { ruleVersion: 'identity-v1' })
  const incoming = map([node('new-root', { anchor: 'root' })], { ruleVersion: 'identity-v2' })
  assertCode(() => previewReconciliation(previous, incoming), 'IDENTITY_RULE_MIGRATION_REQUIRED')
  assertCode(() => previewReconciliation(previous, incoming, { ruleVersion: 'identity-v2' }), 'IDENTITY_RULE_MIGRATION_REQUIRED')
  assertCode(() => previewReconciliation(null, incoming, { ruleVersion: 'identity-v2' }), 'IDENTITY_VERSION_UNSUPPORTED')
  assertCode(() => exportIdentityMap(incoming), 'IDENTITY_VERSION_UNSUPPORTED')
  const proposal = previewReconciliation(previous, map([node('new-root', { anchor: 'root' })]))
  assert.equal(proposal.map.ruleVersion, 'identity-v1')
  assert.equal(proposal.migration, null)
  assert.equal(proposal.map.nodes[0].id, old.id)
  assert.equal(previous.ruleVersion, 'identity-v1')
})

test('metadata export removes original labels and validates for a same-workspace reopen', () => {
  const original = map([node('private-label', { anchor: 'safe' })])
  const exported = exportIdentityMap(original)
  assert.equal(exported.workspaceId, WORKSPACE)
  assert.equal(exported.documentId, original.documentId)
  assert.equal(exported.nodes[0].id, original.nodes[0].id)
  assert.equal(exported.nodes[0].source.fingerprint, original.nodes[0].source.fingerprint)
  assert.doesNotMatch(JSON.stringify(exported), /Private page title|private-label/)
  const reopened = previewReconciliation(null, exported)
  assert.equal(reopened.map.documentId, original.documentId)
  assertCode(() => previewReconciliation(map([], { workspaceId: sha('other workspace') }), exported), 'IDENTITY_WORKSPACE_MISMATCH')
})
