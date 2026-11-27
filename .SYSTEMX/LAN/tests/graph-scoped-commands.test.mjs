import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { graphFixture } from '../../../scripts/lan-graph-contract-browser.mjs'
import { createGraphService } from '../Builder/graph-service.mjs'
import { exportGraphDocument } from '../Builder/graph-evolution.mjs'
import { createScopedGraphCommands } from '../Builder/scoped-graph-commands.mjs'

const workspaceId = 'a'.repeat(64)
const source = 'export const Card = () => "Test";\n'
const sourceRevision = createHash('sha256').update(source).digest('hex')
const by = (graph, id) => graph.nodes.find(node => node.id === id)
async function fixture({ change = () => {}, now } = {}) {
  const graph = graphFixture(workspaceId, sourceRevision)
  const component = by(graph, 'componentRoot')
  component.source = { ...by(graph, 'alpha').source, path: 'src/Card.tsx' }
  component.ownership = 'source-owned'
  change(graph)
  const service = createGraphService({ workspaceId })
  const baseline = exportGraphDocument(graph)
  const reopen = (exported, revision) => service.reopen({ document: exported, expectedRevision: revision, confirmation: 'REOPEN GRAPH' })
  reopen(baseline, null)
  const { run } = createScopedGraphCommands(service, { now, readSource: () => ({ revision: sourceRevision, stamp: 'test-fixture', length: source.length, writable: true }) })
  function request(operation, id, value) {
    return { action: 'review', documentId: graph.documentId, expectedRevision: baseline.revision,
      operation, target: { kind: operation.split('.')[0], id }, capabilityId: 'lan.' + operation + '@1', value }
  }
  const state = () => ({ status: service.status(), accepted: service.read({ documentId: graph.documentId }),
    baseline: service.export({ documentId: graph.documentId }) })
  return { run, state, service, graph, baseline, reopen, request }
}
function decide(review, action, confirmation = review.confirmationText) {
  return { action, expectedRevision: review.targetRevision, proposalId: review.proposalId,
    ...(action === 'confirm' ? { confirmation } : {}) }
}

test('qualified target and operation capability precede value evaluation, including cross-kind collisions and missing owners', async () => {
  const f = await fixture({ change(graph) { graph.components[0].id = 'alpha'; graph.references[0].targetId = 'alpha' } })
  const initial = f.state()
  for (const [op, bad, correctKind] of [
    ['page.setRoute', 'opaque', 'page'], ['node.setLabel', 'page', 'node'], ['component.setVersion', 'page', 'component'],
  ]) {
    const r = f.request(op, bad, null)
    assert.throws(() => f.run(r), { code: 'SCOPED_TARGET_KIND' })
    assert.throws(() => f.run({ ...r, target: { kind: 'collection', id: bad } }), { code: 'SCOPED_TARGET_KIND' })
    assert.throws(() => f.run({ ...r, target: { kind: correctKind, id: 'gone' } }), { code: 'SCOPED_TARGET_MISSING' })
    assert.throws(() => f.run({ ...r, capabilityId: 'unsupported' }), { code: 'SCOPED_CAPABILITY' })
    const { capabilityId, ...withoutCapability } = r
    assert.throws(() => f.run(withoutCapability), error => error.code === 'SCOPED_CAPABILITY' && error.message.includes(capabilityId))
  }
  for (const bad of ['opaque', 'instance', 'root']) {
    assert.throws(() => f.run(f.request('node.setLabel', bad, 'new')), { code: 'SCOPED_OWNER_REQUIRED' })
  }
  const n = f.run(f.request('node.setLabel', 'alpha', 'Node collision'))
  assert.equal(n.effects.changed[0].kind, 'node')
  f.run(decide(n, 'cancel'))
  const c = f.run(f.request('component.setVersion', 'alpha', '2.0'))
  assert.equal(c.effects.changed.some(row => row.kind === 'component'), true)
  assert.deepEqual(f.state(), initial)
})

