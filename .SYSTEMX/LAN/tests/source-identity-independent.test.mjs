import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { parseSourceIdentity } from '../Builder/source-identity-adapter.mjs'
import { createSourceIdentityService } from '../Builder/source-identity-service.mjs'

const sha = (value) => createHash('sha256').update(value).digest('hex')
const homePath = 'src/pages/HomePage.tsx'
const otherPath = 'src/pages/OtherPage.tsx'
const page = [
  '// PRIVATE_SOURCE_COMMENT_682b SESSION_SECRET_31a9 must never enter an identity API result.',
  'export default function HomePage() {',
  '  return <main data-systemx-id="home">',
  '    <h1 data-systemx-id="headline">Fixture headline</h1>',
  '    <p data-systemx-id="intro">Fixture introduction</p>',
  '    <Widget label="External" />',
  '    <aside>{dynamicText}</aside>',
  '  </main>',
  '}',
  '',
].join('\n')
const other = 'export default function OtherPage() { return <main data-systemx-id="other"><h1>Other page</h1></main> }\n'
const shared = 'export function Header() { return <header data-systemx-id="site-header">Shared shell</header> }\n'

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'webappx-identity-independent-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const put = (path, content) => {
    const target = join(root, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, content)
  }
  put(homePath, page)
  put(otherPath, other)
  put('src/components/layout/Header.tsx', shared)
  const read = (path) => readFileSync(join(root, path), 'utf8')
  return { root, put, read }
}

function effects(root) {
  const result = {}
  for (const directory of ['src', '.SYSTEMX/LAN/Backup', '.SYSTEMX/LAN/Temp']) {
    const visit = (path, relative) => {
      if (!existsSync(path)) return
      for (const entry of readdirSync(path, { withFileTypes: true })) {
        const child = join(path, entry.name)
        const name = relative + '/' + entry.name
        if (entry.isDirectory()) visit(child, name)
        else result[name] = entry.isSymbolicLink() ? 'linked' : sha(readFileSync(child))
      }
    }
    visit(join(root, directory), directory)
  }
  return result
}

function assertCoded(error, root) {
  assert.equal(typeof error?.code, 'string', String(error))
  assert.ok(error.code.length > 0)
  assert.doesNotMatch(String(error.message), /PRIVATE_SOURCE_COMMENT_682b|SESSION_SECRET_31a9/)
  assert.ok(!String(error.message).includes(root), 'Refusal exposed the absolute fixture path')
  return true
}

async function refused(action, root) {
  await assert.rejects(async () => action(), (error) => assertCoded(error, root))
}

function safeMetadata(value, root, { exportOnly = false } = {}) {
  const serialized = JSON.stringify(value)
  assert.ok(serialized.length <= 400_000, 'Proposal/export exceeded the declared bound')
  assert.ok(!serialized.includes(root), 'Metadata exposed the absolute fixture root')
  assert.doesNotMatch(serialized, /PRIVATE_SOURCE_COMMENT_682b|SESSION_SECRET_31a9|data-systemx-session|local-session\.json/)
  assert.ok(!serialized.includes(page), 'Metadata exposed the full source body')
  if (exportOnly) assert.doesNotMatch(serialized, /Fixture headline|Fixture introduction|Private label/)
}

