import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { createSourceIdentityService } from '../Builder/source-identity-service.mjs'

const PATH = 'src/pages/HomePage.tsx'
const RENAMED = 'src/pages/RenamedPage.tsx'
const CONTENT = 'export default function HomePage() { return <main data-systemx-id="home"><h1 data-systemx-id="heading">Hello identity</h1><p>Unchanged</p></main> }\n'

function fixture(t, content = CONTENT) {
  const root = mkdtempSync(join(tmpdir(), 'systemx-identity-service-'))
  const file = join(root, PATH)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, content)
  t.after(() => rmSync(root, { recursive: true, force: true }))
  return { root, file, service: createSourceIdentityService(root) }
}

function accepted(service, path = PATH) {
  const preview = service.preview({ path, route: '/home', label: 'Home' })
  assert.equal(preview.workspaceId, service.status().workspaceId)
  assert.equal(preview.proposal.requiresReview, true)
  assert.match(preview.proposal.digest, /^[a-f0-9]{64}$/)
  const result = service.accept({ digest: preview.proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  assert.equal(result.accepted, true)
  return result
}

test('preview and acceptance keep source bytes unchanged and require exact confirmation', t => {
  const { file, service } = fixture(t)
  const before = readFileSync(file)
  const preview = service.preview({ path: PATH })
  assert.equal(service.status().documents.length, 0)
  assert.throws(() => service.accept({ digest: preview.proposal.digest, confirmation: 'yes' }), { code: /./ })
  assert.equal(service.status().documents.length, 0)
  const result = service.accept({ digest: preview.proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  assert.equal(result.map.sourcePath, PATH)
  assert.equal(service.status().documents.length, 1)
  assert.deepEqual(readFileSync(file), before)
  assert.equal(service.read({ documentId: result.map.documentId }).stale, false)
})

test('qualified lookup, inspection and literal proposal are source confined', t => {
  const { file, service } = fixture(t)
  const before = readFileSync(file)
  const { map } = accepted(service)
  const heading = map.nodes.find(node => node.anchor === 'heading')
  assert.ok(heading)
  const reference = { workspaceId: map.workspaceId, documentId: map.documentId, nodeId: heading.id }
  assert.equal(service.lookup(reference).status, 'resolved')
  assert.equal(service.lookup({ ...reference, workspaceId: '0'.repeat(64) }).status, 'workspace-mismatch')
  assert.equal(service.lookup({ ...reference, documentId: `doc_${'0'.repeat(64)}` }).status, 'missing')
  const inspection = service.inspect(reference)
  assert.ok(inspection)
  const proposal = service.operation({ documentId: map.documentId, reference, expectedRevision: map.sourceRevision, text: 'New identity' })
  assert.equal(proposal.allowed, true)
  assert.equal(proposal.patch.replacement, 'New identity')
  assert.deepEqual(readFileSync(file), before)
})

test('changed raw source blocks acceptance and leaves the accepted map intact', t => {
  const { file, service } = fixture(t)
  const first = accepted(service)
  const prior = service.read({ documentId: first.map.documentId }).map
  const next = `${CONTENT}\n`
  writeFileSync(file, next)
  const pending = service.preview({ path: PATH })
  writeFileSync(file, `${next}\n`)
  assert.throws(() => service.accept({ digest: pending.proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' }), { code: 'SOURCE_IDENTITY_STALE' })
  const retained = service.read({ documentId: first.map.documentId })
  assert.deepEqual(retained.map, prior)
  assert.equal(retained.stale, true)
  assert.equal(service.status().documents.length, 1)
})

test('export and reopen retain qualified IDs and strip readable labels', t => {
  const { root, file, service } = fixture(t)
  const { map } = accepted(service)
  const exported = service.export({ documentId: map.documentId })
  assert.equal(exported.kind, 'systemx-source-document')
  assert.ok(!JSON.stringify(exported).includes('Hello identity'))
  const reopened = createSourceIdentityService(root)
  assert.throws(() => reopened.reopen({ document: exported, confirmation: 'yes' }), { code: 'SOURCE_IDENTITY_CONFIRMATION_REQUIRED' })
  const result = reopened.reopen({ document: exported, confirmation: 'REOPEN IDENTITY DOCUMENT' })
  assert.equal(result.map.documentId, map.documentId)
  assert.equal(result.map.pageId, map.pageId)
  assert.deepEqual(result.map.nodes.map(node => node.id), map.nodes.map(node => node.id))
  assert.deepEqual(readFileSync(file), Buffer.from(CONTENT))
})

test('explicit rename transfers the reviewed document only after acceptance', t => {
  const { root, file, service } = fixture(t)
  const { map } = accepted(service)
  renameSync(file, join(root, RENAMED))
  const preview = service.preview({ path: RENAMED, renameFrom: PATH })
  assert.equal(preview.proposal.map.documentId, map.documentId)
  assert.equal(service.status().documents[0].sourcePath, PATH)
  service.accept({ digest: preview.proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  assert.equal(service.status().documents[0].sourcePath, RENAMED)
})

test('separate workspaces and ineligible paths cannot share authority', t => {
  const first = fixture(t)
  const second = fixture(t)
  const a = accepted(first.service).map
  const b = accepted(second.service).map
  assert.notEqual(a.workspaceId, b.workspaceId)
  assert.notEqual(a.documentId, b.documentId)
  assert.equal(second.service.lookup({ workspaceId: a.workspaceId, documentId: a.documentId, nodeId: a.nodes[0].id }).status, 'workspace-mismatch')
  assert.throws(() => first.service.preview({ path: '/private/source.tsx' }), { code: 'SOURCE_PATH_INVALID' })
  assert.equal(first.service.status().documents.length, 1)
})

test('ownership change remains a separate reviewed proposal', t => {
  const { service } = fixture(t)
  const { map } = accepted(service)
  const preview = service.ownershipPreview({ documentId: map.documentId, changes: [{ nodeId: map.nodes.find(node => node.fields.text).id, mode: 'source-owned', adapterId: 'tsx-static-v1', fields: { text: { owner: 'source', supported: true } } }] })
  assert.equal(preview.proposal.requiresReview, true)
  assert.throws(() => service.ownershipAccept({ digest: preview.proposal.digest, confirmation: 'yes' }), { code: /./ })
  assert.equal(service.status().documents.length, 1)
  const result = service.ownershipAccept({ digest: preview.proposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' })
  assert.equal(result.accepted, true)
})

test('failed reopen and stale ownership acceptance preserve prior authority', t => {
  const { file, service } = fixture(t)
  const { map } = accepted(service)
  const before = service.read({ documentId: map.documentId }).map
  const exported = service.export({ documentId: map.documentId })
  const wrongWorkspace = structuredClone(exported)
  wrongWorkspace.workspaceId = '0'.repeat(64)
  assert.throws(() => service.reopen({ document: wrongWorkspace, confirmation: 'REOPEN IDENTITY DOCUMENT' }), { code: 'SOURCE_IDENTITY_EXPORT_INVALID' })
  const pending = service.ownershipPreview({ documentId: map.documentId, changes: [{ nodeId: map.nodes.find(node => node.fields.text).id, mode: 'source-owned', adapterId: 'tsx-static-v1', fields: { text: { owner: 'source', supported: true } } }] })
  writeFileSync(file, `${CONTENT}\n`)
  assert.throws(() => service.ownershipAccept({ digest: pending.proposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' }), { code: 'SOURCE_IDENTITY_STALE' })
  assert.deepEqual(service.read({ documentId: map.documentId }).map, before)
  assert.equal(service.read({ documentId: map.documentId }).stale, true)
})