test('cancel, direct client decisions, superseded text and typed confirmation preserve whole documents and real source bytes', async t => {
  const f = await fixture()
  const dir = await mkdtemp(join(tmpdir(), 'lan-scoped-authority-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  await mkdir(join(dir, 'src', 'pages'), { recursive: true })
  const sources = ['src/pages/GraphFixture.tsx', 'src/Card.tsx'].map(file => join(dir, file))
  await Promise.all(sources.map(path => writeFile(path, source)))
  const initial = f.state()
  const unchanged = async () => {
    assert.deepEqual(f.state(), initial)
    assert.deepEqual(await Promise.all(sources.map(path => readFile(path, 'utf8'))), [source, source])
  }
  const edit = f.request('node.setLabel', 'alpha', 'Reviewed label')
  const first = f.run(edit)
  assert.equal(first.targetRevision, initial.baseline.revision)
  assert.equal(first.owners.some(o => o.path === 'src/pages/GraphFixture.tsx'), true)
  assert.deepEqual(first.effects.changed[0].fields, ['label'])
  assert.equal(first.sourceWrites, false)
  await unchanged()
  const overlap = f.request('page.setRoute', 'page', '/about')
  assert.throws(() => f.run(overlap), { code: 'SCOPED_OVERLAP' })
  assert.throws(() => f.run({ ...decide(first, 'confirm'), value: 'Unreviewed change' }), { code: 'SCOPED_SHAPE' })
  const { confirmation, ...absent } = decide(first, 'confirm')
  assert.throws(() => f.run(absent), { code: 'SCOPED_CONFIRMATION' })
  assert.throws(() => f.run({ ...decide(first, 'cancel'), expectedRevision: 'd'.repeat(64) }), { code: 'SCOPED_REVISION' })
  await unchanged()
  assert.equal(f.run(decide(first, 'cancel')).canceled, true)
  assert.throws(() => f.run(decide(first, 'confirm')), { code: 'SCOPED_PROPOSAL_MISSING' })
  const replacement = f.run(edit)
  assert.notEqual(replacement.proposalId, first.proposalId)
  assert.throws(() => f.run(decide(replacement, 'confirm', confirmation)), { code: 'SCOPED_CONFIRMATION' })
  f.run(decide(replacement, 'cancel'))
  const distinct = f.run(overlap)
  assert.throws(() => f.run(decide(distinct, 'confirm', confirmation)), { code: 'SCOPED_CONFIRMATION' })
  await unchanged()
  const receipt = f.run(decide(distinct, 'confirm'))
  const expected = structuredClone(f.graph); expected.pages[0].route = '/about'
  assert.equal(receipt.revision, distinct.candidateRevision)
  assert.deepEqual(f.state().baseline, exportGraphDocument(expected))
  assert.deepEqual(await Promise.all(sources.map(path => readFile(path, 'utf8'))), [source, source])
  assert.throws(() => f.run(decide(distinct, 'confirm')), { code: 'SCOPED_PROPOSAL_MISSING' })
})

test('component edits declare all linked version constraints and commit only the reviewed metadata', async () => {
  const f = await fixture()
  const proposal = f.run(f.request('component.setVersion', 'card', '2.0'))
  assert.deepEqual(proposal.effects.changed.map(row => [row.kind, row.id, row.fields]), [
    ['component', 'card', ['version']], ['reference', 'componentRef', ['expectedVersion']],
  ])
  assert.deepEqual(proposal.owners.map(o => o.path), ['src/Card.tsx'])
  const expected = structuredClone(f.graph)
  expected.components[0].version = '2.0'; expected.references[0].expectedVersion = '2.0'
  f.run(decide(proposal, 'confirm'))
  assert.deepEqual(f.state().baseline, exportGraphDocument(expected))
})

test('stale head, expiry, forged commit, unavailable owners and foreign source revision refuse', async () => {
  let t = 100
  const f = await fixture({ now: () => t })
  const req = f.request('node.setLabel', 'alpha', 'Updated')
  const p = f.run(req)
  const newer = structuredClone(f.graph)
  by(newer, 'alpha').ownership = 'read-only'
  f.reopen(exportGraphDocument(newer), f.baseline.revision)
  assert.throws(() => f.run(decide(p, 'confirm')), { code: 'SCOPED_STALE' })
  assert.throws(() => f.run(req), { code: 'SCOPED_STALE' })
  const live = f.state().baseline
  assert.throws(() => f.run({ ...req, expectedRevision: live.revision }), { code: 'SCOPED_OWNER_REQUIRED' })
  assert.throws(() => f.run({ ...f.request('page.setRoute', 'page', '/about'), expectedRevision: live.revision }), { code: 'SCOPED_OWNER_REQUIRED' })
  assert.deepEqual(f.state().baseline, live)
  const next = f.run({ ...f.request('component.setVersion', 'card', '2.0'), expectedRevision: live.revision })
  t = next.expiresAt
  assert.throws(() => f.run(decide(next, 'confirm')), { code: 'SCOPED_PROPOSAL_MISSING', reason: 'expired' })
  assert.deepEqual(f.state().baseline, live)
  const different = await fixture({ change(g) { by(g, 'alpha').source.sourceRevision = 'f'.repeat(64); by(g, 'componentRoot').source = null } })
  for (const edit of [different.request('node.setLabel', 'alpha', 'New'), different.request('component.setVersion', 'card', '2.0')]) {
    assert.throws(() => different.run(edit), { code: 'SCOPED_OWNER_REQUIRED' })
  }
})