const proposalOf = (result) => result?.proposal ?? result
const reference = (map, node) => ({ workspaceId: map.workspaceId, documentId: map.documentId, nodeId: node.id })
const anchored = (map, anchor) => {
  const node = map.nodes.find((candidate) => candidate.anchor === anchor)
  assert.ok(node, 'Expected authored anchor ' + anchor)
  return node
}
async function acceptPreview(service, args) {
  const result = await service.preview(args)
  const proposal = proposalOf(result)
  assert.match(proposal.digest, /^[a-f0-9]{64}$/)
  assert.equal(proposal.requiresReview, true)
  assert.equal(result.workspaceId, proposal.map.workspaceId)
  assert.ok(result.ownership)
  const accepted = await service.accept({ digest: proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  assert.equal(accepted.accepted, true)
  return { result, proposal, accepted }
}

test('adapter parses only bounded TSX metadata with exact spans, explicit anchors and read-only regions', (t) => {
  const { root } = fixture(t)
  const workspaceId = sha('independent-workspace')
  const parsed = parseSourceIdentity({ path: homePath, content: page, sourceRevision: sha(page), workspaceId, route: '/home', label: 'Private label' })
  assert.equal(parsed.adapter.id, 'tsx-static-v1')
  assert.equal(parsed.adapter.version, 1)
  assert.deepEqual(parsed.adapter.supportedOperations, ['literal'])
  assert.deepEqual(parsed.adapter.unsupportedOperations, ['style', 'structure', 'generated'])
  assert.equal(parsed.shared, false)
  assert.equal(parsed.map.schemaVersion, 1)
  assert.equal(parsed.map.sourcePath, homePath)
  assert.equal(parsed.map.sourceRevision, sha(page))
  assert.equal(parsed.map.workspaceId, workspaceId)
  assert.equal(parsed.map.route, '/home')
  const headline = anchored(parsed.map, 'headline')
  assert.equal(headline.confidence, 'explicit')
  assert.equal(headline.tag, 'h1')
  assert.equal(headline.source.path, homePath)
  assert.equal(headline.source.sourceRevision, sha(page))
  assert.equal(sha(page.slice(headline.source.start, headline.source.end)), headline.source.fingerprint)
  assert.equal(page.slice(headline.fields.text.start, headline.fields.text.end), 'Fixture headline')
  assert.equal(sha(page.slice(headline.fields.text.start, headline.fields.text.end)), headline.fields.text.fingerprint)
  assert.ok(parsed.map.nodes.some((node) => node.tag === 'Widget' && node.external))
  assert.ok(parsed.map.nodes.some((node) => node.tag === 'aside' && (node.opaque || !node.fields?.text)))
  safeMetadata(parsed, root)

  const shell = parseSourceIdentity({ path: 'src/components/layout/Header.tsx', content: shared, sourceRevision: sha(shared), workspaceId, route: '/', label: '' })
  assert.equal(shell.shared, true)
  assert.equal(anchored(shell.map, 'site-header').source.path, 'src/components/layout/Header.tsx')
})

test('adapter refuses syntax errors, duplicate or invalid anchors, and oversized source without executing TSX', (t) => {
  const { root } = fixture(t)
  const input = (content) => ({ path: homePath, content, sourceRevision: sha(content), workspaceId: sha('independent-workspace') })
  for (const content of [
    'export default function Broken() { return <div>',
    'export default () => <main><p data-systemx-id="same">A</p><p data-systemx-id="same">B</p></main>',
    'export default () => <p data-systemx-id="1bad">Invalid</p>',
    'x'.repeat(1_000_001),
  ]) {
    assert.throws(() => parseSourceIdentity(input(content)), (error) => assertCoded(error, root))
  }
  try {
    const dynamic = parseSourceIdentity(input('export default () => <p data-systemx-id={dynamicId}>Dynamic</p>'))
    assert.ok(dynamic.map.nodes.some((node) => node.tag === 'p' && !node.anchor && (node.opaque || !node.fields?.text)))
  } catch (error) {
    assertCoded(error, root)
  }
})

test('service preview and acceptance are explicit; read, lookup, inspect and literal operation stay source-bound', async (t) => {
  const { root, read } = fixture(t)
  const before = effects(root)
  const service = createSourceIdentityService(root)
  const initial = await service.status()
  assert.match(initial.workspaceId, /^[a-f0-9]{64}$/)
  assert.equal(initial.ruleVersion, 'identity-v1')
  assert.deepEqual(initial.documents, [])
  const preview = await service.preview({ path: homePath, route: '/home', label: 'Private label' })
  const proposal = proposalOf(preview)
  assert.equal(proposal.map.sourceRevision, sha(page))
  assert.equal(proposal.map.sourcePath, homePath)
  assert.equal(proposal.map.ruleVersion, 'identity-v1')
  assert.equal(proposal.requiresReview, true)
  assert.equal(preview.workspaceId, initial.workspaceId)
  assert.ok(preview.ownership)
  safeMetadata(preview, root)
  assert.deepEqual((await service.status()).documents, [], 'Preview silently accepted a map')
  await refused(() => service.accept({ digest: proposal.digest, confirmation: 'wrong' }), root)
  assert.deepEqual((await service.status()).documents, [], 'Wrong confirmation changed accepted state')
  const accepted = await service.accept({ digest: proposal.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  assert.equal(accepted.accepted, true)
  assert.equal(accepted.map.documentId, proposal.map.documentId)
  assert.equal(accepted.ownership.documentId, proposal.map.documentId)
  assert.deepEqual(effects(root), before, 'Import or acceptance changed source or created artifacts')

  const map = accepted.map
  const headline = anchored(map, 'headline')
  const ref = reference(map, headline)
  const status = await service.status()
  assert.deepEqual(status.documents.map((entry) => entry.documentId), [map.documentId])
  assert.equal(status.documents[0].sourceRevision, sha(page))
  assert.equal((await service.read({ path: homePath })).map.documentId, map.documentId)
  assert.equal((await service.read({ documentId: map.documentId })).map.documentId, map.documentId)
  assert.equal((await service.lookup(ref)).status, 'resolved')
  const inspection = await service.inspect(ref)
  assert.ok(JSON.stringify(inspection).includes(headline.id))
  assert.ok(JSON.stringify(inspection).includes('source-owned'))
  const plan = await service.operation({ documentId: map.documentId, reference: ref, expectedRevision: sha(page), text: 'Reviewed headline' })
  assert.equal(plan.allowed, true, JSON.stringify(plan))
  assert.equal(plan.patch.replacement, 'Reviewed headline')
  assert.equal(page.slice(plan.patch.start, plan.patch.end), 'Fixture headline')
  assert.equal(read(homePath), page, 'An operation proposal wrote source')
  assert.deepEqual(effects(root), before, 'Read and operation created artifacts')
  safeMetadata({ status, inspection, plan }, root)

  const wrongWorkspace = { ...ref, workspaceId: sha('other-workspace') }
  assert.equal((await service.lookup(wrongWorkspace)).status, 'workspace-mismatch')
  assert.ok(['missing', 'document-mismatch'].includes((await service.lookup({ ...ref, documentId: 'doc_' + '0'.repeat(64) })).status))
  const rejected = await service.operation({ documentId: map.documentId, reference: wrongWorkspace, expectedRevision: sha(page), text: 'Forbidden' })
  assert.equal(rejected.allowed, false)
  const otherMap = (await acceptPreview(service, { path: otherPath })).accepted.map
  const crossDocument = await service.lookup({
    workspaceId: map.workspaceId, documentId: otherMap.documentId, nodeId: headline.id,
  })
  assert.notEqual(crossDocument.status, 'resolved')
  assert.deepEqual(effects(root), before)
})

test('stale proposals and revision drift leave accepted metadata intact and disable mapped edits', async (t) => {
  const { root, put } = fixture(t)
  const service = createSourceIdentityService(root)
  const first = await service.preview({ path: homePath })
  const oldDigest = proposalOf(first).digest
  await refused(() => service.accept({ digest: sha('wrong proposal'), confirmation: 'ACCEPT IDENTITY MAP' }), root)
  put(homePath, page.replace('Fixture headline', 'Changed outside service'))
  const changed = effects(root)
  await refused(() => service.accept({ digest: oldDigest, confirmation: 'ACCEPT IDENTITY MAP' }), root)
  assert.deepEqual((await service.status()).documents, [])
  assert.deepEqual(effects(root), changed)

  const { accepted } = await acceptPreview(service, { path: homePath })
  const map = accepted.map
  const ref = reference(map, anchored(map, 'headline'))
  put(homePath, page.replace('Fixture headline', 'Changed again outside service'))
  const drifted = effects(root)
  const current = await service.read({ documentId: map.documentId })
  assert.equal(current.map.documentId, map.documentId)
  assert.ok(current.ownership.objects.some((object) => object.status === 'stale'))
  const plan = await service.operation({ documentId: map.documentId, reference: ref, expectedRevision: map.sourceRevision, text: 'Must refuse' })
  assert.equal(plan.allowed, false)
  assert.deepEqual(effects(root), drifted)
})

test('export and reopen retain qualified IDs while malformed and foreign documents cannot replace accepted maps', async (t) => {
  const { root } = fixture(t)
  const before = effects(root)
  const service = createSourceIdentityService(root)
  const { accepted } = await acceptPreview(service, { path: homePath, label: 'Private label' })
  const exported = await service.export({ documentId: accepted.map.documentId })
  assert.equal(exported.schemaVersion, 1)
  assert.equal(exported.kind, 'systemx-source-document')
  assert.equal(exported.workspaceId, accepted.map.workspaceId)
  assert.equal(exported.map.documentId, accepted.map.documentId)
  safeMetadata(exported, root, { exportOnly: true })
  const reopenedService = createSourceIdentityService(root)
  await refused(() => reopenedService.reopen({ document: exported, confirmation: 'wrong' }), root)
  assert.deepEqual((await reopenedService.status()).documents, [])
  const reopened = await reopenedService.reopen({ document: exported, confirmation: 'REOPEN IDENTITY DOCUMENT' })
  assert.equal(reopened.map.documentId, accepted.map.documentId)
  assert.deepEqual(reopened.map.nodes.map((node) => node.id), accepted.map.nodes.map((node) => node.id))
  const baseline = JSON.stringify((await reopenedService.read({ documentId: accepted.map.documentId })).map)

  for (const mutate of [
    (document) => { document.kind = 'unknown' },
    (document) => { document.workspaceId = sha('foreign') },
    (document) => { document.map.nodes[0].parentId = document.map.nodes[0].id },
    (document) => { document.map.nodes[0].source.path = '../private.tsx' },
    (document) => { document.map.nodes.push({ ...document.map.nodes[0] }) },
  ]) {
    const malformed = structuredClone(exported)
    mutate(malformed)
    await refused(() => reopenedService.reopen({ document: malformed, confirmation: 'REOPEN IDENTITY DOCUMENT' }), root)
    assert.equal(JSON.stringify((await reopenedService.read({ documentId: accepted.map.documentId })).map), baseline)
  }
  assert.deepEqual(effects(root), before)
})

test('rename, replacement and reviewed alias proposals preserve only supported references', async (t) => {
  const { root, put } = fixture(t)
  const service = createSourceIdentityService(root)
  const { accepted: first } = await acceptPreview(service, { path: homePath })
  const oldHeadline = anchored(first.map, 'headline')
  const renamedPath = 'src/pages/RenamedPage.tsx'
  put(renamedPath, page)
  const rename = proposalOf(await service.preview({ path: renamedPath, renameFrom: homePath }))
  assert.equal(rename.rename.from, homePath)
  assert.equal(rename.rename.to, renamedPath)
  assert.equal(rename.map.documentId, first.map.documentId)
  assert.equal(anchored(rename.map, 'headline').id, oldHeadline.id)
  await service.accept({ digest: rename.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  await refused(() => service.preview({ path: otherPath, renameFrom: homePath }), root)

  const replacement = page.replace('data-systemx-id="headline"', 'data-systemx-id="new-headline"')
  put(renamedPath, replacement)
  const replacementPreview = proposalOf(await service.preview({ path: renamedPath }))
  const newHeadline = anchored(replacementPreview.map, 'new-headline')
  assert.notEqual(newHeadline.id, oldHeadline.id)
  assert.ok(replacementPreview.retired.some((entry) => JSON.stringify(entry).includes(oldHeadline.id)))
  assert.ok(replacementPreview.added.some((entry) => JSON.stringify(entry).includes(newHeadline.id)))
  await refused(() => service.preview({
    path: renamedPath,
    aliases: [{ from: oldHeadline.id, to: oldHeadline.id, provenance: 'Invalid alias loop' }],
  }), root)
  const aliased = proposalOf(await service.preview({
    path: renamedPath,
    aliases: [{ from: oldHeadline.id, to: newHeadline.id, provenance: 'Reviewed replacement fixture' }],
  }))
  assert.ok(aliased.map.aliases.some((entry) => entry.from === oldHeadline.id && entry.to === newHeadline.id))
  await service.accept({ digest: aliased.digest, confirmation: 'ACCEPT IDENTITY MAP' })
  const resolved = await service.lookup(reference(first.map, oldHeadline))
  assert.equal(resolved.status, 'resolved')
  assert.equal(resolved.node.id, newHeadline.id)
})

test('duplicate unanchored siblings remain unresolved and cannot authorize a literal patch', async (t) => {
  const { root, put } = fixture(t)
  const body = 'export default () => <main><p>Same</p><p>Same</p></main>\n'
  put(homePath, body)
  const service = createSourceIdentityService(root)
  const { accepted } = await acceptPreview(service, { path: homePath })
  const duplicates = accepted.map.nodes.filter((node) => node.tag === 'p')
  assert.equal(duplicates.length, 2)
  assert.notEqual(duplicates[0].id, duplicates[1].id)
  assert.ok(duplicates.every((node) => node.confidence === 'unresolved'))
  assert.ok(accepted.map.warnings.length > 0)
  for (const node of duplicates) {
    const plan = await service.operation({ documentId: accepted.map.documentId, reference: reference(accepted.map, node), expectedRevision: sha(body), text: 'Unsafe' })
    assert.equal(plan.allowed, false)
  }
})

test('workspace qualification and injected readSource do not transfer authority between repositories', async (t) => {
  const first = fixture(t)
  const second = fixture(t)
  const serviceA = createSourceIdentityService(first.root)
  const serviceB = createSourceIdentityService(second.root)
  const mapA = (await acceptPreview(serviceA, { path: homePath })).accepted.map
  const mapB = (await acceptPreview(serviceB, { path: homePath })).accepted.map
  assert.notEqual(mapA.workspaceId, mapB.workspaceId)
  assert.notEqual(mapA.documentId, mapB.documentId)
  assert.equal((await serviceB.lookup(reference(mapA, anchored(mapA, 'headline')))).status, 'workspace-mismatch')
  const blocked = await serviceB.operation({ documentId: mapB.documentId, reference: reference(mapA, anchored(mapA, 'headline')), expectedRevision: sha(page), text: 'Forbidden' })
  assert.equal(blocked.allowed, false)
  const injected = page.replace('Fixture headline', 'Injected fixture')
  const reads = []
  const injection = createSourceIdentityService(first.root, {
    readSource(path) { reads.push(path); return { content: injected, revision: sha(injected) } },
  })
  const preview = proposalOf(await injection.preview({ path: homePath }))
  assert.ok(reads.length >= 1)
  assert.ok(reads.every((path) => path === homePath))
  assert.equal(preview.map.sourceRevision, sha(injected))
  assert.equal(first.read(homePath), page)
  safeMetadata(preview, first.root)
})

test('service refuses an ineligible path and caps accepted documents at fifty', async (t) => {
  const { root, put } = fixture(t)
  const service = createSourceIdentityService(root)
  await refused(() => service.preview({ path: '../src/pages/HomePage.tsx' }), root)
  await refused(() => service.preview({ path: 'src/pages/nested/Hidden.tsx' }), root)
  await refused(() => service.preview({ path: 'src/index.css' }), root)
  for (let index = 0; index < 50; index += 1) {
    const path = 'src/pages/Cap' + String(index).padStart(2, '0') + '.tsx'
    const body = 'export default () => <p data-systemx-id="cap">Cap</p>\n'
    put(path, body)
    await acceptPreview(service, { path })
  }
  assert.equal((await service.status()).documents.length, 50)
  put('src/pages/Cap50.tsx', 'export default () => <p data-systemx-id="cap">Cap</p>\n')
  let fiftyFirst
  try {
    fiftyFirst = proposalOf(await service.preview({ path: 'src/pages/Cap50.tsx' }))
  } catch (error) {
    assertCoded(error, root)
  }
  if (fiftyFirst) {
    await refused(() => service.accept({ digest: fiftyFirst.digest, confirmation: 'ACCEPT IDENTITY MAP' }), root)
  }
  assert.equal((await service.status()).documents.length, 50)
})

test('ownership proposals require review and cannot change source through metadata acceptance', async (t) => {
  const { root, read, put } = fixture(t)
  const service = createSourceIdentityService(root)
  const { accepted } = await acceptPreview(service, { path: homePath })
  const node = anchored(accepted.map, 'headline')
  const before = effects(root)
  const changes = [{
    nodeId: node.id,
    mode: 'source-owned',
    adapterId: 'tsx-static-v1',
    fields: { text: { owner: 'source', supported: true } },
    source: node.source,
    provenance: 'Reviewed independent fixture',
  }]
  const result = await service.ownershipPreview({ documentId: accepted.map.documentId, changes })
  const proposal = proposalOf(result)
  assert.match(proposal.digest, /^[a-f0-9]{64}$/)
  assert.equal(proposal.requiresReview, true)
  assert.ok(Array.isArray(proposal.affected))
  await refused(() => service.ownershipAccept({ digest: proposal.digest, confirmation: 'wrong' }), root)
  const acceptedOwnership = await service.ownershipAccept({ digest: proposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' })
  assert.ok(acceptedOwnership)
  assert.equal(read(homePath), page)
  assert.deepEqual(effects(root), before)
  safeMetadata({ result, acceptedOwnership }, root)
  const staleProposal = proposalOf(await service.ownershipPreview({ documentId: accepted.map.documentId, changes }))
  const changed = page.replace('Fixture headline', 'External revision')
  put(homePath, changed)
  await refused(() => service.ownershipAccept({ digest: staleProposal.digest, confirmation: 'ACCEPT OWNERSHIP CHANGE' }), root)
  assert.equal(read(homePath), changed)
})
