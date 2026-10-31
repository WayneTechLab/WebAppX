import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createIdentityMap, identityDigest, resolveIdentity, validateIdentityMap } from '../Builder/identity-core.mjs'

const sha = value => createHash('sha256').update(value).digest('hex')
const workspaceId = sha('temporary-workspace-a')
const secondWorkspaceId = sha('temporary-workspace-b')
const sourcePath = 'src/pages/HomePage.tsx'
const sourceRevision = sha('first source revision')

function candidate(key, { parentKey = null, anchor = null, tag = 'div', signature = sha(`signature:${key}`),
  label = key, start = 0, revision = sourceRevision, path = sourcePath } = {}) {
  return {
    key, parentKey, tag, anchor, signature, label,
    source: { path, start, end: start + 20, sourceRevision: revision, fingerprint: sha(`span:${key}:${start}`) },
    fields: {}, opaque: false, external: false,
  }
}

function create(nodes, options = {}) {
  const revision = options.sourceRevision ?? sourceRevision
  return createIdentityMap({ workspaceId, sourcePath, sourceRevision: revision, nodes, ...options })
}

function ref(map, nodeId, overrides = {}) {
  return { workspaceId: map.workspaceId, documentId: map.documentId, nodeId, ...overrides }
}

function fails(action, code) { assert.throws(action, error => error instanceof Error && error.code === code) }

test('canonical digest sorts nested object keys, rejects cycles, accessors, and non-JSON values', () => {
  assert.equal(identityDigest({ z: [{ b: 2, a: 1 }], a: true }), identityDigest({ a: true, z: [{ a: 1, b: 2 }] }))
  assert.notEqual(identityDigest(['a', 'b']), identityDigest(['b', 'a']))
  const cycle = {}; cycle.self = cycle
  fails(() => identityDigest(cycle), 'IDENTITY_DIGEST_CYCLE')
  fails(() => identityDigest({ missing: undefined }), 'IDENTITY_DIGEST_INVALID')
  let executed = false
  const accessor = { get privateValue() { executed = true; return 'secret' } }
  fails(() => identityDigest(accessor), 'IDENTITY_DIGEST_INVALID')
  assert.equal(executed, false)
})

test('document and page allocation is stable across labels, routes, node order, and revisions, and scoped by path/workspace', () => {
  const first = create([candidate('first'), candidate('second')])
  const later = create([
    candidate('second', { start: 120, revision: sha('new bytes') }),
    candidate('first', { start: 40, revision: sha('new bytes') }),
  ], { label: 'Different\nlabel', route: '/different', sourceRevision: sha('new bytes') })
  assert.equal(first.documentId, later.documentId)
  assert.equal(first.pageId, later.pageId)
  assert.deepEqual(new Set(first.nodes.map(node => node.id)), new Set(later.nodes.map(node => node.id)))
  assert.notEqual(first.documentId, create([candidate('first', { path: 'src/pages/AboutPage.tsx' })], { sourcePath: 'src/pages/AboutPage.tsx' }).documentId)
  assert.notEqual(first.documentId, create([candidate('first')], { workspaceId: secondWorkspaceId }).documentId)
})

test('explicit anchors and parent-qualified unique heuristics preserve compatible identity through sibling reorder', () => {
  const signature = sha('same text and structural props')
  const first = create([
    candidate('left', { anchor: 'Left', start: 0 }),
    candidate('right', { anchor: 'Right', start: 30 }),
    candidate('left-child', { parentKey: 'left', signature, label: 'Same', start: 60 }),
    candidate('right-child', { parentKey: 'right', signature, label: 'Same', start: 90 }),
  ])
  const next = create([
    candidate('right-child', { parentKey: 'right', signature, label: 'Renamed', start: 10 }),
    candidate('right', { anchor: 'Right', start: 40 }),
    candidate('left-child', { parentKey: 'left', signature, label: 'Renamed', start: 70 }),
    candidate('left', { anchor: 'Left', start: 100 }),
  ])
  const byLabel = map => new Map(map.nodes.map(node => [node.source.start, node]))
  assert.equal(byLabel(first).get(0).id, byLabel(next).get(100).id)
  assert.equal(byLabel(first).get(30).id, byLabel(next).get(40).id)
  assert.equal(byLabel(first).get(60).id, byLabel(next).get(70).id)
  assert.equal(byLabel(first).get(90).id, byLabel(next).get(10).id)
  assert.notEqual(byLabel(first).get(60).id, byLabel(first).get(90).id)
  assert.equal(byLabel(first).get(60).parentId, byLabel(first).get(0).id)
  assert.equal(resolveIdentity(next, ref(first, byLabel(first).get(60).id)).status, 'resolved')
})

