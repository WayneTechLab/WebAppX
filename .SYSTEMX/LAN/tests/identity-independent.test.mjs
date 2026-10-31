import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import { createIdentityMap, identityDigest, resolveIdentity, validateIdentityMap } from '../Builder/identity-core.mjs'
import { acceptReconciliation, exportIdentityMap, previewReconciliation } from '../Builder/identity-reconciliation.mjs'
import { parseSourceIdentity } from '../Builder/source-identity-adapter.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const workspaceId = 'a'.repeat(64)
const otherWorkspaceId = 'b'.repeat(64)
const sourcePath = 'src/pages/HomePage.tsx'

function occurrence(content, fragment, ordinal = 0) {
  let start = -1
  for (let index = 0; index <= ordinal; index += 1) start = content.indexOf(fragment, start + 1)
  assert.notEqual(start, -1, `Fixture fragment missing: ${fragment}`)
  return start
}

function candidates(content, entries, path = sourcePath) {
  const sourceRevision = hash(content)
  return entries.map(({ key, element, ordinal = 0, parentKey = null, tag = 'p', anchor = null,
    signature = `${tag}|${anchor ?? element}`, label = key, text = null, opaque = false,
    external = false, definition }) => {
    const start = occurrence(content, element, ordinal)
    const end = start + element.length
    const fields = {}
    if (text !== null) {
      const textStart = content.indexOf(text, start)
      assert.ok(textStart >= start && textStart + text.length <= end)
      fields.text = { start: textStart, end: textStart + text.length, fingerprint: hash(text) }
    }
    return {
      key, parentKey, tag, anchor, signature: hash(signature), label,
      source: { path, start, end, sourceRevision, fingerprint: hash(content.slice(start, end)) },
      fields, opaque, external, ...(definition ? { definition } : {}),
    }
  })
}

function makeMap(content, entries, { path = sourcePath, workspace = workspaceId, label = 'Page', ruleVersion = 'identity-v1' } = {}) {
  return createIdentityMap({
    workspaceId: workspace, sourcePath: path, sourceRevision: hash(content),
    route: '/', label, nodes: candidates(content, entries, path), ruleVersion,
  })
}

function anchored(anchor = 'title', text = 'Hello', tag = 'h1') {
  const element = `<${tag} data-systemx-id="${anchor}">${text}</${tag}>`
  return { content: `<main>${element}</main>`, entries: [{ key: anchor, element, tag, anchor, text, signature: `${tag}|${anchor}` }] }
}

function assertCodedRefusal(action) {
  assert.throws(action, error => error instanceof Error && typeof error.code === 'string' && error.code.length > 0)
}

const nodeWithAnchor = (map, anchor) => map.nodes.find(node => node.anchor === anchor)
const ref = (map, nodeId = map.nodes[0].id) => ({ workspaceId: map.workspaceId, documentId: map.documentId, nodeId })

test('canonical identity digest sorts nested object keys but retains meaningful array order', () => {
  const first = { z: [{ b: 2, a: 1 }, 'end'], a: { d: 4, c: 3 } }
  const reordered = { a: { c: 3, d: 4 }, z: [{ a: 1, b: 2 }, 'end'] }
  assert.equal(identityDigest(first), identityDigest(reordered))
  assert.match(identityDigest(first), /^[a-f0-9]{64}$/)
  assert.notEqual(identityDigest(first), identityDigest({ a: first.a, z: ['end', first.z[0]] }))
})

test('declared source and workspace determine document/page identity; anchors survive labels and source reorder', () => {
  const one = '<h2 data-systemx-id="one">Same</h2>'
  const two = '<h2 data-systemx-id="two">Same</h2>'
  const entries = [
    { key: 'one', element: one, tag: 'h2', anchor: 'one', text: 'Same', signature: 'h2|one' },
    { key: 'two', element: two, tag: 'h2', anchor: 'two', text: 'Same', signature: 'h2|two' },
  ]
  const before = makeMap(`<main>${one}${two}</main>`, entries)
  const after = makeMap(`<main>${two}${one}</main>`, [...entries].reverse(), { label: 'Renamed page' })
  assert.equal(before.documentId, after.documentId)
  assert.equal(before.pageId, after.pageId)
  for (const anchor of ['one', 'two']) {
    assert.equal(nodeWithAnchor(before, anchor).id, nodeWithAnchor(after, anchor).id)
    assert.equal(nodeWithAnchor(after, anchor).confidence, 'explicit')
  }
  assert.notEqual(before.documentId, makeMap(`<main>${one}${two}</main>`, entries, { workspace: otherWorkspaceId }).documentId)
  assert.notEqual(before.documentId, makeMap(`<main>${one}${two}</main>`, entries, { path: 'src/pages/OtherPage.tsx' }).documentId)
})

