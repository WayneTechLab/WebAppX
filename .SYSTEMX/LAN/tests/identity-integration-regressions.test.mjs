import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createIdentityMap, identityDigest, resolveIdentity, validateIdentityMap } from '../Builder/identity-core.mjs'
import { acceptReconciliation, exportIdentityMap, previewReconciliation } from '../Builder/identity-reconciliation.mjs'

const workspaceId = identityDigest('identity-regression-workspace')
const sourcePath = 'src/pages/HomePage.tsx'
const revision = identityDigest('revision-one')
const hash = identityDigest

function raw(key, { parentKey = null, anchor = null, tag = 'p', signature = hash(key), path = sourcePath,
  sourceRevision = revision, start = 0, label = key } = {}) {
  return { key, parentKey, tag, anchor, signature, label,
    source: { path, start, end: start + 8, sourceRevision, fingerprint: hash(`span:${key}:${start}`) },
    fields: { text: { start: start + 1, end: start + 3, fingerprint: hash(`text:${key}:${start}`) } },
    opaque: false, external: false }
}
function make(nodes, options = {}) {
  return createIdentityMap({ workspaceId, sourcePath, sourceRevision: revision, nodes, ...options })
}
const accept = proposal => acceptReconciliation(proposal, { digest: proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
const reference = (map, nodeId) => ({ workspaceId: map.workspaceId, documentId: map.documentId, nodeId })
const expectCode = (operation, code) => assert.throws(operation, error => error instanceof Error && error.code === code)

test('repeated real ambiguous imports retain candidate namespaces and never resolve an old candidate to a replacement', () => {
  const signature = hash('indistinguishable')
  const incoming = make([raw('one', { signature }), raw('two', { signature, start: 20 })])
  const first = accept(previewReconciliation(null, incoming))
  const before = structuredClone(first)
  const secondProposal = previewReconciliation(first, incoming)
  const second = accept(secondProposal)
  assert.equal(validateIdentityMap(second), second)
  assert.equal(secondProposal.counts.ambiguous, 2)
  assert.equal(secondProposal.counts.preserved, 0)
  for (const node of second.nodes) {
    assert.match(node.id, /^candidate_[a-f0-9]{64}$/)
    assert.equal(node.confidence, 'unresolved')
    assert.equal(resolveIdentity(second, reference(second, node.id)).status, 'ambiguous')
  }
  for (const node of first.nodes) assert.equal(resolveIdentity(second, reference(first, node.id)).status, 'missing')
  assert.deepEqual(first, before)
  assert.equal(validateIdentityMap(exportIdentityMap(second)).nodes.length, 2)
})

test('prior ambiguity propagates through a newly unique unanchored parent without relying on source order', () => {
  const repeated = hash('same parent')
  const previous = make([
    raw('root', { anchor: 'Root', tag: 'main' }),
    raw('left', { parentKey: 'root', signature: repeated, tag: 'section', start: 20 }),
    raw('right', { parentKey: 'root', signature: repeated, tag: 'section', start: 40 }),
    raw('child', { parentKey: 'left', start: 60 }),
    raw('known', { parentKey: 'left', anchor: 'Known', start: 80 }),
  ])
  const next = make([
    raw('child', { parentKey: 'left', start: 60 }),
    raw('known', { parentKey: 'left', anchor: 'Known', start: 80 }),
    raw('left', { parentKey: 'root', signature: repeated, tag: 'section', start: 20 }),
    raw('root', { anchor: 'Root', tag: 'main' }),
  ])
  const reconciled = accept(previewReconciliation(previous, next))
  validateIdentityMap(reconciled)
  const parent = reconciled.nodes.find(node => node.tag === 'section')
  const child = reconciled.nodes.find(node => node.parentId === parent.id && node.anchor === null)
  assert.equal(parent.confidence, 'unresolved')
  assert.equal(child.confidence, 'unresolved')
  assert.match(parent.id, /^candidate_/)
  assert.match(child.id, /^candidate_/)
  const known = reconciled.nodes.find(node => node.anchor === 'Known')
  assert.equal(known.id, previous.nodes.find(node => node.anchor === 'Known').id)
  assert.equal(resolveIdentity(reconciled, reference(previous, known.id)).status, 'resolved')
})

test('an accepted rename allocation survives ordinary later reimports, export and reopen', () => {
  const renamedPath = 'src/pages/RenamedPage.tsx'
  const laterRevision = hash('revision-two')
  const nodes = (path, sourceRevision) => [
    raw('root', { anchor: 'Root', tag: 'main', path, sourceRevision }),
    raw('body', { parentKey: 'root', path, sourceRevision, start: 20 }),
  ]
  const original = accept(previewReconciliation(null, make(nodes(sourcePath, revision))))
  const freshRename = make(nodes(renamedPath, revision), { sourcePath: renamedPath })
  expectCode(() => previewReconciliation(original, freshRename), 'IDENTITY_RENAME_REQUIRED')
  const renamed = accept(previewReconciliation(original, freshRename, { renameFrom: sourcePath }))
  assert.equal(renamed.documentId, original.documentId)
  const freshLater = make(nodes(renamedPath, laterRevision), { sourcePath: renamedPath, sourceRevision: laterRevision })
  assert.notEqual(freshLater.documentId, renamed.documentId)
  const proposal = previewReconciliation(renamed, freshLater)
  assert.equal(proposal.rename, null)
  assert.equal(proposal.migration, null)
  assert.ok(proposal.map.warnings.some(item => item.code === 'REVIEWED_ALLOCATION_PRESERVED'
    && item.documentId === original.documentId && item.sourcePath === renamedPath))
  const modified = accept(proposal)
  validateIdentityMap(modified)
  assert.equal(modified.documentId, original.documentId)
  assert.equal(modified.pageId, original.pageId)
  for (const old of original.nodes) assert.equal(resolveIdentity(modified, reference(original, old.id)).status, 'resolved')
  const reopened = accept(previewReconciliation(null, exportIdentityMap(modified)))
  assert.deepEqual(reopened.nodes.map(node => node.id), modified.nodes.map(node => node.id))
  assert.equal(reopened.documentId, original.documentId)
  assert.equal(reopened.sourcePath, renamedPath)
  assert.equal(reopened.sourceRevision, laterRevision)
})

test('new explicit and heuristic nodes after a rename use the preserved document allocation', () => {
  const newPath = 'src/pages/RenamedPage.tsx'
  const original = make([raw('root', { anchor: 'Root', tag: 'main' })])
  const renamedIncoming = make([raw('root', { anchor: 'Root', tag: 'main', path: newPath })], { sourcePath: newPath })
  const renamed = accept(previewReconciliation(original, renamedIncoming, { renameFrom: sourcePath }))
  const incoming = make([
    raw('heuristic', { parentKey: 'added', path: newPath, start: 40 }),
    raw('added', { anchor: 'Added', parentKey: 'root', tag: 'section', path: newPath, start: 20 }),
    raw('root', { anchor: 'Root', tag: 'main', path: newPath }),
  ], { sourcePath: newPath })
  const next = accept(previewReconciliation(renamed, incoming))
  validateIdentityMap(next)
  assert.equal(next.documentId, original.documentId)
  assert.equal(next.pageId, original.pageId)
  const root = next.nodes.find(node => node.anchor === 'Root')
  const added = next.nodes.find(node => node.anchor === 'Added')
  const heuristic = next.nodes.find(node => node.anchor === null)
  assert.equal(root.id, original.nodes[0].id)
  assert.equal(added.id, `node_${hash(['explicit', original.documentId, 'section', 'Added'])}`)
  assert.equal(heuristic.parentId, added.id)
  assert.equal(heuristic.id, `node_${hash(['heuristic', original.documentId, added.id, heuristic.tag, heuristic.signature])}`)
  const repeated = accept(previewReconciliation(next, incoming))
  assert.deepEqual(repeated.nodes.map(node => node.id), next.nodes.map(node => node.id))
  assert.deepEqual(validateIdentityMap(exportIdentityMap(repeated)).nodes.map(node => node.id), next.nodes.map(node => node.id))
})

test('a new heuristic child uses the final preserved replacement-parent ID', () => {
  const original = make([raw('root', { anchor: 'Root', tag: 'main' })])
  const absent = accept(previewReconciliation(original, make([])))
  const replacement = accept(previewReconciliation(absent, make([raw('root', { anchor: 'Root', tag: 'main' })])))
  assert.notEqual(replacement.nodes[0].id, original.nodes[0].id)
  const incoming = make([
    raw('child', { parentKey: 'root', start: 20 }),
    raw('root', { anchor: 'Root', tag: 'main' }),
  ])
  const next = accept(previewReconciliation(replacement, incoming))
  validateIdentityMap(next)
  const parent = next.nodes.find(node => node.anchor === 'Root'), child = next.nodes.find(node => node.anchor === null)
  assert.equal(parent.id, replacement.nodes[0].id)
  assert.equal(child.parentId, parent.id)
  assert.equal(child.id, `node_${hash(['heuristic', next.documentId, parent.id, child.tag, child.signature])}`)
})

test('retired references never silently attach when a source anchor disappears and later returns', () => {
  const initial = make([raw('target', { anchor: 'Target' })])
  const oldId = initial.nodes[0].id
  const retired = accept(previewReconciliation(initial, make([])))
  assert.equal(retired.orphaned[0].reference.nodeId, oldId)
  const provenance = structuredClone(retired.orphaned[0].provenance)
  const returned = accept(previewReconciliation(retired, make([raw('target', { anchor: 'Target' })])))
  validateIdentityMap(returned)
  assert.notEqual(returned.nodes[0].id, oldId)
  assert.equal(resolveIdentity(returned, reference(initial, oldId)).status, 'missing')
  assert.deepEqual(returned.orphaned[0].provenance, provenance)
})

test('reviewed aliases retain qualification, reject cross-document targets and do not form loops', () => {
  const previous = make([raw('old', { anchor: 'Old' })])
  const incoming = make([raw('new', { anchor: 'New' })])
  const alias = { from: reference(previous, previous.nodes[0].id), to: reference(incoming, incoming.nodes[0].id),
    provenance: { reason: 'operator-reviewed replacement' } }
  const accepted = accept(previewReconciliation(previous, incoming, { aliases: [alias] }))
  validateIdentityMap(accepted)
  assert.equal(resolveIdentity(accepted, reference(previous, previous.nodes[0].id)).node.id, incoming.nodes[0].id)
  const foreign = { ...alias.to, documentId: `doc_${hash('other document')}` }
  expectCode(() => previewReconciliation(previous, incoming, { aliases: [{ ...alias, to: foreign }] }), 'IDENTITY_ALIAS_CROSS_DOCUMENT')
  expectCode(() => previewReconciliation(previous, incoming, { aliases: [{ ...alias, to: alias.from }] }), 'IDENTITY_ALIAS_INVALID')
  const anotherWorkspace = make([raw('new', { anchor: 'New' })], { workspaceId: hash('other-workspace') })
  expectCode(() => previewReconciliation(previous, anotherWorkspace), 'IDENTITY_WORKSPACE_MISMATCH')
})

test('nested array accessors are refused without executing during digest, import, validation or reconciliation acceptance', () => {
  let calls = 0
  const accessor = value => {
    const array = []
    Object.defineProperty(array, '0', { enumerable: true, get() { calls += 1; return value } })
    return array
  }
  expectCode(() => identityDigest(accessor('value')), 'IDENTITY_DIGEST_INVALID')
  expectCode(() => make(accessor(raw('target', { anchor: 'Target' }))), 'IDENTITY_DIGEST_INVALID')
  const map = make([raw('target', { anchor: 'Target' })])
  expectCode(() => validateIdentityMap({ ...map, nodes: accessor(map.nodes[0]) }), 'IDENTITY_DIGEST_INVALID')
  expectCode(() => previewReconciliation(null, map, { aliases: accessor({}) }), 'IDENTITY_INVALID')
  const proposal = previewReconciliation(null, map)
  const tampered = { ...proposal, map: { ...proposal.map, nodes: accessor(map.nodes[0]) } }
  expectCode(() => accept(tampered), 'IDENTITY_INVALID')
  assert.equal(calls, 0)
})

test('unknown rule versions require an implemented migration and cannot be accepted by naming the version', () => {
  const map = make([raw('target', { anchor: 'Target' })])
  const future = { ...map, ruleVersion: 'identity-v2' }
  expectCode(() => validateIdentityMap(future), 'IDENTITY_VERSION_UNSUPPORTED')
  expectCode(() => previewReconciliation(null, future), 'IDENTITY_VERSION_UNSUPPORTED')
  expectCode(() => previewReconciliation(map, future, { ruleVersion: 'identity-v2' }), 'IDENTITY_RULE_MIGRATION_REQUIRED')
  expectCode(() => previewReconciliation(map, map, { ruleVersion: 'identity-v2' }), 'IDENTITY_VERSION_UNSUPPORTED')
  expectCode(() => exportIdentityMap(future), 'IDENTITY_VERSION_UNSUPPORTED')
  assert.equal(map.ruleVersion, 'identity-v1')
})

test('credential keys and secret-shaped provenance cannot enter maps or metadata exports', () => {
  const previous = make([raw('old', { anchor: 'Old' })])
  const next = make([raw('new', { anchor: 'New' })])
  const from = previous.nodes[0].id, to = next.nodes[0].id
  for (const provenance of [{ apiKey: 'synthetic-fixture-only' }, { reason: 'AIza0123456789abcdefghijklmnop' },
    { authorization: 'synthetic-fixture-only' }, { reason: 'sk_live_fixture_only' }, { reason: 'sk-proj-SYNTHETIC_ONLY' },
    { reason: 'ghp_SYNTHETIC_ONLY' }, { reason: 'gho_SYNTHETIC_ONLY' }, { reason: 'github_pat_SYNTHETIC_ONLY' },
    { reason: 'xoxb-SYNTHETIC_ONLY' }, { reason: '/home/private-fixture/location' }]) {
    const aliases = [{ from, to, provenance }]
    expectCode(() => previewReconciliation(previous, next, { aliases }), 'IDENTITY_ALIAS_INVALID')
    const unsafe = { ...next, aliases }
    expectCode(() => validateIdentityMap(unsafe), 'IDENTITY_METADATA_INVALID')
    assert.throws(() => exportIdentityMap(unsafe), error => error instanceof Error && typeof error.code === 'string'
      && !error.message.includes('AIza') && !error.message.includes('private-fixture'))
  }
  const safe = accept(previewReconciliation(previous, next, { aliases: [{ from, to, provenance: { reason: 'reviewed replacement' } }] }))
  const exported = exportIdentityMap(safe)
  validateIdentityMap(exported)
  assert.deepEqual(exported.aliases, safe.aliases)
  assert.equal(exported.label, '')
  assert.ok(exported.nodes.every(node => node.label === ''))
})

test('export screens every retained anchor, definition, route and path after stripping source-derived labels', () => {
  const anchors = ['sk_live_SYNTHETIC_ONLY', 'ghp_SYNTHETIC_ONLY', 'gho_SYNTHETIC_ONLY', 'AIza0123456789abcdefghijklmnop']
  for (const anchor of anchors) {
    const readable = make([raw('target', { anchor })])
    validateIdentityMap(readable)
    expectCode(() => exportIdentityMap(readable), 'IDENTITY_EXPORT_UNSAFE_METADATA')
  }
  const definitionNode = raw('target', { anchor: 'Safe' })
  definitionNode.definition = { name: 'ghp_SYNTHETIC_ONLY', sourcePath }
  expectCode(() => exportIdentityMap(make([definitionNode])), 'IDENTITY_EXPORT_UNSAFE_METADATA')
  const sensitivePath = 'src/pages/sk-proj-SYNTHETIC_ONLY.tsx'
  expectCode(() => exportIdentityMap(make([raw('target', { anchor: 'Safe', path: sensitivePath })], { sourcePath: sensitivePath })), 'IDENTITY_EXPORT_UNSAFE_METADATA')
  expectCode(() => exportIdentityMap(make([raw('target', { anchor: 'Safe' })], { route: '/credentials/sk-proj-SYNTHETIC_ONLY' })), 'IDENTITY_EXPORT_UNSAFE_METADATA')
  const labelsOnly = make([raw('target', { anchor: 'Safe', label: 'sk_live_SOURCE_TEXT_ONLY' })], { label: 'ghp_DOCUMENT_LABEL_ONLY' })
  const exported = exportIdentityMap(labelsOnly)
  assert.equal(exported.label, '')
  assert.equal(exported.nodes[0].label, '')
  assert.doesNotMatch(JSON.stringify(exported), /sk_live_|ghp_/)
})

test('every duplicate identifier group is reported with bounded opaque digests and exact occurrence counts', () => {
  const previous = make([raw('retained', { anchor: 'Retained' })])
  const before = structuredClone(previous)
  const inspectDuplicates = (operation, code, identifiers) => {
    assert.throws(operation, error => {
      assert.equal(error.code, code)
      assert.equal(error.message, code)
      assert.ok(Array.isArray(error.diagnostics))
      assert.ok(error.diagnostics.length <= 1000)
      assert.deepEqual(error.diagnostics, identifiers.map(([identifier, count]) => ({ code, identityDigest: hash(identifier), count }))
        .sort((left, right) => left.identityDigest < right.identityDigest ? -1 : left.identityDigest > right.identityDigest ? 1 : 0))
      for (const item of error.diagnostics) {
        assert.deepEqual(Object.keys(item).sort(), ['code', 'count', 'identityDigest'])
        assert.match(item.identityDigest, /^[a-f0-9]{64}$/)
      }
      for (const [identifier] of identifiers) assert.equal(JSON.stringify(error.diagnostics).includes(identifier), false)
      return true
    })
  }
  const repeatedAnchors = [
    raw('a1', { anchor: 'AnchorA' }), raw('a2', { anchor: 'AnchorA' }),
    raw('b1', { anchor: 'AnchorB' }), raw('b2', { anchor: 'AnchorB' }), raw('b3', { anchor: 'AnchorB' }),
  ]
  inspectDuplicates(() => make(repeatedAnchors), 'IDENTITY_DUPLICATE_ANCHOR', [['AnchorA', 2], ['AnchorB', 3]])
  const repeatedKeys = [raw('keyA'), raw('keyA'), raw('keyB'), raw('keyB'), raw('keyB')]
  inspectDuplicates(() => make(repeatedKeys), 'IDENTITY_DUPLICATE_KEY', [['keyA', 2], ['keyB', 3]])
  const duplicateMap = make(Array.from({ length: 5 }, (_, index) => raw(`unique${index}`, { anchor: `Unique${index}` })))
  const firstId = duplicateMap.nodes[0].id, secondId = duplicateMap.nodes[2].id
  duplicateMap.nodes[1].id = firstId
  duplicateMap.nodes[3].id = secondId
  duplicateMap.nodes[4].id = secondId
  inspectDuplicates(() => validateIdentityMap(duplicateMap), 'IDENTITY_DUPLICATE_NODE', [[firstId, 2], [secondId, 3]])
  assert.throws(() => make(Array.from({ length: 1000 }, (_, index) => raw(`bounded${index}`, { anchor: `Pair${Math.floor(index / 2)}` }))), error => {
    assert.equal(error.code, 'IDENTITY_DUPLICATE_ANCHOR')
    assert.equal(error.diagnostics.length, 500)
    assert.ok(error.diagnostics.every(item => item.count === 2 && Object.keys(item).length === 3))
    return true
  })
  expectCode(() => make(Array.from({ length: 1001 }, (_, index) => raw(`overflow${index}`))), 'IDENTITY_NODE_LIMIT')
  assert.deepEqual(previous, before)
})