test('indistinguishable unanchored siblings stay distinct unresolved candidates, including their heuristic descendants', () => {
  const duplicate = sha('same structural evidence')
  const map = create([
    candidate('first', { signature: duplicate, start: 0 }),
    candidate('second', { signature: duplicate, start: 30 }),
    candidate('child', { parentKey: 'first', start: 60 }),
  ])
  assert.equal(new Set(map.nodes.map(node => node.id)).size, 3)
  assert.ok(map.nodes.every(node => node.confidence === 'unresolved'))
  assert.equal(map.warnings.filter(warning => warning.code === 'AMBIGUOUS_FALLBACK').length, 2)
  assert.equal(map.warnings.filter(warning => warning.code === 'UNRESOLVED_PARENT').length, 1)
  for (const node of map.nodes) assert.deepEqual(resolveIdentity(map, ref(map, node.id)), { status: 'ambiguous' })
  const mixed = create([
    candidate('anchored', { anchor: 'Known', signature: duplicate }),
    candidate('unanchored', { signature: duplicate, start: 30 }),
  ])
  assert.equal(mixed.nodes[1].confidence, 'heuristic')
})

test('replacement evidence changes IDs while authored annotation syntax and uniqueness are enforced', () => {
  const old = create([candidate('element', { anchor: 'Header' })])
  const changedTag = create([candidate('element', { anchor: 'Header', tag: 'section' })])
  const changedAnchor = create([candidate('element', { anchor: 'HeaderNew' })])
  assert.notEqual(old.nodes[0].id, changedTag.nodes[0].id)
  assert.notEqual(old.nodes[0].id, changedAnchor.nodes[0].id)
  fails(() => create([candidate('bad', { anchor: 'bad space' })]), 'IDENTITY_ANCHOR_INVALID')
  fails(() => create([candidate('a', { anchor: 'Same' }), candidate('b', { anchor: 'Same' })]), 'IDENTITY_DUPLICATE_ANCHOR')
  fails(() => create([candidate('same'), candidate('same', { start: 40 })]), 'IDENTITY_DUPLICATE_KEY')
})

test('raw graph and source span validation reject bad references, cycles, and mismatched metadata', () => {
  fails(() => create([candidate('child', { parentKey: 'missing' })]), 'IDENTITY_PARENT_INVALID')
  fails(() => create([candidate('a', { parentKey: 'b' }), candidate('b', { parentKey: 'a' })]), 'IDENTITY_GRAPH_CYCLE')
  fails(() => create([candidate('a', { revision: sha('other bytes') })]), 'IDENTITY_SPAN_INVALID')
  fails(() => create([candidate('a', { path: 'src/pages/Other.tsx' })]), 'IDENTITY_SPAN_INVALID')
  const invalidField = candidate('a')
  invalidField.fields = { text: { start: 10, end: 40, fingerprint: sha('text') } }
  fails(() => create([invalidField]), 'IDENTITY_FIELDS_INVALID')
  fails(() => create([candidate('a')], { sourcePath: '../outside.tsx' }), 'IDENTITY_SOURCE_PATH_INVALID')
  fails(() => createIdentityMap(null), 'IDENTITY_INPUT_INVALID')
})

test('map validation rejects duplicate IDs and anchors, bad parents, and cycles without changing the caller map', () => {
  const original = create([candidate('a', { anchor: 'A' }), candidate('b', { anchor: 'B' })])
  const snapshot = structuredClone(original)
  const duplicate = structuredClone(original)
  duplicate.nodes[1].id = duplicate.nodes[0].id
  fails(() => validateIdentityMap(duplicate), 'IDENTITY_DUPLICATE_NODE')
  const anchors = structuredClone(original)
  anchors.nodes[1].anchor = 'A'
  fails(() => validateIdentityMap(anchors), 'IDENTITY_DUPLICATE_ANCHOR')
  const missing = structuredClone(original)
  missing.nodes[1].parentId = `node_${sha('missing')}`
  fails(() => validateIdentityMap(missing), 'IDENTITY_PARENT_INVALID')
  const cycle = structuredClone(original)
  cycle.nodes[0].parentId = cycle.nodes[1].id
  cycle.nodes[1].parentId = cycle.nodes[0].id
  fails(() => validateIdentityMap(cycle), 'IDENTITY_GRAPH_CYCLE')
  const badConfidence = structuredClone(original)
  badConfidence.nodes[0].confidence = 'heuristic'
  fails(() => validateIdentityMap(badConfidence), 'IDENTITY_CONFIDENCE_INVALID')
  assert.deepEqual(original, snapshot)
  assert.equal(validateIdentityMap(original), original)
})