test('core refuses invalid authored anchors, duplicate anchors, cycles, bad parents and oversized labels', () => {
  const first = '<p data-systemx-id="same">One</p>'
  const second = '<p data-systemx-id="same">Two</p>'
  const content = `<main>${first}${second}</main>`
  const entries = [
    { key: 'one', element: first, anchor: 'same', text: 'One' },
    { key: 'two', element: second, anchor: 'same', text: 'Two' },
  ]
  assertCodedRefusal(() => makeMap(content, entries))
  assertCodedRefusal(() => makeMap(content, [{ ...entries[0], anchor: '1bad' }]))
  assertCodedRefusal(() => makeMap(content, [{ ...entries[0], anchor: '__proto__' }]))
  assertCodedRefusal(() => makeMap(content, [{ ...entries[0], label: 'x'.repeat(121) }]))
  assertCodedRefusal(() => makeMap(content, [{ ...entries[0], parentKey: 'missing' }]))
  assertCodedRefusal(() => makeMap(content, [{ ...entries[0], parentKey: 'two' }, { ...entries[1], anchor: 'other', parentKey: 'one' }]))
  const valid = anchored()
  assertCodedRefusal(() => makeMap(valid.content, valid.entries, { workspace: '/private/workspace' }))
})

test('core and map validator enforce node, alias and source provenance bounds', () => {
  const entries = Array.from({ length: 1_001 }, (_, index) => {
    const anchor = `n${index}`
    return { key: anchor, element: `<p data-systemx-id="${anchor}">x</p>`, anchor, text: 'x' }
  })
  assertCodedRefusal(() => makeMap(`<main>${entries.map(entry => entry.element).join('')}</main>`, entries))
  const { content, entries: one } = anchored()
  const map = makeMap(content, one)
  const overAliases = structuredClone(map)
  overAliases.aliases = Array.from({ length: 257 }, (_, index) => ({
    from: `node_${hash(`retired-${index}`)}`, to: map.nodes[0].id, provenance: 'reviewed migration',
  }))
  assertCodedRefusal(() => validateIdentityMap(overAliases))
  const staleSpan = structuredClone(map)
  staleSpan.nodes[0].source.sourceRevision = hash('different file')
  assertCodedRefusal(() => validateIdentityMap(staleSpan))
  const badPath = structuredClone(map)
  badPath.nodes[0].source.path = '../private.tsx'
  assertCodedRefusal(() => validateIdentityMap(badPath))
})

test('indistinguishable unanchored siblings stay separate and unresolved', () => {
  const element = '<p>Same</p>'
  const content = `<main>${element}${element}</main>`
  const map = makeMap(content, [
    { key: 'first', element, ordinal: 0, text: 'Same', signature: 'p|same', label: 'Same' },
    { key: 'second', element, ordinal: 1, text: 'Same', signature: 'p|same', label: 'Same' },
  ])
  assert.equal(map.nodes.length, 2)
  assert.equal(new Set(map.nodes.map(node => node.id)).size, 2)
  assert.ok(map.nodes.every(node => node.confidence === 'unresolved'))
  assert.ok(map.warnings.length > 0)
})

test('validation and lookup enforce exact workspace, document, graph and alias boundaries', () => {
  const { content, entries } = anchored()
  const map = makeMap(content, entries)
  assert.equal(validateIdentityMap(map, { workspaceId, sourcePath }).documentId, map.documentId)
  assert.equal(resolveIdentity(map, ref(map)).status, 'resolved')
  assert.equal(resolveIdentity(map, { ...ref(map), workspaceId: otherWorkspaceId }).status, 'workspace-mismatch')
  assert.equal(resolveIdentity(map, { ...ref(map), documentId: 'doc_' + 'f'.repeat(64) }).status, 'document-mismatch')
  assert.equal(resolveIdentity(map, { ...ref(map), nodeId: 'node_' + 'f'.repeat(64) }).status, 'missing')
  assertCodedRefusal(() => resolveIdentity(map, { documentId: map.documentId, nodeId: map.nodes[0].id }))
  assertCodedRefusal(() => validateIdentityMap(map, { workspaceId: otherWorkspaceId }))
  for (const change of [
    copy => { copy.schemaVersion = 2 },
    copy => { copy.nodes.push(structuredClone(copy.nodes[0])) },
    copy => { copy.nodes[0].parentId = 'node_missing' },
    copy => { copy.aliases = [{ from: copy.nodes[0].id, to: copy.nodes[0].id, provenance: 'cycle' }] },
  ]) {
    const copy = structuredClone(map)
    change(copy)
    assertCodedRefusal(() => validateIdentityMap(copy))
  }
  assert.equal({}.polluted, undefined)
  const poisoned = JSON.parse(JSON.stringify(map).replace('{', '{"__proto__":{"polluted":true},'))
  assertCodedRefusal(() => validateIdentityMap(poisoned))
  assert.equal({}.polluted, undefined)
})

