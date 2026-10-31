import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createSourceIdentityService } from '../Builder/source-identity-service.mjs'
import { hashSourceRevision as sha } from '../Builder/source-revision.mjs'
import { identityDigest } from '../Builder/identity-core.mjs'
import { createIdentityExportIntegrity } from '../Builder/source-identity-integrity.mjs'

const path = 'src/pages/HomePage.tsx'
const source = 'const label = "Alpha"; export default function HomePage(){return <main data-systemx-id="root"><h1 data-systemx-id="title">Alpha</h1><p data-systemx-id="description">Beta</p></main>}\n'
function fixture(t, content = source) {
  const root = mkdtempSync(join(tmpdir(), 'webappx-identity-authority-'))
  mkdirSync(join(root, 'src/pages'), { recursive: true })
  writeFileSync(join(root, path), content)
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return { root, service: createSourceIdentityService(root), file: join(root, path) }
}
function accept(service, options = { path }) {
  const preview = service.preview(options)
  return service.accept({ digest: preview.proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
}
function claim(node) {
  return { nodeId: node.id, mode: 'source-owned', adapterId: 'tsx-static-v1', fields: { text: { owner: 'source', supported: true } } }
}
// Trusted fixture-only signing reaches semantic guards independently of the
// public import integrity gate. The browser/API has no signing endpoint.
function signedFixture(root, document) {
  const payload = structuredClone(document)
  delete payload.integrity
  return createIdentityExportIntegrity(root, document.workspaceId).seal(payload)
}

test('fresh service reopens canonical identity exports and rejects an arbitrary non-JSX span', t => {
  const { root, service } = fixture(t)
  const { map } = accept(service)
  const exported = service.export({ documentId: map.documentId })
  const fresh = createSourceIdentityService(root)
  assert.equal(fresh.reopen({ document: exported, confirmation: 'REOPEN IDENTITY DOCUMENT' }).map.documentId, map.documentId)
  const forged = structuredClone(exported)
  const target = forged.map.nodes.find(node => node.anchor === 'title')
  const start = source.indexOf('Alpha')
  target.source = { path, start, end: start + 5, sourceRevision: sha(source), fingerprint: sha('Alpha') }
  target.fields.text = { start, end: start + 5, fingerprint: sha('Alpha') }
  assert.throws(() => fresh.reopen({ document: signedFixture(root, forged), confirmation: 'REOPEN IDENTITY DOCUMENT' }), { code: 'SOURCE_IDENTITY_SEMANTICS_INVALID' })
  assert.deepEqual(fresh.read({ documentId: map.documentId }).map.nodes, map.nodes.map(node => ({ ...node, label: '' })))
})

test('swapping two valid AST spans cannot retarget existing qualified identifiers', t => {
  const { root, service } = fixture(t)
  const { map } = accept(service)
  const exported = service.export({ documentId: map.documentId })
  const a = exported.map.nodes.find(node => node.anchor === 'title')
  const b = exported.map.nodes.find(node => node.anchor === 'description')
  const idA = a.id, idB = b.id
  const copyA = structuredClone(a), copyB = structuredClone(b)
  Object.assign(a, copyB, { id: idA })
  Object.assign(b, copyA, { id: idB })
  assert.throws(() => service.reopen({ document: signedFixture(root, exported), confirmation: 'REOPEN IDENTITY DOCUMENT' }), { code: 'SOURCE_IDENTITY_ALLOCATION_INVALID' })
  assert.equal(service.lookup({ workspaceId: map.workspaceId, documentId: map.documentId, nodeId: idA }).node.anchor, 'title')
})

test('reviewed rename allocation survives later additions and a fresh-service export/reopen', t => {
  const { root, service, file } = fixture(t)
  const first = accept(service).map
  const renamedPath = 'src/pages/RenamedPage.tsx'
  const renamed = join(root, renamedPath)
  renameSync(file, renamed)
  const moved = accept(service, { path: renamedPath, renameFrom: path }).map
  assert.equal(moved.documentId, first.documentId)
  writeFileSync(renamed, source.replace('</main>', '<aside data-systemx-id="new">New object</aside><strong>Unique new object</strong></main>'))
  const next = accept(service, { path: renamedPath }).map
  assert.equal(next.documentId, first.documentId)
  const exported = service.export({ documentId: next.documentId })
  assert.equal(exported.allocation.sourcePath, path)
  const reopened = createSourceIdentityService(root).reopen({ document: exported, confirmation: 'REOPEN IDENTITY DOCUMENT' }).map
  assert.deepEqual(reopened.nodes.map(node => node.id), next.nodes.map(node => node.id))
})

test('retiring a claimed node is an explicit reviewed retirement and does not dead-end reconciliation', t => {
  const content = 'export default function HomePage(){return <main><h1>Original unique title</h1></main>}\n'
  const { service, file } = fixture(t, content)
  const original = accept(service).map
  const node = original.nodes.find(item => item.fields.text)
  const proposal = service.ownershipPreview({ documentId: original.documentId, changes: [claim(node)] })
  service.ownershipAccept({ digest: proposal.proposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' })
  const changed = content.replace('Original unique title', 'Replacement unique title')
  writeFileSync(file, changed)
  const preview = service.preview({ path })
  assert.equal(preview.ownershipRetirements.length, 1)
  assert.equal(preview.ownershipRetirements[0].nodeId, node.id)
  assert.match(preview.ownershipRetirements[0].claimDigest, /^[a-f0-9]{64}$/)
  const accepted = service.accept({ digest: preview.proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  assert.equal(accepted.retiredOwnershipClaims.length, 1)
  assert.equal(accepted.ownership.claims.length, 0)
  assert.equal(service.lookup({ workspaceId: original.workspaceId, documentId: original.documentId, nodeId: node.id }).status, 'missing')
  assert.equal(readFileSync(file, 'utf8'), changed)
  const exported = service.export({ documentId: accepted.map.documentId })
  assert.deepEqual(service.reopen({ document: exported, confirmation: 'REOPEN IDENTITY DOCUMENT' }).retiredOwnershipClaims, accepted.retiredOwnershipClaims)
})

test('identity and ownership proposals are invalidated by a later accepted authority change', t => {
  const { service } = fixture(t)
  const map = accept(service).map
  const identity = service.preview({ path })
  const ownership = service.ownershipPreview({ documentId: map.documentId, changes: [claim(map.nodes.find(node => node.fields.text))] })
  service.ownershipAccept({ digest: ownership.proposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' })
  assert.throws(() => service.accept({ digest: identity.proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' }), { code: 'SOURCE_IDENTITY_PROPOSAL_MISSING' })
})

test('all duplicate groups pass through the actual service as safe bounded digests', t => {
  const { service, file } = fixture(t)
  const map = accept(service).map
  writeFileSync(file, 'export default () => <main><h1 data-systemx-id="first">A</h1><h1 data-systemx-id="first">B</h1><p data-systemx-id="second">C</p><p data-systemx-id="second">D</p><p data-systemx-id="second">E</p></main>')
  let failure
  try { service.preview({ path }) } catch (error) { failure = error }
  assert.ok(failure)
  assert.deepEqual(failure.diagnostics.map(item => item.count).sort(), [2, 3])
  assert.ok(failure.diagnostics.every(item => /^[a-f0-9]{64}$/.test(item.identityDigest)))
  assert.doesNotMatch(JSON.stringify(failure.diagnostics), /first|second|<main/)
  assert.equal(service.read({ documentId: map.documentId }).map.documentId, map.documentId)
})

test('untrusted replacement proofs and aliases cannot retarget an accepted qualified identifier', t => {
  const { root, service } = fixture(t)
  const { map } = accept(service)
  const exported = service.export({ documentId: map.documentId })
  const a = exported.map.nodes.find(node => node.anchor === 'title')
  const b = exported.map.nodes.find(node => node.anchor === 'description')
  const previousId = a.id
  const tuple = { kind: 'reviewed-replacement', documentId: map.documentId, incomingId: a.id,
    tag: a.tag, anchor: a.anchor, signature: a.signature, sourceRevision: map.sourceRevision, salt: 7 }
  a.id = `node_${identityDigest(tuple)}`
  exported.allocation.replacements = [{ nodeId: a.id, incomingId: tuple.incomingId, tag: a.tag,
    anchor: a.anchor, signature: a.signature, parentId: a.parentId, sourceRevision: map.sourceRevision, salt: 7 }]
  exported.map.aliases.push({ from: previousId, to: b.id, provenance: { reason: 'reviewed' } })
  assert.throws(() => service.reopen({ document: exported, confirmation: 'REOPEN IDENTITY DOCUMENT' }), { code: 'SOURCE_IDENTITY_EXPORT_INTEGRITY_INVALID' })
  assert.throws(() => service.reopen({ document: signedFixture(root, exported), confirmation: 'REOPEN IDENTITY DOCUMENT' }), { code: 'SOURCE_IDENTITY_RECONCILIATION_REQUIRED' })
  assert.equal(service.lookup({ workspaceId: map.workspaceId, documentId: map.documentId, nodeId: previousId }).node.anchor, 'title')
})

test('export integrity persists across service instances and authentic exports cannot have their route edited', t => {
  const { root, service } = fixture(t)
  const { map } = accept(service)
  const exported = service.export({ documentId: map.documentId })
  assert.equal(exported.integrity.algorithm, 'hmac-sha256')
  assert.match(exported.integrity.value, /^[a-f0-9]{64}$/)
  const edited = structuredClone(exported)
  edited.map.route = '/about'
  assert.throws(() => createSourceIdentityService(root).reopen({ document: edited, confirmation: 'REOPEN IDENTITY DOCUMENT' }), { code: 'SOURCE_IDENTITY_EXPORT_INTEGRITY_INVALID' })
  assert.equal(createSourceIdentityService(root).reopen({ document: exported, confirmation: 'REOPEN IDENTITY DOCUMENT' }).map.route, '/')
})

test('service-added allocation provenance is screened before any signed export', t => {
  const { root, service, file } = fixture(t)
  const credentialShaped = 'src/pages/sk-proj-fixture.tsx'
  renameSync(file, join(root, credentialShaped))
  const first = accept(service, { path: credentialShaped }).map
  renameSync(join(root, credentialShaped), file)
  accept(service, { path, renameFrom: credentialShaped })
  assert.throws(() => service.export({ documentId: first.documentId }), { code: 'SOURCE_IDENTITY_EXPORT_UNSAFE_METADATA' })
})

test('generated sources import as read-only metadata with no mapped operation or authority migration', t => {
  const { service, file } = fixture(t, `// @generated\n${source}`)
  const preview = service.preview({ path })
  assert.equal(preview.ownership.sourcePolicy.writable, false)
  assert.equal(preview.ownership.coverage.mapped, 0)
  assert.equal(preview.ownership.coverage.partial, preview.proposal.map.nodes.length)
  const accepted = service.accept({ digest: preview.proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  const map = accepted.map
  const node = map.nodes.find(item => item.fields.text)
  const reference = { workspaceId: map.workspaceId, documentId: map.documentId, nodeId: node.id }
  const inspected = service.inspect(reference)
  assert.deepEqual(inspected.object.supportedOperations, [])
  assert.equal(inspected.object.fields.text.supported, false)
  assert.ok(inspected.object.reasons.includes('SOURCE_GENERATED_READ_ONLY'))
  assert.throws(() => service.operation({ documentId: map.documentId, reference, expectedRevision: map.sourceRevision, text: 'Refused' }), { code: 'SOURCE_GENERATED_READ_ONLY', statusCode: 403 })
  assert.throws(() => service.ownershipPreview({ documentId: map.documentId, changes: [claim(node)] }), { code: 'SOURCE_GENERATED_READ_ONLY', statusCode: 403 })
  const exported = service.export({ documentId: map.documentId })
  assert.equal(exported.ownership.coverage.mapped, 0)
  assert.ok(exported.ownership.objects.every(item => item.supportedOperations.length === 0))
  assert.equal(readFileSync(file, 'utf8'), `// @generated\n${source}`)
})