test('reopened map validation cannot promote ambiguous fallback candidates into heuristic authority', () => {
  const repeated = sha('repeated siblings')
  const map = create([candidate('a', { signature: repeated }), candidate('b', { signature: repeated, start: 30 })])
  const promoted = structuredClone(map)
  promoted.nodes[0].id = `node_${sha('forged promotion')}`
  promoted.nodes[0].confidence = 'heuristic'
  fails(() => validateIdentityMap(promoted), 'IDENTITY_AMBIGUOUS_FALLBACK')
})

test('qualified resolution refuses workspace/document confusion, follows bounded aliases, and reports missing', () => {
  const map = create([candidate('a', { anchor: 'A' })])
  const direct = ref(map, map.nodes[0].id)
  assert.equal(resolveIdentity(map, direct).node.id, map.nodes[0].id)
  assert.deepEqual(resolveIdentity(map, ref(map, `node_${sha('missing')}`)), { status: 'missing' })
  assert.deepEqual(resolveIdentity(map, ref(map, 'older-opaque-id')), { status: 'missing' })
  assert.deepEqual(resolveIdentity(map, ref(map, map.nodes[0].id, { workspaceId: secondWorkspaceId })), { status: 'workspace-mismatch' })
  const otherDocument = create([candidate('a', { path: 'src/pages/Other.tsx' })], { sourcePath: 'src/pages/Other.tsx' })
  assert.deepEqual(resolveIdentity(map, ref(map, map.nodes[0].id, { documentId: otherDocument.documentId })), { status: 'document-mismatch' })
  assert.deepEqual(resolveIdentity(otherDocument, direct), { status: 'document-mismatch' })
  const retired1 = `node_${sha('retired-1')}`, retired2 = `node_${sha('retired-2')}`
  map.aliases = [
    { from: retired1, to: retired2, provenance: { reviewed: true } },
    { from: retired2, to: map.nodes[0].id, provenance: { reviewed: true } },
  ]
  assert.equal(resolveIdentity(map, ref(map, retired1)).node.id, map.nodes[0].id)
  fails(() => validateIdentityMap(map, { workspaceId: secondWorkspaceId }), 'IDENTITY_WORKSPACE_MISMATCH')
  fails(() => validateIdentityMap(map, { sourcePath: 'src/pages/Other.tsx' }), 'IDENTITY_DOCUMENT_MISMATCH')
})

test('alias cycles, dangling targets, current-ID sources, and alias count are rejected', () => {
  const map = create([candidate('a', { anchor: 'A' })])
  const left = `node_${sha('left')}`, right = `node_${sha('right')}`
  map.aliases = [{ from: left, to: right, provenance: 'reviewed' }, { from: right, to: left, provenance: 'reviewed' }]
  fails(() => validateIdentityMap(map), 'IDENTITY_ALIAS_CYCLE')
  map.aliases = [{ from: left, to: right, provenance: 'reviewed' }]
  fails(() => validateIdentityMap(map), 'IDENTITY_ALIAS_TARGET_INVALID')
  map.aliases = [{ from: map.nodes[0].id, to: right, provenance: 'reviewed' }]
  fails(() => validateIdentityMap(map), 'IDENTITY_ALIAS_INVALID')
  map.aliases = Array.from({ length: 257 }, (_, index) => ({ from: `node_${sha(`old-${index}`)}`, to: map.nodes[0].id, provenance: 'reviewed' }))
  fails(() => validateIdentityMap(map), 'IDENTITY_ALIAS_LIMIT')
})

test('node, diagnostic, and metadata bounds fail closed; export-shaped maps can omit labels', () => {
  const maximum = create(Array.from({ length: 1000 }, (_, index) => candidate(`n${index}`, { anchor: `N${index}`, start: index })))
  assert.equal(maximum.nodes.length, 1000)
  fails(() => create(Array.from({ length: 1001 }, (_, index) => candidate(`node-${index}`))), 'IDENTITY_NODE_LIMIT')
  const map = create([candidate('a', { anchor: 'A' })])
  const exportShape = structuredClone(map)
  delete exportShape.label
  delete exportShape.nodes[0].label
  assert.equal(validateIdentityMap(exportShape), exportShape)
  map.warnings = Array.from({ length: 1001 }, () => ({ code: 'REVIEW' }))
  fails(() => validateIdentityMap(map), 'IDENTITY_DIAGNOSTIC_LIMIT')
  map.warnings = []
  map.nodes[0].domHandle = 'transient'
  fails(() => validateIdentityMap(map), 'IDENTITY_NODE_INVALID')
})