test('reconciliation preserves unique fallback evidence across sibling reorder without using visible label alone', () => {
  const one = '<p data-role="one">Same</p>'
  const two = '<p data-role="two">Same</p>'
  const entries = [
    { key: 'one', element: one, text: 'Same', signature: 'p|role=one', label: 'Same' },
    { key: 'two', element: two, text: 'Same', signature: 'p|role=two', label: 'Same' },
  ]
  const previous = makeMap(`<main>${one}${two}</main>`, entries)
  const incoming = makeMap(`<main>${two}${one}</main>`, [...entries].reverse())
  const snapshot = structuredClone(previous)
  const proposal = previewReconciliation(previous, incoming)
  assert.equal(proposal.requiresReview, true)
  assert.equal(proposal.counts.preserved, 2)
  assert.equal(proposal.counts.ambiguous, 0)
  assert.deepEqual(proposal.map.nodes.map(node => node.id).sort(), previous.nodes.map(node => node.id).sort())
  assert.deepEqual(previous, snapshot)
})

test('replacement retires old references and an explicit reviewed alias resolves only within the document', () => {
  const old = anchored('old', 'Text')
  const replacement = anchored('new', 'Text', 'h2')
  const previous = makeMap(old.content, old.entries)
  const incoming = makeMap(replacement.content, replacement.entries)
  const oldId = previous.nodes[0].id
  const newId = incoming.nodes[0].id
  assert.notEqual(oldId, newId)
  const proposal = previewReconciliation(previous, incoming)
  assert.equal(proposal.counts.retired, 1)
  assert.equal(proposal.counts.added, 1)
  assert.equal(resolveIdentity(proposal.map, ref(proposal.map, oldId)).status, 'missing')
  assert.ok(proposal.orphans.length > 0)
  const aliased = previewReconciliation(previous, incoming, { aliases: [{ from: oldId, to: newId, provenance: 'reviewed replacement' }] })
  assert.equal(resolveIdentity(aliased.map, ref(aliased.map, oldId)).node.id, newId)
  assert.equal(aliased.map.aliases[0].provenance, 'reviewed replacement')
  assertCodedRefusal(() => previewReconciliation(previous, incoming, { aliases: [{ from: oldId, to: oldId, provenance: 'loop' }] }))
  const foreignFixture = anchored('foreign', 'Text')
  const foreign = makeMap(foreignFixture.content, foreignFixture.entries, { path: 'src/pages/OtherPage.tsx' })
  assert.notEqual(foreign.nodes[0].id, newId)
  assertCodedRefusal(() => previewReconciliation(previous, incoming, { aliases: [{ from: oldId, to: foreign.nodes[0].id, provenance: 'cross document' }] }))
})

test('source-file rename requires exact explicit evidence before transferring document/page IDs', () => {
  const { content, entries } = anchored()
  const previous = makeMap(content, entries, { path: 'src/pages/OldPage.tsx' })
  const incoming = makeMap(content, entries, { path: 'src/pages/NewPage.tsx' })
  assert.notEqual(previous.documentId, incoming.documentId)
  assertCodedRefusal(() => previewReconciliation(previous, incoming))
  const renamed = previewReconciliation(previous, incoming, { renameFrom: previous.sourcePath })
  assert.equal(renamed.map.documentId, previous.documentId)
  assert.equal(renamed.map.pageId, previous.pageId)
  assert.equal(renamed.rename.from, previous.sourcePath)
  assert.equal(renamed.rename.to, incoming.sourcePath)
  assertCodedRefusal(() => previewReconciliation(previous, incoming, { renameFrom: 'src/pages/Unrelated.tsx' }))
})

test('acceptance binds exact proposal digest and confirmation; export retains identity without labels', () => {
  const fixture = anchored('title', 'PRIVATE_LABEL_MARKER')
  const previous = makeMap(fixture.content, fixture.entries, { label: 'PRIVATE_LABEL_MARKER' })
  const proposal = previewReconciliation(null, previous)
  const { digest, ...body } = proposal
  assert.equal(digest, identityDigest(body))
  assertCodedRefusal(() => acceptReconciliation(proposal, { digest: 'f'.repeat(64), confirmation: 'ACCEPT IDENTITY MAP' }))
  assertCodedRefusal(() => acceptReconciliation(proposal, { digest, confirmation: 'yes' }))
  const accepted = acceptReconciliation(proposal, { digest, confirmation: 'ACCEPT IDENTITY MAP' })
  assert.deepEqual(accepted, proposal.map)
  assert.notStrictEqual(accepted, proposal.map)
  accepted.nodes[0].tag = 'changed'
  assert.notEqual(accepted.nodes[0].tag, proposal.map.nodes[0].tag)
  const exported = exportIdentityMap(previous)
  assert.equal(exported.documentId, previous.documentId)
  assert.deepEqual(exported.nodes.map(node => node.id), previous.nodes.map(node => node.id))
  assert.doesNotMatch(JSON.stringify(exported), /PRIVATE_LABEL_MARKER|sessionToken|domHandle/)
  assert.equal(validateIdentityMap(exported, { workspaceId, sourcePath }).documentId, previous.documentId)
  const tampered = structuredClone(proposal)
  tampered.map.nodes[0].id = 'node_' + '0'.repeat(64)
  assertCodedRefusal(() => acceptReconciliation(tampered, { digest, confirmation: 'ACCEPT IDENTITY MAP' }))
})

test('unknown mapping rules cannot silently reinterpret an accepted identity map', () => {
  const { content, entries } = anchored()
  const previous = makeMap(content, entries)
  assertCodedRefusal(() => previewReconciliation(previous, previous, { ruleVersion: 'unreviewed-rule' }))
})

test('TSX adapter records exact UTF16 literal span and marks expressions and external internals read-only', () => {
  const content = 'export default function Page() { return <main><h1 data-systemx-id="title">Café 😀</h1><p>{user.name}</p><ExternalCard title="Hi" /></main> }'
  const result = parseSourceIdentity({ path: sourcePath, content, sourceRevision: hash(content), workspaceId, route: '/' })
  assert.equal(result.adapter.id, 'tsx-static-v1')
  assert.deepEqual(result.adapter.supportedOperations, ['literal'])
  assert.ok(result.adapter.unsupportedOperations.includes('structure'))
  assert.equal(result.shared, false)
  const title = nodeWithAnchor(result.map, 'title')
  assert.ok(title)
  const field = title.fields.text
  assert.equal(content.slice(field.start, field.end), 'Café 😀')
  assert.equal(field.fingerprint, hash('Café 😀'))
  assert.equal(title.source.sourceRevision, hash(content))
  assert.equal(title.confidence, 'explicit')
  const expression = result.map.nodes.find(node => node.tag === 'p')
  assert.ok(expression?.opaque)
  assert.equal(expression.fields.text, undefined)
  const external = result.map.nodes.find(node => node.tag === 'ExternalCard')
  assert.ok(external?.external)
  assert.equal(external.fields.text, undefined)
  const shared = parseSourceIdentity({ path: 'src/components/layout/Header.tsx', content, sourceRevision: hash(content), workspaceId })
  assert.equal(shared.shared, true)
})

test('TSX adapter refuses invalid source, duplicate authored IDs, bad anchors and size violations', () => {
  const invalid = [
    ['src/pages/HomePage.tsx', 'export default () => <main><p></main>'],
    ['src/pages/HomePage.tsx', 'export default () => <main><p data-systemx-id="same"/><p data-systemx-id="same"/></main>'],
    ['src/pages/HomePage.tsx', 'export default () => <p data-systemx-id="1bad"/>'],
    ['src/pages/HomePage.tsx', 'x'.repeat(1_000_001)],
    ['../private.tsx', 'export default () => <p>Text</p>'],
  ]
  for (const [path, content] of invalid) {
    assertCodedRefusal(() => parseSourceIdentity({ path, content, sourceRevision: hash(content), workspaceId }))
  }
})
